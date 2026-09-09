"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  Flashlight,
  Info,
  QrCode,
  XCircle,
} from "lucide-react";

import Icon from "../_ui/Icon";
import {
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Muted,
  Page,
  PageHeader,
  Select,
  Skeleton,
  StatusBadge as UIStatusBadge,
  inputClass,
} from "../_ui";

/* The QR scanner below (ScanModal and friends) is kept exactly as it was —
   it drives camera hardware, torch and device selection, and there is no
   device here to re-test it against. It depends on `clsx` and `Badge`. */

function formatDayTZ(d = new Date(), tz = "Europe/Athens") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}
function clsx(...xs) {
  return xs.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------
   Design Tokens (soft, ambient palette)
-------------------------------------------------------------*/
const colors = {
  card: "bg-white/80 border border-[#e6dfd6] backdrop-blur",
  soft: "bg-[#f4f1ec]",
  accent: "#8b6f47",
  border: "#e6dfd6",
  text: "#5a4a3f",
  sub: "#7a6a5f",
};

/* ------------------------------------------------------------
   Badges & small UI atoms
-------------------------------------------------------------*/
function Badge({ tone = "slate", children, className = "" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    green: "bg-green-100 text-green-700 border-green-200",
    amber: "bg-amber-100 text-amber-900 border-amber-200",
    red: "bg-red-100 text-red-700 border-red-200",
    sky: "bg-sky-100 text-sky-700 border-sky-200",
    violet: "bg-violet-100 text-violet-700 border-violet-200",
    blue: "bg-blue-100 text-blue-700 border-blue-200",
  };
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full border",
        tones[tone] || tones.slate,
        className
      )}
    >
      {children}
    </span>
  );
}
function partySize(b) {
  if (typeof b?.numberOfPeople === "number" && !Number.isNaN(b.numberOfPeople))
    return b.numberOfPeople;
  const a = typeof b?.adultsCount === "number" ? b.adultsCount : 0;
  const k = typeof b?.kidsCount === "number" ? b.kidsCount : 0;
  return a + k > 0 ? a + k : 1;
}
function contactName(pc) {
  if (!pc) return "—";
  if (pc.name) return pc.name;
  if (pc.full_name) return pc.full_name;
  if (pc.firstName || pc.lastName)
    return [pc.firstName, pc.lastName].filter(Boolean).join(" ");
  if (pc.email) return pc.email;
  return "—";
}

