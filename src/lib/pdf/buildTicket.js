import "server-only";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * buildTicketPdfBuffer (v4)
 *
 * Refinements over v2/v3 based on your screenshot:
 * - Never prints the raw receipt URL (avoids overflow). Shows a neat "Open receipt" pill link instead.
 * - Responsive card heights (no hardcoded heights that can clip content).
 * - Clearer table header + zebra rows.
 * - Polished hero with QR stub and perforated divider.
 * - Brand-safe colors & spacing tweaks.
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

  // Preload logo
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

    const FS = { title: 22, h2: 11, body: 11.5, small: 9.5 };
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

    function sectionTitle(txt, x, y) {
      doc
        .font("Body-Bold")
        .fontSize(FS.h2)
        .fillColor(subtext)
        .text(String(txt).toUpperCase(), x, y, { characterSpacing: 0.6 });
      return doc.y;
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
      const labelH = doc.currentLineHeight();
      const valueH = doc.heightOfString(String(value ?? ""), { width });
      const h = Math.ceil(labelH + 2 + valueH);
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

    const mastPadX = M,
      mastPadY = 18;
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
      fg: primary,
      invert: true,
    });

    // ================= HERO (left card + QR stub) =================
    const heroTop = mastheadH + 18;
    const heroLeft = M;
    const heroRight = rightEdge;
    const heroW = heroRight - heroLeft;
    const gap = 18;
    const stubW = 180;
    const mainW = heroW - stubW - gap;
    const cardPad = 18;

    const mainX = heroLeft;
    const stubX = heroLeft + mainW + gap;

    // main card
    doc.save().roundedRect(mainX, heroTop, mainW, 10, 12).clip();
    doc.restore();
    doc
      .save()
      .roundedRect(mainX, heroTop, mainW, 10, 12)
      .fillColor(surface)
      .fill()
      .restore();

    // title + when/where
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

    const whenText = [dateLabel, timeLabel ? `, ${timeLabel}` : ""]
      .filter(Boolean)
      .join("");
    const whereText = location || "-";

    let infoY = Math.max(doc.y + 8, heroTop + 52);
    const w1 = mainW - cardPad * 2;
    infoY =
      labelValue("When", whenText || "-", mainX + cardPad, infoY, w1).nextY + 6;
    infoY =
      labelValue("Where", whereText, mainX + cardPad, infoY, w1).nextY + 8;

    if (location) {
      const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        location
      )}`;
      pillLink("Open in Maps", mapUrl, mainX + cardPad, infoY);
      infoY += 26;
    }

    const mainCardBottom = infoY + 12;

    // stub card (QR + ref + status)
    const qrSize = qrImgBuf ? 124 : 0;
    const qrPad = 8;
    let stubY = heroTop + cardPad;
    doc
      .save()
      .roundedRect(
        stubX,
        heroTop,
        stubW,
        Math.max(mainCardBottom - heroTop, qrSize + 90),
        12
      )
      .fillColor("#ffffff")
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
        .text("Scan at check-in", stubX + cardPad + 6, stubY + qrW - 4, {
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
      stubY = doc.y + 6;
    }

    vDash(
      stubX - gap / 2,
      heroTop + 10,
      Math.max(mainCardBottom, stubY) + 6,
      border
    );

    doc.y = Math.max(mainCardBottom, stubY) + 16;

    // ================= ORDER SUMMARY =================
    let y = sectionTitle("Order Summary", M, doc.y) + 6;
    const osTop = y;
    const osPad = 14;
    const labelColW = 150;

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
          width: rightEdge - M - (osPad * 2 + labelColW + 10),
        });
      y += rH;
      doc.y = y;
    }

    row("Experience", experienceName || "-");
    row("Date", whenText || "-");

    if (receiptUrl) {
      const pillX = M + osPad + labelColW + 10;
      const pillY = y - (20 - 4); // vertically align
      doc
        .font("Body")
        .fontSize(FS.body - 0.5)
        .fillColor(subtext)
        .text("Receipt", M + osPad, y - 18);
      pillLink("Open receipt", receiptUrl, pillX, pillY);
      y += 12; // advance a bit more for pill height
      doc.y = y;
    }

    const pretty = currencyPretty(amountLabel, currency);
    row("Total", `${pretty}${currency ? ` (${currency})` : ""}`, true);

    // Light card frame around the summary (draw after content so height is correct)
    const osHeight = y - osTop + osPad;
    doc
      .save()
      .roundedRect(M, osTop - osPad + 2, rightEdge - M, osHeight, 10)
      .strokeColor(border)
      .lineWidth(LINE.hair)
      .stroke()
      .restore();

    // ================= ATTENDEES =================
    y += 12;
    y = sectionTitle("Attendees", M, y) + 6;

    const atTop = y;
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
      // header
      doc
        .save()
        .roundedRect(M, atTop - 8, atW, rowH + 14, 10)
        .fillColor("#ffffff")
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
          // finish frame for current page
          doc
            .roundedRect(M, atTop - 8, atW, localY - (atTop - 8) + 8, 10)
            .strokeColor(border)
            .lineWidth(LINE.hair)
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

      doc
        .roundedRect(M, atTop - 8, atW, localY - (atTop - 8) + 8, 10)
        .strokeColor(border)
        .lineWidth(LINE.hair)
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
