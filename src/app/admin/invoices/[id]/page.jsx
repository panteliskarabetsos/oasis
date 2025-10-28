// ===============================================================
// FILE: app/admin/invoices/[id]/page.jsx
// A clean details page with actions (send, mark paid, open, download)
// ===============================================================

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Mail as MailIcon,
  Building2,
  User2,
  Hash,
  Globe,
  FileText,
  ReceiptText,
  ExternalLink,
  Download,
  SendHorizontal,
  RefreshCw,
  Link as LinkIcon,
} from "lucide-react";

export default function InvoiceDetailsPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [inv, setInv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [acting, setActing] = useState(false);

  // ---------- utils ----------
  function formatMoney(value, currency) {
    const num = Number(value || 0);
    const code = (currency || "EUR").toUpperCase();
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: code,
        maximumFractionDigits: 2,
      }).format(num);
    } catch {
      return `${code} ${num.toFixed(2)}`;
    }
  }

  const computedTotal = useMemo(() => {
    if (inv?.total != null) return Number(inv.total) || 0;
    const items = inv?.items || [];
    return items.reduce((sum, it) => {
      const amt = Number(it?.amount || 0);
      const qty = Number(it?.quantity || 1) || 1;
      return sum + (isNaN(amt) ? 0 : amt) * qty;
    }, 0);
  }, [inv]);

  const statusStyle =
    inv?.status === "paid"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : inv?.status === "void" || inv?.status === "uncollectible"
      ? "bg-neutral-100 text-neutral-700 border-neutral-200"
      : inv?.status === "open" || inv?.status === "draft"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : "bg-neutral-100 text-neutral-700 border-neutral-200";

  // ---------- data fetch ----------
  async function fetchInvoice() {
    if (!id) return;
    try {
      setError(null);
      setLoading(true);

      const res = await fetch(`/api/admin/invoices/${id}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      const ct = res.headers.get("content-type") || "";
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Failed to load invoice (status ${res.status}). ${
            (text || "").slice(0, 160)
          }`
        );
      }
      if (!ct.includes("application/json")) {
        const text = await res.text().catch(() => "");
        const hint =
          res.redirected || (text || "").startsWith("<!DOCTYPE")
            ? "The API returned HTML (maybe a login or error page). Ensure auth is not redirecting /api and the route returns JSON."
            : "Unexpected non-JSON response from API.";
        throw new Error(hint);
      }

      const data = await res.json();
      setInv(data);
    } catch (e) {
      setError(e.message || String(e));
      setInv(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchInvoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ---------- actions ----------
  async function sendInvoiceNow() {
    if (!id) return;
    try {
      setActing(true);
      const res = await fetch(`/api/admin/invoices/${id}/send`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const ct = res.headers.get("content-type") || "";
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Failed to send invoice (status ${res.status}). ${text.slice(0, 160)}`
        );
      }
      if (!ct.includes("application/json")) {
        const text = await res.text().catch(() => "");
        throw new Error(
          "Unexpected non-JSON response when sending invoice. " +
            text.slice(0, 120)
        );
      }
      await fetchInvoice();
      alert("Invoice sent via Stripe.");
    } catch (e) {
      alert(e.message || String(e));
    } finally {
      setActing(false);
    }
  }

  async function markPaidNow(note = "Recorded offline payment") {
    if (!id) return;
    try {
      setActing(true);
      const res = await fetch(`/api/admin/invoices/${id}/mark-paid`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ note }),
      });
      const ct = res.headers.get("content-type") || "";
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Failed to mark as paid (status ${res.status}). ${text.slice(0, 160)}`
        );
      }
      if (!ct.includes("application/json")) {
        const text = await res.text().catch(() => "");
        throw new Error(
          "Unexpected non-JSON response when marking paid. " +
            text.slice(0, 120)
        );
      }
      await fetchInvoice();
    } catch (e) {
      alert(e.message || String(e));
    } finally {
      setActing(false);
    }
  }

  async function copyHostedUrl() {
    if (!inv?.hosted_invoice_url) return;
    try {
      await navigator.clipboard.writeText(inv.hosted_invoice_url);
      alert("Invoice link copied.");
    } catch {
      // fallback: open in new tab
      window.open(inv.hosted_invoice_url, "_blank", "noreferrer");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fcf9f4] to-white">
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-[#e8e5df]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 rounded-xl border border-[#e8e5df] bg-white px-3 py-2 text-sm text-[#5a4a3f] hover:bg-[#fcf9f4] shadow-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#3f342b] flex items-center gap-2">
                Invoice{" "}
                {inv?.number ? (
                  <span className="text-neutral-500">#{inv.number}</span>
                ) : (
                  ""
                )}
              </h1>
              <p className="text-xs sm:text-sm text-neutral-600">
                Invoice details and actions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchInvoice}
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs hover:bg-neutral-50 shadow-sm"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>

            {inv && (
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs border ${statusStyle}`}
              >
                {inv.status === "paid" && <CheckCircle2 className="h-4 w-4" />}
                {inv.status}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT */}
        <div className="lg:col-span-8 space-y-6">
          {/* Loading / Error */}
          {loading && (
            <div className="animate-pulse rounded-2xl border border-[#ece9e2] bg-white p-6 h-48" />
          )}
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm">{error}</p>
                <button
                  onClick={fetchInvoice}
                  className="rounded-lg border border-rose-300 bg-white/80 px-3 py-1.5 text-sm hover:bg-white"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {inv && (
            <>
              {/* Customer */}
              <section className="rounded-2xl border border-[#ece9e2] bg-white shadow-sm">
                <div className="px-5 sm:px-6 py-4 border-b border-[#ece9e2] flex items-center gap-2">
                  {inv?.customer?.type === "business" ? (
                    <Building2 className="h-5 w-5 text-neutral-500" />
                  ) : (
                    <User2 className="h-5 w-5 text-neutral-500" />
                  )}
                  <h2 className="text-base sm:text-lg font-medium">Bill To</h2>
                </div>
                <div className="px-5 sm:px-6 py-5 grid gap-4 sm:grid-cols-2 text-sm">
                  <Field label="Name">
                    <p className="mt-1">{inv?.customer?.name || "—"}</p>
                  </Field>
                  <Field label="Email" icon={<MailIcon className="h-4 w-4" />}>
                    <p className="mt-1">{inv?.customer?.email || "—"}</p>
                  </Field>
                  {inv?.customer?.business_name && (
                    <Field label="Business">
                      <p className="mt-1">{inv.customer.business_name}</p>
                    </Field>
                  )}
                  {inv?.customer?.phone && (
                    <Field label="Phone">
                      <p className="mt-1">{inv.customer.phone}</p>
                    </Field>
                  )}
                  {(inv?.customer?.tax_id || inv?.customer?.tax_id_type) && (
                    <Field label="Tax ID" icon={<Hash className="h-4 w-4" />}>
                      <p className="mt-1">
                        {inv?.customer?.tax_id}
                        {inv?.customer?.tax_id_type
                          ? ` (${inv.customer.tax_id_type})`
                          : ""}
                      </p>
                    </Field>
                  )}
                  {inv?.customer?.address && (
                    <Field
                      label="Address"
                      icon={<Globe className="h-4 w-4" />}
                      className="sm:col-span-2"
                    >
                      <p className="mt-1 text-neutral-700">
                        {[
                          inv.customer.address.line1,
                          inv.customer.address.line2,
                          inv.customer.address.city,
                          inv.customer.address.state,
                          inv.customer.address.postal_code,
                          inv.customer.address.country,
                        ]
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </p>
                    </Field>
                  )}
                </div>
              </section>

              {/* Invoice core */}
              <section className="rounded-2xl border border-[#ece9e2] bg-white shadow-sm">
                <div className="px-5 sm:px-6 py-4 border-b border-[#ece9e2] flex items-center gap-2">
                  <ReceiptText className="h-5 w-5 text-neutral-500" />
                  <h2 className="text-base sm:text-lg font-medium">Invoice</h2>
                </div>
                <div className="px-5 sm:px-6 py-5 grid gap-4 sm:grid-cols-2 text-sm">
                  <Field label="Currency">
                    <p className="mt-1">
                      {inv?.currency?.toUpperCase?.() || inv?.currency || "—"}
                    </p>
                  </Field>
                  <Field label="Collection">
                    <p className="mt-1">{inv?.collection_method || "—"}</p>
                  </Field>
                  {inv?.days_until_due != null && (
                    <Field label="Days until due">
                      <p className="mt-1">{inv.days_until_due}</p>
                    </Field>
                  )}
                  {inv?.memo && (
                    <Field label="Memo" className="sm:col-span-2">
                      <p className="mt-1">{inv.memo}</p>
                    </Field>
                  )}
                </div>
              </section>

              {/* Items */}
              <section className="rounded-2xl border border-[#ece9e2] bg-white shadow-sm">
                <div className="px-5 sm:px-6 py-4 border-b border-[#ece9e2] flex items-center gap-2">
                  <FileText className="h-5 w-5 text-neutral-500" />
                  <h2 className="text-base sm:text-lg font-medium">Line Items</h2>
                </div>
                <div className="px-5 sm:px-6 py-5">
                  <div className="grid grid-cols-[1fr_120px_100px_140px] text-xs text-neutral-500 px-1">
                    <div>Description</div>
                    <div className="text-right">Amount</div>
                    <div className="text-right">Qty</div>
                    <div className="text-right">Subtotal</div>
                  </div>
                  <div className="mt-2 divide-y">
                    {(inv.items || []).map((it, i) => {
                      const amt = Number(it?.amount || 0);
                      const qty = Number(it?.quantity || 1) || 1;
                      const sub = (isNaN(amt) ? 0 : amt) * qty;
                      return (
                        <div
                          key={i}
                          className="grid grid-cols-[1fr_120px_100px_140px] items-start py-2 text-sm"
                        >
                          <div>{it?.description || "—"}</div>
                          <div className="text-right">
                            {formatMoney(amt, inv?.currency)}
                          </div>
                          <div className="text-right">{qty}</div>
                          <div className="text-right font-medium">
                            {formatMoney(sub, inv?.currency)}
                          </div>
                        </div>
                      );
                    })}
                    {(!inv.items || inv.items.length === 0) && (
                      <div className="py-6 text-sm text-neutral-500">
                        No line items.
                      </div>
                    )}
                  </div>
                  <div className="border-t mt-4 pt-3 flex items-center justify-between">
                    <span className="text-sm text-neutral-600">Total</span>
                    <span className="text-lg font-semibold tracking-tight">
                      {formatMoney(computedTotal, inv?.currency)}
                    </span>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>

        {/* RIGHT: actions */}
        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-20 space-y-4">
            <div className="rounded-2xl border border-[#ece9e2] bg-white shadow-sm p-5">
              <h3 className="text-base font-medium mb-3">Actions</h3>

              <div className="flex flex-col gap-2">
                {inv?.hosted_invoice_url && (
                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href={inv.hosted_invoice_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 py-2 hover:bg-neutral-50 shadow-sm"
                    >
                      <ExternalLink className="h-4 w-4" /> Open invoice
                    </a>
                    <button
                      onClick={copyHostedUrl}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 py-2 hover:bg-neutral-50 shadow-sm"
                    >
                      <LinkIcon className="h-4 w-4" /> Copy link
                    </button>
                  </div>
                )}

                {inv?.invoice_pdf && (
                  <a
                    href={inv.invoice_pdf}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 py-2 hover:bg-neutral-50 shadow-sm"
                  >
                    <Download className="h-4 w-4" /> Download PDF
                  </a>
                )}

                {inv?.collection_method === "send_invoice" && inv?.status !== "paid" && (
                  <button
                    onClick={sendInvoiceNow}
                    disabled={acting}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 py-2 hover:bg-neutral-50 shadow-sm disabled:opacity-50"
                  >
                    <SendHorizontal className="h-4 w-4" /> Send via Stripe
                  </button>
                )}

                {inv?.status !== "paid" && (
                  <button
                    onClick={() => markPaidNow()}
                    disabled={acting}
                    title="Record an offline payment (cash/bank transfer)"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 py-2 hover:bg-neutral-50 shadow-sm disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Mark as Paid (offline)
                  </button>
                )}
              </div>
            </div>

            {inv?.number && (
              <p className="text-sm text-neutral-600">
                Invoice <span className="font-medium">{inv.number}</span> — {inv.status}
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, children, icon, className = "" }) {
  return (
    <div className={`block ${className}`}>
      <span className="text-sm font-medium text-neutral-800 flex items-center gap-2">
        {icon}
        {label}
      </span>
      {children}
    </div>
  );
}
