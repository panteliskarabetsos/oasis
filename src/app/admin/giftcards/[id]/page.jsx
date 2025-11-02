// src/app/admin/giftcards/[id]/page.jsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Gift,
  Mail,
  CircleSlash,
  Loader2,
  Copy,
  Check,
  Calendar as CalendarIcon,
  CreditCard,
  Info,
  RefreshCcw,
  ExternalLink,
} from "lucide-react";

/** ------------------------------ Page ------------------------------ */
export default function GiftCardDetailsPage() {
  const { id } = useParams(); // UUID

  const [card, setCard] = useState(null);
  const [redemptions, setRedemptions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [emailTo, setEmailTo] = useState("");

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/giftcards/${id}`, {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to load gift card");
        const data = await res.json();
        if (ignore) return;
        const n = normalizeCard(data);
        setCard(n);
        setEmailTo(n.recipientEmail || "");
      } catch (e) {
        errToast(e.message || "Failed to load");
      } finally {
        setLoading(false);
      }

      // Redemptions are optional — ignore errors/404s
      try {
        const r = await fetch(`/api/admin/giftcards/${id}/redemptions`, {
          cache: "no-store",
          credentials: "include",
        });
        if (r.ok) {
          const list = await r.json();
          if (!ignore) setRedemptions(Array.isArray(list) ? list : []);
        } else {
          setRedemptions([]); // keeps the section tidy
        }
      } catch {
        setRedemptions([]);
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [id]);

  function okToast(msg) {
    setToast({ type: "ok", msg });
    setTimeout(() => setToast(null), 1800);
  }
  function errToast(msg) {
    setToast({ type: "err", msg });
    setTimeout(() => setToast(null), 2400);
  }

  async function reloadCard() {
    try {
      const r = await fetch(`/api/admin/giftcards/${id}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (r.ok) setCard(normalizeCard(await r.json()));
    } catch {}
  }

  async function onResend() {
    if (!card) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/giftcards/${card.id}/resend`, {
        method: "POST",
        credentials: "include",
        headers: emailTo ? { "Content-Type": "application/json" } : undefined,
        body: emailTo ? JSON.stringify({ to: emailTo }) : undefined,
      });
      if (!res.ok) {
        const j = await safeJson(res);
        throw new Error(j?.error || "Failed to send email");
      }
      okToast("Email sent");
    } catch (e) {
      errToast(e.message || "Failed to send email");
    } finally {
      setBusy(false);
    }
  }

  async function onVoid() {
    if (!card || card.status !== "active") return;
    if (!confirm(`Void gift card ${card.code}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/giftcards/${card.id}/void`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const j = await safeJson(res);
        throw new Error(j?.error || "Failed to void card");
      }
      okToast("Card voided");
      await reloadCard();
    } catch (e) {
      errToast(e.message || "Failed to void card");
    } finally {
      setBusy(false);
    }
  }

  if (loading)
    return (
      <PageShell>
        <Skeleton />
      </PageShell>
    );

  if (!card) {
    return (
      <PageShell>
        <div className="mx-auto max-w-4xl">
          <Header code="—" status="—" onReload={reloadCard} />
          <div className="mt-4 rounded-xl border border-[#e6dfd6] bg-white/80 p-6">
            <p className="text-sm text-[#7a6a5f]">Gift card not found.</p>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-5xl">
        <Header code={card.code} status={card.status} onReload={reloadCard} />

        {/* Overview cards */}
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Value */}
          <div className="rounded-2xl border border-[#e6dfd6] bg-white/80 p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-[#7a6a5f]">Value</div>
              <Badge status={card.status} />
            </div>
            <div className="mt-1 text-2xl font-semibold">
              {fmtMoney(card.initialAmountCents, card.currency)}
            </div>
            <div className="mt-1 text-xs text-[#7a6a5f]">
              Remaining{" "}
              <span className="font-medium text-black">
                {fmtMoney(card.remainingAmountCents, card.currency)}
              </span>
            </div>
          </div>

          {/* Recipient */}
          <div className="rounded-2xl border border-[#e6dfd6] bg-white/80 p-4">
            <div className="text-sm text-[#7a6a5f]">Recipient</div>
            <div className="mt-1 text-base">{card.recipientName || "—"}</div>
            <div className="text-sm text-[#7a6a5f] break-all">
              {card.recipientEmail || "—"}
            </div>
            {card.message ? (
              <div className="mt-2 rounded-lg border border-[#e6dfd6] bg-[#fbf7f1] p-2 text-sm">
                “{card.message}”
              </div>
            ) : null}
          </div>

          {/* Meta */}
          <div className="rounded-2xl border border-[#e6dfd6] bg-white/80 p-4">
            <div className="text-sm text-[#7a6a5f]">Details</div>
            <dl className="mt-2 space-y-1 text-sm">
              <Row label="Code">
                <span className="font-mono">{card.code}</span>{" "}
                <CopyBtn value={card.code} />
              </Row>
              <Row label="Currency">{card.currency}</Row>
              <Row label="Issued">{fmtDate(card.issuedAt)}</Row>
              <Row label="Expires">
                {card.expiresAt ? fmtDate(card.expiresAt) : "—"}
              </Row>
              <Row label="Source">{card.source || "—"}</Row>
              <Row label="Payment method">
                <span className="inline-flex items-center gap-1">
                  <CreditCard className="h-3.5 w-3.5" />
                  {card.paymentMethod === "stripe" ? "Stripe" : "Offline"}
                </span>
              </Row>
            </dl>
          </div>
        </div>

        {/* Stripe box (if present) */}
        {(card.stripeSessionId || card.stripePaymentIntentId) && (
          <div className="mt-4 rounded-2xl border border-[#e6dfd6] bg-white/80 p-4">
            <div className="inline-flex items-center gap-2 text-sm text-[#7a6a5f]">
              <CreditCard className="h-4 w-4" />
              Stripe
            </div>
            <dl className="mt-2 space-y-1 text-sm">
              <Row label="Checkout Session">
                <StripeId
                  id={card.stripeSessionId}
                  kind="session"
                  test={isTestStripeId(card.stripeSessionId)}
                />
              </Row>
              <Row label="Payment Intent">
                <StripeId
                  id={card.stripePaymentIntentId}
                  kind="payment_intent"
                  test={isTestStripeId(card.stripePaymentIntentId)}
                />
              </Row>
            </dl>
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 rounded-2xl border border-[#e6dfd6] bg-white/80 p-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <label className="text-sm text-[#7a6a5f] flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" /> Resend to
              </label>
              <input
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="name@example.com"
                className="mt-1 w-full rounded-md border border-[#d8cfc3] px-2 py-1.5"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={onResend}
                disabled={busy || !emailTo}
                className="rounded-full border border-[#d8cfc3] bg-white px-3 py-1.5 text-sm hover:bg-[#f6f3ef] disabled:opacity-50 inline-flex items-center gap-1"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
                Resend
              </button>
              <button
                onClick={onVoid}
                disabled={busy || card.status !== "active"}
                className="rounded-full border border-[#d8cfc3] bg-white px-3 py-1.5 text-sm hover:bg-[#f6f3ef] disabled:opacity-50 inline-flex items-center gap-1"
                title={
                  card.status !== "active"
                    ? "Only active cards can be voided"
                    : "Void card"
                }
              >
                <CircleSlash className="h-4 w-4" />
                Void
              </button>
            </div>
          </div>
          <p className="mt-2 text-xs text-[#7a6a5f] inline-flex items-center gap-1">
            <Info className="h-3.5 w-3.5" />
            Voiding permanently disables the code. This cannot be undone.
          </p>
        </div>

        {/* Redemptions */}
        <div className="mt-4 rounded-2xl border border-[#e6dfd6] bg-white/80">
          <div className="px-4 py-3 border-b border-[#eee5da] flex items-center gap-2">
            <Gift className="h-4 w-4" />
            <h3 className="font-medium">Redemption history</h3>
          </div>
          {redemptions === null ? (
            <div className="p-4 text-sm text-[#7a6a5f]">Loading…</div>
          ) : redemptions.length === 0 ? (
            <div className="p-4 text-sm text-[#7a6a5f]">
              No redemptions yet.
            </div>
          ) : (
            <ul className="divide-y divide-[#eee5da]">
              {redemptions.map((r) => (
                <li
                  key={r.id}
                  className="px-4 py-3 text-sm grid grid-cols-12 gap-2"
                >
                  <div className="col-span-5 sm:col-span-3">
                    {fmtDate(r.created_at || r.createdAt)}
                  </div>
                  <div className="col-span-4 sm:col-span-3">
                    {fmtMoney(
                      r.amount_cents ?? r.amountCents,
                      r.currency || card.currency
                    )}
                  </div>
                  <div className="col-span-3 sm:col-span-3">
                    {r.booking_id ? (
                      <Link
                        className="underline"
                        href={`/admin/reservations/${r.booking_id}`}
                      >
                        Booking #{r.booking_id}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </div>
                  <div
                    className="col-span-12 sm:col-span-3 text-[#7a6a5f] truncate"
                    title={r.notes || ""}
                  >
                    {r.notes || "—"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {toast && (
        <Toast type={toast.type} onClose={() => setToast(null)}>
          {toast.msg}
        </Toast>
      )}
    </PageShell>
  );
}

/** --------------------------- Layout shell -------------------------- */
function PageShell({ children }) {
  return (
    <div className="relative min-h-screen bg-[#f4f1ec] text-[#5a4a3f]">
      {/* ambient blobs */}
      <div className="pointer-events-none absolute -top-40 -left-24 h-[28rem] w-[28rem] rounded-full bg-[#e9e4dc] blur-3xl opacity-70" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-[32rem] w-[32rem] rounded-full bg-[#fff4e1] blur-3xl opacity-80" />

      <div className="relative mx-auto px-6 pt-2 lg:pt-2 pb-10 max-w-6xl xl:max-w-7xl 2xl:max-w-[88rem]">
        <div className="sticky top-[env(safe-area-inset-top)] z-20 -mx-6 mb-4 bg-gradient-to-b from-[#f4f1ec]/90 to-[#f4f1ec]/40 backdrop-blur border-b border-[#e8e2d9] px-6 py-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Link
                href="/admin/giftcards"
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 border border-[#d8cfc3] bg-[#fcf9f5] text-black text-xs shadow-sm hover:brightness-110"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
              <div>
                <h1 className="text-2xl md:text-3xl font-serif tracking-tight leading-tight text-[#5a4a3f] flex items-center gap-2">
                  <Gift className="h-6 w-6" /> Gift Card
                </h1>
                <p className="mt-1 text-sm text-[#7a6a5f]">
                  View details, resend, and manage this card.
                </p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs text-[#7a6a5f]">
              <CalendarIcon className="h-4 w-4" />
              Admin · Details
            </div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

/** ----------------------------- Pieces ----------------------------- */
function Header({ code, status, onReload }) {
  return (
    <div className="rounded-2xl border border-[#e6dfd6] bg-white/80 p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#fbf7f1] border border-[#efe7db]">
          <Gift className="h-5 w-5 text-[#8b6f47]" />
        </div>
        <div>
          <div className="text-xs text-[#7a6a5f]">Gift card code</div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg">{code}</span>
            <CopyBtn value={code} />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onReload}
          className="inline-flex items-center gap-1 rounded-full border border-[#e6dfd6] px-3 py-1 text-sm hover:bg-[#f6f3ef]"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          Reload
        </button>
        <Badge status={status} />
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <dt className="col-span-1 text-[#7a6a5f]">{label}</dt>
      <dd className="col-span-2">{children}</dd>
    </div>
  );
}

function Mono({ children }) {
  return <span className="font-mono break-all">{children}</span>;
}

function StripeId({ id, kind, test }) {
  if (!id) return <span>—</span>;
  const base = test
    ? "https://dashboard.stripe.com/test"
    : "https://dashboard.stripe.com";
  const href =
    kind === "session"
      ? `${base}/checkouts/sessions/${id}`
      : `${base}/payments/${id}`;
  return (
    <span className="inline-flex items-center gap-2">
      <Mono>{id}</Mono>
      <a
        className="inline-flex items-center gap-1 underline"
        href={href}
        target="_blank"
        rel="noreferrer"
        title="Open in Stripe dashboard"
      >
        Open <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </span>
  );
}

function Badge({ status }) {
  const cls =
    status === "active"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : status === "redeemed"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : status === "void"
      ? "bg-red-50 text-red-700 border-red-200"
      : "bg-[#f6f3ef] text-[#5a4a3f] border-[#e6dfd6]";
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] rounded-full border ${cls}`}
    >
      {status}
    </span>
  );
}

