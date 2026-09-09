import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import { statusTone } from "@/app/(tabs)/bookings";
import { Badge, Button, Card, Chip, Divider, EmptyState, Field, Muted, Serif } from "@/components/ui";
import { colors, fonts, radii, spacing } from "@/constants/theme";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import type { AdminSlot } from "@/lib/types";

type ModalKind = "cancel" | "reschedule" | "payment" | "status" | null;

const STATUSES = ["confirmed", "pending", "checked_in", "no_show", "completed", "cancelled"];
const PAY_METHODS = ["cash", "bank_transfer", "other"];

export default function ReservationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error, refresh } = useApi(() => api.reservation(String(id)), [id]);
  const item = data?.item;

  const [modal, setModal] = useState<ModalKind>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [doRefund, setDoRefund] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payAmount, setPayAmount] = useState("");
  const [slots, setSlots] = useState<AdminSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  const totals = useMemo(() => {
    const total = Number(item?.money?.totalAmount ?? item?.totalAmount ?? 0);
    const paid = Number(item?.money?.totalPaidAmount ?? 0);
    return { total, paid, due: Math.max(0, total - paid) };
  }, [item]);

  async function run(action: () => Promise<unknown>, done?: string) {
    setBusy(true);
    try {
      await action();
      setModal(null);
      refresh();
      if (done) Alert.alert("Done", done);
    } catch (e) {
      Alert.alert("Admin", e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function openReschedule() {
    if (!item?.experienceId) {
      Alert.alert("Reschedule", "Private bookings can't be rescheduled here.");
      return;
    }
    try {
      const from = new Date().toISOString().slice(0, 10);
      const to = new Date(Date.now() + 120 * 86400000).toISOString().slice(0, 10);
      const data = await api.schedule(item.experienceId, from, to);
      setSlots(data.filter((s) => !s.isCancelled && (s.available ?? 0) > 0));
      setSelectedSlot(null);
      setModal("reschedule");
    } catch (e) {
      Alert.alert("Reschedule", e instanceof Error ? e.message : "Could not load slots.");
    }
  }

  async function paymentLink() {
    setBusy(true);
    try {
      const res = await api.generatePaymentLink(String(id));
      if (!res.url) throw new Error("No link returned.");
      await Clipboard.setStringAsync(res.url);
      Alert.alert("Payment link copied", res.url, [
        { text: "OK" },
        {
          text: "Email to guest",
          onPress: () =>
            run(
              () => api.sendPaymentEmail(String(id), { paymentLink: res.url!, amountDue: totals.due }),
              "Payment email sent."
            ),
        },
      ]);
    } catch (e) {
      Alert.alert("Payment link", e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }
  if (error || !item) {
    return (
      <View style={styles.screen}>
        <EmptyState title="Reservation not found" subtitle={error ?? undefined}>
          <Button title="Retry" variant="ghost" onPress={refresh} />
        </EmptyState>
      </View>
    );
  }

  const when = item.startTime
    ? new Date(item.startTime).toLocaleString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Private booking";
  const cancelled = (item.status ?? "").toLowerCase() === "cancelled";

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.md, paddingBottom: 64 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text style={styles.code}>{item.code}</Text>
        <Badge label={item.status ?? "—"} tone={statusTone(item.status)} />
      </View>
      <Serif style={{ fontSize: 22, marginTop: 4 }}>
        {item.experienceName ?? item.experience?.name ?? "Reservation"}
      </Serif>
      <Muted>{when}</Muted>

      {/* Guest */}
      <Card style={{ marginTop: spacing.md }}>
        <Text style={styles.cardTitle}>Guest</Text>
        <InfoRow label="Name" value={item.guest?.name ?? item.guestName ?? "—"} />
        <InfoRow label="Email" value={item.guest?.email ?? item.guestEmail ?? "—"} />
        <InfoRow label="Phone" value={item.guest?.phone ?? item.guestPhone ?? "—"} />
        <InfoRow
          label="Party"
          value={`${item.counts?.adults ?? item.adults ?? 0} adults${
            item.counts?.kids || item.kids ? `, ${item.counts?.kids ?? item.kids} kids` : ""
          }`}
        />
        {(item.attendees ?? []).length ? (
          <Muted style={{ marginTop: 8, fontSize: 12 }}>
            {(item.attendees ?? [])
              .map((a: any) => [a.firstName, a.lastName].filter(Boolean).join(" "))
              .filter(Boolean)
              .join(", ")}
          </Muted>
        ) : null}
        {item.guest?.phone || item.guestPhone ? (
          <Button
            title="Call guest"
            variant="ghost"
            onPress={() => Linking.openURL(`tel:${item.guest?.phone ?? item.guestPhone}`)}
            style={{ marginTop: spacing.sm }}
          />
        ) : null}
      </Card>

      {/* Money */}
      <Card style={{ marginTop: spacing.md }}>
        <Text style={styles.cardTitle}>Payment</Text>
        <InfoRow label="Total" value={`€${totals.total.toFixed(2)}`} />
        <InfoRow label="Paid" value={`€${totals.paid.toFixed(2)}`} />
        <InfoRow
          label="Due"
          value={`€${totals.due.toFixed(2)}`}
          tone={totals.due > 0 ? colors.warning : colors.success}
        />
        {item.payments?.paymentMethod?.label ? (
          <InfoRow label="Method" value={item.payments.paymentMethod.label} />
        ) : null}
        {item.appliedPromoCode ? (
          <InfoRow label="Promo" value={String(item.appliedPromoCode)} />
        ) : null}
        {(item.payments?.ledger ?? []).length ? (
          <>
            <Divider />
            {(item.payments!.ledger ?? []).map((l, i) => (
              <Muted key={i} style={{ fontSize: 12, marginTop: 2 }}>
                {l.method ?? "payment"} · €{Number(l.amount ?? 0).toFixed(2)}
                {l.created_at ? ` · ${new Date(l.created_at).toLocaleDateString("en-GB")}` : ""}
              </Muted>
            ))}
          </>
        ) : null}
      </Card>

      {/* Actions */}
      {!cancelled ? (
        <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
          {totals.due > 0 ? (
            <>
              <Button
                title="Record manual payment"
                onPress={() => {
                  setPayAmount(String(totals.due.toFixed(2)));
                  setPayMethod("cash");
                  setModal("payment");
                }}
              />
              <Button title="Payment link (copy / email)" variant="ghost" loading={busy} onPress={paymentLink} />
            </>
          ) : null}
          <Button title="Change status" variant="ghost" onPress={() => setModal("status")} />
          {item.scheduleSlotId ? (
            <Button title="Reschedule" variant="ghost" onPress={openReschedule} />
          ) : null}
          <Button
            title="Cancel booking"
            variant="danger"
            onPress={() => {
              setReason("");
              setDoRefund(false);
              setRefundAmount(String(totals.paid.toFixed(2)));
              setModal("cancel");
            }}
          />
        </View>
      ) : null}

      {/* ---------- Modals ---------- */}
      <ActionModal visible={modal === "status"} title="Change status" onClose={() => setModal(null)}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {STATUSES.map((s) => (
            <Chip
              key={s}
              label={s.replace("_", " ")}
              active={item.status === s}
              onPress={() =>
                run(() => api.updateReservation(String(id), { status: s }), `Status set to ${s}.`)
              }
            />
          ))}
        </View>
      </ActionModal>

      <ActionModal visible={modal === "payment"} title="Manual payment" onClose={() => setModal(null)}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {PAY_METHODS.map((m) => (
            <Chip
              key={m}
              label={m.replace("_", " ")}
              active={payMethod === m}
              onPress={() => setPayMethod(m)}
            />
          ))}
        </View>
        <Field
          label="Amount (€)"
          keyboardType="decimal-pad"
          value={payAmount}
          onChangeText={setPayAmount}
          style={{ marginTop: spacing.md }}
        />
        <Button
          title="Record payment"
          loading={busy}
          onPress={() =>
            run(
              () => api.manualPayment(String(id), { method: payMethod, amount: Number(payAmount) }),
              "Payment recorded."
            )
          }
          style={{ marginTop: spacing.md }}
        />
      </ActionModal>

      <ActionModal visible={modal === "cancel"} title="Cancel booking" onClose={() => setModal(null)}>
        <Field
          label="Reason"
          placeholder="Why is this being cancelled?"
          value={reason}
          onChangeText={setReason}
        />
        {totals.paid > 0 ? (
          <>
            <View style={styles.switchRow}>
              <Muted style={{ flex: 1 }}>Refund via Stripe</Muted>
              <Switch value={doRefund} onValueChange={setDoRefund} trackColor={{ true: colors.brand }} />
            </View>
            {doRefund ? (
              <Field
                label="Refund amount (€)"
                keyboardType="decimal-pad"
                value={refundAmount}
                onChangeText={setRefundAmount}
              />
            ) : null}
          </>
        ) : null}
        <Button
          title={doRefund ? "Cancel & refund" : "Cancel booking"}
          variant="danger"
          loading={busy}
          onPress={() =>
            run(
              () =>
                api.cancelReservation(String(id), {
                  reason: reason.trim() || undefined,
                  refund: doRefund,
                  amountCents: doRefund ? Math.round(Number(refundAmount) * 100) : undefined,
                }),
              "Booking cancelled."
            )
          }
          style={{ marginTop: spacing.md }}
        />
      </ActionModal>

      <ActionModal visible={modal === "reschedule"} title="Reschedule" onClose={() => setModal(null)}>
        {slots.length === 0 ? (
          <Muted>No upcoming slots with availability.</Muted>
        ) : (
          <ScrollView style={{ maxHeight: 360 }}>
            {slots.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => setSelectedSlot(s.id)}
                style={[styles.slotRow, selectedSlot === s.id && styles.slotRowActive]}
              >
                <Ionicons
                  name={selectedSlot === s.id ? "radio-button-on" : "radio-button-off"}
                  size={18}
                  color={selectedSlot === s.id ? colors.gold : colors.faint}
                />
                <Text style={styles.slotText}>
                  {new Date(s.date).toLocaleString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
                <Muted style={{ fontSize: 12 }}>{s.available} free</Muted>
              </Pressable>
            ))}
          </ScrollView>
        )}
        <Button
          title="Move booking"
          disabled={!selectedSlot}
          loading={busy}
          onPress={() =>
            run(() => api.rescheduleReservation(String(id), selectedSlot!), "Booking moved.")
          }
          style={{ marginTop: spacing.md }}
        />
      </ActionModal>
    </ScrollView>
  );
}

function InfoRow({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  );
}

function ActionModal({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <View style={styles.modalSheet}>
        <View style={styles.modalHeader}>
          <Serif style={{ fontSize: 20 }}>{title}</Serif>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>
        {children}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { justifyContent: "center", alignItems: "center" },
  code: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.gold, letterSpacing: 1 },
  cardTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.text, marginBottom: 4 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md, marginTop: 8 },
  infoLabel: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.muted },
  infoValue: {
    flex: 1,
    textAlign: "right",
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.text,
  },
  switchRow: { flexDirection: "row", alignItems: "center", marginVertical: spacing.sm },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl + 8,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  slotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  slotRowActive: {},
  slotText: { flex: 1, fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.text },
});
