/**
 * One shape for a corporate account, used by the API routes and the admin UI.
 *
 * The billing columns (payment_terms, discount_pct, po_required,
 * billing_address) arrive with dump_sql/20260917_corporate_accounts.sql. Until
 * that has been run they are simply absent from the row, so everything here
 * falls back to the pre-migration behaviour — prepaid, no discount, no PO
 * required — rather than throwing. That keeps the page usable either way.
 */

export const PAYMENT_TERMS = Object.freeze([
  { value: "prepaid", label: "Prepaid", days: 0 },
  { value: "net15", label: "Net 15", days: 15 },
  { value: "net30", label: "Net 30", days: 30 },
  { value: "net45", label: "Net 45", days: 45 },
]);

const TERM_VALUES = PAYMENT_TERMS.map((t) => t.value);

export function isPaymentTerm(value) {
  return TERM_VALUES.includes(String(value || "").toLowerCase());
}

export function termsLabel(value) {
  const hit = PAYMENT_TERMS.find((t) => t.value === String(value || "").toLowerCase());
  return hit ? hit.label : "Prepaid";
}

export function netDays(value) {
  const hit = PAYMENT_TERMS.find((t) => t.value === String(value || "").toLowerCase());
  return hit ? hit.days : 0;
}

/** True when the account may leave a balance standing rather than paying up front. */
export function hasCredit(company) {
  return Number(company?.creditCents || 0) > 0 || netDays(company?.paymentTerms) > 0;
}

/** Database row -> the object the UI works with. */
export function toCompany(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name || "",
    vat: row.vat || "",
    email: row.email || "",
    phone: row.phone || "",
    contactName: row.contact_name || "",
    billingAddress: row.billing_address || "",
    isActive: row.is_active !== false,
    creditCents: Number(row.credit_cents || 0),
    paymentTerms: isPaymentTerm(row.payment_terms) ? row.payment_terms : "prepaid",
    discountPct: Number(row.discount_pct || 0),
    poRequired: row.po_required === true,
    notes: row.notes || "",
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

/**
 * The editable half of an account, as database columns.
 *
 * Only keys actually present in `body` are returned, so a PATCH that sends one
 * field does not quietly reset the others to their defaults.
 */
export function toColumns(body, { partial = false } = {}) {
  const out = {};
  const has = (k) => !partial || Object.prototype.hasOwnProperty.call(body, k);

  if (has("name")) out.name = String(body.name || "").trim();
  if (has("vat")) out.vat = emptyToNull(body.vat);
  if (has("email")) out.email = emptyToNull(body.email);
  if (has("phone")) out.phone = emptyToNull(body.phone);
  if (has("contactName")) out.contact_name = emptyToNull(body.contactName);
  if (has("billingAddress")) out.billing_address = emptyToNull(body.billingAddress);
  if (has("notes")) out.notes = emptyToNull(body.notes);

  if (has("creditCents")) {
    const n = Math.round(Number(body.creditCents));
    out.credit_cents = Number.isFinite(n) && n > 0 ? n : 0;
  }
  if (has("paymentTerms")) {
    out.payment_terms = isPaymentTerm(body.paymentTerms)
      ? String(body.paymentTerms).toLowerCase()
      : "prepaid";
  }
  if (has("discountPct")) {
    const n = Number(body.discountPct);
    out.discount_pct = Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
  }
  if (has("poRequired")) out.po_required = body.poRequired === true;
  if (has("isActive")) out.is_active = body.isActive !== false;

  return out;
}

/** Columns that only exist once the 20260917 migration has been run. */
export const MIGRATION_COLUMNS = Object.freeze([
  "payment_terms",
  "discount_pct",
  "po_required",
  "billing_address",
  "updated_at",
]);

/**
 * Postgres complains about one missing column at a time. Given its error,
 * drop that column from the payload so the write can be retried without it.
 * Returns null when the error is about something else.
 */
export function withoutMissingColumn(payload, error) {
  const code = error?.code;
  if (code !== "42703" && code !== "PGRST204") return null;
  const message = String(error?.message || "");
  const hit = MIGRATION_COLUMNS.find((c) => message.includes(c));
  if (!hit || !(hit in payload)) return null;
  const { [hit]: _dropped, ...rest } = payload;
  return rest;
}

function emptyToNull(v) {
  const s = String(v ?? "").trim();
  return s ? s : null;
}
