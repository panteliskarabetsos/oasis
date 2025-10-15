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
} from "lucide-react";

function AdminClientsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  // ---- role gate state
  const [role, setRole] = useState(null); // 'admin' | 'user' | 'anon' | null(unknown)
  const [gateReady, setGateReady] = useState(false);

  // ---- data state
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
  const preview = (s, n = 17) =>
    s && s.length > n ? `${s.slice(0, n)}...` : s || "";
  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "Escape") {
        setSearchTerm("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  // Derived arrays & stats (clients only)
  const clients = useMemo(
    () => users.filter((u) => u.role === "user"),
    [users]
  );

  const totalClients = clients.length;
  const newThisMonth = clients.filter((u) => {
    const d = safeDate(u.createdAt);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    );
  }).length;

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
        case "createdAt":
        default:
          av = safeDate(a.createdAt).getTime();
          bv = safeDate(b.createdAt).getTime();
          break;
      }
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
    } catch (e) {
      toast({ title: "Network error while deleting.", type: "error" });
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
      role: "user", // force client role
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
      // role is not editable here (client-only page)
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
    setTimeout(() => setErrorMessage(""), 6000);
  };

  const toast = ({ title, type = "success", icon: Icon }) => {
    const id = crypto.randomUUID();
    setToasts((t) => [...t, { id, title, type, Icon }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  };

  // Don’t render page content until gate resolves and user is confirmed admin
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
              <UsersIcon className="text-[#8b6f47]" />
              <h1 className="text-3xl md:text-4xl font-serif text-[#5a4a3f]">
                Clients
              </h1>
            </div>
            <p className="text-[#7a6a5f]">
              This view lists only users with the role <b>user</b>.
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
              <UserPlus size={16} /> Add Client
            </button>
          </div>
        </div>

        {/* Quick stats (clients only) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <StatCard label="Total Clients" value={totalClients} />
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
              placeholder="Search clients by name, email or phone ( / )"
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
                <X size={16} />
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
              onChange={(v) => {
                setPage(1); // reset to first page when page size changes (fix)
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
          ) : filteredClients.length === 0 ? (
            <EmptyState
              onAdd={() => setShowAddDrawer(true)}
              onClear={() => setSearchTerm("")}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[#f4f1ec] text-[#5a4a3f] text-xs uppercase tracking-wide sticky top-0">
                  <tr>
                    <Th>Client</Th>
                    <Th>Phone</Th>
                    <Th>DOB</Th>
                    <Th>Notes</Th>
                    <Th>Joined</Th>
                    <Th className="text-right pr-4">Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eee8df]">
                  {pagedClients.map((u) => (
                    <tr key={u.id} className="hover:bg-[#f9f7f3] transition">
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
                      <Td className="text-[#3d3227] max-w-[280px]">
                        <button
                          onClick={() => {
                            setNoteUser(u);
                            setNoteText(u.notes ?? "");
                          }}
                          className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#e6ded5] bg-white hover:bg-[#faf6ef] text-xs text-[#5a4a3f]"
                          title={u.notes || "Add note"}
                        >
                          <StickyNote size={14} className="text-[#8b6f47]" />
                          <span className="truncate max-w-[14rem]">
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
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-amber-500 text-white text-sm hover:bg-amber-600 transition shadow-sm"
                          >
                            <Edit3 size={16} /> Edit
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(u.id)}
                            disabled={
                              u.auth_user_id === currentAuthId ||
                              // fallback if API isn’t updated yet: compare emails
                              u.email?.toLowerCase?.() ===
                                user?.email?.toLowerCase?.()
                            }
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-red-600 text-white text-sm hover:bg-red-700 transition shadow-sm"
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

      {/* Drawer: Add Client */}
      {showAddDrawer && (
        <SideDrawer
          title="Add New Client"
          onClose={() => setShowAddDrawer(false)}
        >
          {errorMessage && (
            <div className="mb-4 p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">
              {errorMessage}
            </div>
          )}
          <form
            onSubmit={handleAddUser}
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
                Save Client
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

      {/* Toasts */}
      <ToastHost toasts={toasts} />
    </div>
  );
}

export default AdminClientsPage;

// ==========================
// UI HELPERS & SUBCOMPONENTS
// ==========================

function StatCard({ label, value, tone = "slate" }) {
  const tones = {
    slate: { bg: "bg-white/90", text: "text-[#5a4a3f]" },
    amber: { bg: "bg-[#fff9ed]", text: "text-[#7a5c2e]" },
  };
  const t = tones[tone] ?? tones.slate;
  return (
    <div
      className={`rounded-2xl border border-[#e0dcd4] ${t.bg} p-5 shadow-sm`}
    >
      <div className="text-sm text-[#7a6a5f]">{label}</div>
      <div className={`text-3xl font-serif mt-1 ${t.text}`}>{value}</div>
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
    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#bfa889] to-[#8b6f47] text-white grid place-items-center text-sm font-semibold shadow-sm">
      {initials}
    </div>
  );
}

function SideDrawer({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full sm:w-[34rem] bg-white shadow-2xl p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-serif text-[#5a4a3f]">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[#f4f1ec]"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-[95%] sm:w-[40rem] bg-white rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-serif text-[#5a4a3f]">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[#f4f1ec]"
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
      <div className="relative w-[95%] sm:w-[32rem] bg-white rounded-2xl shadow-2xl p-6">
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
      className="w-full px-4 py-2.5 rounded-xl border border-[#e0dcd4] bg-[#faf8f4] text-[#3d3227] placeholder-[#b3a89e] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]"
    />
  );
}

function EmptyState({ onAdd, onClear }) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-12">
      <div className="h-12 w-12 rounded-2xl grid place-items-center bg-[#fff4e1] text-[#a0783d] mb-4">
        <UsersIcon />
      </div>
      <h3 className="text-xl font-serif text-[#5a4a3f]">No clients found</h3>
      <p className="text-[#7a6a5f] mt-1 max-w-md">
        Try adjusting your search, or create a new client to get started.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={onClear}
          className="px-5 py-2 rounded-full border border-[#e0dcd4] bg-white hover:bg-[#f1ede7]"
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
    <div className="divide-y divide-[#eee8df]">
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
      className="w-full px-4 py-3 rounded-xl border border-[#e0dcd4] bg-[#faf8f4] text-[#3d3227] placeholder-[#b3a89e] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]"
    />
  );
}

function ToastHost({ toasts }) {
  return (
    <div className="fixed bottom-4 right-4 z-[60] space-y-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`min-w-[220px] max-w-sm rounded-xl shadow-lg px-4 py-2 flex items-center gap-2 border ${
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

// ==========================
// UTILS
// ==========================

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
