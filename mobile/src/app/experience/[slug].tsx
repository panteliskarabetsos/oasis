import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  Dimensions,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeInDown,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FavoriteButton } from "@/components/FavoriteButton";
import { Ornament, PressableScale, Shimmer } from "@/components/premium";
import { Button, EmptyState, Eyebrow, Muted, Serif } from "@/components/ui";
import { colors, fonts, radii, shadows, spacing } from "@/constants/theme";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { config } from "@/lib/config";
import { money, POLICY_MAP, splitItems } from "@/lib/format";
import type { GuestReview, MeetupPoint } from "@/lib/types";

const { width: SCREEN_W } = Dimensions.get("window");
const HERO_H = 480;

export default function ExperienceDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const { data: exp, loading, error, refresh } = useApi(
    () => api.experience(String(slug)),
    [slug]
  );
  const [page, setPage] = useState(0);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const heroStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [-HERO_H, 0, HERO_H],
          [-HERO_H / 2, 0, HERO_H * 0.4]
        ),
      },
      { scale: interpolate(scrollY.value, [-HERO_H, 0], [1.7, 1]) },
    ],
  }));
  const heroTextStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, HERO_H * 0.5], [1, 0]),
  }));
  // Frosted title bar once the hero is gone.
  const titleBarStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [HERO_H - 160, HERO_H - 80], [0, 1]),
  }));

  if (loading) {
    return (
      <View style={styles.screen}>
        <Shimmer style={{ height: HERO_H }} />
        <View style={{ padding: spacing.lg, gap: 12 }}>
          <Shimmer style={{ height: 26, width: 240, borderRadius: 8 }} />
          <Shimmer style={{ height: 15, width: "100%", borderRadius: 8 }} />
          <Shimmer style={{ height: 15, width: "82%", borderRadius: 8 }} />
        </View>
      </View>
    );
  }
  if (error || !exp) {
    return (
      <View style={[styles.screen, { justifyContent: "center", paddingTop: insets.top }]}>
        <EmptyState title="Experience not found" subtitle={error ?? undefined}>
          <View style={{ gap: spacing.sm }}>
            <Button title="Try again" onPress={refresh} />
            <Button title="Back to Experiences" variant="ghost" onPress={() => router.back()} />
          </View>
        </EmptyState>
      </View>
    );
  }

  const images = exp.images?.length ? exp.images : [];
  const price = exp.pricing?.adult ?? exp.priceAdult;
  const priced = price != null && Number(price) > 0;
  const policy = POLICY_MAP[exp.cancellationPolicy ?? "strict"] ?? POLICY_MAP.strict;
  const included = splitItems(exp.whatsIncluded);
  const bring = splitItems(exp.whatToBring);
  const loveList = splitItems(exp.whyYoullLove);
  const reviews = (exp.guestReviews ?? [])
    .map((r): GuestReview => (typeof r === "string" ? { name: "Guest", comment: r } : r))
    .filter((r) => r.comment)
    .slice(0, 6);
  const meetups = (exp.meetupPoints ?? []).filter((m): m is MeetupPoint => Boolean(m));

  async function share() {
    try {
      await Share.share({
        message: `${exp!.name} — Oasis, Crete\n${config.apiUrl}/experiences/${exp!.slug}`,
      });
    } catch {
      // sheet dismissed
    }
  }

  return (
    <View style={styles.screen}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 130 }}
      >
        {/* ---------- Cinematic hero: photo pager + parallax ---------- */}
        <View style={{ height: HERO_H, overflow: "hidden" }}>
          <Animated.View style={[StyleSheet.absoluteFill, heroStyle]}>
            {images.length > 1 ? (
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) =>
                  setPage(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))
                }
              >
                {images.map((uri, i) => (
                  <Image
                    key={i}
                    source={{ uri }}
                    style={{ width: SCREEN_W, height: HERO_H }}
                    contentFit="cover"
                    transition={250}
                  />
                ))}
              </ScrollView>
            ) : (
              <Image
                source={
                  images[0] ? { uri: images[0] } : require("@/assets/oasis/background.jpg")
                }
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            )}
          </Animated.View>
          <LinearGradient
            pointerEvents="none"
            colors={["rgba(20,14,8,0.42)", "rgba(20,14,8,0)", "rgba(20,14,8,0.8)"]}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />

          {/* Title block over the image */}
          <Animated.View
            style={[styles.heroText, heroTextStyle]}
            pointerEvents="none"
          >
            <Animated.View entering={FadeInDown.duration(500)}>
              <Eyebrow light>{exp.location || "Chania, Crete"}</Eyebrow>
            </Animated.View>
            <Animated.Text
              entering={FadeInDown.duration(600).delay(90)}
              style={styles.heroTitle}
            >
              {exp.name}
            </Animated.Text>
            {images.length > 1 ? (
              <View style={styles.dots}>
                {images.map((_, i) => (
                  <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
                ))}
              </View>
            ) : null}
          </Animated.View>
        </View>

        {/* ---------- Content sheet ---------- */}
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {/* Quick facts */}
          <View style={styles.facts}>
            {exp.duration ? (
              <Fact icon="time-outline" label={exp.duration} />
            ) : null}
            <Fact icon="people-outline" label="Small groups" />
            <Fact icon="star" label="4.9 (120)" gold />
            <Fact icon="shield-checkmark-outline" label={policy.label.split(" ")[0]} />
          </View>

          {/* Overview — serif lede + body */}
          {exp.description ? (
            <View style={styles.section}>
              <Eyebrow>The Experience</Eyebrow>
              <Text style={styles.lede}>
                {exp.description.split(/(?<=\.)\s+/)[0]}
              </Text>
              {exp.description.split(/(?<=\.)\s+/).slice(1).join(" ") ? (
                <Text style={styles.bodyText}>
                  {exp.description.split(/(?<=\.)\s+/).slice(1).join(" ")}
                </Text>
              ) : null}
            </View>
          ) : null}

          {loveList.length ? (
            <View style={styles.loveCard}>
              <Serif style={{ fontSize: 19, color: colors.creamSoft }}>
                Why you'll love this
              </Serif>
              {loveList.map((item, i) => (
                <View key={i} style={styles.loveRow}>
                  <Ionicons name="sparkles" size={13} color={colors.sand} />
                  <Text style={styles.loveText}>{item}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <Ornament style={{ marginTop: spacing.xl }} />

          {/* Essentials */}
          <View style={styles.section}>
            <Eyebrow>The Essentials</Eyebrow>
            {included.length ? (
              <EssentialBlock title="What's included" icon="checkmark-circle" items={included} />
            ) : null}
            {bring.length ? (
              <EssentialBlock title="What to bring" icon="bag-handle-outline" items={bring} />
            ) : null}
            <View style={styles.essential}>
              <View style={styles.essentialHeader}>
                <View style={styles.essentialIcon}>
                  <Ionicons name="document-text-outline" size={15} color={colors.brand} />
                </View>
                <Text style={styles.essentialTitle}>Booking policy — {policy.label}</Text>
              </View>
              <Muted style={{ marginTop: 6, lineHeight: 20 }}>{policy.description}</Muted>
              <Pressable onPress={() => router.push("/cancellation-policy")}>
                <Text style={styles.link}>Read the full cancellation policy</Text>
              </Pressable>
            </View>
          </View>

          {/* Meeting points */}
          {meetups.length ? (
            <>
              <Ornament style={{ marginTop: spacing.lg }} />
              <View style={styles.section}>
                <Eyebrow>Where We Meet</Eyebrow>
                {meetups.map((m, i) => (
                  <PressableScale
                    key={i}
                    style={styles.meetupRow}
                    onPress={() =>
                      m.mapPin
                        ? Linking.openURL(
                            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(m.mapPin)}`
                          )
                        : undefined
                    }
                  >
                    <View style={styles.essentialIcon}>
                      <Ionicons name="location" size={15} color={colors.brand} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.essentialTitle}>
                        {m.name || `Meeting point ${i + 1}`}
                      </Text>
                      {m.instructions ? (
                        <Muted style={{ fontSize: 12, marginTop: 2 }}>{m.instructions}</Muted>
                      ) : null}
                    </View>
                    {m.time ? (
                      <Text style={styles.meetupTime}>{m.time}</Text>
                    ) : (
                      <Ionicons name="map-outline" size={16} color={colors.gold} />
                    )}
                  </PressableScale>
                ))}
              </View>
            </>
          ) : null}

          {/* Reviews */}
          {reviews.length ? (
            <>
              <Ornament style={{ marginTop: spacing.lg }} />
              <View style={[styles.section, { paddingHorizontal: 0 }]}>
                <Eyebrow style={{ paddingHorizontal: spacing.lg }}>Guest Words</Eyebrow>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={SCREEN_W * 0.72 + spacing.md}
                  decelerationRate="fast"
                  contentContainerStyle={{
                    gap: spacing.md,
                    paddingHorizontal: spacing.lg,
                    paddingTop: spacing.md,
                  }}
                >
                  {reviews.map((r, i) => (
                    <View key={i} style={styles.review}>
                      <View style={{ flexDirection: "row", gap: 2 }}>
                        {[...Array(5)].map((_, s) => (
                          <Ionicons key={s} name="star" size={11} color={colors.gold} />
                        ))}
                      </View>
                      <Text style={styles.reviewText} numberOfLines={5}>
                        “{r.comment}”
                      </Text>
                      <Text style={styles.reviewName}>— {r.name || "Guest"}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </>
          ) : null}

          {/* Footer note */}
          <Ornament style={{ marginTop: spacing.xl }} />
          <View style={{ alignItems: "center", marginTop: spacing.lg, paddingHorizontal: spacing.lg }}>
            <Serif style={{ fontSize: 22, textAlign: "center" }}>Join the Journey</Serif>
            <Muted style={{ textAlign: "center", marginTop: 6 }}>
              {priced
                ? `From ${money(price)} per person · eco-conscious · vegetarian friendly`
                : "Available as a private, bespoke experience"}
            </Muted>
          </View>
        </View>
      </Animated.ScrollView>

      {/* Frosted title bar (appears when scrolled past the hero) */}
      <Animated.View
        pointerEvents="none"
        style={[styles.titleBar, { paddingTop: insets.top + 10 }, titleBarStyle]}
      >
        <BlurView intensity={36} tint="extraLight" style={StyleSheet.absoluteFill} />
        <View style={styles.titleBarTint} />
        <Text style={styles.titleBarText} numberOfLines={1}>
          {exp.name}
        </Text>
      </Animated.View>

      {/* Floating glass controls — fixed, always reachable */}
      <View style={[styles.heroControls, { top: insets.top + 6 }]}>
        <GlassButton icon="arrow-back" onPress={() => router.back()} />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <GlassButton icon="share-outline" onPress={share} />
          <View style={styles.glassFav}>
            <FavoriteButton experienceId={exp.id} />
          </View>
        </View>
      </View>

      {/* ---------- Frosted booking bar ---------- */}
      <View style={[styles.stickyWrap, { paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.sticky}>
          <BlurView intensity={40} tint="extraLight" style={StyleSheet.absoluteFill} />
          <View style={styles.stickyTint} />
          <View style={{ flex: 1 }}>
            {priced ? (
              <>
                <Text style={styles.stickyPrice}>
                  {money(price)}
                  <Text style={styles.stickyPer}> / person</Text>
                </Text>
                <Muted style={{ fontSize: 11 }}>{policy.label} policy</Muted>
              </>
            ) : (
              <Text style={styles.stickyPrice}>On Request</Text>
            )}
          </View>
          <Button
            title={priced ? "Check Availability" : "Inquire Now"}
            onPress={() =>
              priced ? router.push(`/book/${exp.slug}`) : router.push("/private-inquire")
            }
            style={{ paddingHorizontal: 26 }}
          />
        </View>
      </View>
    </View>
  );
}

/* ---------- Pieces ---------- */

function GlassButton({
  icon,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
}) {
  return (
    <PressableScale style={styles.glassBtn} onPress={onPress} scaleTo={0.9}>
      <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
      <Ionicons name={icon} size={19} color={colors.creamSoft} />
    </PressableScale>
  );
}

function Fact({
  icon,
  label,
  gold,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  gold?: boolean;
}) {
  return (
    <View style={styles.fact}>
      <Ionicons name={icon} size={15} color={gold ? colors.gold : colors.brand} />
      <Text style={styles.factText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function EssentialBlock({
  title,
  icon,
  items,
}: {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  items: string[];
}) {
  return (
    <View style={styles.essential}>
      <View style={styles.essentialHeader}>
        <View style={styles.essentialIcon}>
          <Ionicons name={icon} size={15} color={colors.brand} />
        </View>
        <Text style={styles.essentialTitle}>{title}</Text>
      </View>
      <View style={{ marginTop: 8, gap: 7 }}>
        {items.map((item, i) => (
          <View key={i} style={styles.itemRow}>
            <View style={styles.itemDot} />
            <Text style={styles.itemText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },

  heroControls: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    zIndex: 2,
  },
  glassBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(253,250,245,0.3)",
  },
  glassFav: {
    borderRadius: 19,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(253,250,245,0.3)",
  },
  heroText: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: 52,
    gap: 8,
  },
  heroTitle: {
    fontFamily: fonts.serif,
    fontSize: 33,
    lineHeight: 39,
    color: colors.creamSoft,
  },
  dots: { flexDirection: "row", gap: 5, marginTop: 4 },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(253,250,245,0.45)",
  },
  dotActive: { backgroundColor: colors.sand, width: 16 },

  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    marginTop: -34,
    paddingTop: 12,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderLux,
  },

  facts: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.creamSoft,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLux,
    paddingVertical: 13,
    ...shadows.soft,
  },
  fact: { flex: 1, alignItems: "center", gap: 4, paddingHorizontal: 4 },
  factText: { fontFamily: fonts.sansMedium, fontSize: 10.5, color: colors.brownDeep },

  section: { paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  lede: {
    fontFamily: fonts.serifRegular,
    fontSize: 21,
    lineHeight: 31,
    color: colors.inkDeep,
    marginTop: spacing.sm,
  },
  bodyText: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 25,
    color: colors.ink,
    marginTop: spacing.md,
  },

  loveCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    backgroundColor: colors.brownDeep,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: 10,
  },
  loveRow: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  loveText: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(253,250,245,0.92)",
  },

  essential: {
    backgroundColor: colors.creamSoft,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLux,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  essentialHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  essentialIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.creamChip,
    alignItems: "center",
    justifyContent: "center",
  },
  essentialTitle: {
    flex: 1,
    fontFamily: fonts.sansSemiBold,
    fontSize: 14.5,
    color: colors.brownDeep,
  },
  itemRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingLeft: 4 },
  itemDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gold,
    marginTop: 8,
  },
  itemText: { flex: 1, fontFamily: fonts.sans, fontSize: 14, lineHeight: 21, color: colors.ink },
  link: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.brand, marginTop: 10 },

  meetupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.creamSoft,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLux,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  meetupTime: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: colors.gold },

  review: {
    width: SCREEN_W * 0.72,
    backgroundColor: colors.creamSoft,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLux,
    padding: spacing.md,
    gap: 10,
    ...shadows.soft,
  },
  reviewText: {
    fontFamily: fonts.serifRegular,
    fontStyle: "italic",
    fontSize: 15,
    lineHeight: 23,
    color: colors.brownDeep,
  },
  reviewName: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.mutedWarm },

  titleBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingBottom: 12,
    paddingHorizontal: 70,
    overflow: "hidden",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLux,
  },
  titleBarTint: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(253,252,248,0.72)",
  },
  titleBarText: { fontFamily: fonts.serif, fontSize: 17, color: colors.brownDeep },
  stickyWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
  },
  sticky: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radii.pill,
    overflow: "hidden",
    paddingVertical: 10,
    paddingLeft: spacing.lg,
    paddingRight: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSand,
    shadowColor: colors.brownDeeper,
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  stickyTint: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(253,252,248,0.75)",
  },
  stickyPrice: { fontFamily: fonts.serif, fontSize: 20, color: colors.brownDeep },
  stickyPer: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedWarm },
});
