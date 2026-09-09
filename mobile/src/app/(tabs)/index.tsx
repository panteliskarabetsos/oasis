import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect } from "react";
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FavoriteButton } from "@/components/FavoriteButton";
import { NewsletterCard } from "@/components/NewsletterCard";
import { PressableScale, Shimmer } from "@/components/premium";
import { PromoBanner } from "@/components/PromoBanner";
import { Button, Eyebrow, Muted, Serif } from "@/components/ui";
import { colors, fonts, radii, spacing } from "@/constants/theme";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import type { Experience } from "@/lib/types";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const HERO_H = Math.min(SCREEN_H * 0.86, 780);
const CARD_W = SCREEN_W * 0.72;

const INK = "#26201a";

const FOUNDATIONS = [
  { n: "01", title: "Authentic heritage", text: "Hosted by the people who live the tradition." },
  { n: "02", title: "Mindful pace", text: "Small groups, slow mornings, space to be." },
  { n: "03", title: "Filoxenia", text: "The Cretan art of loving a stranger." },
  { n: "04", title: "Living land", text: "Olive groves, mountain herbs, the sea." },
] as const;

const TESTIMONIALS = [
  {
    quote: "We arrived as tourists and left feeling like family. The slowest, richest day of our trip.",
    name: "Elena, Vienna",
  },
  {
    quote: "Kneading dough in a mountain kitchen while the coffee brewed — I still think about it.",
    name: "Marcus, London",
  },
  {
    quote: "Nothing felt staged. Just real people, real food, and the land setting the pace.",
    name: "Sofia, Athens",
  },
] as const;

