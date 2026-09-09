import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, Button, EmptyState, Eyebrow, Muted, Serif } from "@/components/ui";
import { colors, fonts, radii, shadows, spacing } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { MyBooking } from "@/lib/types";

function statusTone(status?: string): "success" | "warning" | "danger" | "neutral" {
  switch ((status ?? "").toLowerCase()) {
    case "paid":
    case "confirmed":
    case "approved":
    case "completed":
    case "checked_in":
      return "success";
    case "pending":
      return "warning";
    case "cancelled":
    case "refunded":
    case "failed":
    case "no_show":
      return "danger";
    default:
      return "neutral";
  }
}

function isUpcoming(b: MyBooking): boolean {
  const when = b.startTime ?? b.scheduleSlot?.date;
  return when ? new Date(when).getTime() > Date.now() : false;
}

export default function BookingsScreen() {
  const insets = useSafeAreaInsets();
  const { session, loading: authLoading } = useAuth();
  const { data: bookings, loading, error, refresh } = useApi(
    async () => (session ? api.myBookings() : []),
    [session?.user?.id]
  );
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [query, setQuery] = useState("");

  useFocusEffect(
    useCallback(() => {
      if (session) refresh();
    }, [session, refresh])
  );

  const filtered = useMemo(() => {
    let list = bookings ?? [];
    list = list.filter((b) => (tab === "upcoming" ? isUpcoming(b) : !isUpcoming(b)));
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((b) =>
        (b.experience?.name ?? b.experienceName ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [bookings, tab, query]);

  const upcomingCount = (bookings ?? []).filter(isUpcoming).length;
  const pastCount = (bookings ?? []).length - upcomingCount;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Eyebrow>Your Journey</Eyebrow>
        <Serif style={{ fontSize: 30 }}>My Bookings</Serif>
      </View>

      {authLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : !session ? (
        <EmptyState
          title="Log in to see your bookings"
          subtitle="Your upcoming journeys and booking history live here."
        >
          <View style={{ gap: spacing.sm }}>
            <Button title="Log In" onPress={() => router.push("/login")} />
            <Button
              title="Find a booking without an account"
              variant="ghost"
              onPress={() => router.push("/manage-booking")}
            />
          </View>
        </EmptyState>
      ) : (
        <>
          <View style={styles.controls}>
            <View style={styles.tabs}>
              {(["upcoming", "past"] as const).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setTab(t)}
                  style={[styles.tab, tab === t && styles.tabActive]}
                >
                  <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                    {t === "upcoming" ? `Upcoming (${upcomingCount})` : `History (${pastCount})`}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.search}>
              <Ionicons name="search-outline" size={16} color={colors.mutedWarm} />
              <TextInput
                placeholder="Search bookings"
                placeholderTextColor={colors.mutedWarm}
                value={query}
                onChangeText={setQuery}
                style={styles.searchInput}
              />
            </View>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.brand} />
            </View>
          ) : error ? (
            <EmptyState title="Couldn't load bookings" subtitle={error}>
              <Button title="Reload" onPress={refresh} />
            </EmptyState>
          ) : filtered.length === 0 ? (
            <EmptyState
              title={tab === "upcoming" ? "No upcoming journeys" : "No past bookings"}
              subtitle="When you book an experience, it will appear here."
            >
              <Button title="Explore Experiences" onPress={() => router.push("/explore")} />
            </EmptyState>
          ) : (
            <ScrollView
              contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 48 }}
              refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}
            >
              {filtered.map((b) => {
                const name = b.experience?.name ?? b.experienceName ?? "Oasis Experience";
                const when = b.startTime ?? b.scheduleSlot?.date;
                const guests = (b.counts?.adults ?? 0) + (b.counts?.kids ?? 0);
                return (
                  <Pressable
                    key={b.id}
                    style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
                    onPress={() => router.push(`/bookings/${b.id}`)}
                  >
                    {b.experience?.images?.[0] ? (
                      <Image
                        source={{ uri: b.experience.images[0] }}
                        style={styles.cardImage}
                        contentFit="cover"
                        transition={200}
                      />
                    ) : (
                      <View style={[styles.cardImage, styles.cardImageFallback]}>
                        <Ionicons name="leaf-outline" size={22} color={colors.gold} />
                      </View>
                    )}
                    <View style={{ flex: 1, gap: 5 }}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {name}
                      </Text>
                      <View style={styles.cardMetaRow}>
                        <Ionicons name="calendar-outline" size={12} color={colors.mutedWarm} />
                        <Muted style={{ fontSize: 12 }}>{formatDateTime(when)}</Muted>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Badge label={b.status ?? "unknown"} tone={statusTone(b.status)} />
                        {guests ? (
                          <Muted style={{ fontSize: 12 }}>
                            {guests} guest{guests > 1 ? "s" : ""}
                          </Muted>
                        ) : null}
                      </View>
                    </View>
                    <View style={styles.cardArrow}>
                      <Ionicons name="arrow-forward" size={14} color={colors.brand} />
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: { padding: spacing.md, gap: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  controls: { paddingHorizontal: spacing.md, gap: spacing.sm },
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.creamChip,
    borderRadius: radii.pill,
    padding: 4,
  },
  tab: { flex: 1, paddingVertical: 8, borderRadius: radii.pill, alignItems: "center" },
  tabActive: { backgroundColor: colors.brownDeep },
  tabText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.brownDeep },
  tabTextActive: { color: colors.creamSoft },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.creamSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.ink,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.creamSoft,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSand,
    padding: 10,
    ...shadows.card,
  },
  cardImage: { width: 74, height: 74, borderRadius: radii.md },
  cardImageFallback: {
    backgroundColor: colors.creamChip,
    alignItems: "center",
    justifyContent: "center",
  },
  cardMetaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardTitle: { fontFamily: fonts.serif, fontSize: 17, color: colors.brownDeep },
  cardArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.creamChip,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 2,
  },
});
