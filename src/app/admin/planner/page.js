"use client";

// Availability planner. Two things it could not do before: see more than one
// experience at a time, and create more than one slot at a time.
import React from "react";
import toast from "react-hot-toast";

import Icon from "@/app/admin/_ui/Icon";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ErrorNote,
  Muted,
  Page,
  PageHeader,
  Select,
  Skeleton,
  StatCard,
  inputClass,
} from "@/app/admin/_ui";

/* -------------------------------- helpers -------------------------------- */

const pad = (n) => String(n).padStart(2, "0");
const toISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayName(d) {
  return d.toLocaleDateString("en-US", { weekday: "long" });
}

/** Six Monday-first weeks covering the month that `anchor` falls in. */
function monthGrid(anchor) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const weeks = [];
  for (let w = 0; w < 6; w++) {
    const row = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + w * 7 + i);
      row.push(d);
    }
    weeks.push(row);
  }
  return weeks;
}

const sameDay = (a, b) =>
  a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const timeOf = (iso) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

const longDate = (d) =>
  d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

/** Stable accent per experience so the month view is readable at a glance. */
const ACCENTS = ["#8b6f47", "#3a5d80", "#3f6b3f", "#8a6412", "#7a4a6a", "#a33c22", "#4a6b6b"];
const accentFor = (id, list) => {
  const i = list.findIndex((e) => e.id === id);
  return ACCENTS[(i < 0 ? 0 : i) % ACCENTS.length];
};

/* ================================== page ================================== */

