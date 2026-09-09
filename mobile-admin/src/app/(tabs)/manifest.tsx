import { Ionicons } from "@expo/vector-icons";
import { useCallback, useMemo, useState } from "react";
import {
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PermissionGate } from "@/components/access";
import { PressableScale } from "@/components/premium";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Eyebrow,
  Muted,
  Serif,
} from "@/components/ui";
import { colors, fonts, radii, spacing } from "@/constants/theme";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import type { ManifestBooking, ManifestSlot } from "@/lib/types";

/** yyyy-mm-dd in the local timezone, so "today" means the guide's today. */
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function startOfDayISO(day: string) {
  return new Date(`${day}T00:00:00`).toISOString();
}
function endOfDayISO(day: string) {
  return new Date(`${day}T23:59:59.999`).toISOString();
}

const NO_PICKUP = /^no pickup set$/i;

function ManifestContent() {
  const insets = useSafeAreaInsets();
  const [day, setDay] = useState(() => ymd(new Date()));
  const [selected, setSelected] = useState<ManifestBooking | null>(null);

  const { data, loading, error, refresh } = useApi(
    () => api.manifest(startOfDayISO(day), endOfDayISO(day)),
    [day],
  );

  const slots = useMemo<ManifestSlot[]>(
    () =>
      [...(data?.items ?? [])].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      ),
    [data],
  );

  const totals = useMemo(() => {
    const active = slots.filter((s) => !s.isCancelled);
    return {
      tours: active.length,
      guests: active.reduce((sum, s) => sum + (s.totalBooked || 0), 0),
      noPickup: active.reduce(
        (sum, s) =>
          sum + (s.bookings ?? []).filter((b) => NO_PICKUP.test(b.meetupPoint || "")).length,
        0,
      ),
    };
  }, [slots]);

  const shift = useCallback((delta: number) => {
    setDay((d) => {
      const next = new Date(`${d}T12:00:00`);
      next.setDate(next.getDate() + delta);
      return ymd(next);
    });
  }, []);

  const isToday = day === ymd(new Date());
  const heading = new Date(`${day}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: 90 }}
      refreshControl={
        <RefreshControl
          refreshing={loading && !!data}
          onRefresh={refresh}
          tintColor={colors.gold}
        />
      }
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Eyebrow>Operations</Eyebrow>
          <Serif style={{ fontSize: 26 }}>Daily manifest</Serif>
        </View>
      </View>

      {/* day picker */}
      <View style={styles.dayBar}>
        <PressableScale style={styles.dayNav} onPress={() => shift(-1)}>
          <Ionicons name="chevron-back" size={18} color={colors.textSoft} />
        </PressableScale>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.dayLabel}>{heading}</Text>
          {isToday ? <Text style={styles.dayToday}>Today</Text> : null}
        </View>
        <PressableScale style={styles.dayNav} onPress={() => shift(1)}>
          <Ionicons name="chevron-forward" size={18} color={colors.textSoft} />
        </PressableScale>
      </View>

      {!isToday ? (
        <View style={{ paddingHorizontal: spacing.md, marginBottom: spacing.sm }}>
          <Button title="Back to today" variant="ghost" onPress={() => setDay(ymd(new Date()))} />
        </View>
      ) : null}

      {/* totals */}
      {!loading && !error && slots.length ? (
        <View style={styles.totals}>
          <Totals label="Tours" value={totals.tours} />
          <Totals label="Guests" value={totals.guests} />
          <Totals
            label="No pickup"
            value={totals.noPickup}
            tone={totals.noPickup > 0 ? "warning" : undefined}
          />
        </View>
      ) : null}

      {error ? (
        <View style={{ paddingHorizontal: spacing.md }}>
          <ErrorState title="Couldn't load the manifest" message={error} onRetry={refresh} />
        </View>
      ) : loading && !data ? (
        <View style={{ paddingHorizontal: spacing.md, gap: spacing.sm }}>
          {[0, 1].map((i) => (
            <View key={i} style={styles.skeleton} />
          ))}
        </View>
      ) : !slots.length ? (
        <EmptyState
          title="Nothing scheduled"
          subtitle={`No tours are running on ${heading}.`}
        />
      ) : (
        <View style={{ paddingHorizontal: spacing.md, gap: spacing.md }}>
          {slots.map((slot) => (
            <SlotCard key={slot.id} slot={slot} onSelect={setSelected} />
          ))}
        </View>
      )}

      <Muted style={styles.footnote}>
        This is a read-only view. Availability is managed by the office.
      </Muted>

      <ContactSheet guest={selected} onClose={() => setSelected(null)} />
    </ScrollView>
  );
}

function Totals({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warning";
}) {
  return (
    <View style={styles.totalTile}>
      <Text style={[styles.totalValue, tone === "warning" && { color: colors.warning }]}>
        {value}
      </Text>
      <Text style={styles.totalLabel}>{label}</Text>
    </View>
  );
}

function SlotCard({
  slot,
  onSelect,
}: {
  slot: ManifestSlot;
  onSelect: (b: ManifestBooking) => void;
}) {
  const time = new Date(slot.date).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const cap = slot.totalSlots ?? 0;
  const pct = cap > 0 ? Math.min(100, (slot.totalBooked / cap) * 100) : 0;
  const full = cap > 0 && slot.totalBooked >= cap;

  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <View style={styles.slotHead}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={styles.slotTime}>{time}</Text>
            <Text style={styles.slotName} numberOfLines={1}>
              {slot.experienceName}
            </Text>
          </View>
          <Muted style={{ fontSize: 12, marginTop: 2 }}>
            {slot.totalBooked} of {cap || "—"} guests booked
          </Muted>
        </View>
        {slot.isCancelled ? (
          <Badge label="Cancelled" tone="danger" />
        ) : full ? (
          <Badge label="Full" tone="warning" />
        ) : null}
      </View>

      {!slot.isCancelled && cap > 0 ? (
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              { width: `${pct}%`, backgroundColor: full ? colors.warning : colors.brand },
            ]}
          />
        </View>
      ) : null}

      {slot.bookings?.length ? (
        slot.bookings.map((b) => {
          const noPickup = NO_PICKUP.test(b.meetupPoint || "");
          return (
            <PressableScale
              key={b.id}
              style={styles.guestRow}
              onPress={() => onSelect(b)}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={styles.guestName} numberOfLines={1}>
                    {b.guestName}
                  </Text>
                  <View style={styles.paxChip}>
                    <Text style={styles.paxText}>{b.pax ?? "?"} pax</Text>
                  </View>
                </View>
                <View style={styles.pickupRow}>
                  <Ionicons
                    name="location-outline"
                    size={12}
                    color={noPickup ? colors.warning : colors.muted}
                  />
                  <Text
                    style={[styles.pickup, noPickup && { color: colors.warning }]}
                    numberOfLines={1}
                  >
                    {b.meetupPoint}
                  </Text>
                </View>
              </View>
              <Text style={styles.code}>{b.code}</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.faint} />
            </PressableScale>
          );
        })
      ) : (
        <Text style={styles.noGuests}>No bookings yet.</Text>
      )}
    </Card>
  );
}

/** Contact details for one guest, reachable by tapping them on the manifest. */
function ContactSheet({
  guest,
  onClose,
}: {
  guest: ManifestBooking | null;
  onClose: () => void;
}) {
  if (!guest) return null;
  const call = () => guest.phone && Linking.openURL(`tel:${guest.phone}`);
  const mail = () => guest.email && Linking.openURL(`mailto:${guest.email}`);
  const sms = () => guest.phone && Linking.openURL(`sms:${guest.phone}`);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />

        <Text style={styles.sheetName}>{guest.guestName}</Text>
        <Text style={styles.sheetMeta}>
          {guest.code} · {guest.pax ?? "?"} pax
        </Text>

        <View style={styles.sheetBlock}>
          <Text style={styles.sheetLabel}>Pickup</Text>
          <Text style={styles.sheetValue}>{guest.meetupPoint}</Text>
        </View>

        {guest.phone ? (
          <View style={styles.sheetBlock}>
            <Text style={styles.sheetLabel}>Phone</Text>
            <Text style={styles.sheetValue}>{guest.phone}</Text>
          </View>
        ) : null}

        {guest.email ? (
          <View style={styles.sheetBlock}>
            <Text style={styles.sheetLabel}>Email</Text>
            <Text style={styles.sheetValue}>{guest.email}</Text>
          </View>
        ) : null}

        {guest.notes ? (
          <View style={styles.sheetBlock}>
            <Text style={styles.sheetLabel}>Notes</Text>
            <Text style={styles.sheetValue}>{guest.notes}</Text>
          </View>
        ) : null}

        {!guest.phone && !guest.email ? (
          // An absent key means this server predates contact details on the
          // manifest; a present-but-empty one means the booking really has none.
          // Saying "none were captured" for the first case is simply wrong.
          guest.phone === undefined && guest.email === undefined ? (
            <Text style={styles.sheetEmpty}>
              Contact details aren&apos;t available from the server yet. They appear
              once the website has been updated.
            </Text>
          ) : (
            <Text style={styles.sheetEmpty}>
              No contact details were captured on this booking.
            </Text>
          )
        ) : null}

        <View style={styles.sheetActions}>
          {guest.phone ? <Button title="Call" onPress={call} style={{ flex: 1 }} /> : null}
          {guest.phone ? (
            <Button title="Text" variant="ghost" onPress={sms} style={{ flex: 1 }} />
          ) : null}
          {guest.email ? (
            <Button title="Email" variant="ghost" onPress={mail} style={{ flex: 1 }} />
          ) : null}
        </View>

        <Button title="Close" variant="ghost" onPress={onClose} />
      </View>
    </Modal>
  );
}

export default function ManifestScreen() {
  return (
    <PermissionGate permission="schedule">
      <ManifestContent />
    </PermissionGate>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  dayBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  dayNav: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  dayLabel: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.text },
  dayToday: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.gold,
    marginTop: 1,
  },
  totals: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  totalTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  totalValue: { fontFamily: fonts.serif, fontSize: 20, color: colors.text },
  totalLabel: {
    fontFamily: fonts.sans,
    fontSize: 10.5,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.muted,
    marginTop: 1,
  },
  slotHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: colors.surfaceHigh,
  },
  slotTime: { fontFamily: fonts.serif, fontSize: 17, color: colors.text },
  slotName: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.textSoft },
  barTrack: { height: 3, backgroundColor: colors.chip },
  barFill: { height: 3 },
  guestRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  guestName: { flexShrink: 1, fontFamily: fonts.sansMedium, fontSize: 14, color: colors.text },
  paxChip: {
    backgroundColor: colors.chip,
    borderRadius: radii.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  paxText: { fontFamily: fonts.sansMedium, fontSize: 10.5, color: colors.textSoft },
  pickupRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  pickup: { flex: 1, fontFamily: fonts.sans, fontSize: 12, color: colors.muted },
  code: { fontFamily: fonts.sans, fontSize: 10.5, color: colors.faint },
  noGuests: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.muted,
    fontStyle: "italic",
    paddingHorizontal: spacing.md,
    paddingVertical: 16,
    textAlign: "center",
  },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    paddingBottom: 34,
    gap: 10,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.chip,
    marginBottom: 6,
  },
  sheetName: { fontFamily: fonts.serif, fontSize: 22, color: colors.text },
  sheetMeta: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.muted, marginTop: -4 },
  sheetBlock: { gap: 2 },
  sheetLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: colors.faint,
  },
  sheetValue: { fontFamily: fonts.sans, fontSize: 14.5, color: colors.textSoft },
  sheetEmpty: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted, fontStyle: "italic" },
  sheetActions: { flexDirection: "row", gap: spacing.sm, marginTop: 4 },
  skeleton: {
    height: 140,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  footnote: {
    fontSize: 11.5,
    textAlign: "center",
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },
});