function ScanModal({ open, onClose, onDetected }) {
  const videoRef = useRef(null);
  const rafRef = useRef(null);
  const streamRef = useRef(null);
  const controlsRef = useRef(null); // ZXing stop handle
  const detectorRef = useRef(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [engine, setEngine] = useState("auto"); // 'native' | 'zxing'
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState(null);
  const [torchOn, setTorchOn] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const processingRef = useRef(false);
  const lastValRef = useRef("");
  const lastTsRef = useRef(0);
  const COOLDOWN_MS = 2500; // ignore same code while it's in frame

  async function detectTorchSupport() {
    try {
      const stream = videoRef.current?.srcObject || streamRef.current || null;
      const track = stream?.getVideoTracks?.()[0];
      const caps = track?.getCapabilities?.();
      setTorchSupported(!!(caps && caps.torch));
    } catch {
      setTorchSupported(false);
    }
  }

  async function handleDetected(val) {
    if (!val) return;
    const now = Date.now();
    if (processingRef.current) return;
    if (val === lastValRef.current && now - lastTsRef.current < COOLDOWN_MS)
      return;
    processingRef.current = true;
    lastValRef.current = val;
    lastTsRef.current = now;

    try {
      const maybe = onDetected?.(val);
      const res =
        maybe && typeof maybe.then === "function" ? await maybe : maybe;
      const outcome = res?.already
        ? "already"
        : res?.invalid || res?.ok === false
        ? "invalid"
        : "ok";
      if (outcome === "ok") {
        soundSuccess();
        if (navigator.vibrate) navigator.vibrate(60);
        setStatus("Checked in ✓");
      } else if (outcome === "already") {
        soundError();
        if (navigator.vibrate) navigator.vibrate(40);
        setStatus("QR already checked in");
        lastTsRef.current = Date.now();
      } else {
        soundError();
        if (navigator.vibrate) navigator.vibrate(30);
        setStatus("Invalid QR / booking not found");
      }
    } finally {
      setTimeout(() => {
        processingRef.current = false;
      }, 800);
    }
  }

  const formats = ["qr_code", "code_128", "ean_13", "ean_8"];

  function playTone(
    freq = 880,
    durationMs = 120,
    type = "sine",
    volume = 0.22
  ) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = new AC();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      o.connect(g);
      g.connect(ctx.destination);
      const t0 = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(volume, t0 + 0.01);
      o.start();
      const t1 = t0 + durationMs / 1000;
      g.gain.exponentialRampToValueAtTime(0.0001, t1);
      setTimeout(() => {
        try {
          o.stop();
          ctx.close();
        } catch {}
      }, durationMs + 60);
    } catch {}
  }
  function soundSuccess() {
    playTone(880, 80, "sine", 0.25);
    setTimeout(() => playTone(1320, 90, "sine", 0.22), 95);
  }
  function soundError() {
    playTone(220, 140, "square", 0.22);
    setTimeout(() => playTone(180, 160, "sawtooth", 0.2), 130);
  }

  async function ensureHttpsAndPermission() {
    if (location.protocol !== "https:" && location.hostname !== "localhost") {
      throw new Error("Camera requires HTTPS (or localhost).");
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      s.getTracks().forEach((t) => t.stop());
    } catch {
      throw new Error("Camera permission denied or unavailable.");
    }
  }

  async function loadDevices() {
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      const vids = devs.filter((d) => d.kind === "videoinput");
      setDevices(vids);
      const back =
        vids.find((d) => (d.label || "").toLowerCase().includes("back")) ||
        vids[1];
      setDeviceId((d) => d ?? back?.deviceId ?? vids[0]?.deviceId ?? null);
    } catch {
      // silently ignore, error will show from scanner init
    }
  }

  async function startNative() {
    setEngine("native");
    setStatus("Starting camera…");
    try {
      const constraints = {
        audio: false,
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      videoRef.current.muted = true;
      videoRef.current.setAttribute("muted", "true");
      videoRef.current.setAttribute("playsinline", "true");
      await videoRef.current.play();
      await detectTorchSupport();

      const sup = await (window.BarcodeDetector.getSupportedFormats?.() || []);
      const useFormats =
        sup && sup.length ? formats.filter((f) => sup.includes(f)) : formats;
      detectorRef.current = new window.BarcodeDetector({ formats: useFormats });

      setStatus("Scanning…");
      setTimeout(() => {
        try {
          const s = videoRef.current?.srcObject;
          if (s) {
            streamRef.current = s;
            detectTorchSupport();
          }
        } catch {}
      }, 150);

      const loop = async () => {
        if (!detectorRef.current || !videoRef.current) return;
        try {
          const res = await detectorRef.current.detect(videoRef.current);
          if (res && res.length) {
            const val = res[0].rawValue || "";
            if (val) await handleDetected(val);
          }
        } catch {}
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (e) {
      throw new Error(`Native scanner failed: ${e?.message || e}`);
    }
  }

  // Load ZXing via local pkg or UMD
  async function loadZXing() {
    try {
      return await import("@zxing/browser");
    } catch (_) {}
    if (typeof window === "undefined") throw new Error("Client only");
    if (window.ZXing && window.ZXing.BrowserMultiFormatReader)
      return window.ZXing;

    await new Promise((resolve, reject) => {
      const id = "zxing-umd";
      if (document.getElementById(id)) return resolve();
      const s = document.createElement("script");
      s.id = id;
      s.src =
        "https://cdn.jsdelivr.net/npm/@zxing/library@0.20.0/umd/index.min.js";
      s.async = true;
      s.crossOrigin = "anonymous";
      s.referrerPolicy = "no-referrer";
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Failed to load ZXing"));
      document.head.appendChild(s);
    });
    if (!window.ZXing || !window.ZXing.BrowserMultiFormatReader) {
      throw new Error("ZXing UMD loaded but BrowserMultiFormatReader missing");
    }
    return window.ZXing;
  }

  async function startZXing() {
    setEngine("zxing");
    setStatus("Loading scanner…");
    try {
      const ZX = await loadZXing();
      const { BrowserMultiFormatReader, NotFoundException } = ZX;
      if (!BrowserMultiFormatReader)
        throw new Error("ZXing reader unavailable");
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromVideoDevice(
        deviceId || undefined,
        videoRef.current,
        (result, err) => {
          if (result) {
            const txt = result.getText();
            if (txt) handleDetected(txt);
          } else if (
            err &&
            NotFoundException &&
            !(err instanceof NotFoundException)
          ) {
            setError(String(err));
          }
        }
      );
      controlsRef.current = controls;
      setStatus("Scanning…");
      setTimeout(() => {
        try {
          const s = videoRef.current?.srcObject;
          if (s) {
            streamRef.current = s;
            detectTorchSupport();
          }
        } catch {}
      }, 150);
    } catch (e) {
      throw new Error(`ZXing init failed: ${e?.message || e}`);
    }
  }

  function getActiveTrack() {
    const stream = videoRef.current?.srcObject || streamRef.current || null;
    return stream?.getVideoTracks?.()[0] || null;
  }
  async function forceTorchOff() {
    try {
      const track = getActiveTrack();
      const caps = track?.getCapabilities?.();
      if (caps?.torch) {
        await track.applyConstraints({ advanced: [{ torch: false }] });
        await new Promise((r) => setTimeout(r, 60));
      }
    } catch {}
  }
  async function stopAll() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    await forceTorchOff();
    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
      } catch {}
      controlsRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch {}
      videoRef.current.srcObject = null;
      try {
        videoRef.current.removeAttribute("srcObject");
      } catch {}
      try {
        videoRef.current.load?.();
      } catch {}
    }
    try {
      const stream = streamRef.current;
      stream?.getTracks?.().forEach((t) => t.stop());
    } catch {}
    streamRef.current = null;
    detectorRef.current = null;
    setTorchOn(false);
    setTorchSupported(false);
    setStatus("");
  }

  async function startScanner() {
    setError("");
    setStatus("Initializing…");
    await stopAll();
    const hasNative = "BarcodeDetector" in window;
    try {
      await (hasNative ? startNative() : startZXing());
    } catch (e) {
      if (hasNative) {
        try {
          await startZXing();
          return;
        } catch (e2) {
          setError(`Scanner failed: ${e2?.message || e2}`);
          setStatus("");
          return;
        }
      }
      setError(`Scanner failed: ${e?.message || e}`);
      setStatus("");
    }
  }

  async function close() {
    await stopAll();
    onClose?.();
  }

  useEffect(() => {
    if (!open) return;
    const onHide = () => {
      if (document.hidden) stopAll();
    };
    const onPageHide = () => {
      stopAll();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide, { once: true });
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      try {
        await ensureHttpsAndPermission();
        await loadDevices();
        if (!alive) return;
        await startScanner();
      } catch (e) {
        setError(e?.message || String(e));
        setStatus("");
      }
    })();
    return () => {
      alive = false;
      stopAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !deviceId) return;
    setTorchSupported(false);
    setTorchOn(false);
    startScanner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-40 items-end sm:items-center justify-center flex"
          role="dialog"
          aria-modal="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={close}
          />
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 10, opacity: 0, scale: 0.98 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 28,
              mass: 0.7,
            }}
            className={clsx(
              "relative z-10 w-full sm:max-w-2xl mx-auto sm:rounded-3xl sm:shadow-2xl",
              colors.card,
              "bg-[#fdfaf5]"
            )}
          >
            <div className="px-4 py-3 border-b border-[#eee5da] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode size={18} className="opacity-80" />
                <h3 className="font-semibold">Scan QR / Barcode</h3>
              </div>
              <button
                onClick={close}
                className="text-sm rounded-full px-3 py-1 border hover:bg-white"
                style={{ borderColor: colors.border }}
              >
                Close <span className="ml-1 text-xs text-slate-500">⎋ Esc</span>
              </button>
            </div>

            <div className="p-4">
              <div
                className="relative rounded-2xl overflow-hidden border bg-black aspect-[16/10]"
                style={{ borderColor: colors.border }}
              >
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />

                {/* focus frame */}
                <div className="absolute inset-0 pointer-events-none grid place-items-center">
                  <div className="w-[72%] max-w-[560px] aspect-square rounded-3xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.28)]" />
                </div>

                {/* status & controls */}
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2">
                  <span
                    className="text-xs text-white/90 bg-black/45 rounded-full px-2 py-1 border border-white/20"
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    {error
                      ? error
                      : status
                      ? `${status} (${engine})`
                      : "Starting…"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {torchSupported ? (
                      <IconPill
                        onClick={async () => {
                          try {
                            const stream =
                              videoRef.current?.srcObject ||
                              streamRef.current ||
                              null;
                            const track = stream?.getVideoTracks?.()[0];
                            if (!track)
                              return setError("No camera track available.");
                            const caps = track.getCapabilities?.();
                            if (!caps?.torch)
                              return setError(
                                "Torch not supported by this camera."
                              );
                            await track.applyConstraints({
                              advanced: [{ torch: !torchOn }],
                            });
                            setTorchOn((t) => !t);
                          } catch (e) {
                            setError(e?.message || "Failed to toggle torch");
                          }
                        }}
                        title="Toggle flashlight"
                        active={torchOn}
                      >
                        <Flashlight size={14} />{" "}
                        {torchOn ? "Torch On" : "Torch Off"}
                      </IconPill>
                    ) : (
                      <span className="text-xs text-white/70 bg-black/30 rounded-full px-2 py-1 border border-white/10">
                        Torch N/A
                      </span>
                    )}

                    <DeviceSelect
                      devices={devices}
                      deviceId={deviceId}
                      setDeviceId={setDeviceId}
                    />
                  </div>
                </div>
              </div>

              <ManualFallback onDetected={onDetected} />
              {error ? (
                <div className="mt-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-center gap-2">
                  <AlertTriangle size={16} /> {error}
                </div>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function IconPill({ children, onClick, title, active }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={clsx(
        "text-xs text-white rounded-full px-2 py-1 border flex items-center gap-1.5",
        active
          ? "bg-black/70 border-white/30"
          : "bg-black/40 border-white/20 hover:bg-black/50"
      )}
    >
      {children}
    </button>
  );
}

function DeviceSelect({ devices, deviceId, setDeviceId }) {
  if (!devices?.length) return null;
  return (
    <label className="text-xs text-white/90 bg-black/40 rounded-full px-2 py-1 border border-white/20">
      <span className="opacity-80 mr-1 align-middle">
        <Camera size={12} className="inline" /> Cam:
      </span>
      <select
        value={deviceId || ""}
        onChange={(e) => setDeviceId(e.target.value)}
        className="bg-transparent outline-none"
      >
        {devices.map((d, i) => (
          <option key={d.deviceId || i} value={d.deviceId}>
            {d.label || `Camera ${i + 1}`}
          </option>
        ))}
      </select>
    </label>
  );
}

function ManualFallback({ onDetected }) {
  const [val, setVal] = useState("");
  function submit(e) {
    e.preventDefault();
    if (!val.trim()) return;
    onDetected?.(val.trim());
    setVal("");
  }
  return (
    <form onSubmit={submit} className="mt-3 flex items-center gap-2">
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="Or paste / type booking code or URL…"
        className="flex-1 rounded-full border bg-white/80 px-4 py-2 text-sm placeholder:text-[#a09084] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/40"
        style={{ borderColor: colors.border }}
      />
      <button
        className="rounded-full px-3 py-2 text-xs border bg-[#fdfaf5] hover:bg-[#f1ede7]"
        style={{ borderColor: colors.border }}
      >
        Apply
      </button>
    </form>
  );
}

/* ------------------------------------------------------------
   Scan result pop-up
-------------------------------------------------------------*/
function ScanResultPopover({ result, onClose, onUndo, onScroll }) {
  if (!result) return null;
  const icon =
    result.mode === "ok" ? (
      <CheckCircle2 className="w-5 h-5 text-green-700" />
    ) : result.mode === "already" ? (
      <Info className="w-5 h-5 text-amber-700" />
    ) : (
      <XCircle className="w-5 h-5 text-red-700" />
    );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 20, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 10, opacity: 0, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 350, damping: 30, mass: 0.7 }}
        className={clsx(
          "fixed bottom-4 right-4 z-[70] max-w-sm w-[92vw] sm:w-[420px] rounded-2xl shadow-lg",
          colors.card,
          "bg-white/90"
        )}
        role="status"
        aria-live="polite"
      >
        <div className="p-3">
          <div className="flex items-start gap-2">
            {icon}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="font-semibold">
                  {result.mode === "ok"
                    ? "Check-in successful"
                    : result.mode === "already"
                    ? "Already checked-in"
                    : "Invalid code"}
                </p>
                <button
                  onClick={onClose}
                  className="text-xs rounded-full px-2 py-0.5 border bg-white hover:bg-slate-50"
                  style={{ borderColor: colors.border }}
                >
                  Close
                </button>
              </div>

              {result.booking ? (
                <div className="mt-1 text-sm">
                  <div className="font-medium truncate">
                    #{result.id} — {result.booking.name}
                  </div>
                  <div className="mt-0.5 text-xs flex flex-wrap gap-2">
                    <Badge tone="blue">
                      Party{" "}
                      <span className="ml-1 font-semibold">
                        {result.booking.party}
                      </span>
                    </Badge>
                    <Badge tone="sky">
                      {result.booking.experience || "Experience"}
                    </Badge>
                    {result.booking.time ? (
                      <Badge tone="slate">{result.booking.time}</Badge>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="mt-1 text-xs" style={{ color: colors.sub }}>
                  Couldn’t locate booking details for today’s roster.
                </p>
              )}

              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={onScroll}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs border bg-white hover:bg-slate-50"
                  style={{ borderColor: colors.border }}
                >
                  View in list
                </button>
                {result.mode === "ok" ? (
                  <button
                    onClick={onUndo}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs border bg-red-50 text-red-700 hover:bg-red-100 border-red-200"
                  >
                    Undo check-in
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------
   Page
-------------------------------------------------------------*/

/* --------------------------------- page ---------------------------------- */

const STATUS_FILTERS = [
  { value: "all", label: "Everyone" },
  { value: "expected", label: "Not arrived" },
  { value: "checked_in", label: "Arrived" },
  { value: "no_show", label: "No-show" },
];

const isArrived = (b) => String(b.status || "").toLowerCase() === "checked_in";
const isNoShow = (b) => ["no_show", "noshow"].includes(String(b.status || "").toLowerCase());
const isCancelled = (b) => String(b.status || "").toLowerCase() === "cancelled";
const isExpected = (b) => !isArrived(b) && !isNoShow(b) && !isCancelled(b);

const slotTime = (d) => {
  if (!d) return "--:--";
  const t = new Date(d);
  return isNaN(t) ? "--:--" : t.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};

export default function CheckinsPage() {
  const [date, setDate] = useState(() => formatDayTZ(new Date(), "Europe/Athens"));
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [roster, setRoster] = useState(null);
  const [error, setError] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [flashId, setFlashId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const searchRef = useRef(null);
  const rowRefs = useRef({});

  const isToday = date === formatDayTZ(new Date(), "Europe/Athens");

  /* ------------------------------- loading -------------------------------- */
  const load = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/admin/checkins?date=${encodeURIComponent(date)}&tz=Europe/Athens`,
        { cache: "no-store", signal, credentials: "include" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load the roster");
      setRoster(json);
    } catch (e) {
      if (e?.name !== "AbortError") setError(e.message || "Failed to load the roster");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  /* ------------------------------- shortcuts ------------------------------ */
  useEffect(() => {
    const onKey = (e) => {
      const typing = /input|textarea|select/i.test(e.target?.tagName || "");
      if (e.key === "Escape") {
        setScanOpen(false);
        setScanResult(null);
        return;
      }
      if (typing) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        setScanOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* -------------------------------- derived ------------------------------- */
  const slots = useMemo(() => roster?.slots || [], [roster]);

  const filteredSlots = useMemo(() => {
    const q = query.trim().toLowerCase();
    return slots
      .map((slot) => {
        let bookings = slot.bookings || [];
        if (statusFilter === "expected") bookings = bookings.filter(isExpected);
        else if (statusFilter === "checked_in") bookings = bookings.filter(isArrived);
        else if (statusFilter === "no_show") bookings = bookings.filter(isNoShow);

        if (q) {
          bookings = bookings.filter((b) =>
            [
              String(b.id),
              contactName(b.primary_contact),
              b.primary_contact?.email || "",
              b.primary_contact?.phone || "",
              slot.experienceName || "",
              b.status || "",
            ].join(" ").toLowerCase().includes(q)
          );
        }
        return { ...slot, bookings };
      })
      .filter((s) => s.bookings.length || (!query.trim() && statusFilter === "all"));
  }, [slots, query, statusFilter]);

  const totals = useMemo(() => {
    const all = slots.flatMap((s) => s.bookings || []);
    const active = all.filter((b) => !isCancelled(b));
    return {
      bookings: active.length,
      guests: active.reduce((sum, b) => sum + partySize(b), 0),
      arrived: all.filter(isArrived).length,
      arrivedGuests: all.filter(isArrived).reduce((sum, b) => sum + partySize(b), 0),
      noShow: all.filter(isNoShow).length,
      expected: active.filter(isExpected).length,
      capacity: slots.reduce((sum, s) => sum + (s.totalSlots || 0), 0),
      tours: slots.length,
    };
  }, [slots]);

  const progress = totals.bookings ? Math.round((totals.arrived / totals.bookings) * 100) : 0;

  /* -------------------------------- actions ------------------------------- */
  async function mutateBooking(bookingId, action) {
    setBusyId(bookingId);
    try {
      const res = await fetch(`/api/admin/checkins/${bookingId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Update failed");

      setRoster((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          slots: prev.slots.map((s) => ({
            ...s,
            bookings: (s.bookings || []).map((b) =>
              b.id === bookingId ? { ...b, status: json.status } : b
            ),
          })),
        };
      });

      if (json.already) toast(`Booking #${bookingId} was already ${String(json.status).replace(/_/g, " ")}.`);
      else toast.success(`#${bookingId} → ${String(json.status).replace(/_/g, " ")}`);
      return json;
    } catch (e) {
      toast.error(e.message || "Could not update this booking.");
      return null;
    } finally {
      setBusyId(null);
    }
  }

  function extractBookingId(s) {
    if (!s) return null;
    const str = String(s);
    const mUrl = str.match(/\/(?:booking|bookings)\/(\d+)/i);
    if (mUrl) return Number(mUrl[1]);
    const mTag = str.match(/booking[:=\s]+(\d{1,10})/i);
    if (mTag) return Number(mTag[1]);
    const mNum = str.match(/(?:^|[^0-9])(\d{1,10})(?:[^0-9]|$)/);
    return mNum ? Number(mNum[1]) : null;
  }

  function findBookingInRoster(id) {
    for (const slot of slots) {
      for (const b of slot.bookings || []) {
        if (b.id === id) return { booking: b, slot };
      }
    }
    return null;
  }

  function scrollToBooking(id) {
    const el = rowRefs.current[id];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlashId(id);
    setTimeout(() => setFlashId((cur) => (cur === id ? null : cur)), 2200);
  }

  async function handleDetected(raw) {
    const id = extractBookingId(raw);
    if (!id) return toast.error("That code doesn't contain a booking reference.");

    const found = findBookingInRoster(id);
    if (!found) {
      toast.error(`Booking #${id} isn't on today's roster.`);
      setScanResult({ id, mode: "bad", booking: null });
      return;
    }

    const { booking, slot } = found;
    const card = {
      name: contactName(booking.primary_contact),
      party: partySize(booking),
      experience: slot.experienceName,
      time: slotTime(slot.date),
    };

    if (isArrived(booking)) {
      setScanResult({ id, mode: "already", booking: card });
      scrollToBooking(id);
      return;
    }

    const json = await mutateBooking(id, "checkin");
    setScanResult({
      id,
      mode: json ? (json.already ? "already" : "ok") : "bad",
      booking: card,
    });
    scrollToBooking(id);
  }

  const shiftDay = (delta) => {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + delta);
    setDate(formatDayTZ(d, "Europe/Athens"));
  };

  /* --------------------------------- view --------------------------------- */
  return (
    <Page>
      <PageHeader
        eyebrow="Operations"
        title="Check-ins"
        description={
          loading
            ? "Loading today's roster…"
            : `${totals.tours} tour${totals.tours === 1 ? "" : "s"} · ${totals.guests} guest${totals.guests === 1 ? "" : "s"} expected`
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => load()} disabled={loading}>
              <Icon name="clock" size={15} /> Refresh
            </Button>
            <Button variant="primary" onClick={() => setScanOpen(true)}>
              <Icon name="grid" size={15} /> Scan ticket
            </Button>
          </>
        }
      />

      {/* date bar */}
      <Card className="mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="icon" onClick={() => shiftDay(-1)} aria-label="Previous day">
            ‹
          </Button>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={`${inputClass} h-10 !w-auto`}
          />
          <Button variant="secondary" size="icon" onClick={() => shiftDay(1)} aria-label="Next day">
            ›
          </Button>
          <Button
            variant={isToday ? "dark" : "secondary"}
            onClick={() => setDate(formatDayTZ(new Date(), "Europe/Athens"))}
          >
            Today
          </Button>

          <div className="ml-auto flex flex-1 flex-wrap items-center justify-end gap-2">
            <div className="relative min-w-[200px] flex-1 sm:max-w-[320px]">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#b0a294]">
                <Icon name="search" size={16} />
              </span>
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search guest, email, phone or #id"
                className={`${inputClass} h-10 pl-9 ${query ? "pr-9" : "pr-12"}`}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                {query ? (
                  <button onClick={() => setQuery("")} aria-label="Clear search"
                    className="rounded-md p-1 text-[#9a8c7e] hover:bg-[#f2ede4]">
                    <Icon name="x" size={14} />
                  </button>
                ) : (
                  <kbd className="hidden rounded border border-[#e6e0d6] bg-[#faf8f4] px-1.5 py-0.5 text-[10px] text-[#b0a294] sm:block">/</kbd>
                )}
              </div>
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 !w-auto min-w-[150px]"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {/* progress */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="py-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9a8c7e]">Arrived</p>
          <p className="mt-1 font-serif text-[20px] text-[#2a211a]">
            {totals.arrived}<span className="text-[14px] text-[#9a8c7e]"> / {totals.bookings}</span>
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#efe9df]">
            <div className="h-full rounded-full bg-[#3f6b3f] transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </Card>
        <StatBox label="Still expected" value={totals.expected} accent={totals.expected > 0 ? "warn" : undefined} />
        <StatBox label="No-shows" value={totals.noShow} accent={totals.noShow > 0 ? "danger" : undefined} />
        <StatBox label="Guests on site" value={`${totals.arrivedGuests} / ${totals.guests}`} />
      </div>

      {/* roster */}
      {error ? (
        <Card>
          <ErrorNote>{error}</ErrorNote>
          <Button className="mt-3" variant="secondary" onClick={() => load()}>Try again</Button>
        </Card>
      ) : loading ? (
        <div className="space-y-4">
          {[0, 1].map((i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : !filteredSlots.length ? (
        <Card>
          <EmptyState
            icon={<Icon name="check" size={20} />}
            title={slots.length ? "Nothing matches" : "No tours scheduled"}
            description={
              slots.length
                ? "No guests on this day match your search or filter."
                : `Nothing is scheduled for ${date}.`
            }
            action={
              slots.length ? (
                <Button variant="secondary" onClick={() => { setQuery(""); setStatusFilter("all"); }}>
                  Clear filters
                </Button>
              ) : null
            }
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {filteredSlots.map((slot) => {
            const all = slot.bookings || [];
            const active = all.filter((b) => !isCancelled(b));
            const arrived = all.filter(isArrived).length;
            const guests = active.reduce((sum, b) => sum + partySize(b), 0);
            const pct = active.length ? Math.round((arrived / active.length) * 100) : 0;
            const remaining = active.filter(isExpected);

            return (
              <Card key={slot.id} padded={false} className="overflow-hidden">
                <div className="flex flex-wrap items-center gap-3 border-b border-[#e6e0d6] bg-[#fdfbf7] px-5 py-3.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-serif text-[18px] text-[#2a211a]">{slotTime(slot.date)}</span>
                      <span className="truncate text-[14px] font-medium text-[#6b5c4d]">
                        {slot.experienceName || "Experience"}
                      </span>
                      {slot.isCancelled ? <Badge tone="red">Cancelled</Badge> : null}
                    </div>
                    <Muted className="mt-0.5 text-[12px]">
                      {guests} guest{guests === 1 ? "" : "s"} · {active.length} booking
                      {active.length === 1 ? "" : "s"}
                      {slot.totalSlots ? ` · capacity ${slot.totalSlots}` : ""}
                    </Muted>
                  </div>

                  <div className="ml-auto flex items-center gap-3">
                    <div className="hidden w-28 sm:block">
                      <div className="h-1.5 overflow-hidden rounded-full bg-[#efe9df]">
                        <div className="h-full rounded-full bg-[#3f6b3f] transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <span className="text-[12.5px] font-semibold text-[#6b5c4d]">
                      {arrived}/{active.length} in
                    </span>
                    {remaining.length ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          if (!window.confirm(`Check in all ${remaining.length} remaining guests for this tour?`)) return;
                          for (const b of remaining) await mutateBooking(b.id, "checkin");
                        }}
                      >
                        <Icon name="check" size={14} /> Check in all
                      </Button>
                    ) : null}
                  </div>
                </div>

                <ul className="divide-y divide-[#f0ebe2]">
                  {all.map((b) => {
                    const arrivedNow = isArrived(b);
                    const noShow = isNoShow(b);
                    const cancelled = isCancelled(b);
                    const pc = b.primary_contact || {};
                    return (
                      <li
                        key={b.id}
                        ref={(el) => { rowRefs.current[b.id] = el; }}
                        className={clsx(
                          "flex flex-wrap items-center gap-3 px-5 py-3 transition-colors",
                          flashId === b.id && "bg-[#f4f9f4]",
                          cancelled && "opacity-50"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={`/admin/bookings/${b.id}`}
                              className="font-semibold text-[#2a211a] hover:text-[#8b6f47] hover:underline"
                            >
                              {contactName(pc)}
                            </Link>
                            <span className="rounded-full bg-[#f2ede4] px-2 py-0.5 text-[11px] font-semibold text-[#6b5c4d]">
                              {partySize(b)} pax
                            </span>
                            <UIStatusBadge status={b.status} />
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11.5px] text-[#9a8c7e]">
                            <span>#{b.id}</span>
                            {pc.phone ? (
                              <a href={`tel:${pc.phone}`} className="hover:text-[#8b6f47] hover:underline">{pc.phone}</a>
                            ) : null}
                            {pc.email ? (
                              <a href={`mailto:${pc.email}`} className="truncate hover:text-[#8b6f47] hover:underline">{pc.email}</a>
                            ) : null}
                          </div>
                        </div>

                        {cancelled ? null : (
                          <div className="flex items-center gap-1.5">
                            {arrivedNow || noShow ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busyId === b.id}
                                onClick={() => mutateBooking(b.id, "undo")}
                              >
                                Undo
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busyId === b.id}
                                onClick={() => mutateBooking(b.id, "no_show")}
                                title="Mark as a no-show"
                              >
                                No-show
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant={arrivedNow ? "secondary" : "primary"}
                              disabled={busyId === b.id || arrivedNow}
                              onClick={() => mutateBooking(b.id, "checkin")}
                            >
                              <Icon name="check" size={14} />
                              {arrivedNow ? "Checked in" : busyId === b.id ? "…" : "Check in"}
                            </Button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
        </div>
      )}

      <Muted className="mt-5 text-center text-[11.5px]">
        Press <kbd className="rounded border border-[#e6e0d6] bg-white px-1 py-0.5 text-[10px]">S</kbd> to scan ·{" "}
        <kbd className="rounded border border-[#e6e0d6] bg-white px-1 py-0.5 text-[10px]">/</kbd> to search
      </Muted>

      <ScanModal open={scanOpen} onClose={() => setScanOpen(false)} onDetected={handleDetected} />
      <ScanResultPopover
        result={scanResult}
        onClose={() => setScanResult(null)}
        onUndo={async () => {
          if (!scanResult) return;
          await mutateBooking(scanResult.id, "undo");
          setScanResult(null);
        }}
        onScroll={() => scanResult && scrollToBooking(scanResult.id)}
      />
    </Page>
  );
}

function StatBox({ label, value, accent }) {
  const color = accent === "danger" ? "text-[#a33c22]" : accent === "warn" ? "text-[#8a6412]" : "text-[#2a211a]";
  return (
    <Card className="py-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9a8c7e]">{label}</p>
      <p className={`mt-1 font-serif text-[20px] ${color}`}>{value}</p>
    </Card>
  );
}
