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
  Heart, // Import Heart icon
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import DeleteAccountModal from "./deleteAccountModal";
import { useAuth } from "@/app/components/SessionWrapper";

export default function Dashboard() {
  const router = useRouter();
  const { user, loading, supabase } = useAuth();

  const [dbProfile, setDbProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
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
      role,
      badge,
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
    const merged = {
      email: dbProfile?.email ?? supaProfile.email,
      first: dbProfile?.name?.trim?.() || supaProfile.first,
      last: dbProfile?.surname?.trim?.() || supaProfile.last,
      phone: dbProfile?.phone ?? supaProfile.phone,
      dateOfBirth: dbProfile?.dateOfBirth ?? supaProfile.dateOfBirth,
      createdAt: dbProfile?.createdAt ?? supaProfile.createdAt,
      role: dbProfile?.role ?? supaProfile.role,
      badge: dbProfile?.badge ?? supaProfile.badge ?? "Explorer",
      appUserId: dbProfile?.id ?? supaProfile.appUserId,
    };
    return merged;
  }, [dbProfile, supaProfile]);

  const greetingName =
    [finalProfile.first].filter(Boolean).join(" ").trim() || "Explorer";
  const timeGreeting = useMemo(() => getTimeGreeting(), []);

  // ---- Active reservations (via /api/my-bookings)
  useEffect(() => {
    const loadBookings = async () => {
      try {
        const res = await fetch("/api/my-bookings", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to fetch bookings");
        const bookings = await res.json();

        const now = new Date();
        const active = Array.isArray(bookings)
          ? bookings.some((b) => {
              if (!b) return false;
              const status = (b.status || "").toLowerCase();
              if (!["confirmed", "pending", "paid"].includes(status))
                return false;
              if (!b.startTime) return false;
              const start = new Date(b.startTime);
              return start >= now;
            })
          : false;

        setHasActiveReservations(active);
      } catch (e) {
        console.error("Error checking active reservations via my-bookings:", e);
        setHasActiveReservations(false);
      }
    };

    if (user) loadBookings();
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

      const data = await res.json().catch(() => ({}));
      console.log("[delete-account] response", res.status, data);

      if (res.ok) {
        setMessage("Account deleted successfully");
        setIsError(false);

        // Try to sign out, but don't block redirect if it fails
        try {
          await supabase.auth.signOut();
        } catch (signOutErr) {
          console.error("[delete-account] signOut error (ignored)", signOutErr);
        }

        // Always go to goodbye page on successful deletion
        router.replace("/goodbye");
        return;
      }

      // Error from API
      setMessage(data?.error || "Failed to delete account. Please try again.");
      setIsError(true);
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
      {/* Header */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="h-full w-full bg-gradient-to-b from-[#e7e0d5] via-[#f4f1ec] to-[#f4f1ec]" />
          <div className="pointer-events-none absolute -top-24 right-[-10%] h-64 w-64 rounded-full bg-[#f5e7cf] opacity-60 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 left-[-5%] h-72 w-72 rounded-full bg-[#e0d2c0] opacity-50 blur-3xl" />
        </div>

        <div className="mx-auto max-w-5xl px-6 pt-8 pb-10 sm:pt-12">
          {/* Top bar */}
          <div className="mb-6 flex items-center justify-between gap-3">
            <button
              onClick={() => handleRedirect("/")}
              className="inline-flex items-center gap-2 rounded-full border border-[#d8cfc3] bg-[#fdfaf5]/70 px-4 py-2 text-xs font-medium text-[#8b6f47] shadow-sm transition-all hover:bg-[#f4f0e9] hover:text-[#5a4a3f]"
            >
              <ArrowLeft size={18} />
              Back to home
            </button>

            <button
              onClick={async () => {
                await supabase.auth.signOut();
                router.replace("/");
              }}
              className="inline-flex items-center gap-2 rounded-full border border-[#e4ddd3] bg-white/70 px-3 py-2 text-xs font-medium text-[#5a4a3f] shadow-sm transition hover:bg-[#f1ede7]"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>

          {/* Main header content */}
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-start gap-4">
              <Avatar name={greetingName} />
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.2em] text-[#a08c74]">
                  Your oasis space
                </p>
                <h1
                  className="mt-1 text-balance text-3xl font-serif tracking-tight text-[#4d3e33] sm:text-4xl md:text-5xl"
                  style={{ textWrap: "balance" }}
                >
                  <span className="opacity-70">{timeGreeting},</span>{" "}
                  <span className="bg-gradient-to-r from-[#8b6f47] to-[#b49766] bg-clip-text text-transparent">
                    {greetingName}
                  </span>
                </h1>

                <p className="mt-3 max-w-xl text-sm text-[#7a6a5f]">
                  Here you can review your details, keep an eye on your
                  bookings, and gently manage your account at your own pace.
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Chip
                    icon={<ShieldCheck size={14} />}
                    label={`${memberStatus} • ${finalProfile.badge}`}
                  />
                  {finalProfile.role === "admin" && (
                    <Chip label="Admin access" />
                  )}
                  {hasActiveReservations && (
                    <Chip label="Active reservations" tone="accent" />
                  )}
                </div>
              </div>
            </div>

            {/* Snapshot card */}
            <div className="w-full max-w-xs rounded-2xl border border-[#e1dad1] bg-white/85 px-4 py-4 shadow-sm backdrop-blur-sm sm:w-64">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#b29a79]">
                  Snapshot
                </p>
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f3e6d2] text-[#7a5c38]">
                  <CalendarCheck className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="space-y-1.5 text-sm text-[#5a4a3f]">
                <SnapshotRow label="Membership" value={memberStatus} />
                <SnapshotRow
                  label="Status"
                  value={
                    hasActiveReservations ? "Upcoming bookings" : "No bookings"
                  }
                />
                <SnapshotRow
                  label="Member since"
                  value={
                    finalProfile.createdAt
                      ? new Date(finalProfile.createdAt).toLocaleDateString()
                      : "—"
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Body */}
      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="grid gap-8 lg:grid-cols-3 lg:items-start">
          {/* Left: details + actions */}
          <div className="space-y-6 lg:col-span-2">
            {/* Info Card */}
            <div className="rounded-3xl border border-[#e0dcd4] bg-white/90 p-6 shadow-[0_18px_45px_rgba(93,71,43,0.06)] backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-serif text-[#5a4a3f]">
                    Your details
                  </h2>
                  <p className="mt-1 text-xs text-[#8b7b6f]">
                    We keep your information safe and only use it to manage your
                    experiences.
                  </p>
                </div>

                <button
                  onClick={() => handleRedirect("/account/settings")}
                  className="hidden rounded-full border border-[#e4ddd3] bg-[#fdfaf7] px-3 py-1.5 text-xs font-medium text-[#5a4a3f] shadow-sm transition hover:bg-[#f3ede6] sm:inline-flex"
                >
                  Manage details
                </button>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Row
                  label="Name"
                  value={
                    [finalProfile.first, finalProfile.last]
                      .filter(Boolean)
                      .join(" ") || "Not provided"
                  }
                />
                <Row
                  label="Email"
                  value={finalProfile.email || "Not provided"}
                  mono
                />
                <Row
                  label="Phone"
                  value={finalProfile.phone || "Not provided"}
                  mono
                />
                <Row
                  label="Date of birth"
                  value={
                    finalProfile.dateOfBirth
                      ? new Date(finalProfile.dateOfBirth).toLocaleDateString()
                      : "Not provided"
                  }
                  mono
                />
                <Row
                  label="Member since"
                  value={
                    finalProfile.createdAt
                      ? new Date(finalProfile.createdAt).toLocaleDateString()
                      : "Not provided"
                  }
                  mono
                />
                <Row label="Badge" value={finalProfile.badge || "Explorer"} />
              </div>

              <p className="mt-4 text-xs text-[#9a8a7e]">
                Need to update something? You can always adjust your details in{" "}
                <button
                  type="button"
                  onClick={() => handleRedirect("/account/settings")}
                  className="font-medium text-[#8b6f47] underline-offset-2 hover:underline"
                >
                  Account settings
                </button>
                .
              </p>
            </div>

            {/* Actions Grid - Updated to include Favorites */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <ActionCard
                icon={<CalendarCheck size={26} />}
                label="My bookings"
                description="Upcoming & past trips."
                onClick={() => handleRedirect("/bookings")}
              />
              <ActionCard
                icon={<Heart size={26} />}
                label="My favorites"
                description="Saved experiences."
                onClick={() => handleRedirect("/favorites")} // Redirect to favorites page
              />
              <ActionCard
                icon={<Settings size={26} />}
                label="Settings"
                description="Preferences & info."
                onClick={() => handleRedirect("/account/settings")}
              />
            </div>
          </div>

          {/* Right: account + danger zone */}
          <aside className="space-y-6">
            <div className="rounded-3xl border border-[#e1dad1] bg-[#fdfaf7] p-5 text-sm text-[#5a4a3f] shadow-sm">
              <h3 className="text-sm font-semibold text-[#4f4035]">
                Account & privacy
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-[#857669]">
                You&apos;re always in control of your data. You can update your
                details or close your account at any time.
              </p>
              <ul className="mt-3 space-y-1.5 text-xs text-[#7a6a5f]">
                <li>• Your details are only used for bookings and support.</li>
                <li>• You can request data export through our contact page.</li>
              </ul>
            </div>

            <div className="rounded-3xl border border-red-100 bg-red-50/65 p-5 text-sm shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-red-500">
                Account deletion
              </p>
              <p className="mt-1 text-xs text-[#7b5b54]">
                Deleting your account is permanent and removes your profile.
              </p>

              <button
                onClick={() => setIsModalOpen(true)}
                disabled={isDeleting || hasActiveReservations}
                className={`mt-3 flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-medium shadow-sm transition-all
                  ${
                    hasActiveReservations
                      ? "cursor-not-allowed border border-red-200 bg-red-100 text-red-400 opacity-70"
                      : "border border-red-300 bg-white text-red-600 hover:bg-red-600 hover:text-white"
                  }`}
              >
                <Trash2 size={16} />
                {hasActiveReservations
                  ? "Upcoming bookings exist"
                  : "Delete account"}
              </button>

              <p className="mt-2 text-[11px] leading-snug text-[#9a6b64]">
                If you have upcoming bookings, please cancel them first so we
                can safely close your account or contact support for assistance.
              </p>
            </div>
          </aside>
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
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e8dfcf] text-sm font-semibold text-[#5a4a3f] ring-2 ring-[#f0e9dc] shadow-sm sm:h-14 sm:w-14">
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
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] ${toneClass}`}
    >
      {icon}
      {label}
    </span>
  );
}

function SnapshotRow({ label, value }) {
  return (
    <p className="flex justify-between text-sm">
      <span className="text-xs text-[#8f7f70]">{label}</span>
      <span className="font-medium text-[#4f4035]">{value}</span>
    </p>
  );
}

function Row({ label, value, mono = false }) {
  return (
    <div className="rounded-2xl border border-[#eee8df] bg-[#fffdf9] px-4 py-3.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a08c74]">
        {label}
      </span>
      <span
        className={`mt-1 block text-sm text-[#4d3e33] break-words ${
          mono ? "font-mono text-[13px]" : ""
        }`}
        title={typeof value === "string" ? value : undefined}
      >
        {value}
      </span>
    </div>
  );
}

function ActionCard({ icon, label, description, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col items-start gap-3 rounded-2xl border border-[#d8cfc3] bg-[#fdfaf7] p-5 text-left shadow-[0_16px_40px_rgba(93,71,43,0.07)] transition-all hover:-translate-y-0.5 hover:border-[#b2976c] hover:bg-[#8b6f47] hover:shadow-[0_20px_55px_rgba(72,54,31,0.35)] w-full h-full"
    >
      <div className="flex w-full justify-between items-start">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#efe3cf] text-[#5a4a3f] transition group-hover:bg-white/10 group-hover:text-white">
          {icon}
        </div>
        <div className="h-2 w-2 rounded-full bg-[#c9b089] opacity-0 transition group-hover:opacity-100" />
      </div>

      <div>
        <p className="text-sm font-semibold text-[#4d3e33] group-hover:text-white">
          {label}
        </p>
        {description && (
          <p className="mt-1 text-xs text-[#8b7b6f] group-hover:text-[#f9efe0] line-clamp-1">
            {description}
          </p>
        )}
      </div>
    </button>
  );
}

function Skeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f1ec] p-8">
      <div className="w-full max-w-5xl space-y-6 animate-pulse">
        <div className="h-4 w-28 rounded-full bg-[#e8e2d9]" />
        <div className="h-10 w-2/3 rounded-full bg-[#e8e2d9]" />
        <div className="h-24 w-1/2 rounded-3xl bg-[#e8e2d9]" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-32 rounded-3xl bg-[#e8e2d9]" />
          <div className="h-32 rounded-3xl bg-[#e8e2d9]" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="h-28 rounded-3xl bg-[#e8e2d9]" />
          <div className="h-28 rounded-3xl bg-[#e8e2d9]" />
          <div className="h-28 rounded-3xl bg-[#e8e2d9]" />
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
    .replace(/(^.|[\s-].)/g, function (m) {
      return m.toUpperCase();
    })
    .trim();
}
