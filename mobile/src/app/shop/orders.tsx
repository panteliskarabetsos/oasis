import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { PressableScale } from "@/components/premium";
import { Badge, Button, EmptyState, Eyebrow, Muted, Serif } from "@/components/ui";
import { colors, fonts, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { formatDate, moneyCents } from "@/lib/format";
import { orderRef, orderStatusLabel, orderTone } from "@/lib/shop";

const INK = "#26201a";


export default function ShopOrdersScreen() {
  const { session } = useAuth();
  const { data, loading, error, refresh } = useApi(
    () => (session ? api.myShopOrders() : Promise.resolve({ items: [] })),
    [session?.user?.id]
  );

  if (!session) {
    return (
      <View style={styles.screen}>
        <EmptyState
          title="Sign in to see your orders"
          subtitle="Your shop orders are kept with your Oasis account."
        >
          <Button title="Log in" onPress={() => router.push("/login")} />
        </EmptyState>
      </View>
    );
  }

  const orders = data?.items ?? [];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: 48 }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.brand} />}
    >
      <Eyebrow>From the shop</Eyebrow>
      <Serif style={{ fontSize: 27 }}>Your Orders</Serif>

      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xl }} />
      ) : error ? (
        <EmptyState title="We couldn't load your orders" subtitle={error} />
      ) : orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          subtitle="Everything you buy from the shop will be listed here."
        >
          <Button title="Browse the shop" onPress={() => router.replace("/shop")} />
        </EmptyState>
      ) : (
        <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
          {orders.map((order) => (
            <PressableScale
              key={order.id}
              scaleTo={0.98}
              style={styles.card}
              onPress={() =>
                router.push({ pathname: "/shop/order/[id]", params: { id: String(order.id) } })
              }
            >
              <View style={styles.cardHead}>
                <Text style={styles.ref}>{orderRef(order.id)}</Text>
                <Badge label={orderStatusLabel(order.status)} tone={orderTone(order.status)} />
              </View>
              <Text style={styles.summary} numberOfLines={2}>
                {(order.items ?? [])
                  .map((i) => `${i.quantity} × ${i.title_snapshot}`)
                  .join(", ") || "—"}
              </Text>
              <View style={styles.cardFoot}>
                <Muted style={{ fontSize: 12 }}>
                  {formatDate(order.placed_at || order.created_at)}
                </Muted>
                <Text style={styles.total}>
                  {moneyCents(order.total_cents, order.currency)}
                </Text>
              </View>
            </PressableScale>
          ))}
        </View>
      )}

      <Pressable style={styles.footerLink} onPress={() => router.replace("/shop")}>
        <Ionicons name="bag-handle-outline" size={14} color={colors.brand} />
        <Text style={styles.footerLinkText}>Back to the shop</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  card: {
    backgroundColor: colors.creamSoft,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSand,
    padding: spacing.md,
    gap: 6,
  },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  ref: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.mutedWarm,
  },
  summary: { fontFamily: fonts.serifRegular, fontSize: 16, lineHeight: 22, color: INK },
  cardFoot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  total: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.brand },
  footerLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: spacing.xl,
  },
  footerLinkText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.brand },
});
