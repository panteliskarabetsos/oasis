import "server-only";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export default async function buildTicketPdfBuffer(args = {}) {
  const {
    brand = {},
    logoUrl,
    experienceName,
    location,
    dateLabel,
    timeLabel,
    attendees = [],
    amountLabel,
    currency = "EUR",
    bookingRef = "",
    receiptUrl,
    qrValue,
    fontDir, // optional override
  } = args;

  const {
    primary = "#8b6f47",
    text = "#2b2a28",
    subtext = "#6b665d",
    border = "#efeae1",
    panel = "#fcfbf8",
  } = brand || {};

  // ---------- Resolve font paths and read BEFORE new PDFDocument ----------
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const candidates = [
    fontDir,
    path.join(process.cwd(), "public", "fonts"),
    path.join(__dirname, "..", "..", "..", "public", "fonts"),
  ].filter(Boolean);

  const base =
    candidates.find(
      (p) =>
        fs.existsSync(path.join(p, "Inter-Regular.ttf")) &&
        fs.existsSync(path.join(p, "Inter-Bold.ttf"))
    ) || null;

  if (!base) {
    throw new Error(
      `[ticket] Inter font files not found.\nChecked:\n${candidates.join(
        "\n"
      )}\n` +
        `Add Inter-Regular.ttf and Inter-Bold.ttf to public/fonts (or pass { fontDir }).`
    );
  }

  const regularBuf = fs.readFileSync(path.join(base, "Inter-Regular.ttf"));
  const boldBuf = fs.readFileSync(path.join(base, "Inter-Bold.ttf"));

  // ---------- Precompute QR (async) ----------
  let qrImgBuf = null;
  try {
    const dataUrl = await QRCode.toDataURL(
      qrValue || String(bookingRef || "booking"),
      {
        margin: 0,
        scale: 8,
      }
    );
    qrImgBuf = Buffer.from(dataUrl.split(",")[1], "base64");
  } catch {}

  // ---------- Create doc with our TTF as the initial font ----------
  const doc = new PDFDocument({ size: "A4", margin: 36, font: regularBuf });

  const chunks = [];
  return await new Promise((resolve, reject) => {
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Register fonts and aliases (so any stray 'Helvetica' never hits AFM files)
    doc.registerFont("Body", regularBuf);
    doc.registerFont("Body-Bold", boldBuf);
    doc.registerFont("Helvetica", regularBuf);
    doc.registerFont("Helvetica-Bold", boldBuf);

    // Use our font from here on
    // Use our font from here on
    doc.font("Body");

    // ---------- helpers ----------
    function chip(txt, x, y, { bg = panel, fg = primary } = {}) {
      const padX = 10,
        padY = 6;
      const w = doc.widthOfString(txt) + padX * 2;
      const h = 22;
      doc
        .save()
        .roundedRect(x, y, w, h, 8)
        .fill(bg)
        .fillColor(fg)
        .font("Body-Bold")
        .fontSize(11)
        .text(txt, x + padX, y + padY - 2)
        .restore();
      return { w, h };
    }
    function sectionTitle(txt, x, y) {
      doc.font("Body-Bold").fontSize(13).fillColor(subtext).text(txt, x, y);
      return doc.y;
    }
    function labelValue(label, value, xLabel, xValue, y, width = 240) {
      doc
        .font("Body-Bold")
        .fontSize(12)
        .fillColor(subtext)
        .text(label, xLabel, y);
      doc
        .font("Body")
        .fontSize(13)
        .fillColor(text)
        .text(value, xValue, y + 16, { width });
    }
    function divider(y) {
      doc
        .moveTo(36, y)
        .lineTo(rightEdge, y)
        .strokeColor(border)
        .lineWidth(1)
        .stroke();
    }
    function dashedPerforation(y) {
      doc
        .save()
        .dash(3, { space: 4 })
        .moveTo(36, y)
        .lineTo(rightEdge, y)
        .strokeColor(border)
        .lineWidth(1)
        .stroke()
        .undash();
      // notch “cutouts”
      const r = 6;
      doc.circle(36, y, r).fill("#ffffff");
      doc.circle(rightEdge, y, r).fill("#ffffff");
      doc.restore();
    }

    // ---------- header band ----------
    doc
      .rect(36, 36, doc.page.width - 72, 6)
      .fill(primary)
      .fillColor(text);

    const yStart = 56;

    // logo / title
    try {
      if (logoUrl) {
        doc.image(logoUrl, 36, yStart, { width: 120 }).fillColor(text);
      } else {
        doc
          .font("Body-Bold")
          .fontSize(16)
          .fillColor(text)
          .text("Booking Confirmation", 36, yStart);
      }
    } catch {
      doc
        .font("Body-Bold")
        .fontSize(16)
        .fillColor(text)
        .text("Booking Confirmation", 36, yStart);
    }

    // status chip
    const chipXY = { x: 36, y: yStart + 28 };
    chip("CONFIRMED", chipXY.x, chipXY.y);

    // QR block (right side, framed)
    if (qrImgBuf) {
      const qrSize = 150;
      const qrX = doc.page.width - 36 - qrSize;
      const qrY = yStart;
      doc
        .save()
        .roundedRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 36, 12)
        .fill(panel)
        .strokeColor(border)
        .lineWidth(1)
        .stroke()
        .image(qrImgBuf, qrX, qrY, { width: qrSize })
        .font("Body")
        .fontSize(10)
        .fillColor(subtext)
        .text("Scan at check-in", qrX - 6, qrY + qrSize + 8, {
          width: qrSize + 12,
          align: "center",
        })
        .restore();
    }

    const rightEdge = doc.page.width - 36;

    // title & reference
    doc
      .font("Body-Bold")
      .fontSize(22)
      .fillColor(text)
      .text(experienceName || "Your reservation", 36, chipXY.y + 28, {
        width: rightEdge - 36 - 160,
      });
    if (bookingRef) {
      doc
        .font("Body")
        .fontSize(12)
        .fillColor(subtext)
        .text(`Reference: ${bookingRef}`, 36, doc.y + 6);
    }

    // ---------- details card ----------
    doc.moveDown(0.6);
    const cardTop = doc.y + 6;
    const cardHeight = 110;
    doc
      .roundedRect(36, cardTop, rightEdge - 36, cardHeight, 12)
      .fill(panel)
      .fillColor(text);

    let cursorY = cardTop + 12;
    labelValue(
      "When",
      [dateLabel, timeLabel ? `, ${timeLabel}` : ""].filter(Boolean).join(""),
      48,
      48,
      cursorY,
      260
    );
    labelValue("Location", location || "-", 300, 300, cursorY, rightEdge - 316);

    // ---------- perforation ----------
    const perfY = cardTop + cardHeight + 18;
    dashedPerforation(perfY);

    // ---------- order summary ----------
    let y = perfY + 16;
    y = sectionTitle("Order Summary", 36, y) + 6;

    const rowHeight = 20;
    function row(label, value, emphasize = false) {
      doc
        .font(emphasize ? "Body-Bold" : "Body")
        .fontSize(emphasize ? 13 : 12)
        .fillColor(emphasize ? text : subtext)
        .text(label, 36, y, { width: 150 });
      doc
        .font(emphasize ? "Body-Bold" : "Body")
        .fillColor(text)
        .text(value, 200, y, { width: rightEdge - 200, align: "left" });
      y += rowHeight;
    }

    row("Experience", experienceName || "-");
    row(
      "Date",
      [dateLabel, timeLabel ? `, ${timeLabel}` : ""].filter(Boolean).join("")
    );
    // subtle divider
    divider(y - 6);
    y += 4;

    if (receiptUrl) {
      row("Receipt", receiptUrl);
      doc
        .fillColor(primary)
        .text("Open receipt →", 200, y - rowHeight, {
          link: receiptUrl,
          underline: true,
        })
        .fillColor(text);
    }

    row(
      "Total",
      `${amountLabel || "-"}${currency ? ` (${currency})` : ""}`,
      true
    );

    // ---------- attendees ----------
    y += 10;
    y = sectionTitle("Attendees", 36, y) + 8;

    if (!attendees.length) {
      doc
        .font("Body")
        .fontSize(12)
        .fillColor(text)
        .text("No attendee names on file.", 36, y);
      y += rowHeight;
    } else {
      const startTableY = y;
      attendees.forEach((a, i) => {
        const zebra = i % 2 === 1;
        if (zebra) {
          doc
            .save()
            .rect(36, y - 2, rightEdge - 36, rowHeight)
            .fill(panel)
            .restore();
        }
        doc
          .font("Body")
          .fontSize(12)
          .fillColor(subtext)
          .text(String(i + 1).padStart(2, "0"), 36, y, { width: 30 });
        doc
          .font("Body")
          .fontSize(12)
          .fillColor(text)
          .text(a?.name || "Guest", 74, y);
        y += rowHeight;
      });
      // frame the table subtly
      doc
        .roundedRect(
          36,
          startTableY - 6,
          rightEdge - 36,
          y - startTableY + 12,
          8
        )
        .strokeColor(border)
        .lineWidth(1)
        .stroke();
    }

    // ---------- footer ----------
    y += 16;
    divider(y);
    y += 10;
    doc
      .font("Body")
      .fontSize(10)
      .fillColor(subtext)
      .text(
        "Present this PDF or the QR code at check-in. For changes or questions, reply to the confirmation email.",
        36,
        y,
        { width: rightEdge - 36 }
      );

    doc.end();
  });
}
