import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Badge, Button, Card, Chip, Divider, EmptyState, Field, Muted, Serif } from "@/components/ui";
import { colors, fonts, radii, spacing } from "@/constants/theme";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import type { PaymentDetail, PaymentRow } from "@/lib/types";

function cents(n?: number, currency = "eur"): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: currency.toUpperCase() }).format(
    (n ?? 0) / 100
  );
}

function payTone(status?: string): "success" | "warning" | "danger" | "neutral" {
  switch (status) {
    case "succeeded":
      return "success";
    case "processing":
    case "requires_action":
    case "requires_payment_method":
    case "requires_capture":
      return "warning";
    case "canceled":
      return "danger";
    default:
      return "neutral";
  }
}

export default function PaymentsScreen() {
  const { data, loading, error, refresh } = useApi(() =>
    api.payments({ limit: 40 })
  );
  const [detail, setDetail] = useState<PaymentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [busy, setBusy] = useState(false);

  async function openDetail(row: PaymentRow) {
    setDetailLoading(true);
    try {
      const res = await api.payment(row.id);
      setDetail(res.item);
      setRefundAmount(String(((res.item.aggregates?.available_to_refund_cents ?? 0) / 100).toFixed(2)));
    } catch (e) {
      Alert.alert("Payments", e instanceof Error ? e.message : "Could not load payment.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function refund() {
    if (!detail) return;
    const amountCents = Math.round(Number(refundAmount) * 100);
    if (!amountCents || amountCents <= 0) {
      Alert.alert("Refund", "Enter a valid amount.");
      return;
    }
    Alert.alert("Confirm refund", `Refund ${cents(amountCents, detail.currency)} to the guest's card?`, [
      { text: "Back", style: "cancel" },
      {
        text: "Refund",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await api.refundPayment(detail.id, { amount_cents: amountCents, reason: "requested_by_customer" });
            setDetail(null);
            refresh();
            Alert.alert("Refund issued", "The refund is on its way to the guest.");
          } catch (e) {
            Alert.alert("Refund", e instanceof Error ? e.message : "Refund failed.");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  const items = data?.items ?? [];

  return (
    <View style={styles.screen}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : error ? (
        <EmptyState title="Couldn't load payments" subtitle={error}>
          <Button title="Retry" variant="ghost" onPress={refresh} />
        </EmptyState>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: 48 }}
          refreshing={false}
          onRefresh={refresh}
          renderItem={({ item: p }) => (
            <Pressable onPress={() => openDetail(p)}>
              <Card>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>
                      {p.customer?.name || p.customer?.email || p.id}
                    </Text>
                    <Muted style={{ fontSize: 11 }}>
                      {p.created ? new Date(p.created * 1000).toLocaleString("en-GB") : ""}
                      {p.card_brand ? ` · ${p.card_brand} •••• ${p.card_last4}` : ""}
                      {p.booking_id ? ` · booking #${p.booking_id}` : ""}
                    </Muted>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 5 }}>
                    <Text style={styles.amount}>{cents(p.amount, p.currency)}</Text>
                    <Badge label={p.status ?? "—"} tone={payTone(p.status)} />
                  </View>
                </View>
              </Card>
            </Pressable>
          )}
          ListEmptyComponent={<EmptyState title="No payments" />}
        />
      )}

      {detailLoading ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : null}

      <Modal visible={!!detail} transparent animationType="slide" onRequestClose={() => setDetail(null)}>
        <Pressable style={styles.backdrop} onPress={() => setDetail(null)} />
        {detail ? (
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Serif style={{ fontSize: 20 }}>Payment</Serif>
              <Pressable onPress={() => setDetail(null)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>
            <Muted style={{ fontSize: 11 }}>{detail.id}</Muted>
            <Row label="Status" value={detail.status ?? "—"} />
            <Row label="Charged" value={cents(detail.aggregates?.amount_received_cents, detail.currency)} />
            <Row label="Refunded" value={cents(detail.aggregates?.refunds_total_cents, detail.currency)} />
            <Row label="Net" value={cents(detail.aggregates?.net_cents, detail.currency)} />
            <Row
              label="Refundable"
              value={cents(detail.aggregates?.available_to_refund_cents, detail.currency)}
              tone={colors.gold}
            />
            {detail.booking_id ? (
              <Button
                title={`Open booking #${detail.booking_id}`}
                variant="ghost"
                onPress={() => {
                  setDetail(null);
                  router.push(`/bookings/${detail.booking_id}`);
                }}
                style={{ marginTop: spacing.md }}
              />
            ) : null}
            {(detail.aggregates?.available_to_refund_cents ?? 0) > 0 ? (
              <>
                <Divider />
                <Field
                  label="Refund amount (€)"
                  keyboardType="decimal-pad"
                  value={refundAmount}
                  onChangeText={setRefundAmount}
                />
                <Button
                  title="Issue refund"
                  variant="danger"
                  loading={busy}
                  onPress={refund}
                  style={{ marginTop: spacing.md }}
                />
              </>
            ) : null}
          </View>
        ) : (
          <View />
        )}
      </Modal>
    </View>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  name: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.text },
  amount: { fontFamily: fonts.serif, fontSize: 17, color: colors.text },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderTopWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    paddingBottom: spacing.xl + 8,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  rowLabel: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.muted },
  rowValue: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.text },
});
