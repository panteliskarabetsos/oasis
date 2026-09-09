import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Button, Field, Muted, Serif } from "@/components/ui";
import { fonts, radii, spacing } from "@/constants/theme";
import { api } from "@/lib/api";

// The website's private-inquiry page uses a dark, gold-accented theme.
const dark = {
  bg: "#0a0a09",
  card: "#161512",
  border: "#2c2a26",
  gold: "#c5a059",
  text: "#f2ede4",
  muted: "#9b937f",
};

const EVENT_TYPES = [
  { key: "chef", name: "In-Villa Chef's Table", icon: "restaurant-outline" },
  { key: "privatize", name: "Privatize a Tour", icon: "boat-outline" },
  { key: "bespoke", name: "Fully Bespoke", icon: "sparkles-outline" },
  { key: "celebration", name: "Celebration", icon: "gift-outline" },
] as const;

export default function PrivateInquireScreen() {
  const [concept, setConcept] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [date, setDate] = useState("");
  const [guests, setGuests] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!name.trim()) return setError("Please add your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Please add a valid email.");
    if (!date.trim()) return setError("Please add a preferred date.");
    if (!guests.trim()) return setError("Please estimate your guest count.");
    setStatus("submitting");
    try {
      await api.privateInquiry({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        company: company.trim() || undefined,
        date: date.trim(),
        guests: guests.trim(),
        location: location.trim() || undefined,
        concept: EVENT_TYPES.find((t) => t.key === concept)?.name ?? "Not selected",
        notes: notes.trim() || undefined,
      });
      setStatus("success");
    } catch (e) {
      setStatus("idle");
      setError(e instanceof Error ? e.message : "Could not send the inquiry.");
    }
  }

  if (status === "success") {
    return (
      <View style={[styles.screen, styles.center]}>
        <Ionicons name="checkmark-circle-outline" size={52} color={dark.gold} />
        <Serif style={{ fontSize: 24, color: dark.text, marginTop: spacing.md, textAlign: "center" }}>
          Inquiry sent
        </Serif>
        <Muted style={{ color: dark.muted, textAlign: "center", marginTop: 8, paddingHorizontal: 40 }}>
          Our concierge will reach out within a day to begin shaping your gathering.
        </Muted>
        <Button
          title="Back to Private Gatherings"
          variant="sand"
          onPress={() => router.back()}
          style={{ marginTop: spacing.lg }}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 64 }}>
        <Text style={styles.eyebrow}>OASIS PRIVATE</Text>
        <Serif style={{ fontSize: 26, color: dark.text }}>Begin the conversation</Serif>
        <Muted style={{ color: dark.muted, marginTop: 4 }}>
          Choose a concept and tell us the essentials.
        </Muted>

        <View style={styles.typeGrid}>
          {EVENT_TYPES.map((t) => {
            const active = concept === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setConcept(t.key)}
                style={[styles.typeCard, active && { borderColor: dark.gold }]}
              >
                <Ionicons name={t.icon} size={22} color={active ? dark.gold : dark.muted} />
                <Text style={[styles.typeName, active && { color: dark.gold }]}>{t.name}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
          <Field label="Full name" value={name} onChangeText={setName} autoCapitalize="words" {...darkField} />
          <Field
            label="Email address"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            {...darkField}
          />
          <Field label="Phone number" keyboardType="phone-pad" value={phone} onChangeText={setPhone} {...darkField} />
          <Field label="Company / group name (optional)" value={company} onChangeText={setCompany} {...darkField} />
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Field
              label="Preferred date"
              placeholder="DD/MM/YYYY"
              keyboardType="number-pad"
              value={date}
              onChangeText={(t) => {
                const digits = t.replace(/[^0-9]/g, "").slice(0, 8);
                let out = digits;
                if (digits.length > 4) out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
                else if (digits.length > 2) out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
                setDate(out);
              }}
              style={{ flex: 1 }}
              {...darkFieldNoStyle}
            />
            <Field
              label="Guests"
              placeholder="e.g. 8"
              keyboardType="number-pad"
              value={guests}
              onChangeText={setGuests}
              style={{ flex: 1 }}
              {...darkFieldNoStyle}
            />
          </View>
          <Field
            label="Villa / accommodation (optional)"
            value={location}
            onChangeText={setLocation}
            {...darkField}
          />
          <Field
            label="Your vision"
            placeholder="Tell us what you're imagining…"
            value={notes}
            onChangeText={setNotes}
            multiline
            labelStyle={darkLabelStyle}
            inputStyle={{ ...darkInputStyle, minHeight: 100, textAlignVertical: "top" as const }}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title="Send Inquiry" variant="sand" loading={status === "submitting"} onPress={submit} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const darkInputStyle = {
  backgroundColor: dark.card,
  borderColor: dark.border,
  color: dark.text,
};
const darkLabelStyle = { color: dark.muted };
const darkField = { inputStyle: darkInputStyle, labelStyle: darkLabelStyle } as const;
const darkFieldNoStyle = darkField;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: dark.bg },
  center: { justifyContent: "center", alignItems: "center", padding: spacing.lg },
  eyebrow: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 10,
    letterSpacing: 3.5,
    color: dark.gold,
    marginBottom: 6,
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  typeCard: {
    width: "48%",
    backgroundColor: dark.card,
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: 8,
  },
  typeName: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: dark.text },
  error: { fontFamily: fonts.sansMedium, fontSize: 13, color: "#e07a5f" },
});
