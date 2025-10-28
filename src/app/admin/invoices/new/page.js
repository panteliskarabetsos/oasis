// FILE: app/admin/invoices/new/page.jsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Building2,
  User2,
  Mail,
  Phone as PhoneIcon,
  Hash,
  Globe,
  CalendarClock,
  FileText,
  CheckCircle2,
} from "lucide-react";

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
  const router = useRouter();

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

  const [items, setItems] = useState([{ description: "", amount: "", quantity: 1 }]);

  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(null);

  // -------- helpers --------
  const addItem = () =>
    setItems((s) => [...s, { description: "", amount: "", quantity: 1 }]);
  const removeItem = (i) => setItems((s) => s.filter((_, idx) => idx !== i));
  const updateItem = (i, patch) =>
    setItems((s) => s.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
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
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ note }),
    });
    const ct = res.headers.get("content-type") || "";
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Failed to mark as paid");
    }
    const data = ct.includes("application/json") ? await res.json() : {};
    setCreated((c) => ({ ...c, ...data })); // status => "paid"
    return data;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setCreated(null);

    try {
      const payload = {
        customer: {
          type: customerType,
          email: customerEmail.trim(),
          name:
            customerType === "business"
              ? (businessName || customerName || "").trim()
              : (customerName || "").trim(),
          business_name: customerType === "business" ? businessName.trim() : undefined,
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
          collectionMethod === "send_invoice" ? Number(daysUntilDue) || 7 : undefined,
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
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });

      const ct = res.headers.get("content-type") || "";
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to create invoice");
      }
      const data = ct.includes("application/json") ? await res.json() : null;
      if (!data || !data.id) throw new Error("Invalid API response: missing invoice id");

      setCreated(data);

      // If already paid, immediately mark invoice as paid offline
      if (paymentStatus === "paid") {
        try {
          await markPaidNow(data.id, "Created as paid (offline)");
        } catch (e) {
          alert(e.message);
        }
      }

      // ➜ Go to the invoice details page
      router.push(`/admin/invoices/${data.id}`);
      return;
    } catch (err) {
      alert(err.message || String(err));
    } finally {
      setSubmitting(false);
    }
  }

  // Keep this for the post-create quick action (if user stays on page for any reason)
  async function sendInvoiceNow() {
    if (!created?.id) return;
    try {
      const res = await fetch(`/api/admin/invoices/${created.id}/send`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const ct = res.headers.get("content-type") || "";
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to send invoice (status ${res.status}). ${text.slice(0, 160)}`);
      }
      const data = ct.includes("application/json") ? await res.json() : null;
      if (data) setCreated((c) => ({ ...c, ...data }));
      alert("Invoice sent via Stripe.");
    } catch (e) {
      alert(e.message || String(e));
    }
  }

  const actionDisabled = submitting || items.every((i) => !i.description || !i.amount);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fcf9f4] to-white">
      {/* Page header */}
      <div
        className="sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-white/60 bg-white/90 border-b border-[#e8e5df]"
        style={{
          paddingLeft: "max(env(safe-area-inset-left),0px)",
          paddingRight: "max(env(safe-area-inset-right),0px)",
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              aria-label="Back to dashboard"
              className="inline-flex items-center gap-2 rounded-xl border border-[#e8e5df] bg-white px-3 py-2 text-sm text-[#5a4a3f] hover:bg-[#fcf9f4] shadow-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#3f342b]">
                Create Invoice
              </h1>
              <p className="text-xs sm:text-sm text-neutral-600">
                Fill in billing details, add line items, and generate a Stripe invoice.
              </p>
            </div>
          </div>

          {/* Payment status segmented */}
          <div className="hidden md:inline-flex rounded-xl border border-neutral-300 bg-white p-1 text-sm shadow-sm">
            <button
              type="button"
              onClick={() => setPaymentStatus("due")}
              className={`px-3 py-1.5 rounded-lg transition ${
                paymentStatus === "due"
                  ? "bg-neutral-100 font-medium text-neutral-900"
                  : "text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              Due
            </button>
            <button
              type="button"
              onClick={() => setPaymentStatus("paid")}
              className={`px-3 py-1.5 rounded-lg transition ${
                paymentStatus === "paid"
                  ? "bg-emerald-50 font-medium text-emerald-700 ring-1 ring-emerald-200"
                  : "text-neutral-700 hover:bg-neutral-50"
              }`}
              title="Invoice will be created and immediately marked as paid (offline)"
            >
              Already paid
            </button>
          </div>
        </div>
      </div>

      {/* Content grid */}
      <form
        onSubmit={handleSubmit}
        className="max-w-6xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-6"
        style={{
          paddingLeft: "max(env(safe-area-inset-left),0px)",
          paddingRight: "max(env(safe-area-inset-right),0px)",
        }}
      >
        {/* LEFT: Form sections */}
        <div className="lg:col-span-8 space-y-6">
          {/* Bill To */}
          <section className="rounded-2xl border border-[#ece9e2] bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#ece9e2]">
              <div className="flex items-center gap-2">
                {customerType === "business" ? (
                  <Building2 className="h-5 w-5 text-neutral-500" />
                ) : (
                  <User2 className="h-5 w-5 text-neutral-500" />
                )}
                <h2 className="text-base sm:text-lg font-medium">Bill To</h2>
              </div>
              {/* Mobile payment status */}
              <div className="md:hidden inline-flex rounded-lg border border-neutral-300 bg-white p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setPaymentStatus("due")}
                  className={`px-2.5 py-1 rounded-md ${
                    paymentStatus === "due" ? "bg-neutral-100 font-medium" : ""
                  }`}
                >
                  Due
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentStatus("paid")}
                  className={`px-2.5 py-1 rounded-md ${
                    paymentStatus === "paid" ? "bg-neutral-100 font-medium" : ""
                  }`}
                  title="Invoice will be created and immediately marked as paid (offline)"
                >
                  Paid
                </button>
              </div>
            </div>

            <div className="px-5 sm:px-6 py-5 space-y-5">
              {/* Customer type */}
              <fieldset className="flex flex-wrap items-center gap-4">
                <legend className="sr-only">Customer type</legend>
                <label
                  className={`inline-flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg border transition ${
                    customerType === "individual"
                      ? "border-[#d6d0c7] bg-[#fcfbf8]"
                      : "border-transparent hover:bg-neutral-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="ctype"
                    className="accent-[#6f5a3a]"
                    checked={customerType === "individual"}
                    onChange={() => setCustomerType("individual")}
                  />
                  Individual
                </label>
                <label
                  className={`inline-flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg border transition ${
                    customerType === "business"
                      ? "border-[#d6d0c7] bg-[#fcfbf8]"
                      : "border-transparent hover:bg-neutral-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="ctype"
                    className="accent-[#6f5a3a]"
                    checked={customerType === "business"}
                    onChange={() => setCustomerType("business")}
                  />
                  Business
                </label>
              </fieldset>

              {/* Grid fields */}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Email *" icon={<Mail className="h-4 w-4" />}>
                  <input
                    required
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-neutral-200"
                  />
                </Field>

                <Field
                  label={customerType === "business" ? "Contact Name" : "Full Name"}
                  icon={<User2 className="h-4 w-4" />}
                >
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-neutral-200"
                  />
                </Field>

                {customerType === "business" && (
                  <Field
                    label="Business Name *"
                    className="sm:col-span-2"
                    icon={<Building2 className="h-4 w-4" />}
                  >
                    <input
                      required
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-neutral-200"
                    />
                  </Field>
                )}

                <Field label="Phone" icon={<PhoneIcon className="h-4 w-4" />}>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-neutral-200"
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
                  <Field label="Tax ID" icon={<Hash className="h-4 w-4" />}>
                    <input
                      type="text"
                      value={taxId}
                      onChange={(e) => setTaxId(e.target.value)}
                      placeholder={customerType === "business" ? "e.g. EL123456789" : ""}
                      className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-neutral-200"
                    />
                  </Field>
                  <Field label="Tax ID Type">
                    <select
                      value={taxIdType}
                      onChange={(e) => setTaxIdType(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-neutral-200"
                    >
                      {TAX_ID_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>

              {/* Address */}
              <div className="grid gap-4 sm:grid-cols-2 pt-2">
                <Field
                  label="Address Line 1"
                  icon={<FileText className="h-4 w-4" />}
                  className="sm:col-span-2"
                >
                  <input
                    type="text"
                    value={address.line1}
                    onChange={(e) => updateAddr({ line1: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-neutral-200"
                  />
                </Field>
                <Field label="Address Line 2" className="sm:col-span-2">
                  <input
                    type="text"
                    value={address.line2}
                    onChange={(e) => updateAddr({ line2: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-neutral-200"
                  />
                </Field>

                <Field label="City">
                  <input
                    type="text"
                    value={address.city}
                    onChange={(e) => updateAddr({ city: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-neutral-200"
                  />
                </Field>
                <Field label="State / Region">
                  <input
                    type="text"
                    value={address.state}
                    onChange={(e) => updateAddr({ state: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-neutral-200"
                  />
                </Field>

                <Field label="Postal Code">
                  <input
                    type="text"
                    value={address.postal_code}
                    onChange={(e) => updateAddr({ postal_code: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-neutral-200"
                  />
                </Field>
                <Field label="Country" icon={<Globe className="h-4 w-4" />}>
                  <select
                    value={address.country}
                    onChange={(e) => updateAddr({ country: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-neutral-200"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
          </section>

          {/* Invoice details */}
          <section className="rounded-2xl border border-[#ece9e2] bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#ece9e2]">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-neutral-500" />
                <h2 className="text-base sm:text-lg font-medium">Invoice</h2>
              </div>
              {paymentStatus === "paid" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 text-xs">
                  <CheckCircle2 className="h-4 w-4" /> Will be recorded as paid (offline)
                </span>
              )}
            </div>

            <div className="px-5 sm:px-6 py-5 grid gap-4 sm:grid-cols-2">
              <Field label="Currency">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-neutral-200"
                >
                  <option value="eur">EUR</option>
                  <option value="usd">USD</option>
                  <option value="gbp">GBP</option>
                </select>
              </Field>

              <div className="block">
                <span className="text-sm font-medium text-neutral-800">Collection Method</span>
                <div className="mt-2 flex items-center gap-3 flex-wrap">
                  <label
                    className={`inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border transition ${
                      paymentStatus === "paid" ? "opacity-60" : ""
                    } ${
                      collectionMethod === "send_invoice"
                        ? "border-[#d6d0c7] bg-[#fcfbf8]"
                        : "border-transparent hover:bg-neutral-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="cm"
                      className="accent-[#6f5a3a]"
                      checked={collectionMethod === "send_invoice"}
                      onChange={() => setCollectionMethod("send_invoice")}
                      disabled={paymentStatus === "paid"}
                    />
                    <span className="text-sm">Send invoice (email)</span>
                  </label>

                  <label
                    className={`inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border transition ${
                      paymentStatus === "paid" ? "opacity-60" : ""
                    } ${
                      collectionMethod === "charge_automatically"
                        ? "border-[#d6d0c7] bg-[#fcfbf8]"
                        : "border-transparent hover:bg-neutral-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="cm"
                      className="accent-[#6f5a3a]"
                      checked={collectionMethod === "charge_automatically"}
                      onChange={() => setCollectionMethod("charge_automatically")}
                      disabled={paymentStatus === "paid"}
                    />
                    <span className="text-sm">Charge automatically</span>
                  </label>
                </div>
              </div>

              {collectionMethod === "send_invoice" && paymentStatus !== "paid" && (
                <Field label="Days Until Due">
                  <input
                    type="number"
                    min={1}
                    value={daysUntilDue}
                    onChange={(e) => setDaysUntilDue(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-neutral-200"
                  />
                </Field>
              )}

              <Field label="Memo / Notes" className="sm:col-span-2">
                <textarea
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-neutral-200"
                />
              </Field>
            </div>
          </section>

          {/* Line items */}
          <section className="rounded-2xl border border-[#ece9e2] bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#ece9e2]">
              <h2 className="text-base sm:text-lg font-medium">Line Items</h2>
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50 shadow-sm"
              >
                <Plus className="h-4 w-4" /> Add item
              </button>
            </div>

            <div className="px-5 sm:px-6 py-5 space-y-3">
              <div className="hidden sm:grid grid-cols-[1fr_160px_120px_80px] text-xs text-neutral-500 px-1">
                <div>Description</div>
                <div>Amount</div>
                <div>Qty</div>
                <div>Action</div>
              </div>

              {items.map((it, idx) => (
                <div
                  key={idx}
                  className="grid gap-3 sm:grid-cols-[1fr_160px_120px_80px] items-start"
                >
                  <input
                    placeholder="Description"
                    value={it.description}
                    onChange={(e) => updateItem(idx, { description: e.target.value })}
                    className="rounded-lg border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-neutral-200"
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Amount"
                    value={it.amount}
                    onChange={(e) => updateItem(idx, { amount: e.target.value })}
                    className="rounded-lg border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-neutral-200"
                  />
                  <input
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={it.quantity}
                    onChange={(e) => updateItem(idx, { quantity: e.target.value })}
                    className="rounded-lg border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-neutral-200"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="justify-self-start inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm hover:bg-neutral-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Remove</span>
                  </button>
                </div>
              ))}

              <div className="flex items-center justify-between pt-4 mt-2 border-t border-neutral-200">
                <span className="text-sm text-neutral-600">Total (preview)</span>
                <span className="text-lg font-semibold tracking-tight">
                  {currency.toUpperCase()} {total.toFixed(2)}
                </span>
              </div>
            </div>
          </section>

          {/* Footer actions (for small screens) */}
          <div className="lg:hidden">
            <PrimaryActions
              submitting={submitting}
              paymentStatus={paymentStatus}
              actionDisabled={actionDisabled}
              created={created}
              sendInvoiceNow={sendInvoiceNow}
              markPaidNow={markPaidNow}
            />
          </div>
        </div>

        {/* RIGHT: Sticky summary */}
        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-20 space-y-4">
            <div className="rounded-2xl border border-[#ece9e2] bg-white shadow-sm p-5">
              <h3 className="text-base font-medium mb-4">Summary</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-neutral-600">Payment status</dt>
                  <dd className="font-medium capitalize">
                    {paymentStatus === "paid" ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <CheckCircle2 className="h-4 w-4" /> paid (offline)
                      </span>
                    ) : (
                      "due"
                    )}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-neutral-600">Collection</dt>
                  <dd className="font-medium">
                    {paymentStatus === "paid"
                      ? "—"
                      : collectionMethod === "send_invoice"
                      ? "Send invoice"
                      : "Charge automatically"}
                  </dd>
                </div>
                {collectionMethod === "send_invoice" && paymentStatus !== "paid" && (
                  <div className="flex items-center justify-between">
                    <dt className="text-neutral-600">Due in</dt>
                    <dd className="font-medium">{Number(daysUntilDue)} days</dd>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 mt-2 border-t border-neutral-200">
                  <dt className="text-neutral-600">Total</dt>
                  <dd className="text-lg font-semibold tracking-tight">
                    {currency.toUpperCase()} {total.toFixed(2)}
                  </dd>
                </div>
              </dl>

              <div className="mt-5">
                <PrimaryActions
                  submitting={submitting}
                  paymentStatus={paymentStatus}
                  actionDisabled={actionDisabled}
                  created={created}
                  sendInvoiceNow={sendInvoiceNow}
                  markPaidNow={markPaidNow}
                />
              </div>
            </div>

            {created?.number && (
              <p className="text-sm text-neutral-600">
                Invoice <span className="font-medium">{created.number}</span> — {created.status}
              </p>
            )}
          </div>
        </aside>
      </form>
    </div>
  );
}

/* ---------- Reusable bits ---------- */
function Field({ label, children, icon, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-medium text-neutral-800 flex items-center gap-2">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}

function PrimaryActions({
  submitting,
  paymentStatus,
  actionDisabled,
  created,
  sendInvoiceNow,
  markPaidNow,
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="submit"
        disabled={actionDisabled}
        className="rounded-xl bg-[#6f5a3a] px-4 py-2 text-white hover:opacity-95 disabled:opacity-50 shadow-sm"
        title={actionDisabled ? "Add at least one line item with amount" : "Create invoice"}
      >
        {submitting ? "Creating…" : paymentStatus === "paid" ? "Create & Mark Paid" : "Create invoice"}
      </button>

      {created?.id && (
        <>
          {created?.hosted_invoice_url && (
            <a
              href={created.hosted_invoice_url}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-neutral-300 bg-white px-4 py-2 hover:bg-neutral-50 shadow-sm"
            >
              Open invoice
            </a>
          )}
          {created?.invoice_pdf && (
            <a
              href={created.invoice_pdf}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-neutral-300 bg-white px-4 py-2 hover:bg-neutral-50 shadow-sm"
            >
              Download PDF
            </a>
          )}
          {created?.collection_method === "send_invoice" && created?.status !== "paid" && (
            <button
              type="button"
              onClick={sendInvoiceNow}
              className="rounded-xl border border-neutral-300 bg-white px-4 py-2 hover:bg-neutral-50 shadow-sm"
            >
              Send via Stripe
            </button>
          )}
        </>
      )}

      {created?.id && created?.status !== "paid" && (
        <button
          type="button"
          onClick={() => markPaidNow(created.id)}
          className="rounded-xl border border-neutral-300 bg-white px-4 py-2 hover:bg-neutral-50 shadow-sm"
          title="Record an offline payment (cash/bank transfer)"
        >
          Mark as Paid (offline)
        </button>
      )}
    </div>
  );
}
