// src/app/api/admin/invoices2/[id]/pdf/route.js
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
const A4 = [595.28, 841.89];

const parseJSON = (v, fallback = {}) => {
  if (!v) return fallback;
  if (typeof v === "object") return v;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
};
const parseArray = (v) => (Array.isArray(v) ? v : parseJSON(v, []));

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
async function tryEmbedLogo(pdf, seller) {
  const candidates = [];
  if (seller?.logoUrl) candidates.push(seller.logoUrl);
  if (process.env.BRAND_LOGO_URL) candidates.push(process.env.BRAND_LOGO_URL);

  const pub = path.join(process.cwd(), "public");
  candidates.push(path.join(pub, "brand", "logo1.png"));
  candidates.push(path.join(pub, "logo1.png"));
  candidates.push(path.join(pub, "brand", "logo1.jpg"));
  candidates.push(path.join(pub, "logo1.jpg"));

  for (const src of candidates) {
    try {
      if (/^https?:\/\//i.test(src)) {
        const res = await fetch(src);
        if (!res.ok) continue;
        const ab = await res.arrayBuffer();
        const bytes = new Uint8Array(ab);
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("png") || (bytes[0] === 0x89 && bytes[1] === 0x50)) {
          return { img: await pdf.embedPng(bytes), type: "png" };
        }
        if (
          ct.includes("jpeg") ||
          ct.includes("jpg") ||
          (bytes[0] === 0xff && bytes[1] === 0xd8)
        ) {
          return { img: await pdf.embedJpg(bytes), type: "jpg" };
        }
      } else {
        const buf = await fs.readFile(src);
        if (buf[0] === 0x89 && buf[1] === 0x50)
          return { img: await pdf.embedPng(buf), type: "png" };
        if (buf[0] === 0xff && buf[1] === 0xd8)
          return { img: await pdf.embedJpg(buf), type: "jpg" };
      }
    } catch {}
  }
  return null;
}

