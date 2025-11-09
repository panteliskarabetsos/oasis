export async function generateInvoiceNumber(supabase) {
  // Simple: INV-YYYYMM-XXXX
  const now = new Date();
  const prefix = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}`;
  const { data, error } = await supabase
    .from("invoices")
    .select("number")
    .ilike("number", `${prefix}-%`);
  const next =
    1 +
    (data || [])
      .map((x) => Number(String(x.number).split("-").pop() || 0))
      .filter((n) => !Number.isNaN(n))
      .reduce((a, b) => Math.max(a, b), 0);
  return `${prefix}-${String(next).padStart(4, "0")}`;
}

export function computeInvoiceTotals(items = []) {
  const subtotal = items.reduce(
    (s, x) => s + Number(x.quantity || 0) * Number(x.unitPrice || 0),
    0
  );
  const tax = items.reduce(
    (s, x) =>
      s +
      Number(x.quantity || 0) *
        Number(x.unitPrice || 0) *
        (Number(x.taxRate || 0) / 100),
    0
  );
  return { subtotal, tax, total: subtotal + tax };
}
