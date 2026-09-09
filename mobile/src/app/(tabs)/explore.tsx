import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Calendar } from "react-native-calendars";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ExperienceCard } from "@/components/ExperienceCard";
import { Shimmer } from "@/components/premium";
import { Button, Card, EmptyState, Eyebrow, Muted, Serif } from "@/components/ui";
import { colors, fonts, radii, spacing } from "@/constants/theme";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { dayKey } from "@/lib/format";
import type { Experience } from "@/lib/types";

type Filter = { from: string; to: string; party: number } | null;

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const { data: experiences, loading, error, refresh } = useApi(() => api.experiences());
  const [filter, setFilter] = useState<Filter>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const [availability, setAvailability] = useState<Record<string, number> | null>(null);

  const applyFilter = useCallback(
    async (f: Filter) => {
      setFilter(f);
      if (!f || !experiences) {
        setAvailability(null);
        return;
      }
      setFiltering(true);
      // The website filters server-side; here we ask the schedule endpoint per
      // experience and keep those with enough remaining seats in the range.
      const result: Record<string, number> = {};
      await Promise.all(
        experiences.map(async (exp) => {
          try {
            const slots = await api.schedule(exp.id);
            const inRange = slots.filter((s) => {
              const key = dayKey(s.date);
              return key >= f.from && key <= f.to && !s.isCancelled;
            });
            result[String(exp.id)] = inRange.reduce(
              (max, s) => Math.max(max, s.available ?? 0),
              0
            );
          } catch {
            result[String(exp.id)] = 0;
          }
        })
      );
      setAvailability(result);
      setFiltering(false);
    },
    [experiences]
  );

  const visible = useMemo(() => {
    const list = experiences ?? [];
    if (!filter || !availability) return list;
    return list.filter((exp) => {
      const unpriced = !(exp.priceAdult != null && Number(exp.priceAdult) > 0);
      if (unpriced) return true; // private/bespoke stays visible, like the web
      return (availability[String(exp.id)] ?? 0) >= filter.party;
    });
  }, [experiences, filter, availability]);

  function scarcity(exp: Experience): number | null {
    if (!filter || !availability) return null;
    const n = availability[String(exp.id)] ?? 0;
    return n >= 1 && n <= 4 ? n : null;
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}
      >
        <View style={styles.header}>
          <Eyebrow>The Portfolio</Eyebrow>
          <Serif style={{ fontSize: 30 }}>Experiences</Serif>
          <Muted>
            {loading
              ? "Loading journeys…"
              : `${visible.length} experience${visible.length === 1 ? "" : "s"} available`}
          </Muted>
        </View>

        {/* Filter bar */}
        <Pressable style={styles.filterBar} onPress={() => setPickerOpen(true)}>
          <Ionicons name="calendar-outline" size={18} color={colors.brand} />
          <Text style={styles.filterText}>
            {filter
              ? `${filter.from} → ${filter.to} · ${filter.party} guest${filter.party > 1 ? "s" : ""}`
              : "Filter by dates & guests"}
          </Text>
          {filter ? (
            <Pressable hitSlop={8} onPress={() => applyFilter(null)}>
              <Ionicons name="close-circle" size={20} color={colors.mutedWarm} />
            </Pressable>
          ) : (
            <Ionicons name="chevron-forward" size={18} color={colors.mutedWarm} />
          )}
        </Pressable>

        <View style={{ paddingHorizontal: spacing.md, gap: spacing.md }}>
          {loading || filtering ? (
            [0, 1, 2].map((i) => <Shimmer key={i} style={styles.skeleton} />)
          ) : error ? (
            <EmptyState title="Couldn't load experiences" subtitle={error}>
              <Button title="Try again" onPress={refresh} />
            </EmptyState>
          ) : visible.length === 0 ? (
            <EmptyState
              title={
                filter
                  ? "We're currently full for these dates."
                  : "Our public calendar is being updated."
              }
              subtitle="Consider a private journey tailored to you."
            >
              <View style={{ gap: spacing.sm }}>
                <Button title="Plan a Private Journey" onPress={() => router.push("/contact")} />
                {filter ? (
                  <Button title="Clear Dates" variant="ghost" onPress={() => applyFilter(null)} />
                ) : null}
              </View>
            </EmptyState>
          ) : (
            <>
              {visible.map((exp, i) => (
                <Animated.View
                  key={String(exp.id)}
                  entering={FadeInUp.duration(500).delay(Math.min(i, 5) * 100)}
                >
                  <ExperienceCard exp={exp} scarcity={scarcity(exp)} />
                </Animated.View>
              ))}
              {/* Bespoke card, always appended like on the web */}
              <Card style={{ backgroundColor: colors.brownDeep, borderColor: colors.brownDeep }}>
                <Eyebrow light>Fully Customizable • Private Group</Eyebrow>
                <Serif style={{ color: colors.creamSoft, fontSize: 22, marginTop: 6 }}>
                  Bespoke & Private Events
                </Serif>
                <Muted style={{ color: colors.sandSoft, marginTop: 4 }}>
                  Celebrations, chef's tables, and privatized tours — designed around you.
                </Muted>
                <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
                  <Button title="Inquire Now" variant="sand" onPress={() => router.push("/contact")} style={{ flex: 1 }} />
                  <Button
                    title="Learn more"
                    variant="ghost"
                    onPress={() => router.push("/private")}
                    style={{ flex: 1, borderColor: colors.creamSoft }}
                    textStyle={{ color: colors.creamSoft }}
                  />
                </View>
              </Card>
            </>
          )}
        </View>
      </ScrollView>

      <FilterModal
        visible={pickerOpen}
        initial={filter}
        onClose={() => setPickerOpen(false)}
        onApply={(f) => {
          setPickerOpen(false);
          applyFilter(f);
        }}
      />
    </View>
  );
}

