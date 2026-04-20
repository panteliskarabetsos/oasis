"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  PlusCircle,
  Users,
  Loader2,
  Settings2,
  Clock,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

// ---------- Helpers ----------
const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
const toISODate = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const dayName = (d) => d.toLocaleDateString("en-US", { weekday: "long" });

function getMonthMatrix(anchor) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);

  const weeks = [];
  for (let w = 0; w < 6; w++) {
    const row = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + w * 7 + i);
      row.push({
        date: d,
        inMonth: d.getMonth() === anchor.getMonth(),
      });
    }
    weeks.push(row);
  }
  return weeks;
}

const isSameDay = (a, b) =>
  a &&
  b &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const fmtDateLong = (iso) =>
  new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
const fmtTimeShort = (iso) =>
  new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

// ---------- Page ----------
export default function PlannerPage() {
  const router = useRouter();

  const [experiences, setExperiences] = useState([]);
  const [selectedExperienceId, setSelectedExperienceId] = useState("");
  const [selectedExperience, setSelectedExperience] = useState(null);

  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);

  const [newSlot, setNewSlot] = useState({
    date: "",
    time: "",
    totalSlots: "",
  });

  const [editingSlotId, setEditingSlotId] = useState(null);
  const [editedAvailableSlots, setEditedAvailableSlots] = useState("");

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // UI States
  const [activeTab, setActiveTab] = useState("day"); // 'day', 'upcoming', 'past'

  // Calendar state
  const [calMonth, setCalMonth] = useState(() => {
    const t = startOfToday();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });
  const [selectedDateObj, setSelectedDateObj] = useState(null);

  // ---------- Fetch ----------
  useEffect(() => {
    fetch("/api/admin/experiences", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setExperiences(Array.isArray(data) ? data : []))
      .catch(() => toast.error("Failed to load experiences."));
  }, []);

  useEffect(() => {
    if (!selectedExperienceId) {
      setSelectedExperience(null);
      setSlots([]);
      return;
    }
    const exp = experiences.find((e) => e.id === Number(selectedExperienceId));
    setSelectedExperience(exp || null);

    setLoading(true);
    fetch(
      `/api/admin/schedule?experienceId=${selectedExperienceId}&withUsage=1`,
      { cache: "no-store" },
    )
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || "Failed to load slots.");
        }
        return res.json();
      })
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        arr.sort((a, b) => new Date(a.date) - new Date(b.date));
        setSlots(arr);
      })
      .catch((e) => toast.error(e.message || "Failed to load slots."))
      .finally(() => setLoading(false));
  }, [selectedExperienceId, experiences]);

  // ---------- Derived ----------
  const freq = Array.isArray(selectedExperience?.frequency)
    ? selectedExperience.frequency
    : [];

  const stats = useMemo(() => {
    const total = slots.reduce((n, s) => n + (s.totalSlots || 0), 0);
    const booked = slots.reduce((n, s) => n + (s.booked || 0), 0);
    const upcomingCount = slots.filter(
      (s) => new Date(s.date) >= new Date(),
    ).length;
    return { totalSlots: total, booked, upcomingCount };
  }, [slots]);

  const selectedDateStr = selectedDateObj ? toISODate(selectedDateObj) : "";
  const slotsOnSelectedDate = useMemo(() => {
    if (!selectedDateStr) return [];
    return slots.filter((s) => s.date.slice(0, 10) === selectedDateStr);
  }, [slots, selectedDateStr]);

  const upcomingSlots = useMemo(
    () => slots.filter((s) => new Date(s.date) >= new Date()),
    [slots],
  );
  const pastSlots = useMemo(
    () => [...slots.filter((s) => new Date(s.date) < new Date())].reverse(),
    [slots],
  );

  const countByDate = useMemo(() => {
    const map = new Map();
    for (const s of slots) {
      const k = s.date.slice(0, 10);
      map.set(k, (map.get(k) || 0) + 1);
    }
    return map;
  }, [slots]);

  // ---------- Handlers ----------
  const handleDatePick = (d) => {
    const today = startOfToday();
    const isPast = d < today;
    const allowed = freq.length === 0 || freq.includes(dayName(d));

    if (isPast) return toast.error("Cannot select past dates.");
    if (!allowed)
      return toast.error("This day is not allowed by the selected experience.");

    setSelectedDateObj(d);
    setNewSlot((prev) => ({ ...prev, date: toISODate(d) }));
    setActiveTab("day"); // auto-switch to day view
  };

  const handleAddSlot = async () => {
    const { date, time, totalSlots } = newSlot;

    if (!selectedExperienceId)
      return toast.error("Select an experience first.");
    if (!date || !time || !totalSlots)
      return toast.error("Please fill in date, time and total slots.");

    const dayOk =
      freq.length === 0 ||
      freq.includes(
        new Date(date).toLocaleDateString("en-US", { weekday: "long" }),
      );
    if (!dayOk) return toast.error("Selected date is not within allowed days.");

    const isoDateTime = new Date(`${date}T${time}`).toISOString();

    const res = await fetch("/api/admin/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        experienceId: Number(selectedExperienceId),
        date: isoDateTime,
        totalSlots: Number(totalSlots),
      }),
    });

    if (res.ok) {
      const newEntry = await res.json();
      const enriched = {
        ...newEntry,
        booked: 0,
        holds: 0,
        available: Number(newEntry.totalSlots || 0),
      };
      setSlots((prev) =>
        [...prev, enriched].sort((a, b) => new Date(a.date) - new Date(b.date)),
      );
      setNewSlot({ date, time: "", totalSlots: "" });
      toast.success("Slot added.");
    } else {
      const msg =
        (await res.json().catch(() => ({})))?.error || "Failed to add slot.";
      toast.error(msg);
    }
  };

  const handleEditClick = (slot) => {
    setEditingSlotId(slot.id);
    setEditedAvailableSlots(
      String(Math.max((slot.totalSlots || 0) - (slot.booked || 0), 0)),
    );
  };

  const handleSaveEdit = async () => {
    const slot = slots.find((s) => s.id === editingSlotId);
    if (!slot) return toast.error("Slot not found.");

    const available = Number(editedAvailableSlots);
    if (!Number.isFinite(available) || available < 0)
      return toast.error("Available slots must be a non-negative number.");

    const totalSlots = available + (slot.booked || 0);

    const res = await fetch(`/api/admin/schedule`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingSlotId, totalSlots }),
    });

    if (res.ok) {
      const updated = await res.json();
      setSlots((prev) =>
        prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)),
      );
      setEditingSlotId(null);
      setEditedAvailableSlots("");
      toast.success("Slot updated.");
    } else {
      const msg =
        (await res.json().catch(() => ({})))?.error || "Failed to update slot.";
      toast.error(msg);
    }
  };

  const askDelete = (id) => {
    setConfirmDeleteId(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!confirmDeleteId) return;
    const res = await fetch(`/api/admin/schedule?id=${confirmDeleteId}`, {
      method: "DELETE",
    });

    if (res.ok) {
      const payload = await res.json().catch(() => ({}));
      if (payload?.slot) {
        setSlots((prev) =>
          prev.map((s) =>
            s.id === payload.slot.id ? { ...s, ...payload.slot } : s,
          ),
        );
      } else {
        setSlots((prev) => prev.filter((s) => s.id !== confirmDeleteId));
      }
      toast.success(payload?.message || "Done.");
    } else {
      toast.error(
        (await res.json().catch(() => ({})))?.error || "Failed to update slot.",
      );
    }
    setShowDeleteModal(false);
    setConfirmDeleteId(null);
  };

  // ---------- Global Pause State ----------
  const [globalPause, setGlobalPause] = useState({
    bookingsPaused: false,
    bookingsPausedMessage: "",
    bookingsPausedUntil: "",
  });
  const [loadingGlobal, setLoadingGlobal] = useState(true);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [isGlobalOpen, setIsGlobalOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/settings/bookings", {
          cache: "no-store",
        });
        const data = await res.json();
        setGlobalPause({
          bookingsPaused: !!data.bookingsPaused,
          bookingsPausedMessage: data.bookingsPausedMessage || "",
          bookingsPausedUntil: data.bookingsPausedUntil
            ? data.bookingsPausedUntil.slice(0, 16)
            : "",
        });
      } catch (e) {
        toast.error("Failed to load global booking setting.");
      } finally {
        setLoadingGlobal(false);
      }
    })();
  }, []);

  async function saveGlobalPause() {
    setSavingGlobal(true);
    const payload = {
      bookingsPaused: !!globalPause.bookingsPaused,
      bookingsPausedMessage: globalPause.bookingsPausedMessage?.trim() || null,
      bookingsPausedUntil: globalPause.bookingsPausedUntil
        ? new Date(globalPause.bookingsPausedUntil).toISOString()
        : null,
    };

    const res = await fetch("/api/admin/settings/bookings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSavingGlobal(false);
    if (!res.ok) return toast.error("Failed to update global booking setting.");

    toast.success(
      payload.bookingsPaused || payload.bookingsPausedUntil
        ? "Bookings paused globally."
        : "Global bookings resumed.",
    );
    if (!payload.bookingsPaused) setIsGlobalOpen(false);
  }

  // ---------- Components ----------
  const StatBadge = ({ icon: Icon, label, value }) => (
    <div className="flex items-center gap-4 rounded-xl border border-stone-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-stone-700">
        <Icon size={20} />
      </div>
      <div>
        <div className="text-sm text-stone-500">{label}</div>
        <div className="text-xl font-bold text-stone-800">{value}</div>
      </div>
    </div>
  );

  const SlotCard = ({ s }) => {
    const booked = s.booked || 0;
    const total = s.totalSlots || 0;
    const available = Number.isFinite(s.available)
      ? s.available
      : Math.max(total - booked, 0);
    const pct =
      total > 0 ? Math.min(100, Math.round((booked / total) * 100)) : 0;
    const isPast = new Date(s.date) < new Date();
    const editing = editingSlotId === s.id;

    return (
      <div
        className={`group relative overflow-hidden rounded-xl border p-5 transition-all ${
          s.isCancelled
            ? "border-red-200 bg-red-50/30"
            : "border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm"
        }`}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-stone-800">
                {fmtDateLong(s.date)}
              </h4>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                  isPast
                    ? "bg-stone-100 text-stone-600"
                    : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {isPast ? "Past" : "Upcoming"}
              </span>
              {s.isCancelled && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-red-700">
                  Cancelled
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-sm text-stone-500">
              <Clock size={14} />
              <span>{fmtTimeShort(s.date)}</span>
            </div>
          </div>

          {!editing && (
            <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
              <button
                onClick={() => handleEditClick(s)}
                disabled={s.isCancelled}
                className="p-2 text-stone-400 hover:text-stone-700 disabled:opacity-30"
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={() => askDelete(s.id)}
                className="p-2 text-stone-400 hover:text-red-600"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>

        {!editing ? (
          <div className="mt-5">
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-stone-600">
                Booked:{" "}
                <span className="font-semibold text-stone-800">{booked}</span> /{" "}
                {total}
              </span>
              <span className="text-stone-500">
                Avail: {available}{" "}
                {Number(s.holds || 0) > 0 && `(+${s.holds} holds)`}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
              <div
                className={`h-full rounded-full ${pct > 90 ? "bg-orange-400" : pct > 0 ? "bg-stone-800" : "bg-stone-300"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-lg bg-stone-50 p-4 border border-stone-200">
            <label className="block text-xs font-medium text-stone-600 mb-1">
              Set Available Slots
            </label>
            <input
              type="number"
              min={0}
              value={editedAvailableSlots}
              onChange={(e) => setEditedAvailableSlots(e.target.value)}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
            />
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleSaveEdit}
                className="rounded-md bg-stone-800 px-3 py-1.5 text-xs text-white hover:bg-stone-700"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditingSlotId(null);
                  setEditedAvailableSlots("");
                }}
                className="rounded-md bg-white px-3 py-1.5 text-xs text-stone-600 border border-stone-300 hover:bg-stone-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const CalendarWidget = () => {
    const matrix = getMonthMatrix(calMonth);
    const today = startOfToday();

    return (
      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={() =>
              setCalMonth(
                new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1),
              )
            }
            className="rounded p-1 hover:bg-stone-100"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="font-semibold text-stone-800">
            {calMonth.toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            })}
          </div>
          <button
            onClick={() =>
              setCalMonth(
                new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1),
              )
            }
            className="rounded p-1 hover:bg-stone-100"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="mb-2 grid grid-cols-7 text-center text-xs font-medium text-stone-400">
          {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {matrix.flat().map(({ date, inMonth }, idx) => {
            const disabledPast = date < today;
            const allowed = freq.length === 0 || freq.includes(dayName(date));
            const k = toISODate(date);
            const has = countByDate.get(k) || 0;
            const selected =
              selectedDateObj && isSameDay(date, selectedDateObj);

            let btnClass =
              "relative flex h-9 w-full items-center justify-center rounded-md text-sm transition-colors ";

            if (!inMonth) btnClass += "text-transparent pointer-events-none";
            else if (disabledPast)
              btnClass += "text-stone-300 bg-stone-50 cursor-not-allowed";
            else if (!allowed)
              btnClass +=
                "text-stone-300 bg-stone-50/50 cursor-not-allowed line-through decoration-stone-300";
            else if (selected)
              btnClass += "bg-stone-800 text-white shadow-md font-medium";
            else
              btnClass +=
                "text-stone-700 hover:bg-stone-100 bg-white border border-transparent hover:border-stone-200";

            return (
              <button
                key={idx}
                disabled={disabledPast || !allowed || !inMonth}
                onClick={() => handleDatePick(date)}
                className={btnClass}
              >
                {inMonth && date.getDate()}
                {!!has && inMonth && (
                  <span
                    className={`absolute bottom-1 h-1 w-1 rounded-full ${selected ? "bg-white" : "bg-stone-400"}`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // ---------- Render ----------
  return (
    <div className="min-h-screen bg-stone-50/50 text-stone-800 pb-20">
      {/* Top Nav */}
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/80 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/admin")}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 hover:bg-stone-50 hover:text-stone-800 transition"
            >
              <ChevronLeft size={18} />
            </button>
            <h1 className="text-xl font-bold tracking-tight text-stone-800">
              Planner
            </h1>
          </div>
          <button
            onClick={() => setIsGlobalOpen(!isGlobalOpen)}
            className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition ${globalPause.bookingsPaused ? "border-red-200 bg-red-50 text-red-700" : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"}`}
          >
            <Settings2 size={16} />
            {globalPause.bookingsPaused
              ? "Bookings Paused"
              : "Booking Settings"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 pt-8">
        {/* Global Pause Banner */}
        {isGlobalOpen && (
          <div className="mb-8 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition-all">
            <div className="border-b border-stone-100 bg-stone-50/50 px-6 py-4 flex items-center gap-3">
              <AlertCircle className="text-stone-500" size={20} />
              <div>
                <h2 className="font-semibold text-stone-800">
                  Global Booking Configuration
                </h2>
                <p className="text-xs text-stone-500">
                  Halt all new incoming appointments across all experiences.
                </p>
              </div>
            </div>
            <div className="p-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 items-end">
              <label className="flex flex-col gap-2 cursor-pointer">
                <span className="text-sm font-medium text-stone-700">
                  System Status
                </span>
                <div
                  className={`flex items-center gap-3 rounded-lg border p-3 ${globalPause.bookingsPaused ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}
                >
                  <input
                    type="checkbox"
                    className="h-5 w-5 rounded border-gray-300 text-stone-800 focus:ring-stone-800"
                    checked={globalPause.bookingsPaused}
                    onChange={(e) =>
                      setGlobalPause((p) => ({
                        ...p,
                        bookingsPaused: e.target.checked,
                      }))
                    }
                  />
                  <span className="font-medium">
                    {globalPause.bookingsPaused
                      ? "Globally Paused"
                      : "Accepting Bookings"}
                  </span>
                </div>
              </label>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-stone-700">
                  Pause Until (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={globalPause.bookingsPausedUntil}
                  onChange={(e) =>
                    setGlobalPause((p) => ({
                      ...p,
                      bookingsPausedUntil: e.target.value,
                    }))
                  }
                  className="rounded-lg border border-stone-300 px-3 py-3 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
                />
              </div>

              <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-3">
                <label className="text-sm font-medium text-stone-700">
                  Public Display Message
                </label>
                <input
                  type="text"
                  value={globalPause.bookingsPausedMessage}
                  onChange={(e) =>
                    setGlobalPause((p) => ({
                      ...p,
                      bookingsPausedMessage: e.target.value,
                    }))
                  }
                  placeholder="e.g. We are closed for the season..."
                  className="rounded-lg border border-stone-300 px-3 py-3 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-3 mt-2">
                <button
                  onClick={() => setIsGlobalOpen(false)}
                  className="px-5 py-2.5 text-sm font-medium text-stone-600 hover:text-stone-900"
                >
                  Cancel
                </button>
                <button
                  onClick={saveGlobalPause}
                  disabled={savingGlobal}
                  className="rounded-lg bg-stone-800 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-stone-700 disabled:opacity-50"
                >
                  {savingGlobal ? "Saving..." : "Save Settings"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Top Stats */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatBadge
            icon={CalendarIcon}
            label="Upcoming Slots"
            value={stats.upcomingCount}
          />
          <StatBadge
            icon={Users}
            label="Total Capacity"
            value={stats.totalSlots}
          />
          <StatBadge
            icon={CheckCircle2}
            label="Total Booked"
            value={stats.booked}
          />
        </div>

        {/* Main Workspace */}
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          {/* LEFT SIDEBAR (Controls & Calendar) */}
          <div className="lg:col-span-4 flex flex-col gap-6 sticky top-24">
            {/* Experience Selector */}
            <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
              <label className="mb-3 block text-sm font-semibold text-stone-800">
                1. Select Experience
              </label>
              <select
                value={selectedExperienceId}
                onChange={(e) => {
                  setSelectedExperienceId(e.target.value);
                  setSelectedDateObj(null);
                  setNewSlot({ date: "", time: "", totalSlots: "" });
                  setActiveTab("upcoming");
                }}
                className="w-full rounded-lg border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm font-medium text-stone-800 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
              >
                <option value="" disabled>
                  Choose an experience...
                </option>
                {experiences.map((exp) => (
                  <option key={exp.id} value={exp.id}>
                    {exp.name}
                  </option>
                ))}
              </select>

              {selectedExperience && (
                <div className="mt-4 rounded-lg bg-stone-50 p-3 border border-stone-100">
                  <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">
                    Available Days
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(freq.length ? freq : ["All Days"]).map((day) => (
                      <span
                        key={day}
                        className="rounded-md bg-white px-2 py-1 text-xs font-medium text-stone-600 border border-stone-200"
                      >
                        {day}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Calendar Widget */}
            <div
              className={
                selectedExperienceId
                  ? "opacity-100"
                  : "opacity-50 pointer-events-none"
              }
            >
              <label className="mb-3 block text-sm font-semibold text-stone-800">
                2. Pick a Date
              </label>
              <CalendarWidget />
            </div>
          </div>

          {/* RIGHT WORKSPACE (Lists & Forms) */}
          <div className="lg:col-span-8 min-h-[600px] rounded-2xl border border-stone-200 bg-white p-2 shadow-sm flex flex-col">
            {!selectedExperienceId ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center p-12 text-stone-400">
                <CalendarIcon size={48} className="mb-4 opacity-20" />
                <h3 className="text-lg font-medium text-stone-600">
                  No Experience Selected
                </h3>
                <p className="text-sm mt-1">
                  Select an experience from the sidebar to view and manage its
                  planner.
                </p>
              </div>
            ) : (
              <>
                {/* Tabs */}
                <div className="flex border-b border-stone-100 px-4 pt-2">
                  <button
                    onClick={() => setActiveTab("day")}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "day" ? "border-stone-800 text-stone-800" : "border-transparent text-stone-500 hover:text-stone-700"}`}
                  >
                    Selected Day
                  </button>
                  <button
                    onClick={() => setActiveTab("upcoming")}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "upcoming" ? "border-stone-800 text-stone-800" : "border-transparent text-stone-500 hover:text-stone-700"}`}
                  >
                    All Upcoming
                  </button>
                  <button
                    onClick={() => setActiveTab("past")}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "past" ? "border-stone-800 text-stone-800" : "border-transparent text-stone-500 hover:text-stone-700"}`}
                  >
                    Past Slots
                  </button>
                </div>

                <div className="p-6 flex-1 bg-stone-50/30">
                  {loading ? (
                    <div className="flex py-20 items-center justify-center gap-3 text-stone-500">
                      <Loader2 className="animate-spin" size={20} /> Loading
                      schedule...
                    </div>
                  ) : (
                    <>
                      {/* View: Selected Day */}
                      {activeTab === "day" && (
                        <div>
                          {!selectedDateObj ? (
                            <div className="text-center py-16 text-stone-500 bg-white border border-dashed border-stone-300 rounded-xl">
                              <p>
                                Select a date on the calendar to view or add
                                slots.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-8">
                              {/* Add Slot Inline Form */}
                              <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
                                <h3 className="font-semibold text-stone-800 mb-4 flex items-center gap-2">
                                  <PlusCircle
                                    size={18}
                                    className="text-stone-400"
                                  />
                                  Add Slot for{" "}
                                  {fmtDateLong(toISODate(selectedDateObj))}
                                </h3>
                                <div className="grid gap-4 sm:grid-cols-3 items-end">
                                  <div>
                                    <label className="mb-1.5 block text-xs font-medium text-stone-600">
                                      Time
                                    </label>
                                    <input
                                      type="time"
                                      value={newSlot.time}
                                      onChange={(e) =>
                                        setNewSlot({
                                          ...newSlot,
                                          time: e.target.value,
                                        })
                                      }
                                      className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="mb-1.5 block text-xs font-medium text-stone-600">
                                      Capacity (Slots)
                                    </label>
                                    <input
                                      type="number"
                                      min={1}
                                      placeholder="e.g. 10"
                                      value={newSlot.totalSlots}
                                      onChange={(e) =>
                                        setNewSlot({
                                          ...newSlot,
                                          totalSlots: e.target.value,
                                        })
                                      }
                                      className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
                                    />
                                  </div>
                                  <button
                                    onClick={handleAddSlot}
                                    className="w-full rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700"
                                  >
                                    Create Slot
                                  </button>
                                </div>
                                <div className="mt-3 flex gap-2">
                                  {["09:00", "12:00", "15:00", "18:00"].map(
                                    (t) => (
                                      <button
                                        type="button"
                                        key={t}
                                        onClick={() =>
                                          setNewSlot((p) => ({ ...p, time: t }))
                                        }
                                        className="rounded-md border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs text-stone-600 hover:bg-stone-100 transition"
                                      >
                                        {t}
                                      </button>
                                    ),
                                  )}
                                </div>
                              </div>

                              {/* Slots List for Selected Day */}
                              <div>
                                <h3 className="font-medium text-stone-800 mb-4">
                                  Scheduled on this date
                                </h3>
                                {slotsOnSelectedDate.length ? (
                                  <div className="grid gap-4 sm:grid-cols-2">
                                    {slotsOnSelectedDate.map((s) => (
                                      <SlotCard key={s.id} s={s} />
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-stone-500 italic">
                                    No slots scheduled yet.
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* View: Upcoming */}
                      {activeTab === "upcoming" && (
                        <div>
                          {upcomingSlots.length ? (
                            <div className="grid gap-4 sm:grid-cols-2">
                              {upcomingSlots.map((s) => (
                                <SlotCard key={s.id} s={s} />
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-16 text-stone-500 bg-white border border-dashed border-stone-300 rounded-xl">
                              <p>No upcoming slots across all dates.</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* View: Past */}
                      {activeTab === "past" && (
                        <div>
                          {pastSlots.length ? (
                            <div className="grid gap-4 sm:grid-cols-2">
                              {pastSlots.map((s) => (
                                <SlotCard key={s.id} s={s} />
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-16 text-stone-500 bg-white border border-dashed border-stone-300 rounded-xl">
                              <p>No past slots.</p>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-stone-900">
              Delete this slot?
            </h2>
            <p className="mt-2 text-sm text-stone-600">
              If the slot has bookings or active holds, it will be{" "}
              <strong className="text-red-600">marked as cancelled</strong>{" "}
              instead of fully deleted.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setConfirmDeleteId(null);
                }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Yes, delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
