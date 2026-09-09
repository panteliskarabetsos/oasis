import { useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Badge, Card, Chip, Divider, EmptyState, ErrorState, Eyebrow, Muted, Serif, StatTile } from "@/components/ui";
import { colors, fonts, spacing } from "@/constants/theme";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { PermissionGate } from "@/components/access";

const EUR = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const RANGES = [
  { key: "30d", label: "30 days", days: 30 },
  { key: "90d", label: "90 days", days: 90 },
  { key: "ytd", label: "Year", days: 365 },
] as const;

function ReportsScreenContent() {
  const [range, setRange] = useState<(typeof RANGES)[number]>(RANGES[0]);
  const from = dayKey(new Date(Date.now() - range.days * 86400000));
  const to = dayKey(new Date());

  const { data, loading, error, refresh } = useApi(() => api.reports(from, to), [range.key]);
  const { data: daily, refresh: refreshDaily } = useApi(() => api.dailyReport(dayKey(new Date())));

  const k = data?.kpis;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: 64 }}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={() => { refresh(); refreshDaily(); }} tintColor={colors.gold} />
      }
    >
      <View style={{ flexDirection: "row", gap: 8 }}>
        {RANGES.map((r) => (
          <Chip key={r.key} label={r.label} active={range.key === r.key} onPress={() => setRange(r)} />
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.xl }} />
      ) : error ? (
        <ErrorState title="Couldn't load reports" message={error} onRetry={refresh} />
      ) : (
        <>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <StatTile label="Revenue" value={EUR.format(k?.totalRevenue ?? 0)} tone="success" />
            <StatTile label="Bookings" value={k?.totalBookings ?? 0} />
          </View>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <StatTile label="Avg order" value={EUR.format(k?.avgOrderValue ?? 0)} />
            <StatTile label="Occupancy" value={`${Math.round(k?.occupancyRate ?? 0)}%`} tone="warning" />
          </View>

          {(data?.topExperiences ?? []).length ? (
            <Card>
              <Eyebrow>Top experiences</Eyebrow>
              {(data!.topExperiences ?? []).slice(0, 5).map((t, i) => (
                <View key={i} style={styles.topRow}>
                  <Text style={styles.topName} numberOfLines={1}>
                    {i + 1}. {t.name}
                  </Text>
                  <Text style={styles.topValue}>
                    {t.revenue != null ? EUR.format(t.revenue) : `${t.bookings ?? 0} bookings`}
                  </Text>
                </View>
              ))}
            </Card>
          ) : null}

          {(data?.statusBreakdown ?? []).length ? (
            <Card>
              <Eyebrow>Status breakdown</Eyebrow>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.sm }}>
                {(data!.statusBreakdown ?? []).map((s, i) => (
                  <Badge key={i} label={`${s.status}: ${s.count}`} tone="neutral" />
                ))}
              </View>
            </Card>
          ) : null}
        </>
      )}

      {/* Today's Z-report snapshot */}
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Eyebrow>Today's Z-Report</Eyebrow>
          <Badge
            label={daily?.locked ? "locked" : "open"}
            tone={daily?.locked ? "danger" : "success"}
          />
        </View>
        <View style={{ marginTop: spacing.sm, gap: 6 }}>
          <ZRow label="Cash" value={daily?.summary?.cash} />
          <ZRow label="Card / Stripe" value={daily?.summary?.card} />
          <ZRow label="Bank transfer" value={daily?.summary?.bank_transfer} />
          <ZRow label="Refunds" value={daily?.summary?.refunds} negative />
          <Divider style={{ marginVertical: 6 }} />
          <ZRow label="Net total" value={daily?.summary?.net_total} bold />
        </View>
        <Muted style={{ marginTop: spacing.sm, fontSize: 11 }}>
          The end-of-day close (lock, cash count, audit) is done on the web console.
        </Muted>
      </Card>
    </ScrollView>
  );
}

function ZRow({
  label,
  value,
  bold,
  negative,
}: {
  label: string;
  value?: number;
  bold?: boolean;
  negative?: boolean;
}) {
  return (
    <View style={styles.zRow}>
      <Text style={[styles.zLabel, bold && { fontFamily: fonts.sansBold, color: colors.text }]}>{label}</Text>
      <Text
        style={[
          styles.zValue,
          bold && { fontFamily: fonts.serif, fontSize: 17 },
          negative && (value ?? 0) > 0 ? { color: colors.danger } : null,
        ]}
      >
        {negative && (value ?? 0) > 0 ? "−" : ""}
        {EUR.format(Math.abs(value ?? 0))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    marginTop: 10,
  },
  topName: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 13, color: colors.text },
  topValue: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.gold },
  zRow: { flexDirection: "row", justifyContent: "space-between" },
  zLabel: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.muted },
  zValue: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.text },
});

export default function ReportsScreen() {
  return (
    <PermissionGate permission="zreport">
      <ReportsScreenContent />
    </PermissionGate>
  );
}
