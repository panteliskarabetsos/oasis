import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet } from "react-native";

import { colors } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { api } from "@/lib/api";

export function FavoriteButton({
  experienceId,
  initial,
  onToggled,
}: {
  experienceId: number | string;
  initial?: boolean;
  onToggled?: (isFavorite: boolean) => void;
}) {
  const { session } = useAuth();
  const [isFavorite, setIsFavorite] = useState(Boolean(initial));
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!session) {
      Alert.alert("Log in required", "Save experiences to your collection by logging in.", [
        { text: "Not now", style: "cancel" },
        { text: "Log In", onPress: () => router.push("/login") },
      ]);
      return;
    }
    if (busy) return;
    setBusy(true);
    const next = !isFavorite;
    setIsFavorite(next); // optimistic
    try {
      const res = await api.toggleFavorite(experienceId);
      setIsFavorite(res.isFavorite);
      onToggled?.(res.isFavorite);
    } catch {
      setIsFavorite(!next); // revert
    } finally {
      setBusy(false);
    }
  }

  return (
    <Pressable onPress={toggle} hitSlop={8} style={styles.button}>
      <Ionicons
        name={isFavorite ? "heart" : "heart-outline"}
        size={18}
        color={isFavorite ? "#c0392b" : colors.brownDeep}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.glass,
    alignItems: "center",
    justifyContent: "center",
  },
});
