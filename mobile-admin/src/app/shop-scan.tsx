import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PermissionGate } from "@/components/access";
import { PressableScale } from "@/components/premium";
import { Badge, Button, Eyebrow, Muted, Serif } from "@/components/ui";
import { colors, fonts, radii, spacing } from "@/constants/theme";
import { api } from "@/lib/api";
import { moneyCents } from "@/lib/format";
import type { ShopProductRow } from "@/lib/types";

type Mode = "look" | "in" | "out";

const MODES: { key: Mode; label: string; hint: string }[] = [
  { key: "look", label: "Look up", hint: "Read only — stock is not touched." },
  { key: "in", label: "Receiving", hint: "Each scan adds to stock." },
  { key: "out", label: "Picking", hint: "Each scan takes off stock." },
];

type Entry = {
  at: Date;
  ok: boolean;
  title: string;
  detail: string;
};

export default function ShopScanScreen() {
  return (
    <PermissionGate permission="eshop">
      <ShopScan />
    </PermissionGate>
  );
}

function ShopScan() {
  const insets = useSafeAreaInsets();
  useKeepAwake();

  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<Mode>("look");
  const [step, setStep] = useState("1");
  const [torchOn, setTorchOn] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [product, setProduct] = useState<ShopProductRow | null>(null);
  const [miss, setMiss] = useState<string | null>(null);
  const [history, setHistory] = useState<Entry[]>([]);
  const [manual, setManual] = useState("");
  const [flash, setFlash] = useState<"ok" | "bad" | null>(null);

  // Reuse the check-in tones — the same phone, the same noisy room.
  const okSound = useAudioPlayer(require("../../assets/sounds/checkin-success.wav"));
  const errSound = useAudioPlayer(require("../../assets/sounds/checkin-error.wav"));

  useEffect(() => {
    // Staff keep the phone on silent; these tones still need to be audible.
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  const playTone = useCallback(
    (kind: "ok" | "bad") => {
      if (!soundOn) return;
      const player = kind === "ok" ? okSound : errSound;
      // seekTo is async — play() on the next line leaves the player parked at
      // the end of the previous sound and every scan after the first is silent.
      void (async () => {
        try {
          await player.seekTo(0);
          player.play();
        } catch {
          // audio must never break a scan
        }
      })();
    },
    [soundOn, okSound, errSound],
  );

  const lastScan = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );

  const signal = useCallback(
    (kind: "ok" | "bad") => {
      playTone(kind);
      Haptics.notificationAsync(
        kind === "ok"
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Error,
      ).catch(() => {});
      setFlash(kind);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlash(null), 320);
    },
    [playTone],
  );

  const push = useCallback((entry: Omit<Entry, "at">) => {
    setHistory((h) => [{ ...entry, at: new Date() }, ...h].slice(0, 30));
  }, []);

  const handleCode = useCallback(
    async (raw: string) => {
      const code = String(raw ?? "").trim();
      if (!code || busy) return;

      // The camera sees the same barcode many times a second.
      const now = Date.now();
      if (lastScan.current.code === code && now - lastScan.current.at < 1500) return;
      lastScan.current = { code, at: now };

      setBusy(true);
      try {
        const res = await api.shopLookup(code);
        if (!res.product) {
          signal("bad");
          setProduct(null);
          setMiss(code);
          push({ ok: false, title: code, detail: "No product with that code" });
          return;
        }

        const found = res.product;
        setMiss(null);

        if (mode === "look") {
          signal("ok");
          setProduct(found);
          push({ ok: true, title: found.title, detail: `${found.stock_qty} in stock` });
          return;
        }

        const delta = (mode === "in" ? 1 : -1) * Math.max(1, Number(step) || 1);
        const next = Math.max(0, Number(found.stock_qty || 0) + delta);
        const updated = await api.shopSetStock(found.id, next);
        signal("ok");
        setProduct({ ...found, ...updated, stock_qty: next });
        push({
          ok: true,
          title: found.title,
          detail: `${found.stock_qty} → ${next}`,
        });
      } catch (e) {
        signal("bad");
        push({
          ok: false,
          title: code,
          detail: e instanceof Error ? e.message : "Lookup failed",
        });
      } finally {
        setBusy(false);
      }
    },
    [busy, mode, step, signal, push],
  );

  if (!permission) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.screen, styles.center, { padding: spacing.xl }]}>
        <Ionicons name="camera-outline" size={30} color={colors.gold} />
        <Serif style={{ fontSize: 21, textAlign: "center", marginTop: spacing.md }}>
          Camera access needed
        </Serif>
        <Muted style={{ textAlign: "center", marginTop: spacing.sm }}>
          The scanner reads product barcodes with the camera. You can still type a code by
          hand below.
        </Muted>
        <Button
          title="Allow camera"
          onPress={requestPermission}
          style={{ marginTop: spacing.lg, alignSelf: "stretch" }}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.cameraWrap}>
        <CameraView
          style={StyleSheet.absoluteFill}
          enableTorch={torchOn}
          barcodeScannerSettings={{
            barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "qr"],
          }}
          onBarcodeScanned={({ data }) => handleCode(data)}
        />

        {flash ? (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor:
                  flash === "ok" ? "rgba(127,176,105,0.35)" : "rgba(217,107,83,0.4)",
              },
            ]}
          />
        ) : null}

        <View style={[styles.camTop, { paddingTop: insets.top + 8 }]}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.camBtn}
          >
            <Ionicons name="chevron-back" size={20} color={colors.white} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setTorchOn((v) => !v);
            }}
            accessibilityRole="button"
            accessibilityLabel={torchOn ? "Turn flashlight off" : "Turn flashlight on"}
            style={[styles.camBtn, torchOn && styles.camBtnOn]}
          >
            <Ionicons
              name={torchOn ? "flashlight" : "flashlight-outline"}
              size={19}
              color={torchOn ? colors.bg : colors.white}
            />
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setSoundOn((v) => !v);
            }}
            accessibilityRole="button"
            accessibilityLabel={soundOn ? "Mute scan sounds" : "Unmute scan sounds"}
            style={styles.camBtn}
          >
            <Ionicons
              name={soundOn ? "volume-high" : "volume-mute"}
              size={19}
              color={colors.white}
            />
          </Pressable>
        </View>

        <View pointerEvents="none" style={styles.reticle} />

        {busy ? (
          <View style={styles.busyPill}>
            <ActivityIndicator color={colors.bg} size="small" />
          </View>
        ) : null}
      </View>

      <ScrollView
        style={styles.sheet}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* mode */}
        <View style={styles.modeRow}>
          {MODES.map((m) => (
            <Pressable
              key={m.key}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setMode(m.key);
              }}
              style={[styles.modeBtn, mode === m.key && styles.modeBtnOn]}
            >
              <Text style={[styles.modeText, mode === m.key && styles.modeTextOn]}>
                {m.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.hintRow}>
          <Muted style={{ flex: 1, fontSize: 12 }}>
            {MODES.find((m) => m.key === mode)!.hint}
          </Muted>
          {mode !== "look" ? (
            <View style={styles.stepBox}>
              <Text style={styles.stepLabel}>per scan</Text>
              <TextInput
                value={step}
                onChangeText={(t) => setStep(t.replace(/[^0-9]/g, ""))}
                keyboardType="number-pad"
                accessibilityLabel="Units per scan"
                style={styles.stepInput}
              />
            </View>
          ) : null}
        </View>

        {/* result */}
        {product ? (
          <PressableScale
            style={styles.resultCard}
            onPress={() => router.push("/shop-products" as never)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.resultTitle} numberOfLines={2}>
                {product.title}
              </Text>
              <Muted style={{ fontSize: 12, marginTop: 2 }}>
                {moneyCents(product.price_cents, product.currency)}
                {product.sku_code ? ` · ${product.sku_code}` : ""}
              </Muted>
              {product.barcode ? (
                <Text style={styles.mono}>{product.barcode}</Text>
              ) : null}
              <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
                <Badge
                  label={product.active ? "Live" : "Hidden"}
                  tone={product.active ? "success" : "neutral"}
                />
                {product.stock_qty === 0 ? <Badge label="Sold out" tone="warning" /> : null}
              </View>
            </View>
            <View style={styles.stockBox}>
              <Text style={styles.stockNum}>{product.stock_qty}</Text>
              <Text style={styles.stockCap}>in stock</Text>
            </View>
          </PressableScale>
        ) : miss ? (
          <View style={styles.missCard}>
            <Ionicons name="help-circle-outline" size={18} color={colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.missTitle}>Nothing matched</Text>
              <Text style={styles.mono}>{miss}</Text>
              <Muted style={{ fontSize: 12, marginTop: 4 }}>
                Open the product in the web console and paste this code into its Barcode
                box to attach it.
              </Muted>
            </View>
          </View>
        ) : null}

        {/* manual entry */}
        <View style={styles.manualRow}>
          <TextInput
            value={manual}
            onChangeText={setManual}
            placeholder="Type a barcode, SKU or name"
            placeholderTextColor={colors.faint}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => {
              handleCode(manual);
              setManual("");
            }}
            style={styles.manualInput}
          />
          <Button
            title="Find"
            variant="ghost"
            onPress={() => {
              handleCode(manual);
              setManual("");
            }}
            style={{ paddingHorizontal: 18, minHeight: 44 }}
          />
        </View>

        {/* history */}
        {history.length ? (
          <View style={{ marginTop: spacing.lg }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Eyebrow style={{ flex: 1 }}>
                This session · {history.length}
              </Eyebrow>
              <Pressable onPress={() => setHistory([])} hitSlop={8}>
                <Text style={styles.clear}>Clear</Text>
              </Pressable>
            </View>
            <View style={{ marginTop: spacing.sm, gap: 4 }}>
              {history.map((h, i) => (
                <View key={`${h.title}-${i}`} style={styles.histRow}>
                  <Ionicons
                    name={h.ok ? "checkmark-circle" : "alert-circle"}
                    size={15}
                    color={h.ok ? colors.success : colors.danger}
                  />
                  <Text style={styles.histTitle} numberOfLines={1}>
                    {h.title}
                  </Text>
                  <Text style={styles.histDetail}>{h.detail}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { justifyContent: "center", alignItems: "center" },

  cameraWrap: { height: "38%", backgroundColor: "#000", overflow: "hidden" },
  camTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: spacing.md,
  },
  camBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  camBtnOn: { backgroundColor: colors.sand },
  reticle: {
    position: "absolute",
    alignSelf: "center",
    top: "28%",
    width: "62%",
    height: "44%",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.65)",
    borderRadius: radii.md,
  },
  busyPill: {
    position: "absolute",
    bottom: 12,
    alignSelf: "center",
    backgroundColor: colors.sand,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },

  sheet: { flex: 1 },

  modeRow: {
    flexDirection: "row",
    backgroundColor: colors.chip,
    borderRadius: radii.md,
    padding: 3,
    gap: 3,
  },
  modeBtn: { flex: 1, paddingVertical: 9, borderRadius: radii.sm, alignItems: "center" },
  modeBtnOn: { backgroundColor: colors.surfaceHigh },
  modeText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.muted },
  modeTextOn: { color: colors.text },

  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  stepBox: { alignItems: "center" },
  stepLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.faint,
  },
  stepInput: {
    width: 56,
    textAlign: "center",
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingVertical: 6,
    marginTop: 2,
  },

  resultCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderGold,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  resultTitle: { fontFamily: fonts.serifRegular, fontSize: 18, color: colors.text },
  mono: { fontFamily: "Courier", fontSize: 12, color: colors.muted, marginTop: 3 },
  stockBox: { alignItems: "center", minWidth: 64 },
  stockNum: { fontFamily: fonts.serif, fontSize: 30, color: colors.gold },
  stockCap: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.faint,
  },

  missCard: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.warningSoft,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  missTitle: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.text },

  manualRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  manualInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.text,
  },

  clear: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.gold },
  histRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  histTitle: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 13, color: colors.text },
  histDetail: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted },
});
