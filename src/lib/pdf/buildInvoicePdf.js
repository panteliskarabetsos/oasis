// FILE: src/lib/pdf/buildInvoicePdf.js
import "server-only";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import fs from "node:fs/promises";
import path from "node:path";

const UC = (s, d = "") => String(s ?? d).toUpperCase();
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const A4 = [595.28, 841.89];

const money = (n, ccy = "EUR") =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: UC(ccy),
    maximumFractionDigits: 2,
  }).format(Number(n || 0));

const formatInv = (series, number) =>
  `${UC(series)}-${String(number).padStart(5, "0")}`;

/* ---------------- logo helpers ---------------- */
async function tryEmbedLogo(pdf, seller) {
  const candidates = [];
  if (seller?.logoUrl) candidates.push(seller.logoUrl);
  if (process.env.BRAND_LOGO_URL) candidates.push(process.env.BRAND_LOGO_URL);
  const pub = path.join(process.cwd(), "public");
  candidates.push(
    path.join(pub, "brand-logo.png"),
    path.join(pub, "logo.png"),
    path.join(pub, "brand-logo.jpg"),
    path.join(pub, "logo.jpg")
  );
  for (const src of candidates) {
    try {
      let bytes;
      if (/^https?:\/\//i.test(src)) {
        const res = await fetch(src);
        if (!res.ok) continue;
        bytes = new Uint8Array(await res.arrayBuffer());
      } else {
        bytes = await fs.readFile(src);
      }
      if (bytes?.length >= 2) {
        if (bytes[0] === 0x89 && bytes[1] === 0x50)
          return { img: await pdf.embedPng(bytes) };
        if (bytes[0] === 0xff && bytes[1] === 0xd8)
          return { img: await pdf.embedJpg(bytes) };
      }
    } catch {}
  }
  return null;
}

/* ---------------- text helpers ---------------- */
function wrapLines(text, font, size, maxWidth, maxLines = 2) {
  const words = String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? cur + " " + w : w;
    if (font.widthOfTextAtSize(trial, size) <= maxWidth) cur = trial;
    else {
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) lines.length = maxLines;
  if (lines.length === maxLines && words.length) {
    let last = lines[lines.length - 1];
    while (font.widthOfTextAtSize(last + "…", size) > maxWidth && last.length)
      last = last.slice(0, -1);
    lines[lines.length - 1] = last + "…";
  }
  return lines;
}

/* ---------------- items normalization ----------------
   Accepts any of:
   - { line_subtotal, line_tax, line_total }
   - { base_amount, tax_amount, total_amount }
   - or computes from quantity/unit_price/vat_rate.
------------------------------------------------------ */
function normalizeItems(items = [], currency = "EUR") {
  const norm = [];
  for (const raw of items) {
    const qty = Math.max(1, Number(raw.quantity ?? raw.qty ?? 1));
    const unit = Number(
      raw.unit_price ?? raw.unit ?? raw.amount ?? raw.unit_amount ?? 0
    );
    const vatRate = Number(
      raw.vat_rate ?? raw.vatPercent ?? raw.vat_pct ?? raw.vat ?? 0
    );
    const desc =
      String(
        raw.description ??
          raw.desc ??
          raw.label ??
          raw.name ??
          raw.title ??
          raw.itemName ??
          raw.productName ??
          ""
      ).trim() || "Item";

    // prefer DB-computed fields
    let base = Number(raw.line_subtotal ?? raw.base_amount ?? NaN);
    let tax = Number(raw.line_tax ?? raw.tax_amount ?? NaN);
    let total = Number(raw.line_total ?? raw.total_amount ?? NaN);

    // compute if missing or NaN
    if (!Number.isFinite(base))
      base = r2(qty * unit * (1 - Number(raw.discount_percent ?? 0) / 100));
    if (!Number.isFinite(tax)) tax = r2(base * (vatRate / 100));
    if (!Number.isFinite(total)) total = r2(base + tax);

    norm.push({
      description: desc,
      quantity: qty,
      unit_price: unit,
      vat_rate: vatRate,
      line_subtotal: base,
      line_tax: tax,
      line_total: total,
      // keep originals for reference
      _currency: currency,
    });
  }
  return norm.length ? norm : null;
}

function fallbackSingleItem(inv = {}) {
  const base = Number(inv?.subtotal ?? 0);
  const tax = Number(inv?.tax_total ?? 0);
  const tot = Number(inv?.total ?? base + tax);
  const vatRate = base > 0 ? r2((tax / base) * 100) : 0;
  return [
    {
      description: "Services",
      quantity: 1,
      unit_price: base || tot,
      vat_rate: vatRate,
      line_subtotal: base || tot,
      line_tax: tax,
      line_total: tot,
    },
  ];
}