export default function PlannerPage() {
  const [experiences, setExperiences] = React.useState([]);
  const [expLoaded, setExpLoaded] = React.useState(false);
  const [expFilter, setExpFilter] = React.useState("all");
  const [slots, setSlots] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [includeCancelled, setIncludeCancelled] = React.useState(true);

  const [month, setMonth] = React.useState(() => {
    const t = startOfToday();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = React.useState(() => startOfToday());

  const grid = React.useMemo(() => monthGrid(month), [month]);
  const rangeFrom = grid[0][0];
  const rangeTo = React.useMemo(() => {
    const d = new Date(grid[5][6]);
    d.setDate(d.getDate() + 1);
    return d;
  }, [grid]);

  /* ------------------------------ load data ----------------------------- */

  React.useEffect(() => {
    let alive = true;
    fetch("/api/admin/experiences", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => alive && setExperiences(Array.isArray(d) ? d : []))
      .catch(() => alive && toast.error("Could not load experiences."))
      .finally(() => alive && setExpLoaded(true));
    return () => {
      alive = false;
    };
  }, []);

  const load = React.useCallback(async () => {
    if (!expLoaded) return;
    if (!experiences.length) {
      setSlots([]);
      setLoading(false);
      return;
    }
    const targets =
      expFilter === "all" ? experiences : experiences.filter((e) => String(e.id) === expFilter);
    setLoading(true);
    try {
      // The endpoint is per-experience; with a handful of experiences fetching
      // them side by side is cheaper than adding a cross-experience route.
      const results = await Promise.all(
        targets.map(async (exp) => {
          const qs = new URLSearchParams({
            experienceId: String(exp.id),
            withUsage: "1",
            includeCancelled: String(includeCancelled),
            from: rangeFrom.toISOString(),
            to: rangeTo.toISOString(),
          });
          const res = await fetch(`/api/admin/schedule?${qs}`, { cache: "no-store" });
          if (!res.ok) {
            const e = await res.json().catch(() => ({}));
            throw new Error(e?.error || `Could not load ${exp.name}`);
          }
          const rows = await res.json();
          return (Array.isArray(rows) ? rows : []).map((s) => ({ ...s, experience: exp }));
        })
      );
      setSlots(
        results.flat().sort((a, b) => new Date(a.date) - new Date(b.date))
      );
      setError("");
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }, [expLoaded, experiences, expFilter, includeCancelled, rangeFrom, rangeTo]);

  React.useEffect(() => {
    load();
  }, [load]);

  /* ------------------------------- derived ------------------------------ */

  const byDay = React.useMemo(() => {
    const map = new Map();
    for (const s of slots) {
      const k = s.date.slice(0, 10);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(s);
    }
    return map;
  }, [slots]);

  const stats = React.useMemo(() => {
    const live = slots.filter((s) => !s.isCancelled);
    const total = live.reduce((n, s) => n + (Number(s.totalSlots) || 0), 0);
    const booked = live.reduce((n, s) => n + (Number(s.booked) || 0), 0);
    const soldOut = live.filter(
      (s) => (Number(s.totalSlots) || 0) > 0 && (Number(s.booked) || 0) >= Number(s.totalSlots)
    ).length;
    return {
      slots: live.length,
      seats: total,
      booked,
      available: Math.max(0, total - booked),
      fill: total ? Math.round((booked / total) * 100) : 0,
      soldOut,
    };
  }, [slots]);

  const daySlots = React.useMemo(
    () => byDay.get(toISODate(selectedDay)) || [],
    [byDay, selectedDay]
  );

  const monthLabel = month.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const selectedExperience =
    expFilter === "all" ? null : experiences.find((e) => String(e.id) === expFilter) || null;

  /* ------------------------------- actions ------------------------------ */

  async function setCancelled(slot, isCancelled) {
    try {
      const res = await fetch("/api/admin/schedule", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: slot.id, isCancelled }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Failed");
      toast.success(isCancelled ? "Slot cancelled." : "Slot restored.");
      load();
    } catch (e) {
      toast.error(String(e.message || e));
    }
  }

  async function removeSlot(slot) {
    const booked = Number(slot.booked) || 0;
    const msg = booked
      ? `${booked} guest${booked === 1 ? " has" : "s have"} booked this slot. It will be cancelled rather than deleted. Continue?`
      : "Delete this slot?";
    if (!confirm(msg)) return;
    try {
      const res = await fetch(`/api/admin/schedule?id=${slot.id}`, { method: "DELETE" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed");
      toast.success(payload?.message || "Done.");
      load();
    } catch (e) {
      toast.error(String(e.message || e));
    }
  }

  async function setCapacity(slot, totalSlots) {
    try {
      const res = await fetch("/api/admin/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: slot.id, totalSlots }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Failed");
      toast.success("Capacity updated.");
      load();
    } catch (e) {
      toast.error(String(e.message || e));
    }
  }

  /* -------------------------------- render ------------------------------ */

  return (
    <Page className="py-8">
      <PageHeader
        eyebrow="Operations"
        title="Planner"
        description="Every experience's availability on one calendar. Open a day to change it."
        actions={
          <>
            <Select
              value={expFilter}
              onChange={(e) => setExpFilter(e.target.value)}
              className="h-10 !w-auto min-w-[220px]"
              aria-label="Experience"
            >
              <option value="all">All experiences</option>
              {experiences.map((e) => (
                <option key={e.id} value={String(e.id)}>
                  {e.name}
                  {e.visibility === false ? " (hidden)" : ""}
                </option>
              ))}
            </Select>
            <Button variant="secondary" onClick={load} disabled={loading}>
              <Icon name="clock" size={14} /> {loading ? "Loading…" : "Refresh"}
            </Button>
          </>
        }
      />

      <GlobalPause />

      {error ? <ErrorNote className="mb-5">{error}</ErrorNote> : null}
      {expLoaded && !experiences.length ? (
        <ErrorNote className="mb-5">
          There are no experiences to plan yet — create one first.
        </ErrorNote>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={`Slots in ${monthLabel}`} value={stats.slots} icon={<Icon name="calendar" size={16} />} />
        <StatCard label="Seats offered" value={stats.seats} icon={<Icon name="users" size={16} />} />
        <StatCard
          label="Seats sold"
          value={stats.booked}
          hint={`${stats.available} still available`}
          icon={<Icon name="check" size={16} />}
          accent="success"
        />
        <StatCard
          label="Fill rate"
          value={`${stats.fill}%`}
          hint={stats.soldOut ? `${stats.soldOut} sold out` : "None sold out"}
          icon={<Icon name="chart" size={16} />}
          accent={stats.fill >= 70 ? "warning" : "brand"}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px] xl:items-start">
        {/* ------------------------------ calendar ---------------------------- */}
        <Card padded={false} className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e6e0d6] p-4">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Previous month"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              >
                ‹
              </Button>
              <span className="min-w-[160px] text-center font-serif text-[17px] text-[#2a211a]">
                {monthLabel}
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Next month"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              >
                ›
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const t = startOfToday();
                  setMonth(new Date(t.getFullYear(), t.getMonth(), 1));
                  setSelectedDay(t);
                }}
              >
                Today
              </Button>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-[12px] text-[#6b5c4d]">
              <input
                type="checkbox"
                checked={includeCancelled}
                onChange={(e) => setIncludeCancelled(e.target.checked)}
                className="h-3.5 w-3.5 accent-[#8b6f47]"
              />
              Show cancelled
            </label>
          </div>

          <div className="grid grid-cols-7 border-b border-[#e6e0d6] bg-[#faf8f4]">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9a8c7e]"
              >
                {d.slice(0, 3)}
              </div>
            ))}
          </div>

          {loading && !slots.length ? (
            <div className="grid grid-cols-7">
              {Array.from({ length: 42 }).map((_, i) => (
                <div key={i} className="border-b border-r border-[#f0ebe2] p-2">
                  <Skeleton className="h-16" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7">
              {grid.flat().map((d) => {
                const key = toISODate(d);
                const list = byDay.get(key) || [];
                const inMonth = d.getMonth() === month.getMonth();
                const isToday = sameDay(d, startOfToday());
                const isSelected = sameDay(d, selectedDay);
                const live = list.filter((s) => !s.isCancelled);
                const total = live.reduce((n, s) => n + (Number(s.totalSlots) || 0), 0);
                const booked = live.reduce((n, s) => n + (Number(s.booked) || 0), 0);
                const pct = total ? Math.min(100, Math.round((booked / total) * 100)) : 0;

                return (
                  <button
                    key={key}
                    onClick={() => setSelectedDay(new Date(d))}
                    className={[
                      "min-h-[92px] border-b border-r border-[#f0ebe2] p-1.5 text-left align-top transition-colors",
                      inMonth ? "bg-white" : "bg-[#fcfaf7]",
                      isSelected ? "ring-2 ring-inset ring-[#8b6f47]" : "hover:bg-[#faf8f4]",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[11px]",
                        isToday ? "bg-[#2a211a] font-semibold text-white" : "",
                        inMonth ? "text-[#2a211a]" : "text-[#c0b4a6]",
                      ].join(" ")}
                    >
                      {d.getDate()}
                    </span>

                    <span className="mt-1 block space-y-0.5">
                      {list.slice(0, 3).map((s) => (
                        <span
                          key={s.id}
                          className={[
                            "flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px]",
                            s.isCancelled
                              ? "text-[#b0a294] line-through"
                              : "text-[#3f3127]",
                          ].join(" ")}
                          style={
                            s.isCancelled
                              ? undefined
                              : { background: `${accentFor(s.experienceId, experiences)}14` }
                          }
                        >
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ background: accentFor(s.experienceId, experiences) }}
                          />
                          {timeOf(s.date)}
                          <span className="ml-auto shrink-0 tabular-nums text-[#7a6a5f]">
                            {s.booked ?? 0}/{s.totalSlots ?? 0}
                          </span>
                        </span>
                      ))}
                      {list.length > 3 ? (
                        <span className="block px-1 text-[10px] text-[#9a8c7e]">
                          +{list.length - 3} more
                        </span>
                      ) : null}
                    </span>

                    {total > 0 ? (
                      <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-[#f0ebe2]">
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            background: pct >= 100 ? "#a33c22" : pct >= 70 ? "#8a6412" : "#8b6f47",
                          }}
                        />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}

          {expFilter === "all" && experiences.length ? (
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-[#e6e0d6] p-3">
              {experiences.map((e) => (
                <span key={e.id} className="flex items-center gap-1.5 text-[11px] text-[#6b5c4d]">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: accentFor(e.id, experiences) }}
                  />
                  {e.name}
                </span>
              ))}
            </div>
          ) : null}
        </Card>

        {/* ------------------------------- day rail --------------------------- */}
        <div className="space-y-5">
          <Card>
            <CardHeader
              title={longDate(selectedDay)}
              description={
                daySlots.length
                  ? `${daySlots.length} slot${daySlots.length === 1 ? "" : "s"}`
                  : "Nothing scheduled"
              }
            />
            {!daySlots.length ? (
              <Muted className="text-[12.5px]">
                Use the form below to open this day for booking.
              </Muted>
            ) : (
              <ul className="space-y-2">
                {daySlots.map((s) => (
                  <SlotRow
                    key={s.id}
                    slot={s}
                    showExperience={expFilter === "all"}
                    accent={accentFor(s.experienceId, experiences)}
                    onCapacity={setCapacity}
                    onCancel={setCancelled}
                    onDelete={removeSlot}
                  />
                ))}
              </ul>
            )}
          </Card>

          <AddAvailability
            experiences={experiences}
            selectedExperience={selectedExperience}
            selectedDay={selectedDay}
            onCreated={load}
          />
        </div>
      </div>
    </Page>
  );
}

/* ------------------------------- slot row -------------------------------- */

function SlotRow({ slot, showExperience, accent, onCapacity, onCancel, onDelete }) {
  const [editing, setEditing] = React.useState(false);
  const booked = Number(slot.booked) || 0;
  const total = Number(slot.totalSlots) || 0;
  const holds = Number(slot.holds) || 0;
  const available = Number.isFinite(slot.available) ? slot.available : Math.max(0, total - booked);
  const [draft, setDraft] = React.useState(String(total));
  const pct = total ? Math.min(100, Math.round((booked / total) * 100)) : 0;
  const past = new Date(slot.date) < new Date();

  return (
    <li
      className={`rounded-xl border p-3 ${
        slot.isCancelled ? "border-[#f3d5cb] bg-[#fdf6f4]" : "border-[#e6e0d6] bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[14px] font-semibold text-[#2a211a]">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: accent }} />
            {timeOf(slot.date)}
            {slot.isCancelled ? <Badge variant="danger">Cancelled</Badge> : null}
            {past && !slot.isCancelled ? <Badge variant="neutral">Past</Badge> : null}
          </p>
          {showExperience ? (
            <p className="mt-0.5 truncate text-[11.5px] text-[#7a6a5f]">{slot.experience?.name}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            title="Change capacity"
            onClick={() => {
              setDraft(String(total));
              setEditing((v) => !v);
            }}
          >
            <Icon name="cog" size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title={slot.isCancelled ? "Restore this slot" : "Cancel this slot"}
            onClick={() => onCancel(slot, !slot.isCancelled)}
          >
            <Icon name={slot.isCancelled ? "check" : "ban"} size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Delete"
            className="text-[#a33c22] hover:bg-[#fbeae5]"
            onClick={() => onDelete(slot)}
          >
            <Icon name="trash" size={14} />
          </Button>
        </div>
      </div>

      {editing ? (
        <div className="mt-3 flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            aria-label="Total seats"
            className={`${inputClass} h-9 w-24`}
          />
          <Muted className="flex-1 text-[11px]">
            Total seats. {booked} already booked — cannot go below that.
          </Muted>
          <Button
            size="sm"
            variant="primary"
            disabled={Number(draft) < booked || draft === ""}
            onClick={() => {
              onCapacity(slot, Number(draft));
              setEditing(false);
            }}
          >
            Save
          </Button>
        </div>
      ) : (
        <div className="mt-2.5">
          <div className="flex justify-between text-[12px]">
            <span className="text-[#7a6a5f]">
              <span className="font-semibold text-[#2a211a]">{booked}</span> of {total} booked
            </span>
            <span className="text-[#9a8c7e]">
              {available} free{holds > 0 ? ` · ${holds} held` : ""}
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#f0ebe2]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${pct}%`,
                background: pct >= 100 ? "#a33c22" : pct >= 70 ? "#8a6412" : "#8b6f47",
              }}
            />
          </div>
        </div>
      )}
    </li>
  );
}

/* --------------------------- add / bulk creation -------------------------- */

function AddAvailability({ experiences, selectedExperience, selectedDay, onCreated }) {
  const [mode, setMode] = React.useState("single");
  const [expId, setExpId] = React.useState("");
  const [times, setTimes] = React.useState("10:00");
  const [capacity, setCapacity] = React.useState("10");
  const [weekdays, setWeekdays] = React.useState([]);
  const [until, setUntil] = React.useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 56);
    return toISODate(d);
  });
  const [busy, setBusy] = React.useState(false);

  // Follow the page's experience filter, but stay changeable.
  React.useEffect(() => {
    if (selectedExperience) setExpId(String(selectedExperience.id));
  }, [selectedExperience]);

  const experience = experiences.find((e) => String(e.id) === expId) || null;
  const allowedDays = React.useMemo(
    () => (Array.isArray(experience?.frequency) ? experience.frequency : []),
    [experience]
  );

  // Default the weekday picks to whatever the experience actually runs on.
  React.useEffect(() => {
    setWeekdays(allowedDays.length ? allowedDays : WEEKDAYS);
  }, [allowedDays]);

  const timeList = React.useMemo(
    () =>
      times
        .split(/[,\s]+/)
        .map((t) => t.trim())
        .filter((t) => /^\d{1,2}:\d{2}$/.test(t)),
    [times]
  );

  // Work out exactly which instants will be created, so the operator can see
  // the damage before doing it.
  const occurrences = React.useMemo(() => {
    if (!expId || !timeList.length || !Number(capacity)) return [];
    const out = [];
    const now = Date.now();
    if (mode === "single") {
      for (const t of timeList) {
        const d = new Date(`${toISODate(selectedDay)}T${t}`);
        if (d.getTime() > now) out.push(d);
      }
      return out;
    }
    const end = new Date(`${until}T23:59:59`);
    const cursor = new Date(selectedDay);
    let guard = 0;
    while (cursor <= end && guard++ < 400) {
      if (weekdays.includes(dayName(cursor))) {
        for (const t of timeList) {
          const d = new Date(`${toISODate(cursor)}T${t}`);
          if (d.getTime() > now) out.push(d);
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return out.slice(0, 400);
  }, [mode, expId, timeList, capacity, selectedDay, until, weekdays]);

  const outsideFrequency = React.useMemo(
    () => (allowedDays.length ? weekdays.filter((d) => !allowedDays.includes(d)) : []),
    [weekdays, allowedDays]
  );

  async function create() {
    if (!expId) return toast.error("Choose an experience.");
    if (!occurrences.length) return toast.error("Nothing to create — check the times and dates.");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/schedule/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experienceId: Number(expId),
          totalSlots: Number(capacity),
          slots: occurrences.map((d) => ({ date: d.toISOString() })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Could not create the slots");
      const { created = 0, skipped = 0 } = data.summary || {};
      toast.success(
        `${created} slot${created === 1 ? "" : "s"} created` +
          (skipped ? ` · ${skipped} skipped (already scheduled or past)` : "")
      );
      onCreated?.();
    } catch (e) {
      toast.error(String(e.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Add availability"
        description="One day, or the same pattern for weeks ahead."
      />

      <div className="mb-4 flex gap-1 rounded-xl bg-[#f5f0e8] p-1">
        {[
          ["single", "This day"],
          ["repeat", "Repeating"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
              mode === key ? "bg-white text-[#2a211a] shadow-sm" : "text-[#6b5c4d]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <div>
          <span className="mb-1.5 block text-[12px] font-semibold text-[#3f3127]">Experience</span>
          <Select value={expId} onChange={(e) => setExpId(e.target.value)} aria-label="Experience">
            <option value="">Choose…</option>
            {experiences.map((e) => (
              <option key={e.id} value={String(e.id)}>
                {e.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="mb-1.5 block text-[12px] font-semibold text-[#3f3127]">
              Time{timeList.length > 1 ? "s" : ""}
            </span>
            <input
              value={times}
              onChange={(e) => setTimes(e.target.value)}
              placeholder="10:00, 16:00"
              aria-label="Times"
              className={inputClass}
            />
          </div>
          <div>
            <span className="mb-1.5 block text-[12px] font-semibold text-[#3f3127]">Seats</span>
            <input
              value={capacity}
              onChange={(e) => setCapacity(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              aria-label="Seats per slot"
              className={inputClass}
            />
          </div>
        </div>

        {mode === "repeat" ? (
          <>
            <div>
              <span className="mb-1.5 block text-[12px] font-semibold text-[#3f3127]">
                On these days
              </span>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((d) => {
                  const on = weekdays.includes(d);
                  const allowed = !allowedDays.length || allowedDays.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      title={allowed ? d : `${d} — outside this experience's usual days`}
                      onClick={() =>
                        setWeekdays((prev) =>
                          prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
                        )
                      }
                      className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition ${
                        on
                          ? "border-[#2a211a] bg-[#2a211a] text-white"
                          : allowed
                            ? "border-[#e6e0d6] bg-white text-[#5c4d40]"
                            : "border-dashed border-[#e6e0d6] bg-white text-[#b0a294]"
                      }`}
                    >
                      {d.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="mb-1.5 block text-[12px] font-semibold text-[#3f3127]">Until</span>
              <input
                type="date"
                value={until}
                min={toISODate(selectedDay)}
                onChange={(e) => setUntil(e.target.value)}
                aria-label="Repeat until"
                className={inputClass}
              />
            </div>
          </>
        ) : null}

        {outsideFrequency.length ? (
          <Muted className="text-[11.5px]">
            {outsideFrequency.join(", ")} {outsideFrequency.length === 1 ? "is" : "are"} outside
            this experience&rsquo;s usual days — slots will still be created.
          </Muted>
        ) : null}

        <div className="rounded-xl bg-[#faf8f4] px-3 py-2.5">
          {occurrences.length ? (
            <>
              <p className="text-[13px] text-[#2a211a]">
                <span className="font-semibold">{occurrences.length}</span> slot
                {occurrences.length === 1 ? "" : "s"} ·{" "}
                {occurrences.length * Number(capacity || 0)} seats
              </p>
              <p className="mt-0.5 text-[11.5px] text-[#9a8c7e]">
                {occurrences[0].toLocaleDateString("en-GB", { day: "numeric", month: "short" })}{" "}
                {timeOf(occurrences[0].toISOString())}
                {occurrences.length > 1
                  ? ` → ${occurrences[occurrences.length - 1].toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}`
                  : ""}
              </p>
            </>
          ) : (
            <p className="text-[12.5px] text-[#9a8c7e]">
              {expId ? "Nothing to create yet." : "Choose an experience to begin."}
            </p>
          )}
        </div>

        <Button
          variant="primary"
          className="w-full"
          disabled={busy || !occurrences.length}
          onClick={create}
        >
          {busy
            ? "Creating…"
            : `Create ${occurrences.length || ""} slot${occurrences.length === 1 ? "" : "s"}`}
        </Button>
        <Muted className="text-[11px]">
          Slots that already exist, or fall in the past, are skipped rather than duplicated.
        </Muted>
      </div>
    </Card>
  );
}

/* ----------------------------- global pause ------------------------------ */

function GlobalPause() {
  const [state, setState] = React.useState({ paused: false, message: "", until: "" });
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    fetch("/api/admin/settings/bookings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setState({
          paused: !!d.bookingsPaused,
          message: d.bookingsPausedMessage || "",
          until: d.bookingsPausedUntil ? String(d.bookingsPausedUntil).slice(0, 16) : "",
        });
      })
      .catch(() => toast.error("Could not load the booking pause setting."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  async function save(next) {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings/bookings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingsPaused: !!next.paused,
          bookingsPausedMessage: next.message?.trim() || null,
          bookingsPausedUntil: next.until ? new Date(next.until).toISOString() : null,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setState(next);
      toast.success(next.paused ? "Bookings paused site-wide." : "Bookings resumed.");
      if (!next.paused) setOpen(false);
    } catch {
      toast.error("Could not update the booking pause setting.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;

  return (
    <div
      className={`mb-6 rounded-2xl border p-4 ${
        state.paused ? "border-[#e8d9b0] bg-[#fdf7e8]" : "border-[#e6e0d6] bg-white"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={state.paused ? "text-[#8a6412]" : "text-[#3f6b3f]"}>
            <Icon name={state.paused ? "warning" : "check"} size={17} />
          </span>
          <div>
            <p className="text-[13.5px] font-semibold text-[#2a211a]">
              {state.paused ? "Bookings are paused site-wide" : "Bookings are open"}
            </p>
            <Muted className="text-[12px]">
              {state.paused
                ? state.message || "Customers cannot book any experience."
                : "Customers can book any experience with availability."}
            </Muted>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
            {open ? "Close" : "Settings"}
          </Button>
          <Button
            variant={state.paused ? "primary" : "secondary"}
            size="sm"
            disabled={saving}
            onClick={() => save({ ...state, paused: !state.paused })}
          >
            {state.paused ? "Resume bookings" : "Pause bookings"}
          </Button>
        </div>
      </div>

      {open ? (
        <div className="mt-4 grid gap-3 border-t border-[#eee8de] pt-4 sm:grid-cols-2">
          <div>
            <span className="mb-1.5 block text-[12px] font-semibold text-[#3f3127]">
              Message for customers
            </span>
            <input
              value={state.message}
              onChange={(e) => setState((s) => ({ ...s, message: e.target.value }))}
              placeholder="Back on Monday — thank you for your patience."
              className={inputClass}
            />
          </div>
          <div>
            <span className="mb-1.5 block text-[12px] font-semibold text-[#3f3127]">
              Paused until (optional)
            </span>
            <div className="flex gap-2">
              <input
                type="datetime-local"
                value={state.until}
                onChange={(e) => setState((s) => ({ ...s, until: e.target.value }))}
                className={inputClass}
              />
              <Button variant="primary" disabled={saving} onClick={() => save(state)}>
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
