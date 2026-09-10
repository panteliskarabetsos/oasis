import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PressableScale } from "@/components/premium";
import { Badge, EmptyState, ErrorState, Muted } from "@/components/ui";
import { colors, fonts, radii, shadows, spacing } from "@/constants/theme";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import type { CheckinBooking } from "@/lib/types";
import { PermissionGate } from "@/components/access";
import { Screen, ScreenHeader, useTabBarPadding } from "@/components/screen";

function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The guest QR encodes ".../bookings/BK-000123" (or a ticket ref) — pull the id. */
/**
 * Pull a booking reference out of whatever the QR contained.
 *
 * References are now random codes (BK-WD7A-FR1X), so this returns the reference
 * as a string and lets the server resolve it. It deliberately does NOT fall
 * back to "any digits anywhere": that rule turned BK-WD7A-FR1X into booking 7
 * and would have admitted a different guest.
 */
function extractBookingRef(raw: string): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;

  // Random code, with or without a URL around it.
  const code = s.match(/BK[-\s]?([0-9A-Z]{4})[-\s]?([0-9A-Z]{4})\b/i);
  if (code) return `BK-${code[1].toUpperCase()}-${code[2].toUpperCase()}`;

  // Legacy "BK-000123" tickets, in a URL or on their own.
  const legacy = s.match(/BK[-\s]?0*(\d{1,10})\b/i);
  if (legacy) return legacy[1];

  const explicit = s.match(/BOOKING-CHECKIN:0*(\d{1,10})/i);
  if (explicit) return explicit[1];

  // A bare number is a booking id — but only if that is all there is.
  if (/^\d{1,10}$/.test(s)) return s;

  return null;
}

/** Reject rather than leave an operator staring at a spinner on a dead signal. */
function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

type ScanCard = {
  kind: "pending" | "success" | "already" | "error";
  /** The scanned reference — a code like BK-WD7A-FR1X, or a legacy numeric id. */
  id?: string;
  guestName?: string;
  code?: string;
  pax?: number;
  experienceName?: string;
  time?: string;
  message?: string;
  offManifest?: boolean;
};

