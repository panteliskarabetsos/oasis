// src/lib/pdf/invoice-pdf-v2.js
import "server-only";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "node:fs/promises";
import path from "node:path";

const UC = (s, d = "") => String(s ?? d).toUpperCase();
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const A4 = [595.28, 841.89];

export const formatInv = (series, number) =>
  `${UC(series)}-${String(number).padStart(5, "0")}`;

const parseJSON = (v, fb = {}) => {
  if (!v) return fb;
  if (typeof v === "object") return v;
  try {
    return JSON.parse(v);
  } catch {
    return fb;
  }
};

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
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (bytes[0] === 0x89 && bytes[1] === 0x50)
          return { img: await pdf.embedPng(bytes) };
        if (bytes[0] === 0xff && bytes[1] === 0xd8)
          return { img: await pdf.embedJpg(bytes) };
      } else {
        const buf = await fs.readFile(src);
        if (buf[0] === 0x89 && buf[1] === 0x50)
          return { img: await pdf.embedPng(buf) };
        if (buf[0] === 0xff && buf[1] === 0xd8)
          return { img: await pdf.embedJpg(buf) };
      }
    } catch {}
  }
  return null;
}

// Word-wrap helper: relies on provided font for measurements
function wrapLines(text, font, size, maxWidth, maxLines = 3) {
  const words = String(text || "").split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (font.widthOfTextAtSize(t, size) <= maxWidth) cur = t;
    else {
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  if (lines.length === maxLines && words.length) {
    let last = lines[lines.length - 1];
    while (font.widthOfTextAtSize(last + "…", size) > maxWidth && last.length)
      last = last.slice(0, -1);
    lines[lines.length - 1] = last + "…";
  }
  return lines;
}

// Normalizer used only if we fall back to WinAnsi fonts
const normalizeWinAnsi = (s) =>
  String(s ?? "")
    .replace(/\u03BC/g, "\u00B5") // Greek mu → micro sign
    .replace(/\u2013|\u2014/g, "-") // en/em dash → hyphen
    .replace(/[\u2018\u2019]/g, "'") // curly quotes → straight
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u20AC/g, "EUR"); // Euro symbol → code

