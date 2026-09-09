// ===============================================================
// FILE: app/admin/invoices/[id]/page.jsx
// Handles BOTH: DB (first-party) invoices and Stripe invoices,
// including editing for DB invoices.
// ===============================================================

"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";

import Icon from "../../_ui/Icon";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ErrorNote,
  Field,
  Input,
  Muted,
  Page,
  PageHeader,
  Select,
  Skeleton,
  StatusBadge,
  Table,
  Td,
  Th,
  Tr,
  inputClass,
} from "../../_ui";

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


const PAY_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "gift_card", label: "Gift card" },
  { value: "voucher", label: "Voucher" },
  { value: "other", label: "Other" },
];

const VAT_PRESETS = [0, 6, 13, 24];

const fmtDate = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d) ? String(v) : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

/* --------------------------------- page ---------------------------------- */

export default function InvoiceDetailsPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const router = useRouter();
  const sp = useSearchParams();
  const src = (sp?.get("src") || "").toLowerCase();
  const idLooksStripe = typeof id === "string" && /^in_/.test(id);

  const [inv, setInv] = useState(null); // normalized
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [acting, setActing] = useState("");

  // Editing state (DB only)
  const [edit, setEdit] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [editing, setEditing] = useState(false);

  // Record-payment dialog
  const [payOpen, setPayOpen] = useState(false);
  const [payMethod, setPayMethod] = useState("cash");
  const [payAmount, setPayAmount] = useState("");
  const [payReference, setPayReference] = useState("");

  const isStripe = inv?.source === "stripe";
  const isDb = inv?.source === "db";

  const computedTotal = useMemo(() => {
    if (!editing || !edit) return inv ? Number(inv.total || 0) : 0;
    return (edit.items || []).reduce((sum, it) => sum + computeLineTotals(it).line_total, 0);
  }, [editing, edit, inv]);

  const computedNet = useMemo(() => {
    if (!editing || !edit) return null;
    return (edit.items || []).reduce((sum, it) => sum + computeLineTotals(it).line_subtotal, 0);
  }, [editing, edit]);

  const dirty = useMemo(
    () => Boolean(editing && baseline && JSON.stringify(edit) !== JSON.stringify(baseline)),
    [editing, edit, baseline]
  );

  const payments = useMemo(() => {
    const p = inv?._raw?.payments;
    return Array.isArray(p) ? p : [];
  }, [inv]);

  // ---------- data fetch ----------
  const fetchInvoice = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      setLoading(true);

      // 1) Try DB (v2) first with expand=all so we get lines/payments/meta
      const preferStripe = idLooksStripe || src === "stripe";
      let data = null;

      if (preferStripe) {
        if (idLooksStripe) {
          const r = await fetch(`/api/admin/invoices/${encodeURIComponent(id)}`, {
            headers: { Accept: "application/json" },
            cache: "no-store",
          });
          if (!r.ok) throw new Error(`Failed to load invoice (status ${r.status}).`);
          if (!(r.headers.get("content-type") || "").includes("json"))
            throw new Error("Unexpected non-JSON response from the Stripe route.");
          data = await r.json();
        } else {
          // src=stripe with a numeric id: read the DB row to discover the Stripe id
          const db = await fetch(`/api/admin/invoices2/${encodeURIComponent(id)}?expand=all`, {
            headers: { Accept: "application/json" },
            cache: "no-store",
          });
          if (!db.ok) throw new Error(`DB invoice not found (status ${db.status}).`);
          const dbJson = await db.json().catch(() => ({}));
          const stripeId =
            dbJson?.meta?.stripe_invoice_id ||
            dbJson?.data?.meta?.stripe_invoice_id ||
            dbJson?.stripe_invoice_id;
          if (!stripeId) throw new Error("This invoice has no linked Stripe invoice id.");
          const r = await fetch(`/api/admin/invoices/${encodeURIComponent(stripeId)}`, {
            headers: { Accept: "application/json" },
            cache: "no-store",
          });
          if (!r.ok) throw new Error(`Failed to load the Stripe invoice (status ${r.status}).`);
          data = await r.json();
        }
      } else {
        // Strictly DB; do NOT fall back to Stripe for numeric ids
        const r = await fetch(`/api/admin/invoices2/${encodeURIComponent(id)}?expand=all`, {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (!r.ok) throw new Error(`Failed to load the invoice (status ${r.status}).`);
        if (!(r.headers.get("content-type") || "").includes("json"))
          throw new Error("Unexpected non-JSON response from the invoice route.");
        data = await r.json();
      }

      const normalized = normalizeInvoice(data, id);
      setInv(normalized);

      if (normalized?.source === "db") {
        const seed = {
          customer: clone(normalized.customer),
          memo: normalized.memo || "",
          due_date:
            (normalized?._raw?.meta?.due_date || normalized?._raw?.due_date || "").slice(0, 10),
          items: clone(normalized.items || []),
          status: normalized.status || "draft",
        };
        setEdit(seed);
        setBaseline(clone(seed));
      } else {
        setEdit(null);
        setBaseline(null);
      }
      setEditing(false);
    } catch (e) {
      setError(e.message || String(e));
      setInv(null);
      setEdit(null);
    } finally {
      setLoading(false);
    }
  }, [id, idLooksStripe, src]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setPayOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // warn before leaving with unsaved edits
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // ---------- actions ----------
  const stripeDashUrl = () =>
    `https://dashboard.stripe.com/invoices/${inv?._raw?.meta?.stripe_invoice_id || id}`;

  async function call(kind, url, options, successMessage) {
    setActing(kind);
    try {
      const res = await fetch(url, { credentials: "include", ...options });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || `Request failed (${res.status})`);
      toast.success(j?.message || successMessage);
      return j;
    } catch (e) {
      toast.error(e?.message || "Something went wrong.");
      return null;
    } finally {
      setActing("");
    }
  }

  async function sendInvoiceNow() {
    if (isStripe) return window.open(stripeDashUrl(), "_blank");
    const j = await call("send", `/api/admin/invoices2/${id}/send`,
      { method: "POST", headers: { Accept: "application/json" } }, "Invoice sent.");
    if (j) fetchInvoice();
  }

  async function submitPayment() {
    const amt = Number(payAmount);
    if (!(amt > 0)) return toast.error("Enter an amount greater than zero.");
    const j = await call("mark", `/api/admin/invoices2/${id}/mark-paid`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ method: payMethod, amount: amt, reference: payReference || undefined }),
    }, "Payment recorded.");
    if (j) {
      setPayOpen(false);
      setPayReference("");
      fetchInvoice();
    }
  }

  async function voidInvoice() {
    if (isStripe) return window.open(stripeDashUrl(), "_blank");
    if (!window.confirm("Void this invoice? Its status will be set to 'void' and it can no longer be edited.")) return;
    const j = await call("void", `/api/admin/invoices2/${id}/void`, { method: "POST" }, "Invoice voided.");
    if (j) fetchInvoice();
  }

  async function deleteInvoice() {
    if (!window.confirm("Delete this invoice permanently? Only drafts and voided invoices without payments can be deleted.")) return;
    const j = await call("delete", `/api/admin/invoices2/${id}`, { method: "DELETE" }, "Invoice deleted.");
    if (j) router.push("/admin/invoices");
  }

  async function saveDbInvoice() {
    if (!id || !isDb || !edit) return;
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
        id: it.id,
        description: it.description || "",
        quantity: Math.max(1, asNum(it.quantity, 1)),
        unit_price: asNum(it.amount, 0),
        vat_rate: it.vat_rate ?? null,
        discount_percent: it.discount_percent ?? null,
      })),
    };

    const j = await call("save", `/api/admin/invoices2/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    }, "Invoice updated.");
    if (j) fetchInvoice();
  }

  function discardEdits() {
    if (dirty && !window.confirm("Discard your unsaved changes?")) return;
    setEdit(clone(baseline));
    setEditing(false);
  }

  const patchCustomer = (p) => setEdit((s) => ({ ...s, customer: { ...s.customer, ...p } }));
  const patchAddress = (p) =>
    setEdit((s) => ({ ...s, customer: { ...s.customer, address: { ...s.customer.address, ...p } } }));
  const patchItem = (i, p) =>
    setEdit((s) => ({ ...s, items: s.items.map((it, idx) => (idx === i ? { ...it, ...p } : it)) }));
  const addLine = () =>
    setEdit((s) => ({
      ...s,
      items: [...(s.items || []), { description: "", quantity: 1, amount: 0, vat_rate: 24, discount_percent: 0 }],
    }));
  const removeLine = (i) =>
    setEdit((s) => ({ ...s, items: s.items.filter((_, idx) => idx !== i) }));

  /* --------------------------------- view --------------------------------- */

  if (loading) {
    return (
      <Page>
        <Skeleton className="mb-5 h-16" />
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-72" />
      </Page>
    );
  }

  if (error || !inv) {
    return (
      <Page>
        <PageHeader eyebrow="Revenue" title="Invoice" />
        <ErrorNote>{error || "Invoice not found."}</ErrorNote>
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" onClick={fetchInvoice}>Try again</Button>
          <Button as={Link} href="/admin/invoices" variant="ghost">Back to invoices</Button>
        </div>
      </Page>
    );
  }

  const ccy = inv.currency || "EUR";
  const bookingId = inv?._raw?.meta?.booking_id;
  const canEdit = isDb && !["void", "paid"].includes(String(inv.status || "").toLowerCase());
  const canDelete = isDb && ["draft", "void"].includes(String(inv.status || "").toLowerCase()) && !payments.length;
  const outstanding = Math.max(0, Number(inv.balance || 0));

  return (
    <Page>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <Link href="/admin/invoices" className="hover:underline">Invoices</Link>
            <span className="text-[#c9bfb3]">/</span>
            <span className="normal-case tracking-normal">{inv.number}</span>
          </span>
        }
        title={fmtMoney(inv.total, ccy)}
        description={`Issued ${fmtDate(inv?._raw?.meta?.issue_date || inv?._raw?.createdAt)} · ${
          inv.customer?.business_name || inv.customer?.name || inv.customer?.email || "No customer"
        }`}
        actions={
          <>
            <Button as="a" href={isStripe ? (inv.invoice_pdf || stripeDashUrl()) : `/api/admin/invoices2/${id}/pdf`}
              target="_blank" rel="noreferrer" variant="secondary">
              <Icon name="file" size={15} /> PDF
            </Button>
            {isDb ? (
              <Button as="a" href={`/api/admin/invoices2/${id}/download`} variant="secondary">
                <Icon name="download" size={15} /> Download
              </Button>
            ) : null}
            {isStripe ? (
              <Button as="a" href={stripeDashUrl()} target="_blank" rel="noreferrer" variant="secondary">
                <Icon name="external" size={15} /> Stripe
              </Button>
            ) : null}
          </>
        }
      />

      <div className="-mt-2 mb-5 flex flex-wrap items-center gap-2">
        <StatusBadge status={inv.status} />
        <Badge variant={isStripe ? "info" : "brand"}>{isStripe ? "Stripe" : "First-party"}</Badge>
        {outstanding > 0 ? <Badge variant="warning">{fmtMoney(outstanding, ccy)} outstanding</Badge> : null}
        {bookingId ? (
          <Link href={`/admin/bookings/${bookingId}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#f3ece1] px-2.5 py-0.5 text-[11px] font-semibold text-[#8b6f47] ring-1 ring-inset ring-[#e7dcc9] hover:bg-[#ece0cd]">
            <Icon name="calendar" size={12} /> Booking #{bookingId}
          </Link>
        ) : null}
        {inv.hosted_invoice_url ? (
          <button
            onClick={() => {
              navigator.clipboard?.writeText(inv.hosted_invoice_url);
              toast.success("Payment link copied.");
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#f2ede4] px-2.5 py-0.5 text-[11px] font-semibold text-[#6b5c4d] hover:bg-[#e8e0d3]"
          >
            <Icon name="copy" size={12} /> Copy payment link
          </button>
        ) : null}
      </div>

      {/* money */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MoneyCard label="Total" value={fmtMoney(inv.total, ccy)} />
        <MoneyCard label="Paid" value={fmtMoney(inv.amountPaid, ccy)} />
        <MoneyCard label="Outstanding" value={fmtMoney(outstanding, ccy)} accent={outstanding > 0 ? "warn" : undefined} />
        <MoneyCard label="Due" value={fmtDate(inv?._raw?.meta?.due_date || inv?._raw?.due_date)} />
      </div>

      {/* actions */}
      <Card className="mb-5">
        <CardHeader title="Actions" />
        <div className="flex flex-wrap gap-2">
          {outstanding > 0 ? (
            <Button
              variant="primary"
              disabled={!!acting}
              onClick={() => {
                if (isStripe) return window.open(stripeDashUrl(), "_blank");
                setPayAmount(outstanding.toFixed(2));
                setPayOpen(true);
              }}
            >
              <Icon name="check" size={15} /> Record payment
            </Button>
          ) : null}

          <Button variant="secondary" onClick={sendInvoiceNow} disabled={!!acting}>
            <Icon name="mail" size={15} /> {acting === "send" ? "Sending…" : "Email invoice"}
          </Button>

          {canEdit && !editing ? (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Icon name="file" size={15} /> Edit
            </Button>
          ) : null}

          {isDb && String(inv.status || "").toLowerCase() !== "void" && !payments.length ? (
            <Button variant="secondary" onClick={voidInvoice} disabled={!!acting}>
              <Icon name="ban" size={15} /> {acting === "void" ? "Voiding…" : "Void"}
            </Button>
          ) : null}

          {canDelete ? (
            <Button variant="danger" onClick={deleteInvoice} disabled={!!acting}>
              <Icon name="trash" size={15} /> {acting === "delete" ? "Deleting…" : "Delete"}
            </Button>
          ) : null}

          <Button variant="ghost" onClick={fetchInvoice} disabled={!!acting}>
            <Icon name="clock" size={15} /> Refresh
          </Button>
        </div>

        {isDb && !canEdit && String(inv.status || "").toLowerCase() !== "void" ? (
          <Muted className="mt-3 text-[12px]">
            A paid invoice can no longer be edited. Refund it in Payments first if something is wrong.
          </Muted>
        ) : null}
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="space-y-5">
          {/* line items */}
          <Card padded={false}>
            <div className="flex items-start justify-between gap-4 px-5 pt-5">
              <div>
                <h2 className="font-serif text-[17px] text-[#2a211a]">Line items</h2>
                <Muted className="mt-0.5 text-[12px]">
                  {editing ? "Editing — changes are saved when you press Save." : `${inv.items.length} line${inv.items.length === 1 ? "" : "s"}`}
                </Muted>
              </div>
              {editing ? (
                <Button size="sm" variant="secondary" onClick={addLine}>
                  <Icon name="plus" size={14} /> Add line
                </Button>
              ) : null}
            </div>

            {editing ? (
              <div className="space-y-3 p-5">
                {(edit.items || []).map((it, i) => {
                  const t = computeLineTotals(it);
                  return (
                    <div key={i} className="rounded-2xl border border-[#e6e0d6] bg-[#fdfbf7] p-3">
                      <div className="flex items-start gap-2">
                        <input
                          value={it.description}
                          onChange={(e) => patchItem(i, { description: e.target.value })}
                          placeholder={`Item ${i + 1}`}
                          className={`${inputClass} bg-white`}
                        />
                        <button
                          type="button"
                          onClick={() => removeLine(i)}
                          disabled={(edit.items || []).length === 1}
                          aria-label="Remove line"
                          className="mt-0.5 rounded-lg p-2 text-[#9a8c7e] hover:bg-[#fbeae5] hover:text-[#a33c22] disabled:opacity-30"
                        >
                          <Icon name="trash" size={15} />
                        </button>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                        <Field label="Qty">
                          <input type="number" min="1" step="1" value={it.quantity}
                            onChange={(e) => patchItem(i, { quantity: e.target.value })}
                            className={`${inputClass} bg-white`} />
                        </Field>
                        <Field label={`Unit net (${ccy})`}>
                          <input type="number" min="0" step="0.01" value={it.amount}
                            onChange={(e) => patchItem(i, { amount: e.target.value })}
                            className={`${inputClass} bg-white`} />
                        </Field>
                        <Field label="VAT %">
                          <Select value={String(asNum(it.vat_rate))}
                            onChange={(e) => patchItem(i, { vat_rate: e.target.value })} className="bg-white">
                            {VAT_PRESETS.map((v) => <option key={v} value={v}>{v}%</option>)}
                          </Select>
                        </Field>
                        <Field label="Discount %">
                          <input type="number" min="0" max="100" step="1" value={asNum(it.discount_percent)}
                            onChange={(e) => patchItem(i, { discount_percent: e.target.value })}
                            className={`${inputClass} bg-white`} />
                        </Field>
                        <div className="flex flex-col justify-end">
                          <span className="mb-1 block text-[11px] font-semibold text-[#6b5c4d]">Line total</span>
                          <div className="flex h-10 items-center justify-end rounded-xl border border-[#e6e0d6] bg-white px-3 text-[13px] font-semibold">
                            {fmtMoney(t.line_total, ccy)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Description</Th>
                    <Th className="text-right">Qty</Th>
                    <Th className="text-right">Unit</Th>
                    <Th className="text-right">VAT</Th>
                    <Th className="text-right">Total</Th>
                  </tr>
                </thead>
                <tbody>
                  {inv.items.length ? inv.items.map((it, i) => {
                    const t = computeLineTotals(it);
                    return (
                      <Tr key={it.id ?? i}>
                        <Td className="font-medium text-[#2a211a]">
                          {it.description || <span className="text-[#b0a294]">Untitled line</span>}
                          {asNum(it.discount_percent) > 0 ? (
                            <span className="ml-2 text-[11px] text-[#8b6f47]">−{asNum(it.discount_percent)}%</span>
                          ) : null}
                        </Td>
                        <Td className="text-right text-[#7a6a5f]">{t.qty}</Td>
                        <Td className="text-right text-[#7a6a5f]">{fmtMoney(it.amount, ccy)}</Td>
                        <Td className="text-right text-[#7a6a5f]">{asNum(it.vat_rate)}%</Td>
                        <Td className="text-right font-semibold">
                          {fmtMoney(it.line_total || t.line_total, ccy)}
                        </Td>
                      </Tr>
                    );
                  }) : (
                    <Tr><Td colSpan={5} className="py-8 text-center text-[#9a8c7e]">No line items on this invoice.</Td></Tr>
                  )}
                </tbody>
              </Table>
            )}

            <div className="flex justify-end border-t border-[#e6e0d6] px-5 py-3">
              <div className="w-full max-w-[240px] space-y-1.5 text-[13px]">
                {editing ? (
                  <div className="flex justify-between">
                    <span className="text-[#9a8c7e]">Net</span>
                    <span className="font-medium">{fmtMoney(computedNet, ccy)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-[#9a8c7e]">Subtotal</span>
                      <span className="font-medium">{fmtMoney(inv?._raw?.meta?.subtotal, ccy)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#9a8c7e]">VAT</span>
                      <span className="font-medium">{fmtMoney(inv?._raw?.meta?.tax_total, ccy)}</span>
                    </div>
                  </>
                )}
                <div className="flex items-baseline justify-between border-t border-[#f0ebe2] pt-1.5">
                  <span className="text-[12px] font-semibold uppercase tracking-wider text-[#9a8c7e]">Total</span>
                  <span className="font-serif text-[19px] text-[#2a211a]">{fmtMoney(computedTotal, ccy)}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* payments */}
          <Card padded={false}>
            <div className="px-5 pt-5">
              <CardHeader
                title="Payments"
                description={payments.length
                  ? `${payments.length} payment${payments.length === 1 ? "" : "s"} totalling ${fmtMoney(inv.amountPaid, ccy)}`
                  : "Nothing has been collected against this invoice yet."}
              />
            </div>
            {payments.length ? (
              <Table>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Method</Th>
                    <Th>Reference</Th>
                    <Th className="text-right">Amount</Th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p, i) => (
                    <Tr key={p.id ?? i}>
                      <Td className="whitespace-nowrap text-[#7a6a5f]">{fmtDate(p.processed_at)}</Td>
                      <Td className="text-[#7a6a5f]">{String(p.method || "—").replace(/_/g, " ")}</Td>
                      <Td className="text-[11.5px] text-[#9a8c7e]">{p.reference || "—"}</Td>
                      <Td className="whitespace-nowrap text-right font-semibold">
                        {fmtMoney(p.amount, p.currency || ccy)}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            ) : <div className="px-5 pb-5" />}
          </Card>
        </div>

        {/* sidebar */}
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Bill to"
              actions={editing ? <Badge variant="warning">Editing</Badge> : null}
            />
            {editing ? (
              <div className="space-y-3">
                <Field label="Name">
                  <Input value={edit.customer?.name || ""} onChange={(e) => patchCustomer({ name: e.target.value })} />
                </Field>
                <Field label="Business name">
                  <Input value={edit.customer?.business_name || ""} onChange={(e) => patchCustomer({ business_name: e.target.value })} />
                </Field>
                <Field label="Email">
                  <Input type="email" value={edit.customer?.email || ""} onChange={(e) => patchCustomer({ email: e.target.value })} />
                </Field>
                <Field label="Phone">
                  <Input value={edit.customer?.phone || ""} onChange={(e) => patchCustomer({ phone: e.target.value })} />
                </Field>
                <Field label="VAT / Tax ID">
                  <Input value={edit.customer?.tax_id || ""} onChange={(e) => patchCustomer({ tax_id: e.target.value })} />
                </Field>
                <Field label="Address">
                  <Input value={edit.customer?.address?.line1 || ""} onChange={(e) => patchAddress({ line1: e.target.value })} placeholder="Street and number" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="City">
                    <Input value={edit.customer?.address?.city || ""} onChange={(e) => patchAddress({ city: e.target.value })} />
                  </Field>
                  <Field label="Postal code">
                    <Input value={edit.customer?.address?.postal_code || ""} onChange={(e) => patchAddress({ postal_code: e.target.value })} />
                  </Field>
                </div>
                <Field label="Country">
                  <Input value={edit.customer?.address?.country || ""} onChange={(e) => patchAddress({ country: e.target.value })} />
                </Field>
              </div>
            ) : (
              <dl className="space-y-2.5 text-[13px]">
                <InfoRow label="Name" value={inv.customer?.business_name || inv.customer?.name} />
                {inv.customer?.business_name && inv.customer?.name ? (
                  <InfoRow label="Contact" value={inv.customer.name} />
                ) : null}
                <InfoRow label="Email" value={inv.customer?.email} />
                <InfoRow label="Phone" value={inv.customer?.phone} />
                <InfoRow label="VAT" value={inv.customer?.tax_id} />
                <InfoRow
                  label="Address"
                  value={[
                    inv.customer?.address?.line1,
                    inv.customer?.address?.line2,
                    [inv.customer?.address?.postal_code, inv.customer?.address?.city].filter(Boolean).join(" "),
                    inv.customer?.address?.country,
                  ].filter(Boolean).join(", ")}
                />
              </dl>
            )}
          </Card>

          <Card>
            <CardHeader title="Invoice" />
            {editing ? (
              <div className="space-y-3">
                <Field label="Status">
                  <Select value={edit.status} onChange={(e) => setEdit((s) => ({ ...s, status: e.target.value }))}>
                    {Array.from(
                      new Set(["draft", "sent", "finalized", "pending", "confirmed", edit.status].filter(Boolean))
                    ).map((s) => (
                      <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Due date">
                  <Input type="date" value={edit.due_date || ""} onChange={(e) => setEdit((s) => ({ ...s, due_date: e.target.value }))} />
                </Field>
                <Field label="Notes">
                  <textarea
                    value={edit.memo}
                    onChange={(e) => setEdit((s) => ({ ...s, memo: e.target.value }))}
                    rows={3}
                    className={`${inputClass} h-auto py-2 leading-relaxed`}
                  />
                </Field>
              </div>
            ) : (
              <dl className="space-y-2.5 text-[13px]">
                <InfoRow label="Number" value={inv.number} />
                <InfoRow label="Status" value={String(inv.status || "").replace(/_/g, " ")} />
                <InfoRow label="Issued" value={fmtDate(inv?._raw?.meta?.issue_date || inv?._raw?.createdAt)} />
                <InfoRow label="Due" value={fmtDate(inv?._raw?.meta?.due_date || inv?._raw?.due_date)} />
                <InfoRow label="Currency" value={ccy} />
                {inv.memo ? <InfoRow label="Notes" value={inv.memo} /> : null}
              </dl>
            )}
          </Card>

          {editing ? (
            <div className="space-y-2">
              <Button variant="primary" className="w-full" onClick={saveDbInvoice} disabled={acting === "save" || !dirty}>
                {acting === "save" ? "Saving…" : dirty ? "Save changes" : "No changes to save"}
              </Button>
              <Button variant="ghost" className="w-full" onClick={discardEdits} disabled={acting === "save"}>
                Cancel
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {/* ---------------------------- record payment ---------------------------- */}
      {payOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPayOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-t-3xl border border-[#e6e0d6] bg-white p-6 shadow-2xl sm:rounded-3xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-serif text-[19px] text-[#2a211a]">Record payment</h2>
                <p className="mt-0.5 text-[12px] text-[#9a8c7e]">{inv.number}</p>
              </div>
              <button onClick={() => setPayOpen(false)} aria-label="Close" className="rounded-lg p-1.5 text-[#9a8c7e] hover:bg-[#f2ede4]">
                <Icon name="x" size={18} />
              </button>
            </div>

            <div className="mb-4 rounded-xl border border-[#e6e0d6] bg-[#fdfbf7] px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9a8c7e]">Outstanding</p>
              <p className="mt-0.5 font-serif text-[20px] text-[#2a211a]">{fmtMoney(outstanding, ccy)}</p>
            </div>

            <Field label="Method">
              <Select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                {PAY_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </Select>
            </Field>
            <Field label={`Amount (${ccy})`} className="mt-3">
              <Input type="number" min="0" step="0.01" max={outstanding.toFixed(2)}
                value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            </Field>
            <div className="mt-2 flex gap-2">
              {[["Half", 0.5], ["Full", 1]].map(([label, f]) => (
                <button key={label} onClick={() => setPayAmount((outstanding * f).toFixed(2))}
                  className="rounded-full bg-[#f2ede4] px-3 py-1 text-[12px] font-medium text-[#6b5c4d] hover:bg-[#e8e0d3]">
                  {label}
                </button>
              ))}
            </div>
            <Field label="Reference (optional)" className="mt-3">
              <Input value={payReference} onChange={(e) => setPayReference(e.target.value)} placeholder="Receipt or transaction id" />
            </Field>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPayOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={submitPayment} disabled={acting === "mark"}>
                {acting === "mark" ? "Saving…" : `Record ${fmtMoney(Number(payAmount) || 0, ccy)}`}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </Page>
  );
}

/* ------------------------------- small parts ------------------------------ */

function MoneyCard({ label, value, accent }) {
  return (
    <Card className="py-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9a8c7e]">{label}</p>
      <p className={`mt-1 font-serif text-[20px] ${accent === "warn" ? "text-[#8a6412]" : "text-[#2a211a]"}`}>
        {value}
      </p>
    </Card>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-[#9a8c7e]">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium text-[#2a211a]">
        {value || <span className="text-[#b0a294]">—</span>}
      </dd>
    </div>
  );
}
