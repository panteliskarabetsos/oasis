"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/components/SessionWrapper";
import {
  ArrowLeft,
  UserPlus,
  Search,
  Edit3,
  Trash2,
  Shield,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Check,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Copy,
  Sparkles,
  X,
  BadgeCheck,
  Lock,
  Briefcase,
  Megaphone,
  Headset,
  Calculator,
  UserCheck, // Added icon for External Partner
} from "lucide-react";

import {
  StatCard,
  Select,
  Avatar,
  TextInput,
  Th,
  Td,
  SideDrawer,
  Modal,
  ConfirmDialog,
  ToastHost,
  TableSkeleton,
  EmptyState,
  useDebouncedValue,
  useToasts,
  formatDate,
  toYMD,
} from "@/app/admin/_components/ui";

/* ------------------------------ Roles & Permissions Map ------------------------------ */

const PERMISSIONS = {
  experiences: "Experiences",
  bookings: "Bookings",
  guests: "Guests & CRM",
  schedule: "Schedule",
  admins: "Admins",
  payments: "Payments",
  invoices: "Invoices",
  promotions: "Promotions",
  checkins: "Check-ins",
  pos: "POS",
  eshop: "e-Shop",
  giftcards: "Gift Cards",
  bundles: "Bundles",
  waitlist: "Waitlist",
  loyalty: "Loyalty",
  addons: "Add-ons",
  waivers: "Waivers",
  corporate: "Corporate",
  integrations: "Integrations",
  settings: "Settings",
};

const ADMIN_ROLES = [
  {
    id: "superadmin",
    title: "Super Admin",
    icon: Shield,
    color: "text-purple-700",
    bg: "bg-purple-50",
    border: "border-purple-200",
    description:
      "Full unrestricted access to all system features and settings.",
    permissions: Object.keys(PERMISSIONS),
  },
  {
    id: "manager",
    title: "Operations Manager",
    icon: Briefcase,
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
    description: "Manages daily operations, staff schedules, and experiences.",
    permissions: [
      "experiences",
      "bookings",
      "guests",
      "schedule",
      "checkins",
      "pos",
      "waitlist",
      "addons",
      "waivers",
    ],
  },
  {
    id: "finance",
    title: "Finance & Billing",
    icon: Calculator,
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    description: "Access to payments, invoicing, and financial reporting.",
    permissions: ["payments", "invoices", "corporate", "giftcards", "pos"],
  },
  {
    id: "marketing",
    title: "Marketing & Growth",
    icon: Megaphone,
    color: "text-pink-700",
    bg: "bg-pink-50",
    border: "border-pink-200",
    description: "Handles promotions, loyalty programs, e-shop, and bundles.",
    permissions: [
      "guests",
      "promotions",
      "eshop",
      "bundles",
      "loyalty",
      "integrations",
      "settings",
    ],
  },
  {
    id: "support",
    title: "Support Agent",
    icon: Headset,
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    description:
      "Basic access to manage bookings, check-ins, and guest inquiries.",
    permissions: ["bookings", "guests", "checkins", "waitlist"],
  },
  {
    id: "partner",
    title: "External Partner",
    icon: UserCheck,
    color: "text-teal-700",
    bg: "bg-teal-50",
    border: "border-teal-200",
    description:
      "External guides or affiliates with access to daily schedules and guest check-ins.",
    permissions: ["schedule", "checkins"],
  },
];

const getRoleConfig = (roleId) =>
  ADMIN_ROLES.find((r) => r.id === roleId) || ADMIN_ROLES[0];

/* ------------------------------ UI tokens ------------------------------ */
const ui = {
  page: "relative min-h-screen bg-[#f6f3ee] overflow-hidden",
  shell: "relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10",

  card: "rounded-3xl border border-[#e1dbd2] bg-white/80 backdrop-blur-xl shadow-[0_18px_55px_-28px_rgba(0,0,0,0.22)]",
  cardHeader:
    "px-5 sm:px-6 py-5 border-b border-[#efe9e1] flex items-start justify-between gap-4",
  cardBody: "px-5 sm:px-6 py-5",

  soft: "rounded-3xl border border-[#e7e0d6] bg-white/70 backdrop-blur shadow-[0_14px_45px_-28px_rgba(0,0,0,0.18)]",

  text: {
    brand: "text-[#4f4137]",
    dark: "text-[#2f261f]",
    soft: "text-[#7c6d62]",
    faint: "text-[#a79a8f]",
  },

  btn: {
    base: "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/35 disabled:opacity-55 disabled:cursor-not-allowed",
    primary:
      "bg-gradient-to-r from-[#7a5b33] to-[#a17f55] text-white shadow-sm hover:opacity-95",
    ghost:
      "border border-[#ded6cb] bg-white/85 text-[#4f4137] hover:bg-[#f2ede6] shadow-sm",
    subtle:
      "border border-[#e7e0d6] bg-white text-[#4f4137] hover:bg-[#f5f1ea] shadow-sm",
    danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
    icon: "inline-flex items-center justify-center rounded-full border border-[#e7e0d6] bg-white px-3 py-2 hover:bg-[#f5f1ea] transition shadow-sm focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/35 disabled:opacity-55",
    chip: "inline-flex items-center gap-2 rounded-full border border-[#e7e0d6] bg-white/90 px-3 py-1.5 text-xs text-[#4f4137] shadow-sm",
  },

  input:
    "w-full rounded-2xl border border-[#e3ddd4] bg-[#fbfaf7] px-4 py-3 text-sm text-[#4f4137] placeholder-[#b6aaa0] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/35 focus:bg-white transition-colors",

  kbd: "px-1.5 py-0.5 rounded-md bg-[#fff4e1] border border-[#e3ddd4] text-[11px] font-medium text-[#4f4137]",
};