export async function buildInvoicePdf({ inv, items, seller, taxesArr = [] }) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  let page = pdf.addPage(A4);
  let { width, height } = page.getSize();
  const newPage = () => {
    page = pdf.addPage(A4);
    ({ width, height } = page.getSize());
  };

  // Fonts (Greek-friendly if present)
  let font,
    bold,
    winAnsiFallback = false;
  try {
    const fontsDir = path.join(process.cwd(), "public", "fonts");
    font = await pdf.embedFont(
      await fs.readFile(path.join(fontsDir, "NotoSans-Regular.ttf")),
      { subset: true }
    );
    bold = await pdf.embedFont(
      await fs.readFile(path.join(fontsDir, "NotoSans-Bold.ttf")),
      { subset: true }
    );
  } catch {
    font = await pdf.embedFont(StandardFonts.Helvetica);
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    winAnsiFallback = true;
  }

  // String + width helpers (consistent normalization + measuring)
  const S = (t) => (winAnsiFallback ? normalizeWinAnsi(t) : String(t ?? ""));
  const W = (fnt, t, size) => fnt.widthOfTextAtSize(S(t), size);

  const brand = rgb(0x6f / 255, 0x5a / 255, 0x3a / 255);
  const ink = rgb(0.09, 0.08, 0.07);
  const sub = rgb(0.42, 0.4, 0.36);
  const line = rgb(0.92, 0.91, 0.89);
  const panel = rgb(0.99, 0.98, 0.96);
  const padding = 40;

  const CURRENCY = UC(inv.currency || "EUR");
  const money = (n) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: CURRENCY,
      currencyDisplay: winAnsiFallback ? "code" : "symbol",
      maximumFractionDigits: 2,
    }).format(Number(n || 0));
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
  const asDate = (v) => {
    const d = new Date(v);
    return Number.isNaN(+d) ? String(v ?? "—") : fmtDate.format(d);
  };
  const asDateTime = (v) => {
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

  const logo = await tryEmbedLogo(pdf, seller);
  let leftX = padding;
  const titleY = height - 70;

  if (logo?.img) {
    const { width: iw, height: ih } = logo.img.size();
    const scale = Math.min(140 / iw, 48 / ih, 1);
    const w = iw * scale,
      h = ih * scale,
      y = height - 56 - h / 2;
    page.drawRectangle({
      x: leftX - 6,
      y: y - 6,
      width: w + 12,
      height: h + 12,
      color: rgb(1, 1, 1),
      opacity: 0.08,
    });
    page.drawImage(logo.img, { x: leftX, y, width: w, height: h });
    leftX += w + 16;
  }

  page.drawText("INVOICE", {
    x: leftX,
    y: titleY,
    size: 26,
    font: bold,
    color: rgb(1, 1, 1),
  });
  if (seller?.name)
    page.drawText(S(seller.name), {
      x: leftX,
      y: titleY - 18,
      size: 11,
      font,
      color: rgb(1, 1, 1),
      opacity: 0.9,
    });

  const invNo = formatInv(inv.series, inv.number);
  const right = (t, y, s = 11, f = font, c = rgb(1, 1, 1)) => {
    const w = W(f, t, s);
    page.drawText(S(t), {
      x: width - padding - w,
      y,
      size: s,
      font: f,
      color: c,
    });
  };
  right(`No: ${invNo}`, height - 38);

  const status = UC(inv.status || "");
  if (status) {
    const chipW = Math.ceil(W(bold, status, 9) + 18);
    page.drawRectangle({
      x: width - padding - chipW,
      y: height - 62,
      width: chipW,
      height: 18,
      color: rgb(1, 1, 1),
    });
    page.drawText(S(status), {
      x: width - padding - chipW + 9,
      y: height - 59,
      size: 9,
      font: bold,
      color: brand,
    });
  }
  if (status === "PAID") {
    page.drawText("PAID", {
      x: width / 2 - bold.widthOfTextAtSize("PAID", 96) / 2,
      y: height / 2,
      size: 96,
      font: bold,
      color: rgb(0.1, 0.6, 0.2),
      opacity: 0.08,
      rotate: degrees(25),
    });
  }

  // Parties
  const yTop = height - 150;
  const colGap = 300;
  const blockMaxWidth = 260;
  const wrap = (text, maxW, maxL = 4) =>
    wrapLines(S(text), font, 10, maxW, maxL);

  const drawBlockWrapped = ({ title, rows, x, y0 }) => {
    page.drawText(title, { x, y: y0, size: 12, font: bold, color: ink });
    let y = y0 - 16;
    for (const raw of rows) {
      const parts = wrap(String(raw || ""), blockMaxWidth, 4);
      for (const part of parts) {
        page.drawText(part, { x, y, size: 10, font, color: sub });
        y -= 12;
      }
      y -= 2;
    }
    return y - 2;
  };

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

  const leftEndY = drawBlockWrapped({
    title: "From",
    rows: sellerLines,
    x: padding,
    y0: yTop,
  });
  const rightEndY = drawBlockWrapped({
    title: "Bill To",
    rows: buyerLines,
    x: padding + colGap,
    y0: yTop,
  });

  // Meta panel
  const metaY = Math.min(leftEndY, rightEndY) - 10;
  const cardX = padding,
    cardW = width - padding * 2,
    cardH = 56;
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
    page.drawText(S(t), { x, y: metaY - 28, size: 11, font, color: ink });

  const inner = 20,
    gap = 24,
    colW = (cardW - inner * 2 - gap * 3) / 4;
  const xs = [0, 1, 2, 3].map((i) => cardX + inner + i * (colW + gap));
  label("Invoice No", xs[0]);
  value(invNo, xs[0]);
  label("Issue Date", xs[1]);
  value(asDate(inv.issue_date), xs[1]);
  label("Due Date", xs[2]);
  value(inv.due_date ? asDate(inv.due_date) : "—", xs[2]);
  label("Currency", xs[3]);
  value(UC(inv.currency || "EUR"), xs[3]);

  // Table
  let y = metaY - cardH - 28;
  const tableX = padding,
    tableW = width - padding * 2;
  const qtyW = 44,
    unitW = 96,
    vatW = 56,
    totalW = 104,
    g = 10;
  const descW = tableW - (qtyW + unitW + vatW + totalW + g * 4);
  const COL = {
    desc: { x: tableX, w: descW },
    qty: { x: tableX + descW + g, w: qtyW },
    unit: { x: tableX + descW + g + qtyW + g, w: unitW },
    vat: { x: tableX + descW + g + qtyW + g + unitW + g, w: vatW },
    total: {
      x: tableX + descW + g + qtyW + g + unitW + g + vatW + g,
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
    page.drawText("Description", {
      x: COL.desc.x,
      y,
      size: 10,
      font: bold,
      color: ink,
    });
    const hdr = (t, col) => {
      const w = W(bold, t, 10);
      page.drawText(S(t), {
        x: col.x + col.w - w,
        y,
        size: 10,
        font: bold,
        color: ink,
      });
    };
    hdr("Qty", COL.qty);
    hdr("Unit Price", COL.unit);
    hdr("VAT%", COL.vat);
    hdr("Line Total", COL.total);
    hline(y - 2);
    y -= 18;
  };
  drawHeader();

  const rightCell = (text, col, f = font, c = sub, size = 10) => {
    const w = W(f, text, size);
    page.drawText(S(text), {
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
    if (rowIndex % 2 === 1)
      page.drawRectangle({
        x: tableX,
        y: y - 2,
        width: tableW,
        height: 16,
        color: panel,
      });

    const descLines = wrap(it.description, COL.desc.w - 4, 2);
    page.drawText(descLines[0] || "", {
      x: COL.desc.x,
      y,
      size: 10,
      font,
      color: ink,
    });
    rightCell(String(it.quantity), COL.qty);
    rightCell(money(it.unit_price), COL.unit);
    rightCell(String(r2(it.vat_rate)), COL.vat);
    rightCell(money(it.total_amount), COL.total, bold, ink);

    const rowH = descLines.length > 1 ? 24 : 16;
    if (descLines[1])
      page.drawText(descLines[1], {
        x: COL.desc.x,
        y: y - 12,
        size: 10,
        font,
        color: sub,
      });

    y -= rowH;
    rowIndex++;

    if (y < bottomPad) {
      newPage();
      y = height - 90;
      drawHeader();
      rowIndex = 0;
    }
  }

  // Totals card
  if (y < 120) {
    newPage();
    y = height - 120;
  }
  y -= 6;
  hline(y + 12);
  const cardX2 = width - padding - 240,
    cardW2 = 240,
    cardH2 = 78;
  page.drawRectangle({
    x: cardX2,
    y: y - cardH2,
    width: cardW2,
    height: cardH2,
    color: panel,
  });

  const row = (label, val, strong = false) => {
    y -= 16;
    page.drawText(S(label), {
      x: cardX2 + 12,
      y,
      size: 10,
      font: strong ? bold : font,
      color: ink,
    });
    const f = strong ? bold : font;
    const w = W(f, val, 10);
    page.drawText(S(val), {
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
  if (Array.isArray(taxesArr) && taxesArr.length) {
    const y0 = y - 8;
    page.drawText("Tax breakdown", {
      x: padding,
      y: y0,
      size: 10,
      font: bold,
      color: ink,
    });
    let ty = y0 - 14;
    for (const t of taxesArr) {
      const name =
        t?.name ??
        t?.label ??
        `VAT ${String(t?.rate ?? t?.percent ?? t?.vat_rate ?? 0)}%`;
      const rate = Number(t?.rate ?? t?.percent ?? t?.vat_rate ?? 0);
      const amt = Number(t?.amount ?? t?.tax ?? t?.value ?? 0);
      const label = `${name} (${rate}%)`;
      page.drawText(S(label), {
        x: padding + 12,
        y: ty,
        size: 10,
        font,
        color: sub,
      });
      const val = money(amt);
      const vw = W(font, val, 10);
      page.drawText(S(val), {
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
  const pay = [];
  if (inv.payment_method) pay.push(`Payment method: ${inv.payment_method}`);
  if (inv.paid_at) pay.push(`Paid at: ${asDateTime(inv.paid_at)}`);
  if (inv.booking_id) pay.push(`Booking ID: ${String(inv.booking_id)}`);
  if (inv.stripe_payment_intent_id)
    pay.push(`Stripe PI: ${String(inv.stripe_payment_intent_id)}`);
  if (inv.stripe_invoice_id)
    pay.push(`Stripe Invoice: ${String(inv.stripe_invoice_id)}`);
  if (inv.mark) pay.push(`Mark: ${String(inv.mark)}`);

  if (pay.length) {
    y -= 10;
    page.drawText("Payment details", {
      x: padding,
      y,
      size: 10,
      font: bold,
      color: ink,
    });
    y -= 12;
    for (const ln of pay) {
      const parts = wrap(ln, width - padding * 2, 3);
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
    const maxW = width - padding * 2;
    const parts = wrapLines(String(inv.notes), font, 10, maxW, 20);
    for (const p of parts) {
      page.drawText(S(p), { x: padding, y, size: 10, font, color: sub });
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
  page.drawText(S(seller.name || ""), {
    x: padding,
    y: 28,
    size: 9,
    font,
    color: sub,
  });

  return pdf.save();
}
