import { Image } from "expo-image";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { FavoriteButton } from "@/components/FavoriteButton";
import { PressableScale } from "@/components/premium";
import { colors, fonts, radii, spacing } from "@/constants/theme";
import { money } from "@/lib/format";
import type { Experience } from "@/lib/types";

const INK = "#26201a";

function frequencyLabel(freq?: string | string[] | null): string | null {
  if (!freq) return null;
  const list = Array.isArray(freq) ? freq : [freq];
  if (!list.length) return null;
  const joined = list.join(", ");
  if (/every ?day|daily/i.test(joined)) return "Every day";
  return joined;
}

/** Editorial listing: a quiet photograph with a caption beneath it. */
export function ExperienceCard({
  exp,
  scarcity,
}: {
  exp: Experience;
  scarcity?: number | null;
}) {
  const cover = exp.images?.[0];
  const priced = exp.priceAdult != null && Number(exp.priceAdult) > 0;
  const freq = frequencyLabel(exp.frequency);

  return (
    <PressableScale
      style={styles.card}
      onPress={() => router.push(`/experience/${exp.slug}`)}
    >
      <View>
        {cover ? (
          <Image source={{ uri: cover }} style={styles.image} contentFit="cover" transition={250} />
        ) : (
          <View style={[styles.image, { backgroundColor: colors.creamChip }]} />
        )}
        <View style={styles.fav}>
          <FavoriteButton experienceId={exp.id} />
        </View>
      </View>

      <View style={styles.caption}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={2}>
            {exp.name}
          </Text>
          <Text style={styles.price}>{priced ? money(exp.priceAdult) : "On request"}</Text>
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {[exp.location || "Chania, Crete", exp.duration, freq].filter(Boolean).join("  ·  ")}
        </Text>
        {exp.description ? (
          <Text style={styles.desc} numberOfLines={2}>
            {exp.description}
          </Text>
        ) : null}
        {scarcity != null ? (
          <Text style={styles.scarcity}>Only {scarcity} places remain</Text>
        ) : null}
      </View>
      <View style={styles.rule} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { paddingBottom: spacing.lg },
  image: { width: "100%", height: 300, borderRadius: radii.md },
  fav: { position: "absolute", top: 10, right: 10 },
  caption: { paddingTop: spacing.md, gap: 7 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  title: {
    flex: 1,
    fontFamily: fonts.serifRegular,
    fontSize: 22,
    lineHeight: 28,
    color: INK,
  },
  price: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    letterSpacing: 0.4,
    color: colors.gold,
    marginTop: 6,
  },
  meta: {
    fontFamily: fonts.sansMedium,
    fontSize: 10.5,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.mutedWarm,
  },
  desc: { fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 21, color: colors.muted },
  scarcity: { fontFamily: fonts.sansMedium, fontSize: 12, color: "#a3762a" },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginTop: spacing.lg,
  },
});
