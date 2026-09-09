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

import { Button, Eyebrow, Field, Muted, Serif } from "@/components/ui";
import { colors, fonts, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { api, ApiError } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";

export default function SignUpScreen() {
  const { signIn } = useAuth();
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState(""); // dd/mm/yyyy display
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function dobToIso(): string | null {
    const m = dob.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return null;
    const [, d, mo, y] = m;
    const date = new Date(`${y}-${mo}-${d}T00:00:00Z`);
    if (isNaN(date.getTime()) || date.getUTCDate() !== Number(d)) return null;
    return `${y}-${mo}-${d}`;
  }

  async function submit() {
    setError(null);
    if (!name.trim() || !surname.trim()) return setError("Please add your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Please add a valid email.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    const iso = dobToIso();
    if (!iso) return setError("Date of birth must be DD/MM/YYYY.");

    setBusy(true);
    try {
      try {
        // Preferred path: the site's signup API creates both the auth user and
        // the profile row. It may require a reCAPTCHA that the app can't
        // provide, so fall back to direct Supabase signup in that case.
        await api.signup({
          email: email.trim(),
          password,
          name: name.trim(),
          surname: surname.trim(),
          phone: phone.trim() || undefined,
          dateOfBirth: iso,
        });
      } catch (e) {
        if (e instanceof ApiError && /captcha|recaptcha/i.test(e.message)) {
          const supabase = getSupabase();
          if (!supabase) throw e;
          const { error: signUpError } = await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: { data: { name: name.trim(), surname: surname.trim() } },
          });
          if (signUpError) throw new Error(signUpError.message);
        } else {
          throw e;
        }
      }
      const login = await signIn(email.trim(), password);
      if (login.error) {
        router.replace("/login");
        return;
      }
      router.dismissTo("/profile");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-up failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 64 }}>
        <Eyebrow>Join us</Eyebrow>
        <Serif style={{ fontSize: 28 }}>Create your account</Serif>
        <Muted style={{ marginTop: 4 }}>Book faster and keep your journeys in one place.</Muted>

        <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Field label="First name" value={name} onChangeText={setName} style={{ flex: 1 }} autoCapitalize="words" />
            <Field label="Surname" value={surname} onChangeText={setSurname} style={{ flex: 1 }} autoCapitalize="words" />
          </View>
          <Field
            label="Email"
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Field
            label="Password"
            placeholder="Min 8 characters"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <Field
            label="Phone (optional)"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
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
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title="Create Account" loading={busy} onPress={submit} />
          <Muted style={{ fontSize: 12 }}>
            By registering you agree to our Terms of Use and Privacy Policy.
          </Muted>
        </View>

        <View style={styles.loginRow}>
          <Muted>Already have an account?</Muted>
          <Pressable onPress={() => router.push("/login")}>
            <Text style={styles.link}> Log In</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  error: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.danger },
  link: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.brand },
  loginRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.lg },
});
