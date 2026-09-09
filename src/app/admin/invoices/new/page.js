"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  inputClass,
} from "../../_ui";

/**
 * /admin/invoices/new — create a first-party invoice.
 *
 * POST /api/admin/invoices2
 *   { series, currency, issue_date, due_date, buyer, lines[], notes, finalize }
 *   -> { id, number, series, status, totals }
 * then optionally POST /{id}/mark-paid { method, amount, notes }
 *  and optionally POST /{id}/send
 */

const COUNTRIES = [
  { code: "GR", name: "Greece" }, { code: "DE", name: "Germany" },
  { code: "FR", name: "France" }, { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" }, { code: "NL", name: "Netherlands" },
  { code: "BE", name: "Belgium" }, { code: "PT", name: "Portugal" },
  { code: "IE", name: "Ireland" }, { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
];

const PAYMENT_METHODS = [
  { key: "cash", label: "Cash" }, { key: "card", label: "Card" },
  { key: "bank_transfer", label: "Bank transfer" }, { key: "gift_card", label: "Gift card" },
  { key: "voucher", label: "Voucher" }, { key: "other", label: "Other" },
];

const VAT_PRESETS = [0, 6, 13, 24];
const CURRENCIES = ["EUR", "USD", "GBP"];

const num = (v) => (v === "" || v == null ? 0 : Number(v) || 0);
const toGross = (net, vat) => num(net) * (1 + num(vat) / 100);
const toNet = (gross, vat) => {
  const r = 1 + num(vat) / 100;
  return r === 0 ? 0 : num(gross) / r;
};
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());
const upper = (s) => String(s || "").trim().toUpperCase();
const addDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

const blankItem = () => ({
  description: "",
  unit_price: "",
  unit_price_gross: "",
  quantity: 1,
  vat_rate: 24,
  lastEdited: "net",
});

function fmt(n, ccy = "EUR") {
  try {
    return new Intl.NumberFormat("en-IE", { style: "currency", currency: ccy }).format(Number(n) || 0);
  } catch {
    return `${ccy} ${(Number(n) || 0).toFixed(2)}`;
  }
}

/* --------------------------------- page ---------------------------------- */

export default function NewInvoicePage() {
  const router = useRouter();

  const [customerType, setCustomerType] = useState("individual");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [taxId, setTaxId] = useState("");
  const [address, setAddress] = useState({
    line1: "", line2: "", city: "", state: "", postal_code: "", country: "GR",
  });

  const [series, setSeries] = useState("A");
  const [currency, setCurrency] = useState("EUR");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const [finalizeNow, setFinalizeNow] = useState(true);
  const [sendAfterCreate, setSendAfterCreate] = useState(false);
  const [recordPayment, setRecordPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentNotes, setPaymentNotes] = useState("");

  const [items, setItems] = useState([blankItem()]);
  const [priceMode, setPriceMode] = useState("net"); // which column to edit

  const [submitting, setSubmitting] = useState(false);
  const [sending, setSending] = useState(false);
  const [created, setCreated] = useState(null);
  const [formError, setFormError] = useState("");

  /* ------------------------------ line items ------------------------------ */

  const addItem = () => setItems((s) => [...s, blankItem()]);
  const removeItem = (i) => setItems((s) => (s.length === 1 ? s : s.filter((_, idx) => idx !== i)));

  const updateItem = (i, patch) =>
    setItems((s) =>
      s.map((row, idx) => {
        if (idx !== i) return row;
        const next = { ...row, ...patch };
        const vat = num(next.vat_rate);

        if ("unit_price_gross" in patch) {
          next.lastEdited = "gross";
          const net = toNet(next.unit_price_gross, vat);
          next.unit_price = Number.isFinite(net) ? net.toFixed(2) : "";
        }
        if ("unit_price" in patch) {
          next.lastEdited = "net";
          const gross = toGross(next.unit_price, vat);
          next.unit_price_gross = Number.isFinite(gross) ? gross.toFixed(2) : "";
        }
        if ("vat_rate" in patch) {
          if (next.lastEdited === "gross") {
            const net = toNet(next.unit_price_gross, vat);
            next.unit_price = Number.isFinite(net) ? net.toFixed(2) : next.unit_price;
          } else {
            const gross = toGross(next.unit_price, vat);
            next.unit_price_gross = Number.isFinite(gross) ? gross.toFixed(2) : next.unit_price_gross;
          }
        }
        return next;
      })
    );

  const lineTotals = (it) => {
    const qty = Math.max(1, num(it.quantity));
    const base = Math.max(0, qty * num(it.unit_price));
    const tax = base * (num(it.vat_rate) / 100);
    return { base, tax, total: base + tax };
  };

  const preview = useMemo(() => {
    let subtotal = 0, tax = 0;
    for (const it of items) {
      const t = lineTotals(it);
      subtotal += t.base;
      tax += t.tax;
    }
    return { subtotal, tax, total: subtotal + tax };
  }, [items]);

  useEffect(() => {
    if (recordPayment) {
      setPaymentAmount((prev) => (prev ? prev : Number(preview.total.toFixed(2))));
    }
  }, [recordPayment, preview.total]);

  /* ------------------------------ validation ------------------------------ */

  const validLines = items.filter((i) => i.description.trim() && num(i.unit_price) > 0);
  const problems = useMemo(() => {
    const out = [];
    if (!customerEmail.trim()) out.push("Add the customer's email address.");
    else if (!isEmail(customerEmail)) out.push("That email address doesn't look valid.");
    if (customerType === "business" && !businessName.trim())
      out.push("Business invoices need a business name.");
    if (!validLines.length) out.push("Add at least one line with a description and a price.");
    if (dueDate && issueDate && dueDate < issueDate) out.push("The due date is before the issue date.");
    if (recordPayment && !(num(paymentAmount) > 0)) out.push("The payment amount must be greater than zero.");
    return out;
  }, [customerEmail, customerType, businessName, validLines.length, dueDate, issueDate, recordPayment, paymentAmount]);

  const canSubmit = problems.length === 0 && !submitting;

  /* -------------------------------- submit -------------------------------- */

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    if (problems.length) {
      setFormError(problems[0]);
      return;
    }

    setSubmitting(true);
    try {
      const buyer = {
        name: customerName.trim() || undefined,
        business_name: customerType === "business" ? businessName.trim() : undefined,
        email: customerEmail.trim(),
        phone: phone.trim() || undefined,
        vat: taxId.trim() || undefined,
        address: {
          line1: address.line1 || undefined,
          line2: address.line2 || undefined,
          city: address.city || undefined,
          state: address.state || undefined,
          postal_code: address.postal_code || undefined,
          country: address.country || undefined,
        },
      };

      const lines = validLines.map((i) => ({
        description: i.description.trim(),
        unit_price: num(i.unit_price),
        quantity: Math.max(1, num(i.quantity)),
        vat_rate: Math.max(0, num(i.vat_rate)),
      }));

      const payload = {
        series: upper(series || "A"),
        currency: upper(currency || "EUR"),
        issue_date: issueDate ? new Date(`${issueDate}T12:00:00`).toISOString() : undefined,
        due_date: dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : undefined,
        buyer,
        lines,
        notes,
        finalize: Boolean(finalizeNow),
      };

      const res = await fetch("/api/admin/invoices2", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Failed to create invoice (${res.status})`);
      if (!data?.id) throw new Error("The invoice was created but the server returned no id.");

      setCreated(data);
      toast.success("Invoice created.");

      if (recordPayment && finalizeNow) {
        const amt = num(paymentAmount);
        const payRes = await fetch(`/api/admin/invoices2/${data.id}/mark-paid`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          credentials: "include",
          body: JSON.stringify({ method: paymentMethod, amount: amt, notes: paymentNotes || undefined }),
        });
        if (payRes.ok) toast.success(`Recorded ${fmt(amt, upper(currency))}.`);
        else {
          const j = await payRes.json().catch(() => ({}));
          toast.error(j?.error || "Invoice created, but the payment could not be recorded.");
        }
      }

      if (sendAfterCreate && finalizeNow) {
        const sendRes = await fetch(`/api/admin/invoices2/${data.id}/send`, {
          method: "POST",
          headers: { Accept: "application/json" },
          credentials: "include",
        });
        if (sendRes.ok) toast.success("Invoice emailed to the customer.");
        else toast.error("Invoice created, but the email could not be sent.");
      }
    } catch (err) {
      setFormError(err?.message || String(err));
      toast.error(err?.message || "Could not create the invoice.");
    } finally {
      setSubmitting(false);
    }
  }

  async function sendInvoiceNow() {
    if (!created?.id || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/invoices2/${created.id}/send`, {
        method: "POST",
        headers: { Accept: "application/json" },
        credentials: "include",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || `Failed to send (${res.status})`);
      toast.success(j?.message || "Invoice sent.");
    } catch (e) {
      toast.error(e?.message || "Could not send the invoice.");
    } finally {
      setSending(false);
    }
  }

  function startAnother() {
    setCreated(null);
    setFormError("");
    setItems([blankItem()]);
    setCustomerEmail(""); setCustomerName(""); setBusinessName("");
    setPhone(""); setTaxId(""); setNotes("");
    setDueDate(""); setRecordPayment(false); setPaymentAmount(0); setPaymentNotes("");
    setSendAfterCreate(false);
  }

  const ccy = upper(currency || "EUR");

  /* ------------------------------ success view ----------------------------- */

  if (created) {
    const label = created.series && created.number
      ? `${created.series}-${String(created.number).padStart(5, "0")}`
      : `#${created.id}`;
    return (
      <Page>
        <PageHeader eyebrow="Revenue" title="Invoice created" description={`${label} is ready.`} />
        <Card className="max-w-2xl">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e9f2e9] text-[#3f6b3f]">
              <Icon name="check" size={20} />
            </span>
            <div>
              <p className="font-serif text-[18px] text-[#2a211a]">{label}</p>
              <Muted className="text-[12.5px]">
                {fmt(created?.totals?.total ?? preview.total, ccy)} · {created.status || "draft"}
              </Muted>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button as="a" href={`/api/admin/invoices2/${created.id}/pdf`} target="_blank" rel="noreferrer" variant="secondary">
              <Icon name="file" size={15} /> Open PDF
            </Button>
            <Button as="a" href={`/api/admin/invoices2/${created.id}/download`} variant="secondary">
              <Icon name="download" size={15} /> Download
            </Button>
            <Button variant="secondary" onClick={sendInvoiceNow} disabled={sending}>
              <Icon name="mail" size={15} /> {sending ? "Sending…" : "Email to customer"}
            </Button>
            <Button as={Link} href={`/admin/invoices/${created.id}`} variant="primary">
              Open invoice
            </Button>
          </div>

          <div className="mt-6 flex flex-wrap gap-2 border-t border-[#f0ebe2] pt-5">
            <Button variant="ghost" onClick={startAnother}>
              <Icon name="plus" size={15} /> Create another
            </Button>
            <Button variant="ghost" onClick={() => router.push("/admin/invoices")}>
              Back to invoices
            </Button>
          </div>
        </Card>
      </Page>
    );
  }

  /* -------------------------------- form ---------------------------------- */

  return (
    <Page>
      <PageHeader
        eyebrow={
          <Link href="/admin/invoices" className="hover:underline">Invoices</Link>
        }
        title="New invoice"
        description="Issue a first-party invoice and optionally record payment straight away."
        actions={
          <Button as={Link} href="/admin/invoices" variant="ghost">Cancel</Button>
        }
      />

      <form onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="space-y-5">
          {/* customer */}
          <Card>
            <CardHeader title="Bill to" description="Who this invoice is addressed to." />

            <div className="mb-4 inline-flex rounded-xl border border-[#e6e0d6] bg-[#fdfbf7] p-1">
              {[
                ["individual", "Individual"],
                ["business", "Business"],
              ].map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setCustomerType(v)}
                  className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                    customerType === v ? "bg-[#2a211a] text-white" : "text-[#6b5c4d] hover:bg-[#f2ede4]"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {customerType === "business" ? (
                <Field label="Business name" className="sm:col-span-2">
                  <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Acme A.E." />
                </Field>
              ) : null}

              <Field label={customerType === "business" ? "Contact name" : "Full name"}>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Maria Papadaki" />
              </Field>

              <Field
                label="Email"
                error={customerEmail && !isEmail(customerEmail) ? "Enter a valid email address." : null}
              >
                <Input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="guest@example.com"
                />
              </Field>

              <Field label="Phone">
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+30 …" />
              </Field>

              <Field label="VAT / Tax ID">
                <Input value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="EL123456789" />
              </Field>

              <Field label="Address" className="sm:col-span-2">
                <Input
                  value={address.line1}
                  onChange={(e) => setAddress((a) => ({ ...a, line1: e.target.value }))}
                  placeholder="Street and number"
                />
              </Field>
              <Field label="Address line 2" className="sm:col-span-2">
                <Input
                  value={address.line2}
                  onChange={(e) => setAddress((a) => ({ ...a, line2: e.target.value }))}
                  placeholder="Apartment, suite (optional)"
                />
              </Field>
              <Field label="City">
                <Input value={address.city} onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))} />
              </Field>
              <Field label="Postal code">
                <Input
                  value={address.postal_code}
                  onChange={(e) => setAddress((a) => ({ ...a, postal_code: e.target.value }))}
                />
              </Field>
              <Field label="Region / State">
                <Input value={address.state} onChange={(e) => setAddress((a) => ({ ...a, state: e.target.value }))} />
              </Field>
              <Field label="Country">
                <Select
                  value={address.country}
                  onChange={(e) => setAddress((a) => ({ ...a, country: e.target.value }))}
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </Card>

          {/* line items */}
          <Card>
            <CardHeader
              title="Line items"
              description="Prices sync both ways — type either the net or the gross figure."
              actions={
                <div className="inline-flex rounded-lg border border-[#e6e0d6] bg-[#fdfbf7] p-0.5">
                  {[
                    ["net", "Enter net"],
                    ["gross", "Enter gross"],
                  ].map(([v, l]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setPriceMode(v)}
                      className={`rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${
                        priceMode === v ? "bg-[#2a211a] text-white" : "text-[#6b5c4d] hover:bg-[#f2ede4]"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              }
            />

            <div className="space-y-3">
              {items.map((it, i) => {
                const t = lineTotals(it);
                return (
                  <div key={i} className="rounded-2xl border border-[#e6e0d6] bg-[#fdfbf7] p-3">
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <input
                          value={it.description}
                          onChange={(e) => updateItem(i, { description: e.target.value })}
                          placeholder={`Item ${i + 1} — e.g. Olive grove tasting, 2 guests`}
                          className={`${inputClass} bg-white`}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(i)}
                        disabled={items.length === 1}
                        aria-label="Remove line"
                        title={items.length === 1 ? "An invoice needs at least one line" : "Remove line"}
                        className="mt-0.5 rounded-lg p-2 text-[#9a8c7e] transition-colors hover:bg-[#fbeae5] hover:text-[#a33c22] disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <Field label="Qty">
                        <input
                          type="number" min="1" step="1"
                          value={it.quantity}
                          onChange={(e) => updateItem(i, { quantity: e.target.value })}
                          className={`${inputClass} bg-white`}
                        />
                      </Field>
                      <Field label={priceMode === "net" ? `Unit net (${ccy})` : `Unit gross (${ccy})`}>
                        <input
                          type="number" min="0" step="0.01"
                          value={priceMode === "net" ? it.unit_price : it.unit_price_gross}
                          onChange={(e) =>
                            updateItem(i, priceMode === "net"
                              ? { unit_price: e.target.value }
                              : { unit_price_gross: e.target.value })
                          }
                          className={`${inputClass} bg-white`}
                        />
                      </Field>
                      <Field label="VAT %">
                        <Select
                          value={String(it.vat_rate)}
                          onChange={(e) => updateItem(i, { vat_rate: e.target.value })}
                          className="bg-white"
                        >
                          {VAT_PRESETS.map((v) => (
                            <option key={v} value={v}>{v}%</option>
                          ))}
                        </Select>
                      </Field>
                      <div className="flex flex-col justify-end">
                        <span className="mb-1 block text-[11px] font-semibold text-[#6b5c4d]">Line total</span>
                        <div className="flex h-10 items-center justify-end rounded-xl border border-[#e6e0d6] bg-white px-3 text-[13px] font-semibold text-[#2a211a]">
                          {fmt(t.total, ccy)}
                        </div>
                      </div>
                    </div>

                    <p className="mt-1.5 text-[11px] text-[#9a8c7e]">
                      {priceMode === "net"
                        ? `Gross unit ${fmt(num(it.unit_price_gross), ccy)}`
                        : `Net unit ${fmt(num(it.unit_price), ccy)}`}
                      {" · "}net {fmt(t.base, ccy)} + VAT {fmt(t.tax, ccy)}
                    </p>
                  </div>
                );
              })}
            </div>

            <Button type="button" variant="secondary" className="mt-3" onClick={addItem}>
              <Icon name="plus" size={15} /> Add line
            </Button>
          </Card>

          {/* notes */}
          <Card>
            <CardHeader title="Notes" description="Shown on the invoice PDF." />
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Payment terms, booking reference, anything the customer should see."
              className={`${inputClass} h-auto py-2 leading-relaxed`}
            />
          </Card>
        </div>

        {/* sidebar */}
        <div className="space-y-5 lg:sticky lg:top-6">
          <Card>
            <CardHeader title="Invoice details" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Series">
                <Input value={series} onChange={(e) => setSeries(e.target.value)} maxLength={4} />
              </Field>
              <Field label="Currency">
                <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="Issue date">
                <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
              </Field>
              <Field label="Due date">
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </Field>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[["On receipt", ""], ["7 days", addDays(7)], ["14 days", addDays(14)], ["30 days", addDays(30)]].map(
                ([label, v]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setDueDate(v)}
                    className={`rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                      dueDate === v
                        ? "bg-[#2a211a] text-white"
                        : "bg-[#f2ede4] text-[#6b5c4d] hover:bg-[#e8e0d3]"
                    }`}
                  >
                    {label}
                  </button>
                )
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Summary" />
            <dl className="space-y-2 text-[13px]">
              <SummaryRow label="Subtotal" value={fmt(preview.subtotal, ccy)} />
              <SummaryRow label="VAT" value={fmt(preview.tax, ccy)} />
              <div className="border-t border-[#f0ebe2] pt-2">
                <div className="flex items-baseline justify-between">
                  <dt className="text-[12px] font-semibold uppercase tracking-wider text-[#9a8c7e]">Total</dt>
                  <dd className="font-serif text-[22px] text-[#2a211a]">{fmt(preview.total, ccy)}</dd>
                </div>
              </div>
            </dl>
            <Muted className="mt-2 text-[11.5px]">
              {validLines.length} of {items.length} line{items.length === 1 ? "" : "s"} will be saved.
            </Muted>
          </Card>

          <Card>
            <CardHeader title="On create" />
            <div className="space-y-2.5">
              <Toggle
                checked={finalizeNow}
                onChange={setFinalizeNow}
                label="Finalize immediately"
                hint="Drafts can still be edited; finalized invoices are numbered and issued."
              />
              <Toggle
                checked={sendAfterCreate}
                onChange={setSendAfterCreate}
                label="Email to the customer"
                disabled={!finalizeNow}
                hint={!finalizeNow ? "Only finalized invoices can be sent." : undefined}
              />
              <Toggle
                checked={recordPayment}
                onChange={setRecordPayment}
                label="Record a payment now"
                disabled={!finalizeNow}
                hint={!finalizeNow ? "Only finalized invoices can take a payment." : undefined}
              />
            </div>

            {recordPayment && finalizeNow ? (
              <div className="mt-3 space-y-3 rounded-2xl border border-[#e6e0d6] bg-[#fdfbf7] p-3">
                <Field label="Method">
                  <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="bg-white">
                    {PAYMENT_METHODS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </Select>
                </Field>
                <Field label={`Amount (${ccy})`}>
                  <input
                    type="number" min="0" step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className={`${inputClass} bg-white`}
                  />
                </Field>
                {num(paymentAmount) > 0 && num(paymentAmount) < preview.total ? (
                  <Badge variant="warning">
                    Partial — {fmt(preview.total - num(paymentAmount), ccy)} will stay outstanding
                  </Badge>
                ) : null}
                <Field label="Reference">
                  <input
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="Receipt or transaction id"
                    className={`${inputClass} bg-white`}
                  />
                </Field>
              </div>
            ) : null}
          </Card>

          {formError ? <ErrorNote>{formError}</ErrorNote> : null}

          {problems.length && !formError ? (
            <div className="rounded-2xl border border-[#f0e0bb] bg-[#fbf1dc] px-4 py-3">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#8a6412]">
                Before you can save
              </p>
              <ul className="list-inside list-disc space-y-0.5 text-[12.5px] text-[#8a6412]">
                {problems.map((p) => <li key={p}>{p}</li>)}
              </ul>
            </div>
          ) : null}

          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={!canSubmit}>
            {submitting ? "Creating…" : `Create invoice · ${fmt(preview.total, ccy)}`}
          </Button>
        </div>
      </form>
    </Page>
  );
}

/* ------------------------------- small parts ------------------------------ */

function SummaryRow({ label, value }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[#9a8c7e]">{label}</dt>
      <dd className="font-medium text-[#2a211a]">{value}</dd>
    </div>
  );
}

function Toggle({ checked, onChange, label, hint, disabled }) {
  return (
    <label className={`flex gap-2.5 ${disabled ? "opacity-50" : "cursor-pointer"}`}>
      <input
        type="checkbox"
        checked={checked && !disabled}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[#8b6f47] disabled:cursor-not-allowed"
      />
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-[#2a211a]">{label}</span>
        {hint ? <span className="block text-[11.5px] text-[#9a8c7e]">{hint}</span> : null}
      </span>
    </label>
  );
}
