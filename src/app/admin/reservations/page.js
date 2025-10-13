"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar as CalendarIcon,
  Search as SearchIcon,
  Filter as FilterIcon,
  Download as DownloadIcon,
  RefreshCw,
  Eye,
  X as XIcon,
  CalendarClock,
  XCircle as XCircleIcon,
} from "lucide-react";
import { toast } from "react-hot-toast";

/* ---------------------------- helpers ---------------------------- */
const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleString("el-GR", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "-";
const fmtMoney = (n) =>
  typeof n === "number"
    ? n.toLocaleString("el-GR", { style: "currency", currency: "EUR" })
    : "-";
const cx = (...xs) => xs.filter(Boolean).join(" ");

const STATUS_OPTIONS = [
  { value: "", label: "Όλες" },
  { value: "pending", label: "Σε εκκρεμότητα" },
  { value: "confirmed", label: "Επιβεβαιωμένες" },
  { value: "cancelled", label: "Ακυρωμένες" },
  { value: "draft", label: "Προσχέδια" },
];

const PAGE_SIZE = 20;

/* ------------------------------ Page ------------------------------ */
export default function ReservationsPage() {
  const router = useRouter();

  // Filters & state
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState(""); // YYYY-MM-DD
  const [to, setTo] = useState(""); // YYYY-MM-DD
  const [experienceId, setExperienceId] = useState("");

  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [experiences, setExperiences] = useState([]);

  // Actions state
  const [selected, setSelected] = useState(null);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const [showReschedule, setShowReschedule] = useState(false);
  const [slotLoading, setSlotLoading] = useState(false);
  const [slots, setSlots] = useState([]);
  const [slotFrom, setSlotFrom] = useState(() => today());
  const [slotTo, setSlotTo] = useState(() => plusDays(60));
  const [targetSlotId, setTargetSlotId] = useState("");

  const controllerRef = useRef(null);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / PAGE_SIZE)),
    [total]
  );

  // Debounce query
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  // Load experiences for filter
  useEffect(() => {
    let abort = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          `/api/admin/experiences?fields=id,name&limit=200`,
          {
            signal: abort.signal,
            cache: "no-store",
            credentials: "include",
          }
        );
        if (!res.ok) throw new Error("Failed to load experiences");
        const data = await res.json();
        const items = Array.isArray(data?.items) ? data.items : data;
        setExperiences(items || []);
      } catch (e) {
        // non-blocking
        console.warn(e);
      }
    })();
    return () => abort.abort();
  }, []);

  // Fetch reservations
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      if (controllerRef.current) controllerRef.current.abort();
      controllerRef.current = new AbortController();

      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (debouncedQuery) qs.set("q", debouncedQuery);
      if (status) qs.set("status", status);
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      if (experienceId) qs.set("experienceId", experienceId);

      try {
        const res = await fetch(`/api/admin/reservations?${qs.toString()}`, {
          signal: controllerRef.current.signal,
          cache: "no-store",
          credentials: "include",
        });

        if (!res.ok) {
          const msg =
            (await res.json().catch(() => ({})))?.error || "Σφάλμα φόρτωσης";
          throw new Error(msg);
        }

        const data = await res.json();
        const items = data?.items || [];
        setRows(items);
        setTotal(Number(data?.total || items.length));
      } catch (e) {
        setError(e.message);
        setRows((prev) => (prev.length ? prev : DEMO_ROWS));
        setTotal((prev) => prev || DEMO_ROWS.length);
      } finally {
        setLoading(false);
      }
    })();
  }, [debouncedQuery, status, from, to, experienceId, page]);

  function resetFilters() {
    setQuery("");
    setStatus("");
    setFrom("");
    setTo("");
    setExperienceId("");
    setPage(1);
  }

  function onExportCSV() {
    const headers = [
      "ID",
      "Κωδικός",
      "Ημερομηνία",
      "Εμπειρία",
      "Όνομα",
      "Email",
      "Τηλέφωνο",
      "Ενήλικες",
      "Παιδιά",
      "Σύνολο",
      "Κατάσταση",
      "Δημιουργήθηκε",
    ];
    const lines = rows.map((r) => [
      r.id,
      r.code || "",
      r.date || r.startTime || "",
      r.experienceName || "",
      r.guestName || "",
      r.guestEmail || "",
      r.guestPhone || "",
      r.adults ?? "",
      r.kids ?? "",
      r.totalAmount ?? "",
      r.status || "",
      r.createdAt || "",
    ]);

    const csv = [headers, ...lines]
      .map((row) =>
        row.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")
      )
      .join("");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reservations_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---------------------------- Actions ----------------------------
  function openCancel(r) {
    setSelected(r);
    setCancelReason("");
    setShowCancel(true);
  }
  async function submitCancel() {
    if (!selected) return;
    try {
      const res = await fetch(`/api/admin/reservations/${selected.id}/cancel`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason: cancelReason }),
      });
      if (!res.ok) {
        const msg =
          (await res.json().catch(() => ({})))?.error || "Αποτυχία ακύρωσης";
        throw new Error(msg);
      }
      toast.success("Η κράτηση ακυρώθηκε");
      setRows((cur) =>
        cur.map((r) =>
          r.id === selected.id ? { ...r, status: "cancelled" } : r
        )
      );
      setShowCancel(false);
      setSelected(null);
    } catch (e) {
      toast.error(e.message);
    }
  }

  function openReschedule(r) {
    setSelected(r);
    setShowReschedule(true);
    setTargetSlotId("");
    // preset date window around today or the current reservation date
    const base = r?.startTime ? new Date(r.startTime) : new Date();
    const fromStr = toDateInput(base);
    const toStr = toDateInput(plusDaysFrom(base, 60));
    setSlotFrom(fromStr);
    setSlotTo(toStr);
    loadSlots(r.experienceId, fromStr, toStr);
  }

  async function loadSlots(expId, fromStr, toStr) {
    if (!expId) return setSlots([]);
    setSlotLoading(true);
    try {
      const qs = new URLSearchParams({ experienceId: String(expId) });
      if (fromStr) qs.set("from", fromStr);
      if (toStr) qs.set("to", toStr);
      const res = await fetch(`/api/admin/schedule/slots?${qs.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error || "Σφάλμα φόρτωσης slots"
        );
      const data = await res.json();
      setSlots(data?.items || []);
    } catch (e) {
      toast.error(e.message);
      setSlots([]);
    } finally {
      setSlotLoading(false);
    }
  }

  async function submitReschedule() {
    if (!selected || !targetSlotId) return toast.error("Επιλέξτε νέο slot");
    try {
      const res = await fetch(
        `/api/admin/reservations/${selected.id}/reschedule`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ scheduleSlotId: Number(targetSlotId) }),
        }
      );
      if (!res.ok) {
        const msg =
          (await res.json().catch(() => ({})))?.error || "Αποτυχία μεταφοράς";
        throw new Error(msg);
      }
      const payload = await res.json().catch(() => ({}));
      const newStartTime = payload?.newStartTime;
      toast.success("Η κράτηση μεταφέρθηκε");
      setRows((cur) =>
        cur.map((r) =>
          r.id === selected.id
            ? { ...r, startTime: newStartTime || r.startTime }
            : r
        )
      );
      setShowReschedule(false);
      setSelected(null);
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#45362b]">Κρατήσεις</h1>
          <p className="text-sm text-[#7b6a5f]">
            Διαχείριση κρατήσεων για όλες τις εμπειρίες.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-neutral-50"
          >
            <RefreshCw className="h-4 w-4" /> Ανανέωση
          </button>
          <button
            onClick={onExportCSV}
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-neutral-50"
          >
            <DownloadIcon className="h-4 w-4" /> Εξαγωγή CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border bg-white/70 backdrop-blur p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* search */}
          <div className="col-span-2">
            <label className="text-xs text-[#6e5e54]">Αναζήτηση</label>
            <div className="relative mt-1">
              <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <input
                className="w-full pl-8 pr-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#d9c6b8]"
                placeholder="Όνομα, email, τηλέφωνο ή κωδικός κράτησης..."
                value={query}
                onChange={(e) => {
                  setPage(1);
                  setQuery(e.target.value);
                }}
              />
            </div>
          </div>

          {/* status */}
          <div>
            <label className="text-xs text-[#6e5e54]">Κατάσταση</label>
            <select
              className="w-full mt-1 rounded-xl border px-3 py-2 text-sm"
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value);
              }}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* experience */}
          <div>
            <label className="text-xs text-[#6e5e54]">Εμπειρία</label>
            <select
              className="w-full mt-1 rounded-xl border px-3 py-2 text-sm"
              value={experienceId}
              onChange={(e) => {
                setPage(1);
                setExperienceId(e.target.value);
              }}
            >
              <option value="">Όλες</option>
              {experiences?.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </select>
          </div>

          {/* from */}
          <div>
            <label className="text-xs text-[#6e5e54] flex items-center gap-1">
              Από <CalendarIcon className="h-3 w-3" />
            </label>
            <input
              type="date"
              className="w-full mt-1 rounded-xl border px-3 py-2 text-sm"
              value={from}
              onChange={(e) => {
                setPage(1);
                setFrom(e.target.value);
              }}
            />
          </div>

          {/* to */}
          <div>
            <label className="text-xs text-[#6e5e54] flex items-center gap-1">
              Έως <CalendarIcon className="h-3 w-3" />
            </label>
            <input
              type="date"
              className="w-full mt-1 rounded-xl border px-3 py-2 text-sm"
              value={to}
              onChange={(e) => {
                setPage(1);
                setTo(e.target.value);
              }}
            />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={resetFilters}
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-neutral-50"
          >
            <FilterIcon className="h-4 w-4" /> Καθαρισμός φίλτρων
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr className="text-left">
                <Th>Κωδικός</Th>
                <Th>Ημερομηνία</Th>
                <Th>Εμπειρία</Th>
                <Th>Πελάτης</Th>
                <Th>Τηλέφωνο</Th>
                <Th className="text-right">Άτομα</Th>
                <Th className="text-right">Σύνολο</Th>
                <Th>Κατάσταση</Th>
                <Th>Ενέργειες</Th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-neutral-500">
                    Φόρτωση…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-neutral-500">
                    Δεν βρέθηκαν κρατήσεις.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-neutral-50/50">
                    <Td className="font-mono">{r.code || r.id}</Td>
                    <Td>{fmtDate(r.startTime || r.date)}</Td>
                    <Td
                      className="max-w-[260px] truncate"
                      title={r.experienceName}
                    >
                      {r.experienceName}
                    </Td>
                    <Td>
                      <div className="flex flex-col">
                        <span className="font-medium">{r.guestName}</span>
                        <span className="text-neutral-500">{r.guestEmail}</span>
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap">{r.guestPhone || "-"}</Td>
                    <Td className="text-right">
                      {r.adults ?? 0}
                      {typeof r.kids === "number" ? ` + ${r.kids}` : ""}
                    </Td>
                    <Td className="text-right">{fmtMoney(r.totalAmount)}</Td>
                    <Td>
                      <StatusBadge status={r.status} />
                    </Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() =>
                            router.push(`/admin/reservations/${r.id}`)
                          }
                          className="inline-flex items-center rounded-lg border p-1.5 hover:bg-neutral-50"
                          title="Προβολή"
                          aria-label="Προβολή"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openReschedule(r)}
                          className="inline-flex items-center rounded-lg border p-1.5 hover:bg-amber-50"
                          title="Μεταφορά"
                          aria-label="Μεταφορά"
                        >
                          <CalendarClock className="h-4 w-4" />
                        </button>
                        {r.status !== "cancelled" && (
                          <button
                            onClick={() => openCancel(r)}
                            className="inline-flex items-center rounded-lg border p-1.5 hover:bg-red-50"
                            title="Ακύρωση"
                            aria-label="Ακύρωση"
                          >
                            <XCircleIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* footer */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 border-t bg-neutral-50/60">
          <div className="text-sm text-neutral-600">
            {error ? (
              <span className="text-red-600">{error}</span>
            ) : (
              <span>
                Εμφάνιση {rows.length ? (page - 1) * PAGE_SIZE + 1 : 0}–
                {Math.min(page * PAGE_SIZE, total)} από {total}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className={cx(
                "rounded-xl border px-3 py-2 text-sm",
                page <= 1
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-neutral-50"
              )}
            >
              Προηγούμενη
            </button>
            <span className="text-sm text-neutral-700">
              Σελίδα {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className={cx(
                "rounded-xl border px-3 py-2 text-sm",
                page >= totalPages
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-neutral-50"
              )}
            >
              Επόμενη
            </button>
          </div>
        </div>
      </div>

      {/* Cancel modal */}
      {showCancel && (
        <Modal onClose={() => setShowCancel(false)} title="Ακύρωση κράτησης">
          <div className="space-y-3">
            <p className="text-sm text-neutral-600">
              Είστε βέβαιοι ότι θέλετε να ακυρώσετε αυτή την κράτηση;
            </p>
            <label className="block text-sm">
              <span className="text-neutral-700">Λόγος (προαιρετικό)</span>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="mt-1 w-full rounded-xl border p-2 text-sm"
                rows={3}
              />
            </label>
            <div className="flex items-center justify-end gap-2">
              <button
                className="rounded-xl border px-3 py-2 text-sm"
                onClick={() => setShowCancel(false)}
              >
                Κλείσιμο
              </button>
              <button
                className="rounded-xl border px-3 py-2 text-sm bg-red-600 text-white"
                onClick={submitCancel}
              >
                Ακύρωση κράτησης
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reschedule modal */}
      {showReschedule && (
        <Modal
          onClose={() => setShowReschedule(false)}
          title="Μεταφορά κράτησης"
        >
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-neutral-600">Από</label>
                <input
                  type="date"
                  value={slotFrom}
                  onChange={(e) => setSlotFrom(e.target.value)}
                  className="mt-1 w-full rounded-xl border p-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-600">Έως</label>
                <input
                  type="date"
                  value={slotTo}
                  onChange={(e) => setSlotTo(e.target.value)}
                  className="mt-1 w-full rounded-xl border p-2 text-sm"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() =>
                    loadSlots(selected?.experienceId, slotFrom, slotTo)
                  }
                  className="rounded-xl border px-3 py-2 text-sm w-full sm:w-auto"
                >
                  Φόρτωση διαθέσιμων
                </button>
              </div>
            </div>

            <label className="block text-sm">
              <span className="text-neutral-700">Νέο slot</span>
              <select
                value={targetSlotId}
                onChange={(e) => setTargetSlotId(e.target.value)}
                className="mt-1 w-full rounded-xl border p-2 text-sm"
              >
                <option value="">— Επιλέξτε —</option>
                {slotLoading ? (
                  <option value="" disabled>
                    Φόρτωση…
                  </option>
                ) : (
                  slots.map((s) => (
                    <option key={s.id} value={s.id} disabled={s.available <= 0}>
                      {labelSlot(s)}
                    </option>
                  ))
                )}
              </select>
            </label>

            <div className="flex items-center justify-end gap-2">
              <button
                className="rounded-xl border px-3 py-2 text-sm"
                onClick={() => setShowReschedule(false)}
              >
                Κλείσιμο
              </button>
              <button
                className="rounded-xl border px-3 py-2 text-sm bg-amber-600 text-white"
                onClick={submitReschedule}
              >
                Μεταφορά κράτησης
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------------------------- Subcomponents ---------------------------- */
function Th({ children, className = "" }) {
  return (
    <th
      className={cx(
        "px-3 py-2 text-xs font-semibold uppercase tracking-wide",
        className
      )}
    >
      {children}
    </th>
  );
}
function Td({ children, className = "" }) {
  return (
    <td
      className={cx(
        "px-3 py-3 align-middle text-[13px] text-neutral-800",
        className
      )}
    >
      {children}
    </td>
  );
}

function StatusBadge({ status }) {
  const map = {
    confirmed: "bg-green-100 text-green-800 border-green-200",
    pending: "bg-amber-100 text-amber-800 border-amber-200",
    cancelled: "bg-red-100 text-red-800 border-red-200",
    draft: "bg-neutral-100 text-neutral-700 border-neutral-200",
  };
  const label =
    {
      confirmed: "Επιβεβαιωμένη",
      pending: "Σε εκκρεμότητα",
      cancelled: "Ακυρωμένη",
      draft: "Προσχέδιο",
    }[status] ||
    status ||
    "-";
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs",
        map[status]
      )}
    >
      {label}
    </span>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-base font-semibold text-neutral-800">{title}</h3>
          <button
            className="rounded-lg p-1 hover:bg-neutral-100"
            onClick={onClose}
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------ Utils ------------------------------ */
function today() {
  const d = new Date();
  return toDateInput(d);
}
function plusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toDateInput(d);
}
function plusDaysFrom(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return toDateInput(d);
}
function toDateInput(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function labelSlot(s) {
  const dt = fmtDate(s.date);
  const name = s.experienceName ? ` — ${s.experienceName}` : "";
  const avail =
    typeof s.available === "number" ? ` • Διαθέσιμες: ${s.available}` : "";
  return `${dt}${name}${avail}`;
}

/* ------------------------------ Demo Data ------------------------------ */
const DEMO_ROWS = [
  {
    id: 1,
    code: "RSV-2025-0001",
    startTime: new Date().toISOString(),
    experienceId: 1,
    experienceName: "Old Town Food Walk",
    guestName: "Giorgos Papadakis",
    guestEmail: "giorgos@example.com",
    guestPhone: "+30 690 000 0001",
    adults: 2,
    kids: 0,
    totalAmount: 170,
    status: "pending",
    createdAt: new Date().toISOString(),
  },
  {
    id: 2,
    code: "RSV-2025-0002",
    startTime: new Date(Date.now() + 86400000).toISOString(),
    experienceId: 2,
    experienceName: "Sunset Sailing in Chania",
    guestName: "Anna K.",
    guestEmail: "anna@example.com",
    guestPhone: "+30 690 000 0002",
    adults: 2,
    kids: 1,
    totalAmount: 255,
    status: "confirmed",
    createdAt: new Date().toISOString(),
  },
  {
    id: 3,
    code: "RSV-2025-0003",
    startTime: new Date(Date.now() + 2 * 86400000).toISOString(),
    experienceId: 3,
    experienceName: "Hiking Samaria Gorge",
    guestName: "Nikos T.",
    guestEmail: "nikos@example.com",
    guestPhone: "+30 690 000 0003",
    adults: 1,
    kids: 0,
    totalAmount: 85,
    status: "cancelled",
    createdAt: new Date().toISOString(),
  },
];
