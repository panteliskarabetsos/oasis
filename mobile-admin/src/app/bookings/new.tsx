import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PermissionGate } from "@/components/access";
import { PressableScale } from "@/components/premium";
import { Screen, ScreenHeader } from "@/components/screen";
import { Badge, Button, Card, Muted, Serif } from "@/components/ui";
import { colors, fonts, radii, spacing } from "@/constants/theme";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import type { AdminExperience, AdminSlot, BookingAttendee, MeetupPoint } from "@/lib/types";

/** Mirrors HOLD_HOURS in the website's @/lib/bookings/holds. */
const HOLD_HOURS = 24;

const eur = (n: number, c = "EUR") =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: c }).format(n || 0);

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function NewBookingContent() {
  const insets = useSafeAreaInsets();

  const { data: experiences, loading: expLoading } = useApi(() => api.adminExperiences());
  const [experience, setExperience] = useState<AdminExperience | null>(null);

  const [slotId, setSlotId] = useState<number | null>(null);
  const [adults, setAdults] = useState(1);
  const [kids, setKids] = useState(0);
  const [priceAdult, setPriceAdult] = useState("");
  const [priceKid, setPriceKid] = useState("");
  /** Once the admin edits a price, stop overwriting it from the experience. */
  const [priceTouched, setPriceTouched] = useState(false);

  const [meetupId, setMeetupId] = useState<string | null>(null);
  const [customMeetup, setCustomMeetup] = useState({
    on: false,
    name: "",
    time: "",
    instructions: "",
    surcharge: "",
  });

  const [attendees, setAttendees] = useState<BookingAttendee[]>([]);
  const [contact, setContact] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");

  // Slots for the chosen experience, from today out a few months.
  const slotRange = useMemo(() => {
    const from = new Date();
    const to = new Date(Date.now() + 120 * 86400000);
    return { from: ymd(from), to: ymd(to) };
  }, []);
  const { data: slots, loading: slotsLoading } = useApi(
    async () => (experience ? api.schedule(experience.id, slotRange.from, slotRange.to) : []),
    [experience?.id],
  );

  // Prices come from the experience until the admin says otherwise.
  useEffect(() => {
    if (!experience || priceTouched) return;
    setPriceAdult(experience.priceAdult != null ? String(experience.priceAdult) : "");
    setPriceKid(experience.priceKid != null ? String(experience.priceKid) : "");
  }, [experience, priceTouched]);

  // One attendee row per head, preserving what has been typed.
  const total = adults + kids;
  useEffect(() => {
    setAttendees((prev) =>
      Array.from({ length: total }, (_, i) => ({
        firstName: prev[i]?.firstName ?? "",
        lastName: prev[i]?.lastName ?? "",
        category: i < adults ? ("adult" as const) : ("child" as const),
        notes: prev[i]?.notes ?? "",
      })),
    );
  }, [total, adults]);

  const surcharge = useMemo(() => {
    if (!customMeetup.on) return 0;
    const n = parseFloat(customMeetup.surcharge);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [customMeetup]);

  const estimate = useMemo(
    () =>
      adults * (parseFloat(priceAdult) || 0) + kids * (parseFloat(priceKid) || 0) + surcharge,
    [adults, kids, priceAdult, priceKid, surcharge],
  );

  const meetupPoint: MeetupPoint | null = useMemo(() => {
    if (customMeetup.on) {
      const name = customMeetup.name.trim();
      if (!name) return null;
      return {
        id: "custom",
        name,
        time: customMeetup.time.trim(),
        instructions: customMeetup.instructions.trim(),
        exceptional: true,
        surcharge,
      };
    }
    const points = experience?.meetupPoints ?? [];
    return points.find((p) => String(p.id) === String(meetupId)) ?? null;
  }, [customMeetup, meetupId, experience, surcharge]);

  const upcomingSlots = useMemo(
    () =>
      (slots ?? [])
        .filter((s) => !s.isCancelled && new Date(s.date).getTime() > Date.now())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 40),
    [slots],
  );

  const blockers = useMemo(() => {
    const out: string[] = [];
    if (!experience) out.push("Choose an experience.");
    if (!slotId) out.push("Choose a date and time.");
    if (!contact.firstName.trim()) out.push("The guest's first name is required.");
    if (!contact.lastName.trim()) out.push("The guest's surname is required.");
    if (!isEmail(contact.email)) out.push("A valid email is required — the payment link goes there.");
    if (contact.phone.replace(/\D/g, "").length < 7) out.push("A phone number is required.");
    if (adults < 1) out.push("At least one adult.");
    if (customMeetup.on && !customMeetup.name.trim())
      out.push("Name the exceptional meeting point.");
    return out;
  }, [experience, slotId, contact, adults, customMeetup]);

  async function save() {
    if (blockers.length) {
      Alert.alert("Not ready", blockers[0]);
      return;
    }
    setBusy(true);
    setStage("Creating booking…");
    try {
      const created = await api.createReservation({
        scheduleSlotId: slotId,
        status: "pending",
        notes: notes.trim() || null,
        numberOfPeople: total,
        adultsCount: adults,
        kidsCount: kids,
        counts: { adults, kids, total },
        unitPriceAdult: parseFloat(priceAdult) || 0,
        unitPriceKid: parseFloat(priceKid) || 0,
        totalPaidAmount: null,
        currency: "EUR",
        primary_contact: {
          name: `${contact.firstName.trim()} ${contact.lastName.trim()}`.trim(),
          firstName: contact.firstName.trim(),
          lastName: contact.lastName.trim(),
          email: contact.email.trim().toLowerCase(),
          phone: contact.phone.trim(),
        },
        attendees: attendees.map((a) => ({
          ...a,
          name: [a.firstName, a.lastName].filter(Boolean).join(" ").trim(),
        })),
        selected_meetup_point: meetupPoint,
      });

      const id = created?.item?.id ?? created?.id;
      if (!id) throw new Error("The booking was created but returned no id.");

      setStage("Sending payment link…");
      const pay = await api.requestPayment(id);

      const lines = [
        pay.emailed
          ? `Held ${pay.holdHours ?? HOLD_HOURS}h — payment link sent to ${pay.sentTo}.`
          : `Held ${pay.holdHours ?? HOLD_HOURS}h, but the link could not be emailed${
              pay.emailError ? ` (${pay.emailError})` : ""
            }. Resend it from the booking.`,
      ];
      Alert.alert("Booking created", lines.join("\n"), [
        { text: "Open booking", onPress: () => router.replace(`/bookings/${id}`) },
      ]);
    } catch (e) {
      Alert.alert(
        "Could not complete",
        e instanceof Error ? e.message : "Something went wrong.",
      );
    } finally {
      setBusy(false);
      setStage("");
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <ScreenHeader
            eyebrow="Operations"
            title="New booking"
            subtitle="The guest is emailed a payment link"
            onBack={() => router.back()}
          />

          {/* experience */}
          <Card style={styles.card}>
            <Text style={styles.section}>Experience</Text>
            {expLoading ? (
              <ActivityIndicator color={colors.gold} style={{ marginVertical: spacing.md }} />
            ) : (
              <View style={{ gap: 8 }}>
                {(experiences ?? []).map((x) => {
                  const active = experience?.id === x.id;
                  return (
                    <PressableScale
                      key={x.id}
                      scaleTo={0.99}
                      style={[styles.option, active && styles.optionActive]}
                      onPress={() => {
                        setExperience(x);
                        setSlotId(null);
                        setMeetupId(null);
                        setPriceTouched(false);
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.optionTitle}>{x.name}</Text>
                        <Muted style={{ fontSize: 12 }}>
                          {eur(Number(x.priceAdult) || 0)} adult
                          {x.priceKid != null ? ` · ${eur(Number(x.priceKid))} child` : ""}
                        </Muted>
                      </View>
                      {active ? (
                        <Ionicons name="checkmark-circle" size={20} color={colors.gold} />
                      ) : null}
                    </PressableScale>
                  );
                })}
              </View>
            )}
          </Card>

          {/* date & slot */}
          {experience ? (
            <Card style={styles.card}>
              <Text style={styles.section}>Date &amp; time</Text>
              {slotsLoading ? (
                <ActivityIndicator color={colors.gold} style={{ marginVertical: spacing.md }} />
              ) : upcomingSlots.length === 0 ? (
                <Muted>No upcoming slots for this experience.</Muted>
              ) : (
                <View style={{ gap: 8 }}>
                  {upcomingSlots.map((s: AdminSlot) => {
                    const active = slotId === s.id;
                    const left = s.available ?? (s.totalSlots ?? 0) - (s.booked ?? 0);
                    return (
                      <PressableScale
                        key={s.id}
                        scaleTo={0.99}
                        style={[styles.option, active && styles.optionActive]}
                        onPress={() => setSlotId(s.id)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.optionTitle}>
                            {new Date(s.date).toLocaleString("en-GB", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </Text>
                          <Muted style={{ fontSize: 12 }}>{left} seat{left === 1 ? "" : "s"} left</Muted>
                        </View>
                        {active ? (
                          <Ionicons name="checkmark-circle" size={20} color={colors.gold} />
                        ) : null}
                      </PressableScale>
                    );
                  })}
                </View>
              )}
            </Card>
          ) : null}

          {/* party & prices */}
          <Card style={styles.card}>
            <Text style={styles.section}>Party</Text>
            <Counter label="Adults" value={adults} min={1} onChange={setAdults} />
            <Counter label="Children" value={kids} min={0} onChange={setKids} />
            <View style={styles.row}>
              <LabelledInput
                label="Price / adult"
                value={priceAdult}
                onChangeText={(v) => {
                  setPriceTouched(true);
                  setPriceAdult(v);
                }}
                keyboardType="decimal-pad"
              />
              <LabelledInput
                label="Price / child"
                value={priceKid}
                onChangeText={(v) => {
                  setPriceTouched(true);
                  setPriceKid(v);
                }}
                keyboardType="decimal-pad"
              />
            </View>
          </Card>

          {/* meeting point */}
          {experience ? (
            <Card style={styles.card}>
              <Text style={styles.section}>Meeting point</Text>
              {(experience.meetupPoints ?? []).length === 0 && !customMeetup.on ? (
                <Muted style={{ marginBottom: 8 }}>
                  This experience has no saved meeting points.
                </Muted>
              ) : null}
              <View style={{ gap: 8 }}>
                {(experience.meetupPoints ?? []).map((p) => {
                  const active = !customMeetup.on && String(p.id) === String(meetupId);
                  return (
                    <PressableScale
                      key={String(p.id)}
                      scaleTo={0.99}
                      style={[styles.option, active && styles.optionActive]}
                      onPress={() => {
                        setCustomMeetup((c) => ({ ...c, on: false }));
                        setMeetupId(String(p.id));
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.optionTitle}>{p.name}</Text>
                        {p.time ? <Muted style={{ fontSize: 12 }}>{p.time}</Muted> : null}
                      </View>
                      {active ? (
                        <Ionicons name="checkmark-circle" size={20} color={colors.gold} />
                      ) : null}
                    </PressableScale>
                  );
                })}

                <PressableScale
                  scaleTo={0.99}
                  style={[styles.option, customMeetup.on && styles.optionActive]}
                  onPress={() => setCustomMeetup((c) => ({ ...c, on: !c.on }))}
                >
                  <Ionicons
                    name={customMeetup.on ? "checkmark-circle" : "add-circle-outline"}
                    size={19}
                    color={colors.gold}
                  />
                  <Text style={[styles.optionTitle, { flex: 1 }]}>Exceptional meeting point</Text>
                </PressableScale>
              </View>

              {customMeetup.on ? (
                <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                  <LabelledInput
                    label="Where"
                    value={customMeetup.name}
                    onChangeText={(v) => setCustomMeetup((c) => ({ ...c, name: v }))}
                    placeholder="e.g. Villa Elia, Akrotiri"
                  />
                  <View style={styles.row}>
                    <LabelledInput
                      label="Time"
                      value={customMeetup.time}
                      onChangeText={(v) => setCustomMeetup((c) => ({ ...c, time: v }))}
                      placeholder="08:30AM"
                    />
                    <LabelledInput
                      label="Extra charge"
                      value={customMeetup.surcharge}
                      onChangeText={(v) => setCustomMeetup((c) => ({ ...c, surcharge: v }))}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                    />
                  </View>
                  <LabelledInput
                    label="Instructions"
                    value={customMeetup.instructions}
                    onChangeText={(v) => setCustomMeetup((c) => ({ ...c, instructions: v }))}
                    placeholder="Wait by the gate"
                  />
                </View>
              ) : null}
            </Card>
          ) : null}

          {/* guests */}
          <Card style={styles.card}>
            <Text style={styles.section}>Guests ({total})</Text>
            <View style={{ gap: spacing.sm }}>
              {attendees.map((a, i) => (
                <View key={i} style={styles.attendee}>
                  <View style={styles.attendeeHead}>
                    <Badge label={a.category === "child" ? "child" : "adult"} tone="gold" />
                    <Muted style={{ fontSize: 11.5 }}>Guest {i + 1}</Muted>
                    {i === 0 && contact.firstName ? (
                      <Pressable
                        hitSlop={8}
                        onPress={() =>
                          setAttendees((prev) =>
                            prev.map((x, idx) =>
                              idx === 0
                                ? {
                                    ...x,
                                    firstName: contact.firstName,
                                    lastName: contact.lastName,
                                  }
                                : x,
                            ),
                          )
                        }
                      >
                        <Text style={styles.link}>Same as contact</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <View style={styles.row}>
                    <LabelledInput
                      label="First name"
                      value={a.firstName ?? ""}
                      onChangeText={(v) =>
                        setAttendees((prev) =>
                          prev.map((x, idx) => (idx === i ? { ...x, firstName: v } : x)),
                        )
                      }
                    />
                    <LabelledInput
                      label="Surname"
                      value={a.lastName ?? ""}
                      onChangeText={(v) =>
                        setAttendees((prev) =>
                          prev.map((x, idx) => (idx === i ? { ...x, lastName: v } : x)),
                        )
                      }
                    />
                  </View>
                  <LabelledInput
                    label="Notes"
                    value={a.notes ?? ""}
                    onChangeText={(v) =>
                      setAttendees((prev) =>
                        prev.map((x, idx) => (idx === i ? { ...x, notes: v } : x)),
                      )
                    }
                    placeholder="Allergies, mobility, anything the guide should know"
                  />
                </View>
              ))}
            </View>
          </Card>

          {/* contact */}
          <Card style={styles.card}>
            <Text style={styles.section}>Contact</Text>
            <View style={styles.row}>
              <LabelledInput
                label="First name"
                value={contact.firstName}
                onChangeText={(v) => setContact((c) => ({ ...c, firstName: v }))}
              />
              <LabelledInput
                label="Surname"
                value={contact.lastName}
                onChangeText={(v) => setContact((c) => ({ ...c, lastName: v }))}
              />
            </View>
            <LabelledInput
              label="Email (the payment link goes here)"
              value={contact.email}
              onChangeText={(v) => setContact((c) => ({ ...c, email: v }))}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <LabelledInput
              label="Phone"
              value={contact.phone}
              onChangeText={(v) => setContact((c) => ({ ...c, phone: v }))}
              keyboardType="phone-pad"
            />
            <LabelledInput
              label="Internal notes"
              value={notes}
              onChangeText={setNotes}
              placeholder="Not shown to the guest"
            />
          </Card>

          {/* total & save */}
          <Card style={styles.card}>
            <View style={styles.totalRow}>
              <Text style={styles.section}>To pay by link</Text>
              <Serif style={{ fontSize: 26, color: colors.gold }}>{eur(estimate)}</Serif>
            </View>
            {surcharge > 0 ? (
              <Muted style={{ fontSize: 12 }}>
                Includes {eur(surcharge)} for the exceptional meeting point.
              </Muted>
            ) : null}
            <Muted style={{ fontSize: 12, marginTop: 4 }}>
              Held {HOLD_HOURS}h — cancelled automatically if unpaid.
            </Muted>

            {blockers.length ? (
              <View style={styles.blockers}>
                {blockers.map((b) => (
                  <Text key={b} style={styles.blockerText}>
                    • {b}
                  </Text>
                ))}
              </View>
            ) : null}

            <Button
              title={busy ? stage || "Saving…" : "Create & send payment link"}
              icon="mail-outline"
              loading={busy}
              disabled={busy || blockers.length > 0}
              onPress={save}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function LabelledInput({
  label,
  ...rest
}: React.ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={{ flex: 1, gap: 5 }}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.faint}
        keyboardAppearance="dark"
        {...rest}
        style={styles.input}
      />
    </View>
  );
}

function Counter({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  onChange: (n: number) => void;
}) {
  return (
    <View style={styles.counterRow}>
      <Text style={styles.optionTitle}>{label}</Text>
      <View style={styles.counter}>
        <Pressable hitSlop={8} onPress={() => onChange(Math.max(min, value - 1))}>
          <Ionicons name="remove" size={18} color={colors.textSoft} />
        </Pressable>
        <Text style={styles.counterValue}>{value}</Text>
        <Pressable hitSlop={8} onPress={() => onChange(value + 1)}>
          <Ionicons name="add" size={18} color={colors.textSoft} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: spacing.md, marginTop: spacing.md, gap: spacing.sm },
  section: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.gold,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHigh,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  optionActive: { borderColor: colors.gold, backgroundColor: colors.goldWash },
  optionTitle: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.text },
  row: { flexDirection: "row", gap: spacing.sm },
  inputLabel: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.muted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.text,
  },
  counterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  counter: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  counterValue: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.text,
    minWidth: 22,
    textAlign: "center",
  },
  attendee: {
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 12,
  },
  attendeeHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  link: { fontFamily: fonts.sansSemiBold, fontSize: 11.5, color: colors.gold },
  totalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  blockers: {
    marginTop: spacing.sm,
    gap: 3,
    backgroundColor: colors.warningSoft,
    borderRadius: radii.md,
    padding: 11,
  },
  blockerText: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.warning },
});

export default function NewBookingScreen() {
  return (
    <PermissionGate permission="bookings">
      <NewBookingContent />
    </PermissionGate>
  );
}
