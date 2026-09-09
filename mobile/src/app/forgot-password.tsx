import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

import { Button, Card, Eyebrow, Field, Muted, Serif } from "@/components/ui";
import { colors, fonts, spacing } from "@/constants/theme";
import { api, ApiError } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function submit() {
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email.");
      return;
    }
    setBusy(true);
    try {
      try {
        await api.forgotPassword(email.trim());
      } catch (e) {
        // The site's endpoint may demand a reCAPTCHA; use Supabase's own
        // recovery email as a fallback.
        if (e instanceof ApiError && /captcha|recaptcha/i.test(e.message)) {
          const supabase = getSupabase();
          if (!supabase) throw e;
          await supabase.auth.resetPasswordForEmail(email.trim());
        } else {
          throw e;
        }
      }
      setSent(true);
      setCooldown(30);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg }}>
      <Eyebrow>Account recovery</Eyebrow>
      <Serif style={{ fontSize: 26 }}>Forgot your password?</Serif>
      <Muted style={{ marginTop: 4 }}>
        Enter your email and we'll send you a link to reset it.
      </Muted>

      {sent ? (
        <Card style={{ marginTop: spacing.lg }}>
          <Serif style={{ fontSize: 18 }}>Check your inbox</Serif>
          <Muted style={{ marginTop: 4 }}>
            If an account exists for {email.trim()}, a reset link is on its way. The
            email link opens a reset page — you can also paste the token here.
          </Muted>
          <Button
            title="I have a reset token"
            variant="ghost"
            onPress={() => router.push("/reset-password")}
            style={{ marginTop: spacing.md }}
          />
          <Button
            title={cooldown > 0 ? `Resend in ${cooldown}s` : "Resend email"}
            variant="ghost"
            disabled={cooldown > 0}
            onPress={submit}
            style={{ marginTop: spacing.sm }}
          />
        </Card>
      ) : (
        <>
          <Field
            label="Email"
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            style={{ marginTop: spacing.lg }}
            error={error}
          />
          <Button title="Send reset link" loading={busy} onPress={submit} style={{ marginTop: spacing.md }} />
        </>
      )}

      <Pressable onPress={() => router.push("/login")} style={{ marginTop: spacing.lg }}>
        <Text style={styles.link}>Back to Log In</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  link: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.brand },
});