const JOURNEYS = [
  { n: "01", title: "Signature journeys", text: "Scheduled small-group experiences", route: "/explore" as const },
  { n: "02", title: "Private & in-villa", text: "Bespoke gatherings and chef's tables", route: "/private" as const },
  { n: "03", title: "Seasonal retreats", text: "Multi-day gatherings, small circles", route: "/retreats" as const },
  { n: "04", title: "Clarity call", text: "Not sure where to begin? Talk to us", route: "/contact" as const },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { data: experiences, loading } = useApi(() => api.experiences());
  const featured = (experiences ?? []).slice(0, 6);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  // Ken Burns: the hero photo breathes on a slow 20s loop.
  const kenBurns = useSharedValue(0);
  useEffect(() => {
    kenBurns.value = withRepeat(
      withTiming(1, { duration: 20000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [kenBurns]);
  const kenBurnsStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1.02 + kenBurns.value * 0.07 }, { translateX: kenBurns.value * -10 }],
  }));

  const heroImageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollY.value, [-HERO_H, 0, HERO_H], [-HERO_H / 2, 0, HERO_H * 0.35]) },
      { scale: interpolate(scrollY.value, [-HERO_H, 0], [1.5, 1.02]) },
    ],
  }));
  const heroContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, HERO_H * 0.5], [1, 0]),
  }));
  const miniHeaderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [HERO_H * 0.55, HERO_H * 0.8], [0, 1]),
  }));

  return (
    <View style={styles.screen}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        {/* ---------- Hero: image, silence, one line ---------- */}
        <View style={[styles.hero, { height: HERO_H }]}>
          <Animated.View style={[StyleSheet.absoluteFill, heroImageStyle]}>
            <Animated.View style={[StyleSheet.absoluteFill, kenBurnsStyle]}>
              <Image
                source={require("@/assets/oasis/background.jpg")}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            </Animated.View>
          </Animated.View>
          <LinearGradient
            colors={["rgba(20,14,8,0.25)", "rgba(20,14,8,0)", "rgba(20,14,8,0.55)"]}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />

          <View style={[styles.heroTop, { paddingTop: insets.top + 16 }]}>
            <Animated.Text entering={FadeInDown.duration(800)} style={styles.wordmark}>
              OASIS
            </Animated.Text>
            <View style={styles.wordmarkRule} />
          </View>

          <Animated.View style={[styles.heroContent, heroContentStyle]}>
            <Animated.View entering={FadeInDown.duration(700).delay(200)}>
              <Eyebrow style={styles.heroEyebrow}>Crete · Agrotourism · Wellness</Eyebrow>
            </Animated.View>
            <Animated.Text entering={FadeInDown.duration(800).delay(340)} style={styles.heroTitle}>
              Rooted in{"\n"}
              <Text style={styles.heroTitleItalic}>Crete.</Text>
            </Animated.Text>
            <Animated.Text entering={FadeInDown.duration(800).delay(500)} style={styles.heroSub}>
              Curated rituals and unhurried days, in and around Chania.
            </Animated.Text>
            <Animated.View entering={FadeInDown.duration(800).delay(650)}>
              <PressableScale style={styles.heroLink} onPress={() => router.push("/explore")}>
                <Text style={styles.heroLinkText}>Discover experiences</Text>
                <View style={styles.heroLinkRule} />
              </PressableScale>
            </Animated.View>
          </Animated.View>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
          <PromoBanner />
        </View>

        {/* ---------- Numbers, quietly ---------- */}
        <View style={styles.stats}>
          <Stat value="4.9" label="Guest rating" />
          <View style={styles.statRule} />
          <Stat value="120+" label="Journeys" />
          <View style={styles.statRule} />
          <Stat value="100%" label="Local hosts" />
        </View>

        {/* ---------- Experiences ---------- */}
        <SectionHeader
          eyebrow="The portfolio"
          title="Experiences"
          action="View all"
          onAction={() => router.push("/explore")}
        />
        {loading ? (
          <View style={{ flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.lg }}>
            <Shimmer style={{ width: CARD_W, height: 380, borderRadius: radii.md }} />
            <Shimmer style={{ width: 80, height: 380, borderRadius: radii.md }} />
          </View>
        ) : featured.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_W + spacing.lg}
            decelerationRate="fast"
            contentContainerStyle={{ gap: spacing.lg, paddingHorizontal: spacing.lg }}
          >
            {featured.map((exp) => (
              <EditorialCard key={String(exp.id)} exp={exp} />
            ))}
          </ScrollView>
        ) : (
          <Muted style={{ paddingHorizontal: spacing.lg }}>
            Experiences are currently being updated.
          </Muted>
        )}

        {/* ---------- Philosophy ---------- */}
        <SectionHeader eyebrow="Our philosophy" title="The art of filoxenia" />
        <View style={{ paddingHorizontal: spacing.lg }}>
          {FOUNDATIONS.map((f, i) => (
            <View key={f.n} style={[styles.listRow, i === 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
              <Text style={styles.listIndex}>{f.n}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.listTitle}>{f.title}</Text>
                <Muted style={{ fontSize: 13, marginTop: 2 }}>{f.text}</Muted>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.quoteBlock}>
          <Image
            source={require("@/assets/oasis/olive-2.jpg")}
            style={styles.quoteImage}
            contentFit="cover"
          />
          <Text style={styles.quoteText}>
            “Slow down, soften, and let the land set the pace.”
          </Text>
        </View>

        {/* ---------- Ways to journey ---------- */}
        <SectionHeader eyebrow="Ways to journey" title="How will you join us?" />
        <View style={{ paddingHorizontal: spacing.lg }}>
          {JOURNEYS.map((j, i) => (
            <PressableScale
              key={j.n}
              onPress={() => router.push(j.route)}
              style={[
                styles.listRow,
                i === 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
              ]}
            >
              <Text style={styles.listIndex}>{j.n}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.listTitle}>{j.title}</Text>
                <Muted style={{ fontSize: 13, marginTop: 2 }}>{j.text}</Muted>
              </View>
              <Ionicons name="arrow-forward" size={16} color={colors.gold} />
            </PressableScale>
          ))}
        </View>

        {/* ---------- Guest words ---------- */}
        <SectionHeader eyebrow="Guest words" title="Heard around the table" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={SCREEN_W - spacing.lg * 2 + spacing.lg}
          decelerationRate="fast"
          contentContainerStyle={{ gap: spacing.lg, paddingHorizontal: spacing.lg }}
        >
          {TESTIMONIALS.map((t) => (
            <View key={t.name} style={styles.testimonial}>
              <Text style={styles.testimonialMark}>“</Text>
              <Text style={styles.testimonialQuote}>{t.quote}</Text>
              <Text style={styles.testimonialName}>— {t.name}</Text>
            </View>
          ))}
        </ScrollView>

        {/* ---------- Closing ---------- */}
        <View style={styles.ctaBlock}>
          <Image
            source={require("@/assets/oasis/gorge.jpg")}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
          <LinearGradient
            colors={["rgba(20,14,8,0.35)", "rgba(20,14,8,0.65)"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.ctaInner}>
            <Eyebrow style={{ color: colors.sandSoft, textAlign: "center" }}>
              Come as a guest
            </Eyebrow>
            <Text style={styles.ctaTitle}>Leave as family.</Text>
            <Button
              title="Book your experience"
              variant="sand"
              onPress={() => router.push("/explore")}
              style={{ marginTop: spacing.lg, alignSelf: "stretch" }}
            />
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <NewsletterCard />
          <Muted style={styles.footerMeta}>
            © {new Date().getFullYear()} Oasis · Agrotourism & Wellness · Chania, Crete
          </Muted>
        </View>
      </Animated.ScrollView>

      {/* Frosted mini-header, appears after the hero scrolls away */}
      <Animated.View
        pointerEvents="none"
        style={[styles.miniHeader, { paddingTop: insets.top + 8 }, miniHeaderStyle]}
      >
        <BlurView intensity={30} tint="extraLight" style={StyleSheet.absoluteFill} />
        <View style={styles.miniHeaderTint} />
        <Text style={styles.miniWordmark}>OASIS</Text>
      </Animated.View>
    </View>
  );
}

/* ---------- Pieces ---------- */

function SectionHeader({
  eyebrow,
  title,
  action,
  onAction,
}: {
  eyebrow: string;
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1 }}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <Serif style={styles.sectionTitle}>{title}</Serif>
      </View>
      {action ? (
        <PressableScale onPress={onAction} style={{ paddingBottom: 6 }}>
          <Text style={styles.sectionAction}>{action}</Text>
          <View style={styles.sectionActionRule} />
        </PressableScale>
      ) : null}
    </View>
  );
}