function initials(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** The checkins API returns primary_contact/adultsCount/kidsCount — normalize. */
function bookingName(b: CheckinBooking): string | undefined {
  if (b.guestName) return b.guestName;
  const pc = b.primary_contact;
  if (!pc) return undefined;
  return pc.name || [pc.firstName, pc.lastName].filter(Boolean).join(" ") || pc.email || undefined;
}

function bookingPax(b: CheckinBooking): number | undefined {
  if (b.pax != null) return b.pax;
  if (b.numberOfPeople != null) return Number(b.numberOfPeople);
  const total = Number(b.adultsCount ?? 0) + Number(b.kidsCount ?? 0);
  return total > 0 ? total : undefined;
}

function bookingCode(b: CheckinBooking): string {
  return b.code ?? `BK-${String(b.id).padStart(6, "0")}`;
}

function CheckinsScreenContent() {
  // Scanning a queue of guests means long stretches without touching the
  // screen; letting it auto-lock mid-queue is the single biggest field annoyance.
  useKeepAwake();

  // Admission tones. A check-in desk is noisy and the phone is often held at
  // arm's length, so each outcome gets its own sound as well as its own haptic.
  const okSound = useAudioPlayer(require("../../../assets/sounds/checkin-success.wav"));
  const dupSound = useAudioPlayer(require("../../../assets/sounds/checkin-duplicate.wav"));
  const errSound = useAudioPlayer(require("../../../assets/sounds/checkin-error.wav"));
  const [soundOn, setSoundOn] = useState(true);
  const [torchOn, setTorchOn] = useState(false);

  useEffect(() => {
    // Staff usually keep the phone on silent; admission tones still need to play.
    // Doing this on mount also activates the audio session up front, so the
    // first tone of a shift isn't the one that pays for session start-up.
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  const playTone = useCallback(
    (kind: "success" | "already" | "error") => {
      if (!soundOn) return;
      const player = kind === "success" ? okSound : kind === "already" ? dupSound : errSound;
      // seekTo is async. Firing it and calling play() on the next line leaves the
      // player parked at the end of the previous play, so every scan after the
      // first was silent. Always rewind, and wait for it to land.
      void (async () => {
        try {
          await player.seekTo(0);
          player.play();
        } catch {
          // never let audio break a check-in
        }
      })();
    },
    [soundOn, okSound, dupSound, errSound],
  );
  const insets = useSafeAreaInsets();
  const bottomPad = useTabBarPadding();
  const [date, setDate] = useState(() => dayKey(new Date()));
  const { data, loading, error, refresh } = useApi(() => api.checkins(date), [date]);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanResult, setScanResult] = useState<{ text: string; ok: boolean } | null>(null);
  const [scanCard, setScanCard] = useState<ScanCard | null>(null);
  const [scanPaused, setScanPaused] = useState(false);
  const [flash, setFlash] = useState<"ok" | "bad" | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const cooldownRef = useRef(0);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // 7-day strip centered on today
  const days = useMemo(() => {
    const out: { key: string; dow: string; num: number; isToday: boolean }[] = [];
    for (let i = -1; i <= 6; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      out.push({
        key: dayKey(d),
        dow: d.toLocaleDateString("en-GB", { weekday: "short" }),
        num: d.getDate(),
        isToday: i === 0,
      });
    }
    return out;
  }, []);

  const slots = data?.slots ?? [];
  const allBookings = slots.flatMap((s) => s.bookings ?? []);
  const checkedIn = allBookings.filter((b) => b.status === "checked_in").length;
  const noShows = allBookings.filter((b) => b.status === "no_show").length;
  const progress = allBookings.length ? (checkedIn + noShows) / allBookings.length : 0;

  async function action(bookingId: number, kind: "checkin" | "undo" | "no_show") {
    setBusyId(bookingId);
    try {
      await api.checkinAction(bookingId, kind);
      if (kind === "checkin") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      refresh();
    } catch (e) {
      setScanResult({ text: e instanceof Error ? e.message : "Action failed.", ok: false });
    } finally {
      setBusyId(null);
    }
  }

  /** Enrich a scanned booking id with guest details — from today's manifest
   *  first, then the reservations API as a fallback. */
  /** Manifest-only lookup. Synchronous, so scan feedback never waits on the network. */
  function lookupLocal(ref: string): Partial<ScanCard> | null {
    const wanted = String(ref).toUpperCase();
    for (const slot of data?.slots ?? []) {
      const hit = (slot.bookings ?? []).find(
        (b) => String(b.code ?? "").toUpperCase() === wanted || String(b.id) === wanted,
      );
      if (hit) {
        return {
          guestName: bookingName(hit),
          code: bookingCode(hit),
          pax: bookingPax(hit),
          experienceName: slot.experienceName,
          time: new Date(slot.date).toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        };
      }
    }
    return null;
  }

  async function lookupBooking(ref: string): Promise<Partial<ScanCard>> {
    const wanted = String(ref).toUpperCase();
    for (const slot of data?.slots ?? []) {
      const hit = (slot.bookings ?? []).find(
        (b) => String(b.code ?? "").toUpperCase() === wanted || String(b.id) === wanted,
      );
      if (hit) {
        return {
          guestName: bookingName(hit),
          code: bookingCode(hit),
          pax: bookingPax(hit),
          experienceName: slot.experienceName,
          time: new Date(slot.date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        };
      }
    }
    // Not on today's manifest — ask the server, which resolves a code as well
    // as a numeric id. (The reservations endpoint only understands ids.)
    try {
      const item = await api.checkinDetails(ref);
      return {
        guestName: item.guestName ?? undefined,
        code: item.code ?? ref,
        pax: item.pax ?? undefined,
        experienceName: item.experienceName ?? undefined,
        time: item.startTime
          ? new Date(item.startTime).toLocaleString("en-GB", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })
          : undefined,
        offManifest: true,
      };
    } catch {
      return { code: ref };
    }
  }

  function showCard(card: ScanCard) {
    setScanCard(card);
    setScanPaused(true);

    // A pending card is only an acknowledgement — no colour flash, and it must
    // not time out before the server has answered.
    if (card.kind === "pending") {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
      return;
    }

    setFlash(card.kind === "error" ? "bad" : "ok");
    setTimeout(() => setFlash(null), 350);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => {
      setScanCard(null);
      setScanPaused(false);
    }, 7000);
  }

  function resumeScanning() {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    setScanCard(null);
    setScanPaused(false);
    cooldownRef.current = 0;
  }

  async function onScanned(raw: string) {
    if (scanPaused) return;
    const now = Date.now();
    if (now - cooldownRef.current < 2000) return;
    cooldownRef.current = now;

    const ref = extractBookingRef(raw);
    if (!ref) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      playTone("error");
      showCard({ kind: "error", message: "Not a valid Oasis ticket code." });
      return;
    }
    // Acknowledge the scan immediately. The guest's name comes straight from
    // today's manifest, so the operator sees who was scanned without waiting
    // for the round-trip that decides whether they're admitted.
    const local = lookupLocal(ref);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    showCard({ kind: "pending", id: ref, ...(local ?? {}) });

    try {
      const res = await withTimeout(
        api.checkinAction(ref, "checkin"),
        8000,
        "No answer from the server. Check the signal and scan again.",
      );
      const details = local ?? (await lookupBooking(ref));
      if (res.already) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        playTone("already");
        showCard({ kind: "already", id: ref, ...details });
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        playTone("success");
        showCard({ kind: "success", id: ref, ...details });
      }
      refresh();
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      playTone("error");
      const details = local ?? (await lookupBooking(ref));
      showCard({
        kind: "error",
        id: ref,
        ...details,
        message: e instanceof Error ? e.message : "Check-in failed.",
      });
    }
  }

  async function undoFromCard() {
    if (!scanCard?.id) return;
    try {
      await api.checkinAction(scanCard.id, "undo");
      Haptics.selectionAsync().catch(() => {});
      refresh();
      resumeScanning();
    } catch (e) {
      setScanCard((c) => (c ? { ...c, message: e instanceof Error ? e.message : "Undo failed." } : c));
    }
  }

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Arrivals"
        title="Check-in"
        trailing={
          <PressableScale
            style={styles.scanCta}
            onPress={async () => {
              if (!permission?.granted) {
                const res = await requestPermission();
                if (!res.granted) return;
              }
              setScanOpen(true);
            }}
          >
            <Ionicons name="qr-code" size={16} color={colors.onGold} />
            <Text style={styles.scanCtaText}>Scan</Text>
          </PressableScale>
        }
      />

      {/* Day strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, marginTop: spacing.md }}
        contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.md }}
      >
        {days.map((d) => {
          const active = d.key === date;
          return (
            <Pressable
              key={d.key}
              onPress={() => setDate(d.key)}
              style={[styles.day, active && styles.dayActive]}
            >
              <Text style={[styles.dayDow, active && styles.dayTextActive]}>{d.dow}</Text>
              <Text style={[styles.dayNum, active && styles.dayTextActive]}>{d.num}</Text>
              {d.isToday ? <View style={[styles.todayDot, active && { backgroundColor: "#1d160f" }]} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Day progress */}
      <View style={styles.progressCard}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={styles.progressTitle}>
            {checkedIn} of {allBookings.length} arrived
          </Text>
          <View style={{ flex: 1 }} />
          {noShows > 0 ? <Badge label={`${noShows} no-show`} tone="danger" /> : null}
          <Badge
            label={progress >= 1 && allBookings.length > 0 ? "day complete" : "in progress"}
            tone={progress >= 1 && allBookings.length > 0 ? "success" : "info"}
          />
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
      </View>

      {scanResult ? (
        <Pressable
          style={[styles.scanBanner, { borderColor: scanResult.ok ? colors.success : colors.danger }]}
          onPress={() => setScanResult(null)}
        >
          <Ionicons
            name={scanResult.ok ? "checkmark-circle" : "alert-circle"}
            size={15}
            color={scanResult.ok ? colors.success : colors.danger}
          />
          <Text style={styles.scanBannerText}>{scanResult.text}</Text>
          <Ionicons name="close" size={14} color={colors.muted} />
        </Pressable>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : error ? (
        <ErrorState title="Couldn't load arrivals" message={error} onRetry={refresh} />
      ) : slots.length === 0 ? (
        <EmptyState title="A quiet day" subtitle="No departures scheduled for this date." />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: bottomPad }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.gold} />}
        >
          {slots.map((slot) => {
            const done = (slot.bookings ?? []).filter(
              (b) => b.status === "checked_in" || b.status === "no_show"
            ).length;
            return (
              <View key={slot.id} style={styles.slotCard}>
                <View style={styles.slotHeader}>
                  <View style={styles.timeChip}>
                    <Text style={styles.timeChipText}>
                      {new Date(slot.date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </View>
                  <Text style={styles.slotName} numberOfLines={1}>
                    {slot.experienceName ?? "Experience"}
                  </Text>
                  <Muted style={{ fontSize: 11 }}>
                    {done}/{(slot.bookings ?? []).length}
                  </Muted>
                </View>

                {(slot.bookings ?? []).map((b) => (
                  <BookingRow key={b.id} b={b} busy={busyId === b.id} onAction={action} />
                ))}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Scanner modal */}
      <Modal
        visible={scanOpen}
        animationType="slide"
        onRequestClose={() => {
          resumeScanning();
          setScanOpen(false);
        }}
      >
        <View style={styles.scanScreen}>
          <CameraView
            style={StyleSheet.absoluteFill}
            enableTorch={torchOn}
            barcodeScannerSettings={{ barcodeTypes: ["qr", "code128", "ean13"] }}
            onBarcodeScanned={({ data }) => onScanned(data)}
          />

          {/* success / error flash */}
          {flash ? (
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: flash === "ok" ? "rgba(127,176,105,0.35)" : "rgba(217,107,83,0.4)" },
              ]}
            />
          ) : null}

          <View style={[styles.scanTop, { paddingTop: insets.top + 10 }]}>
            <View>
              <Text style={styles.scanTitle}>Scan guest ticket</Text>
              <Text style={styles.scanSub}>
                {checkedIn} of {allBookings.length} arrived today
              </Text>
            </View>
            <View style={styles.scanActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={torchOn ? "Turn flashlight off" : "Turn flashlight on"}
                style={[styles.scanIconBtn, torchOn && styles.scanIconBtnOn]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setTorchOn((v) => !v);
                }}
              >
                <Ionicons
                  name={torchOn ? "flashlight" : "flashlight-outline"}
                  size={20}
                  color={torchOn ? colors.bg : colors.white}
                />
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={soundOn ? "Mute admission sounds" : "Unmute admission sounds"}
                style={styles.scanIconBtn}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setSoundOn((v) => !v);
                }}
              >
                <Ionicons
                  name={soundOn ? "volume-high" : "volume-mute"}
                  size={20}
                  color={colors.white}
                />
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close scanner"
                style={styles.scanClose}
                onPress={() => {
                  setTorchOn(false);
                  resumeScanning();
                  setScanOpen(false);
                }}
              >
                <Ionicons name="close" size={22} color={colors.white} />
              </Pressable>
            </View>
          </View>

          {!scanCard ? (
            <>
              <View style={styles.scanFrame} pointerEvents="none">
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
              </View>
              <Text style={styles.scanHint}>Align the QR code inside the frame</Text>
            </>
          ) : null}

          {/* Rich scan result card */}
          {scanCard ? (
            <View style={[styles.resultCard, { bottom: insets.bottom + 24 }]}>
              <View
                style={[
                  styles.resultHeader,
                  scanCard.kind === "pending" && { backgroundColor: colors.chip },
                  scanCard.kind === "success" && { backgroundColor: colors.success },
                  scanCard.kind === "already" && { backgroundColor: colors.warning },
                  scanCard.kind === "error" && { backgroundColor: colors.danger },
                ]}
              >
                {scanCard.kind === "pending" ? (
                  <ActivityIndicator size="small" color={colors.gold} />
                ) : (
                  <Ionicons
                    name={
                      scanCard.kind === "success"
                        ? "checkmark-circle"
                        : scanCard.kind === "already"
                          ? "alert-circle"
                          : "close-circle"
                    }
                    size={20}
                    color="#17120d"
                  />
                )}
                <Text
                  style={[
                    styles.resultHeaderText,
                    scanCard.kind === "pending" && { color: colors.text },
                  ]}
                >
                  {scanCard.kind === "pending"
                    ? "Checking…"
                    : scanCard.kind === "success"
                      ? "Checked in"
                      : scanCard.kind === "already"
                        ? "Already checked in"
                        : "Not admitted"}
                </Text>
                {scanCard.code ? <Text style={styles.resultCode}>{scanCard.code}</Text> : null}
              </View>

              <View style={styles.resultBody}>
                <View style={styles.resultAvatar}>
                  <Text style={styles.resultAvatarText}>{initials(scanCard.guestName)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultGuest} numberOfLines={1}>
                    {scanCard.guestName || "Unknown guest"}
                  </Text>
                  <Text style={styles.resultMeta} numberOfLines={2}>
                    {[
                      scanCard.experienceName,
                      scanCard.time,
                      scanCard.pax ? `${scanCard.pax} guest${scanCard.pax > 1 ? "s" : ""}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || scanCard.message || ""}
                  </Text>
                  {scanCard.offManifest ? (
                    <Text style={styles.resultWarn}>Not on this day's manifest</Text>
                  ) : null}
                  {scanCard.message && scanCard.kind !== "error" ? (
                    <Text style={styles.resultWarn}>{scanCard.message}</Text>
                  ) : null}
                  {scanCard.kind === "error" && scanCard.message ? (
                    <Text style={[styles.resultWarn, { color: colors.danger }]}>{scanCard.message}</Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.resultActions}>
                {scanCard.kind === "success" && scanCard.id ? (
                  <Pressable style={styles.resultGhostBtn} onPress={undoFromCard}>
                    <Ionicons name="arrow-undo-outline" size={15} color={colors.gold} />
                    <Text style={styles.resultGhostText}>Undo</Text>
                  </Pressable>
                ) : null}
                <Pressable style={styles.resultPrimaryBtn} onPress={resumeScanning}>
                  <Ionicons name="qr-code-outline" size={15} color="#1d160f" />
                  <Text style={styles.resultPrimaryText}>Scan next</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </Screen>
  );
}

function BookingRow({
  b,
  busy,
  onAction,
}: {
  b: CheckinBooking;
  busy: boolean;
  onAction: (id: number, kind: "checkin" | "undo" | "no_show") => void;
}) {
  const handled = b.status === "checked_in" || b.status === "no_show";
  return (
    <View style={[rowStyles.row, handled && { opacity: 0.72 }]}>
      <View
        style={[
          rowStyles.avatar,
          b.status === "checked_in" && { borderColor: colors.success },
          b.status === "no_show" && { borderColor: colors.danger },
        ]}
      >
        <Text style={rowStyles.avatarText}>{initials(bookingName(b))}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={rowStyles.name} numberOfLines={1}>
          {bookingName(b) || `Booking #${b.id}`}
        </Text>
        <Muted style={{ fontSize: 11 }}>
          {bookingCode(b)} · {bookingPax(b) ?? "?"} guests
          {b.meetupPoint ? ` · ${typeof b.meetupPoint === "string" ? b.meetupPoint : ""}` : ""}
        </Muted>
      </View>
      {busy ? (
        <ActivityIndicator color={colors.gold} />
      ) : b.status === "checked_in" ? (
        <Pressable style={rowStyles.undo} onPress={() => onAction(b.id, "undo")}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={[rowStyles.undoText, { color: colors.success }]}>In</Text>
          <Ionicons name="arrow-undo-outline" size={13} color={colors.muted} />
        </Pressable>
      ) : b.status === "no_show" ? (
        <Pressable style={rowStyles.undo} onPress={() => onAction(b.id, "undo")}>
          <Ionicons name="close-circle" size={16} color={colors.danger} />
          <Text style={[rowStyles.undoText, { color: colors.danger }]}>No-show</Text>
          <Ionicons name="arrow-undo-outline" size={13} color={colors.muted} />
        </Pressable>
      ) : (
        <View style={{ flexDirection: "row", gap: 6 }}>
          <PressableScale style={rowStyles.checkin} onPress={() => onAction(b.id, "checkin")}>
            <Ionicons name="checkmark" size={14} color="#12210e" />
            <Text style={rowStyles.checkinText}>Check in</Text>
          </PressableScale>
          <PressableScale style={rowStyles.noshow} onPress={() => onAction(b.id, "no_show")}>
            <Ionicons name="close" size={15} color={colors.danger} />
          </PressableScale>
        </View>
      )}
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.chip,
    borderWidth: 1.5,
    borderColor: colors.borderGold,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: fonts.serif, fontSize: 14, color: colors.gold },
  name: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.text },
  checkin: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.success,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  checkinText: { fontFamily: fonts.sansBold, fontSize: 12, color: "#12210e" },
  noshow: {
    width: 33,
    height: 33,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  undo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.chip,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  undoText: { fontFamily: fonts.sansSemiBold, fontSize: 12 },
});

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scanCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: colors.gold,
    borderRadius: radii.pill,
    paddingHorizontal: 18,
    paddingVertical: 11,
    ...shadows.soft,
  },
  scanCtaText: { fontFamily: fonts.sansBold, fontSize: 14, color: "#1d160f" },
  day: {
    width: 52,
    alignItems: "center",
    gap: 2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: 9,
  },
  dayActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  dayDow: { fontFamily: fonts.sansMedium, fontSize: 10, color: colors.muted, textTransform: "uppercase" },
  dayNum: { fontFamily: fonts.serif, fontSize: 17, color: colors.text },
  dayTextActive: { color: "#1d160f" },
  todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.gold, marginTop: 1 },
  progressCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  progressTitle: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.text },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.chip,
    marginTop: 10,
    overflow: "hidden",
  },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: colors.success },
  scanBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  scanBannerText: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 13, color: colors.text },
  slotCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadows.soft,
  },
  slotHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  timeChip: {
    backgroundColor: colors.chip,
    borderWidth: 1,
    borderColor: colors.borderGold,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  timeChipText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.gold },
  slotName: { flex: 1, fontFamily: fonts.serif, fontSize: 16, color: colors.text },
  scanScreen: { flex: 1, backgroundColor: "#000" },
  scanTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    zIndex: 2,
  },
  scanTitle: { fontFamily: fonts.sansSemiBold, fontSize: 16, color: colors.white },
  scanActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  scanIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.25)",
  },
  scanIconBtnOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  scanClose: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  scanFrame: {
    position: "absolute",
    top: "26%",
    alignSelf: "center",
    width: 250,
    height: 250,
  },
  corner: {
    position: "absolute",
    width: 42,
    height: 42,
    borderColor: colors.gold,
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 14 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 14 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 14 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 14 },
  scanHint: {
    position: "absolute",
    top: "26%",
    alignSelf: "center",
    marginTop: 270,
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
  },
  scanSub: { fontFamily: fonts.sansMedium, fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  resultCard: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    ...shadows.card,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
  },
  resultHeaderText: {
    flex: 1,
    fontFamily: fonts.sansBold,
    fontSize: 15,
    color: "#17120d",
  },
  resultCode: { fontFamily: fonts.sansBold, fontSize: 12, color: "rgba(23,18,13,0.75)", letterSpacing: 0.5 },
  resultBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
  },
  resultAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.chip,
    borderWidth: 1.5,
    borderColor: colors.borderGold,
    alignItems: "center",
    justifyContent: "center",
  },
  resultAvatarText: { fontFamily: fonts.serif, fontSize: 19, color: colors.gold },
  resultGuest: { fontFamily: fonts.serif, fontSize: 20, color: colors.text },
  resultMeta: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.muted, marginTop: 3 },
  resultWarn: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: colors.warning, marginTop: 4 },
  resultActions: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  resultGhostBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderGold,
    borderRadius: radii.pill,
    paddingVertical: 11,
  },
  resultGhostText: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.gold },
  resultPrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    flex: 1.4,
    backgroundColor: colors.gold,
    borderRadius: radii.pill,
    paddingVertical: 11,
  },
  resultPrimaryText: { fontFamily: fonts.sansBold, fontSize: 13, color: "#1d160f" },
});

export default function CheckinsScreen() {
  return (
    <PermissionGate permission="checkins">
      <CheckinsScreenContent />
    </PermissionGate>
  );
}
