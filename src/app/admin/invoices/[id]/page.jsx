// ===============================================================
// FILE: app/admin/invoices/[id]/page.jsx
// Handles BOTH: DB (first-party) invoices and Stripe invoices,
// including editing for DB invoices.
// ===============================================================

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
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
  Plus,
  Trash2,
  Save,
} from "lucide-react";

/** Helpers shared across both sources */
function fmtMoney(value, currency = "EUR") {
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

function computeLineTotals(it) {
  const qty = Math.max(1, asNum(it.quantity, 1));
  const unit = asNum(it.amount, 0); // unit (excl. VAT)
  const disc = asNum(it.discount_percent, 0); // percent
  const vat = asNum(it.vat_rate, 0); // percent
  const unitAfterDisc = unit * (1 - disc / 100);
  const line_subtotal = unitAfterDisc * qty; // excl. VAT
  const line_tax = line_subtotal * (vat / 100); // VAT amount
  const line_total = line_subtotal + line_tax; // incl. VAT
  return { qty, unitAfterDisc, line_subtotal, line_tax, line_total };
}

const asNum = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const clone = (x) => JSON.parse(JSON.stringify(x || null));

/** Normalize API payload into a common shape for the UI */
function normalizeInvoice(apiIn, idFromRoute) {
  // unwrap { data: {...} } if your v2 returns that
  const api = apiIn && apiIn.data ? apiIn.data : apiIn;
  if (!api) return null;

  // Heuristics for source
  const hasStripeId =
    api?.meta?.stripe_invoice_id ||
    api?.hosted_invoice_url ||
    api?.invoice_pdf ||
    (typeof idFromRoute === "string" && idFromRoute.startsWith("in_"));
  const source = hasStripeId ? "stripe" : "db";

  // Number / code
  const number =
    api.invoiceNo || api.number || api?.meta?.number || String(api.id ?? "");

  // Currency
  const currency =
    (api.currency && api.currency.toUpperCase && api.currency.toUpperCase()) ||
    api.currency ||
    "EUR";

  // Customer
  const buyerFromMeta =
    api?.meta?.buyer && typeof api?.meta?.buyer === "object"
      ? api.meta.buyer
      : null;
  const customer = api.customer || buyerFromMeta || {};

  // Address normalized keys
  const address = customer.address ||
    buyerFromMeta?.address || {
      line1: "",
      line2: "",
      city: "",
      state: "",
      postal_code: "",
      country: "",
    };

  // Totals
  const total =
    asNum(api.total) ??
    asNum(api.amount) ??
    asNum(api?.meta?.total) ??
    asNum(api.totalAmount);
  const amountPaid =
    asNum(api.amountPaid) ??
    asNum(api.totalPaidAmount) ??
    asNum((api.payments || []).reduce((s, p) => s + asNum(p.amount), 0));
  const EPS = 0.005;
  const balanceRaw = total - amountPaid;
  const balance = balanceRaw > EPS ? balanceRaw : 0;

  // Lines -> items
  // Lines -> items (preserve totals if present)
  const items = api.items
    ? api.items.map((l) => ({
        id: l.id,
        description: l.description || "",
        quantity: asNum(l.quantity, 1) || 1,
        amount: asNum(l.unit_price ?? l.amount ?? 0), // unit (excl. VAT)
        vat_rate: l.vat_rate ?? null,
        discount_percent: l.discount_percent ?? null,
        line_subtotal: asNum(l.line_subtotal), // excl. VAT
        line_tax: asNum(l.line_tax),
        line_total: asNum(l.line_total), // incl. VAT
      }))
    : Array.isArray(api.lines)
    ? api.lines.map((l) => ({
        id: l.id,
        description: l.description || "",
        quantity: asNum(l.quantity, 1) || 1,
        amount: asNum(l.unit_price ?? l.amount ?? 0), // unit (excl. VAT)
        vat_rate: l.vat_rate ?? null,
        discount_percent: l.discount_percent ?? null,
        line_subtotal: asNum(l.line_subtotal),
        line_tax: asNum(l.line_tax),
        line_total: asNum(l.line_total),
      }))
    : [];

  // Hosted/PDF (Stripe)
  const hosted =
    api.hosted_invoice_url || api?.meta?.hosted_invoice_url || null;
  const pdf = api.invoice_pdf || api?.meta?.invoice_pdf || null;

  // Dates
  const due = api?.meta?.due_date ?? api?.due_date ?? api?.dueDate ?? null;

  // Collection (Stripe term; we keep as-is for DB = maybe "send_invoice"/"charge_automatically")
  const collection = api.collection_method || api?.meta?.payment_method || null;

  return {
    // identity & source
    id: api.id ?? idFromRoute,
    source, // 'db' | 'stripe'
    number,
    status: api.status || "draft",
    currency,
    // customer
    customer: {
      name:
        customer.name || customer.buyer_name || customer.business_name || "",
      email: customer.email || "",
      phone: customer.phone || "",
      tax_id: customer.vat || customer.tax_id || "",
      tax_id_type: customer.tax_id_type || "",
      business_name: customer.business_name || "",
      type:
        customer.type || (customer.business_name ? "business" : "individual"),
      address,
    },
    // amounts
    total,
    amountPaid,
    balance,
    // text/meta
    memo: api.memo || api?.notes || api?.meta?.notes || "",
    collection_method: collection || undefined,
    days_until_due: api.days_until_due != null ? api.days_until_due : undefined,
    // links
    hosted_invoice_url: hosted,
    invoice_pdf: pdf,
    // items
    items,
    // raw for advanced/patch
    _raw: api,
  };
}

export default function InvoiceDetailsPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const sp = useSearchParams();
  const src = (sp?.get("src") || "").toLowerCase();
  const idLooksStripe = typeof id === "string" && /^in_/.test(id);

  const [inv, setInv] = useState(null); // normalized
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [acting, setActing] = useState(false);

  // Editing state (DB only)
  const [edit, setEdit] = useState(null);

  const statusStyle =
    inv?.status === "paid"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : ["void", "uncollectible", "cancelled"].includes(
          String(inv?.status || "").toLowerCase()
        )
      ? "bg-neutral-100 text-neutral-700 border-neutral-200"
      : ["open", "draft", "pending", "sent", "finalized"].includes(
          String(inv?.status || "").toLowerCase()
        )
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : "bg-neutral-100 text-neutral-700 border-neutral-200";

  const computedTotal = useMemo(() => {
    if (!edit) return inv ? Number(inv.total || 0) : 0;
    const items = edit.items || [];
    return items.reduce((sum, it) => {
      // prefer existing line_total if present, else compute
      const lt = asNum(it.line_total);
      if (Number.isFinite(lt) && lt > 0) return sum + lt;
      return sum + computeLineTotals(it).line_total;
    }, 0);
  }, [edit, inv]);

  // ---------- data fetch ----------
  async function fetchInvoice() {
    if (!id) return;
    try {
      setError(null);
      setLoading(true);

      // 1) Try DB (v2) first with expand=all so we get lines/payments/meta
      const preferStripe = idLooksStripe || src === "stripe";
      let data = null;

      if (preferStripe) {
        // If id is a Stripe id, fetch Stripe directly
        if (idLooksStripe) {
          const r = await fetch(
            `/api/admin/invoices/${encodeURIComponent(id)}`,
            {
              headers: { Accept: "application/json" },
              cache: "no-store",
            }
          );
          if (!r.ok)
            throw new Error(
              `Failed to load invoice (status ${r.status}). ${await r
                .text()
                .then((t) => t.slice(0, 160))
                .catch(() => "")}`
            );
          if (!(r.headers.get("content-type") || "").includes("json"))
            throw new Error("Unexpected non-JSON response from Stripe route.");
          data = await r.json();
        } else {
          // src=stripe with numeric id: fetch DB first to discover the Stripe invoice id
          const db = await fetch(
            `/api/admin/invoices2/${encodeURIComponent(id)}?expand=all`,
            {
              headers: { Accept: "application/json" },
              cache: "no-store",
            }
          );
          if (!db.ok)
            throw new Error(
              `DB invoice not found (status ${db.status}). ${await db
                .text()
                .then((t) => t.slice(0, 160))
                .catch(() => "")}`
            );
          const dbJson = await db.json().catch(() => ({}));
          const stripeId =
            dbJson?.meta?.stripe_invoice_id ||
            dbJson?.data?.meta?.stripe_invoice_id ||
            dbJson?.stripe_invoice_id;
          if (!stripeId)
            throw new Error("This invoice has no linked Stripe invoice id.");
          const r = await fetch(
            `/api/admin/invoices/${encodeURIComponent(stripeId)}`,
            {
              headers: { Accept: "application/json" },
              cache: "no-store",
            }
          );
          if (!r.ok)
            throw new Error(
              `Failed to load Stripe invoice (status ${r.status}). ${await r
                .text()
                .then((t) => t.slice(0, 160))
                .catch(() => "")}`
            );
          if (!(r.headers.get("content-type") || "").includes("json"))
            throw new Error("Unexpected non-JSON response from Stripe route.");
          data = await r.json();
        }
      } else {
        // Strictly DB; do NOT fall back to Stripe for numeric ids
        const r = await fetch(
          `/api/admin/invoices2/${encodeURIComponent(id)}?expand=all`,
          {
            headers: { Accept: "application/json" },
            cache: "no-store",
          }
        );
        if (!r.ok) {
          const t = await r.text().catch(() => "");
          throw new Error(
            `Failed to load DB invoice (status ${r.status}). ${t.slice(0, 160)}`
          );
        }
        if (!(r.headers.get("content-type") || "").includes("json"))
          throw new Error("Unexpected non-JSON response from DB route.");
        data = await r.json();
      }
      const normalized = normalizeInvoice(data, id);
      setInv(normalized);

      // initialize edit state for DB invoices
      if (normalized?.source === "db") {
        setEdit({
          customer: clone(normalized.customer),
          memo: normalized.memo || "",
          due_date:
            normalized?._raw?.meta?.due_date ||
            normalized?._raw?.due_date ||
            "",

          items: clone(normalized.items || []),
          status: normalized.status || "draft",
        });
      } else {
        setEdit(null);
      }
    } catch (e) {
      setError(e.message || String(e));
      setInv(null);
      setEdit(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchInvoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ---------- actions ----------
  const isStripe = inv?.source === "stripe";
  const isDb = inv?.source === "db";

  async function sendInvoiceNow() {
    if (!id) return;
    try {
      setActing(true);
      if (isStripe) {
        // Let Stripe handle sending (open Stripe invoice)
        const sid = inv?._raw?.meta?.stripe_invoice_id || id;
        window.open(`https://dashboard.stripe.com/invoices/${sid}`, "_blank");
        return;
      }
      const res = await fetch(`/api/admin/invoices2/${id}/send`, {
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
      alert("Invoice sent.");
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
      if (isStripe) {
        // Manage payments in Stripe UI
        const sid = inv?._raw?.meta?.stripe_invoice_id || id;
        window.open(`https://dashboard.stripe.com/invoices/${sid}`, "_blank");
        return;
      }
      const res = await fetch(`/api/admin/invoices2/${id}/mark-paid`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ method: "cash", note }),
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

  async function saveDbInvoice() {
    if (!id || !isDb || !edit) return;
    try {
      setActing(true);

      // Build PATCH payload matching your invoices2 API
      const payload = {
        buyer: {
          name: edit.customer?.name || "",
          email: edit.customer?.email || "",
          phone: edit.customer?.phone || "",
          vat: edit.customer?.tax_id || "",
          address: {
            line1: edit.customer?.address?.line1 || "",
            line2: edit.customer?.address?.line2 || "",
            city: edit.customer?.address?.city || "",
            state: edit.customer?.address?.state || "",
            postal_code: edit.customer?.address?.postal_code || "",
            country: edit.customer?.address?.country || "",
          },
          business_name: edit.customer?.business_name || "",
          type: edit.customer?.type || "",
        },
        notes: edit.memo || "",
        due_date: edit.due_date || null,
        status: edit.status || "draft",
        lines: (edit.items || []).map((it) => ({
          id: it.id, // let server decide insert/update by presence
          description: it.description || "",
          quantity: Math.max(1, asNum(it.quantity, 1)),
          unit_price: asNum(it.amount, 0),
          vat_rate: it.vat_rate ?? null,
          discount_percent: it.discount_percent ?? null,
        })),
      };

      const res = await fetch(`/api/admin/invoices2/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const ct = res.headers.get("content-type") || "";
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Save failed (status ${res.status}). ${text.slice(0, 200)}`
        );
      }
      if (!ct.includes("application/json")) {
        const text = await res.text().catch(() => "");
        throw new Error(
          "Unexpected non-JSON response on save. " + text.slice(0, 160)
        );
      }

      // Reload fresh
      await fetchInvoice();
      alert("Invoice updated.");
    } catch (e) {
      alert(e.message || String(e));
    } finally {
      setActing(false);
    }
  }

  function copyHostedUrl() {
    const url = inv?.hosted_invoice_url;
    if (!url) return;
    navigator.clipboard
      .writeText(url)
      .then(() => alert("Invoice link copied."))
      .catch(() => window.open(url, "_blank", "noreferrer"));
  }

  // Editing handlers (DB only)
  function updateCustomer(path, value) {
    if (!edit) return;
    const next = clone(edit);
    const segs = path.split(".");
    let node = next.customer;
    for (let i = 0; i < segs.length - 1; i++) {
      const k = segs[i];
      node[k] = node[k] || {};
      node = node[k];
    }
    node[segs[segs.length - 1]] = value;
    setEdit(next);
  }
  function updateField(key, value) {
    setEdit((prev) => ({ ...prev, [key]: value }));
  }
  function updateItem(idx, key, value) {
    setEdit((prev) => {
      const items = clone(prev.items || []);
      items[idx] = { ...(items[idx] || {}), [key]: value };
      return { ...prev, items };
    });
  }
  function addItem() {
    setEdit((prev) => ({
      ...prev,
      items: [
        ...(prev.items || []),
        {
          description: "",
          amount: 0,
          quantity: 1,
          vat_rate: null,
          discount_percent: null,
        },
      ],
    }));
  }
  function removeItem(idx) {
    setEdit((prev) => {
      const items = clone(prev.items || []);
      items.splice(idx, 1);
      return { ...prev, items };
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fcf9f4] to-white">
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-[#e8e5df]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/invoices"
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
                {isStripe && (
                  <span className="ml-2 text-[11px] rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-sky-700">
                    Stripe
                  </span>
                )}
              </h1>
              <p className="text-xs sm:text-sm text-neutral-600">
                {isStripe ? "Stripe invoice" : "First-party invoice"} — details
                & actions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchInvoice}
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs hover:bg-neutral-50 shadow-sm"
              title="Refresh"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>

            {inv && (
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs border ${statusStyle}`}
              >
                {String(inv.status || "").toLowerCase() === "paid" && (
                  <CheckCircle2 className="h-4 w-4" />
                )}
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

                {/* VIEW for Stripe, EDIT for DB */}
                {isDb && edit ? (
                  <div className="px-5 sm:px-6 py-5 grid gap-4 sm:grid-cols-2 text-sm">
                    <LabeledInput
                      label="Name"
                      value={edit.customer.name}
                      onChange={(v) => updateCustomer("name", v)}
                    />
                    <LabeledInput
                      label="Email"
                      icon={<MailIcon className="h-4 w-4" />}
                      value={edit.customer.email}
                      onChange={(v) => updateCustomer("email", v)}
                    />
                    <LabeledInput
                      label="Business"
                      value={edit.customer.business_name}
                      onChange={(v) => updateCustomer("business_name", v)}
                    />
                    <LabeledInput
                      label="Phone"
                      value={edit.customer.phone}
                      onChange={(v) => updateCustomer("phone", v)}
                    />
                    <LabeledInput
                      label="Tax ID"
                      icon={<Hash className="h-4 w-4" />}
                      value={edit.customer.tax_id}
                      onChange={(v) => updateCustomer("tax_id", v)}
                    />

                    {/* Address */}
                    <LabeledInput
                      label="Address line 1"
                      icon={<Globe className="h-4 w-4" />}
                      className="sm:col-span-2"
                      value={edit.customer.address?.line1 || ""}
                      onChange={(v) => updateCustomer("address.line1", v)}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:col-span-2">
                      <LabeledInput
                        label="City"
                        value={edit.customer.address?.city || ""}
                        onChange={(v) => updateCustomer("address.city", v)}
                      />
                      <LabeledInput
                        label="Postal code"
                        value={edit.customer.address?.postal_code || ""}
                        onChange={(v) =>
                          updateCustomer("address.postal_code", v)
                        }
                      />
                      <LabeledInput
                        label="Country"
                        value={edit.customer.address?.country || ""}
                        onChange={(v) => updateCustomer("address.country", v)}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="px-5 sm:px-6 py-5 grid gap-4 sm:grid-cols-2 text-sm">
                    <Field label="Name">
                      <p className="mt-1">{inv?.customer?.name || "—"}</p>
                    </Field>
                    <Field
                      label="Email"
                      icon={<MailIcon className="h-4 w-4" />}
                    >
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
                )}
              </section>

              {/* Invoice core */}
              <section className="rounded-2xl border border-[#ece9e2] bg-white shadow-sm">
                <div className="px-5 sm:px-6 py-4 border-b border-[#ece9e2] flex items-center gap-2">
                  <ReceiptText className="h-5 w-5 text-neutral-500" />
                  <h2 className="text-base sm:text-lg font-medium">Invoice</h2>
                </div>

                {isDb && edit ? (
                  <div className="px-5 sm:px-6 py-5 grid gap-4 sm:grid-cols-2 text-sm">
                    <Field label="Currency">
                      <p className="mt-1">{inv.currency || "—"}</p>
                    </Field>
                    <Field label="Status">
                      <select
                        className="mt-1 w-full rounded-lg border px-3 py-2"
                        value={edit.status}
                        onChange={(e) => updateField("status", e.target.value)}
                      >
                        {[
                          "draft",
                          "sent",
                          "pending",
                          "finalized",
                          "paid",
                          "void",
                        ].map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Due date">
                      <input
                        type="date"
                        className="mt-1 w-full rounded-lg border px-3 py-2"
                        value={(edit.due_date || "").slice(0, 10)}
                        onChange={(e) =>
                          updateField("due_date", e.target.value)
                        }
                      />
                    </Field>
                    <Field label="Memo" className="sm:col-span-2">
                      <textarea
                        className="mt-1 w-full rounded-lg border px-3 py-2"
                        rows={3}
                        value={edit.memo}
                        onChange={(e) => updateField("memo", e.target.value)}
                      />
                    </Field>
                  </div>
                ) : (
                  <div className="px-5 sm:px-6 py-5 grid gap-4 sm:grid-cols-2 text-sm">
                    <Field label="Currency">
                      <p className="mt-1">{inv?.currency || "—"}</p>
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
                )}
              </section>

              {/* Items */}
              {/* Items */}
              <section className="rounded-2xl border border-[#ece9e2] bg-white shadow-sm">
                <div className="px-5 sm:px-6 py-4 border-b border-[#ece9e2] flex items-center gap-2">
                  <FileText className="h-5 w-5 text-neutral-500" />
                  <h2 className="text-base sm:text-lg font-medium">
                    Line Items
                  </h2>
                </div>

                {/* DB = editable, Stripe = read-only */}
                {isDb && edit ? (
                  <div className="px-5 sm:px-6 py-5">
                    {/* header */}
                    <div className="grid grid-cols-[1fr_140px_100px_160px] text-xs text-neutral-500 px-1">
                      <div>Description</div>
                      <div className="text-right">Unit (excl. VAT)</div>
                      <div className="text-right">Qty</div>
                      <div className="text-right">Line total (incl. VAT)</div>
                    </div>

                    {/* rows */}
                    <div className="mt-2 divide-y">
                      {(edit.items || []).map((it, i) => {
                        const { line_total } = computeLineTotals(it);
                        return (
                          <div
                            key={i}
                            className="grid grid-cols-[1fr_120px_100px_auto_40px] items-start py-2 text-sm gap-2"
                          >
                            <input
                              className="rounded-lg border px-2 py-1"
                              placeholder="Description"
                              value={it.description || ""}
                              onChange={(e) =>
                                updateItem(i, "description", e.target.value)
                              }
                            />
                            <input
                              className="rounded-lg border px-2 py-1 text-right"
                              placeholder="0.00"
                              inputMode="decimal"
                              value={it.amount}
                              onChange={(e) =>
                                updateItem(i, "amount", e.target.value)
                              }
                              title="Unit price (excl. VAT)"
                            />
                            <input
                              className="rounded-lg border px-2 py-1 text-right"
                              placeholder="1"
                              inputMode="numeric"
                              value={it.quantity}
                              onChange={(e) =>
                                updateItem(i, "quantity", e.target.value)
                              }
                              title="Quantity"
                            />
                            <div className="text-right font-medium leading-9">
                              {fmtMoney(line_total, inv?.currency)}
                            </div>
                            <button
                              className="p-1 rounded-lg hover:bg-neutral-100 text-rose-700"
                              title="Remove"
                              onClick={() => removeItem(i)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        );
                      })}

                      {(!edit.items || edit.items.length === 0) && (
                        <div className="py-6 text-sm text-neutral-500">
                          No line items.
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <button
                        onClick={addItem}
                        className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm hover:bg-neutral-50 shadow-sm"
                      >
                        <Plus className="h-4 w-4" /> Add item
                      </button>
                      <div className="text-right">
                        <div className="text-sm text-neutral-600">Total</div>
                        <div className="text-lg font-semibold tracking-tight">
                          {fmtMoney(computedTotal, inv?.currency)}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="px-5 sm:px-6 py-5">
                    {/* header */}
                    <div className="grid grid-cols-[1fr_140px_100px_160px] text-xs text-neutral-500 px-1">
                      <div>Description</div>
                      <div className="text-right">Unit (incl. VAT)</div>
                      <div className="text-right">Qty</div>
                      <div className="text-right">Line total</div>
                    </div>

                    {/* rows */}
                    <div className="mt-2 divide-y">
                      {(inv.items || []).map((it, i) => {
                        const qty = Math.max(1, asNum(it.quantity, 1));
                        // prefer API-provided totals; fallback to computed
                        const lt = Number.isFinite(asNum(it.line_total))
                          ? asNum(it.line_total)
                          : computeLineTotals(it).line_total;
                        const unitIncl = lt / qty;
                        return (
                          <div
                            key={i}
                            className="grid grid-cols-[1fr_140px_100px_160px] items-start py-2 text-sm"
                          >
                            <div>{it?.description || "—"}</div>
                            <div className="text-right">
                              {fmtMoney(unitIncl, inv?.currency)}
                            </div>
                            <div className="text-right">{qty}</div>
                            <div className="text-right font-medium">
                              {fmtMoney(lt, inv?.currency)}
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

                    {/* footer total stays the same but now matches tax-inclusive */}
                    <div className="border-t mt-4 pt-3 flex items-center justify-between">
                      <span className="text-sm text-neutral-600">Total</span>
                      <span className="text-lg font-semibold tracking-tight">
                        {fmtMoney(inv.total, inv?.currency)}
                      </span>
                    </div>
                  </div>
                )}
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
                {/* Open / Copy / Download for Stripe (uses hosted/pdf), FP uses API endpoints */}
                {inv && (
                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href={
                        isStripe
                          ? inv.hosted_invoice_url ||
                            `https://dashboard.stripe.com/invoices/${
                              inv?._raw?.meta?.stripe_invoice_id || id
                            }`
                          : `/api/admin/invoices2/${id}/pdf`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 py-2 hover:bg-neutral-50 shadow-sm"
                    >
                      <ExternalLink className="h-4 w-4" /> Open
                    </a>
                    {isStripe ? (
                      <button
                        onClick={copyHostedUrl}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 py-2 hover:bg-neutral-50 shadow-sm"
                      >
                        <LinkIcon className="h-4 w-4" /> Copy link
                      </button>
                    ) : (
                      <a
                        href={`/api/admin/invoices2/${id}/download`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 py-2 hover:bg-neutral-50 shadow-sm"
                      >
                        <Download className="h-4 w-4" /> Download PDF
                      </a>
                    )}
                  </div>
                )}

                {/* Send */}
                {inv && (
                  <button
                    onClick={sendInvoiceNow}
                    disabled={acting}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 py-2 hover:bg-neutral-50 shadow-sm disabled:opacity-50"
                    title={
                      isStripe ? "Open in Stripe to send" : "Send via email"
                    }
                  >
                    <SendHorizontal className="h-4 w-4" />{" "}
                    {isStripe ? "Open to Send (Stripe)" : "Send Invoice"}
                  </button>
                )}

                {/* Mark paid */}
                {inv?.status !== "paid" && (
                  <button
                    onClick={() => markPaidNow()}
                    disabled={acting}
                    title={
                      isStripe
                        ? "Manage payments in Stripe"
                        : "Record an offline payment"
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 py-2 hover:bg-neutral-50 shadow-sm disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />{" "}
                    {isStripe ? "Open in Stripe" : "Mark as Paid (offline)"}
                  </button>
                )}

                {/* Save (DB only) */}
                {isDb && edit && (
                  <button
                    onClick={saveDbInvoice}
                    disabled={acting}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-black text-white px-4 py-2 hover:bg-zinc-800 shadow-sm disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" /> Save changes
                  </button>
                )}
              </div>

              {/* Totals summary */}
              {inv && (
                <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span>Amount</span>
                    <span className="font-medium">
                      {fmtMoney(
                        isDb && edit ? computedTotal : inv.total,
                        inv.currency
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span>Paid</span>
                    <span>{fmtMoney(inv.amountPaid, inv.currency)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span>Balance</span>
                    <span className={inv.balance > 0 ? "text-rose-600" : ""}>
                      {fmtMoney(
                        Math.max(
                          0,
                          (isDb && edit ? computedTotal : inv.total) -
                            inv.amountPaid
                        ),
                        inv.currency
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {inv?.number && (
              <p className="text-sm text-neutral-600">
                Invoice <span className="font-medium">{inv.number}</span> —{" "}
                {inv.status}
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

function LabeledInput({ label, icon, value, onChange, className = "" }) {
  return (
    <div className={`block ${className}`}>
      <span className="text-sm font-medium text-neutral-800 flex items-center gap-2">
        {icon}
        {label}
      </span>
      <input
        className="mt-1 w-full rounded-lg border px-3 py-2"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
