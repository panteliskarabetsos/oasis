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
    statusLabel = "CONFIRMED",
  } = args;

  const {
    primary = "#8b6f47",
    text = "#2b2a28",
    subtext = "#6b665d",
    border = "#efeae1",
  } = brand || {};

  // ---------- Resolve fonts BEFORE creating the PDF ----------
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

  // ---------- Precompute QR ----------
  let qrImgBuf = null;
  try {
    const dataUrl = await QRCode.toDataURL(
      qrValue || String(bookingRef || "booking"),
      { margin: 0, scale: 8 }
    );
    qrImgBuf = Buffer.from(dataUrl.split(",")[1], "base64");
  } catch {}

  // ---------- Create doc ----------
  const doc = new PDFDocument({ size: "A4", margin: 36, font: regularBuf });

  const chunks = [];
  return await new Promise((resolve, reject) => {
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Fonts
    doc.registerFont("Body", regularBuf);
    doc.registerFont("Body-Bold", boldBuf);
    doc.registerFont("Helvetica", regularBuf);
    doc.registerFont("Helvetica-Bold", boldBuf);
    doc.font("Body");

    // ---------- tokens / helpers ----------
    const M = 36; // page margin
    const rightEdge = doc.page.width - M;
    const pageBottom = () => doc.page.height - M;

    const FS = { title: 21, h2: 11, body: 11.5, small: 9.5 };
    const LINE = { hair: 0.5, reg: 1 };

    function ensureSpace(h, gap = 8) {
      if (doc.y + h > pageBottom()) {
        doc.addPage();
        doc.font("Body");
        doc.y = M;
      } else {
        doc.moveDown(gap / 12);
      }
    }

    function hr(y) {
      doc
        .moveTo(M, y)
        .lineTo(rightEdge, y)
        .strokeColor(border)
        .lineWidth(LINE.hair)
        .stroke();
    }

    function perforation(y) {
      doc
        .save()
        .dash(2.5, { space: 4 })
        .moveTo(M, y)
        .lineTo(rightEdge, y)
        .strokeColor(border)
        .lineWidth(LINE.hair)
        .stroke()
        .undash();
      const r = 5;
      doc.circle(M, y, r).fill("#ffffff");
      doc.circle(rightEdge, y, r).fill("#ffffff");
      doc.restore();
    }

    function chip(txt, x, y, { fg = primary } = {}) {
      const padX = 10,
        padY = 5,
        h = 20;
      const w = doc.widthOfString(txt) + padX * 2;
      doc
        .save()
        .roundedRect(x, y, w, h, 10)
        .lineWidth(LINE.hair)
        .strokeColor(fg)
        .stroke()
        .fillColor(fg)
        .font("Body-Bold")
        .fontSize(FS.small)
        .text(txt, x + padX, y + padY - 2, { characterSpacing: 0.2 })
        .restore();
      return { w, h };
    }

    function statusColor(status = "CONFIRMED") {
      const s = String(status).toUpperCase();
      if (s === "CANCELLED") return "#c03636";
      if (s === "PENDING") return "#a15d00";
      if (s === "RESCHEDULED") return "#1b63a6";
      return primary;
    }

    function sectionTitle(txt, x, y) {
      doc
        .font("Body-Bold")
        .fontSize(FS.h2)
        .fillColor(subtext)
        .text(String(txt).toUpperCase(), x, y, { characterSpacing: 0.6 });
      return doc.y;
    }

    function labelValueHeight(
      value,
      labelSize = FS.small,
      valueSize = FS.body,
      width = 260
    ) {
      doc.font("Body-Bold").fontSize(labelSize);
      const labelH = doc.currentLineHeight();
      doc.font("Body").fontSize(valueSize);
      const valueH = doc.heightOfString(String(value ?? ""), { width });
      return Math.ceil(labelH + 2 + valueH);
    }

    function labelValue(
      label,
      value,
      x,
      y,
      width = 260,
      labelSize = FS.small,
      valueSize = FS.body
    ) {
      doc
        .font("Body-Bold")
        .fontSize(labelSize)
        .fillColor(subtext)
        .text(label, x, y);
      doc
        .font("Body")
        .fontSize(valueSize)
        .fillColor(text)
        .text(String(value ?? "-"), x, y + doc.currentLineHeight() + 1, {
          width,
        });
      const h = labelValueHeight(value, labelSize, valueSize, width);
      return { nextY: Math.max(doc.y, y + h), h };
    }

    function linkText(txt, url, x, y, width) {
      doc
        .font("Body-Bold")
        .fontSize(FS.small)
        .fillColor(primary)
        .text(txt, x, y, { width, underline: true, link: url });
    }

    function currencyPretty(value, curr = currency) {
      try {
        const num = Number(
          String(value ?? "")
            .replace(/[^\d.,-]/g, "")
            .replace(",", ".")
        );
        if (Number.isFinite(num)) {
          return new Intl.NumberFormat("en-GB", {
            style: "currency",
            currency: curr || "EUR",
            minimumFractionDigits: 2,
          }).format(num);
        }
        return String(value ?? "-");
      } catch {
        return String(value ?? "-");
      }
    }

    // ========== HEADER ==========
    const topY = M;
    // Thin top hairline and tiny padding gives a minimal masthead feel
    hr(topY);
    let y = topY + 10;

    // Left: logo/title; Right: booking ref
    try {
      if (logoUrl) {
        doc.image(logoUrl, M, y - 2, { width: 110 }).fillColor(text);
      } else {
        doc
          .font("Body-Bold")
          .fontSize(14)
          .fillColor(text)
          .text("Booking Confirmation", M, y);
      }
    } catch {
      doc
        .font("Body-Bold")
        .fontSize(14)
        .fillColor(text)
        .text("Booking Confirmation", M, y);
    }

    if (bookingRef) {
      doc
        .font("Body")
        .fontSize(FS.small)
        .fillColor(subtext)
        .text(`Reference: ${bookingRef}`, rightEdge - 220, y, {
          width: 200,
          align: "right",
        });
    }

    // Status chip (left, below)
    const sColor = statusColor(statusLabel);
    chip(String(statusLabel).toUpperCase(), M, y + 20, { fg: sColor });

    // ========== HERO (Title + QR) ==========
    const heroTop = y + 48;

    // QR on right in a delicate frame
    const qrSize = qrImgBuf ? 144 : 0;
    const qrPad = 10;
    const qrW = qrSize ? qrSize + qrPad * 2 : 0;
    const qrX = qrSize ? rightEdge - qrW : 0;
    const qrY = heroTop;

    if (qrImgBuf) {
      doc
        .save()
        .roundedRect(qrX, qrY, qrW, qrW + 26, 10)
        .lineWidth(LINE.hair)
        .strokeColor(border)
        .stroke()
        .image(qrImgBuf, qrX + qrPad, qrY + qrPad, { width: qrSize })
        .font("Body")
        .fontSize(FS.small)
        .fillColor(subtext)
        .text("Scan at check-in", qrX + 6, qrY + qrW - 6, {
          width: qrW - 12,
          align: "center",
        })
        .restore();
    }

    const gutter = 20;
    const leftColRight = qrImgBuf ? qrX - gutter : rightEdge;
    const leftColWidth = leftColRight - M;

    // Experience title
    doc
      .font("Body-Bold")
      .fontSize(FS.title)
      .fillColor(text)
      .text(experienceName || "Your reservation", M, heroTop, {
        width: leftColWidth,
        lineGap: 1,
      });

    // ========== DETAILS (no boxes — just spacing) ==========
    const whenText = [dateLabel, timeLabel ? `, ${timeLabel}` : ""]
      .filter(Boolean)
      .join("");
    const whereText = location || "-";

    const detailsTop = Math.max(doc.y + 8, heroTop + 56);
    ensureSpace(60);

    // two stacked label-value blocks
    let lvY = detailsTop;
    const whenBlock = labelValue("When", whenText || "-", M, lvY, leftColWidth);
    lvY = whenBlock.nextY + 10;

    const whereBlock = labelValue("Where", whereText, M, lvY, leftColWidth);
    lvY = whereBlock.nextY + 4;

    // links under Where
    if (location) {
      const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        location
      )}`;
      linkText("Open in Maps", mapUrl, M, lvY, leftColWidth);
      lvY += 16;
    }

    // Perforation after the lower of (details vs QR)
    const perfY = Math.max(lvY, qrImgBuf ? qrY + qrW + 26 : lvY) + 16;
    perforation(perfY);

    // ========== ORDER SUMMARY ==========
    y = perfY + 18;
    y = sectionTitle("Order Summary", M, y) + 6;

    function row(label, value, emphasize = false) {
      const rH = 18;
      ensureSpace(rH, 0);
      doc
        .font(emphasize ? "Body-Bold" : "Body")
        .fontSize(emphasize ? FS.body + 0.5 : FS.body - 0.5)
        .fillColor(emphasize ? text : subtext)
        .text(label, M, y, { width: 150 });

      doc
        .font(emphasize ? "Body-Bold" : "Body")
        .fontSize(FS.body)
        .fillColor(text)
        .text(value, M + 160, y, {
          width: rightEdge - (M + 160),
          align: "left",
        });

      y += rH;
      doc.y = y;
    }

    row("Experience", experienceName || "-");
    row("Date", whenText || "-");

    // hairline
    hr(y - 4);
    y += 4;
    doc.y = y;

    if (receiptUrl) {
      row("Receipt", receiptUrl);
      linkText(
        "Open receipt",
        receiptUrl,
        M + 160,
        y - 18,
        rightEdge - (M + 160)
      );
    }

    const pretty = currencyPretty(amountLabel, currency);
    row("Total", `${pretty}${currency ? ` (${currency})` : ""}`, true);

    // ========== ATTENDEES ==========
    y += 10;
    y = sectionTitle("Attendees", M, y) + 6;
    doc.y = y;

    const tableTop = doc.y;
    const frameW = rightEdge - M;

    if (!attendees.length) {
      ensureSpace(18, 0);
      doc
        .font("Body")
        .fontSize(FS.body)
        .fillColor(text)
        .text("No attendee names on file.", M, doc.y);
      doc.y += 18;
      // subtle frame
      doc
        .roundedRect(M, tableTop - 6, frameW, doc.y - tableTop + 12, 8)
        .lineWidth(LINE.hair)
        .strokeColor(border)
        .stroke();
    } else {
      let localY = doc.y;
      attendees.forEach((a, i) => {
        const rH = 18;
        if (localY + rH > pageBottom()) {
          // close frame
          doc
            .roundedRect(M, tableTop - 6, frameW, localY - tableTop + 12, 8)
            .lineWidth(LINE.hair)
            .strokeColor(border)
            .stroke();
          // new page / continuation
          doc.addPage();
          doc.font("Body");
          const contTop = M;
          sectionTitle("Attendees (cont.)", M, contTop);
          localY = doc.y + 6;
        }

        // row content
        doc
          .font("Body")
          .fontSize(FS.body - 0.5)
          .fillColor(subtext)
          .text(String(i + 1).padStart(2, "0"), M, localY, { width: 30 });
        doc
          .font("Body")
          .fontSize(FS.body)
          .fillColor(text)
          .text(a?.name || "Guest", M + 36, localY, { width: frameW - 36 });
        localY += rH;
      });

      // single delicate frame around the list
      doc
        .roundedRect(M, tableTop - 6, frameW, localY - tableTop + 12, 8)
        .lineWidth(LINE.hair)
        .strokeColor(border)
        .stroke();
      doc.y = localY;
    }

    // ========== FOOTER ==========
    doc.moveDown(1);
    let footY = doc.y + 6;
    ensureSpace(36, 0);
    hr(footY);
    footY += 8;

    doc
      .font("Body")
      .fontSize(FS.small)
      .fillColor(subtext)
      .text(
        "Present this PDF or the QR code at check-in. For changes or questions, reply to the confirmation email.",
        M,
        footY,
        { width: rightEdge - M }
      );

    doc
      .font("Body")
      .fontSize(FS.small)
      .fillColor(subtext)
      .text("Page 1", rightEdge - 70, doc.page.height - M - 8, {
        width: 60,
        align: "right",
      });

    doc.end();
  });
}
