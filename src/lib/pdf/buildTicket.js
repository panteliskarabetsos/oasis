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
    panel = "#fcfbf8",
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

    // ---------- layout helpers ----------
    const margin = 36;
    const pageBottom = () => doc.page.height - margin;
    const rightEdge = doc.page.width - margin;

    function ensureSpace(h, extraGap = 10) {
      if (doc.y + h > pageBottom()) {
        doc.addPage();
        doc.font("Body");
        doc.y = margin;
      } else {
        doc.moveDown(extraGap / 12);
      }
    }

    function divider(y) {
      doc
        .moveTo(margin, y)
        .lineTo(rightEdge, y)
        .strokeColor(border)
        .lineWidth(1)
        .stroke();
    }

    function dashedPerforation(y) {
      doc
        .save()
        .dash(3, { space: 4 })
        .moveTo(margin, y)
        .lineTo(rightEdge, y)
        .strokeColor(border)
        .lineWidth(1)
        .stroke()
        .undash();
      const r = 6;
      doc.circle(margin, y, r).fill("#ffffff");
      doc.circle(rightEdge, y, r).fill("#ffffff");
      doc.restore();
    }

    function chip(txt, x, y, { bg = panel, fg = primary } = {}) {
      const padX = 10,
        padY = 6,
        h = 22,
        w = doc.widthOfString(txt) + padX * 2;
      doc
        .save()
        .roundedRect(x, y, w, h, 8)
        .fill(bg)
        .fillColor(fg)
        .font("Body-Bold")
        .fontSize(10.5)
        .text(txt, x + padX, y + padY - 2)
        .restore();
      return { w, h };
    }

    function statusColors(status = "CONFIRMED") {
      const s = String(status).toUpperCase();
      if (s === "CANCELLED") return { bg: "#fdecec", fg: "#c03636" };
      if (s === "PENDING") return { bg: "#fff6e5", fg: "#a15d00" };
      if (s === "RESCHEDULED") return { bg: "#eef6ff", fg: "#1b63a6" };
      return { bg: panel, fg: primary };
    }

    function labelValueHeight(
      value,
      labelSize = 10,
      valueSize = 12,
      width = 260
    ) {
      doc.font("Body-Bold").fontSize(labelSize);
      const labelH = doc.currentLineHeight();
      doc.font("Body").fontSize(valueSize);
      const valueH = doc.heightOfString(String(value ?? ""), { width });
      return Math.ceil(labelH + 4 + valueH);
    }

    function drawLabelValue(
      label,
      value,
      x,
      y,
      width = 260,
      labelSize = 10,
      valueSize = 12
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
        .text(String(value ?? "-"), x, y + doc.currentLineHeight() + 2, {
          width,
        });
      return Math.max(
        doc.y,
        y + labelValueHeight(value, labelSize, valueSize, width)
      );
    }

    function buttonLink(txt, url, x, y) {
      const padX = 12,
        padY = 7,
        h = 26,
        w = Math.max(80, doc.widthOfString(txt) + padX * 2);
      doc
        .save()
        .roundedRect(x, y, w, h, 8)
        .fill(primary)
        .fillColor("#ffffff")
        .font("Body-Bold")
        .fontSize(10.5)
        .text(txt, x + padX, y + padY - 3, { link: url })
        .restore();
      return { w, h };
    }

    function sectionTitle(txt, x, y) {
      doc
        .font("Body-Bold")
        .fontSize(12)
        .fillColor(subtext)
        .text(String(txt).toUpperCase(), x, y, { characterSpacing: 0.2 });
      return doc.y;
    }

    function formatCurrencySafe(value, curr = currency) {
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

    // ---------- Header band ----------
    const bandTop = margin;
    const bandPad = 14;
    const bandHeight = 64;

    doc
      .save()
      .roundedRect(margin, bandTop, rightEdge - margin, bandHeight, 12)
      .fill(panel)
      .restore();
    doc
      .moveTo(margin, bandTop + bandHeight)
      .lineTo(rightEdge, bandTop + bandHeight)
      .strokeColor(border)
      .lineWidth(1)
      .stroke();

    let yCursor = bandTop + bandPad;

    try {
      if (logoUrl) {
        doc
          .image(logoUrl, margin + bandPad, yCursor - 4, { width: 120 })
          .fillColor(text);
      } else {
        doc
          .font("Body-Bold")
          .fontSize(15)
          .fillColor(text)
          .text("Booking Confirmation", margin + bandPad, yCursor);
      }
    } catch {
      doc
        .font("Body-Bold")
        .fontSize(15)
        .fillColor(text)
        .text("Booking Confirmation", margin + bandPad, yCursor);
    }

    if (bookingRef) {
      doc
        .font("Body")
        .fontSize(10.5)
        .fillColor(subtext)
        .text(`Reference: ${bookingRef}`, rightEdge - 220, yCursor + 2, {
          width: 200,
          align: "right",
        });
    }

    const { bg: statusBg, fg: statusFg } = statusColors(statusLabel);
    const chipX = margin + bandPad;
    const chipY = bandTop + bandHeight - bandPad - 22;
    chip(String(statusLabel).toUpperCase(), chipX, chipY, {
      bg: statusBg,
      fg: statusFg,
    });

    // ---------- Hero area ----------
    const heroTop = bandTop + bandHeight + 14;
    const qrSize = qrImgBuf ? 150 : 0;
    const qrCardPad = 14;
    const qrCardW = qrSize ? qrSize + qrCardPad * 2 : 0;
    const qrCardH = qrSize ? qrSize + qrCardPad * 2 + 36 : 0; // caption space
    const qrX = qrSize ? rightEdge - qrSize - qrCardPad - 10 : 0;
    const qrY = heroTop;

    if (qrImgBuf) {
      doc
        .save()
        .roundedRect(qrX - qrCardPad, qrY - qrCardPad, qrCardW, qrCardH, 14)
        .fill(panel)
        .strokeColor(border)
        .lineWidth(1)
        .stroke()
        .image(qrImgBuf, qrX, qrY, { width: qrSize })
        .font("Body")
        .fontSize(10)
        .fillColor(subtext)
        .text("Scan at check-in", qrX - 6, qrY + qrSize + 10, {
          width: qrSize + 12,
          align: "center",
        })
        .restore();
    }

    const gutter = 18;
    const leftColRight = qrImgBuf ? qrX - gutter : rightEdge;
    const leftColWidth = leftColRight - margin;

    // Title in left column
    doc
      .font("Body-Bold")
      .fontSize(22)
      .fillColor(text)
      .text(experienceName || "Your reservation", margin, heroTop, {
        width: leftColWidth,
        lineGap: 2,
      });

    // ----- Details card (dynamic height) -----
    const whenText = [dateLabel, timeLabel ? `, ${timeLabel}` : ""]
      .filter(Boolean)
      .join("");
    const whereText = location || "-";

    const whenH = labelValueHeight(whenText, 10, 12, leftColWidth - 24);
    const whereH = labelValueHeight(whereText, 10, 12, leftColWidth - 24);
    const detailsInnerPad = 12;
    const detailsH = detailsInnerPad + whenH + 8 + whereH + detailsInnerPad;

    const detailsTop = Math.max(doc.y + 6, heroTop + 58);
    ensureSpace(detailsH);

    doc
      .roundedRect(margin, detailsTop, leftColWidth, detailsH, 12)
      .fill(panel)
      .fillColor(text);

    let dy = detailsTop + detailsInnerPad;
    dy = drawLabelValue(
      "When",
      whenText || "-",
      margin + 12,
      dy,
      leftColWidth - 24,
      10,
      12
    );
    dy += 8;
    dy = drawLabelValue(
      "Where",
      whereText,
      margin + 12,
      dy,
      leftColWidth - 24,
      10,
      12
    );

    if (location) {
      const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        location
      )}`;
      buttonLink(
        "Open in Maps →",
        mapUrl,
        margin + 12,
        detailsTop + detailsH - detailsInnerPad - 26
      );
    }

    const detailsBottom = detailsTop + detailsH;
    const qrBottom = qrImgBuf ? qrY + qrCardH : detailsBottom;

    // ---------- Perforation ----------
    const perfY = Math.max(detailsBottom, qrBottom) + 18;
    dashedPerforation(perfY);

    // ---------- Order Summary ----------
    let y = perfY + 18;
    y = sectionTitle("Order Summary", margin, y) + 6;

    function row(label, value, emphasize = false) {
      const rH = 20;
      ensureSpace(rH, 0);
      doc
        .font(emphasize ? "Body-Bold" : "Body")
        .fontSize(emphasize ? 13 : 12)
        .fillColor(emphasize ? text : subtext)
        .text(label, margin, y, { width: 150 });

      doc
        .font(emphasize ? "Body-Bold" : "Body")
        .fillColor(text)
        .text(value, margin + 164, y, {
          width: rightEdge - (margin + 164),
          align: "left",
        });

      y += rH;
      doc.y = y;
    }

    row("Experience", experienceName || "-");
    row("Date", whenText || "-");

    divider(y - 6);
    y += 6;
    doc.y = y;

    if (receiptUrl) {
      row("Receipt", receiptUrl);
      buttonLink("Open receipt →", receiptUrl, margin + 164, y - 22);
    }

    const totalPretty = formatCurrencySafe(amountLabel, currency);
    row("Total", `${totalPretty}${currency ? ` (${currency})` : ""}`, true);

    // ---------- Attendees ----------
    y += 12;
    y = sectionTitle("Attendees", margin, y) + 8;
    doc.y = y;

    const rowHeight = 20;

    const drawAttendeesBatch = (fromIdx) => {
      const startY = doc.y;
      let tableTop = startY;
      let localY = startY;
      let i = fromIdx;

      if (!attendees.length && fromIdx === 0) {
        ensureSpace(rowHeight, 0);
        doc
          .font("Body")
          .fontSize(12)
          .fillColor(text)
          .text("No attendee names on file.", margin, localY);
        localY += rowHeight;
        doc
          .roundedRect(
            margin,
            tableTop - 6,
            rightEdge - margin,
            localY - tableTop + 12,
            8
          )
          .strokeColor(border)
          .lineWidth(1)
          .stroke();
        doc.y = localY;
        return 0;
      }

      const frameWidth = rightEdge - margin;
      while (i < attendees.length) {
        if (localY + rowHeight > pageBottom()) {
          if (localY > tableTop) {
            doc
              .roundedRect(
                margin,
                tableTop - 6,
                frameWidth,
                localY - tableTop + 12,
                8
              )
              .strokeColor(border)
              .lineWidth(1)
              .stroke();
          }
          doc.addPage();
          doc.font("Body");
          tableTop = doc.y = margin;
          localY = tableTop;
          sectionTitle("Attendees (cont.)", margin, localY);
          localY = doc.y + 8;
          tableTop = localY;
        }

        const zebra = i % 2 === 1;
        if (zebra) {
          doc
            .save()
            .rect(margin, localY - 2, frameWidth, rowHeight)
            .fill(panel)
            .restore();
        }
        doc
          .font("Body")
          .fontSize(12)
          .fillColor(subtext)
          .text(String(i + 1).padStart(2, "0"), margin, localY, { width: 30 });
        doc
          .font("Body")
          .fontSize(12)
          .fillColor(text)
          .text(attendees[i]?.name || "Guest", margin + 36, localY, {
            width: frameWidth - 36,
          });
        localY += rowHeight;
        i++;
      }

      if (localY > tableTop) {
        doc
          .roundedRect(
            margin,
            tableTop - 6,
            frameWidth,
            localY - tableTop + 12,
            8
          )
          .strokeColor(border)
          .lineWidth(1)
          .stroke();
      }
      doc.y = localY;
      return i - fromIdx;
    };

    drawAttendeesBatch(0);

    // ---------- Footer ----------
    doc.moveDown(1);
    let footY = doc.y + 6;
    ensureSpace(40, 0);
    divider(footY);
    footY += 10;

    doc
      .font("Body")
      .fontSize(10)
      .fillColor(subtext)
      .text(
        "Present this PDF or the QR code at check-in. For changes or questions, reply to the confirmation email.",
        margin,
        footY,
        { width: rightEdge - margin }
      );

    doc
      .font("Body")
      .fontSize(9)
      .fillColor(subtext)
      .text("Page 1", rightEdge - 80, doc.page.height - margin - 10, {
        width: 70,
        align: "right",
      });

    doc.end();
  });
}
