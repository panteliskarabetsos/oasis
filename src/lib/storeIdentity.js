import "server-only";

/**
 * Merchant identity printed on receipts, invoices and Z-reports.
 *
 * These values were hardcoded as the same placeholder in four separate files
 * ("123 Artisan Lane", VAT "EL123456789"). A receipt is a tax document, so the
 * details belong in configuration and in exactly one place.
 */
export function storeIdentity() {
  return {
    name: process.env.STORE_NAME || "Oasis",
    // Env vars cannot hold a real newline, so "\n" in the value is honoured.
    address: String(
      process.env.STORE_ADDRESS || PLACEHOLDER.address,
    ).replaceAll("\\n", "\n"),
    taxId: process.env.STORE_TAX_ID || PLACEHOLDER.taxId,
    email:
      process.env.STORE_EMAIL ||
      process.env.EMAIL_FROM ||
      process.env.EMAIL_USER ||
      "",
    phone: process.env.STORE_PHONE || "",
  };
}

const PLACEHOLDER = {
  address: "123 Artisan Lane\nChania, Crete 73100",
  taxId: "EL123456789",
};

/**
 * True while the invented address or VAT number is still what customers see.
 *
 * Callers use this to warn staff rather than to block: a receipt with a wrong
 * address is still better than no receipt, but nobody should discover the
 * placeholder from a customer.
 */
export function storeIdentityIsPlaceholder() {
  const s = storeIdentity();
  return s.address === PLACEHOLDER.address || s.taxId === PLACEHOLDER.taxId;
}
