// src/app/dashboard/page.js
"use client";

import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarCheck,
  Settings,
  Trash2,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import DeleteAccountModal from "./deleteAccountModal";
import { useAuth } from "@/app/components/SessionWrapper";

export default function Dashboard() {
  const router = useRouter();
  const { user, loading, supabase } = useAuth();

  const [dbProfile, setDbProfile] = useState(null); // NEW
  const [profileLoading, setProfileLoading] = useState(true); // NEW
  const [isDeleting, setIsDeleting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [hasActiveReservations, setHasActiveReservations] = useState(false);

  // ---- Build a base profile from Supabase metadata (fallbacks only)
  const supaProfile = useMemo(() => {
    const md = user?.user_metadata || {};

    const rawFull = (
      md.firstName ??
      md.given_name ??
      md.name ??
      md.full_name ??
      ""
    ).trim();
    const rawLast = (md.lastName ?? md.family_name ?? md.surname ?? "").trim();

    const firstFromFull = rawFull.split(/\s+/)[0] || "";
    const first = titleCase(md.firstName ?? firstFromFull);

    let lastSource = md.lastName;
    if (lastSource == null || lastSource === "") {
      lastSource =
        rawLast ||
        (rawFull.includes(" ") ? rawFull.split(/\s+/).slice(1).join(" ") : "");
    }
    const last = titleCase(lastSource);

    const role = user?.app_metadata?.role ?? md.role ?? "user";
    const badge =
      md.badge ??
      user?.app_metadata?.badge ??
      (role === "admin" ? "Admin" : "Explorer");

    return {
      email: user?.email ?? "",
      first,
      last,
      phone: md.phone ?? "",
      dateOfBirth: md.dateOfBirth ?? md.dob ?? null,
      createdAt: md.createdAt ?? user?.created_at ?? null,
      role, // kept for internal checks if you ever need it
      badge, // NEW: preferred display field
      appUserId: md.appUserId ?? null,
    };
  }, [user]);

  // ---- Fetch Prisma profile (/api/me) and merge over Supabase metadata
  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setProfileLoading(true);
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        const data = await res.json();
        setDbProfile(data || null);
      } catch (e) {
        console.error("[dashboard] /api/me failed", e);
        setDbProfile(null);
      } finally {
        setProfileLoading(false);
      }
    };
    if (user) load();
  }, [user]);

  const finalProfile = useMemo(() => {
    // dbProfile may include: { id, email, name, surname, phone, role, badge, dateOfBirth, createdAt }
    const merged = {
      email: dbProfile?.email ?? supaProfile.email,
      first: dbProfile?.name?.trim?.() || supaProfile.first,
      last: dbProfile?.surname?.trim?.() || supaProfile.last,
      phone: dbProfile?.phone ?? supaProfile.phone,
      dateOfBirth: dbProfile?.dateOfBirth ?? supaProfile.dateOfBirth,
      createdAt: dbProfile?.createdAt ?? supaProfile.createdAt,
      role: dbProfile?.role ?? supaProfile.role, // still available if you need it
      badge: dbProfile?.badge ?? supaProfile.badge ?? "Explorer", // NEW: main display field
      appUserId: dbProfile?.id ?? supaProfile.appUserId,
    };
    return merged;
  }, [dbProfile, supaProfile]);

  const greetingName =
    [finalProfile.first].filter(Boolean).join(" ").trim() || "Explorer";
  const timeGreeting = useMemo(() => getTimeGreeting(), []); // compute once on mount

  // ---- Active reservations (email-based)
  useEffect(() => {
    const check = async () => {
      if (!user?.email) return;
      try {
        const res = await fetch(
          `/api/user/active-reservations?email=${encodeURIComponent(
            user.email
          )}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error("Failed to fetch reservations");
        const data = await res.json();
        setHasActiveReservations((data?.activeReservations ?? 0) > 0);
      } catch (e) {
        console.error("Error checking active reservations:", e);
        setHasActiveReservations(false);
      }
    };
    check();
  }, [user]);

  if (loading || profileLoading) return <Skeleton />;

  if (!user) {
    if (typeof window !== "undefined") window.location.href = "/login";
    return null;
  }

  function handleRedirect(path) {
    router.push(path);
  }

  function calculateMemberStatus(createdAt) {
    if (!createdAt) return "Member";
    const now = new Date();
    const created = new Date(createdAt);
    const diffDays = (now - created) / (1000 * 60 * 60 * 24);
    if (diffDays < 30) return "Newcomer";
    if (diffDays >= 365) return "Loyal Member";
    return "Member";
  }

  async function handleDeleteAccount() {
    setMessage("");
    setIsDeleting(true);
    try {
      const res = await fetch("/api/auth/delete-account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: finalProfile.appUserId, // use DB id if available
          email: finalProfile.email,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage("Account deleted successfully");
        setIsError(false);
        await supabase.auth.signOut();
        router.replace("/goodbye");
      } else {
        setMessage(
          data?.error || "Failed to delete account. Please try again."
        );
        setIsError(true);
      }
    } catch (err) {
      console.error("Error deleting account:", err);
      setMessage("Something went wrong. Please try again later.");
      setIsError(true);
    } finally {
      setIsDeleting(false);
      setIsModalOpen(true);
    }
  }

  const memberStatus = calculateMemberStatus(finalProfile.createdAt);

  return (
    <div className="min-h-screen bg-[#f4f1ec]">
      {/* Soft hero header */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#e9e4dc] via-[#f4f1ec] to-[#f4f1ec]" />
        <div className="mx-auto max-w-3xl px-6 pt-16 pb-10">
          <button
            onClick={() => handleRedirect("/")}
            className="mb-6 inline-flex items-center gap-2 text-[#8b6f47] text-sm border border-[#d8cfc3] px-4 py-2 rounded-full hover:bg-[#f4f1ec] hover:text-[#5a4a3f] transition-all shadow-sm"
          >
            <ArrowLeft size={18} />
            Home
          </button>

          <div className="flex items-start gap-5">
            <Avatar name={greetingName} />
            <div className="min-w-0">
              <h1
                className="text-balance text-3xl sm:text-4xl md:text-5xl font-serif tracking-tight leading-tight"
                style={{ textWrap: "balance" }}
              >
                <span className="opacity-70">{timeGreeting},</span>{" "}
                <span className="bg-gradient-to-r from-[#8b6f47] to-[#a78b62] bg-clip-text text-transparent break-words">
                  {greetingName}
                </span>
              </h1>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Chip icon={<ShieldCheck size={14} />} label={memberStatus} />
                {finalProfile.role === "admin" && <Chip label="Admin" />}
                {hasActiveReservations && (
                  <Chip label="Active reservations" tone="accent" />
                )}
              </div>
            </div>

            <div className="ml-auto shrink-0">
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  router.replace("/");
                }}
                className="inline-flex items-center gap-2 text-sm text-[#5a4a3f] px-3 py-2 rounded-full border border-[#e4ddd3] bg-[#fdfaf5] hover:bg-[#f1ede7] transition"
              >
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Card body */}
      <section className="mx-auto max-w-3xl px-6 pb-16">
        {/* Info Card */}
        <div className="bg-white/80 backdrop-blur-lg border border-[#e0dcd4] rounded-3xl shadow-xl p-6 mb-8">
          <h2 className="text-xl font-serif text-[#5a4a3f] mb-4">
            Your details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[#5a4a3f]">
            <Row
              label="Name"
              value={
                [finalProfile.first, finalProfile.last]
                  .filter(Boolean)
                  .join(" ") || "Not provided"
              }
            />
            <Row label="Email" value={finalProfile.email || "Not provided"} />
            <Row label="Phone" value={finalProfile.phone || "Not provided"} />
            <Row
              label="Date of Birth"
              value={
                finalProfile.dateOfBirth
                  ? new Date(finalProfile.dateOfBirth).toLocaleDateString()
                  : "Not provided"
              }
            />
            <Row
              label="Member Since"
              value={
                finalProfile.createdAt
                  ? new Date(finalProfile.createdAt).toLocaleDateString()
                  : "Not provided"
              }
            />
            <Row label="Badge" value={finalProfile.badge || "Explorer"} />
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <ActionCard
            icon={<CalendarCheck size={28} />}
            label="My Bookings"
            onClick={() => handleRedirect("/bookings")}
          />
          <ActionCard
            icon={<Settings size={28} />}
            label="Account Settings"
            onClick={() => handleRedirect("/account/settings")}
          />
        </div>

        {/* Danger zone */}
        <div className="mt-10 flex justify-center">
          <button
            onClick={() => setIsModalOpen(true)}
            disabled={isDeleting || hasActiveReservations}
            className={`flex items-center gap-2 rounded-full px-5 py-3 border transition-all shadow-sm text-sm
              ${
                hasActiveReservations
                  ? "bg-red-100 border-red-200 text-red-400 opacity-60 cursor-not-allowed"
                  : "bg-white border-red-300 text-red-600 hover:bg-red-600 hover:text-white"
              }`}
          >
            <Trash2 size={18} />
            {hasActiveReservations
              ? "Cancel reservations first"
              : "Delete Account"}
          </button>
        </div>
      </section>

      {/* Modal */}
      <DeleteAccountModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleDeleteAccount}
        message={message}
        isError={isError}
      />
    </div>
  );
}

/* ---------- UI bits ---------- */

function Avatar({ name }) {
  const initials = (name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
  return (
    <div className="h-12 w-12 rounded-full bg-[#e8dfcf] text-[#5a4a3f] ring-2 ring-[#f0e9dc] flex items-center justify-center font-semibold shadow-sm">
      {initials || "?"}
    </div>
  );
}

function Chip({ label, icon, tone = "neutral" }) {
  const toneClass =
    tone === "accent"
      ? "bg-[#fff1d6] text-[#8b6f47] border-[#f1e2c2]"
      : "bg-[#f6f4f0] text-[#5a4a3f] border-[#e8e2d9]";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${toneClass}`}
    >
      {icon}
      {label}
    </span>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-[#fffdf9] border border-[#eee8df] px-4 py-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-[#7a6a5f]">
        {label}
      </span>
      <span className="text-sm text-right">{value}</span>
    </div>
  );
}

function ActionCard({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-4 rounded-2xl bg-[#fdfaf7] border border-[#d8cfc3] p-6 shadow-lg transition-all hover:shadow-2xl hover:bg-[#8b6f47] hover:text-white"
    >
      <div className="shrink-0">{icon}</div>
      <div className="text-left">
        <p className="text-base font-medium">{label}</p>
        <p className="text-xs opacity-80">Tap to manage</p>
      </div>
      <div className="ml-auto h-2 w-2 rounded-full bg-[#8b6f47] opacity-0 group-hover:opacity-100" />
    </button>
  );
}

function Skeleton() {
  return (
    <div className="min-h-screen bg-[#f4f1ec] flex items-center justify-center p-8">
      <div className="w-full max-w-3xl space-y-6 animate-pulse">
        <div className="h-6 w-24 bg-[#e8e2d9] rounded" />
        <div className="h-10 w-3/4 bg-[#e8e2d9] rounded" />
        <div className="h-40 w-full bg-[#e8e2d9] rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="h-24 bg-[#e8e2d9] rounded-2xl" />
          <div className="h-24 bg-[#e8e2d9] rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

/* ---------- Utils ---------- */

function getTimeGreeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function titleCase(str = "") {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/(^.|[\s-].)/g, (m) => m.toUpperCase())
    .trim();
}
