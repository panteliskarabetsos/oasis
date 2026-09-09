import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Ornament, Shimmer } from "@/components/premium";
import { ProductCard } from "@/components/ProductCard";
import { Chip, EmptyState, Eyebrow, Muted, Serif } from "@/components/ui";
import { colors, fonts, radii, spacing } from "@/constants/theme";
import { useBag } from "@/context/cart";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { moneyCents } from "@/lib/format";
import type { ShopProduct } from "@/lib/types";

const GUTTER = spacing.md;
const COLUMN_GAP = 12;

type Sort = "new" | "price_asc" | "price_desc" | "title";

const SORT_LABELS: Record<Sort, string> = {
  new: "Newest",
  price_asc: "Price ↑",
  price_desc: "Price ↓",
  title: "A–Z",
};

const CATEGORY_LABELS: Record<string, string> = {
  all: "All",
  clothing: "To Wear",
  food: "From the Land",
  other: "Objects",
};

function categoryLabel(key: string) {
  return CATEGORY_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

export default function ShopScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const bag = useBag();

  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<Sort>("new");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  // Keep typing snappy — only the settled query hits the network.
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data, loading, error, refresh } = useApi(
    () => api.shopProducts({ category, sort, search: query || undefined }),
    [category, sort, query]
  );

  const cardWidth = useMemo(
    () => Math.floor((width - GUTTER * 2 - COLUMN_GAP) / 2),
    [width]
  );

  const items: ShopProduct[] = data?.items ?? [];
  const categories = useMemo(
    () => ["all", ...(data?.categories ?? [])],
    [data?.categories]
  );
  const paused = data?.shop?.paused ?? false;

  const header = (
    <View>
      <View style={styles.header}>
        <Eyebrow>Made in Crete</Eyebrow>
        <Serif style={{ fontSize: 30 }}>The Shop</Serif>
        <Muted>
          {loading
            ? "Gathering the shelves…"
            : `${data?.total ?? items.length} piece${(data?.total ?? items.length) === 1 ? "" : "s"} from our valley`}
        </Muted>
      </View>

      {paused ? (
        <View style={styles.pausedCard}>
          <Ionicons name="moon-outline" size={16} color={colors.warning} />
          <Text style={styles.pausedText}>
            {data?.shop?.message || "Our shop is resting. Orders reopen shortly."}
          </Text>
        </View>
      ) : null}

      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color={colors.mutedWarm} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search the shop"
          placeholderTextColor={colors.mutedWarm}
          autoCorrect={false}
          returnKeyType="search"
          style={styles.searchInput}
        />
        {search ? (
          <Pressable hitSlop={8} onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={18} color={colors.mutedWarm} />
          </Pressable>
        ) : null}
      </View>

      {categories.length > 2 ? (
        <FlatList
          horizontal
          data={categories}
          keyExtractor={(c) => c}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          renderItem={({ item }) => (
            <Chip
              label={categoryLabel(item)}
              active={category === item}
              onPress={() => setCategory(item)}
            />
          )}
        />
      ) : null}

      <View style={styles.sortRow}>
        {(Object.keys(SORT_LABELS) as Sort[]).map((key) => (
          <Pressable key={key} onPress={() => setSort(key)} hitSlop={6}>
            <Text style={[styles.sortText, sort === key && styles.sortTextActive]}>
              {SORT_LABELS[key]}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <FlatList
        data={loading ? [] : items}
        keyExtractor={(p) => String(p.id)}
        numColumns={2}
        ListHeaderComponent={header}
        columnWrapperStyle={{ gap: COLUMN_GAP }}
        contentContainerStyle={{
          paddingHorizontal: GUTTER,
          paddingBottom: bag.count > 0 ? 120 : 48,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.brand} />
        }
        renderItem={({ item }) => <ProductCard product={item} width={cardWidth} />}
        ListEmptyComponent={
          loading ? (
            <View style={styles.skeletonGrid}>
              {[0, 1, 2, 3].map((i) => (
                <Shimmer
                  key={i}
                  style={{ width: cardWidth, height: cardWidth / 0.82, borderRadius: radii.md }}
                />
              ))}
            </View>
          ) : error ? (
            <EmptyState
              title="We couldn't open the shop"
              subtitle={error}
            />
          ) : (
            <EmptyState
              title={query ? "Nothing by that name" : "The shelves are bare"}
              subtitle={
                query
                  ? "Try a different word, or browse every piece."
                  : "New pieces from the valley arrive with each season."
              }
            />
          )
        }
        ListFooterComponent={
          !loading && items.length ? <Ornament style={{ marginTop: spacing.lg }} /> : null
        }
      />

      {bag.count > 0 ? (
        <View style={[styles.bagWrap, { paddingBottom: insets.bottom ? 8 : 12 }]}>
          <Pressable style={styles.bagBar} onPress={() => router.push("/shop/bag")}>
            <BlurView intensity={40} tint="extraLight" style={StyleSheet.absoluteFill} />
            <View style={styles.bagTint} />
            <Ionicons name="bag-handle-outline" size={17} color="#26201a" />
            <View style={{ flex: 1 }}>
              <Text style={styles.bagTitle}>
                {bag.count} item{bag.count === 1 ? "" : "s"} in your bag
              </Text>
              <Muted style={{ fontSize: 11 }}>
                {moneyCents(bag.subtotalCents, bag.currency)} · tap to review
              </Muted>
            </View>
            <Ionicons name="arrow-forward" size={17} color={colors.brand} />
          </Pressable>
        </View>
      ) : null}

      {loading && items.length > 0 ? (
        <View style={styles.inlineSpinner}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: { paddingTop: spacing.lg, paddingBottom: spacing.md, gap: 4 },

  pausedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.warningSoft,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  pausedText: { flex: 1, fontFamily: fonts.sans, fontSize: 13, color: colors.warning },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSand,
    paddingBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.ink,
    paddingVertical: 2,
  },

  chipRow: { gap: spacing.sm, paddingVertical: spacing.md },
  sortRow: {
    flexDirection: "row",
    gap: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  sortText: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.mutedWarm,
  },
  sortTextActive: {
    color: "#26201a",
    textDecorationLine: "underline",
    textDecorationColor: colors.gold,
  },

  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: COLUMN_GAP,
  },

  bagWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: GUTTER,
  },
  bagBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radii.pill,
    overflow: "hidden",
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSand,
    shadowColor: colors.brownDeeper,
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  bagTint: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(253,250,245,0.78)",
  },
  bagTitle: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: "#26201a" },

  inlineSpinner: { position: "absolute", top: 0, left: 0, right: 0, alignItems: "center" },
});
