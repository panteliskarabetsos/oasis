// src/app/account/settings/page.js
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/components/SessionWrapper";
import {
  ArrowLeft,
  User as UserIcon,
  Mail,
  Phone,
  Calendar as CalendarIcon,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  ShieldCheck,
} from "lucide-react";

/* -------------------- date helpers for dd/mm/yyyy -------------------- */
function isoToDmy(iso = "") {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}
function dmyToIso(dmy = "") {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dmy);
  if (!m) return ""; // invalid or incomplete
  const [, d, mo, y] = m;
  return `${y}-${mo}-${d}`; // YYYY-MM-DD
}
function maskDmyInput(v = "") {
  const digits = v.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}
function isValidDmy(dmy = "") {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dmy);
  if (!m) return false;
  const d = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const y = parseInt(m[3], 10);
  const dt = new Date(y, mo - 1, d);
  return (
    dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d
  );
}
function toYMD(d) {
  const date = typeof d === "string" ? new Date(d) : d;
  if (!date || Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export default function SettingsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // ISO value we send to API (YYYY-MM-DD)
  const [dateOfBirth, setDateOfBirth] = useState("");
  // Display value user edits (dd/mm/yyyy)
  const [dateOfBirthDmy, setDateOfBirthDmy] = useState("");

  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [isLockedOut, setIsLockedOut] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState(null);

  // Fetch profile and hydrate fields
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user) return;
      try {
        const res = await fetch("/api/me", {
          cache: "no-store",
          credentials: "include",
        });
        const data = await res.json();
        if (cancelled) return;

        const md = user?.user_metadata || {};
        const dbEmail = data?.email || user.email || "";
        const dbFirst = data?.name || md.firstName || md.name || "";
        const dbLast = data?.surname || md.surname || md.family_name || "";
        const dbPhone = data?.phone || md.phone || "";
        const dobRaw = data?.dateOfBirth || md.dateOfBirth || md.dob || null;

        const dobIso = dobRaw ? toYMD(dobRaw) : "";
        setEmail(dbEmail);
        setFirstName(dbFirst);
        setSurname(dbLast);
        setPhone(dbPhone);
        setDateOfBirth(dobIso);
        setDateOfBirthDmy(isoToDmy(dobIso));
      } catch {
        if (!cancelled) setEmail(user?.email || "");
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Lockout check
  useEffect(() => {
    const locked = localStorage.getItem("passwordLockedOut");
    const dateStr = localStorage.getItem("passwordLockedOutDate");
    if (locked === "true" && dateStr) {
      const d = new Date(dateStr);
      const days = Math.floor(
        (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (days >= 30) {
        localStorage.removeItem("passwordLockedOut");
        localStorage.removeItem("passwordLockedOutDate");
        setIsLockedOut(false);
        setDaysRemaining(null);
      } else {
        setIsLockedOut(true);
        setDaysRemaining(30 - days);
      }
    }
  }, []);

  const fullName = useMemo(
    () => [firstName, surname].filter(Boolean).join(" ").trim(),
    [firstName, surname]
  );

  const canSubmit =
    !isLockedOut &&
    !isSubmitting &&
    email.trim() &&
    confirmPassword.trim() &&
    isValidDmy(dateOfBirthDmy);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) {
      if (!isValidDmy(dateOfBirthDmy)) {
        setErrorMessage("Please enter a valid date of birth (dd/mm/yyyy).");
      }
      return;
    }
    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const res = await fetch("/api/account/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: firstName,
          surname,
          email,
          phone,
          dateOfBirth, // YYYY-MM-DD
          password: confirmPassword, // confirm only; backend should verify, not change it
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 403) {
        setErrorMessage(
          data.message || "Too many sensitive updates this month."
        );
        setIsLockedOut(true);
        localStorage.setItem("passwordLockedOut", "true");
        localStorage.setItem("passwordLockedOutDate", new Date().toISOString());
      } else if (res.ok) {
        setSuccessMessage(data.message || "Settings saved.");
      } else {
        setErrorMessage(data.message || "Unable to save your changes.");
      }
    } catch (err) {
      console.error("[settings] update error", err);
      setErrorMessage("Something went wrong. Please try again later.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Shell>
        <div className="animate-pulse text-[#5a4a3f]">Loading…</div>
      </Shell>
    );
  }

  if (!user) {
    return (
      <Shell>
        <div className="bg-white/90 backdrop-blur rounded-3xl border border-[#e0dcd4] shadow-xl max-w-md w-full p-8 text-center">
          <h2 className="text-2xl font-serif text-[#5a4a3f] mb-2">
            You’re signed out
          </h2>
          <p className="text-[#7a6a5f] mb-6">
            Please log in to edit your settings.
          </p>
          <button
            onClick={() => router.push("/login")}
            className="inline-flex items-center gap-2 rounded-full px-5 py-2 border border-[#e4ddd3] bg-[#fdfaf5] text-[#5a4a3f] hover:bg-[#f1ede7] transition"
          >
            Go to Login
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* Top actions */}
      <div className="mx-auto mb-6 flex items-center justify-between max-w-6xl xl:max-w-7xl">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-[#8b6f47] text-sm border border-[#d8cfc3] px-4 py-2 rounded-full hover:bg-[#f4f1ec] hover:text-[#5a4a3f] transition-all shadow-sm"
        >
          <ArrowLeft size={16} /> Back
        </button>

        <div className="inline-flex items-center gap-2 text-xs rounded-full px-3 py-1 border border-[#e8e2d9] bg-[#f6f4f0] text-[#5a4a3f]">
          <ShieldCheck size={14} />
          Password confirmation required
        </div>
      </div>

      <div className="max-w-4xl mx-auto grid gap-6 md:grid-cols-2">
        {/* Left card: Profile fields */}
        <div className="bg-white/90 backdrop-blur rounded-3xl border border-[#e0dcd4] shadow-2xl p-6 md:p-8">
          <h1 className="text-2xl md:text-3xl font-serif text-[#5a4a3f] mb-1">
            Account Settings
          </h1>
          <p className="text-sm text-[#7a6a5f] mb-6">
            Update your profile details. Your password will not change here—use{" "}
            <em>Forgot password</em> instead.
          </p>

          {successMessage && (
            <Banner tone="success" icon={<CheckCircle2 size={18} />}>
              {successMessage}
            </Banner>
          )}
          {errorMessage && (
            <Banner tone="error" icon={<XCircle size={18} />}>
              {errorMessage}
            </Banner>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <IconInput
              label="First Name"
              value={firstName}
              onChange={setFirstName}
              placeholder="Your first name"
              icon={UserIcon}
              disabled={isSubmitting || isLockedOut}
            />
            <IconInput
              label="Surname"
              value={surname}
              onChange={setSurname}
              placeholder="Your surname"
              icon={UserIcon}
              disabled={isSubmitting || isLockedOut}
            />
            <IconInput
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              icon={Mail}
              disabled={isSubmitting || isLockedOut}
              required
            />
            <IconInput
              label="Phone"
              type="tel"
              value={phone}
              onChange={setPhone}
              placeholder="(optional)"
              icon={Phone}
              disabled={isSubmitting || isLockedOut}
            />

            <IconInput
              label="Date of Birth"
              type="text"
              inputMode="numeric"
              placeholder="dd/mm/yyyy"
              value={dateOfBirthDmy}
              onChange={(v) => {
                const masked = maskDmyInput(v);
                setDateOfBirthDmy(masked);
                setDateOfBirth(dmyToIso(masked));
              }}
              icon={CalendarIcon}
              disabled={isSubmitting || isLockedOut}
              required
            />

            <div>
              <label className="block text-sm font-medium text-[#5a4a3f] mb-2">
                Confirm with Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#7a6a5f]">
                  <Lock size={18} />
                </span>
                <input
                  type={showPass ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Enter your current password to save changes"
                  className="w-full rounded-xl bg-white border border-[#e0dcd4] px-5 py-3 pl-11 pr-12 focus:outline-none focus:ring-2 focus:ring-[#8b6f47] shadow-sm transition-all"
                  disabled={isSubmitting || isLockedOut}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute inset-y-0 right-0 px-3 text-[#7a6a5f] hover:text-[#5a4a3f]"
                  aria-label={showPass ? "Hide password" : "Show password"}
                  disabled={isSubmitting}
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="mt-2 text-xs text-[#7a6a5f]">
                This is only to confirm it’s you. To change your password, use{" "}
                <em>Forgot password</em>.
              </p>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className={`w-full py-3 rounded-full text-base font-medium text-white transition-all shadow-md ${
                canSubmit
                  ? "bg-gradient-to-r from-[#8b6f47] to-[#a78b62] hover:opacity-90"
                  : "bg-gray-400 cursor-not-allowed"
              }`}
            >
              {isSubmitting ? "Saving…" : "Save Changes"}
            </button>

            {isLockedOut && daysRemaining !== null && (
              <p className="text-sm text-[#b25e00] text-center">
                You can try again in{" "}
                <strong>
                  {daysRemaining} day{daysRemaining !== 1 ? "s" : ""}
                </strong>
                .
              </p>
            )}
          </form>
        </div>

        {/* Right card: Profile summary & actions */}
        <div className="bg-white/90 backdrop-blur rounded-3xl border border-[#e0dcd4] shadow-2xl p-6 md:p-8">
          <div className="mb-4">
            <h2 className="text-xl font-serif text-[#5a4a3f]">Preview</h2>
            <p className="text-sm text-[#7a6a5f]">How your details appear.</p>
          </div>
          <div className="space-y-3">
            <PreviewRow
              icon={<UserIcon size={16} />}
              label="Name"
              value={fullName || "—"}
            />
            <PreviewRow
              icon={<Mail size={16} />}
              label="Email"
              value={email || "—"}
            />
            <PreviewRow
              icon={<Phone size={16} />}
              label="Phone"
              value={phone || "—"}
            />
            <PreviewRow
              icon={<CalendarIcon size={16} />}
              label="Date of Birth"
              value={dateOfBirthDmy || "—"}
            />
          </div>

          <div className="mt-8 border-t border-[#eee8df] pt-6">
            <h3 className="text-sm font-semibold text-[#5a4a3f] mb-2">
              Password
            </h3>
            <p className="text-sm text-[#7a6a5f] mb-3">
              You can’t change your password here.
            </p>
            <button
              type="button"
              onClick={() => router.push("/forgot-password")}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 border border-[#d8cfc3] bg-[#fdfaf5] text-[#5a4a3f] hover:bg-[#f1ede7] transition"
            >
              <Lock size={16} /> Forgot password
            </button>
          </div>
        </div>
      </div>
    </Shell>
  );
}

/* ------------ Layout shell with the ambient background ------------ */
function Shell({ children }) {
  return (
    <div className="relative min-h-screen bg-[#f4f1ec] overflow-hidden p-6 md:p-10">
      <div className="pointer-events-none absolute -top-32 -left-24 h-96 w-96 rounded-full bg-[#e9e4dc] blur-3xl opacity-60" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-[28rem] w-[28rem] rounded-full bg-[#fff4e1] blur-3xl opacity-70" />
      <div className="relative">{children}</div>
    </div>
  );
}

/* ----------------------------- UI bits ----------------------------- */
function IconInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  icon: Icon,
  disabled,
  required,
  inputMode, // allow passing inputMode like "numeric"
  ...rest
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-[#5a4a3f] mb-2">
        {label}
      </span>
      <div className="relative">
        <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#7a6a5f]">
          <Icon size={18} />
        </span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          inputMode={inputMode}
          {...rest}
          className="w-full rounded-xl bg-white border border-[#e0dcd4] px-5 py-3 pl-11 focus:outline-none focus:ring-2 focus:ring-[#8b6f47] shadow-sm transition-all"
        />
      </div>
    </label>
  );
}

function Banner({ tone = "success", icon, children }) {
  const styles =
    tone === "success"
      ? "border-green-200 bg-green-50 text-green-800"
      : "border-red-200 bg-red-50 text-red-700";
  return (
    <div
      className={`mb-4 rounded-xl border px-4 py-3 flex items-start gap-2 ${styles}`}
    >
      <span className="mt-0.5">{icon}</span>
      <span className="text-sm">{children}</span>
    </div>
  );
}

function PreviewRow({ icon, label, value }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-[#fffdf9] border border-[#eee8df] px-4 py-3">
      <div className="flex items-center gap-2 text-[#7a6a5f]">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wide">
          {label}
        </span>
      </div>
      <span className="text-sm text-[#5a4a3f]">{value}</span>
    </div>
  );
}
