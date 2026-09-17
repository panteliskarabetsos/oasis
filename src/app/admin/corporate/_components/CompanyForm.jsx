"use client";

import { Field, Input, Select, controlClass } from "@/app/admin/_ui";
import { PAYMENT_TERMS } from "@/lib/corporate/company";

/**
 * A textarea on the same control styling, minus the fixed height.
 *
 * `inputClass` carries `h-10`; appending `h-20` after it only wins because
 * Tailwind happens to emit the taller utility later. Composing from
 * `controlClass` leaves the height unambiguous.
 */
function textareaClass(height) {
  return `w-full ${controlClass.replace("h-10 ", "")} ${height} py-2 leading-snug`;
}

export const BLANK_COMPANY = Object.freeze({
  name: "",
  vat: "",
  contactName: "",
  email: "",
  phone: "",
  billingAddress: "",
  paymentTerms: "prepaid",
  creditCents: 0,
  discountPct: 0,
  poRequired: false,
  notes: "",
});

/**
 * The editable half of a corporate account.
 *
 * `billingColumns` is false until dump_sql/20260917_corporate_accounts.sql has
 * been run; the terms block is then disabled and says why, rather than taking
 * input that the save would silently drop.
 */
export default function CompanyForm({ value, onChange, errors = {}, billingColumns = true }) {
  const set = (patch) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Company name" error={errors.name} className="sm:col-span-2">
          <Input
            value={value.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Cretan Olive Exports S.A."
            autoFocus
          />
        </Field>
        <Field label="Tax ID / VAT" error={errors.vat} hint="Goes on their invoices.">
          <Input value={value.vat} onChange={(e) => set({ vat: e.target.value })} placeholder="EL123456789" />
        </Field>
        <Field label="Contact name">
          <Input
            value={value.contactName}
            onChange={(e) => set({ contactName: e.target.value })}
            placeholder="Who you deal with"
          />
        </Field>
        <Field label="Email" error={errors.email}>
          <Input
            type="email"
            value={value.email}
            onChange={(e) => set({ email: e.target.value })}
            placeholder="accounts@company.gr"
          />
        </Field>
        <Field label="Phone">
          <Input value={value.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+30 …" />
        </Field>
        <Field label="Billing address" className="sm:col-span-2">
          <textarea
            className={textareaClass("h-20")}
            value={value.billingAddress}
            onChange={(e) => set({ billingAddress: e.target.value })}
            placeholder="Street, city, postcode"
            disabled={!billingColumns}
          />
        </Field>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#b89a6b]">
            Billing terms
          </h3>
          {!billingColumns ? (
            <span className="text-[11px] text-[#a33c22]">
              Run dump_sql/20260917_corporate_accounts.sql to enable
            </span>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Payment terms" hint="When the balance falls due after invoicing.">
            <Select
              value={value.paymentTerms}
              onChange={(e) => set({ paymentTerms: e.target.value })}
              disabled={!billingColumns}
            >
              {PAYMENT_TERMS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Credit limit (€)" hint="0 means they pay before the day.">
            <Input
              type="number"
              min={0}
              step={50}
              value={Math.round(Number(value.creditCents || 0) / 100)}
              onChange={(e) => set({ creditCents: Math.round(Number(e.target.value || 0) * 100) })}
            />
          </Field>

          <Field label="Standing discount (%)" error={errors.discountPct} hint="Applied before any promo code.">
            <Input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={value.discountPct}
              onChange={(e) => set({ discountPct: e.target.value })}
              disabled={!billingColumns}
            />
          </Field>

          <label
            className={`flex items-start gap-2.5 rounded-xl border border-[#e6e0d6] bg-[#fdfbf7] px-3.5 py-3 ${
              billingColumns ? "cursor-pointer" : "opacity-50"
            }`}
          >
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[#8b6f47]"
              checked={value.poRequired}
              onChange={(e) => set({ poRequired: e.target.checked })}
              disabled={!billingColumns}
            />
            <span className="min-w-0">
              <span className="block text-[12px] font-semibold text-[#3f3127]">
                Purchase order required
              </span>
              <span className="mt-0.5 block text-[11px] text-[#9a8c7e]">
                Do not invoice this account without a PO number.
              </span>
            </span>
          </label>
        </div>
      </section>

      <Field label="Internal notes" hint="Only ever seen here.">
        <textarea
          className={textareaClass("h-24")}
          value={value.notes}
          onChange={(e) => set({ notes: e.target.value })}
          placeholder="Anything worth remembering about this account."
        />
      </Field>
    </div>
  );
}
