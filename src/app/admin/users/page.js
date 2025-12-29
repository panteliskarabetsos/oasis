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
  Users as UsersIcon,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  StickyNote,
  Eye,
  EyeOff,
  Mail,
  Lock,
  Phone,
  CalendarDays,
  User as UserIcon,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

export default function AdminClientsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  // ---- role gate state
  const [role, setRole] = useState(null); // 'admin' | 'user' | 'anon' | null(unknown)
  const [gateReady, setGateReady] = useState(false);

  // ---- data state
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState(null);

  // ---- UI state
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const [sortKey, setSortKey] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  // forms & modals
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [noteUser, setNoteUser] = useState(null);
  const [noteText, setNoteText] = useState("");

  // drawer niceties
  const [pwVisible, setPwVisible] = useState(false);
  const passwordRef = useRef(null);

  // feedback
  const [errorMessage, setErrorMessage] = useState("");
  const [toasts, setToasts] = useState([]);
  const [isPending, startTransition] = useTransition();

  const searchRef = useRef(null);
  const currentAuthId = user?.id;

  // Client-only rendering
  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);

  // Fast path: role from Supabase auth metadata (may be missing)
  const authRole = useMemo(
    () => user?.app_metadata?.role ?? user?.user_metadata?.role ?? null,
    [user]
  );

  // ---- selection (multi-select)
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const isLockedUser = (u) =>
    u.auth_user_id === currentAuthId ||
    u.email?.toLowerCase?.() === user?.email?.toLowerCase?.();

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  // Derived arrays & stats (clients only)
  const clients = useMemo(
    () => users.filter((u) => u.role === "user"),
    [users]
  );

  const clearSelection = () => setSelectedIds(new Set());

  // Keep selection clean after refresh/filtering
  useEffect(() => {
    const valid = new Set(clients.map((c) => c.id));
    setSelectedIds((prev) => {
      const next = new Set();
      prev.forEach((id) => valid.has(id) && next.add(id));
      return next;
    });
  }, [clients]);

  // Canonical role: fetch /api/me (DB) and then decide
  useEffect(() => {
    if (loading) return;

    if (!user) {
      setRole("anon");
      setGateReady(true);
      return;
    }

    if (authRole) setRole(authRole); // seed quickly for snappier UI

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
      } catch {
        // ignore – we'll rely on whatever we already have
      } finally {
        setGateReady(true);
      }
    })();
  }, [loading, user, authRole]);

  // Redirect ONLY after gate is ready
  useEffect(() => {
    if (!gateReady) return;
    if (!user || role !== "admin") router.replace("/");
  }, [gateReady, role, user, router]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedTerm(searchTerm.trim()), 250);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const preview = (s, n = 22) =>
    s && s.length > n ? `${s.slice(0, n)}...` : s || "";

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      const active = document.activeElement;
      const isTyping =
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.getAttribute?.("contenteditable") === "true");

      if (e.key === "/") {
        if (!isTyping) {
          e.preventDefault();
          searchRef.current?.focus();
        }
      } else if (e.key === "Escape") {
        // close overlays first, otherwise clear search
        if (showAddDrawer) return setShowAddDrawer(false);
        if (editingUser) return setEditingUser(null);
        if (noteUser) return setNoteUser(null);
        if (confirmDeleteId) return setConfirmDeleteId(null);
        setSearchTerm("");
      } else if ((e.key === "r" || e.key === "R") && !isTyping) {
        fetchUsers();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAddDrawer, editingUser, noteUser, confirmDeleteId]);

  // Fetch users (admin-only)
  const fetchUsers = async () => {
    try {
      if (!users.length) setLoadingUsers(true);
      else setRefreshing(true);

      const res = await fetch("/api/admin/users", {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) return; // API also enforces admin
      const data = await res.json();
      if (!data.error) {
        setUsers(data);
        setLastFetchedAt(new Date());
      }
    } finally {
      setLoadingUsers(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (gateReady && role === "admin") fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateReady, role]);

  const totalClients = clients.length;
  const newThisMonth = clients.filter((u) => {
    const d = safeDate(u.createdAt);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    );
  }).length;

  const defaultDirFor = (k) => (k === "createdAt" ? "desc" : "asc");

  const onSortColumn = (k) => {
    setPage(1);
    setSortDir((prev) =>
      sortKey === k ? (prev === "asc" ? "desc" : "asc") : defaultDirFor(k)
    );
    setSortKey(k);
  };

  // Filtering + sorting (clients only)
  const filteredClients = useMemo(() => {
    const q = debouncedTerm.toLowerCase();
    const byQuery = clients.filter((u) => {
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
        case "phone":
          av = (a.phone ?? "").toLowerCase();
          bv = (b.phone ?? "").toLowerCase();
          break;
        case "dateOfBirth":
          av = a.dateOfBirth ? safeDate(a.dateOfBirth).getTime() : null;
          bv = b.dateOfBirth ? safeDate(b.dateOfBirth).getTime() : null;
          break;
        case "notes":
          av = (a.notes ?? "").toLowerCase();
          bv = (b.notes ?? "").toLowerCase();
          break;
        case "createdAt":
        default:
          av = safeDate(a.createdAt).getTime();
          bv = safeDate(b.createdAt).getTime();
          break;
      }

      // nulls always last
      const aNull = av === null || av === undefined;
      const bNull = bv === null || bv === undefined;
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;

      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [clients, debouncedTerm, sortKey, sortDir]);

  // Pagination
  const pageCount = Math.max(1, Math.ceil(filteredClients.length / pageSize));
  useEffect(() => {
    if (page > pageCount) setPage(1);
  }, [pageCount, page]);

  const pagedClients = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredClients.slice(start, start + pageSize);
  }, [filteredClients, page, pageSize]);

  const selectedCount = selectedIds.size;

  const pageSelectableIds = useMemo(
    () => pagedClients.filter((u) => !isLockedUser(u)).map((u) => u.id),
    [pagedClients] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const allSelectedOnPage =
    pageSelectableIds.length > 0 &&
    pageSelectableIds.every((id) => selectedIds.has(id));

  const someSelectedOnPage = pageSelectableIds.some((id) =>
    selectedIds.has(id)
  );

  const selectAllRef = useRef(null);
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        someSelectedOnPage && !allSelectedOnPage;
    }
  }, [someSelectedOnPage, allSelectedOnPage]);

  const toggleSelectAllOnPage = (checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) pageSelectableIds.forEach((id) => next.add(id));
      else pageSelectableIds.forEach((id) => next.delete(id));
      return next;
    });
  };

  // CRUD handlers
  const handleDelete = async (id) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Client deleted", icon: Check });
        startTransition(fetchUsers);
      } else {
        toast({ title: data.error || "Failed to delete.", type: "error" });
      }
    } catch {
      toast({ title: "Network error while deleting.", type: "error" });
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;

    try {
      const results = await Promise.allSettled(
        ids.map((id) =>
          fetch("/api/admin/users", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ id }),
          }).then(async (res) => {
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || "Failed to delete.");
            return true;
          })
        )
      );

      const failed = results.filter((r) => r.status === "rejected");
      const ok = results.length - failed.length;

      if (ok > 0)
        toast({
          title: `Deleted ${ok} client${ok === 1 ? "" : "s"}`,
          icon: Check,
        });

      if (failed.length) {
        toast({
          title: `${failed.length} deletion${
            failed.length === 1 ? "" : "s"
          } failed`,
          type: "error",
        });
      }

      clearSelection();
      startTransition(fetchUsers);
    } catch {
      toast({ title: "Network error while deleting selected.", type: "error" });
    }
  };

  const handleSaveNote = async () => {
    if (!noteUser) return;
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: noteUser.id, notes: noteText }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === noteUser.id ? { ...u, notes: noteText } : u
          )
        );
        setNoteUser(null);
        setNoteText("");
        toast({ title: "Note saved", icon: Check });
      } else {
        toast({ title: "Failed to save note", type: "error" });
      }
    } catch {
      toast({ title: "Network error saving note", type: "error" });
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;

    const body = {
      email: form.email.value,
      password: form.password.value,
      name: form.name.value,
      surname: form.surname.value,
      phone: form.phone.value,
      role: "user",
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
        setPwVisible(false);
        setShowAddDrawer(false);
        toast({ title: "Client created", icon: Check });
        startTransition(fetchUsers);
      } else {
        showInlineError(data.error || "Something went wrong.");
      }
    } catch {
      showInlineError("Network error. Please try again.");
    }
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const body = {
      id: editingUser.id,
      email: form.email.value,
      name: form.name.value,
      surname: form.surname.value,
      phone: form.phone.value,
      dateOfBirth: form.dateOfBirth.value || null,
      notes: form.notes.value || null,
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
        toast({ title: "Client updated", icon: Check });
        startTransition(fetchUsers);
      } else {
        toast({ title: "Update failed", type: "error" });
      }
    } catch {
      toast({ title: "Network error on update", type: "error" });
    }
  };

  const showInlineError = (msg) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(""), 6500);
  };

  const toast = ({ title, type = "success", icon: Icon }) => {
    const id =
      (globalThis.crypto?.randomUUID?.() || String(Date.now())) + Math.random();
    setToasts((t) => [...t, { id, title, type, Icon }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  };

  const generatePassword = () => {
    const chars =
      "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
    let out = "";
    for (let i = 0; i < 14; i++)
      out += chars[Math.floor(Math.random() * chars.length)];
    if (passwordRef.current) passwordRef.current.value = out;
    toast({ title: "Generated a strong password", icon: Check });
  };

  // Don’t render page content until gate resolves and user is confirmed admin
  if (!isClient || loading || !gateReady || role !== "admin") return null;

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#f6f2ec] via-[#f4f1ec] to-[#fbfaf8]">
      {/* ambient blobs */}
      <div className="pointer-events-none absolute -top-40 -left-24 h-[32rem] w-[32rem] rounded-full bg-[#e9e4dc] blur-3xl opacity-60" />
      <div className="pointer-events-none absolute -bottom-48 -right-28 h-[34rem] w-[34rem] rounded-full bg-[#fff4e1] blur-3xl opacity-70" />
      <div className="pointer-events-none absolute top-[18rem] right-[8rem] h-40 w-40 rounded-full bg-[#e7efe7] blur-3xl opacity-40" />

      <div className="relative max-w-7xl mx-auto px-5 sm:px-6 py-9 sm:py-10">
        {/* Header */}
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6 mb-7">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-11 w-11 rounded-2xl bg-white/80 border border-[#e7dfd6] shadow-sm grid place-items-center">
                <UsersIcon className="text-[#8b6f47]" />
              </div>
              <div className="min-w-0">
                <h1 className="text-3xl sm:text-4xl font-serif text-[#5a4a3f] leading-tight">
                  Clients
                </h1>
                <p className="text-[#7a6a5f] mt-1">
                  Only users with role <b>user</b>.
                  <span className="ml-2 hidden sm:inline text-[#9a8e83]">
                    Press <KeyHint>/</KeyHint> to search · <KeyHint>R</KeyHint>{" "}
                    to refresh
                  </span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => router.push("/admin/")}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-[#d8cfc3] bg-white/80 backdrop-blur text-[#5a4a3f] hover:bg-white transition shadow-sm"
            >
              <ArrowLeft size={16} /> Back
            </button>

            <button
              onClick={() => setShowAddDrawer(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#8b6f47] to-[#a78b62] text-white hover:opacity-95 transition shadow-md"
            >
              <UserPlus size={16} /> Add Client
            </button>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-7">
          <StatCard
            label="Total Clients"
            value={totalClients}
            tone="slate"
            sub={lastFetchedAt ? `Updated ${formatDate(lastFetchedAt)}` : "—"}
          />
          <StatCard
            label="New this month"
            value={newThisMonth}
            tone="amber"
            sub="Based on created date"
          />
        </div>

        {/* Toolbar (sticky-ish) */}
        <div className="mb-6 rounded-2xl border border-[#e7dfd6] bg-white/70 backdrop-blur shadow-sm">
          <div className="p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative w-full lg:w-[30rem]">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#7a6a5f]">
                <Search size={18} />
              </span>

              <input
                ref={searchRef}
                type="text"
                placeholder="Search by name, email, phone…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-16 py-2.5 rounded-full border border-[#e0dcd4] bg-[#fbfaf8] text-[#5a4a3f] placeholder-[#b3a89e] focus:outline-none focus:ring-2 focus:ring-[#8b6f47] shadow-sm"
              />

              <div className="absolute inset-y-0 right-2 flex items-center gap-1">
                {searchTerm ? (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="p-2 rounded-full text-[#7a6a5f] hover:text-[#5a4a3f] hover:bg-[#f4f1ec]"
                    aria-label="Clear search"
                    title="Clear (Esc)"
                  >
                    <X size={16} />
                  </button>
                ) : (
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-full border border-[#eee6dd] bg-white text-[11px] text-[#8a7b6f]">
                    <span className="font-semibold">/</span>
                  </span>
                )}
              </div>
            </div>

            <div className="flex-1" />

            <div className="flex flex-wrap items-center gap-2">
              <Select
                label="Sort"
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
                onChange={(v) => {
                  setPage(1);
                  setPageSize(Number(v));
                }}
                options={[
                  { value: "10", label: "10" },
                  { value: "20", label: "20" },
                  { value: "50", label: "50" },
                ]}
              />

              <button
                onClick={fetchUsers}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#d8cfc3] bg-white text-[#5a4a3f] hover:bg-[#f6f2ec] transition shadow-sm disabled:opacity-60"
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
        </div>

        {/* Table / Empty / Loading */}
        <div className="rounded-2xl border border-[#e7dfd6] overflow-hidden shadow-xl bg-white/80 backdrop-blur">
          {selectedCount > 0 ? (
            <div className="px-4 py-3 border-b border-[#eee6dd] bg-[#fff9ed]/70 backdrop-blur flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-sm text-[#5a4a3f]">
                <b>{selectedCount}</b> selected
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={clearSelection}
                  className="px-4 py-2 rounded-full border border-[#e0dcd4] bg-white text-[#5a4a3f] hover:bg-[#f6f2ec] transition"
                >
                  Clear
                </button>
                <button
                  onClick={() => setConfirmBulkDelete(true)}
                  className="px-4 py-2 rounded-full bg-red-600 text-white hover:bg-red-700 transition shadow-sm"
                >
                  Delete selected
                </button>
              </div>
            </div>
          ) : null}

          {loadingUsers ? (
            <TableSkeleton rows={8} />
          ) : filteredClients.length === 0 ? (
            <EmptyState
              onAdd={() => setShowAddDrawer(true)}
              onClear={() => setSearchTerm("")}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[#f4f1ec]/80 backdrop-blur text-[#5a4a3f] text-xs uppercase tracking-wide sticky top-0 border-b border-[#eee6dd]">
                  <tr>
                    <Th className="w-[48px]">
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        checked={allSelectedOnPage}
                        onChange={(e) =>
                          toggleSelectAllOnPage(e.target.checked)
                        }
                        className="h-4 w-4 accent-[#8b6f47] cursor-pointer"
                        aria-label="Select all on page"
                      />
                    </Th>

                    <SortTh
                      label="Client"
                      k="name"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={onSortColumn}
                    />
                    <SortTh
                      label="Phone"
                      k="phone"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={onSortColumn}
                    />
                    <SortTh
                      label="DOB"
                      k="dateOfBirth"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={onSortColumn}
                    />
                    <SortTh
                      label="Notes"
                      k="notes"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={onSortColumn}
                    />
                    <SortTh
                      label="Joined"
                      k="createdAt"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={onSortColumn}
                    />

                    <Th className="text-right pr-4">Actions</Th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#f0e9e0]">
                  {pagedClients.map((u) => (
                    <tr
                      key={u.id}
                      className="hover:bg-[#fbfaf8] transition"
                      onDoubleClick={() => setEditingUser(u)}
                    >
                      <Td>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(u.id)}
                          onChange={() => toggleSelected(u.id)}
                          disabled={isLockedUser(u)}
                          className="h-4 w-4 accent-[#8b6f47] cursor-pointer disabled:cursor-not-allowed"
                          aria-label={`Select ${
                            formatFullName(u.name, u.surname) || u.email
                          }`}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </Td>

                      <Td>
                        <div className="flex items-center gap-3">
                          <Avatar
                            name={u.name}
                            surname={u.surname}
                            email={u.email}
                          />
                          <div className="min-w-0">
                            <div className="text-[#3d3227] font-medium truncate">
                              {formatFullName(u.name, u.surname) || "—"}
                            </div>
                            <div className="text-xs text-[#7a6a5f] truncate">
                              {u.email}
                            </div>
                          </div>
                        </div>
                      </Td>

                      <Td className="text-[#3d3227]">{u.phone ?? "—"}</Td>

                      <Td className="text-[#3d3227]">
                        {u.dateOfBirth ? formatDate(u.dateOfBirth) : "—"}
                      </Td>

                      <Td className="text-[#3d3227] max-w-[320px]">
                        <button
                          onClick={() => {
                            setNoteUser(u);
                            setNoteText(u.notes ?? "");
                          }}
                          className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#e6ded5] bg-white hover:bg-[#fbfaf8] text-xs text-[#5a4a3f] shadow-sm"
                          title={u.notes || "Add note"}
                        >
                          <StickyNote size={14} className="text-[#8b6f47]" />
                          <span className="truncate max-w-[16rem]">
                            {u.notes ? (
                              preview(u.notes)
                            ) : (
                              <span className="text-[#a39587]">Add note…</span>
                            )}
                          </span>
                        </button>
                      </Td>

                      <Td className="text-[#7d6c5e]">
                        {formatDate(u.createdAt)}
                      </Td>

                      <Td className="text-right pr-4">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => setEditingUser(u)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#f2b24b] text-white text-sm hover:brightness-95 transition shadow-sm"
                            title="Edit"
                          >
                            <Edit3 size={16} /> Edit
                          </button>

                          <button
                            onClick={() => setConfirmDeleteId(u.id)}
                            disabled={
                              u.auth_user_id === currentAuthId ||
                              u.email?.toLowerCase?.() ===
                                user?.email?.toLowerCase?.()
                            }
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-red-600 text-white text-sm hover:bg-red-700 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            title={
                              u.auth_user_id === currentAuthId
                                ? "Can't delete yourself"
                                : "Delete"
                            }
                          >
                            <Trash2 size={16} /> Delete
                          </button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {filteredClients.length > 0 && (
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-[#7a6a5f]">
            <div>
              Showing <b>{(page - 1) * pageSize + 1}</b>–
              <b>{Math.min(page * pageSize, filteredClients.length)}</b> of{" "}
              <b>{filteredClients.length}</b>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="px-3 py-1.5 rounded-full border border-[#e0dcd4] bg-white hover:bg-[#f6f2ec] disabled:opacity-50"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft size={16} />
              </button>

              <div className="px-3">
                Page {page} of {pageCount}
              </div>

              <button
                className="px-3 py-1.5 rounded-full border border-[#e0dcd4] bg-white hover:bg-[#f6f2ec] disabled:opacity-50"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page === pageCount}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Drawer: Add Client */}
      {showAddDrawer && (
        <SideDrawer
          title="Add New Client"
          subtitle="Create a customer account (role: user). You can edit details later."
          onClose={() => setShowAddDrawer(false)}
        >
          {errorMessage && (
            <div className="mb-4 p-4 rounded-2xl border border-red-200 bg-red-50 text-red-700 text-sm">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleAddUser} className="space-y-5">
            <DrawerSection
              title="Account"
              description="Credentials used to sign in. Make sure the email is correct."
              icon={Mail}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field
                  name="email"
                  label="Email"
                  placeholder="name@example.com"
                  required
                  autoComplete="email"
                  leftIcon={Mail}
                />

                <Field
                  inputRef={passwordRef}
                  name="password"
                  type={pwVisible ? "text" : "password"}
                  label="Password"
                  placeholder="Min 8 characters"
                  required
                  autoComplete="new-password"
                  leftIcon={Lock}
                  hint="Use a strong password. You can generate one."
                  rightSlot={
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={generatePassword}
                        className="px-2 py-1 rounded-full text-[11px] border border-[#eadfce] bg-white hover:bg-[#fbfaf8] text-[#7a6a5f]"
                        title="Generate strong password"
                      >
                        Generate
                      </button>
                      <button
                        type="button"
                        onClick={() => setPwVisible((v) => !v)}
                        className="p-2 rounded-full hover:bg-[#f4f1ec] text-[#7a6a5f]"
                        title={pwVisible ? "Hide password" : "Show password"}
                      >
                        {pwVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  }
                  minLength={8}
                />
              </div>
            </DrawerSection>

            <DrawerSection
              title="Personal"
              description="Optional details for your records."
              icon={UserIcon}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field
                  name="name"
                  label="First name"
                  placeholder="e.g. Maria"
                  leftIcon={UserIcon}
                />
                <Field
                  name="surname"
                  label="Last name"
                  placeholder="e.g. Papadopoulou"
                  leftIcon={UserIcon}
                />
                <Field
                  name="phone"
                  label="Phone"
                  placeholder="+30 69xxxxxxxx"
                  leftIcon={Phone}
                  autoComplete="tel"
                />
                <Field
                  name="dateOfBirth"
                  type="date"
                  label="Date of birth"
                  leftIcon={CalendarDays}
                />
              </div>
            </DrawerSection>

            {/* Sticky action bar */}
            <div className="sticky bottom-0 -mx-6 px-6 pt-4 pb-6 bg-gradient-to-t from-white via-white to-transparent border-t border-[#efe7de]">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-[#8a7b6f]">
                  Tip: double-click a row to edit quickly.
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddDrawer(false)}
                    className="px-5 py-2 rounded-full border border-[#e0dcd4] bg-white text-[#5a4a3f] hover:bg-[#f6f2ec] transition"
                    disabled={isPending}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 rounded-full bg-[#8b6f47] text-white font-medium hover:bg-[#a78b62] transition shadow-sm disabled:opacity-70"
                    disabled={isPending}
                  >
                    {isPending ? "Saving…" : "Save Client"}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </SideDrawer>
      )}

      {/* Edit modal */}
      {editingUser && (
        <Modal title="Edit Client" onClose={() => setEditingUser(null)}>
          <form
            onSubmit={handleEditUser}
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
            <div className="md:col-span-2">
              <Textarea
                name="notes"
                placeholder="Notes (optional)…"
                defaultValue={editingUser.notes ?? ""}
                rows={6}
                maxLength={2000}
              />
            </div>

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
          title="Delete client?"
          description="This action cannot be undone. The client will be permanently removed."
          confirmLabel="Delete"
          onCancel={() => setConfirmDeleteId(null)}
          onConfirm={async () => {
            await handleDelete(confirmDeleteId);
            setConfirmDeleteId(null);
          }}
        />
      )}

      {noteUser && (
        <Modal
          title={`Notes – ${
            formatFullName(noteUser.name, noteUser.surname) || noteUser.email
          }`}
          onClose={() => setNoteUser(null)}
        >
          <div className="space-y-3">
            <Textarea
              name="notes"
              placeholder="Write a private note about this customer…"
              defaultValue={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={8}
              maxLength={2000}
            />
            <div className="flex items-center justify-between text-xs text-[#7a6a5f]">
              <span>{noteText.length}/2000</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setNoteUser(null)}
                  className="px-5 py-2 rounded-full bg-gray-200 text-[#5a4a3f] hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNote}
                  className="px-5 py-2 rounded-full bg-[#8b6f47] text-white hover:bg-[#a78b62]"
                >
                  Save Note
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {confirmBulkDelete && (
        <ConfirmDialog
          title={`Delete ${selectedCount} client${
            selectedCount === 1 ? "" : "s"
          }?`}
          description="This action cannot be undone. The selected clients will be permanently removed."
          confirmLabel="Delete selected"
          onCancel={() => setConfirmBulkDelete(false)}
          onConfirm={async () => {
            await handleBulkDelete();
            setConfirmBulkDelete(false);
          }}
        />
      )}

      {/* Toasts */}
      <ToastHost toasts={toasts} />
    </div>
  );
}

/* ==========================
   UI HELPERS & SUBCOMPONENTS
   ========================== */

function StatCard({ label, value, tone = "slate", sub }) {
  const tones = {
    slate: {
      bg: "bg-white/80",
      ring: "border-[#e7dfd6]",
      text: "text-[#5a4a3f]",
      badge: "bg-[#f6f2ec] text-[#7a6a5f] border-[#eee6dd]",
    },
    amber: {
      bg: "bg-[#fff9ed]/80",
      ring: "border-[#f0e1c6]",
      text: "text-[#7a5c2e]",
      badge: "bg-white/60 text-[#7a5c2e] border-[#f0e1c6]",
    },
  };
  const t = tones[tone] ?? tones.slate;

  return (
    <div className={`rounded-2xl border ${t.ring} ${t.bg} p-5 shadow-sm`}>
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm text-[#7a6a5f]">{label}</div>
        <div className={`text-[11px] px-2 py-1 rounded-full border ${t.badge}`}>
          {sub || " "}
        </div>
      </div>
      <div className={`text-3xl font-serif mt-2 ${t.text}`}>{value}</div>
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-[#7a6a5f]">
      <span className="hidden sm:inline-block">{label}</span>
      <div className="relative">
        <select
          className="appearance-none pr-8 pl-3 py-2 rounded-full border border-[#e0dcd4] bg-white/90 text-[#5a4a3f] hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#8b6f47] shadow-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#7a6a5f]">
          ▾
        </span>
      </div>
    </label>
  );
}

function Th({ children, className = "" }) {
  return (
    <th
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide ${className}`}
    >
      {children}
    </th>
  );
}
function Td({ children, className = "" }) {
  return <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;
}

function Avatar({ name, surname, email }) {
  const initials =
    (name?.[0] ?? "").toUpperCase() + (surname?.[0] ?? "").toUpperCase() ||
    email?.[0]?.toUpperCase() ||
    "?";

  return (
    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#c9b39a] to-[#8b6f47] text-white grid place-items-center text-sm font-semibold shadow-sm">
      {initials}
    </div>
  );
}

function SideDrawer({ title, subtitle, onClose, children }) {
  // lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      <aside className="absolute right-0 top-0 h-full w-full sm:w-[38rem] bg-gradient-to-b from-white to-[#fbfaf8] shadow-2xl border-l border-[#eee6dd]">
        {/* header */}
        <div className="sticky top-0 z-10 bg-white/70 backdrop-blur border-b border-[#efe7de] px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl font-serif text-[#5a4a3f] leading-tight">
                {title}
              </h2>
              {subtitle ? (
                <p className="text-sm text-[#7a6a5f] mt-1">{subtitle}</p>
              ) : null}
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-[#f4f1ec]"
              title="Close (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* content */}
        <div className="px-6 py-5 overflow-y-auto h-[calc(100%-84px)]">
          {children}
        </div>
      </aside>
    </div>
  );
}

function DrawerSection({ title, description, icon: Icon, children }) {
  return (
    <section className="rounded-2xl border border-[#eee6dd] bg-white/70 shadow-sm">
      <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-[#f0e9e0]">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-2xl bg-[#f6f2ec] border border-[#eee6dd] grid place-items-center">
            {Icon ? <Icon size={18} className="text-[#8b6f47]" /> : null}
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-serif text-[#5a4a3f]">{title}</h3>
            {description ? (
              <p className="text-sm text-[#7a6a5f] mt-0.5">{description}</p>
            ) : null}
          </div>
        </div>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function Field({
  name,
  type = "text",
  label,
  placeholder,
  required,
  defaultValue,
  autoComplete,
  leftIcon: LeftIcon,
  rightSlot,
  hint,
  inputRef,
  minLength,
  rightPad, // ✅ add
}) {
  return (
    <div className="space-y-1.5">
      {label ? (
        <div className="flex items-center justify-between">
          <label className="text-sm text-[#6f5f54]">
            {label}{" "}
            {required ? <span className="text-[#a0783d]">*</span> : null}
          </label>
          {minLength ? (
            <span className="text-[11px] text-[#9a8e83]">min {minLength}</span>
          ) : null}
        </div>
      ) : null}

      <div className="relative">
        {LeftIcon ? (
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#8a7b6f]">
            <LeftIcon size={16} />
          </span>
        ) : null}

        <input
          ref={inputRef}
          name={name}
          type={type}
          defaultValue={defaultValue}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          minLength={minLength}
          className={[
            "w-full px-4 py-2.5 rounded-xl border border-[#e0dcd4] bg-[#fbfaf8]",
            "text-[#3d3227] placeholder-[#b3a89e] shadow-sm",
            "focus:outline-none focus:ring-2 focus:ring-[#8b6f47]",
            LeftIcon ? "pl-10" : "",
            rightSlot ? rightPad || "pr-14" : "",
          ].join(" ")}
        />

        {rightSlot ? (
          <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
            {rightSlot}
          </div>
        ) : null}
      </div>

      {hint ? <div className="text-xs text-[#9a8e83]">{hint}</div> : null}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-[95%] sm:w-[42rem] bg-white rounded-2xl shadow-2xl p-6 border border-[#eee6dd]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-serif text-[#5a4a3f]">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[#f4f1ec]"
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirm",
  onCancel,
  onConfirm,
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center">
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <div className="relative w-[95%] sm:w-[32rem] bg-white rounded-2xl shadow-2xl p-6 border border-[#eee6dd]">
        <h3 className="text-lg font-serif text-[#5a4a3f]">{title}</h3>
        <p className="mt-2 text-[#7a6a5f] text-sm">{description}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-5 py-2 rounded-full bg-gray-200 text-[#5a4a3f] hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2 rounded-full bg-red-600 text-white hover:bg-red-700"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function TextInput({
  name,
  type = "text",
  placeholder,
  defaultValue,
  required,
}) {
  return (
    <input
      name={name}
      type={type}
      defaultValue={defaultValue}
      placeholder={placeholder}
      required={required}
      className="w-full px-4 py-2.5 rounded-xl border border-[#e0dcd4] bg-[#fbfaf8] text-[#3d3227] placeholder-[#b3a89e] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]"
    />
  );
}

function EmptyState({ onAdd, onClear }) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-12">
      <div className="h-12 w-12 rounded-2xl grid place-items-center bg-[#fff4e1] text-[#a0783d] mb-4 border border-[#f0e1c6]">
        <UsersIcon />
      </div>
      <h3 className="text-xl font-serif text-[#5a4a3f]">No clients found</h3>
      <p className="text-[#7a6a5f] mt-1 max-w-md">
        Try adjusting your search, or create a new client to get started.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={onClear}
          className="px-5 py-2 rounded-full border border-[#e0dcd4] bg-white hover:bg-[#f6f2ec]"
        >
          Clear search
        </button>
        <button
          onClick={onAdd}
          className="px-5 py-2 rounded-full bg-[#8b6f47] text-white hover:bg-[#a78b62]"
        >
          Add Client
        </button>
      </div>
    </div>
  );
}

function TableSkeleton({ rows = 6 }) {
  return (
    <div className="divide-y divide-[#f0e9e0]">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid grid-cols-5 gap-4 px-4 py-3 animate-pulse">
          <div className="col-span-2 h-6 rounded bg-[#f2ede6]" />
          <div className="h-6 rounded bg-[#f2ede6]" />
          <div className="h-6 rounded bg-[#f2ede6]" />
          <div className="h-6 rounded bg-[#f2ede6]" />
        </div>
      ))}
    </div>
  );
}

function Textarea({
  name,
  placeholder,
  defaultValue,
  onChange,
  rows = 6,
  maxLength,
}) {
  return (
    <textarea
      name={name}
      rows={rows}
      maxLength={maxLength}
      defaultValue={defaultValue}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full px-4 py-3 rounded-xl border border-[#e0dcd4] bg-[#fbfaf8] text-[#3d3227] placeholder-[#b3a89e] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]"
    />
  );
}
function SortTh({ label, k, sortKey, sortDir, onSort, className = "" }) {
  const active = sortKey === k;
  const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;

  return (
    <Th className={className}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className="group inline-flex items-center gap-1.5 hover:text-[#3d3227] transition"
        title="Sort"
      >
        <span>{label}</span>
        <Icon
          size={14}
          className={[
            "opacity-70 group-hover:opacity-100 transition",
            active ? "opacity-100" : "",
          ].join(" ")}
        />
      </button>
    </Th>
  );
}

function ToastHost({ toasts }) {
  return (
    <div className="fixed bottom-4 right-4 z-[60] space-y-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`min-w-[220px] max-w-sm rounded-xl shadow-lg px-4 py-2.5 flex items-center gap-2 border ${
            t.type === "error"
              ? "bg-red-600 text-white border-red-700"
              : "bg-[#2d4f2d] text-white border-[#214021]"
          }`}
        >
          {t.Icon ? <t.Icon size={16} /> : null}
          <div className="text-sm">{t.title}</div>
        </div>
      ))}
    </div>
  );
}

function KeyHint({ children }) {
  return (
    <span className="inline-flex items-center justify-center min-w-[1.6rem] px-2 py-0.5 rounded-md border border-[#eee6dd] bg-white text-[11px] text-[#7a6a5f] font-semibold">
      {children}
    </span>
  );
}

/* ==========================
   UTILS
   ========================== */

function safeDate(d) {
  return d instanceof Date ? d : new Date(d);
}

function toYMD(date) {
  const d = safeDate(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function formatDate(date) {
  const d = safeDate(date);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatFullName(name, surname) {
  const n = (name ?? "").trim();
  const s = (surname ?? "").trim();
  return [n, s].filter(Boolean).join(" ");
}
