"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  PlusCircle,
  Users,
  Loader2,
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
const dayName = (d) => d.toLocaleDateString("en-US", { weekday: "long" }); // frequency uses English day names

// Monday-based grid
function getMonthMatrix(anchor) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7; // 0=Mon
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
    weekday: "long",
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
export default function AdminSchedulePage() {
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

  // Calendar state
  const [calMonth, setCalMonth] = useState(() => {
    const t = startOfToday();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });
  const [selectedDateObj, setSelectedDateObj] = useState(null); // Date object, drives form + filter

  // ---------- Fetch ----------
  useEffect(() => {
    fetch("/api/admin/experiences")
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
    fetch(`/api/admin/schedule?experienceId=${selectedExperienceId}`)
      .then((res) => res.json())
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        arr.sort((a, b) => new Date(a.date) - new Date(b.date));
        setSlots(arr);
      })
      .catch(() => toast.error("Failed to load slots."))
      .finally(() => setLoading(false));
  }, [selectedExperienceId, experiences]);

  // ---------- Derived ----------
  const freq = Array.isArray(selectedExperience?.frequency)
    ? selectedExperience.frequency
    : [];

  const stats = useMemo(() => {
    const total = slots.reduce((n, s) => n + (s.totalSlots || 0), 0);
    const booked = slots.reduce((n, s) => n + (s.bookedSlots || 0), 0);
    const upcomingCount = slots.filter(
      (s) => new Date(s.date) >= new Date()
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
    [slots]
  );
  const pastSlots = useMemo(
    () => [...slots.filter((s) => new Date(s.date) < new Date())].reverse(),
    [slots]
  );

  const countByDate = useMemo(() => {
    // for calendar badges
    const map = new Map();
    for (const s of slots) {
      const k = s.date.slice(0, 10);
      map.set(k, (map.get(k) || 0) + 1);
    }
    return map;
  }, [slots]);

  // ---------- Handlers ----------
  const handleDatePick = (d) => {
    // block past dates & not-allowed frequency
    const today = startOfToday();
    const isPast = d < today;
    const allowed = freq.length === 0 || freq.includes(dayName(d));

    if (isPast) {
      toast.error("Cannot select past dates.");
      return;
    }
    if (!allowed) {
      toast.error("This day is not allowed by the selected experience.");
      return;
    }

    setSelectedDateObj(d);
    setNewSlot((prev) => ({ ...prev, date: toISODate(d) }));
  };

  const handleAddSlot = async () => {
    const { date, time, totalSlots } = newSlot;

    if (!selectedExperienceId) {
      toast.error("Select an experience first.");
      return;
    }
    if (!date || !time || !totalSlots) {
      toast.error("Please fill in date, time and total slots.");
      return;
    }

    const dayOk =
      freq.length === 0 ||
      freq.includes(
        new Date(date).toLocaleDateString("en-US", { weekday: "long" })
      );
    if (!dayOk) {
      toast.error("Selected date is not within allowed days.");
      return;
    }

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
      setSlots((prev) =>
        [...prev, newEntry].sort((a, b) => new Date(a.date) - new Date(b.date))
      );
      setNewSlot({ date, time: "", totalSlots: "" });
      toast.success("Slot added.");
    } else {
      toast.error("Failed to add slot.");
    }
  };

  const handleEditClick = (slot) => {
    setEditingSlotId(slot.id);
    setEditedAvailableSlots(
      String((slot.totalSlots || 0) - (slot.bookedSlots || 0))
    );
  };

  const handleSaveEdit = async () => {
    const slot = slots.find((s) => s.id === editingSlotId);
    if (!slot) return toast.error("Slot not found.");

    const available = Number(editedAvailableSlots);
    if (Number.isNaN(available) || available < 0) {
      toast.error("Available slots must be a non-negative number.");
      return;
    }
    const totalSlots = available + (slot.bookedSlots || 0);

    const res = await fetch(`/api/admin/schedule/${editingSlotId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ totalSlots }),
    });

    if (res.ok) {
      const updated = await res.json();
      setSlots((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setEditingSlotId(null);
      setEditedAvailableSlots("");
      toast.success("Slot updated.");
    } else {
      toast.error("Failed to update slot.");
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
      setSlots((prev) => prev.filter((s) => s.id !== confirmDeleteId));
      toast.success("Slot (and related bookings) deleted.");
    } else {
      toast.error("Failed to delete slot.");
    }
    setShowDeleteModal(false);
    setConfirmDeleteId(null);
  };

  // ---------- Small UI atoms ----------
  const Stat = ({ icon: Icon, label, value }) => (
    <div className="flex items-center gap-3 rounded-2xl border border-[#e0dcd4] bg-white/90 px-4 py-3 shadow-sm">
      <div className="grid place-items-center rounded-xl bg-[#efeae2] w-9 h-9">
        <Icon size={18} className="text-[#8b6f47]" />
      </div>
      <div>
        <div className="text-xs text-[#7a6a5f]">{label}</div>
        <div className="text-lg font-semibold text-[#5a4a3f]">{value}</div>
      </div>
    </div>
  );

  const SlotRow = ({ s }) => {
    const booked = s.bookedSlots || 0;
    const total = s.totalSlots || 0;
    const available = Math.max(total - booked, 0);
    const pct =
      total > 0 ? Math.min(100, Math.round((booked / total) * 100)) : 0;
    const isPast = new Date(s.date) < new Date();

    const editing = editingSlotId === s.id;

    return (
      <div className="rounded-xl border border-[#e8e2d8] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col">
            <div className="text-sm text-[#5a4a3f] font-medium">
              {fmtDateLong(s.date)}
            </div>
            <div className="text-xs text-[#7a6a5f]">{fmtTimeShort(s.date)}</div>
          </div>

          <span
            className={`text-[10px] px-2 py-1 rounded-full border ${
              isPast
                ? "bg-[#f7f3ee] text-[#7a6a5f] border-[#e6ded4]"
                : "bg-[#eaf4ea] text-[#1b5e20] border-[#cfe7d1]"
            }`}
          >
            {isPast ? "Past" : "Upcoming"}
          </span>
        </div>

        {!editing ? (
          <>
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="text-sm text-[#5a4a3f]">
                Booked <strong>{booked}</strong> / {total}{" "}
                <span className="text-xs text-[#7a6a5f]">
                  • Available {available}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEditClick(s)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#eadfd2] px-3 py-1.5 text-sm text-[#5a4a3f] hover:bg-[#faf7f1]"
                >
                  <Pencil size={14} /> Edit
                </button>
                <button
                  onClick={() => askDelete(s.id)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#eadfd2] px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>

            <div className="mt-3">
              <div className="h-2 w-full rounded-full bg-[#f1ece5] overflow-hidden">
                <div
                  className="h-full bg-[#8b6f47]"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-1 text-[11px] text-[#7a6a5f]">
                {pct}% filled
              </div>
            </div>
          </>
        ) : (
          <div className="mt-4">
            <label className="block text-xs text-[#7a6a5f] mb-1">
              Available Slots (Total = Available + Booked)
            </label>
            <input
              type="number"
              min={0}
              value={editedAvailableSlots}
              onChange={(e) => setEditedAvailableSlots(e.target.value)}
              className="w-full rounded-lg border border-[#e0dcd4] bg-[#fefcf9] px-3 py-2 text-[#5a4a3f] focus:outline-none focus:ring-2 focus:ring-[#cbb89e]"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={handleSaveEdit}
                className="rounded-full bg-[#5a4a3f] px-4 py-2 text-sm text-white hover:bg-[#473a30]"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditingSlotId(null);
                  setEditedAvailableSlots("");
                }}
                className="rounded-full border border-[#e0dcd4] px-4 py-2 text-sm text-[#5a4a3f] hover:bg-[#faf7f1]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ---------- Calendar Component ----------
  const CalendarCard = () => {
    const matrix = getMonthMatrix(calMonth);
    const today = startOfToday();

    return (
      <div className="rounded-2xl border border-[#e3dcd2] bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() =>
              setCalMonth(
                new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1)
              )
            }
            className="p-2 rounded-lg border border-[#e0dcd4] hover:bg-[#faf7f1]"
            title="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="text-sm font-semibold text-[#5a4a3f]">
            {calMonth.toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            })}
          </div>
          <button
            onClick={() =>
              setCalMonth(
                new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1)
              )
            }
            className="p-2 rounded-lg border border-[#e0dcd4] hover:bg-[#faf7f1]"
            title="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-[11px] text-[#7a6a5f] mb-1">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="px-2 py-1 text-center">
              {d}
            </div>
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

            const base =
              "relative h-10 rounded-lg text-sm flex items-center justify-center transition";
            let style =
              "border border-[#e0dcd4] bg-white text-[#5a4a3f] hover:bg-[#faf7f1]";
            if (!inMonth)
              style = "border border-transparent text-[#c4b9ac] bg-transparent";
            if (disabledPast)
              style =
                "bg-[#f3efe8] text-[#b2a89b] border-[#ebe4da] cursor-not-allowed";
            if (!disabledPast && !allowed && inMonth) {
              style =
                "bg-[#f8f2ef] text-[#a87474] border-[#f0dede] cursor-not-allowed";
            }
            if (selected) {
              style = "bg-[#8b6f47] text-white border-[#8b6f47] shadow";
            }

            return (
              <button
                key={idx}
                disabled={disabledPast || !allowed || !inMonth}
                onClick={() => handleDatePick(date)}
                className={`${base} ${style}`}
                title={
                  disabledPast
                    ? "Past date"
                    : !allowed
                    ? "Not in allowed frequency"
                    : has
                    ? `${has} slot(s) on this day`
                    : "No slots on this day"
                }
              >
                {date.getDate()}
                {!!has && (
                  <span
                    className={`absolute -top-1 -right-1 rounded-full px-1.5 py-0.5 text-[10px] border ${
                      selected
                        ? "bg-white text-[#8b6f47] border-white"
                        : "bg-[#efeae2] text-[#5a4a3f] border-[#e0dcd4]"
                    }`}
                  >
                    {has}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {selectedDateObj && (
          <div className="mt-3 text-xs text-[#7a6a5f]">
            Selected:{" "}
            <span className="font-medium text-[#5a4a3f]">
              {selectedDateObj.toLocaleDateString()}
            </span>
          </div>
        )}
      </div>
    );
  };

  // ---------- Render ----------
  return (
    <main className="max-w-6xl mx-auto pt-24 px-4 sm:px-6 lg:px-8">
      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#e5ded2] bg-white p-6 shadow-xl">
            <h2 className="text-center text-lg font-semibold text-[#5a4a3f]">
              Delete this slot?
            </h2>
            <p className="mt-2 text-center text-sm text-[#6b5e53]">
              This will <strong>also delete all related bookings</strong>.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <button
                onClick={confirmDelete}
                className="rounded-full bg-red-600 px-4 py-2 text-white hover:bg-red-700"
              >
                Yes, delete
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setConfirmDeleteId(null);
                }}
                className="rounded-full bg-gray-200 px-4 py-2 text-[#5a4a3f] hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky header */}
      <div className="sticky -top-0 z-10 -mx-4 mb-6 bg-gradient-to-b from-[#f4f1ec] to-transparent px-4 pt-2 pb-3">
        <button
          onClick={() => router.push("/admin")}
          className="inline-flex items-center gap-2 rounded-full border border-[#d8cfc3] bg-[#f4f1ec] px-4 py-2 text-sm font-medium text-[#5a4a3f] shadow hover:bg-[#eae5df]"
        >
          <ChevronLeft size={16} />
          Back to Dashboard
        </button>
      </div>

      <h1 className="text-center font-serif text-4xl font-bold text-[#5a4a3f]">
        Schedule Management
      </h1>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat
          icon={Calendar}
          label="Upcoming Slots"
          value={stats.upcomingCount}
        />
        <Stat icon={Users} label="Total Capacity" value={stats.totalSlots} />
        <Stat icon={Users} label="Total Booked" value={stats.booked} />
      </div>

      {/* Step 1 — Experience selection */}
      <section className="mt-8 rounded-2xl border border-[#e3dcd2] bg-[#f8f6f1] p-6 shadow-sm">
        <p className="mb-2 text-xs font-semibold tracking-wider text-[#7a6a5f]">
          STEP 1
        </p>
        <label className="mb-2 block text-sm font-medium text-[#5a4a3f]">
          Select Experience
        </label>
        <select
          value={selectedExperienceId}
          onChange={(e) => {
            setSelectedExperienceId(e.target.value);
            setSelectedDateObj(null);
            setNewSlot({ date: "", time: "", totalSlots: "" });
          }}
          className="w-full rounded-lg border border-[#d8cfc3] bg-white px-3 py-2 text-[#5a4a3f] focus:outline-none focus:ring-2 focus:ring-[#cbb89e]"
        >
          <option value="" disabled>
            Choose an experience…
          </option>
          {experiences.map((exp) => (
            <option key={exp.id} value={exp.id}>
              {exp.name}
            </option>
          ))}
        </select>

        {selectedExperience && (
          <div className="mt-4">
            <p className="text-sm text-[#6b5e53] font-medium">Allowed days</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(freq.length ? freq : ["—"]).map((day) => (
                <span
                  key={day}
                  className="rounded-full border border-[#e0dcd4] bg-white px-3 py-1 text-xs font-semibold tracking-wide text-[#5a4a3f] shadow-sm"
                >
                  {day}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Step 2 — Calendar + pick date */}
      {selectedExperienceId && (
        <section className="mt-8 grid gap-6 lg:grid-cols-[1.2fr,1fr]">
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wider text-[#7a6a5f]">
              STEP 2
            </p>
            <CalendarCard />
          </div>

          {/* Add slot form */}
          <div className="rounded-2xl border border-[#e3dcd2] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[#5a4a3f]">
              Add New Slot
            </h2>

            <div className="mt-4 grid gap-4">
              <div>
                <label className="mb-1 block text-xs text-[#7a6a5f]">
                  Date
                </label>
                <input
                  type="text"
                  value={newSlot.date}
                  readOnly
                  placeholder="Pick a date from the calendar"
                  className="w-full rounded-lg border border-[#dcd2c3] bg-[#fefcf9] px-3 py-2 text-[#5a4a3f]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-[#7a6a5f]">
                  Time
                </label>
                <div className="flex gap-2">
                  <input
                    type="time"
                    value={newSlot.time}
                    onChange={(e) =>
                      setNewSlot({ ...newSlot, time: e.target.value })
                    }
                    className="flex-1 rounded-lg border border-[#dcd2c3] bg-white px-3 py-2 text-[#5a4a3f] focus:outline-none focus:ring-2 focus:ring-[#cbb89e]"
                  />
                </div>
                {/* Quick time chips */}
                <div className="mt-2 flex flex-wrap gap-2">
                  {["09:00", "12:00", "15:00", "17:00"].map((t) => (
                    <button
                      type="button"
                      key={t}
                      onClick={() => setNewSlot((p) => ({ ...p, time: t }))}
                      className="rounded-full border border-[#e0dcd4] bg-[#faf7f1] px-3 py-1 text-xs text-[#5a4a3f] hover:bg-white"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-[#7a6a5f]">
                  Total Slots
                </label>
                <input
                  type="number"
                  min={1}
                  placeholder="e.g. 10"
                  value={newSlot.totalSlots}
                  onChange={(e) =>
                    setNewSlot({ ...newSlot, totalSlots: e.target.value })
                  }
                  className="w-full rounded-lg border border-[#dcd2c3] bg-white px-3 py-2 text-[#5a4a3f] focus:outline-none focus:ring-2 focus:ring-[#cbb89e]"
                />
              </div>

              <button
                onClick={handleAddSlot}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#8b6f47] px-5 py-3 text-white shadow hover:bg-[#7a5f3a]"
              >
                <PlusCircle size={18} /> Add Slot
              </button>
            </div>

            {/* Existing slots for selected day */}
            {selectedDateObj && (
              <div className="mt-6">
                <div className="mb-2 text-sm font-medium text-[#5a4a3f]">
                  Slots on {selectedDateObj.toLocaleDateString()}
                </div>
                {slotsOnSelectedDate.length ? (
                  <div className="grid gap-3">
                    {slotsOnSelectedDate.map((s) => (
                      <SlotRow key={s.id} s={s} />
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-[#7a6a5f]">
                    No slots yet for this day.
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Step 3 — Full lists */}
      {selectedExperienceId && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-[#5a4a3f] mb-4">
            All Scheduled Slots
          </h2>

          {loading ? (
            <div className="mt-8 flex items-center justify-center gap-3 text-[#7a6a5f]">
              <Loader2 className="animate-spin" size={18} />
              Loading slots…
            </div>
          ) : slots.length === 0 ? (
            <p className="text-sm text-gray-500">
              No slots found for this experience.
            </p>
          ) : (
            <>
              <div className="mb-10">
                <h3 className="mb-3 text-xl font-semibold text-[#5a4a3f]">
                  Upcoming
                </h3>
                {upcomingSlots.length ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {upcomingSlots.map((s) => (
                      <SlotRow key={s.id} s={s} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No upcoming slots.</p>
                )}
              </div>

              <div>
                <h3 className="mb-3 text-xl font-semibold text-[#5a4a3f]">
                  Past
                </h3>
                {pastSlots.length ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {pastSlots.map((s) => (
                      <SlotRow key={s.id} s={s} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No past slots.</p>
                )}
              </div>
            </>
          )}
        </section>
      )}
    </main>
  );
}
