import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import { Ornament } from "@/components/premium";
import { Badge, Button, Divider, Eyebrow, Muted, Serif } from "@/components/ui";
import { colors, fonts, radii, spacing } from "@/constants/theme";
import { api } from "@/lib/api";
import { formatDateTime, moneyCents } from "@/lib/format";
import { orderRef, orderStatusLabel, orderTone } from "@/lib/shop";
import type { ShopOrder, ShopOrderItem } from "@/lib/types";

const INK = "#26201a";
/** Stripe's webhook usually lands within a second or two; give it a window. */
const POLL_DELAYS_MS = [1200, 2000, 3000, 5000];



export default function OrderScreen() {
  const { id, email, paid } = useLocalSearchParams<{
    id: string;
    email?: string;
    paid?: string;
  }>();

  const [order, setOrder] = useState<ShopOrder | null>(null);
  const [items, setItems] = useState<ShopOrderItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState(paid === "1");
  const attempt = useRef(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await api.shopOrder(String(id), email ? String(email) : undefined);
      if (!alive.current) return res?.order ?? null;
      setOrder(res.order);
      setItems(res.items ?? []);
      setError(null);
      return res.order;
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : "Could not load the order");
      return null;
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [id, email]);

  // Ask the server to settle, then keep looking until the webhook agrees.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      const current = await load();
      if (!alive.current) return;
      if (current && current.status !== "pending") {
        setSettling(false);
        return;
      }
      if (attempt.current >= POLL_DELAYS_MS.length) {
        setSettling(false);
        return;
      }
      // A confirm is idempotent, so retrying it while polling is safe.
      try {
        await api.confirmShopOrder(String(id));
      } catch {
        // not payable yet, or already settled elsewhere
      }
      const delay = POLL_DELAYS_MS[attempt.current];
      attempt.current += 1;
      timer = setTimeout(tick, delay);
    }

    tick();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [id, load]);

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (error || !order) {
    return (
      <View style={[styles.screen, styles.center, { padding: spacing.xl }]}>
        <Serif style={{ fontSize: 22, textAlign: "center" }}>We can't find that order</Serif>
        <Muted style={{ textAlign: "center", marginTop: spacing.sm }}>
          {error || "It may belong to a different email address."}
        </Muted>
        <Button
          title="Back to the shop"
          variant="ghost"
          onPress={() => router.replace("/shop")}
          style={{ marginTop: spacing.lg }}
        />
      </View>
    );
  }

  const settled = order.status !== "pending";
  const address = order.shipping_address || {};

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={[styles.seal, settled && styles.sealPaid]}>
            <Ionicons
              name={settled ? "checkmark" : "hourglass-outline"}
              size={26}
              color={settled ? colors.success : colors.warning}
            />
          </View>
          <Eyebrow style={{ marginTop: spacing.md }}>{orderRef(order.id)}</Eyebrow>
          <Serif style={{ fontSize: 27, textAlign: "center", marginTop: 4 }}>
            {settled ? "Thank you — your order is placed" : "We're confirming your payment"}
          </Serif>
          <Muted style={{ textAlign: "center", marginTop: spacing.sm }}>
            {settled
              ? `A receipt is on its way to ${order.billing_address?.email || "your inbox"}.`
              : "This usually takes a few seconds. You can safely leave this screen."}
          </Muted>
          {settling && !settled ? (
            <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.md }} />
          ) : null}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Order</Text>
            <Badge label={orderStatusLabel(order.status)} tone={orderTone(order.status)} />
          </View>
          <Divider />
          {items.map((item) => (
            <View key={String(item.id ?? item.title_snapshot)} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{item.title_snapshot}</Text>
                <Muted style={{ fontSize: 12 }}>
                  {item.quantity} × {moneyCents(item.unit_price_cents, order.currency)}
                </Muted>
              </View>
              <Text style={styles.itemTotal}>
                {moneyCents(item.unit_price_cents * item.quantity, order.currency)}
              </Text>
            </View>
          ))}
          <Divider />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>
              {moneyCents(order.total_cents, order.currency)}
            </Text>
          </View>
          <Muted style={{ fontSize: 12, marginTop: 6 }}>
            Placed {formatDateTime(order.placed_at || order.created_at)}
          </Muted>
        </View>

        {address.line1 ? (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Ionicons name="cube-outline" size={15} color={colors.gold} />
              <Text style={styles.cardTitle}>Delivering to</Text>
            </View>
            <Text style={styles.addressText}>
              {[
                address.name,
                address.line1,
                address.line2,
                [address.postalCode, address.city].filter(Boolean).join(" "),
                address.country,
              ]
                .filter(Boolean)
                .join("\n")}
            </Text>
            {address.notes ? (
              <Muted style={{ marginTop: spacing.sm, fontSize: 12 }}>{address.notes}</Muted>
            ) : null}
          </View>
        ) : null}

        <Ornament style={{ marginTop: spacing.lg }} />
        <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
          <Button title="Continue shopping" onPress={() => router.replace("/shop")} />
          <Button title="Back to home" variant="ghost" onPress={() => router.replace("/")} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  center: { justifyContent: "center", alignItems: "center" },

  hero: { alignItems: "center", paddingTop: spacing.lg, paddingHorizontal: spacing.sm },
  seal: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.warningSoft,
  },
  sealPaid: { backgroundColor: colors.successSoft },

  card: {
    backgroundColor: colors.creamSoft,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSand,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  cardTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.brownDeep },

  itemRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, marginTop: 8 },
  itemTitle: { fontFamily: fonts.serifRegular, fontSize: 16, lineHeight: 21, color: INK },
  itemTotal: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ink },

  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.brownDeep },
  totalValue: { fontFamily: fonts.serif, fontSize: 24, color: colors.brand },

  addressText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 22,
    color: colors.ink,
    marginTop: spacing.sm,
  },
});
