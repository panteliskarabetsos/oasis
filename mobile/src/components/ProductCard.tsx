import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { PressableScale } from "@/components/premium";
import { colors, fonts, radii, spacing } from "@/constants/theme";
import { useBag } from "@/context/cart";
import { moneyCents } from "@/lib/format";
import type { ShopProduct } from "@/lib/types";

const INK = "#26201a";

/** True when the product needs a choice made before it can go in the bag. */
export function hasOptions(product: ShopProduct): boolean {
  return optionValues(product).length > 0;
}

/** Normalises the loosely-typed `options` jsonb into a flat list of labels. */
export function optionValues(product: ShopProduct): string[] {
  const raw = Array.isArray(product.options) ? product.options : [];
  const out: string[] = [];
  for (const entry of raw) {
    if (typeof entry === "string") {
      if (entry.trim()) out.push(entry.trim());
    } else if (entry && typeof entry === "object") {
      for (const v of entry.values ?? []) {
        if (typeof v === "string" && v.trim()) out.push(v.trim());
      }
    }
  }
  return [...new Set(out)];
}

/** Storefront tile: a quiet photograph with the price beneath it. */
export function ProductCard({ product, width }: { product: ShopProduct; width: number }) {
  const bag = useBag();
  const soldOut = !product.inStock;
  const inBag = bag.lines
    .filter((l) => l.productId === product.id)
    .reduce((n, l) => n + l.quantity, 0);

  function quickAdd() {
    if (soldOut) return;
    // Anything with a variant has to be chosen on the product page.
    if (hasOptions(product)) {
      router.push(`/shop/p/${product.slug}`);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    bag.add(product);
  }

  return (
    <PressableScale
      style={[styles.card, { width }]}
      scaleTo={0.97}
      onPress={() => router.push(`/shop/p/${product.slug}`)}
    >
      <View>
        {product.image ? (
          <Image
            source={{ uri: product.image }}
            style={[styles.image, soldOut && { opacity: 0.4 }]}
            contentFit="cover"
            transition={220}
          />
        ) : (
          <View style={[styles.image, styles.imageFallback]}>
            <Ionicons name="leaf-outline" size={22} color={colors.gold} />
          </View>
        )}

        {soldOut ? (
          <View style={styles.soldOutWrap}>
            <Text style={styles.soldOutText}>Sold out</Text>
          </View>
        ) : (
          <Pressable
            hitSlop={8}
            onPress={quickAdd}
            accessibilityRole="button"
            accessibilityLabel={`Add ${product.title} to bag`}
            style={styles.addButton}
          >
            <Ionicons
              name={inBag > 0 ? "checkmark" : "add"}
              size={16}
              color={inBag > 0 ? colors.success : INK}
            />
          </Pressable>
        )}

        {!soldOut && product.lowStock ? (
          <View style={styles.lowStock}>
            <Text style={styles.lowStockText}>Only {product.stockQty} left</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {product.title}
      </Text>
      <Text style={styles.price}>{moneyCents(product.priceCents, product.currency)}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { gap: 6 },
  image: {
    width: "100%",
    aspectRatio: 0.82,
    borderRadius: radii.md,
    backgroundColor: colors.creamChip,
  },
  imageFallback: { alignItems: "center", justifyContent: "center" },
  addButton: {
    position: "absolute",
    right: 8,
    bottom: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(253,250,245,0.92)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSand,
  },
  soldOutWrap: {
    position: "absolute",
    left: 8,
    top: 8,
    backgroundColor: "rgba(38,32,26,0.85)",
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  soldOutText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 9,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.creamSoft,
  },
  lowStock: {
    position: "absolute",
    left: 8,
    top: 8,
    backgroundColor: colors.warningSoft,
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  lowStockText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.warning,
  },
  title: {
    fontFamily: fonts.serifRegular,
    fontSize: 15.5,
    lineHeight: 21,
    color: INK,
    marginTop: spacing.xs,
  },
  price: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    letterSpacing: 0.4,
    color: colors.gold,
  },
});
