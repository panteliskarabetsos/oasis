"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  addDays, addMonths, eachDayOfInterval, endOfDay, endOfMonth, endOfWeek,
  format, isSameDay, isSameMonth, startOfDay, startOfMonth, startOfWeek,
  subDays, subMonths,
} from "date-fns";

import Icon from "../_ui/Icon";
import { can, effectiveAccess } from "../_ui/nav";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Page,
  PageHeader,
  Select,
  Skeleton,
  inputClass,
} from "../_ui";

/**
 * /admin/schedule — the daily manifest.
 *
 * GET /api/admin/schedule/overview?from&to&experienceId
 *   -> { items: [{ id, date, experienceName, totalSlots, totalBooked,
 *                  isCancelled, bookings: [{ id, code, pax, guestName, meetupPoint }] }] }
 * GET /api/admin/schedule/active-dates?from&to&experienceId -> dates with tours
 * GET /api/admin/experiences?limit=50 -> { items }
 */

const groupSlotsByDay = (slots) =>
  slots.reduce((acc, slot) => {
    const day = format(new Date(slot.date), "yyyy-MM-dd");
    (acc[day] ||= []).push(slot);
    return acc;
  }, {});

const NO_PICKUP = /^no pickup set$/i;

export default function SchedulePage() {
  // Partners hold "schedule" but not "bookings", so the booking link has to be
  // conditional or it is a dead end for exactly the people using this screen.
  const [access, setAccess] = useState([]);
  useEffect(() => {
    fetch("/api/me", { cache: "no-store", credentials: "include" })
      .then((r) => r.json())
      .then((me) => setAccess(effectiveAccess(me?.role, me?.permissions)))
      .catch(() => {});
  }, []);
  const canOpenBooking = can(access, "bookings");

  const [view, setView] = useState("day"); // 'day' | 'week'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [experienceId, setExperienceId] = useState("all");
  const [experiences, setExperiences] = useState([]);

  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCalendar, setShowCalendar] = useState(false);
  const [query, setQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const { from, to, title } = useMemo(() => {
    if (view === "day") {
      return {
        from: startOfDay(currentDate).toISOString(),
        to: endOfDay(currentDate).toISOString(),
        title: format(currentDate, "EEEE, MMMM do, yyyy"),
      };
    }
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return {
      from: startOfDay(start).toISOString(),
      to: endOfDay(end).toISOString(),
      title: `${format(start, "MMM do")} – ${format(end, "MMM do, yyyy")}`,
    };
  }, [view, currentDate]);

  useEffect(() => {
    fetch("/api/admin/experiences?limit=50", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setExperiences(d.items || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      setLoading(true);
      setError("");
      try {
        const qs = new URLSearchParams({ from, to });
        if (experienceId !== "all") qs.set("experienceId", experienceId);
        const res = await fetch(`/api/admin/schedule/overview?${qs}`, {
          signal: ctrl.signal,
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || `Failed to load the schedule (${res.status})`);
        }
        const data = await res.json();
        setSlots(data.items || []);
      } catch (e) {
        if (e?.name !== "AbortError") {
          setError(e.message || "Failed to load the schedule");
          setSlots([]);
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [from, to, experienceId, refreshKey]);

  /* ------------------------------- derived -------------------------------- */

  const visibleSlots = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return slots;
    return slots
      .map((s) => ({
        ...s,
        bookings: (s.bookings || []).filter((b) =>
          [b.guestName, b.code, b.meetupPoint, String(b.id)].join(" ").toLowerCase().includes(q)
        ),
      }))
      .filter((s) => s.bookings.length || (s.experienceName || "").toLowerCase().includes(q));
  }, [slots, query]);

  const totals = useMemo(() => {
    const active = visibleSlots.filter((s) => !s.isCancelled);
    return {
      tours: active.length,
      cancelled: visibleSlots.length - active.length,
      guests: active.reduce((sum, s) => sum + (s.totalBooked || 0), 0),
      capacity: active.reduce((sum, s) => sum + (s.totalSlots || 0), 0),
      noPickup: active.reduce(
        (sum, s) => sum + (s.bookings || []).filter((b) => NO_PICKUP.test(b.meetupPoint || "")).length,
        0
      ),
    };
  }, [visibleSlots]);

  const grouped = useMemo(() => groupSlotsByDay(visibleSlots), [visibleSlots]);
  const sortedDays = useMemo(() => Object.keys(grouped).sort(), [grouped]);

  /* -------------------------------- actions -------------------------------- */

  const shift = (dir) =>
    setCurrentDate((prev) =>
      view === "day"
        ? dir < 0 ? subDays(prev, 1) : addDays(prev, 1)
        : dir < 0 ? subDays(prev, 7) : addDays(prev, 7)
    );

  function exportCsv() {
    const head = ["date", "time", "experience", "booking_id", "code", "guest", "pax", "meetup_point"];
    const rows = [];
    for (const s of visibleSlots) {
      const d = new Date(s.date);
      for (const b of s.bookings || []) {
        rows.push([
          format(d, "yyyy-MM-dd"), format(d, "HH:mm"), s.experienceName,
          b.id, b.code, b.guestName, b.pax, b.meetupPoint,
        ]);
      }
    }
    if (!rows.length) return;
    const csv = [head, ...rows]
      .map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `manifest-${format(currentDate, "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* --------------------------------- view ---------------------------------- */

  return (
    <Page className="print:max-w-none print:px-0">
      <style>{`
        @media print {
          @page { margin: 14mm; }
          body { background: #fff !important; }
          .no-print { display: none !important; }
          .print-block { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div className="no-print">
        <PageHeader
          eyebrow="Operations"
          title="Daily manifest"
          description={title}
          actions={
            <>
              <Button variant="secondary" onClick={() => setRefreshKey((k) => k + 1)} disabled={loading}>
                <Icon name="clock" size={15} /> Refresh
              </Button>
              <Button variant="secondary" onClick={exportCsv} disabled={!totals.guests}>
                <Icon name="download" size={15} /> CSV
              </Button>
              <Button variant="primary" onClick={() => window.print()}>
                <Icon name="file" size={15} /> Print
              </Button>
            </>
          }
        />
      </div>

      {/* print-only header */}
      <div className="mb-6 hidden border-b-2 border-black pb-3 print:block">
        <h1 className="font-serif text-[22px] font-bold">Daily manifest</h1>
        <p className="text-[13px]">
          {title}
          {experienceId !== "all"
            ? ` — ${experiences.find((e) => String(e.id) === String(experienceId))?.name || ""}`
            : ""}
        </p>
        <p className="mt-1 text-[12px]">
          {totals.tours} tour{totals.tours === 1 ? "" : "s"} · {totals.guests} guest
          {totals.guests === 1 ? "" : "s"} · printed {format(new Date(), "d MMM yyyy HH:mm")}
        </p>
      </div>

      {/* controls */}
      <Card className="no-print mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="icon" onClick={() => shift(-1)} aria-label="Previous">‹</Button>
          <Button variant="secondary" onClick={() => setCurrentDate(new Date())}>Today</Button>
          <Button variant="secondary" size="icon" onClick={() => shift(1)} aria-label="Next">›</Button>

          <div className="relative">
            <Button variant="ghost" onClick={() => setShowCalendar((v) => !v)}>
              <Icon name="calendar" size={15} />
              <span className="max-w-[220px] truncate">{title}</span>
            </Button>
            {showCalendar ? (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowCalendar(false)} />
                <div className="absolute left-0 top-full z-40 mt-2">
                  <MiniCalendar
                    selectedDate={currentDate}
                    experienceId={experienceId}
                    onSelect={(d) => { setCurrentDate(d); setShowCalendar(false); }}
                  />
                </div>
              </>
            ) : null}
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="relative min-w-[190px]">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#b0a294]">
                <Icon name="search" size={16} />
              </span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Guest, code or pickup"
                className={`${inputClass} h-10 pl-9 ${query ? "pr-9" : ""}`}
              />
              {query ? (
                <button onClick={() => setQuery("")} aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#9a8c7e] hover:bg-[#f2ede4]">
                  <Icon name="x" size={14} />
                </button>
              ) : null}
            </div>

            <Select
              value={experienceId}
              onChange={(e) => setExperienceId(e.target.value)}
              className="h-10 !w-auto min-w-[170px]"
            >
              <option value="all">All experiences</option>
              {experiences.map((ex) => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </Select>

            <div className="inline-flex rounded-xl border border-[#e6e0d6] bg-white p-1">
              {[["day", "Day"], ["week", "Week"]].map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                    view === v ? "bg-[#2a211a] text-white" : "text-[#6b5c4d] hover:bg-[#f2ede4]"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* totals */}
      {!loading && !error && visibleSlots.length ? (
        <div className="no-print mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Tours" value={totals.tours} hint={totals.cancelled ? `${totals.cancelled} cancelled` : undefined} />
          <Stat label="Guests" value={totals.guests} />
          <Stat
            label="Capacity used"
            value={totals.capacity ? `${Math.round((totals.guests / totals.capacity) * 100)}%` : "—"}
            hint={totals.capacity ? `${totals.guests} of ${totals.capacity}` : undefined}
          />
          <Stat
            label="No pickup set"
            value={totals.noPickup}
            accent={totals.noPickup > 0 ? "warn" : undefined}
            hint={totals.noPickup ? "needs a meeting point" : "all set"}
          />
        </div>
      ) : null}

      {/* manifest */}
      {error ? (
        <Card className="no-print">
          <ErrorNote>{error}</ErrorNote>
          <Button className="mt-3" variant="secondary" onClick={() => setRefreshKey((k) => k + 1)}>Try again</Button>
        </Card>
      ) : loading ? (
        <div className="space-y-4">
          {[0, 1].map((i) => <Skeleton key={i} className="h-56" />)}
        </div>
      ) : !sortedDays.length ? (
        <Card>
          <EmptyState
            icon={<Icon name="calendar" size={20} />}
            title={query ? "Nothing matches" : "No tours scheduled"}
            description={
              query
                ? "No guests or tours match your search in this range."
                : "Try a different date range or experience."
            }
            action={query ? <Button variant="secondary" onClick={() => setQuery("")}>Clear search</Button> : null}
          />
        </Card>
      ) : (
        <div className="space-y-7">
          {sortedDays.map((day) => {
            const daySlots = grouped[day];
            const dateObj = new Date(day);
            const today = isSameDay(dateObj, new Date());
            const dayGuests = daySlots.reduce((s, x) => s + (x.totalBooked || 0), 0);

            return (
              <section key={day} className="print-block">
                <div className="mb-3 flex items-center gap-2 border-b border-[#e6e0d6] pb-2 print:border-black">
                  <h2 className="font-serif text-[18px] text-[#2a211a]">
                    {format(dateObj, "EEEE, d MMMM")}
                  </h2>
                  {today ? <Badge variant="brand">Today</Badge> : null}
                  <span className="ml-auto text-[12.5px] text-[#7a6a5f]">
                    {daySlots.length} tour{daySlots.length === 1 ? "" : "s"} · {dayGuests} guest
                    {dayGuests === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 print:grid-cols-1 print:gap-5">
                  {daySlots.map((slot) => (
                    <SlotCard key={slot.id} slot={slot} canOpenBooking={canOpenBooking} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </Page>
  );
}

/* ------------------------------- components ------------------------------- */

function Stat({ label, value, hint, accent }) {
  const color = accent === "warn" ? "text-[#8a6412]" : "text-[#2a211a]";
  return (
    <Card className="py-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9a8c7e]">{label}</p>
      <p className={`mt-1 font-serif text-[20px] ${color}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11.5px] text-[#9a8c7e]">{hint}</p> : null}
    </Card>
  );
}

function SlotCard({ slot, canOpenBooking }) {
  const booked = slot.totalBooked || 0;
  const cap = slot.totalSlots || 0;
  const pct = cap > 0 ? Math.min(100, (booked / cap) * 100) : 0;
  const full = cap > 0 && booked >= cap;

  return (
    <Card padded={false} className="print-block overflow-hidden print:rounded-none print:border-black print:shadow-none">
      <div className="border-b border-[#e6e0d6] bg-[#fdfbf7] px-4 py-3 print:border-black print:bg-transparent">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-[18px] text-[#2a211a]">
                {format(new Date(slot.date), "HH:mm")}
              </span>
              <span className="truncate text-[14px] font-medium text-[#6b5c4d]">
                {slot.experienceName}
              </span>
            </div>
            <p className="mt-0.5 text-[12px] font-medium text-[#9a8c7e]">
              {booked} / {cap || "—"} guests booked
            </p>
          </div>
          {slot.isCancelled ? <Badge variant="danger">Cancelled</Badge> : full ? <Badge variant="warning">Full</Badge> : null}
        </div>

        {!slot.isCancelled && cap > 0 ? (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#efe9df] print:hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${full ? "bg-[#a33c22]" : "bg-[#8b6f47]"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        ) : null}
      </div>

      {slot.bookings?.length ? (
        <ul className="divide-y divide-[#f0ebe2] print:divide-dashed print:divide-gray-400">
          {slot.bookings.map((b) => (
            <GuestRow key={b.id} booking={b} canOpenBooking={canOpenBooking} />
          ))}
        </ul>
      ) : (
        <p className="px-4 py-5 text-center text-[13px] italic text-[#9a8c7e] print:text-left">
          No active bookings yet.
        </p>
      )}

      {/* signature strip for the guide's printed copy */}
      {slot.bookings?.length ? (
        <div className="hidden border-t border-black px-4 py-3 text-[11px] print:block">
          Guide: ______________________ &nbsp;&nbsp; Departed: ________ &nbsp;&nbsp; Returned: ________
        </div>
      ) : null}
    </Card>
  );
}

/**
 * One guest on the manifest. Tapping opens their contact details inline —
 * a guide needs to phone a no-show, and the booking page they used to link to
 * needs the "bookings" permission, which partners do not have.
 */
function GuestRow({ booking: b, canOpenBooking }) {
  const [open, setOpen] = useState(false);
  const noPickup = NO_PICKUP.test(b.meetupPoint || "");
  const hasContact = Boolean(b.email || b.phone || b.notes);

  return (
    <li className="px-4 py-2.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="group flex w-full items-center justify-between gap-3 text-left print:pointer-events-none"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13.5px] font-semibold text-[#2a211a] group-hover:text-[#8b6f47]">
              {b.guestName}
            </span>
            <span className="shrink-0 rounded-full bg-[#f2ede4] px-2 py-0.5 text-[11px] font-semibold text-[#6b5c4d] print:border print:border-black print:bg-transparent">
              {b.pax} pax
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px]">
            <Icon name="leaf" size={12} className={noPickup ? "text-[#c9a227]" : "text-[#6b8f6b]"} />
            <span className={`truncate ${noPickup ? "font-medium text-[#8a6412]" : "text-[#7a6a5f]"}`}>
              {b.meetupPoint}
            </span>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-2">
          <span className="font-mono text-[10.5px] text-[#9a8c7e] print:text-black">{b.code}</span>
          <span className={`text-[#b0a294] transition-transform print:hidden ${open ? "rotate-90" : ""}`}>
            <Icon name="external" size={12} />
          </span>
        </span>
      </button>

      {open ? (
        <div className="mt-2.5 rounded-xl border border-[#e6e0d6] bg-[#fdfbf7] p-3 print:hidden">
          {hasContact ? (
            <dl className="space-y-2 text-[12.5px]">
              {b.phone ? (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[#9a8c7e]">Phone</dt>
                  <dd>
                    <a href={`tel:${b.phone}`} className="font-medium text-[#8b6f47] hover:underline">
                      {b.phone}
                    </a>
                  </dd>
                </div>
              ) : null}
              {b.email ? (
                <div className="flex items-center justify-between gap-3">
                  <dt className="shrink-0 text-[#9a8c7e]">Email</dt>
                  <dd className="min-w-0">
                    <a
                      href={`mailto:${b.email}`}
                      className="block truncate font-medium text-[#8b6f47] hover:underline"
                    >
                      {b.email}
                    </a>
                  </dd>
                </div>
              ) : null}
              {b.notes ? (
                <div>
                  <dt className="text-[#9a8c7e]">Notes</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-[#3f3127]">{b.notes}</dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="text-[12.5px] text-[#9a8c7e]">
              No contact details on this booking.
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2 border-t border-[#f0ebe2] pt-2.5">
            {b.phone ? (
              <Button as="a" href={`tel:${b.phone}`} size="sm" variant="secondary">
                Call
              </Button>
            ) : null}
            {b.email ? (
              <Button as="a" href={`mailto:${b.email}`} size="sm" variant="secondary">
                Email
              </Button>
            ) : null}
            {canOpenBooking ? (
              <Button as={Link} href={`/admin/bookings/${b.id}`} size="sm" variant="ghost">
                Open booking
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}

function MiniCalendar({ selectedDate, experienceId, onSelect }) {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(selectedDate));
  const [activeDates, setActiveDates] = useState(() => new Set());

  const loadActive = useCallback(async () => {
    const qs = new URLSearchParams({
      from: startOfDay(startOfMonth(viewMonth)).toISOString(),
      to: endOfDay(endOfMonth(viewMonth)).toISOString(),
    });
    if (experienceId !== "all") qs.set("experienceId", experienceId);
    try {
      const res = await fetch(`/api/admin/schedule/active-dates?${qs}`, { credentials: "include" });
      const data = await res.json();
      setActiveDates(new Set(data.items || []));
    } catch {
      setActiveDates(new Set());
    }
  }, [viewMonth, experienceId]);

  useEffect(() => { loadActive(); }, [loadActive]);

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 1 }),
  });

  return (
    <div className="w-[290px] rounded-2xl border border-[#e6e0d6] bg-white p-3 shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <button onClick={() => setViewMonth((m) => subMonths(m, 1))} aria-label="Previous month"
          className="rounded-lg p-1.5 text-[#7a6a5f] hover:bg-[#f2ede4]">‹</button>
        <span className="font-serif text-[15px] text-[#2a211a]">{format(viewMonth, "MMMM yyyy")}</span>
        <button onClick={() => setViewMonth((m) => addMonths(m, 1))} aria-label="Next month"
          className="rounded-lg p-1.5 text-[#7a6a5f] hover:bg-[#f2ede4]">›</button>
      </div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wider text-[#b0a294]">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const selected = isSameDay(day, selectedDate);
          const inMonth = isSameMonth(day, viewMonth);
          const today = isSameDay(day, new Date());
          const hasTours = activeDates.has(format(day, "yyyy-MM-dd"));
          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelect(day)}
              className={`relative flex h-8 w-8 items-center justify-center rounded-full text-[13px] transition-colors ${
                selected
                  ? "bg-[#8b6f47] font-bold text-white"
                  : inMonth
                    ? "text-[#2a211a] hover:bg-[#f2ede4]"
                    : "text-[#d5ccc0]"
              } ${today && !selected ? "font-bold text-[#8b6f47] ring-1 ring-[#8b6f47]" : ""}`}
            >
              {format(day, "d")}
              {hasTours ? (
                <span className={`absolute bottom-1 h-1 w-1 rounded-full ${selected ? "bg-white" : "bg-[#8b6f47]"}`} />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
