import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PermissionGate } from "@/components/access";
import { Badge, Button, EmptyState, ErrorState, Eyebrow, ListSkeleton, Muted, Serif } from "@/components/ui";
import { colors, fonts, radii, spacing } from "@/constants/theme";
import { useApi } from "@/hooks/useApi";
import { useDebounced } from "@/hooks/useDebounced";
import { api } from "@/lib/api";
import { moneyCents } from "@/lib/format";
import type { ShopProductRow } from "@/lib/types";

export default function ShopProductsScreen() {
  return (
    <PermissionGate permission="eshop">
      <ShopProducts />
    </PermissionGate>
  );
}

function ShopProducts() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const query = useDebounced(search, 350);
  const [filter, setFilter] = useState<"all" | "live" | "low">("all");
  const [saving, setSaving] = useState<number | null>(null);
  const [editing, setEditing] = useState<ShopProductRow | null>(null);

  const { data, loading, error, refresh, setData } = useApi(
    () => api.shopProducts(query || undefined),
    [query],
  );

  const items = useMemo(() => {
    const rows = data ?? [];
    if (filter === "live") return rows.filter((p) => p.active);
    if (filter === "low") return rows.filter((p) => (p.stock_qty ?? 0) <= 5);
    return rows;
  }, [data, filter]);

  async function bump(product: ShopProductRow, delta: number) {
    const next = Math.max(0, Number(product.stock_qty || 0) + delta);
    if (next === product.stock_qty) return;
    Haptics.selectionAsync().catch(() => {});
    setSaving(product.id);
    // Move the number immediately; a stockroom is no place to wait on a spinner.
    setData((prev) =>
      (prev ?? []).map((p) => (p.id === product.id ? { ...p, stock_qty: next } : p)),
    );
    try {
      await api.shopSetStock(product.id, next);
    } catch {
      setData((prev) =>
        (prev ?? []).map((p) =>
          p.id === product.id ? { ...p, stock_qty: product.stock_qty } : p,
        ),
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setSaving(null);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Eyebrow>E-shop</Eyebrow>
          <Serif style={{ fontSize: 26 }}>Products</Serif>
        </View>
        <Button
          title="Scan"
          variant="ghost"
          onPress={() => router.push("/shop-scan" as never)}
          style={{ minHeight: 42, paddingHorizontal: 18 }}
        />
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color={colors.faint} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Name, SKU or barcode"
          placeholderTextColor={colors.faint}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.searchInput}
        />
        {search ? (
          <Pressable hitSlop={8} onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={17} color={colors.faint} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.filterRow}>
        {(
          [
            ["all", "All"],
            ["live", "Live"],
            ["low", "Low stock"],
          ] as const
        ).map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => setFilter(key)}
            style={[styles.filterChip, filter === key && styles.filterChipOn]}
          >
            <Text style={[styles.filterText, filter === key && styles.filterTextOn]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading && !data ? (
        <View style={{ padding: spacing.md }}>
          <ListSkeleton rows={6} />
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={{
            paddingHorizontal: spacing.md,
            paddingBottom: insets.bottom + 40,
            gap: 8,
          }}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.gold} />
          }
          ListEmptyComponent={
            <EmptyState
              title={query ? "Nothing matched" : "No products"}
              subtitle={
                query
                  ? "Try a different name, SKU or barcode."
                  : "Products are created in the web console."
              }
            />
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Pressable
                style={{ flex: 1, minWidth: 0 }}
                onPress={() => setEditing(item)}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${item.title}`}
              >
                <Text style={styles.title} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {moneyCents(item.price_cents, item.currency)}
                  {item.sku_code ? ` · ${item.sku_code}` : ""}
                  {item.barcode ? ` · ${item.barcode}` : ""}
                </Text>
                <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
                  {!item.active ? <Badge label="Hidden" tone="neutral" /> : null}
                  {item.stock_qty === 0 ? (
                    <Badge label="Sold out" tone="danger" />
                  ) : item.stock_qty <= 5 ? (
                    <Badge label={`Only ${item.stock_qty}`} tone="warning" />
                  ) : null}
                  {item.shipping_weight_grams === 0 ? (
                    <Badge label="No weight" tone="warning" />
                  ) : null}
                </View>
              </Pressable>

              <View style={styles.stepper}>
                <Pressable
                  hitSlop={6}
                  onPress={() => bump(item, -1)}
                  disabled={item.stock_qty <= 0}
                  style={styles.stepBtn}
                >
                  <Ionicons
                    name="remove"
                    size={16}
                    color={item.stock_qty <= 0 ? colors.faint : colors.text}
                  />
                </Pressable>
                <View style={styles.stockCell}>
                  {saving === item.id ? (
                    <ActivityIndicator size="small" color={colors.gold} />
                  ) : (
                    <Text style={styles.stockNum}>{item.stock_qty}</Text>
                  )}
                </View>
                <Pressable hitSlop={6} onPress={() => bump(item, 1)} style={styles.stepBtn}>
                  <Ionicons name="add" size={16} color={colors.text} />
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
      <ProductSheet
        product={editing}
        onClose={() => setEditing(null)}
        onSaved={(updated) => {
          setData((prev) => (prev ?? []).map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
          setEditing(null);
        }}
      />
    </View>
  );
}

/* --------------------------- stock & weight sheet ------------------------- */

function ProductSheet({
  product,
  onClose,
  onSaved,
}: {
  product: ShopProductRow | null;
  onClose: () => void;
  onSaved: (p: ShopProductRow) => void;
}) {
  const [stock, setStock] = useState("");
  const [weight, setWeight] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!product) return;
    setStock(String(product.stock_qty ?? 0));
    setWeight(product.shipping_weight_grams ? String(product.shipping_weight_grams) : "");
  }, [product]);

  async function save() {
    if (!product) return;
    setBusy(true);
    try {
      let updated = product;
      const nextStock = Number(stock) || 0;
      if (nextStock !== product.stock_qty) {
        updated = { ...updated, ...(await api.shopSetStock(product.id, nextStock)) };
      }
      const nextWeight = weight === "" ? 0 : Number(weight);
      if (nextWeight !== (product.shipping_weight_grams ?? 0)) {
        updated = { ...updated, ...(await api.shopSetWeight(product.id, nextWeight)) };
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onSaved({ ...updated, stock_qty: nextStock, shipping_weight_grams: nextWeight });
    } catch (e) {
      Alert.alert("Product", e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      visible={product != null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.sheet}>
        <View style={styles.sheetHead}>
          <View style={{ flex: 1 }}>
            <Eyebrow>Product</Eyebrow>
            <Serif style={{ fontSize: 21 }} numberOfLines={2}>
              {product?.title ?? ""}
            </Serif>
          </View>
          <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
            <Ionicons name="close" size={19} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
          <View>
            <Text style={styles.label}>Stock on hand</Text>
            <TextInput
              value={stock}
              onChangeText={(t) => setStock(t.replace(/[^0-9]/g, ""))}
              keyboardType="number-pad"
              style={styles.input}
              accessibilityLabel="Stock on hand"
            />
          </View>

          <View>
            <Text style={styles.label}>Shipping weight (grams)</Text>
            <TextInput
              value={weight}
              onChangeText={(t) => setWeight(t.replace(/[^0-9]/g, ""))}
              keyboardType="number-pad"
              placeholder="e.g. 800"
              placeholderTextColor={colors.faint}
              style={styles.input}
              accessibilityLabel="Shipping weight in grams"
            />
            <Muted style={{ fontSize: 11.5, marginTop: 6 }}>
              What the courier bills on. Without it, delivery for this product prices at
              the base rate only. Packed dimensions are set in the web console.
            </Muted>
          </View>

          {product?.barcode ? (
            <View>
              <Text style={styles.label}>Barcode</Text>
              <Text style={styles.mono}>{product.barcode}</Text>
            </View>
          ) : null}

          <Button title={busy ? "Saving…" : "Save"} disabled={busy} onPress={save} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.text,
  },
  filterRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.chip,
  },
  filterChipOn: { backgroundColor: colors.sand },
  filterText: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.textSoft },
  filterTextOn: { color: colors.bg },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 14.5, color: colors.text },
  meta: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.muted, marginTop: 2 },

  stepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.chip,
    borderRadius: radii.pill,
    padding: 3,
  },
  stepBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  stockCell: { minWidth: 34, alignItems: "center" },
  stockNum: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.text },

  sheet: { flex: 1, backgroundColor: colors.bg },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.chip,
  },
  label: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.muted, marginBottom: 6 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    fontFamily: fonts.sansSemiBold,
    fontSize: 17,
    color: colors.text,
  },
  mono: { fontFamily: "Courier", fontSize: 14, color: colors.textSoft },
});
