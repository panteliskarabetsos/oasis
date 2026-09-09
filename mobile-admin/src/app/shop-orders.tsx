import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Alert,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PermissionGate } from "@/components/access";
import {
  Badge,
  Button,
  Divider,
  EmptyState,
  ErrorState,
  Eyebrow,
  ListSkeleton,
  Muted,
  Serif,
} from "@/components/ui";
import { colors, fonts, radii, spacing } from "@/constants/theme";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { formatDateTime, moneyCents } from "@/lib/format";
import type { ShopOrderDetail, ShopOrderRow } from "@/lib/types";

const STATUSES = ["all", "pending", "paid", "fulfilled", "cancelled"] as const;

const orderRef = (id: number | string) => `OS-${String(Number(id) || 0).padStart(6, "0")}`;

function tone(status: string) {
  if (status === "paid" || status === "fulfilled") return "success" as const;
  if (status === "pending") return "warning" as const;
  if (status === "cancelled" || status === "refunded") return "danger" as const;
  return "neutral" as const;
}

export default function ShopOrdersScreen() {
  return (
    <PermissionGate permission="eshop">
      <ShopOrders />
    </PermissionGate>
  );
}

function ShopOrders() {
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [openId, setOpenId] = useState<number | null>(null);

  const { data, loading, error, refresh } = useApi(() => api.shopOrders(status), [status]);
  const orders = data ?? [];

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Eyebrow>E-shop</Eyebrow>
        <Serif style={{ fontSize: 26 }}>Orders</Serif>
      </View>

      <FlatList
        horizontal
        data={STATUSES}
        keyExtractor={(s) => s}
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setStatus(item)}
            style={[styles.filterChip, status === item && styles.filterChipOn]}
          >
            <Text style={[styles.filterText, status === item && styles.filterTextOn]}>
              {item === "all" ? "All" : item[0].toUpperCase() + item.slice(1)}
            </Text>
          </Pressable>
        )}
      />

      {loading && !data ? (
        <View style={{ padding: spacing.md }}>
          <ListSkeleton rows={5} />
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => String(o.id)}
          contentContainerStyle={{
            paddingHorizontal: spacing.md,
            paddingBottom: insets.bottom + 40,
            gap: 8,
          }}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.gold} />
          }
          ListEmptyComponent={
            <EmptyState
              title="No orders"
              subtitle={
                status === "all"
                  ? "Orders from the shop will appear here."
                  : `Nothing with the status “${status}”.`
              }
            />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setOpenId(item.id)}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.ref}>{orderRef(item.id)}</Text>
                <Muted style={{ fontSize: 12, marginTop: 2 }}>
                  {formatDateTime(item.placed_at || item.created_at)}
                </Muted>
              </View>
              <View style={{ alignItems: "flex-end", gap: 6 }}>
                <Text style={styles.total}>
                  {moneyCents(item.total_cents, item.currency)}
                </Text>
                <Badge label={item.status} tone={tone(item.status)} />
              </View>
              <Ionicons name="chevron-forward" size={15} color={colors.faint} />
            </Pressable>
          )}
        />
      )}

      <OrderSheet
        orderId={openId}
        onClose={() => setOpenId(null)}
        onChanged={() => {
          refresh();
        }}
      />
    </View>
  );
}

/* ------------------------------- detail ---------------------------------- */