/* ------------------------------ helpers ------------------------------ */

function scorePassword(pw) {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, s); // 0..4
}

function generatePassword(len = 14) {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  const bytes = new Uint32Array(len);
  try {
    window.crypto?.getRandomValues(bytes);
  } catch {
    for (let i = 0; i < len; i++) bytes[i] = Math.floor(Math.random() * 1e9);
  }
  let out = "";
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
  return out;
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard?.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------ Subcomponents ------------------------------ */

function AdminRoleBadge({ role }) {
  const config = getRoleConfig(role);
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${config.bg} ${config.border} ${config.color}`}
    >
      <Icon size={12} />
      {config.title}
    </span>
  );
}

function SortTh({ label, k, activeKey, dir, onSort, className = "" }) {
  const isActive = activeKey === k;
  const nextDir = !isActive ? "asc" : dir === "asc" ? "desc" : "asc";
  return (
    <th className={`p-3 font-semibold text-xs ${className}`}>
      <button
        type="button"
        onClick={() => onSort(k, nextDir)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition ${
          isActive
            ? "bg-white/95 border-[#ded6cb] text-[#2f261f] shadow-sm"
            : "bg-transparent border-transparent text-[#4f4137] hover:bg-white/70 hover:border-[#e7e0d6]"
        }`}
      >
        <span className="uppercase tracking-wide">{label}</span>
        {isActive ? (
          dir === "asc" ? (
            <ArrowUp size={14} />
          ) : (
            <ArrowDown size={14} />
          )
        ) : (
          <ArrowUpDown size={14} />
        )}
      </button>
    </th>
  );
}

