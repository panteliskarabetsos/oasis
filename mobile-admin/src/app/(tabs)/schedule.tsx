import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, Button, Card, Chip, EmptyState, Eyebrow, Field, Muted, Serif } from "@/components/ui";
import { colors, fonts, radii, spacing } from "@/constants/theme";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import type { AdminSlot } from "@/lib/types";
import { PermissionGate } from "@/components/access";

function dayKey(iso: string | Date): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function ScheduleScreenContent() {
  const insets = useSafeAreaInsets();
  const { data: experiences, loading: expLoading } = useApi(() => api.adminExperiences());
  const [expId, setExpId] = useState<number | null>(null);
  const activeExpId = expId ?? experiences?.[0]?.id ?? null;

  const from = useMemo(() => dayKey(new Date()), []);
  const to = useMemo(() => dayKey(new Date(Date.now() + 90 * 86400000)), []);

  const { data: slots, loading, refresh } = useApi(
    async () => (activeExpId ? api.schedule(activeExpId, from, to) : []),
    [activeExpId]
  );

  useFocusEffect(
    useCallback(() => {
      if (activeExpId) refresh();
    }, [activeExpId, refresh])
  );

  const [addOpen, setAddOpen] = useState(false);
  const [addDate, setAddDate] = useState("");
  const [addTime, setAddTime] = useState("09:00");
  const [addCapacity, setAddCapacity] = useState("10");
  const [busy, setBusy] = useState(false);
  const [editSlot, setEditSlot] = useState<AdminSlot | null>(null);
  const [editCapacity, setEditCapacity] = useState("");

  const upcoming = (slots ?? [])
    .filter((s) => new Date(s.date).getTime() > Date.now() - 86400000)
    .sort((a, b) => a.date.localeCompare(b.date));

  const marked = useMemo(() => {
    const m: Record<string, any> = {};
    for (const s of upcoming) {
      if (s.isCancelled) continue;
      const key = dayKey(s.date);
      m[key] = { marked: true, dotColor: (s.available ?? 0) > 0 ? colors.success : colors.warning };
    }
    if (addDate) m[addDate] = { ...(m[addDate] ?? {}), selected: true, selectedColor: colors.brand };
    return m;
  }, [upcoming, addDate]);

  async function createSlot() {
    if (!activeExpId || !addDate) return;
    setBusy(true);
    try {
      await api.createSlot({
        experienceId: activeExpId,
        date: `${addDate}T${addTime || "09:00"}:00.000Z`,
        totalSlots: Number(addCapacity) || 10,
      });
      setAddOpen(false);
      refresh();
    } catch (e) {
      Alert.alert("Schedule", e instanceof Error ? e.message : "Could not create slot.");
    } finally {
      setBusy(false);
    }
  }

  async function saveCapacity() {
    if (!editSlot) return;
    setBusy(true);
    try {
      await api.updateSlotCapacity(editSlot.id, Number(editCapacity));
      setEditSlot(null);
      refresh();
    } catch (e) {
      Alert.alert("Schedule", e instanceof Error ? e.message : "Could not update capacity.");
    } finally {
      setBusy(false);
    }
  }

  function confirmCancel(slot: AdminSlot) {
    Alert.alert(
      "Cancel slot",
      `${new Date(slot.date).toLocaleString("en-GB")} — ${slot.booked ?? 0} booked. ${
        (slot.booked ?? 0) > 0 ? "It will be soft-cancelled (bookings kept)." : "It will be removed."
      }`,
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Cancel slot",
          style: "destructive",
          onPress: async () => {
            try {
              await api.deleteSlot(slot.id);
              refresh();
            } catch (e) {
              Alert.alert("Schedule", e instanceof Error ? e.message : "Failed.");
            }
          },
        },
      ]
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Eyebrow>Planner</Eyebrow>
          <Serif style={{ fontSize: 26 }}>Schedule</Serif>
        </View>
        <Button
          title="+ Slot"
          onPress={() => {
            setAddDate(dayKey(new Date(Date.now() + 86400000)));
            setAddOpen(true);
          }}
          style={{ paddingHorizontal: 18, minHeight: 42, paddingVertical: 10 }}
        />
      </View>

      {/* Experience picker */}
      {expLoading ? (
        <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.lg }} />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}
          style={{ flexGrow: 0, marginTop: spacing.sm }}
        >
          {(experiences ?? []).map((e) => (
            <Chip
              key={e.id}
              label={e.name.length > 26 ? `${e.name.slice(0, 24)}…` : e.name}
              active={activeExpId === e.id}
              onPress={() => setExpId(e.id)}
            />
          ))}
        </ScrollView>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: 90 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.gold} />}
        >
          {upcoming.length === 0 ? (
            <EmptyState title="No upcoming slots" subtitle="Add a slot to open bookings." />
          ) : (
            upcoming.map((s) => {
              const booked = s.booked ?? 0;
              const capacity = s.totalSlots ?? 0;
              const pct = capacity ? Math.min(1, booked / capacity) : 0;
              return (
                <Card key={s.id} style={s.isCancelled ? { opacity: 0.5 } : undefined}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.slotDate}>
                        {new Date(s.date).toLocaleString("en-GB", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                      <Muted style={{ fontSize: 12 }}>
                        {booked} booked · {s.holds ?? 0} holds · {s.available ?? Math.max(0, capacity - booked)} free of {capacity}
                      </Muted>
                    </View>
                    {s.isCancelled ? (
                      <Badge label="cancelled" tone="danger" />
                    ) : (
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <Pressable
                          style={styles.iconBtn}
                          onPress={() => {
                            setEditSlot(s);
                            setEditCapacity(String(capacity));
                          }}
                        >
                          <Ionicons name="create-outline" size={17} color={colors.gold} />
                        </Pressable>
                        <Pressable style={styles.iconBtn} onPress={() => confirmCancel(s)}>
                          <Ionicons name="trash-outline" size={17} color={colors.danger} />
                        </Pressable>
                      </View>
                    )}
                  </View>
                  <View style={styles.capTrack}>
                    <View
                      style={[
                        styles.capFill,
                        {
                          width: `${pct * 100}%`,
                          backgroundColor: pct >= 1 ? colors.danger : pct > 0.7 ? colors.warning : colors.success,
                        },
                      ]}
                    />
                  </View>
                </Card>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Add slot modal */}
      <Modal visible={addOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAddOpen(false)}>
        <ScrollView style={styles.modal} contentContainerStyle={{ padding: spacing.md, paddingBottom: 48 }}>
          <View style={styles.modalHeader}>
            <Serif style={{ fontSize: 21 }}>New slot</Serif>
            <Pressable onPress={() => setAddOpen(false)} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
          <Calendar
            markedDates={marked}
            minDate={dayKey(new Date())}
            onDayPress={(d) => setAddDate(d.dateString)}
            theme={{
              calendarBackground: colors.surface,
              dayTextColor: colors.text,
              monthTextColor: colors.text,
              todayTextColor: colors.gold,
              arrowColor: colors.gold,
              textDisabledColor: colors.faint,
              textMonthFontFamily: fonts.serif,
              textDayFontFamily: fonts.sans,
              textDayHeaderFontFamily: fonts.sansMedium,
            }}
            style={{ borderRadius: radii.md, overflow: "hidden" }}
          />
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
            <Field
              label="Time (UTC)"
              placeholder="09:00"
              value={addTime}
              onChangeText={setAddTime}
              style={{ flex: 1 }}
            />
            <Field
              label="Capacity"
              keyboardType="number-pad"
              value={addCapacity}
              onChangeText={setAddCapacity}
              style={{ flex: 1 }}
            />
          </View>
          <Button
            title={addDate ? `Create slot on ${addDate}` : "Pick a date"}
            disabled={!addDate}
            loading={busy}
            onPress={createSlot}
            style={{ marginTop: spacing.lg }}
          />
        </ScrollView>
      </Modal>

      {/* Edit capacity modal */}
      <Modal visible={!!editSlot} transparent animationType="fade" onRequestClose={() => setEditSlot(null)}>
        <Pressable style={styles.backdrop} onPress={() => setEditSlot(null)} />
        <View style={styles.editSheet}>
          <Serif style={{ fontSize: 19 }}>Capacity</Serif>
          <Muted style={{ marginTop: 4, fontSize: 12 }}>
            {editSlot ? new Date(editSlot.date).toLocaleString("en-GB") : ""} · {editSlot?.booked ?? 0} already booked
          </Muted>
          <Field
            keyboardType="number-pad"
            value={editCapacity}
            onChangeText={setEditCapacity}
            style={{ marginTop: spacing.md }}
          />
          <Button title="Save" loading={busy} onPress={saveCapacity} style={{ marginTop: spacing.md }} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  slotDate: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.text },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  capTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.chip,
    marginTop: 10,
    overflow: "hidden",
  },
  capFill: { height: 5, borderRadius: 3 },
  modal: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)" },
  editSheet: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    top: "32%",
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
});

export default function ScheduleScreen() {
  return (
    <PermissionGate permission="experiences">
      <ScheduleScreenContent />
    </PermissionGate>
  );
}
