import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PressableScale } from "@/components/premium";
import {
  Badge,
  Chip,
  EmptyState,
  ErrorState,
  Eyebrow,
  ListSkeleton,
  Muted,
  Serif,
} from "@/components/ui";
import { colors, fonts, radii, spacing } from "@/constants/theme";
import { useApi } from "@/hooks/useApi";
import { useDebounced } from "@/hooks/useDebounced";
import { api } from "@/lib/api";
import type { Reservation } from "@/lib/types";
import { PermissionGate } from "@/components/access";

const STATUSES = ["all", "confirmed", "pending", "checked_in", "no_show", "cancelled"] as const;

export function statusTone(status?: string): "success" | "warning" | "danger" | "neutral" | "info" {
  switch ((status ?? "").toLowerCase()) {
    case "confirmed":
    case "paid":
    case "completed":
      return "success";
    case "checked_in":
      return "info";
    case "pending":
      return "warning";
    case "cancelled":
    case "no_show":
    case "refunded":
      return "danger";
    default:
      return "neutral";
  }
}

function BookingsScreenContent() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounced(query);
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [page, setPage] = useState(1);

  const { data, loading, error, refresh } = useApi(
    () =>
      api.reservations({
        page,
        pageSize: 25,
        q: debouncedQuery.trim() || undefined,
        status: status === "all" ? undefined : status,
      }),
    [page, status, debouncedQuery]
  );

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery]);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 25));

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Eyebrow>Operations</Eyebrow>
          <Serif style={{ fontSize: 26 }}>Bookings</Serif>
        </View>
        <Muted style={{ fontSize: 12 }}>{total} results</Muted>
      </View>

      <View style={styles.search}>
        <Ionicons name="search-outline" size={16} color={colors.muted} />
        <TextInput
          placeholder="Search guest, email, or #code"
          placeholderTextColor={colors.faint}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          style={styles.searchInput}
          autoCapitalize="none"
        />
        {query ? (
          <Ionicons
            name="close-circle"
            size={16}
            color={colors.muted}
            onPress={() => setQuery("")}
          />
        ) : null}
      </View>

      <View>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={STATUSES}
          keyExtractor={(s) => s}
          contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}
          renderItem={({ item: s }) => (
            <Chip
              label={s === "all" ? "All" : s.replace("_", " ")}
              active={status === s}
              onPress={() => {
                setStatus(s);
                setPage(1);
              }}
            />
          )}
        />
      </View>

      {loading && !data ? (
        <ListSkeleton />
      ) : error && !items.length ? (
        <ErrorState title="Couldn't load bookings" message={error} onRetry={refresh} />
      ) : items.length === 0 ? (
        <EmptyState title="No bookings found" subtitle="Try a different search or filter." />
      ) : (
        <FlatList
          refreshControl={
            <RefreshControl
              refreshing={loading && !!data}
              onRefresh={refresh}
              tintColor={colors.gold}
            />
          }
          data={items}
          keyExtractor={(b) => `${b.source}-${b.id}`}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: 90 }}
          renderItem={({ item }) => <BookingRow booking={item} />}
          ListFooterComponent={
            pages > 1 ? (
              <View style={styles.pager}>
                <Chip label="← Prev" onPress={() => setPage((p) => Math.max(1, p - 1))} />
                <Muted style={{ fontSize: 12 }}>
                  Page {page} / {pages}
                </Muted>
                <Chip label="Next →" onPress={() => setPage((p) => Math.min(pages, p + 1))} />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

function BookingRow({ booking: b }: { booking: Reservation }) {
  const when = b.startTime
    ? new Date(b.startTime).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Private";
  const pax = (b.adults ?? 0) + (b.kids ?? 0);
  return (
    <PressableScale
      style={styles.row}
      onPress={() =>
        b.source === "booking" ? router.push(`/bookings/${b.id}`) : undefined
      }
    >
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={styles.code}>{b.code}</Text>
          {b.isPrivate ? <Badge label="private" tone="info" /> : null}
          {b.source === "draft" ? <Badge label="draft" tone="neutral" /> : null}
        </View>
        <Text style={styles.guest} numberOfLines={1}>
          {b.guestName || b.guestEmail || "—"}
        </Text>
        <Muted style={{ fontSize: 12 }} numberOfLines={1}>
          {b.experienceName || "—"} · {when} · {pax || "?"} pax
        </Muted>
      </View>
      <View style={{ alignItems: "flex-end", gap: 6 }}>
        <Text style={styles.amount}>€{Number(b.totalAmount ?? 0).toFixed(0)}</Text>
        <Badge label={b.status ?? "—"} tone={statusTone(b.status)} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 11,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.text,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  code: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.gold, letterSpacing: 0.5 },
  guest: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.text },
  amount: { fontFamily: fonts.serif, fontSize: 17, color: colors.text },
  pager: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    marginTop: spacing.md,
  },
});

export default function BookingsScreen() {
  return (
    <PermissionGate permission="bookings">
      <BookingsScreenContent />
    </PermissionGate>
  );
}
