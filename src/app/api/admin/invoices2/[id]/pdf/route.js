// FILE: src/app/api/admin/invoices2/[id]/pdf/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import fs from "node:fs/promises";
import path from "node:path";

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

/* Try to embed a brand logo (PNG/JPG) */
async function tryEmbedLogo(pdf, req, seller) {
  const candidates = [];
  if (seller?.logoUrl) candidates.push(seller.logoUrl);
  if (process.env.BRAND_LOGO_URL) candidates.push(process.env.BRAND_LOGO_URL);

  // public/ fallbacks
  const pub = path.join(process.cwd(), "public");
  candidates.push(path.join(pub, "/brand/logo.png"));
  candidates.push(path.join(pub, "logo.png"));
  candidates.push(path.join(pub, "/brand/logo.jpg"));
  candidates.push(path.join(pub, "logo.jpg"));

  for (const src of candidates) {
    try {
      let bytes = null;

      if (/^https?:\/\//i.test(src)) {
        const res = await fetch(src);
        if (!res.ok) continue;
        const ab = await res.arrayBuffer();
        bytes = new Uint8Array(ab);
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("png"))
          return { img: await pdf.embedPng(bytes), type: "png" };
        if (ct.includes("jpeg") || ct.includes("jpg"))
          return { img: await pdf.embedJpg(bytes), type: "jpg" };
        // attempt to sniff by magic if content-type is missing
        if (bytes[0] === 0x89 && bytes[1] === 0x50)
          return { img: await pdf.embedPng(bytes), type: "png" };
        if (bytes[0] === 0xff && bytes[1] === 0xd8)
          return { img: await pdf.embedJpg(bytes), type: "jpg" };
      } else {
        const buf = await fs.readFile(src);
        if (buf[0] === 0x89 && buf[1] === 0x50)
          return { img: await pdf.embedPng(buf), type: "png" };
        if (buf[0] === 0xff && buf[1] === 0xd8)
          return { img: await pdf.embedJpg(buf), type: "jpg" };
      }
    } catch {
      // ignore this candidate
    }
  }
  return null;
}

