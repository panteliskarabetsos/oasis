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
  ALL_PERMISSIONS,
  PERMISSION_GROUPS,
  ROLE_PERMISSIONS,
} from "@/lib/auth/permissions";

import { effectiveAccess } from "../_ui/nav";
import Icon from "../_ui/Icon";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Field,
  Muted,
  Page,
  PageHeader,
  Select,
  Skeleton,
  Table,
  Td,
  Th,
  Tr,
  inputClass,
} from "../_ui";
import { Search, Shield, Check, Copy, Sparkles, Lock, Briefcase, Megaphone, Headset, Calculator, UserCheck } from "lucide-react";

import {
  ToastHost,
  useDebouncedValue,
  useToasts,
} from "@/app/admin/_components/ui";

/* ------------------------------ Roles & Permissions Map ------------------------------ */

// Labels come straight from the shared catalogue so this screen can never
// offer a component the API does not recognise.
const PERMISSIONS = Object.fromEntries(
  PERMISSION_GROUPS.flatMap((g) => g.permissions),
);

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
  {
    id: "custom",
    title: "Custom access",
    icon: Sparkles,
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    description:
      "Start from nothing and pick exactly which components this person can open.",
    permissions: [],
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

function PermissionPicker({ role, granted, onChange }) {
  const base = ROLE_PERMISSIONS[role];
  const inherited = base === "*" ? ALL_PERMISSIONS : base || [];
  const list = Array.isArray(granted) ? granted : [];

  if (base === "*") {
    return (
      <p className="rounded-xl bg-[#f6f3ee] px-4 py-3 text-sm text-[#6b5c4d]">
        A Super Admin already reaches every component, so there is nothing to pick.
      </p>
    );
  }

  const toggle = (key) => {
    if (inherited.includes(key)) return; // comes with the role
    onChange(list.includes(key) ? list.filter((p) => p !== key) : [...list, key]);
  };

  const selectedCount = new Set([...inherited, ...list]).size;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#8a7a6a]">
          {selectedCount} of {ALL_PERMISSIONS.length} components
        </p>
        {list.length ? (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xs font-semibold text-[#8a7a6a] hover:text-[#a33c22] hover:underline"
          >
            Clear extra grants
          </button>
        ) : null}
      </div>

      {PERMISSION_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#a2937f]">
            {group.label}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {group.permissions.map(([key, label]) => {
              const isInherited = inherited.includes(key);
              const isChecked = isInherited || list.includes(key);
              return (
                <label
                  key={key}
                  title={isInherited ? "Included in this role" : undefined}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
                    isInherited
                      ? "cursor-not-allowed border-[#e3ddd4] bg-[#f6f3ee] text-[#8a7a6a]"
                      : isChecked
                        ? "cursor-pointer border-[#8b6f47] bg-white text-[#3f3127]"
                        : "cursor-pointer border-[#e3ddd4] bg-white/60 text-[#5a4a3f] hover:border-[#d3c9bd]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={isInherited}
                    onChange={() => toggle(key)}
                    className="h-4 w-4 accent-[#8b6f47]"
                  />
                  <span className="truncate">{label}</span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
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
  const [addPermissions, setAddPermissions] = useState([]);

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
      setAddPermissions([]);

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
      role: addRole,
      permissions: addPermissions,
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
      permissions: editingUser.permissions || [],
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

  /* --------------------------------- view --------------------------------- */

  const onSort = (k) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(k === "createdAt" ? "desc" : "asc");
    }
    setPage(1);
  };

  const roleMeta = (r) => getRoleConfig(r);
  const accessOf = (u) => effectiveAccess(u.role, u.permissions);
  const seesMoney = (u) => {
    const a = accessOf(u);
    return a === "*" || a.includes("financials");
  };

  return (
    <Page>
      <PageHeader
        eyebrow="People & system"
        title="Staff accounts"
        description={
          loadingUsers
            ? "Loading accounts…"
            : `${admins.length} staff account${admins.length === 1 ? "" : "s"}${
                newThisMonth ? ` · ${newThisMonth} added this month` : ""
              }`
        }
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => startTransition(fetchUsers)}
              disabled={refreshing || isPending}
            >
              <Icon name="clock" size={15} /> {refreshing ? "Refreshing…" : "Refresh"}
            </Button>
            <Button variant="primary" onClick={() => setShowAddDrawer(true)}>
              <Icon name="plus" size={15} /> New staff account
            </Button>
          </>
        }
      />

      {errorMessage ? <ErrorNote className="mb-5">{errorMessage}</ErrorNote> : null}

      {/* who holds what */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard label="Staff accounts" value={admins.length} />
        <SummaryCard
          label="Super Admins"
          value={admins.filter((u) => ROLE_PERMISSIONS[u.role] === "*").length}
          hint="Unrestricted"
        />
        <SummaryCard
          label="See revenue"
          value={admins.filter(seesMoney).length}
          hint="Hold financials"
        />
        <SummaryCard label="Added this month" value={newThisMonth} />
      </div>

      <Card padded={false} className="overflow-hidden">
        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[#e6e0d6] p-4">
          <div className="relative min-w-[220px] flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#b0a294]">
              <Icon name="search" size={16} />
            </span>
            <input
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="Search name, email or role"
              className={`${inputClass} h-11 pl-9 ${searchTerm ? "pr-9" : ""}`}
            />
            {searchTerm ? (
              <button
                onClick={() => setSearchTerm("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#9a8c7e] hover:bg-[#f2ede4]"
              >
                <Icon name="x" size={14} />
              </button>
            ) : null}
          </div>

          {selectedIds.size ? (
            <Button variant="danger" onClick={handleBulkDelete} disabled={!deletableSelectedCount}>
              <Icon name="trash" size={15} /> Delete {deletableSelectedCount}
            </Button>
          ) : null}

          <Select
            value={String(pageSize)}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="h-11 !w-auto"
            aria-label="Rows per page"
          >
            {[10, 25, 50].map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </Select>
        </div>

        {/* list */}
        {loadingUsers ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : !filteredAdmins.length ? (
          <EmptyState
            icon={<Icon name="shield" size={20} />}
            title={admins.length ? "No matches" : "No staff accounts yet"}
            description={
              admins.length
                ? "No account matches that search."
                : "Create the first staff account to give someone access to the console."
            }
            action={
              admins.length ? (
                <Button variant="secondary" onClick={() => setSearchTerm("")}>
                  Clear search
                </Button>
              ) : (
                <Button variant="primary" onClick={() => setShowAddDrawer(true)}>
                  New staff account
                </Button>
              )
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th className="w-10">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={() => toggleSelectAll(pagedAdmins)}
                    aria-label="Select all on this page"
                    className="h-4 w-4 cursor-pointer accent-[#8b6f47]"
                  />
                </Th>
                <SortableTh label="Name" k="name" activeKey={sortKey} dir={sortDir} onSort={onSort} />
                <SortableTh label="Role" k="role" activeKey={sortKey} dir={sortDir} onSort={onSort} />
                <Th>Access</Th>
                <SortableTh label="Added" k="createdAt" activeKey={sortKey} dir={sortDir} onSort={onSort} />
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {pagedAdmins.map((u) => {
                const meta = roleMeta(u.role);
                const access = accessOf(u);
                const count = access === "*" ? ALL_PERMISSIONS.length : access.length;
                return (
                  <Tr key={u.id} className={selectedIds.has(u.id) ? "bg-[#faf6ef]" : ""}>
                    <Td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(u.id)}
                        onChange={() => toggleSelect(u.id)}
                        disabled={isSelf(u.id)}
                        aria-label={`Select ${u.email}`}
                        className="h-4 w-4 cursor-pointer accent-[#8b6f47] disabled:opacity-30"
                      />
                    </Td>

                    <Td>
                      <span className="block font-semibold text-[#2a211a]">
                        {[u.name, u.surname].filter(Boolean).join(" ") || "—"}
                        {isSelf(u.id) ? (
                          <span className="ml-2 text-[11px] font-medium text-[#9a8c7e]">you</span>
                        ) : null}
                      </span>
                      <span className="block text-[11.5px] text-[#9a8c7e]">{u.email}</span>
                    </Td>

                    <Td>
                      <Badge variant={ROLE_PERMISSIONS[u.role] === "*" ? "brand" : "neutral"}>
                        {meta?.title ?? u.role}
                      </Badge>
                    </Td>

                    <Td>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[12.5px] text-[#7a6a5f]">
                          {access === "*" ? "Everything" : `${count} component${count === 1 ? "" : "s"}`}
                        </span>
                        {seesMoney(u) ? (
                          <Badge variant="warning">revenue</Badge>
                        ) : (
                          <span className="text-[11px] text-[#b0a294]">no revenue</span>
                        )}
                      </div>
                    </Td>

                    <Td className="whitespace-nowrap text-[#7a6a5f]">
                      {u.createdAt
                        ? new Date(u.createdAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </Td>

                    <Td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          title="Edit account"
                          aria-label={`Edit ${u.email}`}
                          onClick={() => setEditingUser(u)}
                          className="rounded-lg p-1.5 text-[#7a6a5f] hover:bg-[#f2ede4] hover:text-[#2a211a]"
                        >
                          <Icon name="file" size={15} />
                        </button>
                        <button
                          title={isSelf(u.id) ? "You cannot delete your own account" : "Delete account"}
                          aria-label={`Delete ${u.email}`}
                          disabled={isSelf(u.id)}
                          onClick={() => setConfirmDeleteId(u.id)}
                          className="rounded-lg p-1.5 text-[#7a6a5f] hover:bg-[#fbeae5] hover:text-[#a33c22] disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          <Icon name="trash" size={15} />
                        </button>
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}

        {/* pagination */}
        {!loadingUsers && filteredAdmins.length ? (
          <div className="flex items-center justify-between gap-3 border-t border-[#e6e0d6] px-4 py-3">
            <Muted className="text-[12px]">
              {from}–{to} of {filteredAdmins.length}
            </Muted>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={to >= filteredAdmins.length}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      {/* ------------------------------ create ------------------------------ */}
      {showAddDrawer ? (
        <Sheet
          title="New staff account"
          subtitle="They sign in with this email and password."
          onClose={() => setShowAddDrawer(false)}
        >
          <form onSubmit={handleAddAdmin} className="space-y-4">
            <Field label="Email" error={addEmail && !emailOk ? "Enter a valid email address." : null}>
              <input
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="name@youroasis.gr"
                className={inputClass}
                autoComplete="off"
              />
            </Field>

            <Field label="Temporary password" hint="Share it with them; they can change it later.">
              <div className="flex gap-2">
                <input
                  type={pwVisible ? "text" : "password"}
                  value={addPw}
                  onChange={(e) => setAddPw(e.target.value)}
                  className={`${inputClass} font-mono`}
                  autoComplete="new-password"
                />
                <Button type="button" variant="secondary" onClick={() => setPwVisible((v) => !v)}>
                  {pwVisible ? "Hide" : "Show"}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setAddPw(generatePassword())}>
                  Generate
                </Button>
              </div>
              <PasswordMeter value={addPw} requirements={pwReq} />
            </Field>

            <div className="border-t border-[#f0ebe2] pt-4">
              <p className="mb-3 text-[13px] font-semibold text-[#2a211a]">Role</p>
              <RoleSelector selectedRole={addRole} onChange={setAddRole} />
            </div>

            <div className="border-t border-[#f0ebe2] pt-4">
              <p className="mb-3 text-[13px] font-semibold text-[#2a211a]">
                {addRole === "custom" ? "Components" : "Extra components"}
              </p>
              <PermissionPicker role={addRole} granted={addPermissions} onChange={setAddPermissions} />
            </div>

            {addFormError ? <ErrorNote>{addFormError}</ErrorNote> : null}

            <div className="flex justify-end gap-2 border-t border-[#f0ebe2] pt-4">
              <Button type="button" variant="secondary" onClick={() => setShowAddDrawer(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isPending}>
                {isPending ? "Creating…" : "Create account"}
              </Button>
            </div>
          </form>
        </Sheet>
      ) : null}

      {/* ------------------------------- edit ------------------------------- */}
      {editingUser ? (
        <Sheet
          title="Edit staff account"
          subtitle={editingUser.email}
          onClose={() => setEditingUser(null)}
        >
          <form onSubmit={handleEditAdmin} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name">
                <input name="name" defaultValue={editingUser.name ?? ""} className={inputClass} />
              </Field>
              <Field label="Surname">
                <input name="surname" defaultValue={editingUser.surname ?? ""} className={inputClass} />
              </Field>
            </div>
            <Field label="Email">
              <input name="email" type="email" defaultValue={editingUser.email ?? ""} className={inputClass} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone">
                <input name="phone" defaultValue={editingUser.phone ?? ""} className={inputClass} />
              </Field>
              <Field label="Date of birth">
                <input
                  name="dateOfBirth"
                  type="date"
                  defaultValue={editingUser.dateOfBirth ? String(editingUser.dateOfBirth).slice(0, 10) : ""}
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="border-t border-[#f0ebe2] pt-4">
              <p className="mb-3 text-[13px] font-semibold text-[#2a211a]">Role</p>
              <RoleSelector
                selectedRole={editingUser.role || "manager"}
                onChange={(newRole) => setEditingUser((prev) => ({ ...prev, role: newRole }))}
              />
              {isSelf(editingUser.id) && editingUser.role !== "superadmin" ? (
                <p className="mt-3 text-[12px] text-[#8a6412]">
                  You cannot remove your own Super Admin access.
                </p>
              ) : null}
            </div>

            <div className="border-t border-[#f0ebe2] pt-4">
              <p className="mb-3 text-[13px] font-semibold text-[#2a211a]">
                {editingUser.role === "custom" ? "Components" : "Extra components"}
              </p>
              <PermissionPicker
                role={editingUser.role || "manager"}
                granted={editingUser.permissions || []}
                onChange={(permissions) => setEditingUser((prev) => ({ ...prev, permissions }))}
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-[#f0ebe2] pt-4">
              <Button type="button" variant="secondary" onClick={() => setEditingUser(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isPending}>
                {isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </Sheet>
      ) : null}

      {/* --------------------------- created summary --------------------------- */}
      {createdAdmin ? (
        <Sheet
          title="Account created"
          subtitle="Share these details once — the password is not shown again."
          onClose={() => setCreatedAdmin(null)}
        >
          <div className="space-y-3">
            <div className="rounded-2xl border border-[#e6e0d6] bg-[#fdfbf7] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9a8c7e]">Email</p>
              <p className="mt-0.5 font-mono text-[14px] text-[#2a211a]">{createdAdmin.email}</p>
              <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9a8c7e]">
                Temporary password
              </p>
              <p className="mt-0.5 font-mono text-[14px] text-[#2a211a]">{createdAdmin.password}</p>
            </div>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                navigator.clipboard
                  ?.writeText(`${createdAdmin.email} / ${createdAdmin.password}`)
                  .then(() => {
                    setPwJustCopied(true);
                    setTimeout(() => setPwJustCopied(false), 2000);
                  })
                  .catch(() => {});
              }}
            >
              <Icon name="copy" size={15} /> {pwJustCopied ? "Copied" : "Copy email and password"}
            </Button>
            <Button variant="primary" className="w-full" onClick={() => setCreatedAdmin(null)}>
              Done
            </Button>
          </div>
        </Sheet>
      ) : null}

      {/* ------------------------------ delete ------------------------------ */}
      {confirmDeleteId ? (
        <Sheet
          title="Delete staff account"
          subtitle="This removes their sign-in and console access immediately."
          onClose={() => setConfirmDeleteId(null)}
        >
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => handleDelete(confirmDeleteId)}>
              Delete account
            </Button>
          </div>
        </Sheet>
      ) : null}
      <ToastHost toasts={toasts} />
    </Page>
  );
}

/* ------------------------------- small parts ------------------------------ */

function SummaryCard({ label, value, hint }) {
  return (
    <Card className="py-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9a8c7e]">{label}</p>
      <p className="mt-1 font-serif text-[20px] text-[#2a211a]">{value}</p>
      {hint ? <p className="mt-0.5 text-[11.5px] text-[#9a8c7e]">{hint}</p> : null}
    </Card>
  );
}

function SortableTh({ label, k, activeKey, dir, onSort }) {
  const active = activeKey === k;
  return (
    <Th>
      <button
        onClick={() => onSort(k)}
        className={`inline-flex items-center gap-1 uppercase tracking-[0.14em] hover:text-[#2a211a] ${
          active ? "text-[#2a211a]" : ""
        }`}
      >
        {label}
        <span className={active ? "opacity-100" : "opacity-0"}>{dir === "asc" ? "▲" : "▼"}</span>
      </button>
    </Th>
  );
}

/** Slide-over used by every dialog on this page. */
function Sheet({ title, subtitle, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-[#e6e0d6] bg-white p-6 shadow-2xl sm:rounded-3xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-serif text-[19px] text-[#2a211a]">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-[12px] text-[#9a8c7e]">{subtitle}</p> : null}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-[#9a8c7e] hover:bg-[#f2ede4]"
          >
            <Icon name="x" size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const PW_REQ_LABELS = {
  len: "8+ characters",
  upper: "an uppercase letter",
  lower: "a lowercase letter",
  num: "a number",
  special: "a symbol",
};

function PasswordMeter({ value, requirements }) {
  // requirements is an object of booleans, not a list.
  const unmet = Object.entries(requirements ?? {})
    .filter(([, met]) => !met)
    .map(([k]) => PW_REQ_LABELS[k] ?? k);
  const score = scorePassword(value || "");
  const tone = score >= 4 ? "#3f6b3f" : score >= 3 ? "#8a6412" : "#a33c22";
  const label = score >= 4 ? "Strong" : score >= 3 ? "Fair" : "Weak";
  if (!value) return null;
  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#efe9df]">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${(score / 5) * 100}%`, background: tone }}
          />
        </div>
        <span className="text-[11.5px] font-semibold" style={{ color: tone }}>
          {label}
        </span>
      </div>
      {unmet.length ? (
        <p className="mt-1 text-[11.5px] text-[#9a8c7e]">Still needed: {unmet.join(", ")}</p>
      ) : null}
    </div>
  );
}