function FilterModal({
  visible,
  initial,
  onClose,
  onApply,
}: {
  visible: boolean;
  initial: Filter;
  onClose: () => void;
  onApply: (f: Filter) => void;
}) {
  const [from, setFrom] = useState(initial?.from ?? "");
  const [to, setTo] = useState(initial?.to ?? "");
  const [party, setParty] = useState(initial?.party ?? 2);
  const today = dayKey(new Date().toISOString());

  function onDayPress(day: { dateString: string }) {
    if (!from || (from && to)) {
      setFrom(day.dateString);
      setTo("");
    } else if (day.dateString < from) {
      setFrom(day.dateString);
    } else {
      setTo(day.dateString);
    }
  }

  const marked = useMemo(() => {
    const m: Record<string, any> = {};
    if (from) m[from] = { startingDay: true, color: colors.brand, textColor: "#fff" };
    if (from && to) {
      const start = new Date(from);
      const end = new Date(to);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = dayKey(d.toISOString());
        m[key] = {
          color: key === from || key === to ? colors.brand : colors.sandSoft,
          textColor: key === from || key === to ? "#fff" : colors.brownDeep,
          startingDay: key === from,
          endingDay: key === to,
        };
      }
    }
    return m;
  }, [from, to]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modal}>
        <View style={styles.modalHeader}>
          <Serif style={{ fontSize: 22 }}>Dates & Guests</Serif>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.brownDeep} />
          </Pressable>
        </View>
        <Calendar
          markingType="period"
          markedDates={marked}
          minDate={today}
          onDayPress={onDayPress}
          theme={{
            calendarBackground: colors.creamSoft,
            todayTextColor: colors.brand,
            arrowColor: colors.brand,
            monthTextColor: colors.brownDeep,
            textMonthFontFamily: fonts.serif,
            textDayFontFamily: fonts.sans,
            textDayHeaderFontFamily: fonts.sansMedium,
          }}
          style={{ borderRadius: radii.md, overflow: "hidden" }}
        />
        <View style={styles.partyRow}>
          <Text style={styles.partyLabel}>Guests</Text>
          <View style={styles.stepper}>
            <Pressable
              style={styles.stepBtn}
              onPress={() => setParty((p) => Math.max(1, p - 1))}
            >
              <Ionicons name="remove" size={18} color={colors.brownDeep} />
            </Pressable>
            <Text style={styles.partyValue}>{party}</Text>
            <Pressable
              style={styles.stepBtn}
              onPress={() => setParty((p) => Math.min(8, p + 1))}
            >
              <Ionicons name="add" size={18} color={colors.brownDeep} />
            </Pressable>
          </View>
        </View>
        <Button
          title="Search"
          disabled={!from || !to}
          onPress={() => onApply({ from, to, party })}
        />
        <Button
          title="Clear"
          variant="ghost"
          onPress={() => {
            setFrom("");
            setTo("");
            onApply(null);
          }}
          style={{ marginTop: spacing.sm }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: { padding: spacing.md, gap: 4 },
  filterBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.creamSoft,
    borderWidth: 1,
    borderColor: colors.borderWarm,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  filterText: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 13, color: colors.brownDeep },
  skeleton: { height: 380, borderRadius: radii.xl, backgroundColor: colors.creamChip },
  modal: { flex: 1, backgroundColor: colors.cream, padding: spacing.md, gap: spacing.md },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  partyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  partyLabel: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.brownDeep },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderWarm,
    backgroundColor: colors.creamSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  partyValue: { fontFamily: fonts.sansSemiBold, fontSize: 17, color: colors.brownDeep, minWidth: 24, textAlign: "center" },
});
