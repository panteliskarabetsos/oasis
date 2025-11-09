// FILE: src/app/api/admin/invoices2/[id]/pdf/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";

/* ───────── helpers ───────── */
const ok = (d, s = 200, headers = {}) =>
  new NextResponse(d, { status: s, headers });
const bad = (m, s = 400) =>
  ok(JSON.stringify({ error: m }), s, {
    "content-type": "application/json; charset=utf-8",
  });

const UC = (s, d = "") => String(s ?? d).toUpperCase();
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const money = (n, ccy = "EUR") =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: UC(ccy),
    maximumFractionDigits: 2,
  }).format(Number(n || 0));
const A4 = [595.28, 841.89]; // w,h

function formatInv(series, number) {
  return `${UC(series)}-${String(number).padStart(5, "0")}`;
}

async function requireAdmin() {
  const supa = await createSupabaseServer();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return { error: true, response: bad("Unauthorized", 401) };
  const { data: row, error } = await supa
    .from("User")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (error || (row?.role ?? "user") !== "admin")
    return { error: true, response: bad("Forbidden", 403) };
  return { error: false };
}

/* ───────── GET /api/admin/invoices2/[id]/pdf ───────── */
export async function GET(req, ctx) {
  const params = await ctx.params; // ✅ Next 15 requirement
  const id = Number(params?.id);
  if (!Number.isFinite(id) || id <= 0) return bad("Invalid invoice id", 400);

  const gate = await requireAdmin();
  if (gate?.error) return gate.response;

  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  // Invoice
  const { data: inv, error: e1 } = await admin
    .from("invoice")
    .select(
      "id, series, number, status, currency, issue_date, due_date, buyer, notes, subtotal, tax_total, total"
    )
    .eq("id", id)
    .maybeSingle();
  if (e1) return bad(e1.message || "Failed to load invoice", 500);
  if (!inv) return bad("Invoice not found", 404);

  // Lines (optional)
  let items = [];
  try {
    const { data: lines } = await admin
      .from("invoice_line")
      .select(
        "description, quantity, unit_price, vat_rate, base_amount, tax_amount, total_amount"
      )
      .eq("invoice_id", id)
      .order("id", { ascending: true });

    items = (lines || []).map((l) => {
      const qty = Math.max(1, Number(l?.quantity || 1));
      const unit = Number(l?.unit_price || 0);
      const vat = Math.max(0, Number(l?.vat_rate || 0));
      const base = Number(l?.base_amount ?? r2(unit * qty));
      const tax = Number(l?.tax_amount ?? r2(base * (vat / 100)));
      const tot = Number(l?.total_amount ?? r2(base + tax));
      return {
        description: String(l?.description || "Item"),
        quantity: qty,
        unit_price: unit,
        vat_rate: vat,
        base_amount: base,
        tax_amount: tax,
        total_amount: tot,
      };
    });
  } catch {
    items = [
      {
        description: "Invoice amount",
        quantity: 1,
        unit_price: Number(inv.total || 0),
        vat_rate: 0,
        base_amount: Number(inv.total || 0),
        tax_amount: 0,
        total_amount: Number(inv.total || 0),
      },
    ];
  }

  // Seller (customize / fetch from settings if you have one)
  const seller = {
    name: "Oasis",
    email: "hello@oasis.example",
    phone: "",
    address: {
      line1: "123 Example Street",
      city: "Heraklion",
      state: "Crete",
      postal_code: "70014",
      country: "GR",
    },
  };

  const pdfBytes = await buildPdf({ inv, items, seller });
  const filename = `${formatInv(inv.series, inv.number)}.pdf`;

  return ok(Buffer.from(pdfBytes), 200, {
    "content-type": "application/pdf",
    "content-disposition": `inline; filename="${filename}"`,
    "cache-control": "no-store",
  });
}

