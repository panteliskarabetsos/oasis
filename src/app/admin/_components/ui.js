import { useEffect, useState } from "react";
import { ChevronDown, Users as UsersIcon, Shield, X } from "lucide-react";

// ===================== Hooks =====================

/** Debounce a value by `delay` ms */
export function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** Simple toast state hook to pair with <ToastHost /> */
export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const toast = ({ title, type = "success", icon: Icon }) => {
    const id =
      globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, title, type, Icon }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  };
  const clearToasts = () => setToasts([]);
  return { toasts, toast, clearToasts };
}

// ===================== Utils =====================

export function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

export function formatDate(d) {
  try {
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString();
  } catch {
    return "—";
  }
}

export function toYMD(d) {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// ===================== UI Components =====================

export function StatCard({ label, value, tone = "neutral" }) {
  const tones = {
    neutral: "bg-white/90 border-[#e0dcd4] text-[#5a4a3f]",
    green: "bg-green-50 border-green-200 text-green-800",
    amber: "bg-amber-50 border-amber-200 text-amber-800",
  };
  const classes = tones[tone] || tones.neutral;
  return (
    <div className={cx("rounded-2xl border shadow-sm px-5 py-4", classes)}>
      <div className="text-xs uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}

export function Select({
  label,
  value,
  onChange,
  options,
  name,
  defaultValue,
}) {
  return (
    <div className="min-w-[10rem]">
      {label && (
        <label className="text-xs text-[#5a4a3f] mb-1 block">{label}</label>
      )}
      <div className="relative">
        <select
          name={name}
          value={value}
          defaultValue={defaultValue}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full appearance-none px-4 py-2 rounded-full border border-[#e0dcd4] bg-white text-[#5a4a3f] focus:outline-none focus:ring-2 focus:ring-[#8b6f47] pr-8"
        >
          {options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7a6a5f] pointer-events-none"
        />
      </div>
    </div>
  );
}

export function RoleBadge({ role }) {
  const isAdmin = role === "admin";
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border",
        isAdmin
          ? "bg-green-100 text-green-800 border-green-200"
          : "bg-[#eee8df] text-[#5a4a3f] border-[#e4ddd3]"
      )}
    >
      {isAdmin && <Shield size={14} />} {role}
    </span>
  );
}

export function Avatar({ name, surname, email }) {
  const initials =
    ((name?.[0] ?? "") + (surname?.[0] ?? "")).toUpperCase() ||
    (email?.[0] ?? "U").toUpperCase();
  return (
    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#e9e4dc] to-[#fff4e1] text-[#5a4a3f] flex items-center justify-center font-semibold border border-[#e0dcd4] shadow-sm">
      {initials}
    </div>
  );
}

export function TextInput({
  name,
  placeholder,
  type = "text",
  required = false,
  defaultValue,
}) {
  return (
    <div>
      <label className="text-sm text-[#5a4a3f] mb-2 block">{placeholder}</label>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl border border-[#e0dcd4] bg-white focus:outline-none focus:ring-2 focus:ring-[#8b6f47]"
      />
    </div>
  );
}

export function Th({ children, className = "" }) {
  return (
    <th className={cx("p-3 font-semibold text-xs", className)}>{children}</th>
  );
}

export function Td({ children, className = "", colSpan }) {
  return (
    <td colSpan={colSpan} className={cx("p-4 align-middle", className)}>
      {children}
    </td>
  );
}

export function SideDrawer({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50">
      {/* overlay */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* panel */}
      <aside className="absolute right-0 top-0 h-[100dvh] w-full max-w-[560px] bg-[#f6f3ee] border-l border-[#e7e0d6] shadow-2xl flex flex-col">
        {/* header (fixed) */}
        <div className="shrink-0 px-5 py-4 border-b border-[#efe9e1] bg-white/80 backdrop-blur flex items-center justify-between gap-3">
          <div className="text-base font-semibold text-[#4f4137]">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#e7e0d6] bg-white px-3 py-2 text-sm text-[#4f4137] hover:bg-[#f5f1ea]"
          >
            Close
          </button>
        </div>

        {/* body (scrollable) */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          {children}
        </div>
      </aside>
    </div>
  );
}

export function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-[#e0dcd4]">
        <div className="px-8 pt-7 pb-4 border-b border-[#eee8df] bg-[#fffdf9] rounded-t-2xl flex items-center justify-between">
          <h2 className="text-2xl font-serif text-[#5a4a3f]">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-full hover:bg-[#f4f1ec]"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-8">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirm",
  onCancel,
  onConfirm,
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-[#e0dcd4]">
        <div className="px-8 pt-7 pb-4 border-b border-[#eee8df] bg-[#fffdf9] rounded-t-2xl">
          <h2 className="text-xl font-serif text-[#5a4a3f]">{title}</h2>
        </div>
        <div className="p-8">
          <p className="text-[#5a4a3f] mb-6">{description}</p>
          <div className="flex justify-end gap-3">
            <button
              onClick={onCancel}
              className="px-6 py-2 rounded-full bg-gray-200 text-[#5a4a3f] hover:bg-gray-300 transition"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-6 py-2 rounded-full bg-red-600 text-white hover:bg-red-700 transition shadow-sm"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ToastHost({ toasts }) {
  return (
    <div className="fixed right-4 top-4 z-[60] space-y-2">
      {toasts.map(({ id, title, type, Icon }) => (
        <div
          key={id}
          className={cx(
            "flex items-center gap-2 px-4 py-2 rounded-xl shadow border text-sm",
            type === "error"
              ? "bg-red-50 text-red-700 border-red-200"
              : "bg-white text-[#3d3227] border-[#e0dcd4]"
          )}
        >
          {Icon ? <Icon size={16} /> : null}
          <span>{title}</span>
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }) {
  return (
    <div className="animate-pulse divide-y divide-[#eee8df]">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="grid grid-cols-6 gap-4 p-4">
          <div className="col-span-2 h-5 bg-[#eee8df] rounded" />
          <div className="h-5 bg-[#eee8df] rounded" />
          <div className="h-5 bg-[#eee8df] rounded" />
          <div className="h-5 bg-[#eee8df] rounded" />
          <div className="h-5 bg-[#eee8df] rounded" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  onAdd,
  onClear,
  title = "No records found",
  subtitle = "Try adjusting your search or add a new one.",
}) {
  return (
    <div className="py-16 text-center">
      <div className="mx-auto w-24 h-24 rounded-full bg-[#fff4e1] border border-[#e0dcd4] flex items-center justify-center mb-4">
        <UsersIcon className="text-[#8b6f47]" />
      </div>
      <h3 className="text-xl font-serif text-[#5a4a3f] mb-2">{title}</h3>
      <p className="text-[#7a6a5f] mb-6">{subtitle}</p>
      <div className="flex items-center justify-center gap-3">
        {onClear && (
          <button
            onClick={onClear}
            className="px-5 py-2.5 rounded-full border border-[#d8cfc3] bg-white text-[#5a4a3f] hover:bg-[#f1ede7] transition shadow-sm"
          >
            Clear search
          </button>
        )}
        {onAdd && (
          <button
            onClick={onAdd}
            className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#8b6f47] to-[#a78b62] text-white hover:opacity-90 transition shadow-sm"
          >
            Add
          </button>
        )}
      </div>
    </div>
  );
}
