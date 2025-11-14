"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

import {
  QrCode,
  Search,
  CalendarDays,
  CheckCircle2,
  XCircle,
  RotateCcw,
  AlertTriangle,
  Camera,
  Flashlight,
  Check,
  User,
  Users,
  Info,
} from "lucide-react";

/* ------------------------------------------------------------
   Utilities
-------------------------------------------------------------*/
/** Format Date -> YYYY-MM-DD in Europe/Athens */
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
function StatusBadge({ status }) {
  const s = (status || "").toLowerCase();
  if (s === "checked_in") return <Badge tone="green">Checked-in</Badge>;
  if (s === "completed") return <Badge tone="violet">Completed</Badge>;
  if (s === "approved" || s === "converted")
    return <Badge tone="sky">Approved</Badge>;
  if (s === "pending") return <Badge tone="amber">Pending</Badge>;
  if (s === "no_show" || s === "noshow")
    return <Badge tone="red">No-show</Badge>;
  if (s === "cancelled") return <Badge tone="red">Cancelled</Badge>;
  return <Badge>Confirmed</Badge>;
}
function Kbd({ children }) {
  return (
    <kbd className="px-1.5 py-0.5 rounded-md border border-slate-300 text-[10px] font-mono bg-white/70">
      {children}
    </kbd>
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

/* ------------------------------------------------------------
   Toasts (animated)
-------------------------------------------------------------*/
function useToasts() {
  const [toasts, setToasts] = useState([]);
  function pushToast(msg, tone = "default", ms = 2400) {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, tone }]);
    if (ms)
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ms);
  }
  return {
    toasts,
    pushToast,
    remove: (id) => setToasts((t) => t.filter((x) => x.id !== id)),
  };
}
function Toasts({ toasts, remove }) {
  return (
    <div className="fixed top-3 right-3 z-[60] space-y-2" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 30,
              mass: 0.6,
            }}
            role="status"
            className={clsx(
              "rounded-xl px-3 py-2 text-sm shadow border backdrop-blur bg-white/90 flex items-center gap-2 cursor-pointer",
              t.tone === "ok" && "border-green-200 text-green-800",
              t.tone === "err" && "border-red-200 text-red-700"
            )}
            style={
              !t.tone || t.tone === "default"
                ? { borderColor: colors.border, color: colors.text }
                : undefined
            }
            onClick={() => remove(t.id)}
          >
            {t.tone === "ok" ? (
              <Check size={14} />
            ) : t.tone === "err" ? (
              <AlertTriangle size={14} />
            ) : null}
            <span>{t.msg}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------
   Scanner Modal (refined UI + safer lifecycle)
