import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PressableScale, Shimmer } from "@/components/premium";
import { Badge, Card, Eyebrow, Muted, Serif, StatTile } from "@/components/ui";
import { colors, fonts, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";

const EUR = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { data: metrics, loading, refresh, error } = useApi(() => api.metrics());
  const { data: activity, refresh: refreshActivity } = useApi(() => api.activity(10));

  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshActivity();
    }, [refresh, refreshActivity])
  );

  const trend = metrics?.trend ?? [];
  const maxTrend = Math.max(1, ...trend.map((t) => t.value));

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: 48 }}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={() => { refresh(); refreshActivity(); }} tintColor={colors.gold} />
      }
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Eyebrow>{greeting()}</Eyebrow>
          <Serif style={{ fontSize: 28 }}>{profile?.name || "Operations"}</Serif>
        </View>
        <View style={styles.wordmark}>
          <Ionicons name="leaf" size={18} color={colors.gold} />
        </View>
      </View>

      {(metrics?.pendingApprovals ?? 0) > 0 ? (
        <PressableScale style={styles.alert} onPress={() => router.push("/requests")}>
          <Ionicons name="notifications" size={16} color={colors.warning} />
          <Text style={styles.alertText}>
            {metrics!.pendingApprovals} guest request{metrics!.pendingApprovals === 1 ? "" : "s"} awaiting review
          </Text>
          <Ionicons name="arrow-forward" size={14} color={colors.warning} />
        </PressableScale>
      ) : null}

      {/* KPIs */}
      <Eyebrow style={styles.sectionTitle}>This Month</Eyebrow>
      {loading ? (
        <View style={styles.statRow}>
          <Shimmer style={styles.statSkeleton} />
          <Shimmer style={styles.statSkeleton} />
        </View>
      ) : error ? (
        <Card style={{ marginHorizontal: spacing.md, marginTop: spacing.sm }}>
          <Muted>{error}</Muted>
        </Card>
      ) : (
        <>
          <View style={styles.statRow}>
            <StatTile label="Bookings" value={metrics?.bookingsMTD ?? 0} />
            <StatTile label="Revenue" value={EUR.format(metrics?.revenueMTD ?? 0)} tone="success" />
          </View>
          <View style={styles.statRow}>
            <StatTile label="Occupancy" value={`${Math.round(metrics?.occupancyMTDPct ?? 0)}%`} />
            <StatTile label="Open slots" value={metrics?.openSlotsMTD ?? 0} tone="warning" />
          </View>

          {/* Booking trend mini-bars */}
          {trend.length ? (
            <Card style={{ marginHorizontal: spacing.md, marginTop: spacing.sm }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={styles.trendTitle}>Booking trend</Text>
                <Muted style={{ fontSize: 11 }}>{trend.length} days</Muted>
              </View>
              <View style={styles.trendRow}>
                {trend.slice(-21).map((t, i) => (
                  <View
                    key={i}
                    style={[
                      styles.trendBar,
                      { height: 6 + (t.value / maxTrend) * 42 },
                    ]}
                  />
                ))}
              </View>
            </Card>
          ) : null}
        </>
      )}

      {/* Quick actions */}
      <Eyebrow style={styles.sectionTitle}>Quick Actions</Eyebrow>
      <View style={styles.quickGrid}>
        <QuickAction icon="qr-code-outline" label="Check-in" onPress={() => router.push("/checkins")} />
        <QuickAction icon="calendar-outline" label="Bookings" onPress={() => router.push("/bookings")} />
        <QuickAction icon="mail-unread-outline" label="Requests" onPress={() => router.push("/requests")} />
        <QuickAction icon="card-outline" label="Payments" onPress={() => router.push("/payments")} />
        <QuickAction icon="leaf-outline" label="Catalog" onPress={() => router.push("/experiences")} />
        <QuickAction icon="gift-outline" label="Gift cards" onPress={() => router.push("/giftcards")} />
        <QuickAction icon="pricetags-outline" label="Promos" onPress={() => router.push("/promotions")} />
        <QuickAction icon="stats-chart-outline" label="Reports" onPress={() => router.push("/reports")} />
      </View>

      {/* Activity */}
      <Eyebrow style={styles.sectionTitle}>Recent Activity</Eyebrow>
      <Card style={{ marginHorizontal: spacing.md, marginTop: spacing.sm, gap: 2 }}>
        {(activity ?? []).length === 0 ? (
          <Muted>No recent activity.</Muted>
        ) : (
          (activity ?? []).map((a, i) => (
            <View key={String(a.id)} style={[styles.activityRow, i > 0 && styles.activityDivider]}>
              <View style={styles.activityDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.activityLabel} numberOfLines={1}>{a.label}</Text>
                {a.meta ? <Muted style={{ fontSize: 11 }}>{a.meta}</Muted> : null}
              </View>
              <Muted style={{ fontSize: 11 }}>
                {a.at ? new Date(a.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : ""}
              </Muted>
            </View>
          ))
        )}
      </Card>

      {profile?.role ? (
        <View style={{ alignItems: "center", marginTop: spacing.lg }}>
          <Badge label={`Signed in as ${profile.role}`} tone="info" />
        </View>
      ) : null}
    </ScrollView>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
}) {
  return (
    <PressableScale style={styles.quick} onPress={onPress}>
      <View style={styles.quickIcon}>
        <Ionicons name={icon} size={19} color={colors.gold} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  wordmark: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderGold,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  alert: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: "rgba(217,164,65,0.35)",
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  alertText: { flex: 1, fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.warning },
  sectionTitle: { paddingHorizontal: spacing.md, marginTop: spacing.lg },
  statRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  statSkeleton: { flex: 1, height: 84, borderRadius: radii.lg },
  trendTitle: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.textSoft },
  trendRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    marginTop: spacing.md,
    height: 52,
  },
  trendBar: {
    flex: 1,
    borderRadius: 2,
    backgroundColor: colors.brand,
    opacity: 0.85,
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  quick: {
    width: "22.7%",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingVertical: 14,
  },
  quickIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: { fontFamily: fonts.sansMedium, fontSize: 10.5, color: colors.textSoft },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
  },
  activityDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  activityDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.gold },
  activityLabel: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.text },
});
