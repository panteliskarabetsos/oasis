import "server-only";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * buildTicketPdfBuffer (v2)
 *
 * Design updates:
 * - Branded masthead bar with logo (or brand name) and booking reference
 * - Status chip with smart colors, visible on dark masthead
 * - Hero "card" containing Title + QR in a rounded frame (tinted surface)
 * - Cleaner spacing, consistent section titles, improved footer
 * - Robust remote-logo support (http/https) via fetch -> Buffer
 *
 * Backward compatible with your existing args. Optionally pass brand.name for header text.
 */
export default async function buildTicketPdfBuffer(args = {}) {
  const {
    brand = {},
    brandName = "",
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
    primary = "#8b6f47", // brand gold/bronze
    text = "#2b2a28",
    subtext = "#6b665d",
    border = "#efeae1",
    surface = "#fbf9f6", // soft paper tint for cards
    accent = "#b9a07a", // slightly lighter accent for chips/frames
  } = brand || {};

  // ---------- Helpers ----------
  async function safeLoadImage(src) {
    try {
      if (!src) return null;
      // Remote URL
      if (/^https?:\/\//i.test(src)) {
        if (typeof fetch !== "function") return null;
        const res = await fetch(src);
        if (!res.ok) return null;
        const ab = await res.arrayBuffer();
        return Buffer.from(ab);
      }
      // Local path
      if (fs.existsSync(src)) return fs.readFileSync(src);
      return null;
    } catch {
      return null;
    }
  }

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

  // Preload logo (remote/local) -> Buffer if possible
  const logoBuf = await safeLoadImage(logoUrl);

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

    function hr(y, color = border) {
      doc
        .moveTo(M, y)
        .lineTo(rightEdge, y)
        .strokeColor(color)
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

    function chip(txt, x, y, { fg = primary, invert = false } = {}) {
      const padX = 10,
        padY = 5,
        h = 20;
      const w = doc.widthOfString(txt) + padX * 2;
      const textColor = invert ? "#ffffff" : fg;
      const strokeColor = invert ? "#ffffff" : fg;
      const fillColor = invert ? "#ffffff" : undefined; // ghost on light, outline on dark
      doc.save();
      doc
        .roundedRect(x, y, w, h, 10)
        .lineWidth(LINE.hair)
        .strokeColor(strokeColor)
        .stroke();
      if (fillColor) {
        doc
          .roundedRect(x, y, w, h, 10)
          .fillOpacity(0.08)
          .fillColor(fillColor)
          .fill()
          .fillOpacity(1);
      }
      doc
        .fillColor(textColor)
        .font("Body-Bold")
        .fontSize(FS.small)
        .text(txt, x + padX, y + padY - 2, { characterSpacing: 0.2 });
      doc.restore();
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

    // Compact rounded button-style link to prevent long URLs from spilling
    function pillLink(txt, url, x, y) {
      const padX = 10,
        padY = 6,
        h = 22;
      const w = doc.widthOfString(txt) + padX * 2;
      doc
        .save()
        .roundedRect(x, y, w, h, 11)
        .fillOpacity(0.08)
        .fillColor(primary)
        .fill()
        .fillOpacity(1)
        .strokeColor(primary)
        .lineWidth(LINE.hair)
        .stroke()
        .font("Body-Bold")
        .fontSize(FS.small)
        .fillColor(primary)
        .text(txt, x + padX, y + padY - 3, { link: url })
        .restore();
      return { w, h };
    }

    // Vertical dashed divider (used in hero card when QR is present)
    function vDash(x, y1, y2, color = border) {
      doc
        .save()
        .dash(2.5, { space: 4 })
        .moveTo(x, y1)
        .lineTo(x, y2)
        .strokeColor(color)
        .lineWidth(LINE.hair)
        .stroke()
        .undash()
        .restore();
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

    // ================= HEADER (Masthead) =================
    const mastheadH = 64;
    // full-bleed masthead background
    doc.save().rect(0, 0, doc.page.width, mastheadH).fill(primary).restore();

    // Logo or brand name on the left
    const mastPadX = M;
    const mastPadY = 16;
    const sColor = statusColor(statusLabel);

    if (logoBuf) {
      try {
        doc.image(logoBuf, mastPadX, mastPadY, { height: 32 });
      } catch {
        // fallback to text
        doc
          .font("Body-Bold")
          .fontSize(14)
          .fillColor("#ffffff")
          .text(brandName || "Booking", mastPadX, mastPadY + 6);
      }
    } else {
      doc
        .font("Body-Bold")
        .fontSize(14)
        .fillColor("#ffffff")
        .text(brandName || "Booking", mastPadX, mastPadY + 6);
    }

    // Right: booking ref + status chip (on dark background)
    if (bookingRef) {
      doc
        .font("Body")
        .fontSize(FS.small)
        .fillColor("#ffffff")
        .text(`Ref: ${bookingRef}`, rightEdge - 220, mastPadY + 2, {
          width: 200,
          align: "right",
        });
    }
    // status chip on masthead (uses white outline fill for contrast)
    chip(String(statusLabel).toUpperCase(), rightEdge - 120, mastPadY + 26, {
      fg: sColor,
      invert: true,
    });

    // ================= HERO CARD =================
    const heroTop = mastheadH + 16;
    const heroLeft = M;
    const heroRight = rightEdge;
    const heroW = heroRight - heroLeft;
    const heroHMin = 120;

    // card background
    doc
      .save()
      .roundedRect(heroLeft, heroTop, heroW, heroHMin, 12)
      .fillColor(surface)
      .fill()
      .restore();

    // QR on right in a delicate frame inside card
    const cardPad = 16;
    const qrSize = qrImgBuf ? 124 : 0;
    const qrPad = 8;
    const qrW = qrSize ? qrSize + qrPad * 2 : 0;
    const qrX = qrSize ? heroRight - cardPad - qrW : 0;
    const qrY = heroTop + cardPad;

    if (qrImgBuf) {
      doc
        .save()
        .roundedRect(qrX, qrY, qrW, qrW + 22, 10)
        .lineWidth(LINE.hair)
        .strokeColor(border)
        .stroke()
        .image(qrImgBuf, qrX + qrPad, qrY + qrPad, { width: qrSize })
        .font("Body")
        .fontSize(FS.small)
        .fillColor(subtext)
        .text("Scan at check‑in", qrX + 6, qrY + qrW - 4, {
          width: qrW - 12,
          align: "center",
        })
        .restore();
    }

    const gutter = 20;
    const leftColRight = qrImgBuf ? qrX - gutter : heroRight - cardPad;
    const leftColWidth = leftColRight - (heroLeft + cardPad);

    // Experience title
    doc
      .font("Body-Bold")
      .fontSize(FS.title)
      .fillColor(text)
      .text(
        experienceName || "Your reservation",
        heroLeft + cardPad,
        heroTop + cardPad,
        {
          width: leftColWidth,
          lineGap: 1,
        }
      );

    // when/where inside the card
    const whenText = [dateLabel, timeLabel ? `, ${timeLabel}` : ""]
      .filter(Boolean)
      .join("");
    const whereText = location || "-";

    const detailsTop = Math.max(doc.y + 8, heroTop + 54);
    let lvY = detailsTop;
    const whenBlock = labelValue(
      "When",
      whenText || "-",
      heroLeft + cardPad,
      lvY,
      leftColWidth
    );
    lvY = whenBlock.nextY + 6;
    const whereBlock = labelValue(
      "Where",
      whereText,
      heroLeft + cardPad,
      lvY,
      leftColWidth
    );
    lvY = whereBlock.nextY + 2;
    if (location) {
      const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        location
      )}`;
      pillLink("Open in Maps", mapUrl, heroLeft + cardPad, lvY);
      lvY += 26; // add space for pill height
    }

    // Adjust doc.y to after the hero card
    const heroBottom = Math.max(
      lvY + 24,
      qrImgBuf ? qrY + qrW + 22 + 16 : heroTop + heroHMin
    );
    // add a subtle vertical perforation between left content and QR panel when QR exists
    if (qrImgBuf) {
      const dividerX = leftColRight + 8;
      vDash(dividerX, heroTop + 10, heroBottom - 10, border);
    }
    doc.y = heroBottom;

    // Perforation divider for ticket feel
    perforation(doc.y + 8);

    // ================= ORDER SUMMARY =================
    let y = doc.y + 24;
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
      // Show only a compact link instead of the raw URL to avoid overflow
      row("Receipt", "");
      const pillX = M + 160;
      const pillY = y - 18; // align with row baseline
      pillLink("Open receipt", receiptUrl, pillX, pillY);
      y += 6; // extra breathing room under the pill
      doc.y = y;
    }

    const pretty = currencyPretty(amountLabel, currency);
    row("Total", `${pretty}${currency ? ` (${currency})` : ""}`, true);

    // ================= ATTENDEES =================
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

        // zebra stripe effect using very light fill
        if (i % 2 === 1) {
          doc
            .save()
            .rect(M, localY - 2, frameW, rH)
            .fillColor(surface)
            .fill()
            .restore();
        }

        // row content
        doc
          .font("Body")
          .fontSize(FS.body - 0.5)
          .fillColor(subtext)
          .text(String(i + 1).padStart(2, "0"), M + 8, localY, { width: 30 });
        doc
          .font("Body")
          .fontSize(FS.body)
          .fillColor(text)
          .text(a?.name || "Guest", M + 44, localY, { width: frameW - 52 });
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

    // ================= FOOTER =================
    doc.moveDown(1);
    let footY = doc.y + 6;
    ensureSpace(36, 0);
    hr(footY);
    footY += 8;

    // mini mark (logo or dot) + note
    if (logoBuf) {
      try {
        doc.image(logoBuf, M, footY - 2, { height: 14 });
      } catch {}
    } else {
      doc
        .save()
        .circle(M + 6, footY + 6, 3)
        .fillColor(accent)
        .fill()
        .restore();
    }

    doc
      .font("Body")
      .fontSize(FS.small)
      .fillColor(subtext)
      .text(
        "Present this PDF or the QR code at check-in. For changes or questions, reply to the confirmation email.",
        M + 24,
        footY,
        { width: rightEdge - (M + 24) }
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
