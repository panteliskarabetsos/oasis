import "server-only";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * buildTicketPdfBuffer (v5 — premium)
 *
 * Visual upgrades:
 * - Gradient masthead with logo on left, ref + status on right
 * - Premium hero: soft card, optional faint logo watermark, QR stub with perforated divider
 * - Pill links (Maps / Receipt), tidy URL handling
 * - Section cards with subtle elevation and clearer hierarchy
 * - Attendees table with header + zebra rows
 * - Safer footer that never forces a blank page (clamped)
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
    primary = "#8b6f47",
    text = "#2b2a28",
    subtext = "#6b665d",
    border = "#efeae1",
    surface = "#fbf9f6",
    accent = "#b9a07a",
  } = brand || {};

  // ---------- Helpers ----------
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

  function hexToRgb(hex) {
    const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
    if (!m) return { r: 0, g: 0, b: 0 };
    return {
      r: parseInt(m[1], 16),
      g: parseInt(m[2], 16),
      b: parseInt(m[3], 16),
    };
  }
  function shade(hex, f = 0.85) {
    const { r, g, b } = hexToRgb(hex);
    const nr = Math.round(r * f),
      ng = Math.round(g * f),
      nb = Math.round(b * f);
    return `#${nr.toString(16).padStart(2, "0")}${ng
      .toString(16)
      .padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
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
    doc.font("Body");

    // Tokens / helpers
    const M = 36;
    const rightEdge = doc.page.width - M;
    const pageBottom = () => doc.page.height - M;

    const FS = { title: 24, h2: 11, body: 11.5, small: 9.5 };
    const LINE = { hair: 0.5 };

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
      if (invert || ghost)
        doc
          .roundedRect(x, y, w, h, 10)
          .fillOpacity(invert ? 0.12 : 0.06)
          .fillColor(invert ? "#ffffff" : fg)
          .fill()
          .fillOpacity(1);
      doc
        .fillColor(invert ? "#ffffff" : fg)
        .font("Body-Bold")
        .fontSize(FS.small)
        .text(txt, x + padX, y + padY - 2, { characterSpacing: 0.2 });
      doc.restore();
      return { w, h };
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
      const valueH = doc.heightOfString(String(value ?? ""), { width });
      const h = Math.ceil(doc.currentLineHeight() + 2 + valueH);
      return { nextY: Math.max(doc.y, y + h), h };
    }
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
        .stroke();
      doc
        .font("Body-Bold")
        .fontSize(FS.small)
        .fillColor(primary)
        .text(txt, x + padX, y + padY - 3, { link: url });
      doc.restore();
      return { w, h };
    }
    function currencyPretty(value, curr = currency) {
      try {
        const num = Number(
          String(value ?? "")
            .replace(/[^\d.,-]/g, "")
            .replace(",", ".")
        );
        if (Number.isFinite(num))
          return new Intl.NumberFormat("en-GB", {
            style: "currency",
            currency: curr || "EUR",
            minimumFractionDigits: 2,
          }).format(num);
        return String(value ?? "-");
      } catch {
        return String(value ?? "-");
      }
    }

    // =============== MASTHEAD (Gradient) ===============
    const mastheadH = 70;
    const grad = doc.linearGradient(0, 0, doc.page.width, 0);
    grad.stop(0, shade(primary, 0.88));
    grad.stop(1, primary);
    doc.save().rect(0, 0, doc.page.width, mastheadH).fill(grad).restore();

    const mastPadX = M,
      mastPadY = 18;
    if (logoBuf) {
      try {
        doc.image(logoBuf, mastPadX, mastPadY - 2, { height: 30 });
      } catch {
        doc
          .font("Body-Bold")
          .fontSize(14)
          .fillColor("#fff")
          .text(brandName || "Booking", mastPadX, mastPadY + 6);
      }
    } else {
      doc
        .font("Body-Bold")
        .fontSize(14)
        .fillColor("#fff")
        .text(brandName || "Booking", mastPadX, mastPadY + 6);
    }

    if (bookingRef) {
      doc
        .font("Body")
        .fontSize(FS.small)
        .fillColor("#fff")
        .text(`Ref: ${bookingRef}`, rightEdge - 220, mastPadY + 2, {
          width: 200,
          align: "right",
        });
    }
    const sColor =
      (statusLabel || "").toUpperCase() === "CONFIRMED" ? "#ffffff" : "#ffffff";
    chip(String(statusLabel).toUpperCase(), rightEdge - 130, mastPadY + 28, {
      fg: sColor,
      invert: true,
    });

    // =============== HERO (card + QR stub) ===============
    const heroTop = mastheadH + 18;
    const heroLeft = M;
    const heroRight = rightEdge;
    const heroW = heroRight - heroLeft;
    const gap = 18;
    const stubW = 180;
    const mainW = heroW - stubW - gap;
    const cardPad = 18;

    // main card background with soft elevation
    doc
      .save()
      .roundedRect(heroLeft, heroTop, mainW, 10, 12)
      .fillColor(surface)
      .fill()
      .restore();

    // watermark logo (optional)
    if (logoBuf) {
      try {
        doc
          .save()
          .opacity(0.06)
          .image(logoBuf, heroLeft + mainW / 2 - 40, heroTop + 24, {
            width: 80,
          })
          .opacity(1)
          .restore();
      } catch {}
    }

    // title (with small logo mark if you prefer over watermark)
    let titleX = heroLeft + cardPad;
    doc
      .font("Body-Bold")
      .fontSize(FS.title)
      .fillColor(text)
      .text(experienceName || "Your reservation", titleX, heroTop + cardPad, {
        width: mainW - cardPad * 2,
        lineGap: 1,
      });

    const whenText = [dateLabel, timeLabel ? `, ${timeLabel}` : ""]
      .filter(Boolean)
      .join("");
    const whereText = location || "-";

    let infoY = Math.max(doc.y + 8, heroTop + 56);
    const w1 = mainW - cardPad * 2;
    infoY =
      labelValue("When", whenText || "-", heroLeft + cardPad, infoY, w1).nextY +
      6;
    infoY =
      labelValue("Where", whereText, heroLeft + cardPad, infoY, w1).nextY + 8;
    if (location) {
      const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        location
      )}`;
      pillLink("Open in Maps", mapUrl, heroLeft + cardPad, infoY);
      infoY += 26;
    }

    // stub with QR
    const qrSize = qrImgBuf ? 124 : 0;
    const qrPad = 8;
    let stubY = heroTop + cardPad;
    const stubX = heroLeft + mainW + gap;
    const stubH = Math.max(infoY + 24 - heroTop, qrSize + 22 + 2 * cardPad);

    doc
      .save()
      .roundedRect(stubX, heroTop, stubW, stubH, 12)
      .fillColor("#fff")
      .fill()
      .strokeColor(border)
      .lineWidth(LINE.hair)
      .stroke()
      .restore();
    if (qrImgBuf) {
      const qrW = qrSize + qrPad * 2;
      doc
        .save()
        .roundedRect(stubX + cardPad, stubY, qrW, qrW + 22, 10)
        .lineWidth(LINE.hair)
        .strokeColor(border)
        .stroke()
        .image(qrImgBuf, stubX + cardPad + qrPad, stubY + qrPad, {
          width: qrSize,
        })
        .font("Body")
        .fontSize(FS.small)
        .fillColor(subtext)
        .text("Scan at check‑in", stubX + cardPad + 6, stubY + qrW - 4, {
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
        .text("Reference", stubX + cardPad, stubY);
      doc
        .font("Body")
        .fontSize(FS.body)
        .fillColor(text)
        .text(String(bookingRef), stubX + cardPad, stubY + 12, {
          width: stubW - cardPad * 2,
        });
      stubY = doc.y + 4;
    }
    vDash(stubX - gap / 2, heroTop + 10, heroTop + stubH - 10, border);

    doc.y = heroTop + stubH + 20;

    // =============== ORDER SUMMARY (card) ===============
    const osTitleY = doc.y;
    const osTitle = "Order Summary";
    doc
      .font("Body-Bold")
      .fontSize(FS.h2)
      .fillColor(subtext)
      .text(osTitle.toUpperCase(), M, osTitleY, { characterSpacing: 0.6 });
    const osTop = doc.y + 6;
    const osPad = 14;
    const osW = rightEdge - M;
    const labelColW = 150;

    // We'll measure by drawing rows first then frame
    let y = osTop + osPad - 2;
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
    row("Experience", experienceName || "-");
    row("Date", whenText || "-");

    // receipt as pill
    // --- Order Summary rows above ---
    if (receiptUrl) {
      // keep the label column aligned, but don't print the raw URL
      row("Receipt", "");

      // draw a compact pill button inside the value column
      const pillX = M + 160; // start of value column (matches your row() layout)
      const pillY = y - 18; // baseline-align with the row
      pillLink("View invoice", receiptUrl, pillX, pillY);

      y += 6; // a touch of breathing room under the pill
      doc.y = y;
    }

    const pretty = currencyPretty(amountLabel, currency);
    row("Total", `${pretty}${currency ? ` (${currency})` : ""}`, true);

    const osHeight = y - osTop + osPad;
    doc
      .save()
      .roundedRect(M, osTop - osPad + 2, osW, osHeight, 10)
      .strokeColor(border)
      .lineWidth(LINE.hair)
      .stroke()
      .restore();

    // =============== ATTENDEES (card table) ===============
    y += 12;
    doc
      .font("Body-Bold")
      .fontSize(FS.h2)
      .fillColor(subtext)
      .text("Attendees".toUpperCase(), M, y, { characterSpacing: 0.6 });
    const atTop = doc.y + 6;
    const atW = rightEdge - M;
    const rowH = 22;
    const numW = 36;

    if (!attendees.length) {
      const emptyH = 44;
      doc
        .save()
        .roundedRect(M, atTop - 8, atW, emptyH, 10)
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
      let localY = atTop;
      doc
        .save()
        .roundedRect(M, atTop - 8, atW, rowH + 14, 10)
        .fillColor("#fff")
        .fill()
        .strokeColor(border)
        .lineWidth(LINE.hair)
        .stroke()
        .restore();
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
      attendees.forEach((a, i) => {
        if (localY + rowH > pageBottom()) {
          doc
            .roundedRect(M, atTop - 8, atW, localY - (atTop - 8) + 8, 10)
            .strokeColor(border)
            .lineWidth(LINE.hair)
            .stroke();
          doc.addPage();
          doc.font("Body");
          doc
            .font("Body-Bold")
            .fontSize(FS.h2)
            .fillColor(subtext)
            .text("Attendees (cont.)".toUpperCase(), M, M);
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
      doc
        .roundedRect(M, atTop - 8, atW, localY - (atTop - 8) + 8, 10)
        .strokeColor(border)
        .lineWidth(LINE.hair)
        .stroke();
      doc.y = localY;
    }

    // ================= FOOTER =================
    doc.moveDown(1);

    // Measure exactly how much space the footer needs
    const note =
      "Present this PDF or the QR code at check-in. For changes or questions, reply to the confirmation email.";
    const noteX = M + 24;
    const noteW = rightEdge - noteX;

    // set the font BEFORE measuring
    doc.font("Body").fontSize(FS.small);
    const noteH = doc.heightOfString(note, { width: noteW });
    const pageNumH = doc.currentLineHeight();
    const hrGap = 8;

    // Clamp footer into the current page so it never creates a new one
    const needed = hrGap + noteH + pageNumH;
    let footY = doc.y + 6;
    if (footY + needed > pageBottom()) {
      footY = pageBottom() - needed; // pull the footer up instead of adding a page
    }

    // draw the footer
    hr(footY);
    footY += hrGap;

    // mini mark (logo or dot)
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

    // note text (safe: we already reserved noteH space)
    doc
      .font("Body")
      .fontSize(FS.small)
      .fillColor(subtext)
      .text(note, noteX, footY, { width: noteW });

    // absolute page number; no line break => cannot trigger a new page
    doc
      .font("Body")
      .fontSize(FS.small)
      .fillColor(subtext)
      .text("Page 1", rightEdge - 70, doc.page.height - M - 8, {
        width: 60,
        align: "right",
        lineBreak: false,
        height: pageNumH,
      });

    doc.end();
  });
}
