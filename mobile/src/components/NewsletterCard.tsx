import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button, Field } from "@/components/ui";
import { colors, fonts, radii, spacing } from "@/constants/theme";
import { api } from "@/lib/api";

export function NewsletterCard() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function subscribe() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setState("error");
      return;
    }
    setState("loading");
    try {
      await api.newsletter(email.trim());
      setState("success");
    } catch {
      setState("error");
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>JOIN OUR JOURNAL</Text>
      <Text style={styles.title}>A return to the rhythm of the Cretan land.</Text>
      {state === "success" ? (
        <Text style={styles.success}>
          Thank you! You have successfully joined our journal.
        </Text>
      ) : (
        <>
          <Field
            placeholder="Your email address"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              if (state === "error") setState("idle");
            }}
            error={state === "error" ? "Please enter a valid email." : null}
          />
          <Button
            title="Subscribe"
            loading={state === "loading"}
            onPress={subscribe}
            style={{ marginTop: spacing.sm }}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  eyebrow: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 3,
    textTransform: "uppercase",
    color: colors.gold,
  },
  title: {
    fontFamily: fonts.serifRegular,
    fontSize: 24,
    lineHeight: 32,
    color: "#26201a",
  },
  success: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.brand },
});
