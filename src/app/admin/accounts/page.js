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
} from "lucide-react";

import {
  StatCard,
  Select,
  RoleBadge,
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
    "w-full rounded-2xl border border-[#e3ddd4] bg-[#fbfaf7] px-4 py-3 text-sm text-[#4f4137] placeholder-[#b6aaa0] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/35 focus:bg-white",

  kbd: "px-1.5 py-0.5 rounded-md bg-[#fff4e1] border border-[#e3ddd4] text-[11px] font-medium text-[#4f4137]",
};

/* ------------------------------ helpers ------------------------------ */
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

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
        title={`Sort by ${label}`}
        aria-label={`Sort by ${label}`}
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
                title="Copy email"
              >
                {u.email}
              </button>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-[#e7e0d6] bg-[#fbfaf7] px-2.5 py-1 text-xs text-[#4f4137]">
                  <RoleBadge role={u.role} />
                </span>
                {u.phone ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-[#e7e0d6] bg-white px-2.5 py-1 text-xs text-[#4f4137] hover:bg-[#f5f1ea]"
                    onClick={async () => {
                      const ok = await copyToClipboard(u.phone);
                      toast({
                        title: ok ? "Phone copied" : "Copy failed",
                        type: ok ? undefined : "error",
                      });
                    }}
                    title="Copy phone"
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
              aria-label="Delete"
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

/* ------------------------------ page ------------------------------ */
export default function AdminAccountsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  // ---- role gate ----
  const [role, setRole] = useState(null); // 'admin' | 'user' | 'anon' | null
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

  const [errorMessage, setErrorMessage] = useState("");
  const { toasts, toast } = useToasts();
  const [isPending, startTransition] = useTransition();

  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);

  const searchRef = useRef(null);

  // Add-drawer refs / state (declare FIRST)
  const addEmailRef = useRef(null);
  const [addEmail, setAddEmail] = useState("");
  const [addPw, setAddPw] = useState("");
  const [addPw2, setAddPw2] = useState("");
  const [addFormError, setAddFormError] = useState("");
  const [pwVisible, setPwVisible] = useState(false);
  const [pwJustCopied, setPwJustCopied] = useState(false);

  // derived validation (NOW it's safe to use addPw/addPw2)
  const emailOk = useMemo(
    () => /^\S+@\S+\.\S+$/.test(addEmail.trim()),
    [addEmail]
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

  const pwMatch = useMemo(() => {
    if (!addPw2) return true;
    return addPw === addPw2;
  }, [addPw, addPw2]);

  useEffect(() => {
    if (showAddDrawer) {
      setAddEmail("");
      setAddFormError("");
      setErrorMessage("");
      setPwVisible(false);
      setPwJustCopied(false);
      setAddPw("");
      setAddPw2("");
      setTimeout(() => addEmailRef.current?.focus(), 80);
    }
  }, [showAddDrawer]);

  // role gate logic
  const authRole = useMemo(
    () => user?.app_metadata?.role ?? user?.user_metadata?.role ?? null,
    [user]
  );

  useEffect(() => {
    if (loading) return;

    if (!user) {
      setRole("anon");
      setGateReady(true);
      return;
    }

    if (authRole) setRole(authRole); // seed fast

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
    if (!user || role !== "admin") router.replace("/");
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
    if (gateReady && role === "admin") fetchUsers();
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

  // derived: admins only
  const admins = useMemo(
    () => users.filter((u) => u.role === "admin"),
    [users]
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
  // selection state (bulk actions)
  const [selectedIds, setSelectedIds] = useState(new Set());

  const isSelf = useCallback(
    (id) => String(id) === String(currentAdminId),
    [currentAdminId]
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
      allSelected ? new Set() : new Set(selectable.map((r) => r.id))
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
      // eslint-disable-next-line no-await-in-loop
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
    const passwordConfirm = addPw2 || "";

    const name = (form.name.value || "").trim();
    const surname = (form.surname.value || "").trim();
    const phone = (form.phone.value || "").trim();
    const dateOfBirth = form.dateOfBirth.value || null;

    if (!emailOk) {
      setAddFormError("Please enter a valid email address.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setAddFormError("Please enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setAddFormError("Password must be at least 8 characters.");
      return;
    }
    if (password !== passwordConfirm) {
      setAddFormError("Passwords do not match.");
      return;
    }

    const body = {
      email,
      password,
      name,
      surname,
      phone,
      role: "admin",
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

      if (res.ok) {
        form.reset();
        setAddPw("");
        setAddPw2("");
        setShowAddDrawer(false);
        toast({ title: "Admin created", icon: Check });
        startTransition(fetchUsers);
      } else {
        setErrorMessage(data?.error || "Something went wrong.");
        setTimeout(() => setErrorMessage(""), 6000);
      }
    } catch {
      setErrorMessage("Network error. Please try again.");
      setTimeout(() => setErrorMessage(""), 6000);
    }
  };

  const handleEditAdmin = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const newRole = form.role.value;

    if (editingUser.id === currentAdminId && newRole !== "admin") {
      toast({ title: "You can't demote yourself.", type: "error" });
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

  if (!isClient || loading || !gateReady || role !== "admin") return null;

  const from = filteredAdmins.length ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(page * pageSize, filteredAdmins.length);
  const pwScore = scorePassword(addPw);
  const pwLabels = ["Very weak", "Weak", "Okay", "Strong", "Very strong"];

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
                <span className={`${ui.btn.chip} hidden sm:inline-flex`}>
                  Esc closes dialogs
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
                  aria-label="Clear search"
                  title="Clear"
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
                aria-label="Refresh"
                title="Refresh (R)"
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
                  title={
                    deletableSelectedCount === 0
                      ? "You can’t delete your own account"
                      : "Delete selected"
                  }
                >
                  Delete selected
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[#7c6d62]">
              <span className={ui.btn.chip}>
                Tip: click email/phone to copy <Copy size={14} />
              </span>
              <span className={ui.btn.chip}>Bulk actions: use checkboxes</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className={ui.card}>
          <div className={ui.cardHeader}>
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-widest text-[#a79a8f]">
                Admins list
              </div>
              <div className="mt-1 text-sm text-[#4f4137]">
                Manage who can access your admin area.
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
                      <caption className="sr-only">
                        Administrator accounts
                      </caption>

                      {/* widths that actually feel balanced */}
                      <colgroup>
                        <col className="w-12" />
                        <col className="w-[36%]" />
                        <col className="w-[26%]" />
                        <col className="w-[14%]" />
                        <col className="w-[12%]" />
                        <col className="w-[12%]" />
                        <col className="w-[180px]" />
                      </colgroup>

                      <thead className="sticky top-0 z-10 bg-[#f4f1ec]/90 backdrop-blur border-b border-[#efe9e1]">
                        <tr className="text-[11px] uppercase tracking-widest text-[#7c6d62]">
                          <th className="px-4 py-4">
                            <input
                              aria-label="Select all on page"
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
                            onSort={(k, nextDir) => {
                              setSortKey(k);
                              setSortDir(nextDir);
                              setPage(1);
                            }}
                            className="px-4 py-4"
                          />

                          <SortTh
                            label="Email"
                            activeKey={sortKey}
                            dir={sortDir}
                            k="email"
                            onSort={(k, nextDir) => {
                              setSortKey(k);
                              setSortDir(nextDir);
                              setPage(1);
                            }}
                            className="px-4 py-4"
                          />

                          <th className="px-4 py-4">Phone</th>
                          <th className="px-4 py-4 text-center">Role</th>

                          <SortTh
                            label="Joined"
                            activeKey={sortKey}
                            dir={sortDir}
                            k="createdAt"
                            onSort={(k, nextDir) => {
                              setSortKey(k);
                              setSortDir(nextDir);
                              setPage(1);
                            }}
                            className="px-4 py-4"
                          />

                          <th className="px-4 py-4 text-right">Actions</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-[#efe9e1]">
                        {pagedAdmins.map((u) => {
                          const fullName = `${u.name ?? "—"} ${
                            u.surname ?? ""
                          }`.trim();
                          const isMe = u.id === currentAdminId;

                          return (
                            <tr
                              key={u.id}
                              className="group bg-white/60 hover:bg-[#fbf7ef] transition"
                            >
                              {/* checkbox */}
                              <td className="px-4 py-4 align-middle">
                                <input
                                  aria-label={`Select ${u.email}`}
                                  type="checkbox"
                                  checked={selectedIds.has(u.id)}
                                  disabled={isMe}
                                  onChange={() => toggleSelect(u.id)}
                                  title={
                                    isMe
                                      ? "You can't select your own account"
                                      : "Select"
                                  }
                                  className="h-4 w-4 rounded border-[#d7cec2] text-[#8b6f47] focus:ring-[#8b6f47] disabled:opacity-40"
                                />
                              </td>

                              {/* NAME (avatar + name + email secondary) */}
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
                                      {isMe ? (
                                        <span className="ml-2 inline-flex items-center rounded-full border border-[#efe9e1] bg-white px-2 py-0.5 text-[11px] text-[#8b6f47]">
                                          you
                                        </span>
                                      ) : null}
                                    </div>
                                    <div className="mt-0.5 text-sm text-[#8d7f74] truncate">
                                      {u.email}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* EMAIL (copy affordance + helper text) */}
                              <td className="px-4 py-4 align-middle">
                                <div className="min-w-0">
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
                                    className="inline-flex items-center gap-2 text-sm text-[#4f4137] hover:underline underline-offset-2 truncate"
                                    title="Copy email"
                                  >
                                    <span className="truncate">{u.email}</span>
                                    <span className="opacity-0 group-hover:opacity-100 transition text-[#a79a8f]">
                                      <Copy size={14} />
                                    </span>
                                  </button>
                                  <div className="mt-1 text-xs text-[#a79a8f]">
                                    Click to copy
                                  </div>
                                </div>
                              </td>

                              {/* PHONE (pill copy) */}
                              <td className="px-4 py-4 align-middle">
                                {u.phone ? (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const ok = await copyToClipboard(u.phone);
                                      toast({
                                        title: ok
                                          ? "Phone copied"
                                          : "Copy failed",
                                        type: ok ? undefined : "error",
                                      });
                                    }}
                                    className="inline-flex items-center gap-2 rounded-full border border-[#efe9e1] bg-white px-3 py-1.5 text-sm text-[#2f261f] hover:bg-[#f5f1ea]"
                                    title="Copy phone"
                                  >
                                    {u.phone}{" "}
                                    <Copy
                                      size={14}
                                      className="text-[#a79a8f]"
                                    />
                                  </button>
                                ) : (
                                  <span className="text-[#a79a8f]">—</span>
                                )}
                              </td>

                              {/* ROLE centered */}
                              <td className="px-4 py-4 align-middle text-center">
                                <div className="inline-flex justify-center">
                                  <RoleBadge role={u.role} />
                                </div>
                              </td>

                              {/* JOINED */}
                              <td className="px-4 py-4 align-middle text-sm text-[#6f6258]">
                                {formatDate(u.createdAt)}
                              </td>

                              {/* ACTIONS (outlined pills like your screenshot) */}
                              <td className="px-4 py-4 align-middle">
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => setEditingUser(u)}
                                    className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 transition"
                                    title="Edit"
                                    aria-label="Edit"
                                  >
                                    <Edit3 size={16} /> Edit
                                  </button>

                                  <button
                                    onClick={() => setConfirmDeleteId(u.id)}
                                    disabled={isMe}
                                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                                      isMe
                                        ? "border-[#efe9e1] bg-white text-[#b6aaa0] cursor-not-allowed"
                                        : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                                    }`}
                                    title={
                                      isMe
                                        ? "You can’t delete your own account"
                                        : "Delete"
                                    }
                                    aria-label="Delete"
                                  >
                                    <Trash2
                                      size={16}
                                      className={
                                        isMe ? "text-[#b6aaa0]" : "text-red-600"
                                      }
                                    />
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
                aria-label="Previous page"
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
                aria-label="Next page"
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
          {/* Server/API error */}
          {errorMessage ? (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          {/* Client validation error */}
          {addFormError ? (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {addFormError}
            </div>
          ) : null}

          <div className="mb-4 rounded-3xl border border-[#e7e0d6] bg-white/75 px-4 py-3 text-sm text-[#7c6d62]">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-9 w-9 rounded-2xl border border-[#e7e0d6] bg-white flex items-center justify-center shadow-sm">
                <Shield size={16} className="text-[#7a5b33]" />
              </div>
              <div>
                <div className="font-medium text-[#4f4137]">
                  Admin role is enforced
                </div>
                <div className="mt-0.5">
                  This account will be created with <b>admin</b> permissions.
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleAddAdmin} className="space-y-6">
            {/* Account */}
            <div className="rounded-3xl border border-[#efe9e1] bg-white/75 p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <div className="text-xs uppercase tracking-widest text-[#a79a8f]">
                    Account
                  </div>
                  <div className="text-sm font-semibold text-[#4f4137]">
                    Login & Security
                  </div>
                </div>
                <span className="rounded-full border border-[#efe9e1] bg-[#fbfaf7] px-3 py-1 text-xs text-[#4f4137]">
                  Required
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#6f6258] mb-1">
                    Email
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
                      if (addFormError) setAddFormError("");
                    }}
                    className={`${ui.input} pr-10`}
                  />

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="text-xs text-[#a79a8f]">
                      This will be used to sign in.
                    </div>
                    {addEmail.length > 0 && (
                      <div
                        className={`text-xs ${
                          emailOk ? "text-emerald-700" : "text-red-700"
                        }`}
                      >
                        {emailOk ? "Looks good" : "Invalid email"}
                      </div>
                    )}
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-medium text-[#6f6258] mb-1">
                    Password
                  </label>

                  <div className="flex flex-col sm:flex-row sm:items-stretch gap-2">
                    <input
                      name="password"
                      type={pwVisible ? "text" : "password"}
                      placeholder="Minimum 8 characters"
                      required
                      className={`${ui.input} flex-1`}
                      value={addPw}
                      onChange={(e) => {
                        setAddPw(e.target.value);
                        if (addFormError) setAddFormError("");
                      }}
                    />

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setPwVisible((v) => !v)}
                        className="h-[46px] w-[46px] inline-flex items-center justify-center rounded-2xl border border-[#e7e0d6] bg-white text-[#4f4137] hover:bg-[#f5f1ea] shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/35"
                        aria-label={
                          pwVisible ? "Hide password" : "Show password"
                        }
                        title={pwVisible ? "Hide" : "Show"}
                      >
                        {pwVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const pw = generatePassword();
                          setAddPw(pw);
                          setAddPw2(pw);
                          setAddFormError("");
                          setPwJustCopied(false);
                          toast({
                            title: "Password generated",
                            icon: Sparkles,
                          });
                        }}
                        className="h-[46px] inline-flex items-center justify-center gap-2 rounded-2xl border border-[#e7e0d6] bg-white px-4 text-sm font-medium text-[#4f4137] hover:bg-[#f5f1ea] shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/35"
                        aria-label="Generate password"
                        title="Generate strong password"
                      >
                        <Sparkles size={18} />
                        <span className="hidden sm:inline">Generate</span>
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          if (!addPw) return;
                          const ok = await copyToClipboard(addPw);
                          if (ok) {
                            setPwJustCopied(true);
                            toast({ title: "Password copied", icon: Copy });
                            setTimeout(() => setPwJustCopied(false), 1200);
                          } else {
                            toast({ title: "Copy failed", type: "error" });
                          }
                        }}
                        disabled={!addPw || pwJustCopied}
                        className="h-[46px] inline-flex items-center justify-center gap-2 rounded-2xl border border-[#e7e0d6] bg-white px-4 text-sm font-medium text-[#4f4137] hover:bg-[#f5f1ea] shadow-sm transition disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/35"
                        aria-label="Copy password"
                        title={pwJustCopied ? "Copied!" : "Copy password"}
                      >
                        <Copy size={18} />
                        <span className="hidden sm:inline">
                          {pwJustCopied ? "Copied" : "Copy"}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Requirements checklist stays BELOW, clean, no overlap */}
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div
                      className={`flex items-center gap-2 ${
                        pwReq.len ? "text-emerald-700" : "text-[#7c6d62]"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          pwReq.len ? "bg-emerald-600" : "bg-[#d9d2c7]"
                        }`}
                      />
                      8+ characters
                    </div>
                    <div
                      className={`flex items-center gap-2 ${
                        pwReq.num ? "text-emerald-700" : "text-[#7c6d62]"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          pwReq.num ? "bg-emerald-600" : "bg-[#d9d2c7]"
                        }`}
                      />
                      Number
                    </div>
                    <div
                      className={`flex items-center gap-2 ${
                        pwReq.upper ? "text-emerald-700" : "text-[#7c6d62]"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          pwReq.upper ? "bg-emerald-600" : "bg-[#d9d2c7]"
                        }`}
                      />
                      Uppercase
                    </div>
                    <div
                      className={`flex items-center gap-2 ${
                        pwReq.special ? "text-emerald-700" : "text-[#7c6d62]"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          pwReq.special ? "bg-emerald-600" : "bg-[#d9d2c7]"
                        }`}
                      />
                      Special character
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Profile */}
            <div className="rounded-3xl border border-[#efe9e1] bg-white/75 p-4">
              <div className="text-xs uppercase tracking-widest text-[#a79a8f]">
                Profile
              </div>
              <div className="text-sm font-semibold text-[#4f4137] mb-3">
                Personal Details
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#6f6258] mb-1">
                    First name
                  </label>
                  <input
                    name="name"
                    placeholder="e.g. Maria"
                    className={ui.input}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#6f6258] mb-1">
                    Last name
                  </label>
                  <input
                    name="surname"
                    placeholder="e.g. Papadopoulou"
                    className={ui.input}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#6f6258] mb-1">
                    Phone
                  </label>
                  <input
                    name="phone"
                    placeholder="+30 69…"
                    className={ui.input}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#6f6258] mb-1">
                    Date of birth
                  </label>
                  <input name="dateOfBirth" type="date" className={ui.input} />
                </div>
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
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
                disabled={isPending || !emailOk || addPw.length < 8 || !pwMatch}
              >
                <Check size={16} /> Create Admin
              </button>
            </div>
          </form>
        </SideDrawer>
      ) : null}

      {/* Edit modal */}
      {editingUser ? (
        <Modal title="Edit Admin" onClose={() => setEditingUser(null)}>
          <form
            onSubmit={handleEditAdmin}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <TextInput
              name="email"
              placeholder="Email"
              defaultValue={editingUser.email}
              required
            />
            <div />

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
              placeholder="Phone"
              defaultValue={editingUser.phone ?? ""}
            />
            <TextInput
              name="dateOfBirth"
              type="date"
              placeholder="Date of Birth"
              defaultValue={
                editingUser.dateOfBirth ? toYMD(editingUser.dateOfBirth) : ""
              }
            />

            {/* Role */}
            <div className="md:col-span-2">
              <Select
                label="Role"
                value={editingUser.role || "admin"}
                onChange={(v) =>
                  setEditingUser((prev) => ({ ...prev, role: v }))
                }
                options={[
                  { value: "admin", label: "Admin" },
                  { value: "user", label: "User" },
                ]}
              />
              <input
                type="hidden"
                name="role"
                value={editingUser.role || "admin"}
              />
              {editingUser.id === currentAdminId ? (
                <p className="mt-2 text-xs text-[#8b6f47]">
                  You can edit your details, but you can’t demote your own
                  account.
                </p>
              ) : null}
            </div>

            <div className="md:col-span-2 flex flex-col sm:flex-row sm:justify-end gap-2 mt-2">
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

      <ToastHost toasts={toasts} />
    </div>
  );
}
