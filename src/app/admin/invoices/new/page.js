// src/app/admin/invoices/new/page.js
"use client";

import { useMemo, useState, useEffect } from "react";
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
  Loader2,
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

const PAYMENT_METHODS = [
  { key: "cash", label: "Cash" },
  { key: "card", label: "Card" },
  { key: "bank_transfer", label: "Bank transfer" },
  { key: "gift_card", label: "Gift card" },
  { key: "voucher", label: "Voucher" },
  { key: "other", label: "Other" },
];

export default function NewInvoicePage() {
  const router = useRouter();

  // ----- Billing party -----
  const [customerType, setCustomerType] = useState("individual"); // "individual" | "business"
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerName, setCustomerName] = useState(""); // person/contact name
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [taxId, setTaxId] = useState("");

  const [address, setAddress] = useState({
    line1: "",
    line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "GR",
  });

  // ----- Invoice core -----
  const [series, setSeries] = useState("A");
  const [currency, setCurrency] = useState("EUR");
  const [issueDate, setIssueDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  // Options
  const [finalizeNow, setFinalizeNow] = useState(true);
  const [sendAfterCreate, setSendAfterCreate] = useState(false);

  // Record payment right after creation
  const [recordPayment, setRecordPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentNotes, setPaymentNotes] = useState("");
  const num = (v) =>
    v === "" || v === null || v === undefined ? 0 : Number(v) || 0;
  const toGross = (net, vat) => num(net) * (1 + num(vat) / 100);
  const toNet = (gross, vat) => {
    const r = 1 + num(vat) / 100;
    return r === 0 ? 0 : num(gross) / r;
  };

  // Line items: description, unit_price, quantity, vat_rate
  // Line items: description, unit_price (net), unit_price_gross (incl VAT), quantity, vat_rate
  const [items, setItems] = useState([
    {
      description: "",
      unit_price: "", // NET (before VAT)
      unit_price_gross: "", // GROSS (after VAT)
      quantity: 1,
      vat_rate: 24,
      lastEdited: "net", // "net" | "gross"
    },
  ]);

  const addItem = () =>
    setItems((s) => [
      ...s,
      {
        description: "",
        unit_price: "",
        unit_price_gross: "",
        quantity: 1,
        vat_rate: 24,
        lastEdited: "net",
      },
    ]);

  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(null);
  const [sending, setSending] = useState(false);

  // -------- helpers --------

  const removeItem = (i) => setItems((s) => s.filter((_, idx) => idx !== i));
  const updateItem = (i, patch) =>
    setItems((s) =>
      s.map((row, idx) => {
        if (idx !== i) return row;
        const next = { ...row, ...patch };

        // Auto-sync logic
        const vat = num(next.vat_rate);

        // If user just changed gross
        if ("unit_price_gross" in patch) {
          next.lastEdited = "gross";
          const net = toNet(next.unit_price_gross, vat);
          next.unit_price = Number.isFinite(net) ? String(net.toFixed(2)) : "";
        }

        // If user just changed net
        if ("unit_price" in patch) {
          next.lastEdited = "net";
          const gross = toGross(next.unit_price, vat);
          next.unit_price_gross = Number.isFinite(gross)
            ? String(gross.toFixed(2))
            : "";
        }

        // If VAT changed, recompute the other side based on lastEdited
        if ("vat_rate" in patch) {
          if (next.lastEdited === "gross") {
            const net = toNet(next.unit_price_gross, vat);
            next.unit_price = Number.isFinite(net)
              ? String(net.toFixed(2))
              : next.unit_price;
          } else {
            const gross = toGross(next.unit_price, vat);
            next.unit_price_gross = Number.isFinite(gross)
              ? String(gross.toFixed(2))
              : next.unit_price_gross;
          }
        }

        return next;
      })
    );

  const updateAddr = (patch) => setAddress((a) => ({ ...a, ...patch }));

  const preview = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    for (const it of items) {
      const qty = num(it.quantity);
      const net = num(it.unit_price); // NET
      const vat = num(it.vat_rate) / 100;
      const base = Math.max(0, qty * net);
      subtotal += base;
      tax += base * vat;
    }
    const total = subtotal + tax;
    return { subtotal, tax, total };
  }, [items]);

  // Keep payment amount in sync with preview total when toggled on
  useEffect(() => {
    if (recordPayment) {
      setPaymentAmount((prev) =>
        prev ? prev : Number(preview.total.toFixed(2))
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordPayment, preview.total]);

  function ensureUpper(s) {
    return String(s || "")
      .trim()
      .toUpperCase();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setCreated(null);

    try {
      // Basic validations
      if (!customerEmail.trim()) throw new Error("Customer email is required");
      if (customerType === "business" && !String(businessName || "").trim()) {
        throw new Error("Business name is required for business customers");
      }

      const buyer = {
        // For business invoices, store both company and contact; name is the contact name, business_name the company
        name: String(customerName || "").trim() || undefined,
        business_name:
          customerType === "business"
            ? String(businessName || "").trim()
            : undefined,
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

      const lines = items
        .filter((i) => i.description && num(i.unit_price) > 0)
        .map((i) => ({
          description: i.description,
          unit_price: num(i.unit_price), // NET
          quantity: Math.max(1, num(i.quantity)),
          vat_rate: Math.max(0, num(i.vat_rate)),
        }));

      if (lines.length === 0)
        throw new Error("Add at least one line with a positive amount");

      // Build payload for create
      const payload = {
        series: ensureUpper(series || "A"),
        currency: ensureUpper(currency || "EUR"),
        issue_date: issueDate
          ? new Date(`${issueDate}T12:00:00`).toISOString()
          : undefined,
        due_date: dueDate
          ? new Date(`${dueDate}T12:00:00`).toISOString()
          : undefined,
        buyer,
        lines,
        notes,
        finalize: Boolean(finalizeNow),
      };

      // Create invoice
      const res = await fetch("/api/admin/invoices2", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const ct = res.headers.get("content-type") || "";
      const isJson = ct.includes("application/json");
      const data = isJson ? await res.json() : null;
      if (!res.ok) {
        const msg =
          (isJson && data?.error) ||
          (await res.text().catch(() => "")) ||
          "Failed to create invoice";
        throw new Error(msg);
      }
      if (!data || !data.id)
        throw new Error("Invalid API response: missing invoice id");

      setCreated(data);

      // Optionally record payment (ONLY if finalized)
      if (recordPayment && finalizeNow) {
        const amt = Number(paymentAmount || 0);
        if (!(amt > 0)) {
          throw new Error("Payment amount must be positive");
        }
        const payRes = await fetch(
          `/api/admin/invoices2/${data.id}/mark-paid`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              method: paymentMethod,
              amount: amt,
              notes: paymentNotes || undefined,
            }),
          }
        );
        if (!payRes.ok) {
          const t = await payRes.text().catch(() => "");
          throw new Error(
            `Invoice created but failed to record payment (HTTP ${
              payRes.status
            }). ${t.slice(0, 200)}`
          );
        }
      }

      // Open PDF
      window.open(`/api/admin/invoices2/${data.id}/pdf`, "_blank");

      // Optionally send email (ONLY if finalized)
      if (sendAfterCreate && finalizeNow) {
        try {
          const sendRes = await fetch(`/api/admin/invoices2/${data.id}/send`, {
            method: "POST",
            headers: { Accept: "application/json" },
          });
          if (!sendRes.ok) {
            const t = await sendRes.text().catch(() => "");
            console.warn(
              `Invoice created but sending email failed: HTTP ${sendRes.status} ${t}`
            );
          }
        } catch (e) {
          console.warn("Send email error:", e);
        }
      }

      // Go back to list
      // router.push("/admin/invoices");
      return;
    } catch (err) {
      alert(err.message || String(err));
    } finally {
      setSubmitting(false);
    }
  }
  async function sendInvoiceNow() {
    if (!created?.id || sending) return;
    try {
      setSending(true);
      const res = await fetch(`/api/admin/invoices2/${created.id}/send`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const ct = res.headers.get("content-type") || "";
      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `Failed to send invoice (status ${res.status}). ${text.slice(0, 160)}`
        );
      }
      const data = ct.includes("application/json") ? await res.json() : null;
      if (data) setCreated((c) => ({ ...c, ...data }));
      alert("Invoice sent.");
    } catch (e) {
      alert(e.message || String(e));
    } finally {
      setSending(false);
    }
  }

  const actionDisabled =
    submitting || items.every((i) => !i.description || !i.unit_price);

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
              href="/admin/invoices"
              aria-label="Back to invoices"
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
                Fill in billing details, add line items, and generate a PDF
                invoice.
              </p>
            </div>
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
                  label={
                    customerType === "business" ? "Contact Name" : "Full Name"
                  }
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

                <Field label="Tax ID" icon={<Hash className="h-4 w-4" />}>
                  <input
                    type="text"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    placeholder={
                      customerType === "business" ? "e.g. EL123456789" : ""
                    }
                    className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-neutral-200"
                  />
                </Field>
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
                    onChange={(e) =>
                      updateAddr({ postal_code: e.target.value })
                    }
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
            </div>

            <div className="px-5 sm:px-6 py-5 grid gap-4 sm:grid-cols-2">
              <Field label="Series">
                <input
                  value={series}
                  onChange={(e) => setSeries(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-neutral-200"
                />
              </Field>
              <Field label="Currency">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-neutral-200"
                >
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                </select>
              </Field>
              <Field label="Issue date">
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-neutral-200"
                />
              </Field>
              <Field label="Due date (optional)">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-neutral-200"
                />
              </Field>

              <Field label="Notes" className="sm:col-span-2">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
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
              <div className="hidden sm:grid grid-cols-[1fr_150px_150px_100px_100px_80px] text-xs text-neutral-500 px-1">
                <div>Description</div>
                <div>Unit price (net)</div>
                <div>Unit price (incl. VAT)</div>
                <div>Qty</div>
                <div>VAT %</div>
                <div>Action</div>
              </div>

              {items.map((it, idx) => (
                <div
                  key={idx}
                  className="grid gap-3 sm:grid-cols-[1fr_150px_150px_100px_100px_80px] items-start"
                >
                  {/* Description */}
                  <input
                    placeholder="Description"
                    value={it.description}
                    onChange={(e) =>
                      updateItem(idx, { description: e.target.value })
                    }
                    className="rounded-lg border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-neutral-200"
                  />

                  {/* Unit price (NET) */}
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Net"
                    value={it.unit_price}
                    onChange={(e) =>
                      updateItem(idx, { unit_price: e.target.value })
                    }
                    className="rounded-lg border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-neutral-200"
                  />

                  {/* Unit price (GROSS) */}
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Incl. VAT"
                    value={it.unit_price_gross}
                    onChange={(e) =>
                      updateItem(idx, { unit_price_gross: e.target.value })
                    }
                    className="rounded-lg border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-neutral-200"
                  />

                  {/* Qty */}
                  <input
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={it.quantity}
                    onChange={(e) =>
                      updateItem(idx, { quantity: e.target.value })
                    }
                    className="rounded-lg border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-neutral-200"
                  />

                  {/* VAT % */}
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="VAT %"
                    value={it.vat_rate}
                    onChange={(e) =>
                      updateItem(idx, { vat_rate: e.target.value })
                    }
                    className="rounded-lg border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-neutral-200"
                  />

                  {/* Remove */}
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="justify-self-start inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm hover:bg-neutral-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}

              <div className="flex items-center justify-between pt-4 mt-2 border-t border-neutral-200">
                <span className="text-sm text-neutral-600">
                  Subtotal (preview)
                </span>
                <span className="text-sm font-medium">
                  {currency} {preview.subtotal.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600">Tax (preview)</span>
                <span className="text-sm font-medium">
                  {currency} {preview.tax.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 mt-2 border-t border-neutral-200">
                <span className="text-sm text-neutral-800">
                  Total (preview)
                </span>
                <span className="text-lg font-semibold tracking-tight">
                  {currency} {preview.total.toFixed(2)}
                </span>
              </div>
            </div>
          </section>

          {/* Footer actions (for small screens) */}
          <div className="lg:hidden">
            <PrimaryActions
              submitting={submitting}
              actionDisabled={actionDisabled}
              created={created}
              sendInvoiceNow={sendInvoiceNow}
              sending={sending}
              finalizeNow={finalizeNow}
              setFinalizeNow={setFinalizeNow}
              sendAfterCreate={sendAfterCreate}
              setSendAfterCreate={setSendAfterCreate}
              recordPayment={recordPayment}
              setRecordPayment={setRecordPayment}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              paymentAmount={paymentAmount}
              setPaymentAmount={setPaymentAmount}
              paymentNotes={paymentNotes}
              setPaymentNotes={setPaymentNotes}
              currency={currency}
            />
          </div>
        </div>

        {/* RIGHT: Sticky summary + options */}
        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-20 space-y-4">
            <div className="rounded-2xl border border-[#ece9e2] bg-white shadow-sm p-5">
              <h3 className="text-base font-medium mb-4">Summary</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-neutral-600">Series</dt>
                  <dd className="font-medium">{series}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-neutral-600">Issue date</dt>
                  <dd className="font-medium">{issueDate || "—"}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-neutral-600">Due date</dt>
                  <dd className="font-medium">{dueDate || "—"}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-neutral-600">Subtotal</dt>
                  <dd className="font-medium">
                    {currency} {preview.subtotal.toFixed(2)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-neutral-600">Tax</dt>
                  <dd className="font-medium">
                    {currency} {preview.tax.toFixed(2)}
                  </dd>
                </div>
                <div className="flex items-center justify-between pt-2 mt-2 border-t border-neutral-200">
                  <dt className="text-neutral-600">Total</dt>
                  <dd className="text-lg font-semibold tracking-tight">
                    {currency} {preview.total.toFixed(2)}
                  </dd>
                </div>
              </dl>

              {/* Options */}
              <div className="mt-5 space-y-3 border-t border-neutral-200 pt-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="accent-[#6f5a3a]"
                    checked={finalizeNow}
                    onChange={(e) => setFinalizeNow(e.target.checked)}
                  />
                  Finalize now (recommended)
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="accent-[#6f5a3a]"
                    checked={sendAfterCreate}
                    onChange={(e) => setSendAfterCreate(e.target.checked)}
                    disabled={!finalizeNow}
                    title={
                      !finalizeNow
                        ? "Finalize the invoice to enable sending"
                        : undefined
                    }
                  />
                  Send after create
                </label>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="accent-[#6f5a3a]"
                      checked={recordPayment}
                      onChange={(e) => setRecordPayment(e.target.checked)}
                      disabled={!finalizeNow}
                      title={
                        !finalizeNow
                          ? "Finalize the invoice to record payment"
                          : undefined
                      }
                    />
                    Record payment now
                  </label>

                  {recordPayment && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <span className="text-xs text-neutral-600">Method</span>
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-neutral-200"
                        >
                          {PAYMENT_METHODS.map((m) => (
                            <option key={m.key} value={m.key}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <span className="text-xs text-neutral-600">
                          Amount ({currency})
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={paymentAmount}
                          onChange={(e) =>
                            setPaymentAmount(Number(e.target.value || 0))
                          }
                          className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-neutral-200"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-xs text-neutral-600">Notes</span>
                        <input
                          type="text"
                          placeholder="Optional payment note"
                          value={paymentNotes}
                          onChange={(e) => setPaymentNotes(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-neutral-200"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5">
                <PrimaryActions
                  submitting={submitting}
                  actionDisabled={actionDisabled}
                  created={created}
                  sendInvoiceNow={sendInvoiceNow}
                  sending={sending}
                  finalizeNow={finalizeNow}
                  setFinalizeNow={setFinalizeNow}
                  sendAfterCreate={sendAfterCreate}
                  setSendAfterCreate={setSendAfterCreate}
                  recordPayment={recordPayment}
                  setRecordPayment={setRecordPayment}
                  paymentMethod={paymentMethod}
                  setPaymentMethod={setPaymentMethod}
                  paymentAmount={paymentAmount}
                  setPaymentAmount={setPaymentAmount}
                  paymentNotes={paymentNotes}
                  setPaymentNotes={setPaymentNotes}
                  currency={currency}
                />
              </div>
            </div>

            {created?.invoiceNo && (
              <p className="text-sm text-neutral-600">
                Invoice <span className="font-medium">{created.invoiceNo}</span>{" "}
                — {created.status}
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
  actionDisabled,
  created,
  sendInvoiceNow,
  sending,
  finalizeNow,
  setFinalizeNow,
  sendAfterCreate,
  setSendAfterCreate,
  recordPayment,
  setRecordPayment,
  paymentMethod,
  setPaymentMethod,
  paymentAmount,
  setPaymentAmount,
  paymentNotes,
  setPaymentNotes,
  currency,
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={actionDisabled}
          className="rounded-xl bg-[#6f5a3a] px-4 py-2 text-white hover:opacity-95 disabled:opacity-50 shadow-sm"
          title={
            actionDisabled
              ? "Add at least one line item with amount"
              : "Create invoice"
          }
        >
          {submitting ? "Creating…" : "Create & Open PDF"}
        </button>

        {created?.id && (
          <>
            <a
              href={`/api/admin/invoices2/${created.id}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-neutral-300 bg-white px-4 py-2 hover:bg-neutral-50 shadow-sm"
            >
              Open PDF
            </a>
            <a
              href={`/api/admin/invoices2/${created.id}/download`}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-neutral-300 bg-white px-4 py-2 hover:bg-neutral-50 shadow-sm"
              disabled={sending}
            >
              Download PDF
            </a>
            <button
              type="button"
              onClick={sendInvoiceNow}
              className="rounded-xl border border-neutral-300 bg-white px-4 py-2 hover:bg-neutral-50 shadow-sm inline-flex items-center gap-2 disabled:opacity-50"
              disabled={sending}
            >
              Send via email
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {sending ? "Sending…" : "Send via email"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