function CopyBtn({ value }) {
  const [copied, setCopied] = useState(false);
  async function onCopy() {
    try {
      await navigator.clipboard?.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  }
  return (
    <button
      className="inline-flex items-center gap-1 rounded-full border border-[#e6dfd6] px-2 py-0.5 text-[11px] hover:bg-[#f6f3ef]"
      onClick={onCopy}
      type="button"
      title="Copy"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function Toast({ type = "ok", onClose, children }) {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <div
        className={
          "flex items-center gap-2 rounded-full px-3 py-2 shadow-lg border " +
          (type === "ok"
            ? "bg-emerald-600 text-white border-emerald-700"
            : "bg-red-600 text-white border-red-700")
        }
      >
        {type === "ok" ? (
          <Check className="h-4 w-4" />
        ) : (
          <CircleSlash className="h-4 w-4" />
        )}
        {children}
        <button
          className="ml-2 opacity-80"
          onClick={onClose}
          aria-label="Close"
        >
          {/* use X for close */}
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              fill="currentColor"
              d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 1 0 5.7 7.11L10.59 12l-4.9 4.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.9a1 1 0 0 0 1.41-1.42L13.41 12l4.9-4.89a1 1 0 0 0-.01-1.4Z"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse">
      <div className="h-20 rounded-2xl bg-[#eee5da]" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="h-32 rounded-2xl bg-[#eee5da]" />
        <div className="h-32 rounded-2xl bg-[#eee5da]" />
        <div className="h-32 rounded-2xl bg-[#eee5da]" />
      </div>
      <div className="h-24 rounded-2xl bg-[#eee5da] mt-4" />
      <div className="h-40 rounded-2xl bg-[#eee5da] mt-4" />
    </div>
  );
}

/** ----------------------------- Utils ------------------------------ */
function normalizeCard(r) {
  // Accept camelCase or snake_case from API + derive paymentMethod if API didn't send it
  const paymentMethod =
    r.payment_method ??
    r.paymentMethod ??
    (r.stripe_session_id ||
    r.stripe_payment_intent_id ||
    (r.source && String(r.source).toLowerCase().includes("stripe"))
      ? "stripe"
      : "offline");

  return {
    id: r.id,
    code: r.code,
    status: r.status,
    currency: (r.currency || "EUR").toUpperCase(),
    initialAmountCents: r.initial_amount_cents ?? r.initialAmountCents,
    remainingAmountCents: r.remaining_amount_cents ?? r.remainingAmountCents,
    issuedAt: r.issued_at ?? r.issuedAt,
    expiresAt: r.expires_at ?? r.expiresAt,
    recipientEmail: r.recipient_email ?? r.recipientEmail ?? "",
    recipientName: r.recipient_name ?? r.recipientName ?? "",
    message: r.message ?? "",
    source: r.source ?? "",
    stripeSessionId: r.stripe_session_id ?? r.stripeSessionId ?? "",
    stripePaymentIntentId:
      r.stripe_payment_intent_id ?? r.stripePaymentIntentId ?? "",
    paymentMethod,
  };
}

function fmtMoney(cents, currency = "EUR") {
  const n = Number.isFinite(cents) ? Math.max(0, cents) / 100 : 0;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}
async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
function isTestStripeId(id) {
  return typeof id === "string" && /_test_/.test(id);
}
