"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
const COUNTRIES = [
  { code: "GR", name: "Greece" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "NL", name: "Netherlands" },
  { code: "BE", name: "Belgium" },
  { code: "PT", name: "Portugal" },
  { code: "IE", name: "Ireland" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
];

const TAX_ID_TYPES = [
  { value: "eu_vat", label: "EU VAT" },
  { value: "gb_vat", label: "UK VAT" },
  { value: "us_ein", label: "US EIN" },
  { value: "au_abn", label: "AU ABN" },
  { value: "nz_gst", label: "NZ GST" },
];

export default function NewInvoicePage() {
  // ----- Billing party -----
  const [customerType, setCustomerType] = useState("individual"); // "individual" | "business"
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerName, setCustomerName] = useState(""); // person name or contact
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [taxId, setTaxId] = useState("");
  const [taxIdType, setTaxIdType] = useState("eu_vat");

  const [address, setAddress] = useState({
    line1: "",
    line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "GR",
  });

  // ----- Invoice core -----
  const [currency, setCurrency] = useState("eur");
  const [collectionMethod, setCollectionMethod] = useState("send_invoice");
  const [daysUntilDue, setDaysUntilDue] = useState(7);
  const [memo, setMemo] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("due"); // "due" | "paid"

  const [items, setItems] = useState([
    { description: "", amount: "", quantity: 1 },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(null);

  // -------- helpers --------
  const addItem = () =>
    setItems((s) => [...s, { description: "", amount: "", quantity: 1 }]);
  const removeItem = (i) => setItems((s) => s.filter((_, idx) => idx !== i));
  const updateItem = (i, patch) =>
    setItems((s) =>
      s.map((row, idx) => (idx === i ? { ...row, ...patch } : row))
    );
  const updateAddr = (patch) => setAddress((a) => ({ ...a, ...patch }));

  const total = useMemo(
    () =>
      items.reduce((sum, it) => {
        const amt = parseFloat(it.amount || "0");
        const qty = parseInt(it.quantity || "1", 10) || 1;
        return sum + (isNaN(amt) ? 0 : amt) * qty;
      }, 0),
    [items]
  );

  async function markPaidNow(invoiceId, note = "Recorded offline payment") {
    if (!invoiceId) return;
    const res = await fetch(`/api/admin/invoices/${invoiceId}/mark-paid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Failed to mark as paid");
    setCreated((c) => ({ ...c, ...data })); // status => "paid"
    return data;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setCreated(null);

    try {
      const payload = {
        // extended customer payload
        customer: {
          type: customerType,
          email: customerEmail.trim(),
          name:
            customerType === "business"
              ? (businessName || customerName || "").trim()
              : (customerName || "").trim(),
          business_name:
            customerType === "business" ? businessName.trim() : undefined,
          phone: phone.trim() || undefined,
          address: {
            line1: address.line1 || undefined,
            line2: address.line2 || undefined,
            city: address.city || undefined,
            state: address.state || undefined,
            postal_code: address.postal_code || undefined,
            country: address.country || undefined,
          },
          tax_id: taxId.trim() || undefined,
          tax_id_type: taxId ? taxIdType : undefined,
        },

        currency,
        collection_method: collectionMethod,
        days_until_due:
          collectionMethod === "send_invoice"
            ? Number(daysUntilDue) || 7
            : undefined,
        memo,

        items: items
          .filter((i) => i.description && i.amount)
          .map((i) => ({
            description: i.description,
            amount: Number(i.amount),
            quantity: Number(i.quantity || 1),
          })),
      };

      const res = await fetch("/api/admin/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create invoice");
      setCreated(data);

      // If already paid, immediately mark invoice as paid offline
      if (paymentStatus === "paid" && data?.id) {
        try {
          await markPaidNow(data.id, "Created as paid (offline)");
        } catch (e) {
          alert(e.message);
        }
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function sendInvoiceNow() {
    if (!created?.id) return;
    try {
      const res = await fetch(`/api/admin/invoices/${created.id}/send`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to send invoice");
      setCreated((c) => ({ ...c, ...data }));
      alert("Invoice sent via Stripe.");
    } catch (e) {
      alert(e.message);
    }
  }

  const actionDisabled =
    submitting || items.every((i) => !i.description || !i.amount);

  return (
    <div className="px-8 w-full">
      <div
        className="py-4"
        style={{
          paddingLeft: "max(env(safe-area-inset-left),0px)",
          paddingRight: "max(env(safe-area-inset-right),0px)",
        }}
      >
        <h1 className="text-2xl font-semibold tracking-tight">
          Create Invoice
        </h1>
        <p className="text-sm text-neutral-600">
          Fill in billing details, add line items, and generate a Stripe
          invoice.
        </p>
      </div>
      <div className="flex right-3 px-4 mb-6">
        <Link
          href="/admin"
          aria-label="Back to dashboard"
          className="inline-flex items-center gap-2 rounded-xl border border-[#e8e5df] bg-white px-3 py-2 text-sm text-[#5a4a3f] hover:bg-[#fcf9f4] shadow-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back to dashboard</span>
        </Link>
      </div>
      <form
        onSubmit={handleSubmit}
        className="pb-24 space-y-8"
        style={{
          paddingLeft: "max(env(safe-area-inset-left),0px)",
          paddingRight: "max(env(safe-area-inset-right),0px)",
        }}
      >
        {/* ---------- Bill To ---------- */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Bill To</h2>
            {/* Payment status pill */}
            <div className="inline-flex rounded-lg border border-neutral-300 bg-white p-1 text-sm">
              <button
                type="button"
                onClick={() => setPaymentStatus("due")}
                className={`px-3 py-1.5 rounded-md ${
                  paymentStatus === "due" ? "bg-neutral-100 font-medium" : ""
                }`}
              >
                Due
              </button>
              <button
                type="button"
                onClick={() => setPaymentStatus("paid")}
                className={`px-3 py-1.5 rounded-md ${
                  paymentStatus === "paid" ? "bg-neutral-100 font-medium" : ""
                }`}
                title="Invoice will be created and immediately marked as paid (offline)"
              >
                Already paid
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="ctype"
                checked={customerType === "individual"}
                onChange={() => setCustomerType("individual")}
              />
              Individual
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="ctype"
                checked={customerType === "business"}
                onChange={() => setCustomerType("business")}
              />
              Business
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium">Email *</span>
              <input
                required
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-neutral-400"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">
                {customerType === "business" ? "Contact Name" : "Full Name"}
              </span>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-neutral-400"
              />
            </label>

            {customerType === "business" && (
              <label className="block sm:col-span-2">
                <span className="text-sm font-medium">Business Name *</span>
                <input
                  required
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2"
                />
              </label>
            )}

            <label className="block">
              <span className="text-sm font-medium">Phone</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
              <label className="block">
                <span className="text-sm font-medium">Tax ID</span>
                <input
                  type="text"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  placeholder={
                    customerType === "business" ? "e.g. EL123456789" : ""
                  }
                  className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Tax ID Type</span>
                <select
                  value={taxIdType}
                  onChange={(e) => setTaxIdType(e.target.value)}
                  className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2"
                >
                  {TAX_ID_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {/* Address */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium">Address Line 1</span>
              <input
                type="text"
                value={address.line1}
                onChange={(e) => updateAddr({ line1: e.target.value })}
                className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium">Address Line 2</span>
              <input
                type="text"
                value={address.line2}
                onChange={(e) => updateAddr({ line2: e.target.value })}
                className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">City</span>
              <input
                type="text"
                value={address.city}
                onChange={(e) => updateAddr({ city: e.target.value })}
                className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">State / Region</span>
              <input
                type="text"
                value={address.state}
                onChange={(e) => updateAddr({ state: e.target.value })}
                className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Postal Code</span>
              <input
                type="text"
                value={address.postal_code}
                onChange={(e) => updateAddr({ postal_code: e.target.value })}
                className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Country</span>
              <select
                value={address.country}
                onChange={(e) => updateAddr({ country: e.target.value })}
                className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {/* ---------- Invoice details ---------- */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Invoice</h2>
            {paymentStatus === "paid" && (
              <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 text-xs">
                Will be recorded as paid (offline)
              </span>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium">Currency</span>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2"
              >
                <option value="eur">EUR</option>
                <option value="usd">USD</option>
                <option value="gbp">GBP</option>
              </select>
            </label>

            <div className="block">
              <span className="text-sm font-medium">Collection Method</span>
              <div className="mt-2 flex items-center gap-4">
                <label
                  className={`inline-flex items-center gap-2 ${
                    paymentStatus === "paid" ? "opacity-50" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="cm"
                    checked={collectionMethod === "send_invoice"}
                    onChange={() => setCollectionMethod("send_invoice")}
                    disabled={paymentStatus === "paid"}
                  />
                  <span className="text-sm">Send invoice (email)</span>
                </label>
                <label
                  className={`inline-flex items-center gap-2 ${
                    paymentStatus === "paid" ? "opacity-50" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="cm"
                    checked={collectionMethod === "charge_automatically"}
                    onChange={() => setCollectionMethod("charge_automatically")}
                    disabled={paymentStatus === "paid"}
                  />
                  <span className="text-sm">Charge automatically</span>
                </label>
              </div>
            </div>

            {collectionMethod === "send_invoice" &&
              paymentStatus !== "paid" && (
                <label className="block">
                  <span className="text-sm font-medium">Days Until Due</span>
                  <input
                    type="number"
                    min={1}
                    value={daysUntilDue}
                    onChange={(e) => setDaysUntilDue(e.target.value)}
                    className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2"
                  />
                </label>
              )}

            <label className="sm:col-span-2 block">
              <span className="text-sm font-medium">Memo / Notes</span>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2"
              />
            </label>
          </div>
        </section>

        {/* ---------- Line items ---------- */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Line Items</h2>
            <button
              type="button"
              onClick={addItem}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
            >
              + Add item
            </button>
          </div>

          <div className="space-y-3">
            {items.map((it, idx) => (
              <div
                key={idx}
                className="grid gap-3 sm:grid-cols-[1fr_130px_110px_auto]"
              >
                <input
                  placeholder="Description"
                  value={it.description}
                  onChange={(e) =>
                    updateItem(idx, { description: e.target.value })
                  }
                  className="rounded-md border border-neutral-300 bg-white px-3 py-2"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Amount"
                  value={it.amount}
                  onChange={(e) => updateItem(idx, { amount: e.target.value })}
                  className="rounded-md border border-neutral-300 bg-white px-3 py-2"
                />
                <input
                  type="number"
                  min="1"
                  placeholder="Qty"
                  value={it.quantity}
                  onChange={(e) =>
                    updateItem(idx, { quantity: e.target.value })
                  }
                  className="rounded-md border border-neutral-300 bg-white px-3 py-2"
                />
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  className="justify-self-start rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm hover:bg-neutral-50"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-neutral-200">
            <span className="text-sm text-neutral-600">Total (preview)</span>
            <span className="text-lg font-semibold">
              {currency.toUpperCase()} {total.toFixed(2)}
            </span>
          </div>
        </section>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={actionDisabled}
            className="rounded-xl bg-[#6f5a3a] px-4 py-2 text-white hover:opacity-95 disabled:opacity-50"
            title={
              actionDisabled
                ? "Add at least one line item with amount"
                : "Create invoice"
            }
          >
            {submitting
              ? "Creating…"
              : paymentStatus === "paid"
              ? "Create & Mark Paid"
              : "Create invoice"}
          </button>

          {created?.id && (
            <>
              {created?.hosted_invoice_url && (
                <a
                  href={created.hosted_invoice_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-neutral-300 bg-white px-4 py-2 hover:bg-neutral-50"
                >
                  Open invoice
                </a>
              )}
              {created?.invoice_pdf && (
                <a
                  href={created.invoice_pdf}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-neutral-300 bg-white px-4 py-2 hover:bg-neutral-50"
                >
                  Download PDF
                </a>
              )}
              {/* Only show send when it's not already paid */}
              {created?.collection_method === "send_invoice" &&
                created?.status !== "paid" && (
                  <button
                    type="button"
                    onClick={sendInvoiceNow}
                    className="rounded-xl border border-neutral-300 bg-white px-4 py-2 hover:bg-neutral-50"
                  >
                    Send via Stripe
                  </button>
                )}
            </>
          )}
        </div>

        {/* Manual mark as paid if you created as due */}
        {created?.id && created?.status !== "paid" && (
          <button
            type="button"
            onClick={() => markPaidNow(created.id)}
            className="rounded-xl border border-neutral-300 bg-white px-4 py-2 hover:bg-neutral-50"
            title="Record an offline payment (cash/bank transfer)"
          >
            Mark as Paid (offline)
          </button>
        )}

        {created?.number && (
          <p className="text-sm text-neutral-600">
            Invoice <span className="font-medium">{created.number}</span> —{" "}
            {created.status}
          </p>
        )}
      </form>
    </div>
  );
}
