import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Button, Card, Chip, Eyebrow, Field, Muted, Serif } from "@/components/ui";
import { colors, fonts, spacing } from "@/constants/theme";
import { api } from "@/lib/api";

const TYPES = [
  { key: "planning", label: "Trip planning" },
  { key: "support", label: "Booking support" },
  { key: "info", label: "General info" },
] as const;

const PLACEHOLDERS: Record<string, string> = {
  planning: "Tell us about the journey you're dreaming of…",
  support: "How can we help with your booking?",
  info: "What would you like to know?",
};

export default function ContactScreen() {
  const [contactType, setContactType] =
    useState<(typeof TYPES)[number]["key"]>("planning");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [idealDates, setIdealDates] = useState("");
  const [groupSize, setGroupSize] = useState("");
  const [bookingRef, setBookingRef] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!name.trim()) return setError("Please add your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Please add a valid email.");
    if (!message.trim()) return setError("Please write a short message.");
    setStatus("loading");
    try {
      await api.contact({
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
        contactType,
        idealDates: contactType === "planning" ? idealDates.trim() || undefined : undefined,
        groupSize: contactType === "planning" ? groupSize.trim() || undefined : undefined,
        bookingRef: contactType === "support" ? bookingRef.trim() || undefined : undefined,
      });
      setStatus("success");
    } catch (e) {
      setStatus("idle");
      setError(e instanceof Error ? e.message : "Could not send your message.");
    }
  }

  if (status === "success") {
    return (
      <View style={[styles.screen, styles.center]}>
        <Ionicons name="mail-open-outline" size={48} color={colors.brand} />
        <Serif style={{ fontSize: 24, marginTop: spacing.md }}>Message Received</Serif>
        <Muted style={{ textAlign: "center", marginTop: 8, paddingHorizontal: 40 }}>
          Thank you — we'll be in touch soon. A confirmation is on its way to your inbox.
        </Muted>
        <View style={{ gap: spacing.sm, marginTop: spacing.lg, alignSelf: "stretch", paddingHorizontal: spacing.lg }}>
          <Button title="Explore Experiences" onPress={() => router.push("/explore")} />
          <Button
            title="Send Another"
            variant="ghost"
            onPress={() => {
              setMessage("");
              setStatus("idle");
            }}
          />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 64 }}>
        <Eyebrow>We'd love to hear from you</Eyebrow>
        <Serif style={{ fontSize: 26 }}>Contact Oasis</Serif>

        <View style={styles.quickRow}>
          <QuickLink
            icon="mail-outline"
            label="info@youroasis.gr"
            onPress={() => Linking.openURL("mailto:info@youroasis.gr")}
          />
          <QuickLink
            icon="call-outline"
            label="Call us"
            onPress={() => Linking.openURL("tel:+302100000000")}
          />
        </View>

        <Card style={{ marginTop: spacing.md }}>
          <Text style={styles.label}>What is this about?</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {TYPES.map((t) => (
              <Chip
                key={t.key}
                label={t.label}
                active={contactType === t.key}
                onPress={() => setContactType(t.key)}
              />
            ))}
          </View>

          <Field label="Name" value={name} onChangeText={setName} style={{ marginTop: spacing.md }} autoCapitalize="words" />
          <Field
            label="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            style={{ marginTop: spacing.sm }}
          />

          {contactType === "planning" ? (
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
              <Field
                label="Ideal dates"
                placeholder="e.g. Late June"
                value={idealDates}
                onChangeText={setIdealDates}
                style={{ flex: 1 }}
              />
              <Field
                label="Group size"
                placeholder="e.g. 2 adults"
                value={groupSize}
                onChangeText={setGroupSize}
                style={{ flex: 1 }}
              />
            </View>
          ) : null}
          {contactType === "support" ? (
            <Field
              label="Booking reference"
              placeholder="BK-000123"
              autoCapitalize="characters"
              value={bookingRef}
              onChangeText={setBookingRef}
              style={{ marginTop: spacing.sm }}
            />
          ) : null}

          <Field
            label="Message"
            placeholder={PLACEHOLDERS[contactType]}
            value={message}
            onChangeText={(t) => setMessage(t.slice(0, 2000))}
            multiline
            style={{ marginTop: spacing.sm }}
            inputStyle={{ minHeight: 120, textAlignVertical: "top" }}
          />
          <Muted style={{ fontSize: 11, textAlign: "right", marginTop: 4 }}>
            {message.length}/2000
          </Muted>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title="Send Message" loading={status === "loading"} onPress={submit} style={{ marginTop: spacing.sm }} />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function QuickLink({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
}) {
  return (
    <Card style={styles.quickCard}>
      <Text onPress={onPress} style={styles.quickText}>
        <Ionicons name={icon} size={14} color={colors.brand} /> {label}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  center: { justifyContent: "center", alignItems: "center", padding: spacing.lg },
  quickRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  quickCard: { flex: 1, paddingVertical: 12, alignItems: "center" },
  quickText: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: colors.brand },
  label: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.brownDeep },
  error: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.danger, marginTop: spacing.sm },
});
