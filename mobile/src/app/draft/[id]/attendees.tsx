import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HoldCountdown } from "@/components/HoldCountdown";
import { Ornament } from "@/components/premium";
import { Button, Chip, Eyebrow, Field, Muted, Serif } from "@/components/ui";
import { colors, fonts, radii, shadows, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { formatDateTime, money } from "@/lib/format";

const DIETARY = ["Vegetarian", "Vegan", "Gluten-Free", "Dairy-Free", "Nut Allergy"];

type AttendeeForm = {
  firstName: string;
  lastName: string;
  age: string;
  dietary: string[];
  notes: string;
  category: "adult" | "kid";
};

export default function AttendeesScreen() {
  const { id, token, expiresAt } = useLocalSearchParams<{
    id: string;
    token: string;
    expiresAt?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();

  const { data: envelope, loading } = useApi(
    () => api.getDraft(String(id), String(token)),
    [id, token]
  );

  const counts = envelope?.draft?.counts ?? { adults: 1, kids: 0 };
  const expected = (counts.adults ?? 0) + (counts.kids ?? 0);

  const [attendees, setAttendees] = useState<AttendeeForm[]>([]);
  const [pcName, setPcName] = useState("");
  const [pcEmail, setPcEmail] = useState("");
  const [pcPhone, setPcPhone] = useState("");
  const [autoPc, setAutoPc] = useState(true);
  const [saving, setSaving] = useState(false);

  // Build the attendee rows once the draft loads.
  useEffect(() => {
    if (!envelope?.draft) return;
    if (envelope.draft.status === "paid" || envelope.draft.status === "converted") {
      router.replace({
        pathname: "/draft/[id]/confirmation",
        params: { id: String(id), token: String(token) },
      });
      return;
    }
    const c = envelope.draft.counts ?? { adults: 1, kids: 0 };
    const rows: AttendeeForm[] = [];
    for (let i = 0; i < (c.adults ?? 0); i++)
      rows.push({ firstName: "", lastName: "", age: "", dietary: [], notes: "", category: "adult" });
    for (let i = 0; i < (c.kids ?? 0); i++)
      rows.push({ firstName: "", lastName: "", age: "", dietary: [], notes: "", category: "kid" });
    (envelope.draft.attendees ?? []).forEach((a, i) => {
      if (rows[i]) {
        rows[i].firstName = a.firstName ?? "";
        rows[i].lastName = a.lastName ?? "";
        rows[i].age = a.age != null ? String(a.age) : "";
      }
    });
    setAttendees(rows);
    const pc = envelope.draft.primary_contact;
    if (pc) {
      setPcName([pc.firstName, pc.lastName].filter(Boolean).join(" "));
      setPcEmail(pc.email ?? "");
      setPcPhone(pc.phone ?? "");
    } else if (profile) {
      setPcName([profile.name, profile.surname].filter(Boolean).join(" "));
      setPcEmail(profile.email ?? "");
      setPcPhone(profile.phone ?? "");
    }
  }, [envelope?.draft, id, token, profile]);

  // Mirror first adult into primary contact when the toggle is on.
  useEffect(() => {
    if (!autoPc) return;
    const first = attendees.find((a) => a.category === "adult");
    if (first && (first.firstName || first.lastName)) {
      setPcName([first.firstName, first.lastName].filter(Boolean).join(" "));
    }
  }, [attendees, autoPc]);

  const completedCount = useMemo(
    () =>
      attendees.filter((a) => a.firstName.trim() && a.lastName.trim() && a.age.trim())
        .length,
    [attendees]
  );

  function updateAttendee(index: number, patch: Partial<AttendeeForm>) {
    setAttendees((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function validate(): string | null {
    for (const [i, a] of attendees.entries()) {
      if (!a.firstName.trim() || !a.lastName.trim())
        return `Please complete the name for guest ${i + 1}.`;
      const age = Number(a.age);
      if (!a.age.trim() || isNaN(age) || age < 0 || age > 120)
        return `Please enter a valid age for guest ${i + 1}.`;
      if (a.category === "kid" && (age < 3 || age > 12))
        return `Guest ${i + 1} is booked as a child (ages 3–12).`;
      if (a.category === "adult" && age < 16)
        return `Guest ${i + 1} is booked as an adult (ages 16+).`;
    }
    if (!pcName.trim()) return "Please add a primary contact name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pcEmail)) return "Please add a valid contact email.";
    return null;
  }

  async function save() {
    const problem = validate();
    if (problem) {
      Alert.alert("Guest details", problem);
      return;
    }
    setSaving(true);
    try {
      const [firstName, ...rest] = pcName.trim().split(/\s+/);
      await api.updateDraft(String(id), String(token), {
        primaryContact: {
          firstName,
          lastName: rest.join(" ") || firstName,
          email: pcEmail.trim(),
          phone: pcPhone.trim(),
        },
        attendees: attendees.map((a) => ({
          firstName: a.firstName.trim(),
          lastName: a.lastName.trim(),
          age: Number(a.age),
          // same encoding as the website: "Dietary: A, B | notes"
          allergies:
            [
              a.dietary.length ? `Dietary: ${a.dietary.join(", ")}` : "",
              a.notes.trim(),
            ]
              .filter(Boolean)
              .join(" | ") || undefined,
          category: a.category,
        })) as any,
      });
      router.push({
        pathname: "/draft/[id]/payment",
        params: { id: String(id), token: String(token), expiresAt: expiresAt ?? "" },
      });
    } catch (e) {
      Alert.alert("Guest details", e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  const exp = envelope?.experience;
  const slot = envelope?.slot;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 150 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Journey context */}
        <StepDots step={2} />
        <Eyebrow style={{ marginTop: spacing.md }}>Step 2 of 3</Eyebrow>
        <Serif style={{ fontSize: 27 }}>Who's joining?</Serif>
        {exp && slot ? (
          <View style={styles.contextRow}>
            <Ionicons name="leaf-outline" size={13} color={colors.gold} />
            <Muted style={{ fontSize: 13 }}>
              {exp.name} · {formatDateTime(slot.date)}
            </Muted>
          </View>
        ) : null}

        <View style={{ marginTop: spacing.md }}>
          <HoldCountdown
            expiresAt={expiresAt || envelope?.draft?.expiresAt}
            onExpired={() =>
              Alert.alert(
                "Hold expired",
                "Your reserved spots have been released. Please choose your date again.",
                [{ text: "OK", onPress: () => router.back() }]
              )
            }
          />
        </View>

        {/* completion progress */}
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${expected ? (completedCount / expected) * 100 : 0}%` },
              ]}
            />
          </View>
          <Text style={styles.progressLabel}>
            {completedCount}/{expected}
          </Text>
        </View>

        {attendees.map((a, i) => (
          <Animated.View
            key={i}
            entering={FadeInUp.duration(450).delay(i * 90)}
            style={styles.guestCard}
          >
            <View style={styles.guestHeader}>
              <View style={styles.guestBadgeRing}>
                <View style={styles.guestBadge}>
                  <Text style={styles.guestBadgeText}>{i + 1}</Text>
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.guestTitle}>
                  {a.category === "kid" ? "Child" : "Adult"} guest
                </Text>
                <Muted style={{ fontSize: 11 }}>
                  {a.category === "kid" ? "Ages 3–12" : "Ages 16+"}
                </Muted>
              </View>
              {a.firstName && a.lastName && a.age ? (
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              ) : null}
            </View>

            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
              <Field
                label="First name"
                value={a.firstName}
                onChangeText={(t) => updateAttendee(i, { firstName: t })}
                style={{ flex: 1 }}
                autoCapitalize="words"
              />
              <Field
                label="Last name"
                value={a.lastName}
                onChangeText={(t) => updateAttendee(i, { lastName: t })}
                style={{ flex: 1 }}
                autoCapitalize="words"
              />
            </View>
            <Field
              label="Age"
              value={a.age}
              onChangeText={(t) => updateAttendee(i, { age: t.replace(/[^0-9]/g, "") })}
              keyboardType="number-pad"
              style={{ marginTop: spacing.sm, width: 110 }}
            />
            <Text style={styles.dietaryLabel}>Dietary preferences</Text>
            <View style={styles.chipsRow}>
              {DIETARY.map((d) => (
                <Chip
                  key={d}
                  label={d}
                  active={a.dietary.includes(d)}
                  onPress={() =>
                    updateAttendee(i, {
                      dietary: a.dietary.includes(d)
                        ? a.dietary.filter((x) => x !== d)
                        : [...a.dietary, d],
                    })
                  }
                />
              ))}
            </View>
            <Field
              value={a.notes}
              onChangeText={(t) => updateAttendee(i, { notes: t })}
              placeholder="Anything we should know? (optional)"
              style={{ marginTop: spacing.md }}
            />
          </Animated.View>
        ))}

        <Ornament style={{ marginTop: spacing.xl }} />

        {/* Primary contact */}
        <View style={[styles.guestCard, { marginTop: spacing.lg }]}>
          <View style={styles.guestHeader}>
            <View style={styles.guestBadgeRing}>
              <View style={styles.guestBadge}>
                <Ionicons name="mail-outline" size={14} color={colors.brownDeeper} />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.guestTitle}>Primary contact</Text>
              <Muted style={{ fontSize: 11 }}>Confirmation & tickets go here</Muted>
            </View>
          </View>
          <View style={styles.autoRow}>
            <Muted style={{ flex: 1, fontSize: 13 }}>Use first adult's name</Muted>
            <Switch value={autoPc} onValueChange={setAutoPc} trackColor={{ true: colors.brand }} />
          </View>
          <Field
            label="Full name"
            value={pcName}
            onChangeText={(t) => {
              setAutoPc(false);
              setPcName(t);
            }}
            autoCapitalize="words"
          />
          <Field
            label="Email"
            value={pcEmail}
            onChangeText={setPcEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={{ marginTop: spacing.sm }}
          />
          <Field
            label="Phone"
            value={pcPhone}
            onChangeText={setPcPhone}
            keyboardType="phone-pad"
            style={{ marginTop: spacing.sm }}
          />
        </View>
      </ScrollView>

      {/* Frosted continue bar */}
      <View style={[styles.stickyWrap, { paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.sticky}>
          <BlurView intensity={40} tint="extraLight" style={StyleSheet.absoluteFill} />
          <View style={styles.stickyTint} />
          <View style={{ flex: 1 }}>
            <Text style={styles.stickyTotal}>{money(envelope?.draft?.totalAmount)}</Text>
            <Muted style={{ fontSize: 11 }}>
              {expected} guest{expected > 1 ? "s" : ""} · total
            </Muted>
          </View>
          <Button title="Continue" loading={saving} onPress={save} style={{ paddingHorizontal: 30 }} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

/** Three-step progress dots shared by the booking flow. */
export function StepDots({ step }: { step: 1 | 2 | 3 }) {
  return (
    <View style={styles.stepDots}>
      {[1, 2, 3].map((s) => (
        <View
          key={s}
          style={[
            styles.stepDot,
            s === step && styles.stepDotActive,
            s < step && styles.stepDotDone,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  center: { justifyContent: "center", alignItems: "center" },
  stepDots: { flexDirection: "row", gap: 6 },
  stepDot: {
    width: 22,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderSand,
  },
  stepDotActive: { backgroundColor: colors.brand, width: 34 },
  stepDotDone: { backgroundColor: colors.gold },
  contextRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  progressTrack: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.creamChip,
    overflow: "hidden",
  },
  progressFill: { height: 5, borderRadius: 3, backgroundColor: colors.gold },
  progressLabel: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: colors.mutedWarm },

  guestCard: {
    backgroundColor: colors.creamSoft,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSand,
    padding: spacing.md,
    marginTop: spacing.md,
    ...shadows.soft,
  },
  guestHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  guestBadgeRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  guestBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.sand,
    alignItems: "center",
    justifyContent: "center",
  },
  guestBadgeText: { fontFamily: fonts.serif, fontSize: 15, color: colors.brownDeeper },
  guestTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.brownDeep },
  dietaryLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.brownDeep,
    marginTop: spacing.md,
    marginBottom: 6,
  },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  autoRow: { flexDirection: "row", alignItems: "center", marginVertical: spacing.sm },

  stickyWrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
  },
  sticky: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radii.pill,
    overflow: "hidden",
    paddingVertical: 10,
    paddingLeft: spacing.lg,
    paddingRight: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSand,
    shadowColor: colors.brownDeeper,
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  stickyTint: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(253,250,245,0.75)",
  },
  stickyTotal: { fontFamily: fonts.serif, fontSize: 20, color: colors.brownDeep },
});