/* Basic soft wrap */
function wrapLines(text, font, size, maxWidth, maxLines = 3) {
  const words = String(text || "").split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? cur + " " + w : w;
    if (font.widthOfTextAtSize(trial, size) <= maxWidth) cur = trial;
    else {
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  if (lines.length === maxLines && words.length > 0) {
    let last = lines[lines.length - 1];
    const ell = "…";
    while (font.widthOfTextAtSize(last + ell, size) > maxWidth && last.length) {
      last = last.slice(0, -1);
    }
    lines[lines.length - 1] = last + ell;
  }
  return lines;
}

/* Wrapped info block */
function drawBlockWrapped(
  page,
  { title, rows, x, y0, font, bold, ink, sub, maxWidth }
) {
  page.drawText(title, { x, y: y0, size: 12, font: bold, color: ink });
  let y = y0 - 16;
  const lineH = 12;
  for (const raw of rows) {
    const parts = wrapLines(String(raw || ""), font, 10, maxWidth, 4);
    for (const part of parts) {
      page.drawText(part, { x, y, size: 10, font, color: sub });
      y -= lineH;
    }
    y -= 2;
  }
  return y - 2;
}

/* ───────── GET /api/admin/invoices2/[id]/pdf ───────── */
export async function GET(req, ctx) {
  // Next 15: params must be awaited
  const { id: idParam } = await ctx.params;
  const id = Number(idParam);
  if (!Number.isFinite(id) || id <= 0) return bad("Invalid invoice id", 400);

  const gate = await requireAdmin();
  if (gate?.error) return gate.response;

  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  // Pull extra meta so we can render everything
  const { data: inv, error: e1 } = await admin
    .from("invoice")
    .select(
      [
        "id",
        "series",
        "number",
        "status",
        "currency",
        "issue_date",
        "due_date",
        "seller",
        "buyer",
        "notes",
        "subtotal",
        "tax_total",
        "total",
        "taxes",
        "payment_method",
        "paid_at",
        "booking_id",
        "stripe_payment_intent_id",
        "stripe_invoice_id",
        "mark",
      ].join(", ")
    )
    .eq("id", id)
    .maybeSingle();

  if (e1) return bad(e1.message || "Failed to load invoice", 500);
  if (!inv) return bad("Invoice not found", 404);

  // Lines
  let items = [];
  try {
    const { data: lines, error: e2 } = await admin
      .from("invoice_line")
      .select(
        "id, description, quantity, unit_price, vat_rate, discount_percent, line_subtotal, line_tax, line_total"
      )
      .eq("invoice_id", id)
      .order("id", { ascending: true });

    if (e2) throw e2;

    items = (lines || []).map((l) => {
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
  } catch {
    items = [];
  }

  const taxesArr = parseArray(inv.taxes);
  if (!items.length) {
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

  // Seller: prefer inv.seller if present
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

  const pdfBytes = await buildPdf({ inv, items, seller, taxesArr });
  const filename = `${formatInv(inv.series, inv.number)}.pdf`;

  // inline vs download
  const url = new URL(req.url);
  const dlParam =
    url.searchParams.get("dl") ?? url.searchParams.get("download");
  const shouldDownload =
    typeof dlParam === "string" &&
    /^(1|true|yes|y|attachment|download)$/i.test(dlParam);

  return ok(Buffer.from(pdfBytes), 200, {
    "content-type": "application/pdf",
    "content-disposition": `${
      shouldDownload ? "attachment" : "inline"
    }; filename="${filename}"`,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
}

/* ───────── PDF builder (branded header + logo) ───────── */
async function buildPdf({ inv, items, seller, taxesArr = [] }) {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage(A4);
  let { width, height } = page.getSize();
  const newPage = () => {
    page = pdf.addPage(A4);
    ({ width, height } = page.getSize());
  };

  // Fonts: try Unicode (Greek), fallback to Helvetica
  let font, bold;
  try {
    const fontsDir = path.join(process.cwd(), "public", "fonts");
    const regularBytes = await fs.readFile(
      path.join(fontsDir, "NotoSans-Regular.ttf")
    );
    const boldBytes = await fs.readFile(
      path.join(fontsDir, "NotoSans-Bold.ttf")
    );
    font = await pdf.embedFont(regularBytes, { subset: true });
    bold = await pdf.embedFont(boldBytes, { subset: true });
  } catch {
    font = await pdf.embedFont(StandardFonts.Helvetica);
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  }

  // Palette & utils
  const brand = rgb(0x6f / 255, 0x5a / 255, 0x3a / 255);
  const ink = rgb(0.09, 0.08, 0.07);
  const sub = rgb(0.42, 0.4, 0.36);
  const line = rgb(0.92, 0.91, 0.89);
  const panel = rgb(0.99, 0.98, 0.96);
  const padding = 40;

  const CURRENCY = UC(inv.currency || "EUR");
  const fmtMoney = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: CURRENCY,
    maximumFractionDigits: 2,
  });
  const money = (n) => fmtMoney.format(Number(n || 0));

  const fmtDate = new Intl.DateTimeFormat("el-GR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const fmtDateTime = new Intl.DateTimeFormat("el-GR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const asDateLabel = (v) => {
    const d = new Date(v);
    return Number.isNaN(+d) ? String(v ?? "—") : fmtDate.format(d);
  };
  const asDateTimeLabel = (v) => {
    const d = new Date(v);
    return Number.isNaN(+d) ? String(v ?? "—") : fmtDateTime.format(d);
  };

  // Header band
  page.drawRectangle({
    x: 0,
    y: height - 120,
    width,
    height: 120,
    color: brand,
  });
  let logoObj = null;
  try {
    logoObj = await tryEmbedLogo(pdf, seller);
  } catch {}

  let leftX = padding;
  const titleY = height - 70;
  if (logoObj?.img) {
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
    });
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
      font,
      color: rgb(1, 1, 1),
      opacity: 0.9,
    });
  }

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

  // Watermark by status
  const watermarks = {
    PAID: { c: rgb(0.1, 0.6, 0.2), o: 0.08 },
    CANCELLED: { c: rgb(0.8, 0.2, 0.2), o: 0.08 },
    DRAFT: { c: rgb(0.2, 0.3, 0.7), o: 0.06 },
  };
  const wm = watermarks[status];
  if (wm) {
    const T = status;
    const sz = 96;
    const w = bold.widthOfTextAtSize(T, sz);
    page.drawText(T, {
      x: width / 2 - w / 2,
      y: height / 2,
      size: sz,
      font: bold,
      color: wm.c,
      opacity: wm.o,
      rotate: degrees(25),
    });
  }

  // Addresses
  const yTop = height - 150;
  const colGap = 300;
  const blockMaxWidth = 260;

  const sa = seller.address || {};
  const sellerLines = [
    seller.name,
    seller.email || "",
    seller.phone || "",
    [sa.line1, sa.line2, sa.city, sa.state, sa.postal_code, sa.country]
      .filter(Boolean)
      .join(", "),
  ].filter(Boolean);

  const buyerObj = parseJSON(inv.buyer);
  const ba = buyerObj.address || {};
  const addr = [
    ba.line1 ?? buyerObj.address_line1 ?? buyerObj.address1,
    ba.line2 ?? buyerObj.address_line2 ?? buyerObj.address2,
    ba.city ?? buyerObj.city,
    ba.state ?? buyerObj.region ?? buyerObj.province ?? buyerObj.state,
    ba.postal_code ?? buyerObj.postcode ?? buyerObj.zip ?? buyerObj.postalCode,
    ba.country ?? buyerObj.country ?? buyerObj.country_code,
  ]
    .filter(Boolean)
    .join(", ");

  const buyerLines = [
    buyerObj.business_name ||
      buyerObj.company ||
      buyerObj.company_name ||
      buyerObj.name ||
      "",
    buyerObj.email || "",
    buyerObj.phone || buyerObj.telephone || buyerObj.mobile || "",
    buyerObj.vat || buyerObj.afm || buyerObj.tax_id || buyerObj.taxNumber || "",
    addr,
  ].filter(Boolean);

  const leftEndY = drawBlockWrapped(page, {
    title: "From",
    rows: sellerLines,
    x: padding,
    y0: yTop,
    font,
    bold,
    ink,
    sub,
    maxWidth: blockMaxWidth,
  });
  const rightEndY = drawBlockWrapped(page, {
    title: "Bill To",
    rows: buyerLines,
    x: padding + colGap,
    y0: yTop,
    font,
    bold,
    ink,
    sub,
    maxWidth: blockMaxWidth,
  });

  // Meta panel (4-col grid)
  const metaY = Math.min(leftEndY, rightEndY) - 10;
  const cardX = padding;
  const cardW = width - padding * 2;
  const cardH = 56;

  page.drawRectangle({
    x: cardX,
    y: metaY - cardH,
    width: cardW,
    height: cardH,
    color: panel,
  });

  const label = (t, x) =>
    page.drawText(t, { x, y: metaY - 14, size: 9, font: bold, color: sub });
  const value = (t, x) =>
    page.drawText(t, { x, y: metaY - 28, size: 11, font, color: ink });

  const innerPad = 20;
  const gapMeta = 24;
  const colWMeta = (cardW - innerPad * 2 - gapMeta * 3) / 4;
  const colX = [
    cardX + innerPad,
    cardX + innerPad + colWMeta + gapMeta,
    cardX + innerPad + (colWMeta + gapMeta) * 2,
    cardX + innerPad + (colWMeta + gapMeta) * 3,
  ];

  label("Invoice No", colX[0]);
  value(invNo, colX[0]);
  label("Issue Date", colX[1]);
  value(asDateLabel(inv.issue_date), colX[1]);
  label("Due Date", colX[2]);
  value(inv.due_date ? asDateLabel(inv.due_date) : "—", colX[2]);
  label("Currency", colX[3]);
  value(CURRENCY, colX[3]);

  /* =======================
     TABLE LAYOUT — no overlap
     ======================= */
  let y = metaY - cardH - 28;

  const tableX = padding;
  const tableW = width - padding * 2;

  // fixed widths with gaps to guarantee separation
  const qtyW = 44;
  const unitW = 96;
  const vatW = 56;
  const totalW = 104;
  const gap = 10;

  const descW = tableW - (qtyW + unitW + vatW + totalW + gap * 4); // leftover for description

  const COL = {
    desc: { x: tableX, w: descW },
    qty: { x: tableX + descW + gap, w: qtyW },
    unit: { x: tableX + descW + gap + qtyW + gap, w: unitW },
    vat: {
      x: tableX + descW + gap + qtyW + gap + unitW + gap,
      w: vatW,
    },
    total: {
      x: tableX + descW + gap + qtyW + gap + unitW + gap + vatW + gap,
      w: totalW,
    },
  };

  const hline = (yy) =>
    page.drawLine({
      start: { x: tableX, y: yy },
      end: { x: tableX + tableW, y: yy },
      thickness: 0.6,
      color: line,
    });

  const drawHeader = () => {
    hline(y + 14);
    // left header
    page.drawText("Description", {
      x: COL.desc.x,
      y,
      size: 10,
      font: bold,
      color: ink,
    });
    // right headers aligned to column right edges
    const hRight = (label, col) => {
      const w = bold.widthOfTextAtSize(label, 10);
      page.drawText(label, {
        x: col.x + col.w - w,
        y,
        size: 10,
        font: bold,
        color: ink,
      });
    };
    hRight("Qty", COL.qty);
    hRight("Unit Price", COL.unit);
    hRight("VAT%", COL.vat);
    hRight("Line Total", COL.total);
    hline(y - 2);
    y -= 18;
  };

  drawHeader();

  const drawRightCell = (text, col, f = font, c = sub, size = 10) => {
    const w = f.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: col.x + col.w - w,
      y,
      size,
      font: f,
      color: c,
    });
  };

  const bottomPad = 160;
  let rowIndex = 0;

  for (const it of items) {
    // zebra
    if (rowIndex % 2 === 1) {
      page.drawRectangle({
        x: tableX,
        y: y - 2,
        width: tableW,
        height: 16,
        color: panel,
      });
    }

    // description (wrap up to 2 lines within descW)
    const descLines = wrapLines(it.description, font, 10, COL.desc.w - 4, 2);

    page.drawText(descLines[0] || "", {
      x: COL.desc.x,
      y,
      size: 10,
      font,
      color: ink,
    });

    drawRightCell(String(it.quantity), COL.qty);
    drawRightCell(money(it.unit_price), COL.unit);
    drawRightCell(String(r2(it.vat_rate)), COL.vat);
    drawRightCell(money(it.total_amount), COL.total, bold, ink);

    let rowH = 16;
    if (descLines.length > 1) {
      page.drawText(descLines[1], {
        x: COL.desc.x,
        y: y - 12,
        size: 10,
        font,
        color: sub,
      });
      rowH = 24;
    }

    y -= rowH;
    rowIndex++;

    if (y < bottomPad) {
      newPage();
      y = height - 90;
      drawHeader();
      rowIndex = 0;
    }
  }

  // Totals card (right)
  y -= 6;
  hline(y + 12);
  const cardX2 = width - padding - 240;
  const cardW2 = 240;
  const cardH2 = 78;
  page.drawRectangle({
    x: cardX2,
    y: y - cardH2,
    width: cardW2,
    height: cardH2,
    color: panel,
  });
  const row = (label, val, strong = false) => {
    y -= 16;
    page.drawText(label, {
      x: cardX2 + 12,
      y,
      size: 10,
      font: strong ? bold : font,
      color: ink,
    });
    const f = strong ? bold : font;
    const w = f.widthOfTextAtSize(val, 10);
    page.drawText(val, {
      x: cardX2 + cardW2 - 12 - w,
      y,
      size: 10,
      font: f,
      color: ink,
    });
  };
  row("Subtotal", money(inv.subtotal ?? 0));
  row("VAT", money(inv.tax_total ?? 0));
  row("Total", money(inv.total ?? 0), true);

  // Tax breakdown (optional)
  const hasTaxBreakdown = Array.isArray(taxesArr) && taxesArr.length > 0;
  if (hasTaxBreakdown) {
    const txY0 = y - 8;
    page.drawText("Tax breakdown", {
      x: padding,
      y: txY0,
      size: 10,
      font: bold,
      color: ink,
    });
    let ty = txY0 - 14;
    for (const t of taxesArr) {
      const name =
        t?.name ??
        t?.label ??
        `VAT ${String(t?.rate ?? t?.percent ?? t?.vat_rate ?? 0)}%`;
      const rate = Number(t?.rate ?? t?.percent ?? t?.vat_rate ?? 0);
      const amt = Number(t?.amount ?? t?.tax ?? t?.value ?? 0);
      const lineText = `${name} (${rate}%)`;
      const w = font.widthOfTextAtSize(lineText, 10);
      page.drawText(lineText, {
        x: padding + 12,
        y: ty,
        size: 10,
        font,
        color: sub,
      });
      const v = fmtMoney.format(amt);
      const vw = font.widthOfTextAtSize(v, 10);
      page.drawText(v, {
        x: padding + 12 + 280 - vw,
        y: ty,
        size: 10,
        font,
        color: sub,
      });
      ty -= 14;
      if (ty < 70) {
        newPage();
        y = height - 70;
      }
    }
    y = Math.min(y, ty);
  }

  // Payment details (optional)
  const payLines = [];
  if (inv.payment_method)
    payLines.push(`Payment method: ${String(inv.payment_method)}`);
  if (inv.paid_at) payLines.push(`Paid at: ${asDateTimeLabel(inv.paid_at)}`);
  if (inv.booking_id) payLines.push(`Booking ID: ${String(inv.booking_id)}`);
  if (inv.stripe_payment_intent_id)
    payLines.push(`Stripe PI: ${String(inv.stripe_payment_intent_id)}`);
  if (inv.stripe_invoice_id)
    payLines.push(`Stripe Invoice: ${String(inv.stripe_invoice_id)}`);
  if (inv.mark) payLines.push(`Mark: ${String(inv.mark)}`);

  if (payLines.length) {
    y -= 10;
    page.drawText("Payment details", {
      x: padding,
      y,
      size: 10,
      font: bold,
      color: ink,
    });
    y -= 12;
    for (const ln of payLines) {
      const parts = wrapLines(ln, font, 10, width - padding * 2, 3);
      for (const part of parts) {
        page.drawText(part, { x: padding + 12, y, size: 10, font, color: sub });
        y -= 12;
        if (y < 60) {
          newPage();
          y = height - 60;
        }
      }
    }
  }

  // Notes
  if (inv.notes) {
    y -= 6;
    page.drawText("Notes", { x: padding, y, size: 10, font: bold, color: ink });
    y -= 14;
    const maxWidth = width - padding * 2;
    const lines = wrapLines(String(inv.notes), font, 10, maxWidth, 20);
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
