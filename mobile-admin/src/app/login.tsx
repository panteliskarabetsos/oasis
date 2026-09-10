import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
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

import { Ornament } from "@/components/premium";
import { Button, Eyebrow, Field, Muted, Serif } from "@/components/ui";
import { colors, fonts, gradients, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your staff email and password.");
      return;
    }
    setBusy(true);
    const res = await signIn(email.trim(), password);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    router.replace("/");
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Warm light pooling behind the wordmark. */}
      <LinearGradient colors={gradients.ambient} style={styles.ambient} pointerEvents="none" />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.markRing}>
          <LinearGradient
            colors={gradients.gold}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.markInner}>
            <Ionicons name="leaf" size={26} color={colors.gold} />
          </View>
        </View>
        <Serif style={styles.title}>Oasis Admin</Serif>
        <Eyebrow style={{ textAlign: "center", marginTop: 8 }}>Operations Console</Eyebrow>
        <Ornament style={{ marginTop: spacing.md }} />

        <View style={styles.form}>
          <Field
            label="Email"
            placeholder="you@youroasis.gr"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="username"
            value={email}
            onChangeText={setEmail}
            returnKeyType="next"
          />
          <View>
            <Field
              label="Password"
              placeholder="••••••••"
              secureTextEntry={!show}
              autoComplete="current-password"
              textContentType="password"
              value={password}
              onChangeText={setPassword}
              returnKeyType="go"
              onSubmitEditing={submit}
              inputStyle={{ paddingRight: 46 }}
            />
            <Pressable style={styles.eye} onPress={() => setShow((s) => !s)} hitSlop={10}>
              <Ionicons
                name={show ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={colors.muted}
              />
            </Pressable>
          </View>
          {error ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={15} color={colors.danger} />
              <Text style={styles.error}>{error}</Text>
            </View>
          ) : null}
          <Button title="Log In" loading={busy} onPress={submit} style={{ marginTop: 4 }} />
          <Muted style={styles.footnote}>
            Staff accounts only. Guest accounts cannot access the console.
          </Muted>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  ambient: { position: "absolute", top: 0, left: 0, right: 0, height: 420 },
  content: { flexGrow: 1, justifyContent: "center", padding: spacing.lg },
  markRing: {
    alignSelf: "center",
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: spacing.md,
  },
  // The gradient ring is a 1.5pt frame; this inner disc masks its centre.
  markInner: {
    position: "absolute",
    top: 1.5,
    left: 1.5,
    right: 1.5,
    bottom: 1.5,
    borderRadius: 33,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 32, lineHeight: 40, textAlign: "center" },
  form: { marginTop: spacing.xl, gap: spacing.md },
  eye: { position: "absolute", right: 14, top: 38 },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  error: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 13, color: colors.danger },
  footnote: { textAlign: "center", fontSize: 12, marginTop: 2 },
});
