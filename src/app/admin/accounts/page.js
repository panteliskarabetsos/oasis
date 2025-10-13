"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"; // ensure these are imported

function SortTh({ label, k, activeKey, dir, onSort, className = "" }) {
  const isActive = activeKey === k;
  const nextDir = !isActive ? "asc" : dir === "asc" ? "desc" : "asc";
  return (
    <th className={`p-3 font-semibold text-xs ${className}`}>
      <button
        type="button"
        onClick={() => onSort(k, nextDir)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 transition ${
          isActive
            ? "bg-white/90 border-[#d8cfc3] text-[#3d3227]"
            : "bg-transparent border-transparent text-[#5a4a3f] hover:bg-white/60 hover:border-[#e0dcd4]"
        }`}
        title={`Sort by ${label}`}
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
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key.toLowerCase() === "a") setShowAddDrawer(true);
      if (e.key.toLowerCase() === "r") fetchUsers();
      if (e.key === "Escape") {
        setShowAddDrawer(false);
        setEditingUser(null);
        setConfirmDeleteId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
  const fetchUsers = async () => {
    try {
      if (!users.length) setLoadingUsers(true);
      else setRefreshing(true);
      const res = await fetch("/api/admin/users", {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!data.error) setUsers(data);
    } finally {
      setLoadingUsers(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (gateReady && role === "admin") fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateReady, role]);

  // derived: admins only
  const admins = useMemo(
    () => users.filter((u) => u.role === "admin"),
    [users]
  );

  // stats
  const totalAdmins = admins.length;
  const newThisMonth = admins.filter((u) => {
    const d = new Date(u.createdAt);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    );
  }).length;

  // filter + sort
  const filteredAdmins = useMemo(() => {
    const q = debouncedTerm.toLowerCase();
    const byQuery = admins.filter((u) => {
      const fullName = `${u.name ?? ""} ${u.surname ?? ""}`.toLowerCase();
      const email = u.email?.toLowerCase() ?? "";
      const phone = u.phone ?? "";
      return fullName.includes(q) || email.includes(q) || phone.includes(q);
    });
    const sorted = [...byQuery].sort((a, b) => {
      let av, bv;
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

  // CRUD
  const currentAdminId = user?.id;
  // selection state (bulk actions)
  const [selectedIds, setSelectedIds] = useState(new Set());

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (rows) => {
    const allSelected =
      rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
    setSelectedIds(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  };

  const allOnPageSelected =
    pagedAdmins.length > 0 && pagedAdmins.every((r) => selectedIds.has(r.id));

  const handleBulkDelete = async () => {
    // deletes selected admins, skips your own id automatically due to your existing guard
    for (const id of Array.from(selectedIds)) {
      await handleDelete(id);
    }
    setSelectedIds(new Set());
  };

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
        toast({ title: data.error || "Failed to delete.", type: "error" });
      }
    } catch (e) {
      toast({ title: "Network error while deleting.", type: "error" });
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const handleAddAdmin = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const body = {
      email: form.email.value,
      password: form.password.value,
      name: form.name.value,
      surname: form.surname.value,
      phone: form.phone.value,
      role: "admin", // force admin role
      dateOfBirth: form.dateOfBirth.value || null,
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
        setShowAddDrawer(false);
        toast({ title: "Admin created", icon: Check });
        startTransition(fetchUsers);
      } else {
        setErrorMessage(data.error || "Something went wrong.");
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
      role: newRole, // allow demotion or keep admin
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

  return (
    <div className="relative min-h-screen bg-[#f4f1ec] overflow-hidden">
      {/* ambient blobs */}
      <div className="pointer-events-none absolute -top-32 -left-20 h-96 w-96 rounded-full bg-[#e9e4dc] blur-3xl opacity-60" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-[30rem] w-[30rem] rounded-full bg-[#fff4e1] blur-3xl opacity-70" />

      <div className="relative max-w-7xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Shield className="text-[#8b6f47]" />
              <h1 className="text-3xl md:text-4xl font-serif text-[#5a4a3f]">
                Administrator Accounts
              </h1>
            </div>
            <p className="text-[#7a6a5f]">
              Create, edit, demote, or remove administrators. Search with{" "}
              <kbd className="px-1 rounded bg-[#fff4e1] border border-[#e0dcd4]">
                /
              </kbd>
              , refresh with{" "}
              <kbd className="px-1 rounded bg-[#fff4e1] border border-[#e0dcd4]">
                R
              </kbd>
              .
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => router.push("/admin/")}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-[#d8cfc3] bg-white/90 backdrop-blur text-[#5a4a3f] hover:bg-[#f1ede7] transition shadow-sm"
            >
              <ArrowLeft size={16} /> Back to Dashboard
            </button>

            <button
              onClick={() => setShowAddDrawer(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#8b6f47] to-[#a78b62] text-white hover:opacity-90 transition shadow-md"
            >
              <UserPlus size={16} /> Add Admin
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <StatCard label="Total Admins" value={totalAdmins} tone="green" />
          <StatCard label="New this month" value={newThisMonth} tone="amber" />
        </div>

        {/* Toolbar */}
        <div className="mb-6 flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative w-full lg:w-[28rem]">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#7a6a5f]">
              <Search size={18} />
            </span>
            <input
              ref={searchRef}
              type="text"
              placeholder="Search admins by name, email or phone ( / )"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 rounded-full border border-[#e0dcd4] bg-[#faf8f4] text-[#5a4a3f] placeholder-[#b3a89e] focus:outline-none focus:ring-2 focus:ring-[#8b6f47] shadow-sm"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute inset-y-0 right-0 pr-3 text-[#7a6a5f] hover:text-[#5a4a3f]"
                aria-label="Clear search"
              >
                <RefreshCw size={16} />
              </button>
            )}
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <Select
              label="Sort by"
              value={`${sortKey}:${sortDir}`}
              onChange={(v) => {
                const [k, d] = v.split(":");
                setSortKey(k);
                setSortDir(d);
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
              onChange={(v) => setPage(Number(v)) || setPageSize(Number(v))}
              options={[
                { value: "10", label: "10" },
                { value: "20", label: "20" },
                { value: "50", label: "50" },
              ]}
            />

            <button
              onClick={fetchUsers}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#d8cfc3] bg-white text-[#5a4a3f] hover:bg-[#f1ede7] transition shadow-sm disabled:opacity-60"
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

        {/* Table / Empty / Loading */}
        <div className="rounded-2xl border border-[#e0dcd4] overflow-hidden shadow-xl bg-white/90 backdrop-blur">
          {loadingUsers ? (
            <TableSkeleton rows={8} />
          ) : filteredAdmins.length === 0 ? (
            <EmptyState
              onAdd={() => setShowAddDrawer(true)}
              onClear={() => setSearchTerm("")}
              title="No admins found"
              subtitle="Try a different search or add an admin."
            />
          ) : (
            <>
              {/* bulk actions bar (appears when rows are selected) */}
              {selectedIds.size > 0 && (
                <div className="flex items-center justify-between gap-3 px-4 py-2 bg-[#fff9f0] border-b border-[#e0dcd4] text-[#5a4a3f]">
                  <div className="text-sm">
                    <b>{selectedIds.size}</b> selected
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedIds(new Set())}
                      className="px-3 py-1.5 rounded-full border border-[#e0dcd4] bg-white hover:bg-[#f1ede7] text-sm"
                    >
                      Clear
                    </button>
                    <button
                      onClick={handleBulkDelete}
                      className="px-3 py-1.5 rounded-full bg-red-600 text-white hover:bg-red-700 text-sm"
                    >
                      Delete selected
                    </button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left table-fixed">
                  <caption className="sr-only">Administrator accounts</caption>
                  <colgroup>
                    <col className="w-10" />
                    <col className="w-[28%]" />
                    <col className="w-[26%]" />
                    <col className="hidden md:table-column w-[16%]" />
                    <col className="hidden sm:table-column w-[12%]" />
                    <col className="hidden lg:table-column w-[12%]" />
                    <col />
                  </colgroup>

                  <thead className="bg-[#f4f1ec] text-[#5a4a3f] text-xs uppercase tracking-wide sticky top-0 z-10">
                    <tr>
                      <th className="p-3">
                        <input
                          aria-label="Select all on page"
                          type="checkbox"
                          checked={allOnPageSelected}
                          onChange={() => toggleSelectAll(pagedAdmins)}
                          className="h-4 w-4 align-middle rounded border-[#d8cfc3] text-[#8b6f47] focus:ring-[#8b6f47]"
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
                        }}
                      />
                      <SortTh
                        label="Email"
                        activeKey={sortKey}
                        dir={sortDir}
                        k="email"
                        onSort={(k, nextDir) => {
                          setSortKey(k);
                          setSortDir(nextDir);
                        }}
                      />
                      <Th className="hidden md:table-cell">Phone</Th>
                      <Th className="hidden sm:table-cell">Role</Th>
                      <SortTh
                        label="Joined"
                        className="hidden lg:table-cell"
                        activeKey={sortKey}
                        dir={sortDir}
                        k="createdAt"
                        onSort={(k, nextDir) => {
                          setSortKey(k);
                          setSortDir(nextDir);
                        }}
                      />
                      <Th className="text-right pr-4">Actions</Th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#eee8df]">
                    {pagedAdmins.map((u) => (
                      <tr
                        key={u.id}
                        className="group odd:bg-white even:bg-[#fcfbf8] hover:bg-[#f9f7f3] transition"
                      >
                        <td className="p-3 align-middle">
                          <input
                            aria-label={`Select ${u.email}`}
                            type="checkbox"
                            checked={selectedIds.has(u.id)}
                            onChange={() => toggleSelect(u.id)}
                            className="h-4 w-4 align-middle rounded border-[#d8cfc3] text-[#8b6f47] focus:ring-[#8b6f47]"
                          />
                        </td>

                        {/* Name + email (email is copyable) */}
                        <Td>
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar
                              name={u.name}
                              surname={u.surname}
                              email={u.email}
                            />
                            <div className="min-w-0">
                              <div className="text-[#3d3227] font-medium truncate">
                                {(u.name ?? "—") + " " + (u.surname ?? "")}
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  navigator.clipboard?.writeText(u.email)
                                }
                                title="Copy email"
                                className="text-xs text-[#7a6a5f] hover:text-[#5a4a3f] underline-offset-2 hover:underline truncate"
                              >
                                {u.email}
                              </button>

                              {/* mobile-only inline meta */}
                              <div className="md:hidden mt-1 flex flex-wrap items-center gap-2 text-xs text-[#7a6a5f]">
                                {u.phone && (
                                  <span className="px-2 py-0.5 rounded-full border border-[#e0dcd4] bg-white">
                                    {u.phone}
                                  </span>
                                )}
                                <span className="px-2 py-0.5 rounded-full bg-[#eee8df] border border-[#e4ddd3]">
                                  {u.role}
                                </span>
                              </div>
                            </div>
                          </div>
                        </Td>

                        {/* Phone (copyable) */}
                        <Td className="hidden md:table-cell text-[#3d3227]">
                          {u.phone ? (
                            <button
                              type="button"
                              onClick={() =>
                                navigator.clipboard?.writeText(u.phone)
                              }
                              title="Copy phone"
                              className="hover:underline underline-offset-2"
                            >
                              {u.phone}
                            </button>
                          ) : (
                            "—"
                          )}
                        </Td>

                        {/* Role */}
                        <Td className="hidden sm:table-cell">
                          <RoleBadge role={u.role} />
                        </Td>

                        {/* Joined */}
                        <Td className="hidden lg:table-cell text-[#7d6c5e]">
                          {formatDate(u.createdAt)}
                        </Td>

                        {/* Actions */}
                        <Td className="text-right pr-4">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => setEditingUser(u)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-yellow-300 bg-yellow-50 text-yellow-800 text-sm hover:bg-yellow-100 transition shadow-sm"
                            >
                              <Edit3 size={16} />
                              <span className="hidden sm:inline">Edit</span>
                            </button>

                            <button
                              onClick={() => setConfirmDeleteId(u.id)}
                              disabled={u.id === currentAdminId}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-red-300 bg-red-50 text-red-700 text-sm hover:bg-red-100 transition shadow-sm disabled:opacity-50"
                              title={
                                u.id === currentAdminId
                                  ? "Can't delete yourself"
                                  : "Delete"
                              }
                            >
                              <Trash2 size={16} />
                              <span className="hidden sm:inline">Delete</span>
                            </button>
                          </div>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Pagination */}
        {filteredAdmins.length > 0 && (
          <div className="mt-4 flex items-center justify-between text-sm text-[#7a6a5f]">
            <div>
              Showing <b>{(page - 1) * pageSize + 1}</b>–
              <b>{Math.min(page * pageSize, filteredAdmins.length)}</b> of{" "}
              <b>{filteredAdmins.length}</b>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="px-3 py-1.5 rounded-full border border-[#e0dcd4] bg-white hover:bg-[#f1ede7] disabled:opacity-50"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft size={16} />
              </button>
              <div className="px-3">
                Page {page} of {pageCount}
              </div>
              <button
                className="px-3 py-1.5 rounded-full border border-[#e0dcd4] bg-white hover:bg-[#f1ede7] disabled:opacity-50"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page === pageCount}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Drawer: Add Admin */}
      {showAddDrawer && (
        <SideDrawer
          title="Add New Admin"
          onClose={() => setShowAddDrawer(false)}
        >
          {errorMessage && (
            <div className="mb-4 p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">
              {errorMessage}
            </div>
          )}
          <form
            onSubmit={handleAddAdmin}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <TextInput name="email" placeholder="Email" required />
            <TextInput
              name="password"
              type="password"
              placeholder="Password"
              required
            />
            <TextInput name="name" placeholder="First Name" />
            <TextInput name="surname" placeholder="Last Name" />
            <TextInput name="phone" placeholder="Phone" />
            <TextInput
              name="dateOfBirth"
              type="date"
              placeholder="Date of Birth"
            />
            <div className="md:col-span-2 flex justify-end gap-3 mt-2">
              <button
                type="submit"
                className="px-6 py-2 rounded-full bg-[#8b6f47] text-white font-medium hover:bg-[#a78b62] transition shadow-sm"
              >
                Save Admin
              </button>
              <button
                type="button"
                onClick={() => setShowAddDrawer(false)}
                className="px-6 py-2 rounded-full bg-gray-200 text-[#5a4a3f] hover:bg-gray-300 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </SideDrawer>
      )}

      {/* Edit modal */}
      {editingUser && (
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

            <div className="md:col-span-2 flex justify-end gap-3 mt-2">
              <button
                type="submit"
                className="px-6 py-2 rounded-full bg-[#8b6f47] text-white font-medium hover:bg-[#a78b62] transition shadow-sm"
              >
                Save Changes
              </button>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="px-6 py-2 rounded-full bg-gray-200 text-[#5a4a3f] hover:bg-gray-300 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Confirm delete */}
      {confirmDeleteId && (
        <ConfirmDialog
          title="Delete admin?"
          description="This action cannot be undone. The admin will be permanently removed."
          confirmLabel="Delete"
          onCancel={() => setConfirmDeleteId(null)}
          onConfirm={() => handleDelete(confirmDeleteId)}
        />
      )}

      <ToastHost toasts={toasts} />
    </div>
  );
}
