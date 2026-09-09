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

import { Button, Eyebrow, Field, Muted, Serif } from "@/components/ui";
import { colors, fonts, spacing } from "@/constants/theme";
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
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.mark}>
          <Ionicons name="leaf" size={26} color={colors.gold} />
        </View>
        <Serif style={{ fontSize: 30, textAlign: "center" }}>Oasis Admin</Serif>
        <Eyebrow style={{ textAlign: "center", marginTop: 6 }}>Operations Console</Eyebrow>

        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          <Field
            label="Email"
            placeholder="you@youroasis.gr"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
          />
          <View>
            <Field
              label="Password"
              placeholder="••••••••"
              secureTextEntry={!show}
              value={password}
              onChangeText={setPassword}
            />
            <Pressable style={styles.eye} onPress={() => setShow((s) => !s)} hitSlop={8}>
              <Ionicons
                name={show ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={colors.muted}
              />
            </Pressable>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title="Log In" loading={busy} onPress={submit} />
          <Muted style={{ textAlign: "center", fontSize: 12 }}>
            Staff accounts only. Guest accounts cannot access the console.
          </Muted>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, justifyContent: "center", padding: spacing.lg },
  mark: {
    alignSelf: "center",
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: colors.borderGold,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  eye: { position: "absolute", right: 14, top: 38 },
  error: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.danger },
});
