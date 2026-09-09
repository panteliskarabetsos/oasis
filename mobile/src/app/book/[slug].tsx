import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Card, EmptyState, Eyebrow, Muted, Serif } from "@/components/ui";
import { colors, fonts, radii, spacing } from "@/constants/theme";
import { useApi } from "@/hooks/useApi";
import { api, ApiError } from "@/lib/api";
import { dayKey, formatDate, formatTime, money } from "@/lib/format";
import type { MeetupPoint, ScheduleSlot } from "@/lib/types";

export default function BookScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();

  const { data: settings } = useApi(() => api.bookingSettings());
  const { data: exp, loading: expLoading, error: expError } = useApi(
    () => api.experience(String(slug)),
    [slug]
  );
  const { data: slots, loading: slotsLoading } = useApi(
    async () => (exp ? api.schedule(exp.id) : []),
    [exp?.id]
  );

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [adults, setAdults] = useState(1);
  const [kids, setKids] = useState(0);
  const [meetup, setMeetup] = useState<MeetupPoint | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const paused = Boolean(settings?.bookingsPaused);

  const futureSlots = useMemo(
    () =>
      (slots ?? []).filter(
        (s) => !s.isCancelled && new Date(s.date).getTime() > Date.now()
      ),
    [slots]
  );

  const byDay = useMemo(() => {
    const map = new Map<string, ScheduleSlot[]>();
    for (const s of futureSlots) {
      const key = dayKey(s.date);
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return map;
  }, [futureSlots]);

  const firstAvailable = useMemo(() => {
    const days = [...byDay.entries()]
      .filter(([, list]) => list.some((s) => (s.available ?? 0) > 0))
      .map(([k]) => k)
      .sort();
    return days[0] ?? null;
  }, [byDay]);

  const day = selectedDay ?? firstAvailable;
  const daySlots = day ? (byDay.get(day) ?? []) : [];
  const selectedSlot = daySlots.find((s) => s.id === selectedSlotId) ?? null;
  const availablePlaces = selectedSlot?.available ?? 0;
  const bookingCap = Math.min(8, availablePlaces);
  const total = adults + kids;

  const meetupOptions: MeetupPoint[] =
    selectedSlot?.meetupPoints ?? exp?.meetupPoints ?? [];

  const marked = useMemo(() => {
    const m: Record<string, any> = {};
    for (const [key, list] of byDay) {
      const remaining = list.reduce((max, s) => Math.max(max, s.available ?? 0), 0);
      const dot =
        remaining >= 6 ? "#4c7a4c" : remaining >= 1 ? colors.warning : colors.danger;
      m[key] = { marked: true, dotColor: dot, disabled: remaining === 0 };
    }
    if (day) m[day] = { ...(m[day] ?? {}), selected: true, selectedColor: colors.brand };
    return m;
  }, [byDay, day]);

  const unitAdult = exp?.pricing?.adult ?? exp?.priceAdult ?? 0;
  const unitKid = exp?.pricing?.kid ?? exp?.priceKid ?? unitAdult;
  const totalPrice = adults * Number(unitAdult) + kids * Number(unitKid);

  async function continueToDetails() {
    if (!exp || !selectedSlot) return;
    setSubmitting(true);
    try {
      const draft = await api.createDraft({
        experienceId: exp.id,
        scheduleSlotId: selectedSlot.id,
        counts: { adults, kids },
        selected_meetup_point: meetup ?? undefined,
      });
      router.push({
        pathname: "/draft/[id]/attendees",
        params: { id: String(draft.id), token: draft.token, expiresAt: draft.expiresAt },
      });
    } catch (e) {
      const msg =
        e instanceof ApiError && e.status === 409
          ? e.message // "Only N spots left"
          : e instanceof Error
            ? e.message
            : "Could not hold your spot. Please try again.";
      Alert.alert("Booking", msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (expLoading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }
  if (expError || !exp) {
    return (
      <View style={styles.screen}>
        <EmptyState title="Experience unavailable" subtitle={expError ?? undefined}>
          <Button title="Back" variant="ghost" onPress={() => router.back()} />
        </EmptyState>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 140 }}>
        <Eyebrow>{exp.location || "Chania, Crete"}</Eyebrow>
        <Serif style={{ fontSize: 24 }}>{exp.name}</Serif>
        <Muted>Starting from {money(unitAdult)} / person</Muted>

        {paused ? (
          <Card style={styles.pausedCard}>
            <Text style={styles.pausedTitle}>Bookings are temporarily paused</Text>
            <Muted style={{ color: colors.danger }}>
              {settings?.bookingsPausedMessage ||
                "Please check back soon or contact us directly."}
              {settings?.bookingsPausedUntil
                ? ` Expected to resume ${formatDate(settings.bookingsPausedUntil)}.`
                : ""}
            </Muted>
          </Card>
        ) : null}

        {/* Step 1: date */}
        <StepHeader step={1} title="Choose a date" />
        {slotsLoading ? (
          <View style={[styles.calendarSkeleton]} />
        ) : futureSlots.length === 0 ? (
          <Card>
            <Muted>
              No upcoming dates on the public calendar. Consider a private journey —
              we'd love to host you.
            </Muted>
            <Button
              title="Plan a Private Journey"
              variant="ghost"
              onPress={() => router.push("/private-inquire")}
              style={{ marginTop: spacing.sm }}
            />
          </Card>
        ) : (
          <>
            <Calendar
              markedDates={marked}
              minDate={dayKey(new Date().toISOString())}
              onDayPress={(d) => {
                if (!byDay.has(d.dateString)) return;
                setSelectedDay(d.dateString);
                setSelectedSlotId(null);
              }}
              theme={{
                calendarBackground: colors.creamSoft,
                todayTextColor: colors.brand,
                arrowColor: colors.brand,
                monthTextColor: colors.brownDeep,
                textMonthFontFamily: fonts.serif,
                textDayFontFamily: fonts.sans,
                textDayHeaderFontFamily: fonts.sansMedium,
                textDisabledColor: colors.border,
              }}
              style={styles.calendar}
            />
            <View style={styles.legend}>
              <LegendDot color="#4c7a4c" label="Plenty of spots" />
              <LegendDot color={colors.warning} label="Few spots" />
            </View>
            {firstAvailable ? (
              <Pressable onPress={() => { setSelectedDay(firstAvailable); setSelectedSlotId(null); }}>
                <Text style={styles.shortcut}>Jump to first available →</Text>
              </Pressable>
            ) : null}
          </>
        )}

        {/* Step 2: time */}
        <StepHeader step={2} title="Choose a time" />
        {day && daySlots.length ? (
          <View style={{ gap: spacing.sm }}>
            {daySlots.map((s) => {
              const soldOut = (s.available ?? 0) <= 0;
              const active = s.id === selectedSlotId;
              return (
                <Pressable
                  key={s.id}
                  disabled={soldOut}
                  onPress={() => setSelectedSlotId(s.id)}
                  style={[
                    styles.slotRow,
                    active && styles.slotRowActive,
                    soldOut && { opacity: 0.45 },
                  ]}
                >
                  <Ionicons
                    name={active ? "radio-button-on" : "radio-button-off"}
                    size={18}
                    color={active ? colors.brand : colors.mutedWarm}
                  />
                  <Text style={[styles.slotTime, active && { color: colors.brand }]}>
                    {formatTime(s.date)}
                  </Text>
                  <Text style={styles.slotSpots}>
                    {soldOut ? "Booked" : `${s.available} spots`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Muted>Select a date to see times.</Muted>
        )}

        {/* Step 3: guests */}
        <StepHeader step={3} title="Guests" />
        <Card>
          <CounterRow
            label="Adults"
            hint="Ages 15+"
            value={adults}
            min={1}
            max={Math.max(1, bookingCap - kids)}
            onChange={setAdults}
            disabled={!selectedSlot}
          />
          <CounterRow
            label="Children"
            hint="Ages 3–14"
            value={kids}
            min={0}
            max={Math.max(0, bookingCap - adults)}
            onChange={setKids}
            disabled={!selectedSlot}
          />
          {selectedSlot ? (
            <Muted style={{ marginTop: 8, fontSize: 12 }}>
              {availablePlaces} spots available · max 8 per booking
            </Muted>
          ) : null}
        </Card>

        {/* Meetup point */}
        {meetupOptions.length ? (
          <>
            <StepHeader step={4} title="Pickup point" />
            <View style={{ gap: spacing.sm }}>
              {meetupOptions.map((m, i) => {
                const active = meetup?.name === m.name;
                return (
                  <Pressable
                    key={i}
                    onPress={() => setMeetup(m)}
                    style={[styles.slotRow, active && styles.slotRowActive]}
                  >
                    <Ionicons
                      name={active ? "radio-button-on" : "radio-button-off"}
                      size={18}
                      color={active ? colors.brand : colors.mutedWarm}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.slotTime}>{m.name || `Point ${i + 1}`}</Text>
                      {m.instructions ? (
                        <Muted style={{ fontSize: 12 }}>{m.instructions}</Muted>
                      ) : null}
                    </View>
                    {m.time ? <Muted style={{ fontSize: 12 }}>{m.time}</Muted> : null}
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {/* Price summary */}
        <Card style={{ marginTop: spacing.lg }}>
          <Serif style={{ fontSize: 18 }}>Summary</Serif>
          <SummaryRow label={`Adults × ${adults}`} value={money(adults * Number(unitAdult))} />
          {kids > 0 ? (
            <SummaryRow label={`Children × ${kids}`} value={money(kids * Number(unitKid))} />
          ) : null}
          <View style={styles.summaryDivider} />
          <SummaryRow label="Total" value={money(totalPrice)} bold />
          {day && selectedSlot ? (
            <Muted style={{ marginTop: 6, fontSize: 12 }}>
              {formatDate(selectedSlot.date)} at {formatTime(selectedSlot.date)}
            </Muted>
          ) : null}
        </Card>
      </ScrollView>

      <View style={[styles.stickyBar, { paddingBottom: insets.bottom + 10 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.stickyTotal}>{money(totalPrice)}</Text>
          <Muted style={{ fontSize: 11 }}>
            {total} guest{total > 1 ? "s" : ""}
          </Muted>
        </View>
        <Button
          title="Continue to Details"
          loading={submitting}
          disabled={paused || !selectedSlot || total < 1 || total > bookingCap}
          onPress={continueToDetails}
          style={{ paddingHorizontal: 24 }}
        />
      </View>
    </View>
  );
}

function StepHeader({ step, title }: { step: number; title: string }) {
  return (
    <View style={styles.stepHeader}>
      <View style={styles.stepBadge}>
        <Text style={styles.stepBadgeText}>{step}</Text>
      </View>
      <Serif style={{ fontSize: 19 }}>{title}</Serif>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Muted style={{ fontSize: 11 }}>{label}</Muted>
    </View>
  );
}

function CounterRow({
  label,
  hint,
  value,
  min,
  max,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.counterRow}>
      <View>
        <Text style={styles.counterLabel}>{label}</Text>
        <Muted style={{ fontSize: 11 }}>{hint}</Muted>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <Pressable
          style={[styles.counterBtn, (disabled || value <= min) && { opacity: 0.35 }]}
          disabled={disabled || value <= min}
          onPress={() => onChange(value - 1)}
        >
          <Ionicons name="remove" size={16} color={colors.brownDeep} />
        </Pressable>
        <Text style={styles.counterValue}>{value}</Text>
        <Pressable
          style={[styles.counterBtn, (disabled || value >= max) && { opacity: 0.35 }]}
          disabled={disabled || value >= max}
          onPress={() => onChange(value + 1)}
        >
          <Ionicons name="add" size={16} color={colors.brownDeep} />
        </Pressable>
      </View>
    </View>
  );
}

function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, bold && { fontFamily: fonts.sansBold }]}>{label}</Text>
      <Text style={[styles.summaryValue, bold && { fontFamily: fonts.sansBold, fontSize: 17 }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  center: { justifyContent: "center", alignItems: "center" },
  pausedCard: {
    marginTop: spacing.md,
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
  },
  pausedTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    color: colors.danger,
    marginBottom: 4,
  },
  stepHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBadgeText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.white },
  calendar: {
    borderRadius: radii.md,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  calendarSkeleton: { height: 320, borderRadius: radii.md, backgroundColor: colors.creamChip },
  legend: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  shortcut: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.brand,
    marginTop: spacing.sm,
  },
  slotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.creamSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  slotRowActive: { borderColor: colors.brand, backgroundColor: colors.creamChip },
  slotTime: { flex: 1, fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.brownDeep },
  slotSpots: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedWarm },
  counterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  counterLabel: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.brownDeep },
  counterBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderWarm,
    backgroundColor: colors.creamChip,
    alignItems: "center",
    justifyContent: "center",
  },
  counterValue: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.brownDeep,
    minWidth: 20,
    textAlign: "center",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  summaryLabel: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted },
  summaryValue: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ink },
  summaryDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginTop: 10,
  },
  stickyBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    backgroundColor: colors.creamSoft,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  stickyTotal: { fontFamily: fonts.sansBold, fontSize: 18, color: colors.brownDeep },
});
