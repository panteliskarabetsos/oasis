import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { Button, Card, Eyebrow, Field, Muted, Serif } from "@/components/ui";
import { colors, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { api } from "@/lib/api";

function isoToDisplay(iso?: string | null): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

function displayToIso(display: string): string | null {
  const m = display.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const date = new Date(`${y}-${mo}-${d}T00:00:00Z`);
  if (isNaN(date.getTime()) || date.getUTCDate() !== Number(d)) return null;
  return `${y}-${mo}-${d}`;
}

export default function AccountSettingsScreen() {
  const { session, profile, refreshProfile } = useAuth();
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session) {
      router.replace("/login");
    }
  }, [session]);

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? "");
      setSurname(profile.surname ?? "");
      setEmail(profile.email ?? "");
      setPhone(profile.phone ?? "");
      setDob(isoToDisplay(profile.dateOfBirth));
    }
  }, [profile]);

  async function save() {
    if (!password) {
      Alert.alert("Account", "Please confirm with your current password.");
      return;
    }
    const iso = dob ? displayToIso(dob) : undefined;
    if (dob && !iso) {
      Alert.alert("Account", "Date of birth must be DD/MM/YYYY.");
      return;
    }
    setBusy(true);
    try {
      await api.updateAccount({
        name: [name.trim(), surname.trim()].filter(Boolean).join(" "),
        email: email.trim(),
        phone: phone.trim(),
        dateOfBirth: iso ?? undefined,
        password,
      });
      await refreshProfile();
      setPassword("");
      Alert.alert("Account", "Your details have been updated.");
    } catch (e) {
      Alert.alert("Account", e instanceof Error ? e.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 64 }}>
        <Eyebrow>Your details</Eyebrow>
        <Serif style={{ fontSize: 26 }}>Account Settings</Serif>

        <Card style={{ marginTop: spacing.lg, gap: spacing.md }}>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Field label="First name" value={name} onChangeText={setName} style={{ flex: 1 }} autoCapitalize="words" />
            <Field label="Surname" value={surname} onChangeText={setSurname} style={{ flex: 1 }} autoCapitalize="words" />
          </View>
          <Field
            label="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Field label="Phone" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
          <Field
            label="Date of birth"
            placeholder="DD/MM/YYYY"
            keyboardType="number-pad"
            value={dob}
            onChangeText={(t) => {
              const digits = t.replace(/[^0-9]/g, "").slice(0, 8);
              let out = digits;
              if (digits.length > 4) out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
              else if (digits.length > 2) out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
              setDob(out);
            }}
          />
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <Field
            label="Current password (required to save)"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <Muted style={{ marginTop: 8, fontSize: 12 }}>
            We re-verify your password before changing account details.
          </Muted>
        </Card>

        <Button title="Save changes" loading={busy} onPress={save} style={{ marginTop: spacing.lg }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
});
