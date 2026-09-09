import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Button, Eyebrow, Field, Muted, Serif } from "@/components/ui";
import { colors, fonts, spacing } from "@/constants/theme";
import { api } from "@/lib/api";

function strength(pw: string): { label: string; score: number } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[a-zA-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  const label = score <= 2 ? "Weak" : score === 3 ? "Okay" : score === 4 ? "Good" : "Strong";
  return { label, score };
}

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const [token, setToken] = useState(params.token ?? "");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const meter = useMemo(() => strength(password), [password]);
  const valid = password.length >= 8 && /[a-zA-Z]/.test(password) && /\d/.test(password);

  async function submit() {
    setError(null);
    if (!token.trim()) return setError("Paste the reset token from your email link.");
    if (!valid) return setError("Password needs 8+ characters with letters and numbers.");
    setState("busy");
    try {
      await api.resetPassword(token.trim(), password);
      setState("done");
      setTimeout(() => router.replace("/login"), 1600);
    } catch (e) {
      setState("idle");
      setError(e instanceof Error ? e.message : "Invalid or expired token.");
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg }}>
      <Eyebrow>Account recovery</Eyebrow>
      <Serif style={{ fontSize: 26 }}>Set a new password</Serif>

      {state === "done" ? (
        <Muted style={{ marginTop: spacing.lg }}>
          Password updated — taking you to Log In…
        </Muted>
      ) : (
        <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
          <Field
            label="Reset token"
            placeholder="From the link in your email"
            autoCapitalize="none"
            value={token}
            onChangeText={setToken}
          />
          <View>
            <Field
              label="New password"
              placeholder="8+ chars, letters & numbers"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            {password ? (
              <View style={styles.meterRow}>
                <View style={styles.meterTrack}>
                  <View
                    style={[
                      styles.meterFill,
                      {
                        width: `${(meter.score / 5) * 100}%`,
                        backgroundColor:
                          meter.score <= 2 ? colors.danger : meter.score === 3 ? colors.warning : colors.success,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.meterLabel}>{meter.label}</Text>
              </View>
            ) : null}
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title="Reset password" loading={state === "busy"} onPress={submit} />
          <Button
            title="Request a new link"
            variant="ghost"
            onPress={() => router.replace("/forgot-password")}
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  error: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.danger },
  meterRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  meterTrack: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.creamChip,
    overflow: "hidden",
  },
  meterFill: { height: 5, borderRadius: 3 },
  meterLabel: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.mutedWarm },
});