/* =================== MAIN BUILDER =================== */
export default async function buildInvoicePdf({
  inv = {},
  items = [],
  seller = {},
}) {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage(A4);
  let { width, height } = page.getSize();
  const newPage = () => {
    page = pdf.addPage(A4);
    ({ width, height } = page.getSize());
    drawTableHeader(); // repeat on each new page
    drawFooterPageNo();
  };

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  /* palette */
  const brand = rgb(0x6f / 255, 0x5a / 255, 0x3a / 255); // Oasis brown
  const ink = rgb(0.09, 0.08, 0.07);
  const sub = rgb(0.42, 0.4, 0.36);
  const divider = rgb(0.92, 0.91, 0.89);
  const panel = rgb(0.99, 0.98, 0.96);
  const pad = 40;

  /* header band */
  page.drawRectangle({
    x: 0,
    y: height - 130,
    width,
    height: 130,
    color: brand,
  });
  let leftX = pad;
  const titleY = height - 72;

  const logo = await tryEmbedLogo(pdf, seller);
  if (logo?.img) {
    const { width: iw, height: ih } = logo.img.size();
    const scale = Math.min(140 / iw, 50 / ih, 1);
    const w = iw * scale,
      h = ih * scale,
      y = height - 62 - h / 2;
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
    size: 28,
    font: bold,
    color: rgb(1, 1, 1),
  });
  if (seller?.name)
    page.drawText(seller.name, {
      x: leftX,
      y: titleY - 18,
      size: 11,
      font,
      color: rgb(1, 1, 1),
      opacity: 0.9,
    });

  const invNo = formatInv(inv.series, inv.number);
  const rightText = (t, y, s = 11, f = font, c = rgb(1, 1, 1)) => {
    const w = f.widthOfTextAtSize(t, s);
    page.drawText(t, { x: width - pad - w, y, size: s, font: f, color: c });
  };
  rightText(`No: ${invNo}`, height - 38);

  // status chip
  const status = UC(inv.status || "");
  if (status) {
    const chipW = Math.ceil(bold.widthOfTextAtSize(status, 9) + 18);
    page.drawRectangle({
      x: width - pad - chipW,
      y: height - 62,
      width: chipW,
      height: 18,
      color: rgb(1, 1, 1),
    });
    page.drawText(status, {
      x: width - pad - chipW + 9,
      y: height - 59,
      size: 9,
      font: bold,
      color: brand,
    });
  }
  if (status === "PAID") {
    page.drawText("PAID", {
      x: width / 2 - bold.widthOfTextAtSize("PAID", 100) / 2,
      y: height / 2,
      size: 100,
      font: bold,
      color: rgb(0.7, 0.2, 0.2),
      opacity: 0.08,
      rotate: degrees(25),
    });
  }

  /* parties block */
  const yTop = height - 160;
  const colGap = 300;
  const drawBlock = (title, lines, x, y0) => {
    page.drawText(title, { x, y: y0, size: 12, font: bold, color: ink });
    let y = y0 - 12;
    for (const ln of lines) {
      y -= 12;
      page.drawText(ln, { x, y, size: 10, font, color: sub });
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

  const buyer = inv.buyer || {};
  const ba = buyer.address || {};
  const buyerLines = [
    buyer.business_name || buyer.name || "",
    buyer.email || "",
    buyer.phone || "",
    buyer.vat ? `VAT: ${buyer.vat}` : "",
    [ba.line1, ba.line2, ba.city, ba.state, ba.postal_code, ba.country]
      .filter(Boolean)
      .join(", "),
  ].filter(Boolean);

  const leftEndY = drawBlock("From", sellerLines, pad, yTop);
  const rightEndY = drawBlock("Bill To", buyerLines, pad + colGap, yTop);

  /* meta card */
  const metaY = Math.min(leftEndY, rightEndY) - 10;
  const cardH = 52;
  page.drawRectangle({
    x: pad,
    y: metaY - cardH,
    width: width - pad * 2,
    height: cardH,
    color: panel,
  });

  const cols = 4;
  const inner = width - pad * 2 - 40;
  const cw = inner / cols;
  const xs = Array.from({ length: cols }, (_, i) => pad + 20 + i * cw);
  const label = (t, x) =>
    page.drawText(t, { x, y: metaY - 14, size: 9, font: bold, color: sub });
  const val = (t, x) =>
    page.drawText(t, { x, y: metaY - 28, size: 11, font, color: ink });

  const issue = new Date(inv.issue_date);
  const due = inv.due_date ? new Date(inv.due_date) : null;
  label("Invoice No", xs[0]);
  val(invNo, xs[0]);
  label("Issue Date", xs[1]);
  val(
    isNaN(issue) ? String(inv.issue_date) : issue.toLocaleDateString(),
    xs[1]
  );
  label("Due Date", xs[2]);
  val(due ? due.toLocaleDateString() : "—", xs[2]);
  label("Currency", xs[3]);
  val(UC(inv.currency || "EUR"), xs[3]);

  /* table positions */
  let y = metaY - cardH - 26;
  const col = {
    desc: pad,
    qty: 330,
    unit: 400,
    vat: 470,
    total: width - pad - 70,
  };
  const hline = (yy) =>
    page.drawLine({
      start: { x: pad, y: yy },
      end: { x: width - pad, y: yy },
      thickness: 0.6,
      color: divider,
    });

  function drawTableHeader() {
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
  }
  drawTableHeader();

  const rightCell = (text, xRight, widthCol, size = 10, f = font, c = sub) => {
    const w = f.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: xRight + (widthCol - w),
      y,
      size,
      font: f,
      color: c,
    });
  };

  // normalize items (critical fix)
  const itemsNorm =
    normalizeItems(items, inv.currency) || fallbackSingleItem(inv);

  const bottomPad = 170;
  let rowIndex = 0;

  for (const it of itemsNorm) {
    const zebra = rowIndex % 2 === 1;
    const descMax = col.qty - col.desc - 12;
    const lines = wrapLines(it.description, font, 10, descMax, 2);

    if (zebra)
      page.drawRectangle({
        x: pad,
        y: y - 2,
        width: width - pad * 2,
        height: 16 * lines.length,
        color: panel,
      });

    // description + second line faint
    page.drawText(lines[0] || "", {
      x: col.desc,
      y,
      size: 10,
      font,
      color: ink,
    });
    if (lines[1]) {
      page.drawText(lines[1], {
        x: col.desc,
        y: y - 12,
        size: 10,
        font,
        color: sub,
      });
    }

    // numbers
    page.drawText(String(it.quantity), {
      x: col.qty,
      y,
      size: 10,
      font,
      color: sub,
    });
    rightCell(money(it.unit_price, inv.currency), col.unit, 60);
    rightCell(String(r2(it.vat_rate)), col.vat, 50);
    rightCell(money(it.line_total, inv.currency), col.total, 70, 10, bold, ink);

    // row height
    const rowH = lines[1] ? 24 : 16;
    y -= rowH;
    rowIndex++;

    // page break
    if (y < bottomPad) {
      // footer before breaking
      drawTotalsPanel(true);
      // now actually add the page & reset y
      newPage();
      y = height - 120;
    }
  }

  /* totals panel */
  function drawTotalsPanel(drawCard = false) {
    if (drawCard) hline(y + 12);
    const cardX = width - pad - 260,
      cardW = 260,
      cardH2 = 84;
    if (drawCard)
      page.drawRectangle({
        x: cardX,
        y: y - cardH2,
        width: cardW,
        height: cardH2,
        color: panel,
      });

    const totRow = (label, valTxt, b = false) => {
      y -= 18;
      page.drawText(label, {
        x: cardX + 12,
        y,
        size: 10,
        font: b ? bold : font,
        color: ink,
      });
      const f = b ? bold : font;
      const tw = f.widthOfTextAtSize(valTxt, 10);
      page.drawText(valTxt, {
        x: cardX + cardW - 12 - tw,
        y,
        size: 10,
        font: f,
        color: ink,
      });
    };

    totRow("Subtotal", money(inv.subtotal ?? 0, inv.currency));
    totRow("VAT", money(inv.tax_total ?? 0, inv.currency));
    totRow("Total", money(inv.total ?? 0, inv.currency), true);
  }

  if (y < 120) {
    newPage();
    y = height - 120;
  }
  drawTotalsPanel(true);

  /* notes */
  if (inv.notes) {
    y -= 20;
    page.drawText("Notes", { x: pad, y, size: 10, font: bold, color: ink });
    y -= 14;
    const lines = wrapLines(String(inv.notes), font, 10, width - pad * 2, 8);
    for (const ln of lines) {
      page.drawText(ln, { x: pad, y, size: 10, font, color: sub });
      y -= 12;
      if (y < 60) {
        newPage();
        y = height - 60;
      }
    }
  }

  /* footer */
  function drawFooterPageNo() {
    const pageIndex = pdf.getPageIndices().length;
    const pNo = `Page ${pageIndex}`;
    const tw = font.widthOfTextAtSize(pNo, 9);
    page.drawText(pNo, {
      x: width - pad - tw,
      y: 24,
      size: 9,
      font,
      color: sub,
    });
  }

  page.drawText("This is a first-party invoice (no AADE submission yet).", {
    x: pad,
    y: 40,
    size: 9,
    font,
    color: sub,
  });
  page.drawText(seller.name || "", {
    x: pad,
    y: 28,
    size: 9,
    font,
    color: sub,
  });
  drawFooterPageNo();

  return pdf.save();
}