function OrderSheet({
  orderId,
  onClose,
  onChanged,
}: {
  orderId: number | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [tracking, setTracking] = useState("");
  const [trackingDirty, setTrackingDirty] = useState(false);

  useEffect(() => {
    setTrackingDirty(false);
  }, [orderId]);

  const { data, loading, error, refresh, setData } = useApi<ShopOrderDetail | null>(
    () => (orderId ? api.shopOrder(orderId) : Promise.resolve(null)),
    [orderId],
  );

  const order = data?.order;
  const items = data?.items ?? [];

  // Adopt the stored tracking number, but never overwrite what is being typed.
  useEffect(() => {
    if (!order || trackingDirty) return;
    setTracking(order.tracking_number || "");
  }, [order, trackingDirty]);

  async function setStatus(next: string) {
    if (!orderId) return;
    Haptics.selectionAsync().catch(() => {});
    setBusy(true);
    try {
      await api.shopOrderStatus(orderId, next);
      setData((prev) => (prev ? { ...prev, order: { ...prev.order, status: next } } : prev));
      onChanged();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      Alert.alert("Order", e instanceof Error ? e.message : "Could not update the order");
    } finally {
      setBusy(false);
    }
  }

  async function saveTracking() {
    if (!orderId) return;
    setBusy(true);
    try {
      await api.shopOrderTracking(orderId, tracking.trim());
      setTrackingDirty(false);
      refresh();
      onChanged();
    } catch (e) {
      Alert.alert("Tracking", e instanceof Error ? e.message : "Could not save the tracking number");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      visible={orderId != null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.sheet}>
        <View style={styles.sheetHead}>
          <View style={{ flex: 1 }}>
            <Eyebrow>{orderId ? orderRef(orderId) : ""}</Eyebrow>
            <Serif style={{ fontSize: 22 }}>Order</Serif>
          </View>
          <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
            <Ionicons name="close" size={19} color={colors.text} />
          </Pressable>
        </View>

        {loading ? (
          <View style={{ padding: spacing.md }}>
            <ListSkeleton rows={4} />
          </View>
        ) : error || !order ? (
          <ErrorState message={error ?? "Order not found"} onRetry={refresh} />
        ) : (
          <ScrollView
            contentContainerStyle={{
              padding: spacing.md,
              paddingBottom: insets.bottom + 32,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Badge label={order.status} tone={tone(order.status)} />
              <Muted style={{ fontSize: 12 }}>
                {formatDateTime(order.placed_at || order.created_at)}
              </Muted>
            </View>

            {/* customer */}
            {order.billing_address?.name || order.billing_address?.email ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{order.billing_address?.name ?? "Guest"}</Text>
                {order.billing_address?.email ? (
                  <Pressable
                    onPress={() => Linking.openURL(`mailto:${order.billing_address!.email}`)}
                  >
                    <Text style={styles.link}>{order.billing_address.email}</Text>
                  </Pressable>
                ) : null}
                {order.billing_address?.phone ? (
                  <Pressable
                    onPress={() => Linking.openURL(`tel:${order.billing_address!.phone}`)}
                  >
                    <Text style={styles.link}>{order.billing_address.phone}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {/* items */}
            <View style={styles.card}>
              {items.map((line, i) => (
                <View key={line.id ?? `${line.title_snapshot}-${i}`}>
                  {i > 0 ? <Divider style={{ marginVertical: 10 }} /> : null}
                  <View style={{ flexDirection: "row", gap: spacing.md }}>
                    <Text style={{ ...styles.itemTitle, flex: 1 }}>{line.title_snapshot}</Text>
                    <Text style={styles.itemTotal}>
                      {moneyCents(line.unit_price_cents * line.quantity, order.currency)}
                    </Text>
                  </View>
                  <Muted style={{ fontSize: 12 }}>
                    {line.quantity} × {moneyCents(line.unit_price_cents, order.currency)}
                  </Muted>
                </View>
              ))}
              <Divider style={{ marginVertical: 10 }} />
              {order.shipping_cents != null ? (
                <View style={styles.splitRow}>
                  <Muted style={{ fontSize: 13 }}>
                    {order.shipping_method === "pickup" ? "Collection" : "Delivery"}
                  </Muted>
                  <Muted style={{ fontSize: 13 }}>
                    {Number(order.shipping_cents) === 0
                      ? "Free"
                      : moneyCents(order.shipping_cents, order.currency)}
                  </Muted>
                </View>
              ) : null}
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={styles.cardTitle}>Total</Text>
                <Text style={styles.totalBig}>
                  {moneyCents(order.total_cents, order.currency)}
                </Text>
              </View>
              {Number(data?.refundedCents || 0) > 0 ? (
                <Text style={styles.refunded}>
                  −{moneyCents(data!.refundedCents!, order.currency)} refunded
                </Text>
              ) : null}
            </View>

            {/* delivery */}
            {order.shipping_method === "pickup" ? (
              <View style={styles.card}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <Ionicons name="storefront-outline" size={16} color={colors.info} />
                  <Text style={styles.cardTitle}>Collecting in person</Text>
                </View>
                <Muted style={{ fontSize: 12.5, marginTop: 4 }}>
                  Do not post this one — the customer is picking it up.
                </Muted>
              </View>
            ) : null}
            {order.shipping_method !== "pickup" && order.shipping_address?.line1 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Delivering to</Text>
                <Text style={styles.address}>
                  {[
                    order.shipping_address.name,
                    order.shipping_address.line1,
                    order.shipping_address.line2,
                    [order.shipping_address.postalCode, order.shipping_address.city]
                      .filter(Boolean)
                      .join(" "),
                    order.shipping_address.country,
                  ]
                    .filter(Boolean)
                    .join("\n")}
                </Text>
              </View>
            ) : null}

            {/* tracking */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Tracking</Text>
              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
                <TextInput
                  value={tracking}
                  onChangeText={(t) => {
                    setTracking(t);
                    setTrackingDirty(true);
                  }}
                  placeholder="Tracking number"
                  placeholderTextColor={colors.faint}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  style={styles.input}
                />
                <Button
                  title="Save"
                  variant="ghost"
                  disabled={busy || !trackingDirty}
                  onPress={saveTracking}
                  style={{ minHeight: 44, paddingHorizontal: 18 }}
                />
              </View>
              {data?.eventsAvailable === false ? (
                <Muted style={{ fontSize: 11, marginTop: 6 }}>
                  Needs the order-operations migration on the website.
                </Muted>
              ) : null}
            </View>

            {/* status */}
            <Eyebrow style={{ marginTop: spacing.lg }}>Move it along</Eyebrow>
            <View style={styles.statusRow}>
              {["paid", "fulfilled", "cancelled"].map((s) => (
                <Button
                  key={s}
                  title={s[0].toUpperCase() + s.slice(1)}
                  variant={order.status === s ? "primary" : "ghost"}
                  disabled={busy || order.status === s}
                  onPress={() => setStatus(s)}
                  style={{ flex: 1, minHeight: 46 }}
                />
              ))}
            </View>
            {busy ? (
              <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.md }} />
            ) : (
              <Muted style={{ fontSize: 11.5, marginTop: spacing.sm }}>
                Marking an order fulfilled emails the customer their dispatch notice.
              </Muted>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },

  filterRow: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.chip,
  },
  filterChipOn: { backgroundColor: colors.sand },
  filterText: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.textSoft },
  filterTextOn: { color: colors.bg },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  ref: { fontFamily: fonts.sansSemiBold, fontSize: 14, letterSpacing: 0.6, color: colors.text },
  total: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.gold },

  sheet: { flex: 1, backgroundColor: colors.bg },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.chip,
  },

  card: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.md,
    gap: 3,
  },
  cardTitle: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.text },
  splitRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  link: { fontFamily: fonts.sans, fontSize: 13, color: colors.gold, marginTop: 2 },
  itemTitle: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.text },
  itemTotal: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.text },
  totalBig: { fontFamily: fonts.serif, fontSize: 20, color: colors.gold },
  refunded: { fontFamily: fonts.sans, fontSize: 12, color: colors.danger, marginTop: 4 },
  address: { fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 21, color: colors.textSoft, marginTop: 4 },
  input: {
    flex: 1,
    backgroundColor: colors.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.text,
  },
  statusRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
});
