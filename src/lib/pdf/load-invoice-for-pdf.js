// src/lib/pdf/load-invoice-for-pdf.js
import "server-only";
const UC = (s, d = "") => String(s ?? d).toUpperCase();
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const parseJSON = (v, fb = {}) => {
  if (!v) return fb;
  if (typeof v === "object") return v;
  try {
    return JSON.parse(v);
  } catch {
    return fb;
  }
};
const parseArray = (v) => (Array.isArray(v) ? v : parseJSON(v, []));

export async function loadInvoiceForPdf(admin, id) {
  const { data: inv, error: e1 } = await admin
    .from("invoice")
    .select(
      "id, series, number, status, currency, issue_date, due_date, seller, buyer, notes, subtotal, tax_total, total, taxes, payment_method, paid_at, booking_id, stripe_payment_intent_id, stripe_invoice_id, mark"
    )
    .eq("id", id)
    .maybeSingle();
  if (e1) throw new Error(e1.message || "Failed to load invoice");
  if (!inv) throw new Error("Invoice not found");

  // Lines
  let items = [];
  const { data: lines, error: e2 } = await admin
    .from("invoice_line")
    .select(
      "id, description, quantity, unit_price, vat_rate, discount_percent, line_subtotal, line_tax, line_total"
    )
    .eq("invoice_id", id)
    .order("id", { ascending: true });
  if (e2) throw new Error(e2.message || "Failed to load lines");

  if (lines?.length) {
    items = lines.map((l) => {
      const qty = Math.max(1, Number(l?.quantity ?? 1));
      const unit = Number(l?.unit_price ?? 0);
      const vat = Math.max(0, Number(l?.vat_rate ?? 0));
      const base = Number(l?.line_subtotal ?? r2(qty * unit));
      const tax = Number(l?.line_tax ?? r2(base * (vat / 100)));
      const tot = Number(l?.line_total ?? r2(base + tax));
      return {
        description: String(l?.description || "Item"),
        quantity: qty,
        unit_price: unit,
        vat_rate: vat,
        base_amount: base,
        tax_amount: tax,
        total_amount: tot,
        discount_percent: Number(l?.discount_percent ?? 0),
      };
    });
  } else {
    // fallback item if no lines
    const taxesArr = parseArray(inv.taxes);
    const base = Number(inv.subtotal || 0);
    const tax = Number(inv.tax_total || 0);
    let vatPct = 0;
    if (Array.isArray(taxesArr) && taxesArr.length === 1) {
      vatPct =
        Number(
          taxesArr[0]?.rate ??
            taxesArr[0]?.percent ??
            taxesArr[0]?.vat_rate ??
            0
        ) || 0;
    } else if (base > 0) {
      vatPct = r2((tax / base) * 100);
    }
    items = [
      {
        description: "Invoice total",
        quantity: 1,
        unit_price: base || Number(inv.total || 0),
        vat_rate: vatPct,
        base_amount: base || Number(inv.total || 0),
        tax_amount: tax || 0,
        total_amount: Number(inv.total || 0),
      },
    ];
  }

  const taxesArr = parseArray(inv.taxes);

  // Seller: prefer invoice.seller
  const sellerDefault = {
    name: "Oasis",
    email: "info@youroasis.gr",
    phone: "",
    logoUrl: process.env.BRAND_LOGO_URL || undefined,
    address: {
      line1: "Chania st. 12",
      city: "Chania",
      state: "Crete",
      postal_code: "73100",
      country: "GR",
    },
  };
  const sellerFromInv = parseJSON(inv.seller, {});
  const seller = {
    ...sellerDefault,
    ...sellerFromInv,
    address: {
      ...(sellerDefault.address || {}),
      ...(sellerFromInv.address || {}),
    },
  };

  return { inv, items, taxesArr, seller };
}
