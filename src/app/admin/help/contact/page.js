"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  MessageSquare,
  Phone,
  AlertCircle,
  Send,
  Clipboard,
  CheckCircle2,
  ChevronDown,
  LifeBuoy,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/app/components/SessionWrapper";

export default function AdminHelpContactPage() {
  const router = useRouter();
  const { user, loading } = useAuth();


  const supportEmail =
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@yourdomain.com";
  const statusUrl = process.env.NEXT_PUBLIC_STATUS_URL || "";
  const supportPhone = process.env.NEXT_PUBLIC_SUPPORT_PHONE || "";


  const [dbRole, setDbRole] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!loading && user) {
          const res = await fetch("/api/me", { cache: "no-store" });
          const me = await res.json();
          if (alive) setDbRole(me?.role || "user");
        }
      } catch {
        if (alive) setDbRole(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [loading, user]);

  useEffect(() => {
    if (!loading && (!user || dbRole === "user")) {
      router.replace("/"); // non-admins bounce
    }
  }, [loading, user, dbRole, router]);

  // ---- global booking status (nice to include in diagnostics)
  const [globalStatus, setGlobalStatus] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/public/settings/bookings", {
          cache: "no-store",
        });
        const data = await res.json();
        if (alive) setGlobalStatus(data || null);
      } catch {
        if (alive) setGlobalStatus(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // ---- form state
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("question");
  const [priority, setPriority] = useState("normal");
  const [message, setMessage] = useState("");
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [sending, setSending] = useState(false);
  const [resultMsg, setResultMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [showDiag, setShowDiag] = useState(false);

  const diagnostics = useMemo(() => {
    const now = new Date();
    const md = user?.user_metadata || {};
    return {
      timestamp: now.toISOString(),
      path: typeof window !== "undefined" ? window.location.pathname : "",
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: typeof navigator !== "undefined" ? navigator.language : "unknown",
      user: user
        ? {
            id: user.id,
            email: user.email,
            dbRole: dbRole,
            appRole:
              user.app_metadata?.role || md.role || "(none in app_metadata)",
          }
        : null,
      env: {
        nodeEnv: process.env.NODE_ENV,
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? "set" : "missing",
      },
      globalBookings: globalStatus || {},
      ua:
        typeof navigator !== "undefined"
          ? navigator.userAgent
          : "(server render)",
    };
  }, [user, dbRole, globalStatus]);

  async function copyDiagnostics() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2));
      setResultMsg("Diagnostics copied to clipboard.");
      setErrorMsg("");
    } catch {
      setResultMsg("");
      setErrorMsg("Could not copy diagnostics.");
    }
  }

  async function submitTicket(e) {
    e.preventDefault();
    setSending(true);
    setResultMsg("");
    setErrorMsg("");
    try {
      const res = await fetch("/api/admin/help/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          category,
          priority,
          message,
          includeDiagnostics,
          diagnostics: includeDiagnostics ? diagnostics : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data?.error || "Failed to send message.");
      } else {
        setResultMsg("Your message has been sent. We’ll get back to you soon!");
        setSubject("");
        setMessage("");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  }

  if (loading || dbRole === null) {
    return (
      <div className="min-h-[50vh] grid place-items-center text-[#5a4a3f]">
        Loading…
      </div>
    );
  }

  if (!user || dbRole !== "admin") return null;

  return (
    <main className="max-w-5xl mx-auto pt-24 px-4 sm:px-6 lg:px-8">
      {/* Top back button */}
      <div className="sticky -top-0 z-10 -mx-4 mb-6 bg-gradient-to-b from-[#f4f1ec] to-transparent px-4 pt-2 pb-3">
        <button
          onClick={() => router.push("/admin")}
          className="inline-flex items-center gap-2 rounded-full border border-[#d8cfc3] bg-[#f4f1ec] px-4 py-2 text-sm font-medium text-[#5a4a3f] shadow hover:bg-[#eae5df]"
        >
          <ArrowLeft size={16} />
          Back to Admin
        </button>
      </div>

      <h1 className="text-center font-serif text-4xl font-bold text-[#5a4a3f]">
        Help & Support
      </h1>

      {/* Quick contact cards */}
      <section className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <CardButton
          icon={<Mail className="text-[#8b6f47]" size={20} />}
          title="Email support"
          subtitle={supportEmail}
          onClick={() =>
            window.open(`mailto:${supportEmail}`, "_blank", "noopener")
          }
        />
        <CardButton
          icon={<LifeBuoy className="text-[#8b6f47]" size={20} />}
          title="Status page"
          subtitle={statusUrl ? "Open status" : "Not configured"}
          disabled={!statusUrl}
          onClick={() =>
            statusUrl && window.open(statusUrl, "_blank", "noopener")
          }
        />
        <CardButton
          icon={<Phone className="text-[#8b6f47]" size={20} />}
          title="Phone / WhatsApp"
          subtitle={supportPhone || "Not provided"}
          disabled={!supportPhone}
          onClick={() =>
            supportPhone && window.open(`tel:${supportPhone}`, "_self")
          }
        />
      </section>

      {/* Ticket form */}
      <section className="mt-8 rounded-2xl border border-[#e3dcd2] bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <MessageSquare className="text-[#8b6f47]" size={18} />
          <h2 className="text-lg font-semibold text-[#5a4a3f]">
            Send a message to support
          </h2>
        </div>

        <form onSubmit={submitTicket} className="grid gap-4">
          <div className="grid gap-2 sm:grid-cols-[1fr,180px,160px]">
            <div>
              <label className="mb-1 block text-xs text-[#7a6a5f]">
                Subject
              </label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                placeholder="Briefly describe the issue"
                className="w-full rounded-lg border border-[#dcd2c3] bg-white px-3 py-2 text-[#5a4a3f] focus:outline-none focus:ring-2 focus:ring-[#cbb89e]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#7a6a5f]">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-[#dcd2c3] bg-white px-3 py-2 text-[#5a4a3f]"
              >
                <option value="question">General question</option>
                <option value="bug">Bug / error</option>
                <option value="booking">Booking issue</option>
                <option value="billing">Billing</option>
                <option value="feature">Feature request</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#7a6a5f]">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full rounded-lg border border-[#dcd2c3] bg-white px-3 py-2 text-[#5a4a3f]"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-[#7a6a5f]">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={5}
              placeholder="What happened? Steps to reproduce? Screenshots/IDs?"
              className="w-full rounded-lg border border-[#dcd2c3] bg-white px-3 py-2 text-[#5a4a3f] focus:outline-none focus:ring-2 focus:ring-[#cbb89e]"
            />
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-[#5a4a3f]">
            <input
              type="checkbox"
              checked={includeDiagnostics}
              onChange={(e) => setIncludeDiagnostics(e.target.checked)}
              className="accent-[#8b6f47]"
            />
            Include diagnostics (recommended)
          </label>

          {/* Diagnostics collapsible */}
          <div className="rounded-xl border border-[#e8e2d8] bg-[#fffdf9]">
            <button
              type="button"
              onClick={() => setShowDiag((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm"
            >
              <span className="inline-flex items-center gap-2">
                <AlertCircle size={16} className="text-[#8b6f47]" />
                Diagnostics preview
              </span>
              <ChevronDown
                size={16}
                className={`transition ${showDiag ? "rotate-180" : ""}`}
              />
            </button>
            {showDiag && (
              <div className="border-t border-[#efe6da]">
                <pre className="max-h-64 overflow-auto p-4 text-xs text-[#4a4a4a]">
                  {JSON.stringify(diagnostics, null, 2)}
                </pre>
                <div className="flex items-center justify-end gap-2 px-4 pb-4">
                  <button
                    type="button"
                    onClick={copyDiagnostics}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#e0dcd4] bg-white px-3 py-1.5 text-xs text-[#5a4a3f] hover:bg-[#faf7f1]"
                  >
                    <Clipboard size={14} />
                    Copy diagnostics
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-[#7a6a5f]">
              Or email us directly:&nbsp;
              <a
                className="underline text-[#8b6f47]"
                href={`mailto:${supportEmail}?subject=${encodeURIComponent(
                  "[Admin] " + (subject || "Support request")
                )}`}
              >
                {supportEmail}
              </a>
            </div>

            <button
              type="submit"
              disabled={sending}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#8b6f47] px-5 py-3 text-white shadow hover:bg-[#7a5f3a] disabled:opacity-60"
            >
              <Send size={16} />
              {sending ? "Sending…" : "Send to support"}
            </button>
          </div>

          {resultMsg && (
            <p className="mt-2 inline-flex items-center gap-2 text-sm text-green-700">
              <CheckCircle2 size={16} /> {resultMsg}
            </p>
          )}
          {errorMsg && (
            <p className="mt-2 inline-flex items-center gap-2 text-sm text-red-700">
              <AlertCircle size={16} /> {errorMsg}
            </p>
          )}
        </form>
      </section>

      {/* Helpful links */}
      <section className="mt-8">
        <h3 className="mb-3 text-sm font-semibold text-[#5a4a3f]">
          Quick links
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <LinkPill href="/admin/schedule" label="Manage schedule" />
          <LinkPill href="/admin/reservations" label="All reservations" />
          <LinkPill href="/admin/settings" label="Admin settings" />
        </div>
      </section>
    </main>
  );
}

/* ---------- UI bits ---------- */

function CardButton({ icon, title, subtitle, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 rounded-2xl border border-[#e0dcd4] bg-white p-4 text-left shadow-sm transition hover:shadow-md ${
        disabled ? "opacity-60 cursor-not-allowed" : ""
      }`}
    >
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#efeae2]">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-[#5a4a3f]">{title}</div>
        <div className="truncate text-xs text-[#7a6a5f]">{subtitle}</div>
      </div>
      <ExternalLink className="ml-auto text-[#b6ab9b]" size={16} />
    </button>
  );
}

function LinkPill({ href, label }) {
  return (
    <a
      href={href}
      className="inline-flex items-center justify-center rounded-full border border-[#e0dcd4] bg-white px-4 py-2 text-sm text-[#5a4a3f] hover:bg-[#faf7f1]"
    >
      {label}
    </a>
  );
}
