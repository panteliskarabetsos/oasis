import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, fonts, radii } from "@/constants/theme";

/** Amber hold-timer banner that turns red under 5 minutes, like the web's. */
export function HoldCountdown({
  expiresAt,
  onExpired,
}: {
  expiresAt?: string | null;
  onExpired?: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const firedRef = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const remaining = expiresAt ? new Date(expiresAt).getTime() - now : null;

  useEffect(() => {
    if (remaining != null && remaining <= 0 && !firedRef.current) {
      firedRef.current = true;
      onExpired?.();
    }
  }, [remaining, onExpired]);

  if (remaining == null) return null;

  const expired = remaining <= 0;
  const urgent = remaining < 5 * 60 * 1000;
  const mins = Math.max(0, Math.floor(remaining / 60000));
  const secs = Math.max(0, Math.floor((remaining % 60000) / 1000));

  return (
    <View style={[styles.banner, urgent && styles.bannerUrgent]}>
      <Ionicons
        name="time-outline"
        size={16}
        color={urgent ? colors.danger : colors.warning}
      />
      <Text style={[styles.text, urgent && { color: colors.danger }]}>
        {expired
          ? "Your hold has expired — please start again."
          : `Your spot is held for ${mins}:${String(secs).padStart(2, "0")}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.warningSoft,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bannerUrgent: { backgroundColor: colors.dangerSoft },
  text: { flex: 1, fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.warning },
});
