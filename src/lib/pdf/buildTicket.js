// src/lib/pdf/buildTicket.js
import "server-only";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class TicketGenerator {
  constructor(args) {
    this.args = args;
    this.brand = args.brand || {};

    // PREMIUM MINIMALIST THEME: Monochrome, high contrast
    this.theme = {
      primary: this.brand.primary || "#000000",
      text: this.brand.text || "#111111",
      subtext: this.brand.subtext || "#767676",
      border: this.brand.border || "#eaeaea",
      panel: this.brand.panel || "#f9f9f9",
      headerText: this.brand.headerText || "#000000", // Changed to black for white header
      pageBg: this.brand.pageBg || "#ffffff", // Pure white page
    };

    this.statusStyle = this.resolveStatusStyle(args.status);
    this.headerH = args.headerH ?? 100;
    this.inset = args.inset ?? 40; // Increased inset for more breathing room
    this.qrSize = args.qrSize ?? 120;
  }

  resolveStatusStyle(status) {
    const s = String(status || "").toUpperCase();
    // High-end, muted status colors
    const styles = {
      CONFIRMED: { bg: "#f9f9f9", fg: "#111111", border: "#eaeaea" },
      PENDING: { bg: "#ffffff", fg: "#767676", border: "#eaeaea" },
      CANCELLED: { bg: "#ffffff", fg: "#000000", border: "#000000" },
      REFUNDED: { bg: "#f9f9f9", fg: "#767676", border: "#eaeaea" },
    };
    return styles[s] || { bg: "#000000", fg: "#ffffff", border: "#000000" };
  }

  async loadFonts() {
    const candidates = [
      this.args.fontDir,
      path.join(process.cwd(), "public", "fonts"),
      path.join(__dirname, "..", "..", "..", "public", "fonts"),
    ].filter(Boolean);

    const fontRegular = "Jost-Regular.ttf";
    const fontBold = "Jost-Bold.ttf";

    const base = candidates.find(
      (p) =>
        p &&
        fs.existsSync(path.join(p, fontRegular)) &&
        fs.existsSync(path.join(p, fontBold)),
    );

    if (!base) {
      throw new Error(
        `[ticket] Premium font files not found.\nChecked:\n${candidates.join("\n")}\nPlease add ${fontRegular} and ${fontBold} to your fonts folder.`,
      );
    }

    return {
      regular: fs.readFileSync(path.join(base, fontRegular)),
      bold: fs.readFileSync(path.join(base, fontBold)),
    };
  }

  async precomputeQR() {
    try {
      const dataUrl = await QRCode.toDataURL(
        this.args.qrValue || String(this.args.bookingRef || "booking"),
        {
          margin: 0,
          scale: 8,
          color: { dark: this.theme.text, light: "#ffffff" },
        },
      );
      return Buffer.from(dataUrl.split(",")[1], "base64");
    } catch {
      return null;
    }
  }

  setupLayout() {
    const p = { x: 0, y: 0, w: this.doc.page.width, h: this.doc.page.height };
    const contentX = p.x + this.inset;
    const contentW = p.w - this.inset * 2;
    const gap = 40;
    const stubW = 160;
    const mainW = contentW - stubW - gap;
    const stubX = contentX + mainW + gap;

    this.layout = {
      page: p,
      rightEdge: p.x + p.w,
      contentX,
      contentW,
      mainX: contentX + 30, // Inner padding inside the main border
      mainW: mainW - 30,
      stubX,
      stubW: stubW - 20,
      gap,
      sepX: stubX - gap / 2, // Divider line X
      footerReserve: 60,
      contentTop: p.y + this.headerH + 20,
    };
  }

  /* ---------- DRAWING HELPERS ---------- */

  sectionTitle(txt, x, y) {
    this.doc
      .font("Body-Bold")
      .fontSize(10)
      .fillColor(this.theme.subtext)
      .text(txt.toUpperCase(), x, y, { characterSpacing: 1.5 });
    return this.doc.y;
  }

  chip(txt, x, y, { bg, fg, border, bold = true }) {
    const padX = 14,
      padY = 7,
      h = 26;
    const w = this.doc.widthOfString(txt) + padX * 2;
    this.doc.save();

    if (bg) {
      this.doc.roundedRect(x, y, w, h, 2).fill(bg); // Sharp 2px radius
    }
    if (border) {
      this.doc.roundedRect(x, y, w, h, 2).lineWidth(1).stroke(border);
    }

    this.doc
      .fillColor(fg || this.theme.primary)
      .font(bold ? "Body-Bold" : "Body")
      .fontSize(10)
      .text(txt, x + padX, y + padY - 2, { characterSpacing: 0.5 })
      .restore();
    return { w, h };
  }

  divider(x1, x2, y) {
    this.doc
      .moveTo(x1, y)
      .lineTo(x2, y)
      .strokeColor(this.theme.border)
      .lineWidth(1)
      .stroke();
  }

  /* ---------- DRAWING PHASES ---------- */

  drawBackgroundAndHeader() {
    const { page, rightEdge, contentX, contentW } = this.layout;
    const { args, theme } = this;

    // 1. Base background (Pure White)
    this.doc
      .save()
      .rect(page.x, page.y, page.w, page.h)
      .fill(theme.pageBg)
      .restore();

    // 2. Structural Hairline (Top Border of the actual ticket area)
    const lineY = this.headerH;
    this.doc
      .save()
      .moveTo(contentX, lineY)
      .lineTo(rightEdge - this.inset, lineY)
      .strokeColor(theme.border)
      .lineWidth(0.75) // Ultra-fine line
      .stroke()
      .restore();

    // 3. Brand Identity (Left-Aligned)
    const logoMaxH = 26;
    const metaY = lineY - 22; // Alignment baseline for all header text

    try {
      if (args.logoUrl && fs.existsSync(args.logoUrl)) {
        this.doc.image(args.logoUrl, contentX, lineY - 38, {
          height: logoMaxH,
        });
      } else {
        throw new Error();
      }
    } catch {
      this.doc
        .font("Body-Bold")
        .fontSize(14)
        .fillColor(theme.text)
        .text((args.brandName || "OASIS").toUpperCase(), contentX, metaY - 4, {
          characterSpacing: 2,
        });
    }

    // 4. Document Label (Center-Aligned)
    this.doc
      .save()
      .font("Body-Bold")
      .fontSize(8)
      .fillColor(theme.subtext)
      .text("OFFICIAL E-TICKET", page.x, metaY, {
        width: page.w,
        align: "center",
        characterSpacing: 4,
      })
      .restore();

    // 5. Booking Reference (Right-Aligned)
    if (args.bookingRef) {
      const refText = args.bookingRef.toUpperCase();
      const labelW = 100;
      const refX = rightEdge - this.inset - labelW;

      this.doc
        .save()
        .font("Body")
        .fontSize(8)
        .fillColor(theme.subtext)
        .text("BOOKING REF", refX, metaY - 12, {
          width: labelW,
          align: "right",
          characterSpacing: 1,
        })
        .font("Body-Bold")
        .fontSize(11)
        .fillColor(theme.text)
        .text(refText, refX, metaY, {
          width: labelW,
          align: "right",
          characterSpacing: 0.5,
        })
        .restore();
    }

    this.doc
      .save()
      .lineWidth(2)
      .strokeColor(theme.primary)
      .moveTo(contentX, lineY)
      .lineTo(contentX + 20, lineY) // Tiny accent bar on the left
      .stroke()
      .restore();
  }

  drawTicketBody() {
    const { page, contentX, contentW, contentTop, sepX, footerReserve } =
      this.layout;
    const ticketH = page.h - contentTop - footerReserve;

    // Sleek, minimal main bounding box (sharp corners)
    this.doc
      .save()
      .rect(contentX, contentTop, contentW, ticketH)
      .strokeColor(this.theme.border)
      .lineWidth(1)
      .stroke()
      .restore();

    // Solid Vertical Divider instead of perforation
    this.doc
      .moveTo(sepX, contentTop)
      .lineTo(sepX, contentTop + ticketH)
      .strokeColor(this.theme.border)
      .lineWidth(1)
      .stroke();
  }

  drawMainContent() {
    const { mainX, mainW, contentTop } = this.layout;
    const { args, theme } = this;
    let y = contentTop + 30;

    // Reference ID above title
    if (args.bookingRef) {
      this.doc
        .font("Body-Bold")
        .fontSize(10)
        .fillColor(theme.subtext)
        .text(`REF: ${args.bookingRef}`, mainX, y, { characterSpacing: 1 });
      y = this.doc.y + 8;
    }

    this.doc
      .font("Body-Bold")
      .fontSize(24)
      .fillColor(theme.text)
      .text(args.experienceName || "Reservation", mainX, y, {
        width: mainW,
        lineGap: 2,
      });
    y = this.doc.y + 8;

    if (args.location) {
      this.doc
        .font("Body")
        .fontSize(12)
        .fillColor(theme.subtext)
        .text(args.location, mainX, y, { width: mainW });
      y = this.doc.y + 24;
    } else {
      y += 16;
    }

    y = this.drawOrderSummary(y);
    this.drawAttendees(y);
  }

  drawOrderSummary(startY) {
    const { mainX, mainW } = this.layout;
    const { args, theme } = this;
    const rowPad = 14;

    let sy = this.sectionTitle("Order Summary", mainX, startY) + 16;

    const whenStr = [
      args.dateLabel,
      args.timeLabel ? ` at ${args.timeLabel}` : "",
    ]
      .filter(Boolean)
      .join("");

    const rows = [
      { label: "Experience", value: args.experienceName || "-" },
      { label: "Date", value: whenStr || "-" },
    ];

    if (args.pickupPoint) {
      rows.push({ label: "Pickup", value: args.pickupPoint });
    }

    // Top border of summary
    this.divider(mainX, mainX + mainW, sy);
    sy += rowPad;

    // Draw rows with Right-Aligned Values
    rows.forEach((r) => {
      this.doc
        .font("Body")
        .fontSize(12)
        .fillColor(theme.subtext)
        .text(r.label, mainX, sy, { width: mainW });

      this.doc
        .font("Body")
        .fontSize(12)
        .fillColor(theme.text)
        .text(r.value, mainX, sy, { width: mainW, align: "right" });

      sy +=
        Math.max(this.doc.heightOfString(r.value, { width: mainW / 1.5 }), 16) +
        rowPad;
      this.divider(mainX, mainX + mainW, sy);
      sy += rowPad;
    });

    // Draw Total Row
    const totalLabel = "Total";
    const totalValue = `${args.amountLabel || "-"}${args.currency ? ` (${args.currency})` : ""}`;

    this.doc
      .font("Body-Bold")
      .fontSize(14)
      .fillColor(theme.text)
      .text(totalLabel, mainX, sy, { width: mainW });

    this.doc
      .font("Body-Bold")
      .fontSize(14)
      .fillColor(theme.text)
      .text(totalValue, mainX, sy, { width: mainW, align: "right" });

    return sy + 40;
  }

  drawAttendees(startY) {
    const { mainX, mainW } = this.layout;
    const { args, theme } = this;
    const rowH = 30; // Taller rows for breathability
    let aY = this.sectionTitle("Attendees", mainX, startY) + 12;

    const attendees = args.attendees || [];

    if (!attendees.length) {
      this.doc
        .font("Body")
        .fontSize(12)
        .fillColor(theme.subtext)
        .text("No attendee names on file.", mainX, aY);
    } else {
      attendees.forEach((a, i) => {
        // No background striping, just a clean bottom border
        this.doc
          .font("Body")
          .fontSize(12)
          .fillColor(theme.subtext)
          .text(String(i + 1).padStart(2, "0"), mainX, aY + 8, { width: 30 });

        this.doc
          .font("Body")
          .fontSize(12)
          .fillColor(theme.text)
          .text(a?.name || "Guest", mainX + 40, aY + 8, { width: mainW - 40 });

        aY += rowH;
        this.divider(mainX, mainX + mainW, aY);
      });
    }
  }

  drawRightRail() {
    const { stubX, stubW, contentTop } = this.layout;
    const { args, theme } = this;

    let sY = contentTop + 30;

    // Status Chip (Sharp, bordered)
    const statLabel = (args.status || "STATUS").toUpperCase();
    this.chip(statLabel, stubX, sY, {
      bg: this.statusStyle.bg,
      fg: this.statusStyle.fg,
      border: this.statusStyle.border,
    });

    sY += 50;
    sY = this.sectionTitle("Check-in", stubX, sY) + 16;

    if (this.qrImgBuf) {
      // Sharper QR presentation
      this.doc
        .save()
        .rect(stubX, sY, this.qrSize, this.qrSize)
        .lineWidth(1)
        .strokeColor(theme.border)
        .stroke()
        .restore();

      this.doc.image(this.qrImgBuf, stubX, sY, { width: this.qrSize });

      this.doc
        .font("Body")
        .fontSize(10)
        .fillColor(theme.subtext)
        .text("Scan upon arrival", stubX, sY + this.qrSize + 12, {
          width: this.qrSize,
          align: "center",
          characterSpacing: 0.5,
        });

      sY += this.qrSize + 50;
    }

    sY = this.sectionTitle("Important info", stubX, sY) + 12;
    const infoLines = [
      "Arrive 10–15 mins early.",
      "Bring a valid ID.",
      "Reply to email for changes.",
    ];

    this.doc.font("Body").fontSize(11).fillColor(theme.text);
    infoLines.forEach((line) => {
      this.doc.text(`—  ${line}`, stubX, this.doc.y, {
        width: stubW,
        lineGap: 6,
      });
    });
  }

  drawFooter() {
    const { page, contentW, contentTop } = this.layout;
    const { args, theme } = this;

    const extraBits = [args.supportEmail, args.supportPhone].filter(Boolean);

    const footerNote =
      args.footerNote || "Please present this ticket at check-in.";
    const noteLine = extraBits.length
      ? `${footerNote}   |   ${extraBits.join("   |   ")}`
      : footerNote;

    const footerOpts = { width: contentW, align: "center" };
    const footerY = page.h - this.inset + 10;

    this.doc
      .font("Body")
      .fontSize(9)
      .fillColor(theme.subtext)
      .text(noteLine.toUpperCase(), page.x + this.inset, footerY, {
        ...footerOpts,
        characterSpacing: 1,
      });
  }

  drawWatermark() {
    const { page } = this.layout;
    const { args, theme } = this;
    const finalWatermarkText = args.watermarkText || args.brandName || "OASIS";
    const hasLogoForWatermark = args.logoUrl && fs.existsSync(args.logoUrl);

    // Make watermark extremely subtle for the clean look
    if (hasLogoForWatermark) {
      const wmWidth = page.w * 0.4;
      const wmX = (page.w - wmWidth) / 2;
      const wmY = page.h / 2 - wmWidth / 2;
      this.doc
        .save()
        .opacity(0.02)
        .image(args.logoUrl, wmX, wmY, { width: wmWidth })
        .restore();
    } else if (finalWatermarkText) {
      this.doc
        .save()
        .opacity(0.02)
        .rotate(-25, { origin: [page.w / 2, page.h / 2] })
        .font("Body-Bold")
        .fontSize(100)
        .fillColor(theme.text)
        .text(finalWatermarkText, page.w / 2 - 280, page.h / 2 - 50, {
          width: 560,
          align: "center",
        })
        .restore();
    }
  }

  async generate() {
    const fonts = await this.loadFonts();
    this.qrImgBuf = await this.precomputeQR();

    this.doc = new PDFDocument({ size: "A4", margin: 0, font: fonts.regular });
    this.setupLayout();

    this.doc.info.Title = "Booking Confirmation";
    this.doc.info.Author = String(this.args.brandName || "");
    this.doc.info.Subject = "Reservation Ticket";

    const chunks = [];
    return new Promise((resolve, reject) => {
      this.doc.on("data", (c) => chunks.push(c));
      this.doc.on("end", () => resolve(Buffer.concat(chunks)));
      this.doc.on("error", reject);

      this.doc.registerFont("Body", fonts.regular);
      this.doc.registerFont("Body-Bold", fonts.bold);
      this.doc.font("Body");

      this.drawBackgroundAndHeader();
      this.drawTicketBody();
      this.drawMainContent();
      this.drawRightRail();
      this.drawFooter();
      this.drawWatermark();

      this.doc.end();
    });
  }
}

export default async function buildTicketPdfBuffer(args = {}) {
  const generator = new TicketGenerator(args);
  return await generator.generate();
}
