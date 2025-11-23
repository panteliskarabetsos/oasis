// src/lib/pdf/buildTicket.js
import "server-only";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Booking confirmation — FULL-BLEED (edge-to-edge)
 */
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
    qrSize = 118,
    fontDir,
    mapUrl,
    footerNote = "Present this ticket at check-in. For changes or questions, contact us.",
    watermarkText,
    supportEmail,
    supportPhone,

    // layout knobs
    inset = 28,
    headerH: headerHInput,
  } = args;

  const headerH = headerHInput ?? 76;
  const finalWatermarkText = watermarkText || brandName || "OASIS";

  const {
    primary = "#8b6f47",
    text = "#2b2a28",
    subtext = "#6b665d",
    border = "#efeae1",
    panel = "#fcfbf8",
    headerText = "#ffffff",
    pageBg = "#fffcf7",
  } = brand || {};

  /* ---------- FONT RESOLUTION ---------- */
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

  /* ---------- QR PRECOMPUTE ---------- */
  let qrImgBuf = null;
  try {
    const dataUrl = await QRCode.toDataURL(
      qrValue || String(bookingRef || "booking"),
      { margin: 0, scale: 8 }
    );
    qrImgBuf = Buffer.from(dataUrl.split(",")[1], "base64");
  } catch {
    // non-fatal
  }

  /* ---------- CREATE DOCUMENT ---------- */
  const doc = new PDFDocument({
    size: "A4",
    margin: 0,
    font: regularBuf, // forces Inter, avoids Helvetica.afm lookup
  });

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

    /* ---------- FONTS ---------- */
    doc.registerFont("Body", regularBuf);
    doc.registerFont("Body-Bold", boldBuf);
    doc.font("Body");

    /* ---------- GEOMETRY ---------- */
    const page = { x: 0, y: 0, w: doc.page.width, h: doc.page.height };
    const rightEdge = page.x + page.w;

    const contentX = page.x + inset;
    const contentW = page.w - inset * 2;
    const gap = 20;
    const stubW = 185; // slightly narrower right rail

    const mainX = contentX;
    const mainW = contentW - stubW - gap;
    const stubX = mainX + mainW + gap;

    const footerReserve = 64;
    const contentTop = page.y + headerH + 18;

    /* ---------- HELPERS ---------- */
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
      const padX = 13;
      const padY = 7;
      const h = 26;
      const w = doc.widthOfString(txt) + padX * 2;

      doc
        .save()
        .roundedRect(x, y, w, h, 999)
        .fill(bg)
        .fillColor(fg)
        .font(bold ? "Body-Bold" : "Body")
        .fontSize(11)
        .text(txt, x + padX, y + padY - 3)
        .restore();
      return { w, h };
    }

    function pillLink(x, y, textLabel, url) {
      const padX = 12;
      const padY = 6;
      const h = 24;
      const w = doc.widthOfString(textLabel) + padX * 2;

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

    function infoChip(label, value, x, y, widthMax = mainW) {
      const padX = 10;
      const padY = 6;
      const str = `${label}: ${value}`;
      const h = 22;
      const w = Math.min(
        doc.widthOfString(str) + padX * 2,
        widthMax - (x - mainX)
      );

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
        .text(str, x + padX, y + padY - 2, { width: w - padX * 2 })
        .restore();

      return { w, h };
    }

    function measureChip(label, value, widthMax = mainW) {
      const padX = 10;
      const str = `${label}: ${value}`;
      const h = 22;
      const w = Math.min(doc.widthOfString(str) + padX * 2, widthMax);
      return { w, h };
    }

    function sectionTitle(txt, x, y) {
      doc
        .font("Body-Bold")
        .fontSize(12.5)
        .fillColor(subtext)
        .text(txt.toUpperCase(), x, y);
      return doc.y;
    }

    const STATUS = String(status || "").toUpperCase();
    const statusStyle = {
      CONFIRMED: { bg: "#eaf6ef", fg: "#186a3b" },
      PENDING: { bg: "#fff6e5", fg: "#8a5b00" },
      CANCELLED: { bg: "#fdeaea", fg: "#9c1a1a" },
      REFUNDED: { bg: "#eef3ff", fg: "#274690" },
    }[STATUS] || { bg: "#ffffff", fg: primary };

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

    /* ---------- BACKGROUND & HEADER ---------- */
    doc.save().rect(page.x, page.y, page.w, page.h).fill(pageBg).restore();
    doc
      .save()
      .rect(page.x, page.y, page.w, headerH + 8)
      .fill(primary)
      .restore();

    const headerInnerY = page.y + Math.max(14, (headerH - 40) / 2);

    try {
      if (logoUrl && fs.existsSync(logoUrl)) {
        doc.image(logoUrl, contentX, headerInnerY - 8, { width: 88 });
      } else {
        throw new Error("Logo file not found");
      }
    } catch {
      doc
        .font("Body-Bold")
        .fontSize(18)
        .fillColor(headerText)
        .text(brandName || "", contentX, headerInnerY - 2);
    }

    if (bookingRef) {
      doc
        .font("Body")
        .fontSize(10.5)
        .fillColor(headerText)
        .text("Booking reference", rightEdge - inset - 180, page.y + 12, {
          width: 160,
          align: "right",
        });
      doc
        .font("Body-Bold")
        .fontSize(12)
        .fillColor(headerText)
        .text(`Ref: ${bookingRef}`, rightEdge - inset - 180, doc.y + 2, {
          width: 160,
          align: "right",
        });
    }

    const statLabel = STATUS || "STATUS";
    const statW = doc.widthOfString(statLabel) + 24;
    chip(statLabel, rightEdge - inset - statW, page.y + headerH - 26, {
      bg: statusStyle.bg,
      fg: statusStyle.fg,
    });

    /* ---------- RIGHT RAIL CARD ---------- */
    const rightCardH = page.h - contentTop - footerReserve - inset;
    const sepX = stubX - gap / 2;

    doc
      .save()
      .roundedRect(stubX - 6, contentTop - 6, stubW + 12, rightCardH, 14)
      .fill("#ffffff")
      .strokeColor(border)
      .lineWidth(1)
      .stroke()
      .restore();

    /* ---------- LEFT MAIN ---------- */
    let y = contentTop;

    doc
      .font("Body-Bold")
      .fontSize(27)
      .fillColor(text)
      .text(experienceName || "Reservation", mainX, y, {
        width: mainW - 12,
      });
    y = doc.y + 4;

    if (location) {
      doc
        .font("Body")
        .fontSize(12)
        .fillColor(subtext)
        .text(location, mainX, y, { width: mainW - 12 });
      y = doc.y + 12;
    } else {
      y += 6;
    }

    // --- Adaptive When/Where layout ---
    const hasWhen = Boolean(whenStr);
    const hasWhere = Boolean(location);

    if (hasWhen || hasWhere) {
      const whenSize = hasWhen
        ? measureChip("When", whenStr || "-", mainW)
        : { w: 0, h: 0 };
      const whereSize = hasWhere
        ? measureChip("Where", location || "-", mainW)
        : { w: 0, h: 0 };

      const gutter = hasWhen && hasWhere ? 8 : 0;
      const canInline =
        hasWhen && hasWhere && whenSize.w + gutter + whereSize.w <= mainW;

      let chipY = y;

      if (hasWhen) {
        infoChip("When", whenStr || "-", mainX, chipY, mainW);
      }

      let whereLinkRect = null;

      if (hasWhere) {
        if (canInline && hasWhen) {
          const whereX = mainX + whenSize.w + gutter;
          const { w, h } = infoChip(
            "Where",
            location || "-",
            whereX,
            chipY,
            mainW
          );
          whereLinkRect = { x: whereX, y: chipY, w, h };
          chipY += whenSize.h;
        } else {
          // stacked underneath
          chipY += (hasWhen ? whenSize.h : 0) + 6;
          const { w, h } = infoChip(
            "Where",
            location || "-",
            mainX,
            chipY,
            mainW
          );
          whereLinkRect = { x: mainX, y: chipY, w, h };
          chipY += h;
        }
      } else {
        chipY += whenSize.h;
      }

      if (whereLinkRect && mapHref) {
        doc.link(
          whereLinkRect.x,
          whereLinkRect.y,
          whereLinkRect.w,
          whereLinkRect.h,
          mapHref
        );
      }

      y = chipY + 10;
    }

    if (mapHref) {
      const btn = pillLink(mainX, y, "Open in Maps", mapHref);
      y += btn.h + 14;
    } else {
      y += 6;
    }

    /* ----- ORDER SUMMARY CARD ----- */
    const cardPad = 16;
    const sumW = mainW;
    const sumH = 120;

    doc
      .save()
      .roundedRect(mainX, y, sumW, sumH, 16)
      .fill(panel)
      .strokeColor(border)
      .lineWidth(1)
      .stroke()
      .restore();

    let sy = y + cardPad;

    sy = sectionTitle("Order summary", mainX + cardPad, sy) + 4;

    const leftColW = 150;
    const valX = mainX + cardPad + leftColW;

    function summaryRow(label, value, emphasize = false) {
      doc
        .font("Body-Bold")
        .fontSize(11)
        .fillColor(subtext)
        .text(label, mainX + cardPad, sy, { width: leftColW - 8 });

      doc
        .font(emphasize ? "Body-Bold" : "Body")
        .fontSize(emphasize ? 13 : 12)
        .fillColor(text)
        .text(value || "-", valX, sy, {
          width: sumW - (valX - mainX) - cardPad - 4,
        });

      sy = doc.y + 6;
    }

    summaryRow("Experience", experienceName || "-");
    summaryRow("Date", whenStr || "-");

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
          width: sumW - (valX - mainX) - cardPad - 4,
        })
        .fillColor(text);
      sy = doc.y + 6;
    }

    // --- Total pill with label ---
    const totalText = `Total  ${amountLabel || "-"}${
      currency ? ` (${currency})` : ""
    }`;
    const totalPadX = 18;
    const totalH = 28;
    const totalW = doc.widthOfString(totalText) + totalPadX * 2;
    const totalX = mainX + sumW - cardPad - totalW;
    const totalY = sy + 2;

    doc
      .save()
      .roundedRect(totalX, totalY - 4, totalW, totalH, 999)
      .fill("#ffffff")
      .strokeColor(border)
      .lineWidth(1)
      .stroke()
      .fillColor(text)
      .font("Body-Bold")
      .fontSize(12)
      .text(totalText, totalX + totalPadX, totalY - 1)
      .restore();

    y = y + sumH + 16;

    /* ----- ATTENDEES ----- */
    let aY = y;
    aY = sectionTitle("Attendees", mainX, aY) + 6;

    const tableX = mainX;
    const tableW = mainW;
    const rowH = 21;
    const headerHRow = rowH;

    doc
      .save()
      .roundedRect(tableX, aY, tableW, headerHRow, 10)
      .fill(panel)
      .strokeColor(border)
      .lineWidth(1)
      .stroke()
      .restore();

    doc
      .font("Body-Bold")
      .fontSize(11)
      .fillColor(subtext)
      .text("No.", tableX + 14, aY + 4, { width: 40 });

    doc
      .font("Body-Bold")
      .fontSize(11)
      .fillColor(subtext)
      .text("Name", tableX + 70, aY + 4, { width: tableW - 90 });

    let tY = aY + headerHRow + 2;

    if (!attendees.length) {
      doc
        .font("Body")
        .fontSize(12)
        .fillColor(text)
        .text("No attendee names on file.", tableX + 14, tY + 5);
      tY += rowH + 8;
    } else {
      attendees.forEach((a, i) => {
        if (i % 2 === 1) {
          doc.save().rect(tableX, tY, tableW, rowH).fill(panel).restore();
        }

        doc
          .font("Body")
          .fontSize(12)
          .fillColor(subtext)
          .text(String(i + 1).padStart(2, "0"), tableX + 18, tY + 4, {
            width: 40,
          });
        doc
          .font("Body")
          .fontSize(12)
          .fillColor(text)
          .text(a?.name || "Guest", tableX + 70, tY + 4, {
            width: tableW - 90,
          });

        tY += rowH;
      });

      doc
        .roundedRect(tableX, aY, tableW, tY - aY, 10)
        .strokeColor(border)
        .lineWidth(1)
        .stroke();
    }

    /* ---------- RIGHT: QR & FACTS ---------- */
    let sY = contentTop;

    // extra gap after CHECK-IN label
    sY = sectionTitle("Check-in", stubX, sY) + 16;

    if (qrImgBuf) {
      const qx = stubX + Math.round((stubW - qrSize) / 2);

      doc
        .save()
        .roundedRect(stubX, sY - 12, stubW, qrSize + 48, 14)
        .fill("#ffffff")
        .strokeColor(border)
        .lineWidth(1)
        .stroke()
        .image(qrImgBuf, qx, sY, { width: qrSize })
        .font("Body")
        .fontSize(10)
        .fillColor(subtext)
        .text("Show this QR at check-in", stubX, sY + qrSize + 12, {
          width: stubW,
          align: "center",
        })
        .restore();

      sY += qrSize + 60;
    }

    if (bookingRef) {
      sY = sectionTitle("Reference", stubX, sY) + 2;
      doc
        .font("Body-Bold")
        .fontSize(13)
        .fillColor(text)
        .text(bookingRef, stubX, sY, { width: stubW });
      sY = doc.y + 12;
    }

    // no extra When/Where on the right – we already show them on the left

    sY = sectionTitle("Important info", stubX, sY) + 4;
    const infoLines = [
      "Please arrive 10–15 minutes before your start time.",
      "Wear comfortable clothing and bring a light jacket.",
      "If you need to change or cancel, reply to your confirmation email.",
    ];

    doc.font("Body").fontSize(10.5).fillColor(subtext);
    infoLines.forEach((line) => {
      doc.text(`• ${line}`, stubX, doc.y + 2, {
        width: stubW,
        lineGap: 1.8,
      });
    });

    /* ---------- FOOTER ---------- */
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

    dottedSeparator(sepX, contentTop, footerY - 16);
    divider(page.x + inset, rightEdge - inset, footerY - 8);

    doc
      .font("Body")
      .fontSize(9)
      .fillColor(subtext)
      .text(noteLine, page.x + inset, footerY, footerOpts);

    if (supportEmail) {
      const prefixWidth = doc.widthOfString(`${footerNote}  •  `);
      const emailX = page.x + inset + prefixWidth;
      const emailLabel = `Email: ${supportEmail}`;
      doc.link(
        emailX,
        footerY,
        doc.widthOfString(emailLabel),
        10,
        `mailto:${supportEmail}`
      );
    }

    if (supportPhone) {
      const basePrefix = `${footerNote}  •  `;
      const emailPart = supportEmail ? `Email: ${supportEmail}  •  ` : "";
      const phoneX = page.x + inset + doc.widthOfString(basePrefix + emailPart);
      const phoneLabel = `Phone: ${supportPhone}`;
      doc.link(
        phoneX,
        footerY,
        doc.widthOfString(phoneLabel),
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

    /* ---------- WATERMARK ---------- */
    const hasLogoForWatermark = logoUrl && fs.existsSync(logoUrl);

    if (hasLogoForWatermark) {
      // Big, soft logo in the center of the page
      const wmWidth = page.w * 0.7; // 70% of page width
      const wmX = (page.w - wmWidth) / 2;
      const wmY = page.h / 2 - wmWidth / 2; // roughly centered vertically

      doc
        .save()
        .opacity(0.035)
        .image(logoUrl, wmX, wmY, { width: wmWidth })
        .opacity(1)
        .restore();
    } else if (finalWatermarkText) {
      // Fallback to text watermark if logo is missing
      doc
        .save()
        .opacity(0.03)
        .rotate(-18, { origin: [doc.page.width / 2, doc.page.height / 2] })
        .font("Body-Bold")
        .fontSize(130)
        .fillColor(text)
        .text(
          finalWatermarkText,
          doc.page.width / 2 - 280,
          doc.page.height / 2 - 50,
          { width: 560, align: "center" }
        )
        .opacity(1)
        .restore();
    }

    doc.end();
  });
}
