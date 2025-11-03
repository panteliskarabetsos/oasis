"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  QrCode,
  Search,
  CalendarDays,
  CheckCircle2,
  XCircle,
  RotateCcw,
  AlertTriangle,
  Flashlight,
  Camera,
  CameraOff,
  Check,
} from "lucide-react";

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
function Badge({ tone = "slate", children }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    green: "bg-green-100 text-green-700 border-green-200",
    amber: "bg-amber-100 text-amber-800 border-amber-200",
    red: "bg-red-100 text-red-700 border-red-200",
    sky: "bg-sky-100 text-sky-700 border-sky-200",
    violet: "bg-violet-100 text-violet-700 border-violet-200",
  };
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full border",
        tones[tone] || tones.slate
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
  if (s === "approved") return <Badge tone="sky">Approved</Badge>;
  if (s === "converted") return <Badge tone="sky">Converted</Badge>;
  if (s === "pending") return <Badge tone="amber">Pending</Badge>;
  if (s === "no_show" || s === "noshow")
    return <Badge tone="red">No-show</Badge>;
  if (s === "cancelled") return <Badge tone="red">Cancelled</Badge>;
  return <Badge>Confirmed</Badge>;
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

/* ---------------------------- Toasts ---------------------------- */
function useToasts() {
  const [toasts, setToasts] = useState([]);
  function pushToast(msg, tone = "default", ms = 2200) {
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
    <div className="fixed top-3 right-3 z-50 space-y-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={clsx(
            "rounded-xl px-3 py-2 text-sm shadow border backdrop-blur bg-white/90 flex items-center gap-2",
            t.tone === "ok" && "border-green-200 text-green-800",
            t.tone === "err" && "border-red-200 text-red-700",
            (!t.tone || t.tone === "default") &&
              "border-[#e6dfd6] text-[#5a4a3f]"
          )}
          onClick={() => remove(t.id)}
        >
          {t.tone === "ok" ? (
            <Check size={14} />
          ) : t.tone === "err" ? (
            <AlertTriangle size={14} />
          ) : null}
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------- Scanner Modal ---------------------------- */
function ScanModal({ open, onClose, onDetected }) {
  const videoRef = useRef(null);
  const rafRef = useRef(null);
  const streamRef = useRef(null);
  const controlsRef = useRef(null); // ZXing stop handle
  const readerRef = useRef(null); // ZXing reader

  const [engine, setEngine] = useState("auto"); // 'native' | 'zxing'
  const [supported, setSupported] = useState(false);
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState(null);
  const [torchOn, setTorchOn] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const formats = ["qr_code", "code_128", "ean_13", "ean_8"];
  const detectorRef = useRef(null);

  // tiny beep
  const beep = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 880;
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.value = 0.0001;
      o.start();
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
      setTimeout(() => {
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
        setTimeout(() => {
          o.stop();
          ctx.close();
        }, 160);
      }, 100);
    } catch {}
  };

  // Ensure HTTPS and ask for permission *before* enumerateDevices (iOS quirk)
  async function primePermission() {
    if (location.protocol !== "https:" && location.hostname !== "localhost") {
      throw new Error("Camera requires HTTPS (or localhost).");
    }
    try {
      // Request a basic stream to unlock labels
      const s = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      s.getTracks().forEach((t) => t.stop());
    } catch (e) {
      throw new Error("Camera permission denied or unavailable.");
    }
  }

  async function listVideoInputs() {
    const devs = await navigator.mediaDevices.enumerateDevices();
    const vids = devs.filter((d) => d.kind === "videoinput");
    setDevices(vids);
    // prefer back camera if present
    const back =
      vids.find((d) => (d.label || "").toLowerCase().includes("back")) ||
      vids[1];
    setDeviceId((d) => d ?? back?.deviceId ?? vids[0]?.deviceId ?? null);
  }

  function stopAll() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
      } catch {}
      controlsRef.current = null;
    }
    if (readerRef.current) {
      try {
        readerRef.current.reset();
      } catch {}
      readerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  // Start with native, fall back to ZXing automatically
  async function startScanner() {
    setError("");
    setStatus("Starting camera…");
    stopAll();

    // Decide engine
    const hasNative = "BarcodeDetector" in window;
    setSupported(hasNative);
    setEngine(hasNative ? "native" : "zxing");

    if (hasNative) {
      try {
        // Native — start a vanilla stream, then run detector loop
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
        videoRef.current.setAttribute("muted", true);
        videoRef.current.muted = true;
        await videoRef.current.play();

        // init detector
        const sup = await (window.BarcodeDetector.getSupportedFormats?.() ||
          []);
        const useFormats =
          sup && sup.length ? formats.filter((f) => sup.includes(f)) : formats;
        detectorRef.current = new window.BarcodeDetector({
          formats: useFormats,
        });
        setStatus("Scanning…");

        const loop = async () => {
          if (!detectorRef.current || !videoRef.current) return;
          try {
            const res = await detectorRef.current.detect(videoRef.current);
            if (res && res.length) {
              const val = res[0].rawValue || "";
              if (val) {
                beep();
                onDetected?.(val);
                await new Promise((r) => setTimeout(r, 800));
              }
            }
          } catch {}
          rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
        return;
      } catch (e) {
        // Fall back to ZXing
      }
    }

    // ZXing fallback (broad support incl. iOS)
    try {
      setEngine("zxing");
      setStatus("Loading scanner…");
      const { BrowserMultiFormatReader, NotFoundException } = await import(
        "@zxing/browser"
      );
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      const videoEl = videoRef.current;
      const controls = await reader.decodeFromVideoDevice(
        deviceId || undefined,
        videoEl,
        (result, err) => {
          if (result) {
            const txt = result.getText();
            if (txt) {
              beep();
              onDetected?.(txt);
            }
          } else if (err && !(err instanceof NotFoundException)) {
            // ignore 'not found' noise; show real errors
            setError(String(err));
          }
        }
      );
      controlsRef.current = controls;
      setStatus("Scanning…");
    } catch (e) {
      setError("Scanner failed to initialize.");
    }
  }

  async function toggleTorch() {
    try {
      const track = streamRef.current?.getVideoTracks?.()[0];
      if (!track) return;
      const caps = track.getCapabilities?.();
      if (!caps || !caps.torch) return;
      await track.applyConstraints({ advanced: [{ torch: !torchOn }] });
      setTorchOn((t) => !t);
    } catch {}
  }

  useEffect(() => {
    if (!open) return;
    let alive = true;

    (async () => {
      try {
        await primePermission();
        await listVideoInputs();
        if (!alive) return;
        await startScanner();
      } catch (e) {
        setError(e.message || "Camera unavailable.");
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
    // Switching camera
    startScanner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  function close() {
    stopAll();
    onClose?.();
  }

  return (
    <div
      className={clsx(
        "fixed inset-0 z-40 items-end sm:items-center justify-center",
        open ? "flex" : "hidden"
      )}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={close}
      />

      <div className="relative z-10 w-full sm:max-w-2xl mx-auto sm:rounded-3xl sm:shadow-2xl bg-[#fdfaf5] border border-[#e6dfd6] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#eee5da] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode size={18} className="opacity-80" />
            <h3 className="font-semibold">Scan QR / Barcode</h3>
          </div>
          <button
            onClick={close}
            className="text-sm rounded-full px-3 py-1 border border-[#e6dfd6] hover:bg-white"
          >
            Close
          </button>
        </div>

        <div className="p-4">
          <div className="relative rounded-2xl overflow-hidden border border-[#e6dfd6] bg-black aspect-[16/10]">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-[72%] max-w-[560px] aspect-square rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" />
            </div>
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2">
              <span className="text-xs text-white/90 bg-black/40 rounded-full px-2 py-1">
                {error
                  ? error
                  : status
                  ? `${status} (${engine})`
                  : supported
                  ? "Starting…"
                  : "Starting (zxing)…"}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={toggleTorch}
                  className="text-xs text-white bg-black/40 rounded-full px-2 py-1 border border-white/20 hover:bg-black/50"
                  title="Toggle flashlight"
                >
                  {torchOn ? "Torch On" : "Torch Off"}
                </button>
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
      </div>
    </div>
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
        className="flex-1 rounded-full border border-[#d8cfc3] bg-white/80 px-4 py-2 text-sm placeholder:text-[#a09084] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/40"
      />
      <button className="rounded-full px-3 py-2 text-xs border border-[#d8cfc3] bg-[#fdfaf5] hover:bg-[#f1ede7]">
        Apply
      </button>
    </form>
  );
}

/* ---------------------------- Page ---------------------------- */
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

  const { toasts, pushToast, remove } = useToasts();

  useEffect(() => {
    const p = new URLSearchParams(Array.from(sp.entries()));
    p.set("date", date);
    router.replace(`/admin/checkins?${p.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

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
          { cache: "no-store" }
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

  // Parse IDs from common QR payloads (plain id, numbers inside, or URLs)
  function extractBookingId(payload) {
    if (!payload) return null;
    // if URL like https://site/booking/123 or /admin/bookings/123
    const urlMatch = String(payload).match(/\/(?:booking|bookings)\/(\d+)/i);
    if (urlMatch) return Number(urlMatch[1]);
    // "booking:123"
    const tagMatch = String(payload).match(/booking[:= ]+(\d+)/i);
    if (tagMatch) return Number(tagMatch[1]);
    // only digits
    const just = String(payload).trim();
    if (/^\d+$/.test(just)) return Number(just);
    return null;
  }

  async function handleDetected(raw) {
    const id = extractBookingId(raw);
    if (!id || !Number.isFinite(id)) {
      pushToast("Scanned code not recognized as a booking id.", "err");
      return;
    }
    await mutateBooking(id, "checkin");
    // keep scanner open; if you prefer auto-close:
    // setScanOpen(false);
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

  return (
    <div className="min-h-screen bg-[#f4f1ec] text-[#5a4a3f]">
      <Toasts toasts={toasts} remove={remove} />
      <div className="mx-auto max-w-6xl px-6 py-6">
        {/* Header */}
        <div className="mb-4 -mx-2 sm:-mx-4 px-2 sm:px-4 py-3 rounded-2xl bg-gradient-to-r from-[#f4f1ec] via-[#fff8ef] to-[#f4f1ec] border border-[#e8e2d9]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-serif tracking-tight">
                Check-ins
              </h1>
              <p className="text-sm text-[#7a6a5f]">
                Scan or mark arrivals for today’s slots.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-full border border-[#d8cfc3] bg-white/70 px-3 py-1.5">
                <CalendarDays size={16} className="opacity-70" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-transparent text-sm outline-none"
                />
              </div>
              <div className="relative">
                <Search
                  className="absolute left-3 top-2.5 h-4 w-4 text-[#7a6a5f]"
                  aria-hidden
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search guest, booking id, email…"
                  className="w-64 rounded-full border border-[#d8cfc3] bg-white/80 backdrop-blur px-9 py-2 text-sm placeholder:text-[#a09084] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/40"
                />
              </div>
              <button
                type="button"
                onClick={() => setScanOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 border border-[#d8cfc3] bg-[#8b6f47] text-white hover:brightness-110 transition text-xs shadow-sm"
                title="Open camera scanner"
              >
                <QrCode size={14} /> Scan
              </button>
            </div>
          </div>
        </div>

        {/* Totals */}
        <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard label="Bookings" value={totals.count} />
          <SummaryCard label="Checked-in" value={totals.checked} tone="green" />
          <SummaryCard label="No-shows" value={totals.noshow} tone="red" />
          <SummaryCard
            label="Reserved / Capacity"
            value={`${totals.reserved} / ${totals.capacity}`}
            tone="blue"
          />
        </div>

        {/* Error */}
        {error ? (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
            <AlertTriangle size={16} /> {error}
          </div>
        ) : null}

        {/* Loading */}
        {loading ? (
          <div className="grid gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-28 rounded-2xl bg-[#e8e2d9] animate-pulse"
              />
            ))}
          </div>
        ) : null}

        {/* Slots list */}
        {!loading && filteredSlots.length === 0 ? (
          <p className="text-sm text-[#7a6a5f]">No bookings for this date.</p>
        ) : null}

        <div className="space-y-4">
          {filteredSlots.map((slot) => (
            <div
              key={slot.id}
              className="rounded-2xl bg-white/80 backdrop-blur border border-[#e0dcd4] shadow-sm p-4"
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
                <div className="text-xs text-[#7a6a5f]">
                  Capacity {slot.totalSlots ?? 0} · Reserved{" "}
                  {(slot.bookings || [])
                    .filter(
                      (b) => (b.status || "").toLowerCase() !== "cancelled"
                    )
                    .reduce((sum, b) => sum + partySize(b), 0)}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-[#7a6a5f]">
                      <th className="py-2 pr-4">Booking</th>
                      <th className="py-2 pr-4">Guest</th>
                      <th className="py-2 pr-4">Party</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="[&>tr:not(:last-child)]:border-b [&>tr:not(:last-child)]:border-[#eee5da]">
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
                      return (
                        <tr key={b.id}>
                          <td className="py-2 pr-4 font-medium">#{b.id}</td>
                          <td className="py-2 pr-4">
                            <div className="flex flex-col">
                              <span className="truncate">
                                {contactName(b.primary_contact)}
                              </span>
                              {b.primary_contact?.phone ? (
                                <span className="text-xs text-[#7a6a5f]">
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
                              <button
                                className={clsx(
                                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs border transition",
                                  canCheckIn
                                    ? "border-green-600/30 text-green-700 bg-green-50 hover:bg-green-100"
                                    : "opacity-40 cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                                )}
                                disabled={!canCheckIn}
                                onClick={() => mutateBooking(b.id, "checkin")}
                                title="Mark as checked-in"
                              >
                                <CheckCircle2 size={14} /> Check-in
                              </button>
                              <button
                                className={clsx(
                                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs border transition",
                                  canUndo
                                    ? "border-slate-600/30 text-slate-700 bg-white hover:bg-slate-50"
                                    : "opacity-40 cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                                )}
                                disabled={!canUndo}
                                onClick={() => mutateBooking(b.id, "undo")}
                                title="Undo"
                              >
                                <RotateCcw size={14} /> Undo
                              </button>
                              <button
                                className={clsx(
                                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs border transition",
                                  s !== "no_show" && s !== "noshow"
                                    ? "border-red-600/30 text-red-700 bg-red-50 hover:bg-red-100"
                                    : "opacity-40 cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                                )}
                                disabled={s === "no_show" || s === "noshow"}
                                onClick={() => mutateBooking(b.id, "no_show")}
                                title="Mark as no-show"
                              >
                                <XCircle size={14} /> No-show
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
        onDetected={handleDetected}
      />
    </div>
  );
}

function SummaryCard({ label, value, tone }) {
  const rings = {
    green: "focus:ring-green-600/30",
    red: "focus:ring-red-600/30",
    blue: "focus:ring-sky-600/30",
    default: "focus:ring-[#8b6f47]/30",
  };
  return (
    <div
      className={clsx(
        "rounded-2xl border border-[#e6dfd6] bg-white/80 backdrop-blur p-4 shadow-sm focus-within:ring-2",
        rings[tone] || rings.default
      )}
    >
      <p className="text-xs text-[#7a6a5f]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}
