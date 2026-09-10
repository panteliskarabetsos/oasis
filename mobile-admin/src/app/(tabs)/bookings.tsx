import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";

import { PermissionGate } from "@/components/access";
import { PressableScale } from "@/components/premium";
import { Screen, ScreenHeader, useTabBarPadding } from "@/components/screen";
import {
  Avatar,
  Badge,
  Chip,
  EmptyState,
  ErrorState,
  ListSkeleton,
  Muted,
  SearchBar,
} from "@/components/ui";
import { colors, fonts, radii, spacing, type Tone } from "@/constants/theme";
import { useApi } from "@/hooks/useApi";
import { useDebounced } from "@/hooks/useDebounced";
import { api } from "@/lib/api";
import type { Reservation } from "@/lib/types";

const STATUSES = ["all", "confirmed", "pending", "checked_in", "no_show", "cancelled"] as const;

export function statusTone(status?: string): Tone {
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
  const bottomPad = useTabBarPadding();
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
    <Screen>
      <ScreenHeader
        eyebrow="Operations"
        title="Bookings"
        trailing={
          <View style={styles.countPill}>
            <Text style={styles.countValue}>{total}</Text>
            <Text style={styles.countLabel}>results</Text>
          </View>
        }
      />

      <SearchBar
        placeholder="Search guest, email, or code"
        value={query}
        onChangeText={setQuery}
        style={{ marginHorizontal: spacing.md, marginTop: spacing.sm }}
      />

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={STATUSES}
        keyExtractor={(s) => s}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{
          gap: 8,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm + 2,
        }}
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

      {loading && !data ? (
        <ListSkeleton />
      ) : error && !items.length ? (
        <ErrorState title="Couldn't load bookings" message={error} onRetry={refresh} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No bookings found"
          subtitle="Try a different search or filter."
          icon="calendar-outline"
        />
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
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing.md,
            gap: spacing.sm,
            paddingBottom: bottomPad,
          }}
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
    </Screen>
  );
}

function BookingRow({ booking: b }: { booking: Reservation }) {
  const when = b.startTime
    ? `${new Date(b.startTime).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      })} · ${new Date(b.startTime).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      })}`
    : "Private";
  const pax = (b.adults ?? 0) + (b.kids ?? 0);
  const guest = b.guestName || b.guestEmail || "—";
  return (
    <PressableScale
      style={styles.row}
      scaleTo={0.985}
      onPress={() => (b.source === "booking" ? router.push(`/bookings/${b.id}`) : undefined)}
    >
      <Avatar name={b.guestName || b.guestEmail} />
      <View style={{ flex: 1, gap: 3 }}>
        <View style={styles.rowTop}>
          <Text style={styles.code}>{b.code}</Text>
          <Badge label={b.status ?? "—"} tone={statusTone(b.status)} dot />
          {b.isPrivate ? <Badge label="private" tone="info" /> : null}
          {b.source === "draft" ? <Badge label="draft" tone="neutral" /> : null}
        </View>
        <Text style={styles.guest} numberOfLines={1}>
          {guest}
        </Text>
        <Muted style={{ fontSize: 12 }} numberOfLines={2}>
          {b.experienceName || "—"} · {when} · {pax || "?"} pax
        </Muted>
      </View>
      <Text style={styles.amount}>€{Number(b.totalAmount ?? 0).toFixed(0)}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  countPill: {
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  countValue: { fontFamily: fonts.serif, fontSize: 17, color: colors.gold },
  countLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.faint,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 4,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md - 2,
  },
  rowTop: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 7 },
  code: { fontFamily: fonts.sansBold, fontSize: 11.5, color: colors.gold, letterSpacing: 0.6 },
  guest: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.text },
  amount: { fontFamily: fonts.serif, fontSize: 18, color: colors.text, alignSelf: "flex-start" },
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
