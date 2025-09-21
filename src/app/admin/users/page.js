"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/components/SessionWrapper";
import {
  ArrowLeft,
  UserPlus,
  Search,
  Edit3,
  Trash2,
  Shield,
  Users as UsersIcon,
  RefreshCw,
} from "lucide-react";

function AdminClientsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  // ---- page state
  const [users, setUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const totalUsers = users.length;
  const adminCount = users.filter((u) => u.role === "admin").length;
  const newThisMonth = users.filter((u) => {
    const d = new Date(u.createdAt);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    );
  }).length;

  // ---- role gate state
  const [role, setRole] = useState(null); // 'admin' | 'user' | 'anon' | null(unknown)
  const [gateReady, setGateReady] = useState(false);

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

  // Admin-only fetch
  const fetchUsers = async () => {
    const res = await fetch("/api/admin/users", {
      cache: "no-store",
      credentials: "include",
    });
    if (!res.ok) return; // API also enforces admin
    const data = await res.json();
    if (!data.error) setUsers(data);
  };

  useEffect(() => {
    if (gateReady && role === "admin") fetchUsers();
  }, [gateReady, role]);

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    const res = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (res.ok) fetchUsers();
    else alert(data.error || "Failed to delete user.");
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
      role: form.role.value,
      dateOfBirth: form.dateOfBirth.value || null,
    };
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok) {
      form.reset();
      setShowAddForm(false);
      fetchUsers();
    } else {
      setErrorMessage(data.error || "Something went wrong.");
      setTimeout(() => setErrorMessage(""), 6000);
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
      role: form.role.value,
      dateOfBirth: form.dateOfBirth.value || null,
    };
    const res = await fetch("/api/admin/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setEditingUser(null);
      fetchUsers();
    }
  };

  // Don’t render page content until gate resolves and user is confirmed admin
  if (!isClient || loading || !gateReady || role !== "admin") return null;

  const filteredUsers = users.filter((u) => {
    const fullName = `${u.name ?? ""} ${u.surname ?? ""}`.toLowerCase();
    const email = u.email?.toLowerCase() ?? "";
    const phone = u.phone ?? "";
    const q = searchTerm.toLowerCase();
    return fullName.includes(q) || email.includes(q) || phone.includes(q);
  });

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
                Registered Clients
              </h1>
            </div>
            <p className="text-[#7a6a5f]">
              Manage your customers, update roles, and keep contact details
              tidy.
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
              onClick={() => setShowAddForm((v) => !v)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#8b6f47] to-[#a78b62] text-white hover:opacity-90 transition shadow-md"
            >
              <UserPlus size={16} />{" "}
              {showAddForm ? "Close Form" : "Add New User"}
            </button>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <StatCard label="Total Users" value={totalUsers} />
          <StatCard label="Admins" value={adminCount} tone="green" />
          <StatCard label="New this month" value={newThisMonth} tone="amber" />
        </div>

        {/* Add form */}
        {showAddForm && (
          <div className="mb-8 p-6 rounded-2xl border border-[#e0dcd4] bg-white/90 backdrop-blur shadow-xl">
            <h2 className="text-2xl font-serif text-[#5a4a3f] mb-4">
              Add New User
            </h2>

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
              <div>
                <label className="text-sm text-[#5a4a3f] mb-2 block">
                  Role
                </label>
                <select
                  name="role"
                  defaultValue="user"
                  className="w-full px-4 py-3 rounded-xl border border-[#e0dcd4] bg-white focus:outline-none focus:ring-2 focus:ring-[#8b6f47]"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="md:col-span-2 flex justify-end gap-3 mt-2">
                <button
                  type="submit"
                  className="px-6 py-2 rounded-full bg-[#8b6f47] text-white font-medium hover:bg-[#a78b62] transition shadow-sm"
                >
                  Save User
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-6 py-2 rounded-full bg-gray-200 text-[#5a4a3f] hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Toolbar */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative sm:w-96">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#7a6a5f]">
              <Search size={18} />
            </span>
            <input
              type="text"
              placeholder="Search by name, email or phone…"
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
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-[#e0dcd4] overflow-hidden shadow-xl bg-white/90 backdrop-blur">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#f4f1ec] text-[#5a4a3f] text-xs uppercase tracking-wide sticky top-0">
                <tr>
                  <Th>Name</Th>
                  <Th>Email</Th>
                  <Th>Phone</Th>
                  <Th>DOB</Th>
                  <Th>Role</Th>
                  <Th>Joined</Th>
                  <Th className="text-right pr-4">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eee8df]">
                {filteredUsers.map((u) => (
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
                            {(u.name ?? "—") + " " + (u.surname ?? "")}
                          </div>
                          <div className="text-xs text-[#7a6a5f] truncate">
                            {u.email}
                          </div>
                        </div>
                      </div>
                    </Td>
                    <Td className="text-[#3d3227]">{u.phone ?? "—"}</Td>
                    <Td className="text-[#3d3227]">
                      {u.dateOfBirth
                        ? new Date(u.dateOfBirth).toLocaleDateString()
                        : "—"}
                    </Td>
                    <Td>
                      <RoleBadge role={u.role} />
                    </Td>
                    <Td className="text-[#7d6c5e]">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </Td>
                    <Td className="text-right pr-4">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => setEditingUser(u)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-yellow-400 text-white text-sm hover:bg-yellow-500 transition shadow-sm"
                        >
                          <Edit3 size={16} /> Edit
                        </button>
                        <button
                          onClick={() => handleDelete(u.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-red-600 text-white text-sm hover:bg-red-700 transition shadow-sm"
                        >
                          <Trash2 size={16} /> Delete
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <Td
                      colSpan={7}
                      className="py-10 text-center text-[#7a6a5f]"
                    >
                      No users match your search.
                    </Td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Edit modal (kept from your logic) */}
        {editingUser && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-[#e0dcd4]">
              <div className="px-8 pt-7 pb-4 border-b border-[#eee8df] bg-[#fffdf9] rounded-t-2xl">
                <h2 className="text-2xl font-serif text-[#5a4a3f] text-center">
                  Edit User
                </h2>
              </div>
              <div className="p-8">
                {/* your existing edit form here unchanged */}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminClientsPage;

function StatCard({ label, value, tone = "neutral" }) {
  const tones = {
    neutral: "bg-white/90 border-[#e0dcd4] text-[#5a4a3f]",
    green: "bg-green-50 border-green-200 text-green-800",
    amber: "bg-amber-50 border-amber-200 text-amber-800",
  };

  const classes = tones[tone] || tones.neutral;

  return (
    <div className={`rounded-2xl border shadow-sm px-5 py-4 ${classes}`}>
      <div className="text-xs uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function RoleBadge({ role }) {
  const isAdmin = role === "admin";
  return (
    <span
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
        isAdmin
          ? "bg-green-100 text-green-800 border border-green-200"
          : "bg-[#eee8df] text-[#5a4a3f] border border-[#e4ddd3]"
      }`}
    >
      {isAdmin && <Shield size={14} />}
      {role}
    </span>
  );
}

function Avatar({ name, surname, email }) {
  const initials =
    ((name?.[0] ?? "") + (surname?.[0] ?? "")).toUpperCase() ||
    (email?.[0] ?? "U").toUpperCase();
  return (
    <div className="h-9 w-9 rounded-full bg-[#e9e4dc] text-[#5a4a3f] flex items-center justify-center font-semibold">
      {initials}
    </div>
  );
}

function TextInput({ name, placeholder, type = "text", required = false }) {
  return (
    <div>
      <label className="text-sm text-[#5a4a3f] mb-2 block">{placeholder}</label>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl border border-[#e0dcd4] bg-white focus:outline-none focus:ring-2 focus:ring-[#8b6f47]"
      />
    </div>
  );
}

function Th({ children, className = "" }) {
  return (
    <th className={`p-3 font-semibold text-xs ${className}`}>{children}</th>
  );
}

function Td({ children, className = "", colSpan }) {
  return (
    <td colSpan={colSpan} className={`p-4 align-middle ${className}`}>
      {children}
    </td>
  );
}
