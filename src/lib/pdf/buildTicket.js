import "server-only";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * buildTicketPdfBuffer (v3)
 *
 * Design upgrades over v2:
 * - Solid branded masthead with logo (left) and booking info + status (right)
 * - Ticket-style HERO with vertical "stub" (QR + ref) and main card (title + when/where)
 * - Vertical perforation between hero main card and stub
 * - Order Summary and Attendees rendered in soft cards with clearer hierarchy
 * - Attendees table with header row and zebra striping
 * - Link-style pill buttons (e.g., Open in Maps)
 * - Footer brand mark + cleaner microcopy
 *
 * Backward compatible. New optional args: brandName (fallback text in masthead).
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
    primary = "#8b6f47", // brand bronze
    text = "#2b2a28",
    subtext = "#6b665d",
    border = "#efeae1",
    surface = "#fbf9f6", // soft paper for cards/rows
    accent = "#b9a07a",
  } = brand || {};

  // ---------- Helpers ----------
  function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return m
      ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
      : { r: 0, g: 0, b: 0 };
  }
  function shade(hex, factor = 0.9) {
    const { r, g, b } = hexToRgb(hex);
    const f = Math.max(0, Math.min(1, factor));
    const nr = Math.round(r * f),
      ng = Math.round(g * f),
      nb = Math.round(b * f);
    return `#${nr.toString(16).padStart(2, "0")}${ng
      .toString(16)
      .padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
  }

  async function safeLoadImage(src) {
    try {
      if (!src) return null;
      if (/^https?:\/\//i.test(src)) {
        if (typeof fetch !== "function") return null;
        const res = await fetch(src);
        if (!res.ok) return null;
        const ab = await res.arrayBuffer();
        return Buffer.from(ab);
      }
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

    const FS = { title: 23, h2: 11, body: 11.5, small: 9.5 };
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

    function chip(
      txt,
      x,
      y,
      { fg = primary, invert = false, ghost = false } = {}
    ) {
      const padX = 10,
        padY = 5,
        h = 20;
      const w = doc.widthOfString(txt) + padX * 2;
      doc.save();
      doc
        .roundedRect(x, y, w, h, 10)
        .lineWidth(LINE.hair)
        .strokeColor(invert ? "#ffffff" : fg)
        .stroke();
      if (invert || ghost) {
        doc
          .roundedRect(x, y, w, h, 10)
          .fillOpacity(invert ? 0.1 : 0.06)
          .fillColor(invert ? "#ffffff" : fg)
          .fill()
          .fillOpacity(1);
      }
      doc
        .fillColor(invert ? "#ffffff" : fg)
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

    function pillLink(txt, url, x, y) {
      const padX = 10,
        padY = 6;
      const w = doc.widthOfString(txt) + padX * 2;
      const h = 22;
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
        .text(txt, x + padX, y + padY - 3, { link: url, underline: false })
        .restore();
      return { w, h };
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

    // ================= MASTHEAD =================
    const mastheadH = 68;
    doc.save().rect(0, 0, doc.page.width, mastheadH).fill(primary).restore();

    const mastPadX = M;
    const mastPadY = 18;
    const sColor = statusColor(statusLabel);

    // Logo or brand text
    if (logoBuf) {
      try {
        doc.image(logoBuf, mastPadX, mastPadY - 2, { height: 30 });
      } catch {
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

    // Right side: booking ref + status
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
    chip(String(statusLabel).toUpperCase(), rightEdge - 130, mastPadY + 28, {
      fg: sColor,
      invert: true,
    });

    // ================= HERO (ticket with stub) =================
    const heroTop = mastheadH + 18;
    const heroLeft = M;
    const heroRight = rightEdge;
    const heroW = heroRight - heroLeft;

    const gap = 18;
    const stubW = 180; // right stub width
    const mainW = heroW - stubW - gap;

    const cardPad = 18;
    const qrSize = qrImgBuf ? 124 : 0;
    const qrPad = 8;

    const mainX = heroLeft;
    const stubX = heroLeft + mainW + gap;

    const heroH = Math.max(
      170,
      qrImgBuf ? qrSize + qrPad * 2 + 22 + cardPad * 2 - 8 : 170
    );

    // Main card background
    doc
      .save()
      .roundedRect(mainX, heroTop, mainW, heroH, 12)
      .fillColor(surface)
      .fill()
      .restore();

    // Stub background
    doc
      .save()
      .roundedRect(stubX, heroTop, stubW, heroH, 12)
      .fillColor("#ffffff")
      .strokeColor(border)
      .lineWidth(LINE.hair)
      .stroke()
      .restore();

    // Perforation between
    vDash(
      stubX - gap / 2,
      heroTop + 10,
      heroTop + heroH - 10,
      shade(border, 0.9)
    );

    // --- Main content (left) ---
    const whenText = [dateLabel, timeLabel ? `, ${timeLabel}` : ""]
      .filter(Boolean)
      .join("");
    const whereText = location || "-";

    doc
      .font("Body-Bold")
      .fontSize(FS.title)
      .fillColor(text)
      .text(
        experienceName || "Your reservation",
        mainX + cardPad,
        heroTop + cardPad,
        { width: mainW - cardPad * 2, lineGap: 1 }
      );

    let infoY = Math.max(doc.y + 8, heroTop + 52);
    const w1 = mainW - cardPad * 2;
    const whenBlock = labelValue(
      "When",
      whenText || "-",
      mainX + cardPad,
      infoY,
      w1
    );
    infoY = whenBlock.nextY + 6;
    const whereBlock = labelValue(
      "Where",
      whereText,
      mainX + cardPad,
      infoY,
      w1
    );
    infoY = whereBlock.nextY + 8;

    if (location) {
      const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        location
      )}`;
      pillLink("Open in Maps", mapUrl, mainX + cardPad, infoY);
    }

    // --- Stub content (right) ---
    const stubInnerX = stubX + cardPad;
    let stubY = heroTop + cardPad;

    if (qrImgBuf) {
      const qrW = qrSize + qrPad * 2;
      doc
        .save()
        .roundedRect(stubInnerX, stubY, qrW, qrW + 22, 10)
        .lineWidth(LINE.hair)
        .strokeColor(border)
        .stroke()
        .image(qrImgBuf, stubInnerX + qrPad, stubY + qrPad, { width: qrSize })
        .font("Body")
        .fontSize(FS.small)
        .fillColor(subtext)
        .text("Scan at check-in", stubInnerX + 6, stubY + qrW - 4, {
          width: qrW - 12,
          align: "center",
        })
        .restore();
      stubY += qrW + 28;
    }

    if (bookingRef) {
      doc
        .font("Body-Bold")
        .fontSize(FS.small)
        .fillColor(subtext)
        .text("Reference", stubInnerX, stubY);
      doc
        .font("Body")
        .fontSize(FS.body)
        .fillColor(text)
        .text(String(bookingRef), stubInnerX, stubY + 12, {
          width: stubW - cardPad * 2,
        });
      stubY = doc.y + 6;
    }

    const sCol = statusColor(statusLabel);
    chip(String(statusLabel).toUpperCase(), stubInnerX, stubY + 4, {
      fg: sCol,
      ghost: true,
    });

    // Move flow after hero
    doc.y = heroTop + heroH + 16;

    // ================= ORDER SUMMARY (card) =================
    let y = doc.y;
    y = sectionTitle("Order Summary", M, y) + 6;

    const osTop = y;
    const osW = rightEdge - M;
    const osPad = 14;
    const labelColW = 150;

    // card frame
    doc
      .save()
      .roundedRect(M, osTop - 8, osW, 92, 10)
      .fillColor("#ffffff")
      .fill()
      .strokeColor(border)
      .lineWidth(LINE.hair)
      .stroke()
      .restore();

    y = osTop + osPad - 2;

    function row(label, value, emphasize = false) {
      const rH = 20;
      ensureSpace(rH, 0);
      doc
        .font(emphasize ? "Body-Bold" : "Body")
        .fontSize(emphasize ? FS.body + 0.5 : FS.body - 0.5)
        .fillColor(emphasize ? text : subtext)
        .text(label, M + osPad, y, { width: labelColW });

      doc
        .font(emphasize ? "Body-Bold" : "Body")
        .fontSize(FS.body)
        .fillColor(text)
        .text(value, M + osPad + labelColW + 10, y, {
          width: osW - (osPad * 2 + labelColW + 10),
        });

      y += rH;
      doc.y = y;
    }

    const whenPretty = whenText || "-";
    row("Experience", experienceName || "-");
    row("Date", whenPretty);

    // subtle divider
    hr(y - 4);
    y += 4;
    doc.y = y;

    if (receiptUrl) {
      row("Receipt", receiptUrl);
      // Link overlay
      doc
        .font("Body-Bold")
        .fontSize(FS.small)
        .fillColor(primary)
        .text("Open receipt", M + osPad + labelColW + 10, y - 18, {
          link: receiptUrl,
          underline: true,
        });
    }

    const pretty = currencyPretty(amountLabel, currency);
    row("Total", `${pretty}${currency ? ` (${currency})` : ""}`, true);

    // ================= ATTENDEES (card + table) =================
    y += 12;
    y = sectionTitle("Attendees", M, y) + 6;
    const atTop = y;
    const atW = rightEdge - M;

    if (!attendees.length) {
      const emptyH = 44;
      doc
        .save()
        .roundedRect(M, atTop - 8, atW, emptyH, 10)
        .fillColor("#ffffff")
        .fill()
        .strokeColor(border)
        .lineWidth(LINE.hair)
        .stroke()
        .restore();
      doc
        .font("Body")
        .fontSize(FS.body)
        .fillColor(text)
        .text("No attendee names on file.", M + 14, atTop + 6);
      doc.y = atTop + emptyH;
    } else {
      // header row
      let localY = atTop;
      const rowH = 22;
      const numW = 36;

      // card background grows with content; we will stroke after content to match height
      // background behind header
      doc
        .save()
        .roundedRect(M, atTop - 8, atW, rowH + 14, 10)
        .fillColor("#ffffff")
        .fill()
        .strokeColor(border)
        .lineWidth(LINE.hair)
        .stroke()
        .restore();

      // header text
      doc
        .font("Body-Bold")
        .fontSize(FS.small)
        .fillColor(subtext)
        .text("No.", M + 14, localY);
      doc
        .font("Body-Bold")
        .fontSize(FS.small)
        .fillColor(subtext)
        .text("Name", M + 14 + numW, localY);
      localY += rowH - 2;

      // rows
      attendees.forEach((a, i) => {
        if (localY + rowH > pageBottom()) {
          // draw border for previous page section
          doc
            .roundedRect(M, atTop - 8, atW, localY - (atTop - 8) + 8, 10)
            .lineWidth(LINE.hair)
            .strokeColor(border)
            .stroke();
          doc.addPage();
          doc.font("Body");
          sectionTitle("Attendees (cont.)", M, M);
          localY = doc.y + 6;
        }

        if (i % 2 === 0) {
          doc
            .save()
            .rect(M + 1, localY - 1, atW - 2, rowH)
            .fillColor(surface)
            .fill()
            .restore();
        }

        doc
          .font("Body")
          .fontSize(FS.body - 0.5)
          .fillColor(subtext)
          .text(String(i + 1).padStart(2, "0"), M + 14, localY, {
            width: numW - 8,
          });
        doc
          .font("Body")
          .fontSize(FS.body)
          .fillColor(text)
          .text(a?.name || "Guest", M + 14 + numW, localY, {
            width: atW - (numW + 28),
          });

        localY += rowH;
      });

      // outer frame to encompass entire table
      doc
        .roundedRect(M, atTop - 8, atW, localY - (atTop - 8) + 8, 10)
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

    if (logoBuf) {
      try {
        doc.image(logoBuf, M, footY - 1, { height: 14 });
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
