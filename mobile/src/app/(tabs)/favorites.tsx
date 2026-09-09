import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FavoriteButton } from "@/components/FavoriteButton";
import { Button, EmptyState, Eyebrow, Muted, Serif } from "@/components/ui";
import { colors, fonts, radii, shadows, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { money } from "@/lib/format";

export default function FavoritesScreen() {
  const insets = useSafeAreaInsets();
  const { session, loading: authLoading } = useAuth();
  const { data, loading, refresh, setData } = useApi(
    async () => (session ? api.favorites() : { data: [] }),
    [session?.user?.id]
  );

  useFocusEffect(
    useCallback(() => {
      if (session) refresh();
    }, [session, refresh])
  );

  const favorites = (data?.data ?? []).filter((f) => f.Experience);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Eyebrow>Your Collection</Eyebrow>
        <Serif style={{ fontSize: 30 }}>My Favorites</Serif>
      </View>
      {authLoading || loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : !session ? (
        <EmptyState
          title="Log in to see your collection"
          subtitle="Save the journeys that speak to you and find them here."
        >
          <Button title="Log In" onPress={() => router.push("/login")} />
        </EmptyState>
      ) : favorites.length === 0 ? (
        <EmptyState
          title="Nothing saved yet"
          subtitle="Tap the heart on any experience to add it to your collection."
        >
          <Button title="Explore Experiences" onPress={() => router.push("/explore")} />
        </EmptyState>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 48 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}
        >
          {favorites.map((f) => {
            const exp = f.Experience!;
            return (
              <Pressable
                key={String(f.id)}
                style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
                onPress={() => router.push(`/experience/${exp.slug}`)}
              >
                <View>
                  {exp.images?.[0] ? (
                    <Image source={{ uri: exp.images[0] }} style={styles.image} contentFit="cover" transition={200} />
                  ) : (
                    <View style={[styles.image, { backgroundColor: colors.creamChip }]} />
                  )}
                  <View style={styles.heart}>
                    <FavoriteButton
                      experienceId={exp.id}
                      initial
                      onToggled={(isFav) => {
                        if (!isFav && data) {
                          setData({ data: data.data.filter((x) => x.id !== f.id) });
                        }
                      }}
                    />
                  </View>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.title} numberOfLines={2}>
                    {exp.name}
                  </Text>
                  <View style={styles.locationRow}>
                    <Ionicons name="location-outline" size={12} color={colors.mutedWarm} />
                    <Muted style={{ fontSize: 12, flex: 1 }} numberOfLines={1}>
                      {exp.location || "Chania, Crete"}
                    </Muted>
                  </View>
                  <View style={styles.pricePill}>
                    <Text style={styles.pricePillText}>
                      {exp.priceAdult ? `From ${money(exp.priceAdult)}` : "On Request"}
                    </Text>
                  </View>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.mutedWarm}
                  style={{ marginRight: spacing.sm }}
                />
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: { padding: spacing.md, gap: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.creamSoft,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSand,
    overflow: "hidden",
    ...shadows.card,
  },
  image: { width: 112, height: 122 },
  heart: { position: "absolute", top: 6, left: 6, transform: [{ scale: 0.85 }] },
  cardBody: { flex: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 5 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  title: { fontFamily: fonts.serif, fontSize: 18, lineHeight: 23, color: colors.brownDeep },
  pricePill: {
    alignSelf: "flex-start",
    backgroundColor: colors.sand,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pricePillText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.brownDeeper },
});
