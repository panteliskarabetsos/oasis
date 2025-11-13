// src/lib/pdf/buildTicket.js
import "server-only";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Booking confirmation — FULL-BLEED (edge-to-edge) */
export default async function buildTicketPdfBuffer(args = {}) {
  const {
    brand = {},
    logoUrl,
    brandName = "Oasis",
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
    status = "CONFIRMED",
    qrSize = 108,
    fontDir,
    mapUrl,
    footerNote = "Present this PDF or the QR code at check-in. For changes or questions, reply to the confirmation email.",
    watermarkText = brandName || "OASIS",
    supportEmail,
    supportPhone,

    /** layout knobs */
    inset = 28, // inner padding (visually comfy, not a margin)
    headerH = 76, // header band height
  } = args;

  const {
    primary = "#8b6f47",
    text = "#2b2a28",
    subtext = "#6b665d",
    border = "#efeae1",
    panel = "#fcfbf8",
    headerText = "#ffffff",
    pageBg = "#fffcf7",
  } = brand || {};

  // ---------- Resolve fonts BEFORE creating PDF ----------
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
        p &&
        fs.existsSync(path.join(p, "Inter-Regular.ttf")) &&
        fs.existsSync(path.join(p, "Inter-Bold.ttf"))
    ) || null;
  if (!base) {
    throw new Error(
      `[ticket] Inter font files not found.\nChecked:\n${candidates.join(
        "\n"
      )}\nAdd Inter-Regular.ttf and Inter-Bold.ttf to public/fonts (or pass { fontDir }).`
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

  // ---------- Create FULL-BLEED doc (margin: 0) ----------
  const doc = new PDFDocument({ size: "A4", margin: 0, font: regularBuf });

  // Metadata
  try {
    doc.info = doc.info || {};
    doc.info.Title = "Booking Confirmation";
    doc.info.Author = String(brand?.name || brandName || "");
    doc.info.Subject = "Reservation Ticket";
  } catch {}

  const chunks = [];
  return await new Promise((resolve, reject) => {
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Register fonts
    doc.registerFont("Body", regularBuf);
    doc.registerFont("Body-Bold", boldBuf);
    doc.registerFont("Helvetica", regularBuf);
    doc.registerFont("Helvetica-Bold", boldBuf);
    doc.font("Body");

    // Page box (no margins)
    const page = { x: 0, y: 0, w: doc.page.width, h: doc.page.height };
    const rightEdge = page.x + page.w;

    // Column math (inside inset)
    const contentX = page.x + inset;
    const contentW = page.w - inset * 2;
    const gap = 16;
    const stubW = 200;
    const mainX = contentX;
    const mainW = contentW - stubW - gap;
    const stubX = mainX + mainW + gap;

    // Helpers
    function divider(x1, x2, y) {
      doc.moveTo(x1, y).lineTo(x2, y).strokeColor(border).lineWidth(1).stroke();
    }
    function dottedSeparator(x, y1, y2) {
      doc
        .save()
        .dash(2, { space: 3 })
        .moveTo(x, y1)
        .lineTo(x, y2)
        .strokeColor(border)
        .lineWidth(1)
        .stroke()
        .undash()
        .restore();
    }
    function chip(txt, x, y, { bg = panel, fg = primary, bold = true } = {}) {
      const padX = 12,
        padY = 7;
      const w = doc.widthOfString(txt) + padX * 2;
      const h = 26;
      doc
        .save()
        .roundedRect(x, y, w, h, 12)
        .fill(bg)
        .fillColor(fg)
        .font(bold ? "Body-Bold" : "Body")
        .fontSize(11)
        .text(txt, x + padX, y + padY - 3)
        .restore();
      return { w, h };
    }
    function pillLink(x, y, textLabel, url) {
      const padX = 12,
        padY = 6;
      const w = doc.widthOfString(textLabel) + padX * 2;
      const h = 24;
      doc
        .save()
        .roundedRect(x, y, w, h, 999)
        .fill(panel)
        .strokeColor(border)
        .lineWidth(1)
        .stroke()
        .fillColor(primary)
        .font("Body-Bold")
        .fontSize(11)
        .text(textLabel, x + padX, y + padY - 2)
        .restore();
      if (url) doc.link(x, y, w, h, url);
      return { w, h };
    }
    function infoChip(label, value, x, y) {
      const padX = 10,
        padY = 6;
      const str = `${label}: ${value}`;
      const w = doc.widthOfString(str) + padX * 2;
      const h = 22;
      doc
        .save()
        .roundedRect(x, y, w, h, 999)
        .fill("#ffffff")
        .strokeColor(border)
        .lineWidth(1)
        .stroke()
        .fillColor(subtext)
        .font("Body")
        .fontSize(10)
        .text(str, x + padX, y + padY - 2)
        .restore();
      return { w, h };
    }
    function sectionTitle(txt, x, y) {
      doc.font("Body-Bold").fontSize(13).fillColor(subtext).text(txt, x, y);
      return doc.y;
    }

    // Status colors
    const STATUS = String(status || "").toUpperCase();
    const statusStyle = {
      CONFIRMED: { bg: "#eaf6ef", fg: "#186a3b" },
      PENDING: { bg: "#fff6e5", fg: "#8a5b00" },
      CANCELLED: { bg: "#fdeaea", fg: "#9c1a1a" },
      REFUNDED: { bg: "#eef3ff", fg: "#274690" },
    }[STATUS] || { bg: "#ffffff", fg: primary };

    /* ================= Background & Header (EDGE-TO-EDGE) ================= */
    // Full page background
    doc.save().rect(page.x, page.y, page.w, page.h).fill(pageBg).restore();

    // Header band spans the entire width, flush to the top edge
    doc.rect(page.x, page.y, page.w, headerH).fill(primary);

    // Brand / logo anchored to left inset (not a margin)
    const hInnerY = page.y + Math.max(16, (headerH - 44) / 2);
    try {
      if (logoUrl) {
        doc.image(logoUrl, contentX, hInnerY - 6, { width: 84 });
      } else {
        doc
          .font("Body-Bold")
          .fontSize(16)
          .fillColor(headerText)
          .text(brandName || "", contentX, hInnerY);
      }
    } catch {
      doc
        .font("Body-Bold")
        .fontSize(16)
        .fillColor(headerText)
        .text(brandName || "", contentX, hInnerY);
    }

    // Booking ref (top-right)
    doc
      .font("Body")
      .fontSize(11)
      .fillColor(headerText)
      .text(
        bookingRef ? `Ref: ${bookingRef}` : "",
        rightEdge - inset - 180,
        page.y + 14,
        { width: 160, align: "right" }
      );

    // Status chip on header
    const statW = doc.widthOfString(STATUS) + 24;
    chip(STATUS, rightEdge - inset - statW, page.y + headerH - 34, {
      bg: statusStyle.bg,
      fg: statusStyle.fg,
    });

    /* ================= Content (inside inset) ================= */
    const contentTop = page.y + headerH + 14;

    // Right rail card (white) sits edge-aligned to the rail
    const footerReserve = 56;
    const rightCardH = page.h - contentTop - footerReserve - inset;
    doc
      .save()
      .roundedRect(stubX - 6, contentTop - 6, stubW + 12, rightCardH, 14)
      .fill("#ffffff")
      .strokeColor(border)
      .lineWidth(1)
      .stroke()
      .restore();

    // Dotted column divider toward the right card
    const sepX = stubX - gap / 2;

    /* -------- LEFT: MAIN -------- */
    let y = contentTop;

    doc
      .font("Body-Bold")
      .fontSize(28)
      .fillColor(text)
      .text(experienceName || "Reservation", mainX, y, { width: mainW - 10 });
    y = doc.y + 8;

    const whenStr = [dateLabel, timeLabel ? `, ${timeLabel}` : ""]
      .filter(Boolean)
      .join("");
    const mapHref =
      mapUrl ||
      (location
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            location
          )}`
        : "");

    const c1 = infoChip("When", whenStr || "-", mainX, y);
    const c2 = infoChip("Where", location || "-", mainX + c1.w + 8, y);
    if (mapHref) doc.link(mainX + c1.w + 8, y, c2.w, c2.h, mapHref);
    y += c1.h + 10;

    if (mapHref) {
      const btn = pillLink(mainX, y, "Open in Maps", mapHref);
      y += btn.h + 12;
    }

    // Order summary card
    const cardPad = 14;
    const sumW = mainW;
    const sumH = 118;
    doc
      .save()
      .roundedRect(mainX, y, sumW, sumH, 14)
      .fill(panel)
      .strokeColor(border)
      .lineWidth(1)
      .stroke()
      .restore();

    let sy = y + cardPad;
    doc
      .font("Body-Bold")
      .fontSize(12)
      .fillColor(subtext)
      .text("ORDER SUMMARY", mainX + cardPad, sy);
    sy = doc.y + 8;

    const leftColW = 160;
    const valX = mainX + cardPad + leftColW;

    function row(label, value, emphasize = false) {
      doc
        .font("Body-Bold")
        .fontSize(11)
        .fillColor(subtext)
        .text(label, mainX + cardPad, sy, { width: leftColW - 8 });
      doc
        .font(emphasize ? "Body-Bold" : "Body")
        .fontSize(emphasize ? 13 : 12)
        .fillColor(text)
        .text(value, valX, sy, {
          width: sumW - (valX - mainX) - cardPad - 6,
        });
      sy = doc.y + 6;
    }
    row("Experience", experienceName || "-");
    row("Date", whenStr || "-");

    if (receiptUrl) {
      doc
        .font("Body-Bold")
        .fontSize(11)
        .fillColor(subtext)
        .text("Receipt", mainX + cardPad, sy);
      const linkY = sy;
      doc
        .font("Body")
        .fontSize(12)
        .fillColor(primary)
        .text("Open receipt →", valX, linkY, {
          link: receiptUrl,
          underline: true,
          width: sumW - (valX - mainX) - cardPad - 6,
        })
        .fillColor(text);
      sy = doc.y + 6;
    }

    const totalText = `${amountLabel || "-"}${
      currency ? ` (${currency})` : ""
    }`;
    const totalW = doc.widthOfString(totalText) + 18 * 2;
    const totalX = mainX + sumW - cardPad - totalW;
    const totalY = sy + 2;
    doc
      .save()
      .roundedRect(totalX, totalY - 4, totalW, 28, 999)
      .fill("#ffffff")
      .strokeColor(border)
      .lineWidth(1)
      .stroke()
      .fillColor(text)
      .font("Body-Bold")
      .fontSize(12)
      .text(totalText, totalX + 18, totalY)
      .restore();
    sy = totalY + 34;

    // Attendees
    let aY = sy + 8;
    doc
      .font("Body-Bold")
      .fontSize(13)
      .fillColor(subtext)
      .text("Attendees", mainX, aY);
    aY = doc.y + 6;

    const tableX = mainX;
    const tableW = mainW;
    const rowH = 22;

    doc
      .save()
      .roundedRect(tableX, aY, tableW, rowH, 10)
      .fill(panel)
      .strokeColor(border)
      .lineWidth(1)
      .stroke()
      .restore();
    doc
      .font("Body-Bold")
      .fontSize(11)
      .fillColor(subtext)
      .text("No.", tableX + 12, aY + 5, { width: 40 });
    doc
      .font("Body-Bold")
      .fontSize(11)
      .fillColor(subtext)
      .text("Name", tableX + 64, aY + 5, { width: tableW - 76 });
    let tY = aY + rowH + 2;

    if (!attendees.length) {
      doc
        .font("Body")
        .fontSize(12)
        .fillColor(text)
        .text("No attendee names on file.", tableX + 12, tY + 6);
      tY += rowH;
    } else {
      attendees.forEach((a, i) => {
        if (i % 2 === 1)
          doc.save().rect(tableX, tY, tableW, rowH).fill(panel).restore();
        doc
          .font("Body")
          .fontSize(12)
          .fillColor(subtext)
          .text(String(i + 1).padStart(2, "0"), tableX + 16, tY + 5, {
            width: 40,
          });
        doc
          .font("Body")
          .fontSize(12)
          .fillColor(text)
          .text(a?.name || "Guest", tableX + 64, tY + 5, {
            width: tableW - 76,
          });
        tY += rowH;
      });
      doc
        .roundedRect(tableX, aY, tableW, tY - aY, 10)
        .strokeColor(border)
        .lineWidth(1)
        .stroke();
    }

    /* -------- RIGHT: QR & facts -------- */
    let sY = contentTop;
    doc
      .font("Body-Bold")
      .fontSize(12)
      .fillColor(subtext)
      .text("Check-in", stubX, sY);
    sY = doc.y + 10;

    if (qrImgBuf) {
      const qx = stubX + Math.round((stubW - qrSize) / 2);
      doc
        .save()
        .roundedRect(stubX, sY - 10, stubW, qrSize + 36, 12)
        .fill("#ffffff")
        .strokeColor(border)
        .lineWidth(1)
        .stroke()
        .image(qrImgBuf, qx, sY, { width: qrSize })
        .font("Body")
        .fontSize(10)
        .fillColor(subtext)
        .text("Scan at check-in", stubX, sY + qrSize + 8, {
          width: stubW,
          align: "center",
        })
        .restore();
      sY += qrSize + 54;
    }

    if (bookingRef) {
      doc
        .font("Body-Bold")
        .fontSize(11)
        .fillColor(subtext)
        .text("Reference", stubX, sY);
      doc
        .font("Body-Bold")
        .fontSize(13)
        .fillColor(text)
        .text(bookingRef, stubX, doc.y + 4, { width: stubW });
      sY = doc.y + 10;
    }

    doc
      .font("Body-Bold")
      .fontSize(11)
      .fillColor(subtext)
      .text("When", stubX, sY);
    doc
      .font("Body")
      .fontSize(12)
      .fillColor(text)
      .text(whenStr || "-", stubX, doc.y + 4, { width: stubW });
    sY = doc.y + 8;

    doc
      .font("Body-Bold")
      .fontSize(11)
      .fillColor(subtext)
      .text("Where", stubX, sY);
    doc
      .font("Body")
      .fontSize(12)
      .fillColor(text)
      .text(location || "-", stubX, doc.y + 4, { width: stubW });
    if (mapHref) {
      const h = doc.heightOfString(location || "-", { width: stubW });
      doc.link(stubX, doc.y - h, stubW, h, mapHref);
    }

    /* ================= Footer (edge-aligned) ================= */
    const extraBits = [
      supportEmail ? `Email: ${supportEmail}` : null,
      supportPhone ? `Phone: ${supportPhone}` : null,
    ].filter(Boolean);
    const noteLine = extraBits.length
      ? `${footerNote}  •  ${extraBits.join("  •  ")}`
      : footerNote;

    const footerOpts = { width: contentW - 80, align: "left" };
    const footerHeight = doc.heightOfString(noteLine, footerOpts);
    const footerY = page.y + page.h - inset - footerHeight;

    // Vertical separator to just above footer
    dottedSeparator(sepX, contentTop, footerY - 14);

    divider(page.x + inset, rightEdge - inset, footerY - 6);
    doc
      .font("Body")
      .fontSize(9)
      .fillColor(subtext)
      .text(noteLine, page.x + inset, footerY, footerOpts);

    // Clickable support links
    if (supportEmail)
      doc.link(
        page.x + inset + doc.widthOfString(footerNote + "  •  "),
        footerY,
        doc.widthOfString(`Email: ${supportEmail}`),
        10,
        `mailto:${supportEmail}`
      );
    if (supportPhone) {
      const prefix =
        extraBits.length === 2 ? `Email: ${supportEmail}  •  ` : "";
      const x0 =
        page.x + inset + doc.widthOfString(`${footerNote}  •  ${prefix}`);
      doc.link(
        x0,
        footerY,
        doc.widthOfString(`Phone: ${supportPhone}`),
        10,
        `tel:${supportPhone}`
      );
    }

    const pageNo = (doc.page && doc.page.number) || 1;
    doc
      .font("Body")
      .fontSize(9)
      .fillColor(subtext)
      .text(`Page ${pageNo}`, rightEdge - inset - 60, footerY);

    // Soft watermark (still edge-to-edge)
    if (watermarkText) {
      doc
        .save()
        .opacity(0.03)
        .rotate(-18, { origin: [doc.page.width / 2, doc.page.height / 2] })
        .font("Body-Bold")
        .fontSize(140)
        .fillColor(text)
        .text(
          watermarkText,
          doc.page.width / 2 - 280,
          doc.page.height / 2 - 40,
          { width: 560, align: "center" }
        )
        .opacity(1)
        .restore();
    }

    doc.end();
  });
}