/** Editorial card: the image speaks, the caption whispers below it. */
function EditorialCard({ exp }: { exp: Experience }) {
  const priced = exp.priceAdult != null && Number(exp.priceAdult) > 0;
  return (
    <PressableScale
      style={{ width: CARD_W }}
      onPress={() => router.push(`/experience/${exp.slug}`)}
    >
      <View>
        {exp.images?.[0] ? (
          <Image
            source={{ uri: exp.images[0] }}
            style={styles.cardImage}
            contentFit="cover"
            transition={250}
          />
        ) : (
          <View style={[styles.cardImage, { backgroundColor: colors.creamChip }]} />
        )}
        <View style={styles.cardFav}>
          <FavoriteButton experienceId={exp.id} />
        </View>
      </View>
      <View style={styles.cardCaption}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {exp.name}
        </Text>
        <View style={styles.cardMetaRow}>
          <Muted style={{ fontSize: 12, flex: 1 }} numberOfLines={1}>
            {exp.location || "Chania, Crete"}
            {exp.duration ? ` · ${exp.duration}` : ""}
          </Muted>
          <Text style={styles.cardPrice}>
            {priced ? `From ${money(exp.priceAdult)}` : "On request"}
          </Text>
        </View>
      </View>
    </PressableScale>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },

  hero: { overflow: "hidden", justifyContent: "space-between" },
  heroTop: { alignItems: "center", gap: 10 },
  wordmark: {
    fontFamily: fonts.serifRegular,
    fontSize: 22,
    letterSpacing: 10,
    color: colors.creamSoft,
  },
  wordmarkRule: { width: 28, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(253,250,245,0.7)" },
  heroContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl + 8,
    gap: spacing.md,
  },
  heroEyebrow: { color: "rgba(253,250,245,0.85)" },
  heroTitle: {
    fontFamily: fonts.serifRegular,
    fontSize: 52,
    lineHeight: 60,
    color: colors.creamSoft,
  },
  heroTitleItalic: { fontStyle: "italic", color: colors.sand },
  heroSub: {
    fontFamily: fonts.sans,
    fontSize: 14.5,
    lineHeight: 22,
    color: "rgba(253,250,245,0.85)",
    maxWidth: 300,
  },
  heroLink: { alignSelf: "flex-start", marginTop: spacing.sm },
  heroLinkText: {
    fontFamily: fonts.sansMedium,
    fontSize: 12.5,
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: colors.creamSoft,
  },
  heroLinkRule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.sand, marginTop: 7 },

  stats: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  stat: { flex: 1, alignItems: "center", gap: 3 },
  statValue: { fontFamily: fonts.serifRegular, fontSize: 24, color: INK },
  statLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 9.5,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.mutedWarm,
  },
  statRule: { width: StyleSheet.hairlineWidth, height: 34, backgroundColor: colors.border },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xxl,
    marginBottom: spacing.lg,
  },
  sectionTitle: { fontSize: 30, marginTop: 8 },
  sectionAction: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: INK,
  },
  sectionActionRule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.gold, marginTop: 5 },

  cardImage: { width: "100%", height: 340, borderRadius: radii.md },
  cardFav: { position: "absolute", top: 10, right: 10 },
  cardCaption: { paddingTop: spacing.md, gap: 6 },
  cardTitle: { fontFamily: fonts.serifRegular, fontSize: 21, lineHeight: 27, color: INK },
  cardMetaRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  cardPrice: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.gold, letterSpacing: 0.4 },

  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    paddingVertical: spacing.md + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  listIndex: { fontFamily: fonts.serifRegular, fontStyle: "italic", fontSize: 15, color: colors.gold, width: 26 },
  listTitle: { fontFamily: fonts.serifRegular, fontSize: 19, color: INK },

  quoteBlock: { marginTop: spacing.xxl, alignItems: "center" },
  quoteImage: { width: SCREEN_W, height: 300 },
  quoteText: {
    fontFamily: fonts.serifRegular,
    fontStyle: "italic",
    fontSize: 21,
    lineHeight: 32,
    color: INK,
    textAlign: "center",
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
    maxWidth: 340,
  },

  testimonial: {
    width: SCREEN_W - spacing.lg * 2,
    paddingRight: spacing.lg,
  },
  testimonialMark: { fontFamily: fonts.serifRegular, fontSize: 44, color: colors.gold, lineHeight: 48 },
  testimonialQuote: {
    fontFamily: fonts.serifRegular,
    fontSize: 19,
    lineHeight: 30,
    color: INK,
  },
  testimonialName: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.mutedWarm,
    marginTop: spacing.md,
  },

  ctaBlock: { marginTop: spacing.xxl, overflow: "hidden" },
  ctaInner: { padding: spacing.xl, paddingVertical: spacing.xxl, alignItems: "center" },
  ctaTitle: {
    fontFamily: fonts.serifRegular,
    fontStyle: "italic",
    fontSize: 34,
    color: colors.creamSoft,
    marginTop: 10,
    textAlign: "center",
  },

  footerMeta: { textAlign: "center", marginTop: spacing.xl, fontSize: 11, letterSpacing: 0.4 },

  miniHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingBottom: 12,
    overflow: "hidden",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  miniHeaderTint: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(253,250,245,0.72)",
  },
  miniWordmark: { fontFamily: fonts.serifRegular, fontSize: 16, letterSpacing: 8, color: INK },
});
