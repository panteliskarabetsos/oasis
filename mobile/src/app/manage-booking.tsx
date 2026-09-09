import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Badge, Button, Card, Divider, Eyebrow, Field, Muted, Serif } from "@/components/ui";
import { colors, fonts, radii, spacing } from "@/constants/theme";
import { api } from "@/lib/api";
import { dayKey, formatDate, formatTime, money, POLICY_MAP } from "@/lib/format";
import type { BookingLookup, MeetupPoint, ScheduleSlot } from "@/lib/types";

type ModalKind = "cancel" | "reschedule" | "meetup" | null;

export default function ManageBookingScreen() {
  const [reference, setReference] = useState("");
  const [lastName, setLastName] = useState("");
  const [booking, setBooking] = useState<BookingLookup | null>(null);
  const [searching, setSearching] = useState(false);
  const [modal, setModal] = useState<ModalKind>(null);
  const [reason, setReason] = useState("");
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [meetupOptions, setMeetupOptions] = useState<MeetupPoint[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [selectedMeetup, setSelectedMeetup] = useState<MeetupPoint | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function search() {
    if (!reference.trim() || !lastName.trim()) {
      Alert.alert("Guest Portal", "Please enter your booking reference and last name.");
      return;
    }
    setSearching(true);
    try {
      const b = await api.lookupBooking(reference.trim(), lastName.trim());
      setBooking(b);
    } catch (e) {
      Alert.alert(
        "Booking not found",
        e instanceof Error ? e.message : "Check the reference (e.g. BK-000123) and last name."
      );
    } finally {
      setSearching(false);
    }
  }

  const eventDate = useMemo(() => {
    if (!booking?.date) return null;
    return new Date(`${booking.date}T${booking.time || "00:00"}:00`);
  }, [booking]);

  const hoursUntil = eventDate
    ? (eventDate.getTime() - Date.now()) / 3600000
    : null;

  const policyKey = booking?.cancellationPolicy ?? "strict";
  const policy = POLICY_MAP[policyKey] ?? POLICY_MAP.strict;

  // Same client-side eligibility rules as the website's guest portal.
  const refundStatus = useMemo(() => {
    if (hoursUntil == null) return null;
    const h = hoursUntil;
    switch (policyKey) {
      case "flexible":
        return h >= 48 ? "full" : "none";
      case "moderate":
        return h >= 168 ? "full" : h >= 48 ? "partial" : "none";
      default: // strict
        return h >= 336 ? "full" : h >= 168 ? "partial" : "none";
    }
  }, [hoursUntil, policyKey]);

  const canChangeMeetup = hoursUntil != null && hoursUntil >= 10;
  const cancelled = (booking?.status ?? "").toLowerCase() === "cancelled";

  async function openModal(kind: Exclude<ModalKind, null>) {
    setReason("");
    setSelectedSlotId(null);
    setSelectedMeetup(null);
    if ((kind === "reschedule" || kind === "meetup") && booking?.experienceId) {
      try {
        const data = await api.schedule(booking.experienceId);
        if (kind === "reschedule") {
          setSlots(
            data.filter(
              (s) =>
                new Date(s.date).getTime() > Date.now() &&
                (s.available ?? 0) >= (booking.guests ?? 1)
            )
          );
        } else {
          setMeetupOptions(data[0]?.meetupPoints ?? []);
        }
      } catch {
        Alert.alert("Guest Portal", "Could not load options. Please try again.");
        return;
      }
    }
    setModal(kind);
  }

  async function submitChange() {
    if (!booking) return;
    if (modal === "cancel" && !reason.trim()) {
      Alert.alert("Cancellation", "Please tell us briefly why you're cancelling.");
      return;
    }
    if (modal === "reschedule" && !selectedSlotId) {
      Alert.alert("Reschedule", "Please pick a new date.");
      return;
    }
    if (modal === "meetup" && !selectedMeetup) {
      Alert.alert("Pickup point", "Please pick a meeting point.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.requestChange(booking.id, {
        type: modal!,
        reason: reason.trim() || undefined,
        newSlotId: selectedSlotId ?? undefined,
        newMeetupPoint: selectedMeetup ?? undefined,
      });
      setBooking({ ...booking, updateRequested: true });
      setModal(null);
      Alert.alert(
        "Request sent",
        res.message ??
          "Our team will review your request and email you shortly."
      );
    } catch (e) {
      Alert.alert("Guest Portal", e instanceof Error ? e.message : "Request failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function payOnline() {
    if (!booking) return;
    setSubmitting(true);
    try {
      const res = await api.paymentLink(booking.id, booking.email);
      const url = res.url ?? res.checkoutUrl;
      if (url) await WebBrowser.openBrowserAsync(url);
      // refresh the payment state afterwards
      const refreshed = await api.lookupBooking(reference.trim(), lastName.trim());
      setBooking(refreshed);
    } catch (e) {
      Alert.alert("Payment", e instanceof Error ? e.message : "Could not create a payment link.");
    } finally {
      setSubmitting(false);
    }
  }

  const slotsByDay = useMemo(() => {
    const map = new Map<string, ScheduleSlot[]>();
    for (const s of slots) {
      const key = dayKey(s.date);
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [slots]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.md, paddingBottom: 64 }}>
      {!booking ? (
        <>
          <Eyebrow>Guest Portal</Eyebrow>
          <Serif style={{ fontSize: 26 }}>Find your booking</Serif>
          <Muted style={{ marginTop: 4 }}>
            No account needed — use the reference from your confirmation email.
          </Muted>
          <Card style={{ marginTop: spacing.lg }}>
            <Field
              label="Booking reference"
              placeholder="BK-000123"
              autoCapitalize="characters"
              value={reference}
              onChangeText={setReference}
            />
            <Field
              label="Last name"
              placeholder="As used on the booking"
              value={lastName}
              onChangeText={setLastName}
              style={{ marginTop: spacing.sm }}
              autoCapitalize="words"
            />
            <Button
              title="Find Booking"
              loading={searching}
              onPress={search}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        </>
      ) : (
        <>
          <Pressable onPress={() => setBooking(null)} style={styles.backRow}>
            <Ionicons name="arrow-back" size={16} color={colors.brand} />
            <Text style={styles.backText}>Search another booking</Text>
          </Pressable>

          <Serif style={{ fontSize: 24, marginTop: spacing.sm }}>
            {booking.experienceName ?? "Oasis Experience"}
          </Serif>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
            <Badge
              label={
                cancelled
                  ? "Cancelled"
                  : booking.paymentStatus === "unpaid"
                    ? "Payment Due"
                    : booking.paymentStatus === "partially_paid"
                      ? "Partially Paid"
                      : booking.status === "pending"
                        ? "Pending"
                        : "Confirmed"
              }
              tone={
                cancelled
                  ? "danger"
                  : booking.paymentStatus !== "paid" || booking.status === "pending"
                    ? "warning"
                    : "success"
              }
            />
            {booking.updateRequested ? <Badge label="Update requested" tone="warning" /> : null}
          </View>

          <Card style={{ marginTop: spacing.md }}>
            <InfoRow label="Reference" value={booking.reference} />
            <InfoRow label="Guest" value={booking.guestName ?? "—"} />
            <InfoRow
              label="When"
              value={`${booking.date ? formatDate(booking.date) : "—"}${booking.time ? ` · ${booking.time}` : ""}`}
            />
            <InfoRow label="Guests" value={String(booking.guests ?? "—")} />
            {booking.meetupPoint ? (
              <InfoRow
                label="Pickup"
                value={
                  typeof booking.meetupPoint === "string"
                    ? booking.meetupPoint
                    : booking.meetupPoint?.name ?? "—"
                }
              />
            ) : null}
          </Card>

          {/* Payment */}
          <Card style={{ marginTop: spacing.md }}>
            <Serif style={{ fontSize: 18 }}>Payment</Serif>
            <InfoRow label="Total" value={money(booking.bookingTotal, booking.currency)} />
            <InfoRow label="Paid" value={money(booking.paidAmount, booking.currency)} />
            {booking.refundedAmount ? (
              <InfoRow label="Refunded" value={money(booking.refundedAmount, booking.currency)} />
            ) : null}
            <InfoRow
              label="Amount due"
              value={money(booking.amountDue, booking.currency)}
            />
            {!cancelled && (booking.amountDue ?? 0) > 0 ? (
              <Button
                title={`Pay ${money(booking.amountDue, booking.currency)} online`}
                loading={submitting}
                onPress={payOnline}
                style={{ marginTop: spacing.sm }}
              />
            ) : null}
          </Card>

          {/* Policy */}
          <Card style={{ marginTop: spacing.md }}>
            <Serif style={{ fontSize: 18 }}>Cancellation policy — {policy.label}</Serif>
            <Muted style={{ marginTop: 4 }}>{policy.description}</Muted>
            {refundStatus ? (
              <Muted style={{ marginTop: 6, fontSize: 12 }}>
                Cancelling now:{" "}
                {refundStatus === "full"
                  ? "eligible for a full refund."
                  : refundStatus === "partial"
                    ? "eligible for a partial (50%) refund."
                    : "no refund under the policy."}
              </Muted>
            ) : null}
          </Card>

          {/* Actions */}
          {!cancelled ? (
            <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
              <Button title="Reschedule" variant="ghost" onPress={() => openModal("reschedule")} />
              <Button
                title="Change pickup point"
                variant="ghost"
                disabled={!canChangeMeetup}
                onPress={() => openModal("meetup")}
              />
              {!canChangeMeetup ? (
                <Muted style={{ fontSize: 11, textAlign: "center" }}>
                  Pickup changes are possible up to 10 hours before the experience.
                </Muted>
              ) : null}
              <Button title="Request cancellation" variant="danger" onPress={() => openModal("cancel")} />
              <Divider />
              <Button
                title="Need help? Email us"
                variant="ghost"
                onPress={() =>
                  Linking.openURL(
                    `mailto:info@youroasis.gr?subject=${encodeURIComponent(
                      `Help with booking ${booking.reference}`
                    )}`
                  )
                }
              />
            </View>
          ) : null}
        </>
      )}

      {/* Action modal */}
      <Modal visible={modal !== null} animationType="slide" presentationStyle="pageSheet">
        <ScrollView style={styles.modal} contentContainerStyle={{ padding: spacing.md, paddingBottom: 48 }}>
          <View style={styles.modalHeader}>
            <Serif style={{ fontSize: 22 }}>
              {modal === "cancel"
                ? "Request cancellation"
                : modal === "reschedule"
                  ? "Reschedule"
                  : "Change pickup point"}
            </Serif>
            <Pressable onPress={() => setModal(null)} hitSlop={8}>
              <Ionicons name="close" size={24} color={colors.brownDeep} />
            </Pressable>
          </View>

          {modal === "reschedule" ? (
            slotsByDay.length ? (
              slotsByDay.map(([day, list]) => (
                <View key={day} style={{ marginTop: spacing.md }}>
                  <Text style={styles.dayHeader}>{formatDate(list[0].date)}</Text>
                  {list.map((s) => (
                    <Pressable
                      key={s.id}
                      onPress={() => setSelectedSlotId(s.id)}
                      style={[styles.optionRow, selectedSlotId === s.id && styles.optionRowActive]}
                    >
                      <Ionicons
                        name={selectedSlotId === s.id ? "radio-button-on" : "radio-button-off"}
                        size={18}
                        color={selectedSlotId === s.id ? colors.brand : colors.mutedWarm}
                      />
                      <Text style={styles.optionText}>{formatTime(s.date)}</Text>
                      <Muted style={{ fontSize: 12 }}>{s.available} spots</Muted>
                    </Pressable>
                  ))}
                </View>
              ))
            ) : (
              <Muted style={{ marginTop: spacing.md }}>
                No alternative dates currently have room for your party. Contact us and
                we'll do our best.
              </Muted>
            )
          ) : null}

          {modal === "meetup" ? (
            meetupOptions.length ? (
              meetupOptions.map((m, i) => (
                <Pressable
                  key={i}
                  onPress={() => setSelectedMeetup(m)}
                  style={[
                    styles.optionRow,
                    { marginTop: spacing.sm },
                    selectedMeetup?.name === m.name && styles.optionRowActive,
                  ]}
                >
                  <Ionicons
                    name={selectedMeetup?.name === m.name ? "radio-button-on" : "radio-button-off"}
                    size={18}
                    color={selectedMeetup?.name === m.name ? colors.brand : colors.mutedWarm}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionText}>{m.name}</Text>
                    {m.instructions ? <Muted style={{ fontSize: 12 }}>{m.instructions}</Muted> : null}
                  </View>
                </Pressable>
              ))
            ) : (
              <Muted style={{ marginTop: spacing.md }}>No pickup points available.</Muted>
            )
          ) : null}

          <Field
            label={modal === "cancel" ? "Reason for cancelling" : "Note (optional)"}
            placeholder={modal === "cancel" ? "Tell us briefly why" : "Anything we should know?"}
            value={reason}
            onChangeText={setReason}
            multiline
            style={{ marginTop: spacing.md }}
            inputStyle={{ minHeight: 80, textAlignVertical: "top" }}
          />

          <Button
            title="Submit request"
            loading={submitting}
            onPress={submitChange}
            style={{ marginTop: spacing.lg }}
            variant={modal === "cancel" ? "danger" : "primary"}
          />
        </ScrollView>
      </Modal>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  backRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  backText: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.brand },
  infoRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md, marginTop: 8 },
  infoLabel: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.mutedWarm },
  infoValue: { flex: 1, textAlign: "right", fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.brownDeep },
  modal: { flex: 1, backgroundColor: colors.cream },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dayHeader: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.brownDeep, marginBottom: 6 },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.creamSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: 6,
  },
  optionRowActive: { borderColor: colors.brand, backgroundColor: colors.creamChip },
  optionText: { flex: 1, fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.brownDeep },
});