/* Basic soft wrap for text to a max width */
function wrapLines(text, font, size, maxWidth, maxLines = 3) {
  const words = String(text || "").split(/\s+/);
  const lines = [];
  let cur = "";

  for (const w of words) {
    const trial = cur ? cur + " " + w : w;
    if (font.widthOfTextAtSize(trial, size) <= maxWidth) {
      cur = trial;
    } else {
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  if (lines.length === maxLines && words.length > 0) {
    // ellipsize the last line if overflowed
    let last = lines[lines.length - 1];
    const ell = "…";
    while (font.widthOfTextAtSize(last + ell, size) > maxWidth && last.length) {
      last = last.slice(0, -1);
    }
    lines[lines.length - 1] = last + ell;
  }
  return lines;
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
    logoUrl: process.env.BRAND_LOGO_URL || undefined,
    address: {
      line1: "123 Example Street",
      city: "Heraklion",
      state: "Crete",
      postal_code: "70014",
      country: "GR",
    },
  };

  const pdfBytes = await buildPdf({ inv, items, seller, req });
  const filename = `${formatInv(inv.series, inv.number)}.pdf`;

  return ok(Buffer.from(pdfBytes), 200, {
    "content-type": "application/pdf",
    "content-disposition": `inline; filename="${filename}"`,
    "cache-control": "no-store",
  });
}

/* ───────── PDF builder (branded header + logo) ───────── */
async function buildPdf({ inv, items, seller, req }) {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage(A4);
  let { width, height } = page.getSize();
  const newPage = () => {
    page = pdf.addPage(A4);
    ({ width, height } = page.getSize());
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
    y: height - 120,
    width,
    height: 120,
    color: brand,
  });

  // Try embed logo
  let logoObj = null;
  try {
    logoObj = await tryEmbedLogo(pdf, req, seller);
  } catch {}
  const padding = 40;

  // Left block: logo + title
  let leftX = padding;
  const titleY = height - 70;
  if (logoObj?.img) {
    // keep logo within max box (120x48)
    const maxW = 140;
    const maxH = 48;
    const { width: iw, height: ih } = logoObj.img.size();
    const scale = Math.min(maxW / iw, maxH / ih, 1);
    const w = iw * scale;
    const h = ih * scale;
    const y = height - 56 - h / 2;
    page.drawRectangle({
      x: leftX - 6,
      y: y - 6,
      width: w + 12,
      height: h + 12,
      color: rgb(1, 1, 1),
      opacity: 0.08,
    }); // soft plate
    page.drawImage(logoObj.img, { x: leftX, y, width: w, height: h });
    leftX += w + 16;
  }

  page.drawText("INVOICE", {
    x: leftX,
    y: titleY,
    size: 26,
    font: bold,
    color: rgb(1, 1, 1),
  });
  if (seller?.name) {
    page.drawText(seller.name, {
      x: leftX,
      y: titleY - 18,
      size: 11,
      font: font,
      color: rgb(1, 1, 1),
      opacity: 0.9,
    });
  }

  // Right meta: number + status chip
  const invNo = formatInv(inv.series, inv.number);
  const right = (text, y, size = 11, f = font, c = rgb(1, 1, 1)) => {
    const w = f.widthOfTextAtSize(text, size);
    page.drawText(text, { x: width - padding - w, y, size, font: f, color: c });
  };
  right(`No: ${invNo}`, height - 38);
  const status = UC(inv.status || "");
  const chipW = Math.ceil(bold.widthOfTextAtSize(status, 9) + 18);
  page.drawRectangle({
    x: width - padding - chipW,
    y: height - 62,
    width: chipW,
    height: 18,
    color: rgb(1, 1, 1),
  });
  page.drawText(status, {
    x: width - padding - chipW + 9,
    y: height - 59,
    size: 9,
    font: bold,
    color: brand,
  });

  // Optional watermark
  if (status === "PAID") {
    const wm = "PAID";
    const wmSize = 100;
    page.drawText(wm, {
      x: width / 2 - bold.widthOfTextAtSize(wm, wmSize) / 2,
      y: height / 2,
      size: wmSize,
      font: bold,
      color: rgb(0.7, 0.2, 0.2),
      opacity: 0.08,
      rotate: degrees(25),
    });
  }

  // Addresses row
  const yTop = height - 150;
  const colGap = 300;

  // helper for wrapping one block
  const drawBlock = (title, lines, x, y0) => {
    page.drawText(title, { x, y: y0, size: 12, font: bold, color: ink });
    let y = y0 - 16;
    for (const line of lines) {
      y = y - 14;
      page.drawText(line, { x, y, size: 10, font: font, color: sub });
    }
    return y - 4;
  };

  // Seller
  const sa = seller.address || {};
  const sellerLines = [
    seller.name,
    seller.email || "",
    seller.phone || "",
    [sa.line1, sa.line2, sa.city, sa.state, sa.postal_code, sa.country]
      .filter(Boolean)
      .join(", "),
  ].filter(Boolean);

  // Buyer
  const buyer = inv.buyer || {};
  const ba = buyer.address || {};
  const buyerLines = [
    buyer.business_name || buyer.name || "",
    buyer.email || "",
    [ba.line1, ba.line2, ba.city, ba.state, ba.postal_code, ba.country]
      .filter(Boolean)
      .join(", "),
  ].filter(Boolean);

  const leftEndY = drawBlock("From", sellerLines, padding, yTop);
  const rightEndY = drawBlock("Bill To", buyerLines, padding + colGap, yTop);

  // Meta panel
  const metaY = Math.min(leftEndY, rightEndY) - 10;
  const cardH = 52;
  page.drawRectangle({
    x: padding,
    y: metaY - cardH,
    width: width - padding * 2,
    height: cardH,
    color: panel,
  });
  const label = (t, x) =>
    page.drawText(t, { x, y: metaY - 14, size: 9, font: bold, color: sub });
  const value = (t, x) =>
    page.drawText(t, { x, y: metaY - 28, size: 11, font: font, color: ink });

  const issue = new Date(inv.issue_date);
  const due = inv.due_date ? new Date(inv.due_date) : null;
  const colX = [padding + 20, padding + 220, padding + 390, padding + 520];
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

  // Table
  let y = metaY - cardH - 28;
  const col = {
    desc: padding,
    qty: 330,
    unit: 400,
    vat: 470,
    total: width - padding - 60,
  };
  const hline = (yy) =>
    page.drawLine({
      start: { x: padding, y: yy },
      end: { x: width - padding, y: yy },
      thickness: 0.6,
      color: line,
    });

  const drawTableHeader = () => {
    hline(y + 14);
    page.drawText("Description", {
      x: col.desc,
      y,
      size: 10,
      font: bold,
      color: ink,
    });
    page.drawText("Qty", { x: col.qty, y, size: 10, font: bold, color: ink });
    page.drawText("Unit", { x: col.unit, y, size: 10, font: bold, color: ink });
    page.drawText("VAT%", { x: col.vat, y, size: 10, font: bold, color: ink });
    page.drawText("Line Total", {
      x: col.total,
      y,
      size: 10,
      font: bold,
      color: ink,
    });
    hline(y - 2);
    y -= 18;
  };

  drawTableHeader();

  const rightCell = (
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
      y,
      size,
      font: f,
      color: c,
    });
  };

  const bottomPad = 160;
  let rowIndex = 0;

  for (const it of items) {
    // row zebra
    if (rowIndex % 2 === 1) {
      page.drawRectangle({
        x: padding,
        y: y - 2,
        width: width - padding * 2,
        height: 16,
        color: panel,
      });
    }

    // wrap description to max 2 lines
    const descMaxWidth = col.qty - col.desc - 12;
    const descLines = wrapLines(it.description, font, 10, descMaxWidth, 2);
    // draw first line
    page.drawText(descLines[0] || "", {
      x: col.desc,
      y,
      size: 10,
      font,
      color: ink,
    });
    page.drawText(String(it.quantity), {
      x: col.qty,
      y,
      size: 10,
      font,
      color: sub,
    });
    rightCell(money(it.unit_price, inv.currency), col.unit, 10, font, sub);
    rightCell(String(r2(it.vat_rate)), col.vat, 10, font, sub);
    rightCell(money(it.total_amount, inv.currency), col.total, 10, bold, ink);

    // second line (if any)
    let rowHeight = 16;
    if (descLines.length > 1) {
      const y2 = y - 12;
      page.drawText(descLines[1], {
        x: col.desc,
        y: y2,
        size: 10,
        font,
        color: sub,
      });
      rowHeight = 24;
    }

    y -= rowHeight;
    rowIndex++;

    // page break
    if (y < bottomPad) {
      newPage();
      y = height - 90;
      drawTableHeader();
      rowIndex = 0;
    }
  }

  // Totals card (right)
  y -= 6;
  hline(y + 12);
  const cardX = width - padding - 240;
  const cardW = 240;
  const cardH2 = 78;
  page.drawRectangle({
    x: cardX,
    y: y - cardH2,
    width: cardW,
    height: cardH2,
    color: panel,
  });
  const row = (label, val, boldRow = false) => {
    y -= 16;
    page.drawText(label, {
      x: cardX + 12,
      y,
      size: 10,
      font: boldRow ? bold : font,
      color: ink,
    });
    const f = boldRow ? bold : font;
    const w = f.widthOfTextAtSize(val, 10);
    page.drawText(val, {
      x: cardX + cardW - 12 - w,
      y,
      size: 10,
      font: f,
      color: ink,
    });
  };
  row("Subtotal", money(inv.subtotal ?? 0, inv.currency));
  row("VAT", money(inv.tax_total ?? 0, inv.currency));
  row("Total", money(inv.total ?? 0, inv.currency), true);

  // Notes
  if (inv.notes) {
    y -= 18;
    page.drawText("Notes", { x: padding, y, size: 10, font: bold, color: ink });
    y -= 14;

    const maxWidth = width - padding * 2;
    const lines = wrapLines(String(inv.notes), font, 10, maxWidth, 6);
    for (const ln of lines) {
      page.drawText(ln, { x: padding, y, size: 10, font, color: sub });
      y -= 12;
      if (y < 60) {
        newPage();
        y = height - 60;
      }
    }
  }

  // Footer
  page.drawText("This is a first-party invoice (no AADE submission yet).", {
    x: padding,
    y: 40,
    size: 9,
    font,
    color: sub,
  });
  page.drawText(seller.name, { x: padding, y: 28, size: 9, font, color: sub });

  return pdf.save();
}