function MobileAdminCard({
  u,
  isMe,
  selected,
  onToggleSelect,
  onEdit,
  onDelete,
  toast,
}) {
  const fullName = `${u.name ?? "—"} ${u.surname ?? ""}`.trim();
  return (
    <div className="rounded-3xl border border-[#efe9e1] bg-white/80 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <input
          aria-label={`Select ${u.email}`}
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="mt-1.5 h-4 w-4 rounded border-[#d7cec2] text-[#8b6f47] focus:ring-[#8b6f47]"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <Avatar name={u.name} surname={u.surname} email={u.email} />
            <div className="min-w-0">
              <div className="font-medium text-[#2f261f] truncate">
                {fullName}
              </div>
              <button
                type="button"
                className="mt-0.5 text-sm text-[#4f4137] hover:underline underline-offset-2 truncate"
                onClick={async () => {
                  const ok = await copyToClipboard(u.email);
                  toast({
                    title: ok ? "Email copied" : "Copy failed",
                    type: ok ? undefined : "error",
                  });
                }}
              >
                {u.email}
              </button>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <AdminRoleBadge role={u.role} />
                {u.phone ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-[#e7e0d6] bg-white px-2.5 py-1 text-xs text-[#4f4137] hover:bg-[#f5f1ea]"
                    onClick={async () => {
                      await copyToClipboard(u.phone);
                      toast({ title: "Phone copied" });
                    }}
                  >
                    {u.phone}
                  </button>
                ) : null}
                <span className="inline-flex items-center gap-1 rounded-full border border-[#e7e0d6] bg-white px-2.5 py-1 text-xs text-[#7c6d62]">
                  Joined {formatDate(u.createdAt)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            <button onClick={onEdit} className={ui.btn.icon} aria-label="Edit">
              <Edit3 size={16} className="text-[#7a5b33]" />
            </button>
            <button
              onClick={onDelete}
              disabled={isMe}
              className={ui.btn.icon}
              title={isMe ? "You can’t delete your own account" : "Delete"}
            >
              <Trash2
                size={16}
                className={isMe ? "text-[#b6aaa0]" : "text-red-600"}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RoleSelector({ selectedRole, onChange }) {
  return (
    <div className="space-y-3">
      {ADMIN_ROLES.map((role) => {
        const isSelected = selectedRole === role.id;
        const RoleIcon = role.icon;

        return (
          <label
            key={role.id}
            className={`block relative cursor-pointer rounded-2xl border p-4 transition-all duration-200 ${
              isSelected
                ? `bg-white border-[#8b6f47] shadow-[0_0_0_1px_#8b6f47]`
                : `bg-white/50 border-[#e3ddd4] hover:bg-white hover:border-[#d3c9bd]`
            }`}
          >
            <input
              type="radio"
              name="role"
              value={role.id}
              checked={isSelected}
              onChange={() => onChange(role.id)}
              className="sr-only"
            />
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                  isSelected ? "border-[#8b6f47]" : "border-[#b6aaa0]"
                }`}
              >
                {isSelected && (
                  <div className="w-2 h-2 rounded-full bg-[#8b6f47]" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 font-semibold text-[#4f4137]">
                  <RoleIcon
                    size={16}
                    className={isSelected ? "text-[#8b6f47]" : "text-[#a79a8f]"}
                  />
                  {role.title}
                </div>
                <p className="text-xs text-[#7c6d62] mt-1">
                  {role.description}
                </p>

                {/* Expand Permissions if Selected */}
                {isSelected && (
                  <div className="mt-4 pt-4 border-t border-[#f0ebe1] flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    {role.permissions.map((key) => (
                      <span
                        key={key}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#f6f3ee] border border-[#e7e0d6] text-[10px] uppercase tracking-widest text-[#7c6d62] font-semibold"
                      >
                        <Lock size={10} className="text-[#a79a8f]" />
                        {PERMISSIONS[key]}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </label>
        );
      })}
    </div>
  );
}

/* ------------------------------ page ------------------------------ */
export default function AdminAccountsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  // ---- role gate ----
  const [role, setRole] = useState(null);
  const [gateReady, setGateReady] = useState(false);

  // ---- data & ui state ----
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedTerm = useDebouncedValue(searchTerm, 250);

  const [sortKey, setSortKey] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // New Admin Role State
  const [addRole, setAddRole] = useState("manager");

  // success modal
  const [createdAdmin, setCreatedAdmin] = useState(null);

  const [errorMessage, setErrorMessage] = useState("");
  const { toasts, toast } = useToasts();
  const [isPending, startTransition] = useTransition();

  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);

  const searchRef = useRef(null);

  // Add-drawer refs / state
  const addEmailRef = useRef(null);
  const [addEmail, setAddEmail] = useState("");
  const [addPw, setAddPw] = useState("");
  const [addFormError, setAddFormError] = useState("");
  const [pwVisible, setPwVisible] = useState(false);
  const [pwJustCopied, setPwJustCopied] = useState(false);

  const emailOk = useMemo(
    () => /^\S+@\S+\.\S+$/.test(addEmail.trim()),
    [addEmail],
  );

  const pwReq = useMemo(() => {
    const pw = addPw || "";
    return {
      len: pw.length >= 8,
      upper: /[A-Z]/.test(pw),
      lower: /[a-z]/.test(pw),
      num: /\d/.test(pw),
      special: /[^A-Za-z0-9]/.test(pw),
    };
  }, [addPw]);

  useEffect(() => {
    if (showAddDrawer) {
      setAddEmail("");
      setAddFormError("");
      setErrorMessage("");
      setPwVisible(false);
      setPwJustCopied(false);
      setAddPw("");
      setAddRole("manager");

      setTimeout(() => addEmailRef.current?.focus(), 80);
    }
  }, [showAddDrawer]);

  // Handle Admin Authorization
  const authRole = useMemo(
    () => user?.app_metadata?.role ?? user?.user_metadata?.role ?? null,
    [user],
  );

  const isAdminRole = (r) =>
    ADMIN_ROLES.some((role) => role.id === r) || r === "admin";

  useEffect(() => {
    if (loading) return;

    if (!user) {
      setRole("anon");
      setGateReady(true);
      return;
    }

    if (authRole) setRole(authRole);

    (async () => {
      try {
        const res = await fetch("/api/me", {
          cache: "no-store",
          credentials: "include",
        });
        if (res.ok) {
          const me = await res.json();
          if (me?.role) setRole(me.role);
        }
      } finally {
        setGateReady(true);
      }
    })();
  }, [loading, user, authRole]);

  useEffect(() => {
    if (!gateReady) return;
    if (!user || !isAdminRole(role)) router.replace("/");
  }, [gateReady, role, user, router]);

  // fetch
  const fetchUsers = useCallback(async () => {
    try {
      if (!users.length) setLoadingUsers(true);
      else setRefreshing(true);

      const res = await fetch("/api/admin/users", {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) return;

      const data = await res.json();
      if (!data?.error) setUsers(data);
    } finally {
      setLoadingUsers(false);
      setRefreshing(false);
    }
  }, [users.length]);

  useEffect(() => {
    if (gateReady && isAdminRole(role)) fetchUsers();
  }, [gateReady, role, fetchUsers]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (ev) => {
      const key = typeof ev?.key === "string" ? ev.key.toLowerCase() : "";
      if (!key) return;

      const el = ev.target;
      const tag = (el?.tagName || "").toLowerCase();
      const typing =
        el?.isContentEditable ||
        tag === "input" ||
        tag === "textarea" ||
        tag === "select";
      if (typing) return;

      if (key === "/") {
        ev.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (key === "a") {
        ev.preventDefault();
        setShowAddDrawer(true);
        return;
      }
      if (key === "r") {
        ev.preventDefault();
        fetchUsers();
        return;
      }
      if (key === "escape") {
        setShowAddDrawer(false);
        setEditingUser(null);
        setConfirmDeleteId(null);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fetchUsers]);

  // Filter out regular users
  const admins = useMemo(
    () => users.filter((u) => isAdminRole(u.role)),
    [users],
  );

  // stats
  const totalAdmins = admins.length;
  const newThisMonth = useMemo(() => {
    const now = new Date();
    return admins.filter((u) => {
      const d = new Date(u.createdAt);
      return (
        d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
      );
    }).length;
  }, [admins]);

  // filter + sort
  const filteredAdmins = useMemo(() => {
    const q = (debouncedTerm || "").toLowerCase().trim();

    const byQuery = admins.filter((u) => {
      const fullName = `${u.name ?? ""} ${u.surname ?? ""}`.toLowerCase();
      const email = (u.email ?? "").toLowerCase();
      const phone = (u.phone ?? "").toLowerCase();
      return fullName.includes(q) || email.includes(q) || phone.includes(q);
    });

    const sorted = [...byQuery].sort((a, b) => {
      let av;
      let bv;
      switch (sortKey) {
        case "name":
          av = `${a.name ?? ""} ${a.surname ?? ""}`.trim().toLowerCase();
          bv = `${b.name ?? ""} ${b.surname ?? ""}`.trim().toLowerCase();
          break;
        case "email":
          av = (a.email ?? "").toLowerCase();
          bv = (b.email ?? "").toLowerCase();
          break;
        case "createdAt":
        default:
          av = new Date(a.createdAt).getTime();
          bv = new Date(b.createdAt).getTime();
          break;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [admins, debouncedTerm, sortKey, sortDir]);

  // pagination
  const pageCount = Math.max(1, Math.ceil(filteredAdmins.length / pageSize));
  useEffect(() => {
    if (page > pageCount) setPage(1);
  }, [pageCount, page]);

  const pagedAdmins = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAdmins.slice(start, start + pageSize);
  }, [filteredAdmins, page, pageSize]);

  // selection state (bulk actions)
  const currentAdminId = user?.id;
  const [selectedIds, setSelectedIds] = useState(new Set());

  const isSelf = useCallback(
    (id) => String(id) === String(currentAdminId),
    [currentAdminId],
  );

  const toggleSelect = (id) => {
    if (isSelf(id)) {
      toast({ title: "You can't select your own account.", type: "error" });
      return;
    }

    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (rows) => {
    const selectable = rows.filter((r) => !isSelf(r.id));
    const allSelected =
      selectable.length > 0 && selectable.every((r) => selectedIds.has(r.id));

    setSelectedIds(
      allSelected ? new Set() : new Set(selectable.map((r) => r.id)),
    );
  };

  const allOnPageSelected = useMemo(() => {
    const selectable = pagedAdmins.filter((r) => !isSelf(r.id));
    return (
      selectable.length > 0 && selectable.every((r) => selectedIds.has(r.id))
    );
  }, [pagedAdmins, selectedIds, isSelf]);

  const deletableSelectedCount = useMemo(() => {
    let c = 0;
    selectedIds.forEach((id) => {
      if (!isSelf(id)) c++;
    });
    return c;
  }, [selectedIds, isSelf]);

  // CRUD
  const handleDelete = async (id) => {
    if (id === currentAdminId) {
      toast({ title: "You can't delete your own account.", type: "error" });
      return;
    }
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Admin deleted", icon: Check });
        startTransition(fetchUsers);
      } else {
        toast({ title: data?.error || "Failed to delete.", type: "error" });
      }
    } catch {
      toast({ title: "Network error while deleting.", type: "error" });
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds).filter((id) => !isSelf(id));

    if (ids.length === 0) {
      toast({ title: "No deletable admins selected.", type: "error" });
      return;
    }

    for (const id of ids) {
      await handleDelete(id);
    }

    setSelectedIds(new Set());
  };

  const handleAddAdmin = async (e) => {
    e.preventDefault();
    setAddFormError("");
    setErrorMessage("");

    const form = e.currentTarget;

    const email = (addEmail || "").trim();
    const password = addPw || "";

    const name = (form.name.value || "").trim();
    const surname = (form.surname.value || "").trim();
    const phone = (form.phone.value || "").trim();
    const dateOfBirth = form.dateOfBirth.value || null;

    if (!emailOk) {
      setAddFormError("Please enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setAddFormError("Password must be at least 8 characters.");
      return;
    }

    const body = {
      email,
      password,
      name,
      surname,
      phone,
      role: addRole, // Use the state variable
      dateOfBirth,
    };

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data?.error || "Something went wrong.");
        setTimeout(() => setErrorMessage(""), 6000);
        return;
      }

      form.reset();
      setAddEmail("");
      setAddPw("");
      setPwVisible(false);
      setPwJustCopied(false);
      setShowAddDrawer(false);

      setSearchTerm("");
      setSortKey("createdAt");
      setSortDir("desc");
      setPage(1);
      setSelectedIds(new Set());

      await fetchUsers();
      setCreatedAdmin({ email, name, surname });
      toast({ title: "Admin created", icon: Check });
    } catch {
      setErrorMessage("Network error. Please try again.");
      setTimeout(() => setErrorMessage(""), 6000);
    }
  };

  const handleEditAdmin = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;

    // We update this via state in the RoleSelector now
    const newRole = editingUser.role;

    if (
      editingUser.id === currentAdminId &&
      newRole !== "superadmin" &&
      editingUser.role === "superadmin"
    ) {
      toast({
        title: "You can't demote yourself from Super Admin.",
        type: "error",
      });
      return;
    }

    const body = {
      id: editingUser.id,
      email: form.email.value,
      name: form.name.value,
      surname: form.surname.value,
      phone: form.phone.value,
      role: newRole,
      dateOfBirth: form.dateOfBirth.value || null,
    };

    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setEditingUser(null);
        toast({ title: "Admin updated", icon: Check });
        startTransition(fetchUsers);
      } else {
        toast({ title: "Update failed", type: "error" });
      }
    } catch {
      toast({ title: "Network error on update", type: "error" });
    }
  };

  if (!isClient || loading || !gateReady || !isAdminRole(role)) return null;

  const from = filteredAdmins.length ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(page * pageSize, filteredAdmins.length);

  return (
    <div className={ui.page}>
      {/* Ambient backdrop */}
      <div className="pointer-events-none absolute -top-44 -left-36 h-[32rem] w-[32rem] rounded-full bg-[#efe8de] blur-3xl opacity-70" />
      <div className="pointer-events-none absolute -bottom-52 -right-36 h-[34rem] w-[34rem] rounded-full bg-[#fff1da] blur-3xl opacity-70" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:radial-gradient(#000_1px,transparent_1px)] [background-size:26px_26px]" />

      <div className={ui.shell}>
        {/* Top header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-white/85 border border-[#e7e0d6] shadow-sm flex items-center justify-center">
                  <Shield className="text-[#7a5b33]" size={18} />
                </div>
                <div className="min-w-0">
                  <div
                    className={`text-xs uppercase tracking-widest ${ui.text.faint}`}
                  >
                    Admin • Access Control
                  </div>
                  <h1 className="mt-1 text-3xl md:text-4xl font-serif text-[#4f4137] truncate">
                    Administrator Accounts
                  </h1>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={ui.btn.chip}>
                  Search <span className={ui.kbd}>/</span>
                </span>
                <span className={ui.btn.chip}>
                  Add <span className={ui.kbd}>A</span>
                </span>
                <span className={ui.btn.chip}>
                  Refresh <span className={ui.kbd}>R</span>
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => router.push("/admin/")}
                className={`${ui.btn.base} ${ui.btn.ghost}`}
              >
                <ArrowLeft size={16} /> Back
              </button>

              <button
                onClick={() => setShowAddDrawer(true)}
                className={`${ui.btn.base} ${ui.btn.primary}`}
              >
                <UserPlus size={16} /> Add Admin
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCard label="Total Admins" value={totalAdmins} tone="green" />
            <StatCard
              label="New this month"
              value={newThisMonth}
              tone="amber"
            />
          </div>
        </div>

        {/* Toolbar */}
        <div className={`${ui.soft} p-4 sm:p-5 mb-6`}>
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            {/* Search */}
            <div className="relative w-full lg:w-[34rem]">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#7c6d62]">
                <Search size={18} />
              </span>
              <input
                ref={searchRef}
                type="text"
                placeholder="Search by name, email or phone…"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-10 py-2.5 rounded-full border border-[#e3ddd4] bg-[#fbfaf7] text-[#4f4137] placeholder-[#b6aaa0] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/35 shadow-sm"
              />
              {searchTerm ? (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute inset-y-0 right-0 pr-3 text-[#7c6d62] hover:text-[#4f4137]"
                >
                  <X size={16} />
                </button>
              ) : null}
            </div>

            <div className="flex-1" />

            {/* Controls */}
            <div className="flex flex-wrap items-end gap-2">
              <Select
                label="Sort"
                value={`${sortKey}:${sortDir}`}
                onChange={(v) => {
                  const [k, d] = v.split(":");
                  setSortKey(k);
                  setSortDir(d);
                  setPage(1);
                }}
                options={[
                  { value: "createdAt:desc", label: "Joined (newest)" },
                  { value: "createdAt:asc", label: "Joined (oldest)" },
                  { value: "name:asc", label: "Name (A→Z)" },
                  { value: "name:desc", label: "Name (Z→A)" },
                  { value: "email:asc", label: "Email (A→Z)" },
                  { value: "email:desc", label: "Email (Z→A)" },
                ]}
              />

              <Select
                label="Rows"
                value={String(pageSize)}
                onChange={(v) => {
                  setPageSize(Number(v));
                  setPage(1);
                }}
                options={[
                  { value: "10", label: "10" },
                  { value: "20", label: "20" },
                  { value: "50", label: "50" },
                ]}
              />

              <button
                onClick={fetchUsers}
                className={`${ui.btn.base} ${ui.btn.subtle}`}
                disabled={refreshing}
              >
                <RefreshCw
                  className={refreshing ? "animate-spin" : ""}
                  size={16}
                />
                Refresh
              </button>
            </div>
          </div>

          {/* Selection bar */}
          {selectedIds.size > 0 ? (
            <div className="mt-4 rounded-3xl border border-[#eadfcf] bg-[#fff6e8] px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-sm text-[#4f4137]">
                <b>{selectedIds.size}</b> selected{" "}
                <span className="ml-2 text-xs text-[#8b6f47]">
                  ({deletableSelectedCount} deletable)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className={`${ui.btn.base} ${ui.btn.subtle} !py-2 !px-3`}
                >
                  Clear
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={deletableSelectedCount === 0}
                  className={`${ui.btn.base} ${ui.btn.danger} !py-2 !px-3`}
                >
                  Delete selected
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Content */}
        <div className={ui.card}>
          <div className={ui.cardHeader}>
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-widest text-[#a79a8f]">
                Admins list
              </div>
              <div className="mt-1 text-sm text-[#4f4137]">
                Manage who can access your admin modules.
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <span className={ui.btn.chip}>
                <BadgeCheck size={14} className="text-[#7a5b33]" />
                Secure roles
              </span>
            </div>
          </div>

          {loadingUsers ? (
            <div className="px-2 sm:px-0">
              <TableSkeleton rows={8} />
            </div>
          ) : filteredAdmins.length === 0 ? (
            <div className={ui.cardBody}>
              <EmptyState
                onAdd={() => setShowAddDrawer(true)}
                onClear={() => setSearchTerm("")}
                title="No admins found"
                subtitle="Try a different search, or create a new admin account."
              />
            </div>
          ) : (
            <div className="p-4 sm:p-6">
              {/* Mobile cards */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {pagedAdmins.map((u) => (
                  <MobileAdminCard
                    key={u.id}
                    u={u}
                    isMe={u.id === currentAdminId}
                    selected={selectedIds.has(u.id)}
                    onToggleSelect={() => toggleSelect(u.id)}
                    onEdit={() => setEditingUser(u)}
                    onDelete={() => setConfirmDeleteId(u.id)}
                    toast={toast}
                  />
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block">
                <div className="overflow-hidden rounded-3xl border border-[#e7e0d6] bg-white/75 backdrop-blur shadow-[0_18px_55px_-28px_rgba(0,0,0,0.22)]">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1050px] text-left">
                      <colgroup>
                        <col className="w-12" />
                        <col className="w-[30%]" />
                        <col className="w-[24%]" />
                        <col className="w-[14%]" />
                        <col className="w-[18%]" />
                        <col className="w-[14%]" />
                        <col className="w-[160px]" />
                      </colgroup>

                      <thead className="sticky top-0 z-10 bg-[#f4f1ec]/90 backdrop-blur border-b border-[#efe9e1]">
                        <tr className="text-[11px] uppercase tracking-widest text-[#7c6d62]">
                          <th className="px-4 py-4">
                            <input
                              type="checkbox"
                              checked={allOnPageSelected}
                              onChange={() => toggleSelectAll(pagedAdmins)}
                              className="h-4 w-4 rounded border-[#d7cec2] text-[#8b6f47] focus:ring-[#8b6f47]"
                            />
                          </th>
                          <SortTh
                            label="Name"
                            activeKey={sortKey}
                            dir={sortDir}
                            k="name"
                            onSort={(k, d) => {
                              setSortKey(k);
                              setSortDir(d);
                              setPage(1);
                            }}
                            className="px-4 py-4"
                          />
                          <SortTh
                            label="Email"
                            activeKey={sortKey}
                            dir={sortDir}
                            k="email"
                            onSort={(k, d) => {
                              setSortKey(k);
                              setSortDir(d);
                              setPage(1);
                            }}
                            className="px-4 py-4"
                          />
                          <th className="px-4 py-4">Phone</th>
                          <th className="px-4 py-4">Role / Access</th>
                          <SortTh
                            label="Joined"
                            activeKey={sortKey}
                            dir={sortDir}
                            k="createdAt"
                            onSort={(k, d) => {
                              setSortKey(k);
                              setSortDir(d);
                              setPage(1);
                            }}
                            className="px-4 py-4"
                          />
                          <th className="px-4 py-4 text-right">Actions</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-[#efe9e1]">
                        {pagedAdmins.map((u) => {
                          const fullName =
                            `${u.name ?? "—"} ${u.surname ?? ""}`.trim();
                          const isMe = u.id === currentAdminId;

                          return (
                            <tr
                              key={u.id}
                              className="group bg-white/60 hover:bg-[#fbf7ef] transition"
                            >
                              <td className="px-4 py-4 align-middle">
                                <input
                                  type="checkbox"
                                  checked={selectedIds.has(u.id)}
                                  disabled={isMe}
                                  onChange={() => toggleSelect(u.id)}
                                  className="h-4 w-4 rounded border-[#d7cec2] text-[#8b6f47] focus:ring-[#8b6f47] disabled:opacity-40"
                                />
                              </td>
                              <td className="px-4 py-4 align-middle">
                                <div className="flex items-center gap-3 min-w-0">
                                  <Avatar
                                    name={u.name}
                                    surname={u.surname}
                                    email={u.email}
                                  />
                                  <div className="min-w-0">
                                    <div className="text-[15px] font-semibold text-[#2f261f] truncate">
                                      {fullName}
                                      {isMe && (
                                        <span className="ml-2 inline-flex items-center rounded-full border border-[#efe9e1] bg-white px-2 py-0.5 text-[11px] text-[#8b6f47]">
                                          you
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-4 align-middle">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const ok = await copyToClipboard(u.email);
                                    toast({
                                      title: ok
                                        ? "Email copied"
                                        : "Copy failed",
                                      type: ok ? undefined : "error",
                                    });
                                  }}
                                  className="inline-flex items-center gap-2 text-sm text-[#4f4137] hover:underline underline-offset-2 truncate group"
                                >
                                  <span className="truncate">{u.email}</span>
                                  <span className="opacity-0 group-hover:opacity-100 transition text-[#a79a8f]">
                                    <Copy size={14} />
                                  </span>
                                </button>
                              </td>
                              <td className="px-4 py-4 align-middle">
                                {u.phone ? (
                                  <span className="text-sm text-[#4f4137]">
                                    {u.phone}
                                  </span>
                                ) : (
                                  <span className="text-[#a79a8f]">—</span>
                                )}
                              </td>
                              <td className="px-4 py-4 align-middle">
                                <AdminRoleBadge role={u.role} />
                              </td>
                              <td className="px-4 py-4 align-middle text-sm text-[#6f6258]">
                                {formatDate(u.createdAt)}
                              </td>
                              <td className="px-4 py-4 align-middle">
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => setEditingUser(u)}
                                    className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 transition"
                                  >
                                    <Edit3 size={16} /> Edit
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteId(u.id)}
                                    disabled={isMe}
                                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${isMe ? "border-[#efe9e1] bg-white text-[#b6aaa0] cursor-not-allowed" : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"}`}
                                  >
                                    <Trash2
                                      size={16}
                                      className={
                                        isMe ? "text-[#b6aaa0]" : "text-red-600"
                                      }
                                    />{" "}
                                    Delete
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
              </div>
            </div>
          )}
        </div>

        {/* Pagination */}
        {filteredAdmins.length > 0 ? (
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-[#7c6d62]">
            <div className={`${ui.soft} px-4 py-3`}>
              Showing <b>{from}</b>–<b>{to}</b> of{" "}
              <b>{filteredAdmins.length}</b>
            </div>
            <div className={`${ui.soft} px-3 py-2 flex items-center gap-2`}>
              <button
                className={`${ui.btn.base} ${ui.btn.subtle} !px-3 !py-2`}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft size={16} />
              </button>
              <div className="px-2 text-[#4f4137]">
                Page <b>{page}</b> of <b>{pageCount}</b>
              </div>
              <button
                className={`${ui.btn.base} ${ui.btn.subtle} !px-3 !py-2`}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page === pageCount}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Drawer: Add Admin */}
      {showAddDrawer ? (
        <SideDrawer
          title="Create Admin Account"
          onClose={() => setShowAddDrawer(false)}
        >
          {errorMessage && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}
          {addFormError && (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {addFormError}
            </div>
          )}

          <form onSubmit={handleAddAdmin} className="space-y-6">
            {/* Role Access Control Section */}
            <div className="rounded-3xl border border-[#efe9e1] bg-white/75 p-5 shadow-sm">
              <div className="mb-4">
                <div className="text-xs uppercase tracking-widest text-[#a79a8f]">
                  Security
                </div>
                <div className="text-sm font-semibold text-[#4f4137]">
                  Admin Role & Permissions
                </div>
              </div>
              <RoleSelector selectedRole={addRole} onChange={setAddRole} />
            </div>

            {/* Account */}
            <div className="rounded-3xl border border-[#efe9e1] bg-white/75 p-5 shadow-sm">
              <div className="mb-4">
                <div className="text-xs uppercase tracking-widest text-[#a79a8f]">
                  Account
                </div>
                <div className="text-sm font-semibold text-[#4f4137]">
                  Login Credentials
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#6f6258] mb-1.5">
                    Email Address
                  </label>
                  <input
                    ref={addEmailRef}
                    name="email"
                    type="email"
                    placeholder="admin@company.com"
                    required
                    value={addEmail}
                    onChange={(e) => {
                      setAddEmail(e.target.value);
                      setAddFormError("");
                    }}
                    className={ui.input}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#6f6258] mb-1.5">
                    Password
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      name="password"
                      type={pwVisible ? "text" : "password"}
                      placeholder="Minimum 8 characters"
                      required
                      className={`${ui.input} flex-1`}
                      value={addPw}
                      onChange={(e) => {
                        setAddPw(e.target.value);
                        setAddFormError("");
                      }}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPwVisible((v) => !v)}
                        className={ui.btn.icon}
                      >
                        {pwVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAddPw(generatePassword());
                          toast({ title: "Generated", icon: Sparkles });
                        }}
                        className="inline-flex items-center gap-2 rounded-2xl border border-[#e7e0d6] bg-white px-4 text-sm font-medium text-[#4f4137] hover:bg-[#f5f1ea] shadow-sm"
                      >
                        <Sparkles size={18} /> Generate
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Profile */}
            <div className="rounded-3xl border border-[#efe9e1] bg-white/75 p-5 shadow-sm">
              <div className="mb-4">
                <div className="text-xs uppercase tracking-widest text-[#a79a8f]">
                  Profile
                </div>
                <div className="text-sm font-semibold text-[#4f4137]">
                  Personal Details
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#6f6258] mb-1.5">
                    First name
                  </label>
                  <input
                    name="name"
                    placeholder="e.g. Maria"
                    className={ui.input}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#6f6258] mb-1.5">
                    Last name
                  </label>
                  <input
                    name="surname"
                    placeholder="e.g. Papadopoulou"
                    className={ui.input}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#6f6258] mb-1.5">
                    Phone
                  </label>
                  <input
                    name="phone"
                    placeholder="+30 69…"
                    className={ui.input}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#6f6258] mb-1.5">
                    Date of birth
                  </label>
                  <input name="dateOfBirth" type="date" className={ui.input} />
                </div>
              </div>
            </div>

            {/* Footer actions */}
            <div className="sticky bottom-0 -mx-5 mt-6 border-t border-[#efe9e1] bg-white/85 backdrop-blur px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddDrawer(false)}
                  className={`${ui.btn.base} ${ui.btn.ghost} sm:min-w-[140px]`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`${ui.btn.base} ${ui.btn.primary} sm:min-w-[180px]`}
                  disabled={isPending || !emailOk || addPw.length < 8}
                >
                  <Check size={16} /> Create Admin
                </button>
              </div>
            </div>
          </form>
        </SideDrawer>
      ) : null}

      {/* Edit modal */}
      {editingUser ? (
        <Modal title="Edit Administrator" onClose={() => setEditingUser(null)}>
          <form
            onSubmit={handleEditAdmin}
            className="flex flex-col max-h-[85vh] sm:max-h-[80vh]"
          >
            {/* Scrollable Area */}
            <div className="flex-1 overflow-y-auto pr-1 sm:pr-2 pb-4 space-y-6 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#e1dbd2] [&::-webkit-scrollbar-thumb]:rounded-full">
              {/* Interactive Role Selector for Edit Mode */}
              <div>
                <div className="mb-3">
                  <label className="block text-xs font-medium text-[#6f6258] uppercase tracking-widest">
                    Assigned Role
                  </label>
                </div>
                <RoleSelector
                  selectedRole={editingUser.role || "manager"}
                  onChange={(newRole) =>
                    setEditingUser((prev) => ({ ...prev, role: newRole }))
                  }
                />
                {editingUser.id === currentAdminId &&
                  editingUser.role !== "superadmin" && (
                    <p className="mt-3 text-xs text-[#8b6f47]">
                      Note: You cannot remove your own Super Admin access.
                    </p>
                  )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t border-[#efe9e1]">
                <div className="md:col-span-2">
                  <TextInput
                    name="email"
                    placeholder="Email Address"
                    defaultValue={editingUser.email}
                    required
                  />
                </div>
                <TextInput
                  name="name"
                  placeholder="First Name"
                  defaultValue={editingUser.name ?? ""}
                />
                <TextInput
                  name="surname"
                  placeholder="Last Name"
                  defaultValue={editingUser.surname ?? ""}
                />
                <TextInput
                  name="phone"
                  placeholder="Phone Number"
                  defaultValue={editingUser.phone ?? ""}
                />
                <TextInput
                  name="dateOfBirth"
                  type="date"
                  placeholder="Date of Birth"
                  defaultValue={
                    editingUser.dateOfBirth
                      ? toYMD(editingUser.dateOfBirth)
                      : ""
                  }
                />
              </div>
            </div>

            {/* Sticky Footer Area */}
            <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-4 mt-2 border-t border-[#efe9e1] shrink-0 bg-white">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className={`${ui.btn.base} ${ui.btn.subtle}`}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`${ui.btn.base} ${ui.btn.primary}`}
                disabled={isPending}
              >
                <Check size={16} /> Save Changes
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {/* Confirm delete */}
      {confirmDeleteId ? (
        <ConfirmDialog
          title="Delete admin?"
          description="This action cannot be undone. The admin will be permanently removed."
          confirmLabel="Delete"
          onCancel={() => setConfirmDeleteId(null)}
          onConfirm={() => handleDelete(confirmDeleteId)}
        />
      ) : null}

      {createdAdmin ? (
        <Modal
          title="Admin created successfully"
          onClose={() => setCreatedAdmin(null)}
        >
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              The admin account has been successfully created.
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={() => {
                  setCreatedAdmin(null);
                  setShowAddDrawer(true);
                }}
                className={`${ui.btn.base} ${ui.btn.subtle}`}
              >
                Create another
              </button>
              <button
                type="button"
                onClick={() => setCreatedAdmin(null)}
                className={`${ui.btn.base} ${ui.btn.primary}`}
              >
                <Check size={16} /> Done
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      <ToastHost toasts={toasts} />
    </div>
  );
}