/* ───────── PDF builder (improved layout) ───────── */
async function buildPdf({ inv, items, seller }) {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage(A4);
  let { width, height } = page.getSize();
  const setPage = (p) => {
    page = p;
    ({ width, height } = p.getSize());
  };

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Palette
  const brand = rgb(0x6f / 255, 0x5a / 255, 0x3a / 255); // #6f5a3a
  const ink = rgb(0.09, 0.08, 0.07);
  const sub = rgb(0.42, 0.4, 0.36);
  const line = rgb(0.92, 0.91, 0.89);
  const panel = rgb(0.99, 0.98, 0.96);

  // Header band
  page.drawRectangle({
    x: 0,
    y: height - 110,
    width,
    height: 110,
    color: brand,
  });
  page.drawText("INVOICE", {
    x: 40,
    y: height - 72,
    size: 26,
    font: bold,
    color: rgb(1, 1, 1),
  });

  // Right meta in header (No + Status chip)
  const invNo = formatInv(inv.series, inv.number);
  const right = (text, y, size = 11, f = font, c = rgb(1, 1, 1)) => {
    const w = f.widthOfTextAtSize(text, size);
    page.drawText(text, { x: width - 40 - w, y, size, font: f, color: c });
  };
  right(`No: ${invNo}`, height - 38);
  // Status chip
  const status = UC(inv.status || "");
  const chipW = bold.widthOfTextAtSize(status, 9) + 16;
  page.drawRectangle({
    x: width - 40 - chipW,
    y: height - 58,
    width: chipW,
    height: 16,
    color: rgb(1, 1, 1),
  });
  page.drawText(status, {
    x: width - 40 - chipW + 8,
    y: height - 55,
    size: 9,
    font: bold,
    color: brand,
  });

  // Optional “PAID” watermark
  if (status === "PAID") {
    const wm = "PAID";
    const wmSize = 100;
    page.drawText(wm, {
      x: width / 2 - bold.widthOfTextAtSize(wm, wmSize) / 2,
      y: height / 2,
      size: wmSize,
      font: bold,
      color: rgb(0.8, 0.3, 0.3),
      opacity: 0.08,
      rotate: degrees(25),
    });
  }

  // Addresses row
  const yTop = height - 140;
  const colGap = 280;

  // Seller
  page.drawText("From", { x: 40, y: yTop, size: 12, font: bold, color: ink });
  let y = yTop - 16;
  const addrLine = [
    seller.address?.line1,
    seller.address?.line2,
    seller.address?.city,
    seller.address?.state,
    seller.address?.postal_code,
    seller.address?.country,
  ]
    .filter(Boolean)
    .join(", ");
  const wrap = (
    t,
    x,
    y0,
    maxWidth,
    lh = 12,
    size = 10,
    f = font,
    color = sub
  ) => {
    // quick single-line + truncate (keeps it fast & predictable)
    const text = String(t || "");
    const maxChars = Math.floor(maxWidth / (size * 0.55));
    const shown =
      text.length > maxChars ? text.slice(0, maxChars - 1) + "…" : text;
    page.drawText(shown, { x, y: y0, size, font: f, color });
    return y0 - lh;
  };
  y = wrap(seller.name, 40, y, 240);
  if (seller.email) y = wrap(seller.email, 40, y, 240);
  if (seller.phone) y = wrap(seller.phone, 40, y, 240);
  y = wrap(addrLine, 40, y, 240);

  // Buyer
  let yR = yTop;
  const bx = 40 + colGap;
  page.drawText("Bill To", { x: bx, y: yR, size: 12, font: bold, color: ink });
  yR -= 16;
  const buyer = inv.buyer || {};
  const buyerAddr = [
    buyer.address?.line1,
    buyer.address?.line2,
    buyer.address?.city,
    buyer.address?.state,
    buyer.address?.postal_code,
    buyer.address?.country,
  ]
    .filter(Boolean)
    .join(", ");
  yR = wrap(buyer.business_name || buyer.name || "", bx, yR, 260);
  if (buyer.email) yR = wrap(buyer.email, bx, yR, 260);
  yR = wrap(buyerAddr, bx, yR, 260);

  // Meta panel (No / Issue / Due / Currency)
  const metaY = Math.min(y, yR) - 14;
  const cardH = 48;
  page.drawRectangle({
    x: 40,
    y: metaY - cardH,
    width: width - 80,
    height: cardH,
    color: panel,
  });
  const label = (t, x) =>
    page.drawText(t, { x, y: metaY - 14, size: 9, font: bold, color: sub });
  const value = (t, x) =>
    page.drawText(t, { x, y: metaY - 28, size: 11, font: font, color: ink });

  const issue = new Date(inv.issue_date);
  const due = inv.due_date ? new Date(inv.due_date) : null;
  const colX = [60, 220, 380, 500]; // 4 columns
  label("Invoice No", colX[0]);
  value(invNo, colX[0]);
  label("Issue Date", colX[1]);
  value(
    isNaN(issue) ? String(inv.issue_date) : issue.toLocaleDateString(),
    colX[1]
  );
  label("Due Date", colX[2]);
  value(due ? due.toLocaleDateString() : "—", colX[2]);
  label("Currency", colX[3]);
  value(UC(inv.currency || "EUR"), colX[3]);

  // Table header
  let tableY = metaY - cardH - 24;
  const col = { desc: 40, qty: 330, unit: 400, vat: 470, total: 540 };
  const hline = (yy) =>
    page.drawLine({
      start: { x: 40, y: yy },
      end: { x: width - 40, y: yy },
      thickness: 0.6,
      color: line,
    });

  hline(tableY + 14);
  page.drawText("Description", {
    x: col.desc,
    y: tableY,
    size: 10,
    font: bold,
    color: ink,
  });
  page.drawText("Qty", {
    x: col.qty,
    y: tableY,
    size: 10,
    font: bold,
    color: ink,
  });
  page.drawText("Unit", {
    x: col.unit,
    y: tableY,
    size: 10,
    font: bold,
    color: ink,
  });
  page.drawText("VAT%", {
    x: col.vat,
    y: tableY,
    size: 10,
    font: bold,
    color: ink,
  });
  page.drawText("Line Total", {
    x: col.total,
    y: tableY,
    size: 10,
    font: bold,
    color: ink,
  });
  hline(tableY - 2);
  let yRow = tableY - 18;

  const alignRight = (
    text,
    xRight,
    size = 10,
    f = font,
    c = sub,
    widthCol = 60
  ) => {
    const w = f.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: xRight + (widthCol - w),
      y: yRow,
      size,
      font: f,
      color: c,
    });
  };

  // Rows (with zebra background)
  let rowIndex = 0;
  const bottomPad = 150;
  for (const it of items) {
    if (yRow < bottomPad) {
      setPage(pdf.addPage(A4));
      // repeat header on new page
      yRow = height - 80;
      page.drawText("Description", {
        x: col.desc,
        y: yRow,
        size: 10,
        font: bold,
        color: ink,
      });
      page.drawText("Qty", {
        x: col.qty,
        y: yRow,
        size: 10,
        font: bold,
        color: ink,
      });
      page.drawText("Unit", {
        x: col.unit,
        y: yRow,
        size: 10,
        font: bold,
        color: ink,
      });
      page.drawText("VAT%", {
        x: col.vat,
        y: yRow,
        size: 10,
        font: bold,
        color: ink,
      });
      page.drawText("Line Total", {
        x: col.total,
        y: yRow,
        size: 10,
        font: bold,
        color: ink,
      });
      hline(yRow - 2);
      yRow -= 18;
      rowIndex = 0;
    }

    // zebra
    if (rowIndex % 2 === 1) {
      page.drawRectangle({
        x: 40,
        y: yRow - 2,
        width: width - 80,
        height: 16,
        color: panel,
        opacity: 1,
      });
    }

    const desc = String(it.description || "").slice(0, 95);
    page.drawText(desc, {
      x: col.desc,
      y: yRow,
      size: 10,
      font: font,
      color: ink,
    });

    page.drawText(String(it.quantity), {
      x: col.qty,
      y: yRow,
      size: 10,
      font: font,
      color: sub,
    });
    alignRight(money(it.unit_price, inv.currency), col.unit, 10, font, sub);
    alignRight(String(r2(it.vat_rate)), col.vat, 10, font, sub);
    alignRight(money(it.total_amount, inv.currency), col.total, 10, bold, ink);

    yRow -= 16;
    rowIndex++;
  }

  // Totals card (right)
  yRow -= 6;
  hline(yRow + 12);
  const cardX = width - 260;
  const cardH2 = 70;
  page.drawRectangle({
    x: cardX,
    y: yRow - cardH2,
    width: 220,
    height: cardH2,
    color: panel,
  });
  const row = (label, val, boldRow = false) => {
    yRow -= 16;
    page.drawText(label, {
      x: cardX + 12,
      y: yRow,
      size: 10,
      font: boldRow ? bold : font,
      color: ink,
    });
    const f = boldRow ? bold : font;
    const w = f.widthOfTextAtSize(val, 10);
    page.drawText(val, {
      x: cardX + 208 - w,
      y: yRow,
      size: 10,
      font: f,
      color: ink,
    });
  };
  row("Subtotal", money(inv.subtotal ?? 0, inv.currency));
  row("VAT", money(inv.tax_total ?? 0, inv.currency));
  row("Total", money(inv.total ?? 0, inv.currency), true);

  // Notes (full width)
  if (inv.notes) {
    yRow -= 18;
    page.drawText("Notes", {
      x: 40,
      y: yRow,
      size: 10,
      font: bold,
      color: ink,
    });
    yRow -= 14;
    page.drawText(String(inv.notes), {
      x: 40,
      y: yRow,
      size: 10,
      font: font,
      color: sub,
      maxWidth: width - 80,
      lineHeight: 12,
    });
  }

  // Footer
  page.drawText("This is a first-party invoice (no AADE submission yet).", {
    x: 40,
    y: 40,
    size: 9,
    font: font,
    color: sub,
  });
  page.drawText(seller.name, { x: 40, y: 28, size: 9, font: font, color: sub });

  return pdf.save();
}
