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

    // Centralize Theme
    this.theme = {
      primary: this.brand.primary || "#8b6f47",
      text: this.brand.text || "#2b2a28",
      subtext: this.brand.subtext || "#6b665d",
      border: this.brand.border || "#e2dcd0", // Slightly darker border for contrast
      panel: this.brand.panel || "#f9f8f4",
      headerText: this.brand.headerText || "#ffffff",
      pageBg: this.brand.pageBg || "#f3eee5", // Darker backdrop to make the white ticket pop
    };

    this.statusStyle = this.resolveStatusStyle(args.status);
    this.headerH = args.headerH ?? 76;
    this.inset = args.inset ?? 28;
    this.qrSize = args.qrSize ?? 124; // Slightly larger for scannability
  }

  resolveStatusStyle(status) {
    const s = String(status || "").toUpperCase();
    const styles = {
      CONFIRMED: { bg: "#eaf6ef", fg: "#186a3b" },
      PENDING: { bg: "#fff6e5", fg: "#8a5b00" },
      CANCELLED: { bg: "#fdeaea", fg: "#9c1a1a" },
      REFUNDED: { bg: "#eef3ff", fg: "#274690" },
    };
    return styles[s] || { bg: "#ffffff", fg: this.theme.primary };
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
    const gap = 32; // Increased gap for breathing room
    const stubW = 185;
    const mainW = contentW - stubW - gap;
    const stubX = contentX + mainW + gap;

    this.layout = {
      page: p,
      rightEdge: p.x + p.w,
      contentX,
      contentW,
      mainX: contentX + 24, // Inner padding inside the ticket
      mainW: mainW - 24,
      stubX,
      stubW: stubW - 24,
      gap,
      sepX: stubX - gap / 2, // Separator X coordinate (Perforation line)
      footerReserve: 64,
      contentTop: p.y + this.headerH + 32, // Push down slightly
    };
  }

  /* ---------- DRAWING HELPERS ---------- */

  sectionTitle(txt, x, y) {
    this.doc
      .font("Body-Bold")
      .fontSize(11) // Slightly smaller, tighter tracking look
      .fillColor(this.theme.subtext)
      .text(txt.toUpperCase(), x, y, { characterSpacing: 0.5 });
    return this.doc.y;
  }

  chip(txt, x, y, { bg, fg, bold = true }) {
    const padX = 14,
      padY = 7,
      h = 26;
    const w = this.doc.widthOfString(txt) + padX * 2;
    this.doc
      .save()
      .roundedRect(x, y, w, h, 999)
      .fill(bg || this.theme.panel)
      .fillColor(fg || this.theme.primary)
      .font(bold ? "Body-Bold" : "Body")
      .fontSize(11)
      .text(txt, x + padX, y + padY - 3)
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

  dottedSeparator(x, y1, y2) {
    this.doc
      .save()
      .dash(3, { space: 4 })
      .moveTo(x, y1)
      .lineTo(x, y2)
      .strokeColor(this.theme.border)
      .lineWidth(1.5)
      .stroke()
      .undash()
      .restore();
  }

  /* ---------- DRAWING PHASES ---------- */

  drawBackgroundAndHeader() {
    const { page, rightEdge, contentX } = this.layout;
    const { args, theme } = this;

    // 1. Base background
    this.doc
      .save()
      .rect(page.x, page.y, page.w, page.h)
      .fill(theme.pageBg)
      .restore();

    // 2. Header block
    this.doc
      .save()
      .rect(page.x, page.y, page.w, this.headerH)
      .fill(theme.primary)
      .restore();

    // Subtle dark trim at the bottom of the header for depth
    this.doc
      .save()
      .rect(page.x, page.y + this.headerH - 3, page.w, 3)
      .fillOpacity(0.12)
      .fill("#000000")
      .restore();

    // 3. Center "E-TICKET" Watermark/Label
    this.doc
      .save()
      .font("Body-Bold")
      .fontSize(10)
      .fillColor(theme.headerText)
      .opacity(0.5)
      .text("E-TICKET", page.x, page.y + (this.headerH - 10) / 2 + 1, {
        width: page.w,
        align: "center",
        characterSpacing: 6,
      })
      .restore();

    // 4. Logo / Brand Name (Left)
    const logoMaxH = 32;
    const logoY = page.y + (this.headerH - logoMaxH) / 2;

    try {
      if (args.logoUrl && fs.existsSync(args.logoUrl)) {
        // Constrain height instead of width to keep header vertically balanced
        this.doc.image(args.logoUrl, contentX, logoY, { height: logoMaxH });
      } else {
        throw new Error("Logo file not found");
      }
    } catch {
      this.doc
        .font("Body-Bold")
        .fontSize(22)
        .fillColor(theme.headerText)
        .text(
          args.brandName || "OASIS",
          contentX,
          page.y + (this.headerH - 22) / 2 - 2,
        );
    }

    // 5. Booking Reference "Pill" (Right)
    if (args.bookingRef) {
      const refBoxW = 130;
      const refBoxH = 44;
      const refBoxX = rightEdge - this.inset - refBoxW;
      const refBoxY = page.y + (this.headerH - refBoxH) / 2;

      // Semi-transparent pill background
      this.doc
        .save()
        .roundedRect(refBoxX, refBoxY, refBoxW, refBoxH, 8)
        .fillOpacity(0.15)
        .fill("#ffffff")
        .restore();

      // Pill border
      this.doc
        .save()
        .roundedRect(refBoxX, refBoxY, refBoxW, refBoxH, 8)
        .strokeOpacity(0.3)
        .lineWidth(1)
        .stroke("#ffffff")
        .restore();

      // Pill Labels
      this.doc
        .save()
        .font("Body-Bold")
        .fontSize(8)
        .fillColor(theme.headerText)
        .opacity(0.8)
        .text("BOOKING REF", refBoxX, refBoxY + 8, {
          width: refBoxW,
          align: "center",
          characterSpacing: 1,
        })
        .restore();

      this.doc
        .save()
        .font("Body-Bold")
        .fontSize(14)
        .fillColor(theme.headerText)
        .text(args.bookingRef, refBoxX, refBoxY + 22, {
          width: refBoxW,
          align: "center",
          characterSpacing: 1,
        })
        .restore();
    }
  }

  drawTicketBody() {
    const { page, contentX, contentW, contentTop, sepX, footerReserve } =
      this.layout;
    const rightCardH = page.h - contentTop - footerReserve - this.inset;
    const ticketY = contentTop - 16;
    const ticketH = rightCardH + 16;
    const r = 14; // Radius of punch holes

    // 1. Soft Drop Shadow
    this.doc
      .save()
      .roundedRect(contentX + 2, ticketY + 4, contentW, ticketH, 16)
      .fillOpacity(0.05)
      .fill("#000000")
      .restore();

    // 2. Main White Ticket Container
    this.doc
      .save()
      .roundedRect(contentX, ticketY, contentW, ticketH, 16)
      .fill("#ffffff")
      .strokeColor(this.theme.border)
      .lineWidth(1)
      .stroke()
      .restore();

    // 3. Realistic Punch Hole Cutouts (Masking with Background Color + SVG arcs for border)
    // Top Cutout
    this.doc.save().circle(sepX, ticketY, r).fill(this.theme.pageBg).restore();
    this.doc
      .path(`M ${sepX - r} ${ticketY} A ${r} ${r} 0 0 0 ${sepX + r} ${ticketY}`)
      .strokeColor(this.theme.border)
      .lineWidth(1)
      .stroke();

    // Bottom Cutout
    this.doc
      .save()
      .circle(sepX, ticketY + ticketH, r)
      .fill(this.theme.pageBg)
      .restore();
    this.doc
      .path(
        `M ${sepX - r} ${ticketY + ticketH} A ${r} ${r} 0 0 1 ${sepX + r} ${ticketY + ticketH}`,
      )
      .strokeColor(this.theme.border)
      .lineWidth(1)
      .stroke();

    // 4. Perforation Line
    this.dottedSeparator(sepX, ticketY + r + 8, ticketY + ticketH - r - 8);
  }

  drawMainContent() {
    const { mainX, mainW, contentTop } = this.layout;
    const { args, theme } = this;
    let y = contentTop + 4;

    this.doc
      .font("Body-Bold")
      .fontSize(28)
      .fillColor(theme.text)
      .text(args.experienceName || "Reservation", mainX, y, { width: mainW });
    y = this.doc.y + 6;

    if (args.location) {
      this.doc
        .font("Body")
        .fontSize(13)
        .fillColor(theme.subtext)
        .text(args.location, mainX, y, { width: mainW });
      y = this.doc.y + 16;
    } else {
      y += 12;
    }

    y = this.drawOrderSummary(y);
    this.drawAttendees(y);
  }

  drawOrderSummary(startY) {
    const { mainX, mainW } = this.layout;
    const { args, theme } = this;
    const cardPad = 16;
    const leftColW = 120;
    const valX = mainX + cardPad + leftColW;
    const valW = mainW - leftColW - cardPad * 2 - 4; // Max width for values

    const whenStr = [
      args.dateLabel,
      args.timeLabel ? `, ${args.timeLabel}` : "",
    ]
      .filter(Boolean)
      .join("");

    // 1. Define our rows dynamically
    const rows = [
      { label: "Experience", value: args.experienceName || "-" },
      { label: "Date", value: whenStr || "-" },
    ];

    // Add Pickup Point if it was provided
    if (args.pickupPoint) {
      rows.push({ label: "Pickup", value: args.pickupPoint });
    }

    // 2. Pre-calculate the heights of each row so we know exactly how tall the box needs to be
    let rowsTotalHeight = 0;
    const rowMetrics = rows.map((r) => {
      this.doc.font("Body").fontSize(12);
      // Determine height of text (minimum 24px per row for spacing)
      const textHeight = this.doc.heightOfString(r.value, { width: valW });
      const h = Math.max(24, textHeight + 8);
      rowsTotalHeight += h;
      return { ...r, h };
    });

    const sumH = 40 + rowsTotalHeight + 44;
    // 3. Draw the background panel
    this.doc
      .save()
      .roundedRect(mainX, startY, mainW, sumH, 12)
      .fill(theme.panel)
      .strokeColor(theme.border)
      .lineWidth(1)
      .stroke()
      .restore();

    // 4. Draw Title
    let sy = startY + cardPad;
    sy = this.sectionTitle("Order summary", mainX + cardPad, sy) + 12;

    // 5. Draw dynamically measured rows
    rowMetrics.forEach((r) => {
      this.doc
        .font("Body-Bold")
        .fontSize(11.5)
        .fillColor(theme.subtext)
        .text(r.label, mainX + cardPad, sy, { width: leftColW - 8 });

      this.doc
        .font("Body")
        .fontSize(12)
        .fillColor(theme.text)
        .text(r.value, valX, sy, { width: valW });

      sy += r.h;
    });

    // 6. Draw Total Pill
    const totalText = `Total  ${args.amountLabel || "-"}${args.currency ? ` (${args.currency})` : ""}`;
    this.chip(
      totalText,
      mainX + mainW - cardPad - this.doc.widthOfString(totalText) - 36,
      startY + sumH - 40,
      { bg: "#ffffff", fg: theme.text },
    );

    return startY + sumH + 24; // Return the new Y coordinate for the Attendees table
  }

  drawAttendees(startY) {
    const { mainX, mainW } = this.layout;
    const { args, theme } = this;
    const rowH = 24;
    let aY = this.sectionTitle("Guest List", mainX, startY) + 8;

    this.doc
      .save()
      .roundedRect(mainX, aY, mainW, rowH, 8)
      .fill(theme.panel)
      .strokeColor(theme.border)
      .lineWidth(1)
      .stroke()
      .restore();

    this.doc
      .font("Body-Bold")
      .fontSize(11)
      .fillColor(theme.subtext)
      .text("No.", mainX + 16, aY + 6, { width: 40 });
    this.doc
      .font("Body-Bold")
      .fontSize(11)
      .fillColor(theme.subtext)
      .text("Name", mainX + 70, aY + 6, { width: mainW - 90 });

    let tY = aY + rowH;
    const attendees = args.attendees || [];

    if (!attendees.length) {
      this.doc
        .font("Body")
        .fontSize(12)
        .fillColor(theme.text)
        .text("No attendee names on file.", mainX + 16, tY + 8);
      tY += rowH + 12;
    } else {
      attendees.forEach((a, i) => {
        // Alternating row colors
        if (i % 2 === 1)
          this.doc
            .save()
            .rect(mainX, tY, mainW, rowH)
            .fill(theme.panel)
            .restore();

        this.doc
          .font("Body")
          .fontSize(12)
          .fillColor(theme.subtext)
          .text(String(i + 1).padStart(2, "0"), mainX + 16, tY + 6, {
            width: 40,
          });
        this.doc
          .font("Body")
          .fontSize(12)
          .fillColor(theme.text)
          .text(a?.name || "Guest", mainX + 70, tY + 6, { width: mainW - 90 });
        tY += rowH;
      });
      // Outer border for the table
      this.doc
        .roundedRect(mainX, aY, mainW, tY - aY, 8)
        .strokeColor(theme.border)
        .lineWidth(1)
        .stroke();
    }
  }

  drawRightRail() {
    const { stubX, stubW, contentTop } = this.layout;
    const { args, theme } = this;

    // Status at the top of the stub
    const statLabel = (args.status || "STATUS").toUpperCase();
    const statW = this.doc.widthOfString(statLabel) + 24;
    this.chip(statLabel, stubX + (stubW - statW) / 2, contentTop + 4, {
      bg: this.statusStyle.bg,
      fg: this.statusStyle.fg,
    });

    let sY = contentTop + 54;
    sY = this.sectionTitle("Check-in", stubX, sY) + 12;

    if (this.qrImgBuf) {
      const qx = stubX + Math.round((stubW - this.qrSize) / 2);
      this.doc.image(this.qrImgBuf, qx, sY, { width: this.qrSize });

      this.doc
        .font("Body")
        .fontSize(10.5)
        .fillColor(theme.subtext)
        .text("Scan at entrance", stubX, sY + this.qrSize + 12, {
          width: stubW,
          align: "center",
        });

      sY += this.qrSize + 48;
    }

    sY = this.sectionTitle("Important info", stubX, sY) + 8;
    const infoLines = [
      "Arrive 10–15 mins early.",
      "Bring a light jacket.",
      "Reply to email for changes.",
    ];

    this.doc.font("Body").fontSize(11).fillColor(theme.text);
    infoLines.forEach((line) => {
      this.doc.circle(stubX + 4, this.doc.y + 6, 2).fill(theme.primary); // Custom bullet point
      this.doc.text(line, stubX + 14, this.doc.y, {
        width: stubW - 14,
        lineGap: 4,
      });
    });
  }

  drawFooter() {
    const { page, rightEdge, contentW, contentTop, sepX } = this.layout;
    const { args, theme } = this;

    const extraBits = [
      args.supportEmail ? `Email: ${args.supportEmail}` : null,
      args.supportPhone ? `Phone: ${args.supportPhone}` : null,
    ].filter(Boolean);

    const footerNote = args.footerNote || "Present this ticket at check-in.";
    const noteLine = extraBits.length
      ? `${footerNote}  •  ${extraBits.join("  •  ")}`
      : footerNote;

    const footerOpts = { width: contentW, align: "center" };
    const footerHeight = this.doc.heightOfString(noteLine, footerOpts);
    const footerY = page.y + page.h - this.inset - footerHeight;

    this.doc
      .font("Body")
      .fontSize(9.5)
      .fillColor(theme.subtext)
      .text(noteLine, page.x + this.inset, footerY, footerOpts);
  }

  drawWatermark() {
    const { page } = this.layout;
    const { args, theme } = this;
    const finalWatermarkText = args.watermarkText || args.brandName || "OASIS";
    const hasLogoForWatermark = args.logoUrl && fs.existsSync(args.logoUrl);

    if (hasLogoForWatermark) {
      const wmWidth = page.w * 0.6;
      const wmX = (page.w - wmWidth) / 2;
      const wmY = page.h / 2 - wmWidth / 2;
      this.doc
        .save()
        .opacity(0.04)
        .image(args.logoUrl, wmX, wmY, { width: wmWidth })
        .opacity(1)
        .restore();
    } else if (finalWatermarkText) {
      this.doc
        .save()
        .opacity(0.03)
        .rotate(-18, { origin: [page.w / 2, page.h / 2] })
        .font("Body-Bold")
        .fontSize(130)
        .fillColor(theme.text)
        .text(finalWatermarkText, page.w / 2 - 280, page.h / 2 - 50, {
          width: 560,
          align: "center",
        })
        .opacity(1)
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
      this.drawTicketBody(); // Draws the single ticket container
      this.drawMainContent(); // Populates the left side
      this.drawRightRail(); // Populates the right side
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
