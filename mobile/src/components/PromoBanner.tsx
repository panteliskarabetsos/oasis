import * as Clipboard from "expo-clipboard";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts, radii } from "@/constants/theme";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";

function endsIn(endsAt?: string): string | null {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - Date.now();
  if (isNaN(ms) || ms <= 0) return null;
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `Ends in ${d}d ${h}h`;
  if (h > 0) return `Ends in ${h}h ${m}m`;
  return `Ends in ${m}m`;
}

export function PromoBanner() {
  const { data } = useApi(() => api.promotionsActive());
  const [index, setIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const items = useMemo(() => {
    if (!data) return [];
    const codeItems = (data.codes ?? []).map((c) => ({
      key: `code-${c.id}`,
      text:
        c.discountType === "percent"
          ? `${c.discountValue}% off`
          : `${c.discountValue} ${c.currency ?? "EUR"} off`,
      code: c.code,
      endsAt: c.endsAt,
    }));
    const campItems = (data.campaigns ?? []).map((c) => ({
      key: `camp-${c.id}`,
      text: [c.name, c.description].filter(Boolean).join(" — "),
      code: undefined as string | undefined,
      endsAt: c.endsAt,
    }));
    return [...codeItems, ...campItems];
  }, [data]);

  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % items.length), 7000);
    return () => clearInterval(t);
  }, [items.length]);

  if (!items.length) return null;
  const item = items[index % items.length];
  const countdown = endsIn(item.endsAt);

  async function copy() {
    if (!item.code) return;
    await Clipboard.setStringAsync(item.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <View style={styles.banner}>
      <Text style={styles.text} numberOfLines={1}>
        {item.text}
      </Text>
      {item.code ? (
        <Pressable onPress={copy} style={styles.codeChip}>
          <Text style={styles.codeText}>{copied ? "Copied" : item.code}</Text>
        </Pressable>
      ) : null}
      {countdown ? <Text style={styles.countdown}>{countdown}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSand,
    paddingVertical: 10,
    paddingHorizontal: 2,
  },
  text: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 11.5, letterSpacing: 0.6, color: colors.brownDeep },
  codeChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gold,
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  codeText: { fontFamily: fonts.sansSemiBold, fontSize: 10.5, letterSpacing: 1, color: colors.gold },
  countdown: { fontFamily: fonts.sans, fontSize: 10, color: colors.mutedWarm },
});
