import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Ornament } from "@/components/premium";
import { ProductCard, optionValues } from "@/components/ProductCard";
import { Button, Chip, Divider, Eyebrow, Muted, Serif } from "@/components/ui";
import { colors, fonts, radii, spacing } from "@/constants/theme";
import { useBag } from "@/context/cart";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { moneyCents } from "@/lib/format";

const INK = "#26201a";
const MAX_PER_LINE = 20;

export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const bag = useBag();

  const { data, loading, error } = useApi(() => api.shopProduct(String(slug)), [slug]);
  const product = data?.product;

  const [option, setOption] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [slide, setSlide] = useState(0);
  const addedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const options = useMemo(() => (product ? optionValues(product) : []), [product]);
  const needsOption = options.length > 0 && !option;
  const soldOut = Boolean(product && !product.inStock);
  const ceiling = Math.min(MAX_PER_LINE, product?.stockQty || MAX_PER_LINE);

  function addToBag() {
    if (!product || soldOut || needsOption) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    bag.add(product, option, quantity);
    setAdded(true);
    if (addedTimer.current) clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setAdded(false), 2200);
  }

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (error || !product) {
    return (
      <View style={[styles.screen, styles.center, { padding: spacing.xl }]}>
        <Serif style={{ fontSize: 22, textAlign: "center" }}>
          This piece is no longer in the shop
        </Serif>
        <Muted style={{ textAlign: "center", marginTop: spacing.sm }}>
          {error || "It may have sold out or been retired."}
        </Muted>
        <Button
          title="Back to the shop"
          variant="ghost"
          onPress={() => router.replace("/shop")}
          style={{ marginTop: spacing.lg }}
        />
      </View>
    );
  }

  const gallery = product.images.length ? product.images : [];

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Gallery */}
        <View>
          {gallery.length ? (
            <FlatList
              data={gallery}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(img, i) => `${img.url}-${i}`}
              onMomentumScrollEnd={(e) =>
                setSlide(Math.round(e.nativeEvent.contentOffset.x / width))
              }
              renderItem={({ item }) => (
                <Image
                  source={{ uri: item.url }}
                  style={{ width, height: width * 1.15 }}
                  contentFit="cover"
                  transition={220}
                />
              )}
            />
          ) : (
            <View style={[styles.noImage, { width, height: width * 0.9 }]}>
              <Ionicons name="leaf-outline" size={30} color={colors.gold} />
            </View>
          )}

          {gallery.length > 1 ? (
            <View style={styles.dots}>
              {gallery.map((img, i) => (
                <View
                  key={`${img.url}-dot-${i}`}
                  style={[styles.dot, i === slide && styles.dotActive]}
                />
              ))}
            </View>
          ) : null}

          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/shop"))}
            style={[styles.backButton, { top: insets.top + 8 }]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={20} color={INK} />
          </Pressable>

          <Pressable
            onPress={() => router.push("/shop/bag")}
            style={[styles.bagButton, { top: insets.top + 8 }]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Your bag"
          >
            <Ionicons name="bag-handle-outline" size={18} color={INK} />
            {bag.count > 0 ? (
              <View style={styles.bagCount}>
                <Text style={styles.bagCountText}>{bag.count}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <View style={styles.body}>
          <Eyebrow>{product.category === "food" ? "From the land" : product.category}</Eyebrow>
          <Serif style={{ fontSize: 28, marginTop: 4 }}>{product.title}</Serif>
          <Text style={styles.price}>{moneyCents(product.priceCents, product.currency)}</Text>

          <View style={styles.stockRow}>
            <Ionicons
              name={soldOut ? "close-circle-outline" : "checkmark-circle-outline"}
              size={14}
              color={soldOut ? colors.danger : colors.success}
            />
            <Text style={[styles.stockText, soldOut && { color: colors.danger }]}>
              {soldOut
                ? "Sold out"
                : product.lowStock
                  ? `Only ${product.stockQty} left`
                  : "In stock"}
            </Text>
            {product.skuCode ? <Muted style={{ fontSize: 12 }}>· {product.skuCode}</Muted> : null}
          </View>

          {options.length ? (
            <View style={{ marginTop: spacing.lg }}>
              <Text style={styles.sectionLabel}>Choose an option</Text>
              <View style={styles.optionRow}>
                {options.map((value) => (
                  <Chip
                    key={value}
                    label={value}
                    active={option === value}
                    onPress={() => setOption(option === value ? null : value)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {product.description ? (
            <>
              <Divider style={{ marginTop: spacing.lg }} />
              <Text style={styles.description}>{product.description}</Text>
            </>
          ) : null}

          {!soldOut ? (
            <>
              <Divider />
              <View style={styles.qtyRow}>
                <Text style={styles.sectionLabel}>Quantity</Text>
                <View style={styles.stepper}>
                  <Pressable
                    hitSlop={8}
                    onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                    style={styles.stepButton}
                  >
                    <Ionicons name="remove" size={16} color={INK} />
                  </Pressable>
                  <Text style={styles.qtyValue}>{quantity}</Text>
                  <Pressable
                    hitSlop={8}
                    onPress={() => setQuantity((q) => Math.min(ceiling, q + 1))}
                    style={styles.stepButton}
                  >
                    <Ionicons name="add" size={16} color={INK} />
                  </Pressable>
                </View>
              </View>
            </>
          ) : null}

          <Ornament style={{ marginTop: spacing.xl }} />
          <View style={styles.assuranceRow}>
            <Ionicons name="cube-outline" size={14} color={colors.mutedWarm} />
            <Muted style={{ flex: 1, fontSize: 12 }}>
              Packed by hand in Chania and shipped within two working days.
            </Muted>
          </View>

          {data?.related?.length ? (
            <View style={{ marginTop: spacing.xl }}>
              <Eyebrow>You may also like</Eyebrow>
              <FlatList
                horizontal
                data={data.related}
                keyExtractor={(p) => String(p.id)}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12, paddingTop: spacing.md }}
                renderItem={({ item }) => <ProductCard product={item} width={150} />}
              />
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Sticky add-to-bag */}
      <View style={[styles.stickyWrap, { paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.sticky}>
          <BlurView intensity={40} tint="extraLight" style={StyleSheet.absoluteFill} />
          <View style={styles.stickyTint} />
          <View style={{ flex: 1 }}>
            <Text style={styles.stickyPrice}>
              {moneyCents(product.priceCents * quantity, product.currency)}
            </Text>
            <Muted style={{ fontSize: 11 }}>
              {needsOption ? "Choose an option first" : "VAT included"}
            </Muted>
          </View>
          {bag.count > 0 && added ? (
            <Button
              title="View bag"
              variant="ghost"
              onPress={() => router.push("/shop/bag")}
              style={{ paddingHorizontal: 20 }}
            />
          ) : null}
          <Button
            title={soldOut ? "Sold out" : added ? "Added" : "Add to bag"}
            disabled={soldOut || needsOption}
            onPress={addToBag}
            style={{ paddingHorizontal: 24 }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  center: { justifyContent: "center", alignItems: "center" },

  noImage: {
    backgroundColor: colors.creamChip,
    alignItems: "center",
    justifyContent: "center",
  },
  dots: {
    flexDirection: "row",
    gap: 5,
    alignSelf: "center",
    marginTop: -18,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(253,250,245,0.6)",
  },
  dotActive: { backgroundColor: colors.creamSoft },

  backButton: {
    position: "absolute",
    left: spacing.md,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(253,250,245,0.92)",
  },
  bagButton: {
    position: "absolute",
    right: spacing.md,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(253,250,245,0.92)",
  },
  bagCount: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: INK,
  },
  bagCountText: { fontFamily: fonts.sansBold, fontSize: 9, color: colors.creamSoft },

  body: { paddingHorizontal: spacing.md, paddingTop: spacing.lg },
  price: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    letterSpacing: 0.4,
    color: colors.gold,
    marginTop: 6,
  },
  stockRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm },
  stockText: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.success },

  sectionLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.brownDeep,
  },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },

  description: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 24,
    color: colors.ink,
  },

  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSand,
    borderRadius: radii.pill,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  stepButton: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  qtyValue: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: INK, minWidth: 18, textAlign: "center" },

  assuranceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },

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
    gap: spacing.sm,
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
    backgroundColor: "rgba(253,250,245,0.75)",
  },
  stickyPrice: { fontFamily: fonts.serif, fontSize: 20, color: colors.brownDeep },
});
