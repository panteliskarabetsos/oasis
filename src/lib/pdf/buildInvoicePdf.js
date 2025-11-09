import "server-only";
import PDFDocument from "pdfkit";
import { PassThrough } from "stream";

export default async function buildInvoicePdf({
  invoice,
  lines = [],
  brand = {},
}) {
  const {
    series,
    number,
    issue_date,
    due_date,
    status,
    currency = "EUR",
    seller = {},
    buyer = {},
    subtotal,
    tax_total,
    total,
    taxes = [],
    notes,
  } = invoice || {};

  const doc = new PDFDocument({ size: "A4", margin: 36 });
  const stream = new PassThrough();
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise((res) =>
    doc.on("end", () => res(Buffer.concat(chunks)))
  );
  doc.pipe(stream);

  const titleColor = brand.primary || "#111111";
  const border = "#eae9e5";
  const text = "#222222";
  const subtext = "#6b6b6b";

  // Header
  doc.fontSize(22).fillColor(titleColor).text("INVOICE", { continued: true });
  doc
    .fontSize(12)
    .fillColor(subtext)
    .text(`  ${series}-${String(number).padStart(5, "0")}`);

  doc.moveDown(0.5);
  doc.fillColor(text).fontSize(10);
  doc.text(
    `Issue date: ${fmtDate(issue_date)}  ${
      due_date ? ` | Due: ${fmtDate(due_date)}` : ""
    }`
  );
  doc.text(`Status: ${status}`);

  doc.moveDown(0.8);
  const topY = doc.y;
  const leftW = 260;

  // Seller
  boxTitle(doc, "Seller");
  multiline(doc, prettyParty(seller)); // left column
  const afterSellerY = doc.y;

  // Buyer (right column)
  doc.y = topY;
  doc.x = 320;
  boxTitle(doc, "Bill To");
  multiline(doc, prettyParty(buyer));
  doc
    .moveTo(36, Math.max(afterSellerY, doc.y) + 6)
    .lineTo(559, Math.max(afterSellerY, doc.y) + 6)
    .strokeColor(border)
    .stroke();

  // Lines table
  doc.moveDown(1.2);
  tableHeader(
    doc,
    ["Description", "Qty", "Unit", "VAT%", "Tax", "Total"],
    [300, 50, 70, 50, 50, 70]
  );
  let alt = false;
  lines.forEach((l) => {
    tableRow(
      doc,
      [
        l.description,
        n(l.quantity),
        money(l.unit_price, currency),
        n(l.vat_rate),
        money(l.line_tax, currency),
        money(l.line_total, currency),
      ],
      [300, 50, 70, 50, 50, 70],
      alt
    );
    alt = !alt;
  });

  // Totals panel
  doc.moveDown(1);
  const x0 = 300;
  doc.x = x0;
  doc
    .fontSize(10)
    .fillColor(subtext)
    .text("Subtotal", x0, doc.y, { continued: true });
  doc.fillColor(text).text(` ${money(subtotal, currency)}`, { align: "right" });

  taxes.forEach((t) => {
    doc
      .fontSize(10)
      .fillColor(subtext)
      .text(`VAT ${n(t.rate)}% on ${money(t.base, currency)}`, x0, doc.y, {
        continued: true,
      });
    doc
      .fillColor(text)
      .text(` ${money(t.amount, currency)}`, { align: "right" });
  });

  doc.moveDown(0.3);
  doc
    .lineWidth(1)
    .strokeColor(border)
    .moveTo(x0, doc.y)
    .lineTo(559, doc.y)
    .stroke();
  doc.moveDown(0.3);

  doc
    .fontSize(12)
    .fillColor(text)
    .text("Total", x0, doc.y, { continued: true });
  doc.fontSize(12).text(` ${money(total, currency)}`, { align: "right" });

  // Notes
  if (notes) {
    doc.moveDown(1);
    boxTitle(doc, "Notes");
    doc.fontSize(10).fillColor(text).text(notes);
  }

  // Footer
  doc.moveTo(36, 806).lineTo(559, 806).strokeColor(border).stroke();
  doc
    .fontSize(9)
    .fillColor(subtext)
    .text("Thank you!", 36, 810, { align: "left" });

  doc.end();
  return done;
}

// helpers
function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso || "";
  }
}
function money(n, curr) {
  const v = Number(n || 0);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: curr,
      maximumFractionDigits: 2,
    }).format(v);
  } catch {
    return `${v.toFixed(2)} ${curr || ""}`;
  }
}
function n(x) {
  const v = Number(x || 0);
  return Number.isFinite(v) ? String(v) : "";
}
function boxTitle(doc, t) {
  doc.fontSize(11).fillColor("#444").text(t);
}
function multiline(doc, obj) {
  const a = [];
  if (!obj) return;
  if (obj.business_name) a.push(obj.business_name);
  if (obj.name && obj.name !== obj.business_name) a.push(obj.name);
  if (obj.address) {
    const ad = [
      obj.address.line1,
      obj.address.line2,
      [obj.address.postal_code, obj.address.city].filter(Boolean).join(" "),
      obj.address.country,
    ].filter(Boolean);
    a.push(ad.join(", "));
  }
  if (obj.vat) a.push(`VAT: ${obj.vat}`);
  if (obj.email) a.push(obj.email);
  if (obj.phone) a.push(obj.phone);
  doc.fillColor("#222").fontSize(10).text(a.filter(Boolean).join("\n"));
}
function tableHeader(doc, cells, widths) {
  doc.rect(36, doc.y, 523, 22).fill("#f6f6f4").fillColor("#222");
  let x = 42,
    y = doc.y + 6;
  cells.forEach((c, i) => {
    doc
      .fontSize(10)
      .text(c, x, y, { width: widths[i], align: i ? "right" : "left" });
    x += widths[i];
  });
  doc.y += 22;
}
function tableRow(doc, cells, widths, alt) {
  if (alt) {
    doc.rect(36, doc.y, 523, 20).fill("#fbfbfa");
  }
  let x = 42,
    y = doc.y + 4;
  doc.fillColor("#222");
  cells.forEach((c, i) => {
    doc
      .fontSize(10)
      .text(String(c ?? ""), x, y, {
        width: widths[i],
        align: i ? "right" : "left",
      });
    x += widths[i];
  });
  doc.y += 20;
}
