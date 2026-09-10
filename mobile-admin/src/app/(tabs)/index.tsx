import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { PressableScale, Shimmer } from "@/components/premium";
import { Screen, ScreenHeader, SectionHeader, useTabBarPadding } from "@/components/screen";
import {
  Badge,
  Card,
  Muted,
  Sparkline,
  StatTile,
} from "@/components/ui";
import { colors, fonts, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import type { ActivityItem } from "@/lib/types";

const EUR = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

type IconName = React.ComponentProps<typeof Ionicons>["name"];

/** The activity feed is a flat list of labels; a glyph per kind makes it
 *  scannable without the backend having to send an icon. */
function activityIcon(label: string): IconName {
  const l = label.toLowerCase();
  if (l.includes("refund")) return "arrow-undo-outline";
  if (l.includes("payment") || l.includes("paid")) return "card-outline";
  if (l.includes("cancel")) return "close-circle-outline";
  if (l.includes("check")) return "checkmark-circle-outline";
  if (l.includes("request")) return "mail-unread-outline";
  if (l.includes("order") || l.includes("shop")) return "bag-handle-outline";
  if (l.includes("gift")) return "gift-outline";
  return "calendar-outline";
}

export default function DashboardScreen() {
  const bottomPad = useTabBarPadding(spacing.lg);
  const { profile, can } = useAuth();

  const quickActions = [
    { perm: "checkins", icon: "qr-code-outline", label: "Check-in", href: "/checkins" },
    { perm: "bookings", icon: "calendar-outline", label: "Bookings", href: "/bookings" },
    { perm: "requests", icon: "mail-unread-outline", label: "Requests", href: "/requests" },
    { perm: "pos", icon: "calculator-outline", label: "Till", href: "/pos" },
    { perm: "payments", icon: "card-outline", label: "Payments", href: "/payments" },
    { perm: "experiences", icon: "leaf-outline", label: "Catalog", href: "/experiences" },
    { perm: "eshop", icon: "bag-handle-outline", label: "Shop", href: "/shop-orders" },
    { perm: "zreport", icon: "stats-chart-outline", label: "Reports", href: "/reports" },
  ].filter((a) => can(a.perm));

  const { data: metrics, loading, refresh, error } = useApi(() => api.metrics());
  const { data: activity, refresh: refreshActivity } = useApi(() => api.activity(10));

  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshActivity();
    }, [refresh, refreshActivity])
  );

  const trend = useMemo(() => metrics?.trend ?? [], [metrics]);
  const trendStats = useMemo(() => {
    const values = trend.map((t) => t.value);
    return {
      values,
      total: values.reduce((a, b) => a + b, 0),
      peak: values.length ? Math.max(...values) : 0,
    };
  }, [trend]);

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {
              refresh();
              refreshActivity();
            }}
            tintColor={colors.gold}
          />
        }
      >
        <ScreenHeader
          eyebrow={greeting()}
          title={profile?.name || "Operations"}
          subtitle={today}
          trailing={
            <View style={styles.wordmark}>
              <Ionicons name="leaf" size={17} color={colors.gold} />
            </View>
          }
        />

        {can("requests") && (metrics?.pendingApprovals ?? 0) > 0 ? (
          <PressableScale style={styles.alert} onPress={() => router.push("/requests")}>
            <Ionicons name="notifications" size={16} color={colors.warning} />
            <Text style={styles.alertText}>
              {metrics!.pendingApprovals} guest request
              {metrics!.pendingApprovals === 1 ? "" : "s"} awaiting review
            </Text>
            <Ionicons name="arrow-forward" size={14} color={colors.warning} />
          </PressableScale>
        ) : null}

        {/* KPIs */}
        <SectionHeader title="This Month" />
        {loading && !metrics ? (
          <>
            <View style={styles.statRow}>
              <Shimmer style={styles.statSkeleton} />
              <Shimmer style={styles.statSkeleton} />
            </View>
            <View style={styles.statRow}>
              <Shimmer style={styles.statSkeleton} />
              <Shimmer style={styles.statSkeleton} />
            </View>
          </>
        ) : error ? (
          <Card style={styles.inlineCard}>
            <Muted>{error}</Muted>
          </Card>
        ) : (
          <>
            <View style={styles.statRow}>
              <StatTile
                label="Bookings"
                value={metrics?.bookingsMTD ?? 0}
                icon="calendar-outline"
                onPress={can("bookings") ? () => router.push("/bookings") : undefined}
              />
              <StatTile
                label="Revenue"
                value={EUR.format(metrics?.revenueMTD ?? 0)}
                tone="success"
                icon="trending-up-outline"
                onPress={can("zreport") ? () => router.push("/reports") : undefined}
              />
            </View>
            <View style={styles.statRow}>
              <StatTile
                label="Occupancy"
                value={`${Math.round(metrics?.occupancyMTDPct ?? 0)}%`}
                icon="pie-chart-outline"
                progress={(metrics?.occupancyMTDPct ?? 0) / 100}
              />
              <StatTile
                label="Open slots"
                value={metrics?.openSlotsMTD ?? 0}
                tone="warning"
                icon="time-outline"
                hint="Seats still sellable"
              />
            </View>

            {trendStats.values.length > 1 ? (
              <Card style={styles.inlineCard}>
                <View style={styles.trendHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.trendTitle}>Booking trend</Text>
                    <Muted style={{ fontSize: 11.5 }}>
                      Last {trendStats.values.length} days · peak {trendStats.peak}
                    </Muted>
                  </View>
                  <Badge label={`${trendStats.total} total`} tone="gold" />
                </View>
                <View style={styles.trendChart}>
                  <Sparkline data={trendStats.values} height={64} />
                </View>
                <View style={styles.trendAxis}>
                  <Muted style={styles.axisLabel}>{trend[0]?.name ?? ""}</Muted>
                  <Muted style={styles.axisLabel}>{trend[trend.length - 1]?.name ?? ""}</Muted>
                </View>
              </Card>
            ) : null}
          </>
        )}

        {/* Quick actions — only what this account can actually open */}
        {quickActions.length > 0 ? (
          <>
            <SectionHeader title="Quick Actions" />
            <View style={styles.quickGrid}>
              {quickActions.map((a) => (
                <QuickAction
                  key={a.href}
                  icon={a.icon as IconName}
                  label={a.label}
                  onPress={() => router.push(a.href as never)}
                />
              ))}
            </View>
          </>
        ) : null}

        {/* Activity */}
        <SectionHeader title="Recent Activity" />
        <Card style={[styles.inlineCard, { paddingVertical: 4 }]}>
          {(activity ?? []).length === 0 ? (
            <View style={{ paddingVertical: 12 }}>
              <Muted>No recent activity.</Muted>
            </View>
          ) : (
            (activity ?? []).map((a: ActivityItem, i: number) => (
              <View key={String(a.id)} style={[styles.activityRow, i > 0 && styles.activityDivider]}>
                <View style={styles.activityIcon}>
                  <Ionicons name={activityIcon(a.label)} size={14} color={colors.gold} />
                </View>
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={styles.activityLabel} numberOfLines={1}>
                    {a.label}
                  </Text>
                  {a.meta ? (
                    <Muted style={{ fontSize: 11.5 }} numberOfLines={1}>
                      {a.meta}
                    </Muted>
                  ) : null}
                </View>
                <Muted style={{ fontSize: 11 }}>
                  {a.at
                    ? new Date(a.at).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : ""}
                </Muted>
              </View>
            ))
          )}
        </Card>

        {profile?.role ? (
          <Muted style={styles.signedIn}>
            Signed in as {profile.name || profile.email} · {profile.role}
          </Muted>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <PressableScale style={styles.quick} onPress={onPress}>
      <View style={styles.quickIcon}>
        <Ionicons name={icon} size={19} color={colors.gold} />
      </View>
      <Text style={styles.quickLabel} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
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
  inlineCard: { marginHorizontal: spacing.md, marginTop: spacing.sm },
  statRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  statSkeleton: { flex: 1, height: 88, borderRadius: radii.lg },
  trendHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  trendTitle: { fontFamily: fonts.sansSemiBold, fontSize: 13.5, color: colors.text },
  trendChart: { marginTop: spacing.md, marginHorizontal: -spacing.xs },
  trendAxis: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  axisLabel: { fontSize: 10.5, color: colors.faint },
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
    gap: 7,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  quickIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.goldWash,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.goldLine,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: { fontFamily: fonts.sansMedium, fontSize: 10.5, color: colors.textSoft },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
  },
  activityDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  activityIcon: {
    width: 26,
    height: 26,
    borderRadius: 9,
    backgroundColor: colors.goldWash,
    alignItems: "center",
    justifyContent: "center",
  },
  activityLabel: { fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.text },
  signedIn: { textAlign: "center", fontSize: 12, marginTop: spacing.lg },
});