-------------------------------------------------------------*/
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
export default function CheckinsPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const [date, setDate] = useState(
    () => sp.get("date") || formatDayTZ(new Date())
  );
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [roster, setRoster] = useState(null); // { slots: [...], totals: {...} }
  const [error, setError] = useState("");
  const [scanOpen, setScanOpen] = useState(false);

  // scan result + row flash highlight
  const [scanResult, setScanResult] = useState(null);
  const [flashId, setFlashId] = useState(null);

  const searchRef = useRef(null);
  const { toasts, pushToast, remove } = useToasts();

  const jumpToToday = () => setDate(formatDayTZ(new Date()));

  // URL sync
  useEffect(() => {
    const p = new URLSearchParams(Array.from(sp.entries()));
    p.set("date", date);
    router.replace(`/admin/checkins?${p.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      const target = e.target;
      const tag = target?.tagName;
      const isInput =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        target?.isContentEditable === true;

      const key = e.key;

      // global shortcuts should not fire while typing
      if (isInput) {
        if (key === "Escape" && scanOpen) {
          e.stopPropagation();
          setScanOpen(false);
        }
        return;
      }

      if (key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }

      if (key.toLowerCase() === "s") {
        e.preventDefault();
        setScanOpen(true);
      }

      if (key.toLowerCase() === "t") {
        e.preventDefault();
        jumpToToday();
      }

      if (key === "Escape") {
        setScanOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scanOpen]);

  // Data loading
  useEffect(() => {
    let abort = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(
          `/api/admin/checkins?date=${encodeURIComponent(
            date
          )}&tz=Europe/Athens`,
          {
            cache: "no-store",
          }
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load roster");
        if (!abort) setRoster(json);
      } catch (e) {
        if (!abort) setError(e.message || "Failed to load roster");
      } finally {
        if (!abort) setLoading(false);
      }
    }
    load();
    return () => {
      abort = true;
    };
  }, [date]);

  const filteredSlots = useMemo(() => {
    if (!roster?.slots) return [];
    const q = query.trim().toLowerCase();
    if (!q) return roster.slots;
    return roster.slots
      .map((slot) => {
        const bookings = (slot.bookings || []).filter((b) => {
          const hay = [
            String(b.id),
            b.primary_contact?.name || "",
            b.primary_contact?.email || "",
            b.primary_contact?.phone || "",
            b.experienceName || "",
            b.status || "",
          ]
            .join(" ")
            .toLowerCase();
          return hay.includes(q);
        });
        return { ...slot, bookings };
      })
      .filter((s) => s.bookings.length);
  }, [roster, query]);

  async function mutateBooking(bookingId, action) {
    try {
      const res = await fetch(`/api/admin/checkins/${bookingId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Update failed");

      // Optimistic local patch
      setRoster((prev) => {
        if (!prev) return prev;
        const slots = prev.slots.map((s) => {
          const books = (s.bookings || []).map((b) =>
            b.id === bookingId ? { ...b, status: json.status } : b
          );
          return { ...s, bookings: books };
        });
        return { ...prev, slots };
      });
      pushToast(
        `Booking #${bookingId} → ${json.status.replace("_", " ")}`,
        "ok"
      );
    } catch (e) {
      pushToast(e.message || "Failed to update", "err");
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

  const totals = useMemo(() => {
    const s = roster?.slots || [];
    const all = s.flatMap((x) => x.bookings || []);
    const count = all.length;
    const checked = all.filter(
      (b) => (b.status || "").toLowerCase() === "checked_in"
    ).length;
    const noshow = all.filter(
      (b) =>
        (b.status || "").toLowerCase() === "no_show" ||
        (b.status || "").toLowerCase() === "noshow"
    ).length;
    const cap = (s || []).reduce((sum, x) => sum + (x.totalSlots || 0), 0);
    const resv = all
      .filter((b) => !["cancelled"].includes((b.status || "").toLowerCase()))
      .reduce((sum, b) => sum + partySize(b), 0);
    return { count, checked, noshow, capacity: cap, reserved: resv };
  }, [roster]);

  // helpers for scan result
  function findBookingInRoster(id) {
    const slots = roster?.slots || [];
    for (const slot of slots) {
      for (const b of slot.bookings || []) {
        if (b.id === id) {
          return {
            slot,
            booking: b,
          };
        }
      }
    }
    return { slot: null, booking: null };
  }

  function makeScanResult(mode, id) {
    const { slot, booking } = findBookingInRoster(id);
    const info =
      slot && booking
        ? {
            id,
            booking: {
              name: contactName(booking.primary_contact),
              party: partySize(booking),
              experience: slot.experienceName,
              time: new Date(slot.date).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              }),
            },
            mode,
          }
        : { id, booking: null, mode };
    return info;
  }

  function flashBooking(id) {
    setFlashId(id);
    setTimeout(() => setFlashId(null), 2500);
  }

  function scrollToBooking(id) {
    const el =
      document.querySelector(`[data-booking-id="${id}"]`) ||
      document.querySelector(`[data-booking-card="${id}"]`);
    if (el?.scrollIntoView) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    flashBooking(id);
  }

  // Auto-hide scan result after a few seconds
  useEffect(() => {
    if (!scanResult) return;
    const t = setTimeout(() => setScanResult(null), 5500);
    return () => clearTimeout(t);
  }, [scanResult]);

  async function onScan(text) {
    const id = extractBookingId(text);
    if (!id) {
      pushToast("Invalid code", "err");
      setScanResult({ mode: "invalid", id, booking: null });
      return { invalid: true };
    }

    const alreadyLocal = !!(roster?.slots || [])
      .flatMap((s) => s.bookings || [])
      .find(
        (b) => b.id === id && String(b.status).toLowerCase() === "checked_in"
      );
    if (alreadyLocal) {
      const r = makeScanResult("already", id);
      setScanResult(r);
      scrollToBooking(id);
      return { already: true };
    }

    const res = await fetch(`/api/admin/checkins/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "checkin" }),
    });

    let json = {};
    try {
      json = await res.json();
    } catch {}

    if (!res.ok) {
      pushToast("Invalid booking or not today", "err");
      setScanResult({ mode: "invalid", id, booking: null });
      return { invalid: true };
    }
    if (json.already) {
      pushToast(`Booking #${id} already checked in`, "err");
      const r = makeScanResult("already", id);
      setScanResult(r);
      scrollToBooking(id);
      return { already: true };
    }

    // Optimistic roster patch for checked_in
    setRoster((prev) => {
      if (!prev) return prev;
      const slots = prev.slots.map((s) => {
        const books = (s.bookings || []).map((b) =>
          b.id === id ? { ...b, status: "checked_in" } : b
        );
        return { ...s, bookings: books };
      });
      return { ...prev, slots };
    });
    pushToast(`Booking #${id} → checked in`, "ok");

    const r = makeScanResult("ok", id);
    setScanResult(r);
    scrollToBooking(id);
    return { ok: true };
  }

  return (
    <div
      className={clsx("min-h-screen", colors.soft)}
      style={{ color: colors.text }}
    >
      <Toasts toasts={toasts} remove={remove} />

      {/* Scan result popover */}
      <ScanResultPopover
        result={scanResult}
        onClose={() => setScanResult(null)}
        onUndo={() => {
          if (!scanResult?.id) return;
          mutateBooking(scanResult.id, "undo");
          setScanResult(null);
          setTimeout(() => scrollToBooking(scanResult.id), 250);
        }}
        onScroll={() => {
          if (!scanResult?.id) return;
          scrollToBooking(scanResult.id);
        }}
      />

      <div className="mx-auto max-w-6xl px-6 py-6">
        {/* Header / Toolbar */}
        <div
          className={clsx(
            "mb-4 -mx-2 sm:-mx-4 px-2 sm:px-4 py-3 rounded-2xl border",
            "bg-gradient-to-r from-[#f4f1ec] via-[#fff8ef] to-[#f4f1ec]"
          )}
          style={{ borderColor: colors.border }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-serif tracking-tight">
                Check-ins
              </h1>
              <p className="text-sm" style={{ color: colors.sub }}>
                Scan or mark arrivals for today’s slots.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div
                className="flex items-center gap-2 rounded-full border px-3 py-1.5 bg-white/70"
                style={{ borderColor: colors.border }}
              >
                <CalendarDays size={16} className="opacity-70" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-transparent text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={jumpToToday}
                  className="text-[11px] px-2 py-0.5 rounded-full border hover:bg-white"
                  style={{ borderColor: colors.border }}
                  title="Jump to today (T)"
                >
                  Today
                </button>
              </div>

              <div className="relative">
                <Search
                  className="absolute left-3 top-2.5 h-4 w-4"
                  style={{ color: colors.sub }}
                  aria-hidden
                />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search guest, booking id, email…"
                  className="w-64 rounded-full border bg-white/80 backdrop-blur px-9 py-2 text-sm placeholder:text-[#a09084] focus:outline-none focus:ring-2"
                  style={{
                    borderColor: colors.border,
                    boxShadow: "0 0 0 2px transparent",
                    outlineColor: colors.accent,
                  }}
                />
                {query ? (
                  <button
                    onClick={() => setQuery("")}
                    className="absolute right-2 top-1.5 text-xs px-2 py-0.5 rounded-full border bg-white/70 hover:bg-white"
                    style={{ borderColor: colors.border }}
                    title="Clear"
                  >
                    Clear
                  </button>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => setScanOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 border text-white hover:brightness-110 transition text-xs shadow-sm"
                style={{
                  borderColor: colors.border,
                  backgroundColor: colors.accent,
                }}
                title="Open camera scanner (S)"
              >
                <QrCode size={14} /> Scan
              </button>
            </div>
          </div>
          <div className="mt-2 text-xs flex items-center gap-3 opacity-80">
            <span>
              Shortcuts: <Kbd>/</Kbd> focus search · <Kbd>S</Kbd> scan ·{" "}
              <Kbd>T</Kbd> today
            </span>
          </div>
        </div>

        {/* Totals */}
        <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard
            label="Bookings"
            value={totals.count}
            icon={<Users className="w-4 h-4" />}
          />
          <SummaryCard
            label="Checked-in"
            value={totals.checked}
            tone="green"
            icon={<CheckCircle2 className="w-4 h-4" />}
          />
          <SummaryCard
            label="No-shows"
            value={totals.noshow}
            tone="red"
            icon={<XCircle className="w-4 h-4" />}
          />
          <SummaryCard
            label="Reserved / Capacity"
            value={`${totals.reserved} / ${totals.capacity}`}
            tone="blue"
            icon={<User className="w-4 h-4" />}
          />
        </div>

        {/* Error */}
        {error ? (
          <div
            className="mb-4 flex items-center gap-2 rounded-xl border bg-red-50 text-red-700 px-3 py-2 text-sm"
            style={{ borderColor: "#fecaca" }}
          >
            <AlertTriangle size={16} /> {error}
          </div>
        ) : null}

        {/* Loading */}
        {loading ? (
          <div className="grid gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-28 rounded-2xl bg-gradient-to-tr from-[#ebe6df] to-[#f9f6f2] animate-pulse border"
                style={{ borderColor: colors.border }}
              />
            ))}
          </div>
        ) : null}

        {/* Empty state */}
        {!loading && filteredSlots.length === 0 ? (
          <div
            className="text-center py-12 rounded-2xl border bg-white/60"
            style={{ borderColor: colors.border }}
          >
            <QrCode className="mx-auto mb-2 opacity-60" />
            <p className="text-sm" style={{ color: colors.sub }}>
              No bookings for this date.
            </p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setScanOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 border text-xs text-white hover:brightness-110"
                style={{
                  borderColor: colors.border,
                  backgroundColor: colors.accent,
                }}
              >
                <QrCode size={14} /> Scan code
              </button>
              <button
                type="button"
                onClick={jumpToToday}
                className="rounded-full px-3 py-1.5 text-xs border bg-white/80 hover:bg-white"
                style={{ borderColor: colors.border }}
              >
                Today
              </button>
            </div>
          </div>
        ) : null}

        {/* Slots list */}
        <div className="space-y-4">
          {filteredSlots.map((slot) => (
            <div
              key={slot.id}
              className={clsx("rounded-2xl p-4 shadow-sm", colors.card)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge tone="sky">
                    {new Date(slot.date).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Badge>
                  <span className="font-semibold">
                    {slot.experienceName || "Experience"}
                  </span>
                </div>
                <div className="text-xs" style={{ color: colors.sub }}>
                  Capacity {slot.totalSlots ?? 0} · Reserved{" "}
                  {(slot.bookings || [])
                    .filter(
                      (b) => (b.status || "").toLowerCase() !== "cancelled"
                    )
                    .reduce((sum, b) => sum + partySize(b), 0)}
                </div>
              </div>

              {/* Table (md+) */}
              <div className="overflow-x-auto hidden md:block">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left" style={{ color: colors.sub }}>
                      <th className="py-2 pr-4">Booking</th>
                      <th className="py-2 pr-4">Guest</th>
                      <th className="py-2 pr-4">Party</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody
                    className="[&>tr:not(:last-child)]:border-b"
                    style={{ borderColor: "#eee5da" }}
                  >
                    {(slot.bookings || []).map((b) => {
                      const size = partySize(b);
                      const s = (b.status || "").toLowerCase();
                      const canCheckIn = ![
                        "checked_in",
                        "cancelled",
                        "no_show",
                        "noshow",
                      ].includes(s);
                      const canUndo = [
                        "checked_in",
                        "no_show",
                        "noshow",
                      ].includes(s);
                      const flashing = flashId === b.id;
                      return (
                        <tr
                          key={b.id}
                          data-booking-id={b.id}
                          className={clsx(
                            "align-middle transition",
                            flashing &&
                              "ring-2 ring-green-400/50 bg-green-50/60"
                          )}
                        >
                          <td className="py-2 pr-4 font-medium">#{b.id}</td>
                          <td className="py-2 pr-4">
                            <div className="flex flex-col">
                              <span className="truncate">
                                {contactName(b.primary_contact)}
                              </span>
                              {b.primary_contact?.phone ? (
                                <span
                                  className="text-xs"
                                  style={{ color: colors.sub }}
                                >
                                  {b.primary_contact.phone}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="py-2 pr-4">{size}</td>
                          <td className="py-2 pr-4">
                            <StatusBadge status={b.status} />
                          </td>
                          <td className="py-2 pr-0">
                            <div className="flex justify-end gap-2">
                              <ActionButton
                                tone="green"
                                disabled={!canCheckIn}
                                onClick={() => {
                                  mutateBooking(b.id, "checkin");
                                  setTimeout(() => scrollToBooking(b.id), 100);
                                }}
                                icon={<CheckCircle2 size={14} />}
                                label="Check-in"
                                title="Mark as checked-in"
                              />
                              <ActionButton
                                tone="slate"
                                disabled={!canUndo}
                                onClick={() => mutateBooking(b.id, "undo")}
                                icon={<RotateCcw size={14} />}
                                label="Undo"
                                title="Undo"
                              />
                              <ActionButton
                                tone="red"
                                disabled={s === "no_show" || s === "noshow"}
                                onClick={() => {
                                  const ok = window.confirm(
                                    `Mark booking #${b.id} as no-show?`
                                  );
                                  if (ok) mutateBooking(b.id, "no_show");
                                }}
                                icon={<XCircle size={14} />}
                                label="No-show"
                                title="Mark as no-show"
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Cards (mobile) */}
              <div className="md:hidden space-y-3">
                {(slot.bookings || []).map((b) => {
                  const size = partySize(b);
                  const s = (b.status || "").toLowerCase();
                  const canCheckIn = ![
                    "checked_in",
                    "cancelled",
                    "no_show",
                    "noshow",
                  ].includes(s);
                  const canUndo = ["checked_in", "no_show", "noshow"].includes(
                    s
                  );
                  const flashing = flashId === b.id;
                  return (
                    <div
                      key={b.id}
                      data-booking-card={b.id}
                      className={clsx(
                        "rounded-xl border p-3 bg-white/80 transition",
                        flashing && "ring-2 ring-green-400/50 bg-green-50/60"
                      )}
                      style={{ borderColor: colors.border }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium">#{b.id}</div>
                        <StatusBadge status={b.status} />
                      </div>
                      <div className="mt-1 text-sm">
                        <div className="font-medium">
                          {contactName(b.primary_contact)}
                        </div>
                        {b.primary_contact?.phone ? (
                          <div
                            className="text-xs"
                            style={{ color: colors.sub }}
                          >
                            {b.primary_contact.phone}
                          </div>
                        ) : null}
                        <div
                          className="mt-1 text-xs flex items-center gap-1"
                          style={{ color: colors.sub }}
                        >
                          Party: <Badge tone="blue">{size}</Badge>
                        </div>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <ActionButton
                          tone="green"
                          block
                          disabled={!canCheckIn}
                          onClick={() => {
                            mutateBooking(b.id, "checkin");
                            setTimeout(() => scrollToBooking(b.id), 100);
                          }}
                          icon={<CheckCircle2 size={14} />}
                          label="Check-in"
                        />
                        <ActionButton
                          tone="slate"
                          block
                          disabled={!canUndo}
                          onClick={() => mutateBooking(b.id, "undo")}
                          icon={<RotateCcw size={14} />}
                          label="Undo"
                        />
                        <ActionButton
                          tone="red"
                          block
                          disabled={s === "no_show" || s === "noshow"}
                          onClick={() => {
                            const ok = window.confirm(
                              `Mark booking #${b.id} as no-show?`
                            );
                            if (ok) mutateBooking(b.id, "no_show");
                          }}
                          icon={<XCircle size={14} />}
                          label="No-show"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="h-10" />
      </div>

      {/* Scanner modal */}
      <ScanModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onDetected={onScan}
      />
    </div>
  );
}

function SummaryCard({ label, value, tone, icon }) {
  const rings = {
    green: "focus-within:ring-green-600/30",
    red: "focus-within:ring-red-600/30",
    blue: "focus-within:ring-sky-600/30",
    default: "focus-within:ring-[#8b6f47]/30",
  };
  const accents = {
    green: "text-green-700",
    red: "text-red-700",
    blue: "text-sky-700",
    default: "text-slate-700",
  };
  return (
    <div
      className={clsx(
        "rounded-2xl p-4 shadow-sm focus-within:ring-2 outline-none",
        colors.card,
        rings[tone] || rings.default
      )}
    >
      <p className="text-xs" style={{ color: colors.sub }}>
        {label}
      </p>
      <div className="mt-1 flex items-end justify-between">
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        {icon ? (
          <span
            className={clsx(
              "ml-3 opacity-70",
              accents[tone] || accents.default
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ActionButton({
  tone = "slate",
  icon,
  label,
  onClick,
  disabled,
  title,
  block,
}) {
  const tones = {
    green: "border-green-600/30 text-green-800 bg-green-50 hover:bg-green-100",
    red: "border-red-600/30 text-red-700 bg-red-50 hover:bg-red-100",
    slate: "border-slate-600/30 text-slate-700 bg-white hover:bg-slate-50",
  };
  const off =
    "opacity-40 cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400";
  return (
    <button
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs border transition",
        block && "flex-1 justify-center",
        disabled ? off : tones[tone] || tones.slate
      )}
      disabled={disabled}
      onClick={onClick}
      title={title}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
