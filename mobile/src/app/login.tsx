import { Ionicons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
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

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setBusy(true);
    const res = await signIn(email.trim(), password);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    router.back();
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.xl }}>
        <Eyebrow>Welcome back</Eyebrow>
        <Serif style={{ fontSize: 28 }}>Log in to Oasis</Serif>
        <Muted style={{ marginTop: 4 }}>
          Your journeys, favorites, and details — all in one place.
        </Muted>

        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          <Field
            label="Email"
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
          />
          <View>
            <Field
              label="Password"
              placeholder="Your password"
              secureTextEntry={!showPassword}
              autoComplete="password"
              value={password}
              onChangeText={setPassword}
            />
            <Pressable
              style={styles.eye}
              onPress={() => setShowPassword((s) => !s)}
              hitSlop={8}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={colors.mutedWarm}
              />
            </Pressable>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title="Log In" loading={busy} onPress={submit} />
        </View>

        <Link href="/forgot-password" asChild>
          <Pressable style={{ marginTop: spacing.lg }}>
            <Text style={styles.link}>Forgot your password?</Text>
          </Pressable>
        </Link>
        <View style={styles.registerRow}>
          <Muted>New to Oasis?</Muted>
          <Pressable onPress={() => { router.back(); router.push("/sign-up"); }}>
            <Text style={styles.link}> Register</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  eye: { position: "absolute", right: 14, top: 38 },
  error: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.danger },
  link: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.brand },
  registerRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.md },
});
