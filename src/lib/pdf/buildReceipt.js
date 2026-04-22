// src/lib/pdf/buildReceipt.js
import "server-only";
import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function formatCurrency(amount, currency = "EUR") {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount || 0);
}

class ReceiptGenerator {
  constructor(args) {
    this.args = args;
    this.receipt = args.receipt || {};
    this.store = args.store || {
      name: "Oasis",
      address: "123 Artisan Lane\nChania, Crete 73100",
      taxId: "EL123456789",
    };

    // PREMIUM MINIMALIST THEME: Monochrome, high contrast
    this.theme = {
      primary: "#000000",
      text: "#111111",
      subtext: "#767676",
      border: "#eaeaea",
      panel: "#f9f9f9",
      pageBg: "#ffffff",
    };

    // Parse items safely
    this.items =
      typeof this.receipt.items === "string"
        ? JSON.parse(this.receipt.items)
        : this.receipt.items || [];

    this.inset = 50;
    this.currency = this.receipt.currency || "EUR";
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
        `[receipt] Premium font files not found.\nChecked:\n${candidates.join("\n")}\nPlease add ${fontRegular} and ${fontBold} to your fonts folder.`,
      );
    }

    return {
      regular: fs.readFileSync(path.join(base, fontRegular)),
      bold: fs.readFileSync(path.join(base, fontBold)),
    };
  }

  setupLayout() {
    const w = this.doc.page.width;
    const h = this.doc.page.height;

    this.layout = {
      x: this.inset,
      y: this.inset,
      w: w,
      h: h,
      contentW: w - this.inset * 2,
      rightEdge: w - this.inset,
      cols: {
        qty: this.inset,
        item: this.inset + 40,
        price: w - this.inset - 180,
        total: w - this.inset - 80,
      },
    };
  }

  /* ---------- DRAWING HELPERS ---------- */

  divider(y, thickness = 1, color = this.theme.border) {
    this.doc
      .moveTo(this.layout.x, y)
      .lineTo(this.layout.rightEdge, y)
      .strokeColor(color)
      .lineWidth(thickness)
      .stroke();
  }

  /* ---------- DRAWING PHASES ---------- */

  drawHeader() {
    const { x, contentW, rightEdge } = this.layout;
    const { store, receipt, theme } = this;

    let currentY = this.layout.y;

    // Left: Store Info
    this.doc
      .font("Body-Bold")
      .fontSize(20)
      .fillColor(theme.text)
      .text(store.name.toUpperCase(), x, currentY, { characterSpacing: 2 });

    currentY += 28;

    this.doc
      .font("Body")
      .fontSize(10)
      .fillColor(theme.subtext)
      .text(store.address, x, currentY, { lineGap: 4 });

    this.doc.text(`VAT: ${store.taxId}`, x, this.doc.y + 4);

    // Right: Document Meta
    const metaY = this.layout.y;

    this.doc
      .font("Body-Bold")
      .fontSize(20)
      .fillColor(theme.text)
      .text("RECEIPT", x, metaY, {
        width: contentW,
        align: "right",
        characterSpacing: 2,
      });

    const receiptNum = String(receipt.id || "0").padStart(6, "0");
    const dateStr = receipt.created_at
      ? new Date(receipt.created_at).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "-";

    this.doc
      .font("Body-Bold")
      .fontSize(10)
      .fillColor(theme.text)
      .text(`No. ${receiptNum}`, x, metaY + 30, {
        width: contentW,
        align: "right",
      });

    this.doc
      .font("Body")
      .fillColor(theme.subtext)
      .text(dateStr, x, metaY + 45, { width: contentW, align: "right" });

    // Base divider
    currentY = Math.max(this.doc.y, metaY + 60) + 30;
    this.divider(currentY, 2, theme.primary);
    return currentY + 20;
  }

  drawTable(startY) {
    const { cols, rightEdge } = this.layout;
    const { theme, items, currency } = this;

    let y = startY;

    // Table Headers
    this.doc.font("Body-Bold").fontSize(9).fillColor(theme.subtext);
    this.doc.text("QTY", cols.qty, y, { characterSpacing: 1 });
    this.doc.text("ITEM", cols.item, y, { characterSpacing: 1 });
    this.doc.text("PRICE", cols.price, y, {
      width: 80,
      align: "right",
      characterSpacing: 1,
    });
    this.doc.text("TOTAL", cols.total, y, {
      width: 80,
      align: "right",
      characterSpacing: 1,
    });

    y += 20;
    this.divider(y);
    y += 15;

    // Table Rows
    this.doc.font("Body").fontSize(11).fillColor(theme.text);

    for (const item of items) {
      // Pagination Check
      if (y > this.layout.h - 150) {
        this.doc.addPage();
        y = this.layout.y;
      }

      const qty = String(item.quantity || item.qty || 1);
      const name = item.name || "Custom Charge";
      const unitPrice = Number(item.unitPrice || item.price || 0);
      const total = unitPrice * Number(qty);

      this.doc.font("Body").fillColor(theme.subtext).text(qty, cols.qty, y);

      // Item name + optional SKU
      this.doc
        .font("Body-Bold")
        .fillColor(theme.text)
        .text(name, cols.item, y, { width: cols.price - cols.item - 20 });
      const textHeight = this.doc.heightOfString(name, {
        width: cols.price - cols.item - 20,
      });

      if (item.sku) {
        this.doc
          .font("Body")
          .fontSize(9)
          .fillColor(theme.subtext)
          .text(`SKU: ${item.sku}`, cols.item, y + textHeight + 2);
      }

      // Prices
      this.doc.font("Body").fontSize(11).fillColor(theme.text);
      this.doc.text(formatCurrency(unitPrice, currency), cols.price, y, {
        width: 80,
        align: "right",
      });
      this.doc.text(formatCurrency(total, currency), cols.total, y, {
        width: 80,
        align: "right",
      });

      y += textHeight + (item.sku ? 20 : 15);
      this.divider(y, 1, theme.border);
      y += 15;
    }

    return y;
  }

  drawTotals(startY) {
    const { x, contentW, rightEdge } = this.layout;
    const { theme, receipt, currency } = this;

    let y = startY + 10;
    const labelX = rightEdge - 200;
    const valX = rightEdge - 100;
    const valW = 100;

    // Calculate subtotal
    const discount = Number(receipt.discountAmount || 0);
    const total = Number(receipt.totalPaidAmount || receipt.totalAmount || 0);
    const subtotal = total + discount;

    this.doc.font("Body").fontSize(11).fillColor(theme.subtext);
    this.doc.text("Subtotal", labelX, y);
    this.doc
      .fillColor(theme.text)
      .text(formatCurrency(subtotal, currency), valX, y, {
        width: valW,
        align: "right",
      });
    y += 20;

    if (discount > 0) {
      this.doc.fillColor(theme.subtext).text("Discount", labelX, y);
      this.doc.text(`-${formatCurrency(discount, currency)}`, valX, y, {
        width: valW,
        align: "right",
      });
      y += 20;
    }

    y += 5;
    this.doc
      .moveTo(labelX, y)
      .lineTo(rightEdge, y)
      .strokeColor(theme.border)
      .lineWidth(1)
      .stroke();
    y += 15;

    this.doc.font("Body-Bold").fontSize(14).fillColor(theme.text);
    this.doc.text("Total", labelX, y);
    this.doc.text(formatCurrency(total, currency), valX, y, {
      width: valW,
      align: "right",
    });

    return y + 50;
  }

  drawFooter(startY) {
    const { x, contentW, h } = this.layout;
    const { theme, receipt } = this;

    let y = startY;

    // Payment Info Box
    this.doc.save().rect(x, y, 250, 70).fill(theme.panel).restore();

    this.doc
      .font("Body-Bold")
      .fontSize(9)
      .fillColor(theme.subtext)
      .text("PAYMENT METHOD", x + 15, y + 15, { characterSpacing: 1 });

    this.doc
      .font("Body")
      .fontSize(11)
      .fillColor(theme.text)
      .text((receipt.paymentMethod || "Card").toUpperCase(), x + 15, y + 32);

    if (receipt.paymentReference) {
      this.doc
        .fontSize(9)
        .fillColor(theme.subtext)
        .text(`REF: ${receipt.paymentReference}`, x + 15, y + 48);
    }

    // Thank you message at the absolute bottom
    this.doc
      .font("Body")
      .fontSize(10)
      .fillColor(theme.subtext)
      .text(
        "Thank you for your visit. We hope to see you again soon.",
        x,
        h - 60,
        { width: contentW, align: "center", characterSpacing: 0.5 },
      );
  }

  async generate() {
    const fonts = await this.loadFonts();

    this.doc = new PDFDocument({ size: "A4", margin: 0, font: fonts.regular });
    this.setupLayout();

    this.doc.info.Title = `Receipt ${this.receipt.id || ""}`;
    this.doc.info.Author = String(this.store.name || "");
    this.doc.info.Subject = "Customer Receipt";

    const chunks = [];
    return new Promise((resolve, reject) => {
      this.doc.on("data", (c) => chunks.push(c));
      this.doc.on("end", () => resolve(Buffer.concat(chunks)));
      this.doc.on("error", reject);

      this.doc.registerFont("Body", fonts.regular);
      this.doc.registerFont("Body-Bold", fonts.bold);

      // White Background
      this.doc
        .rect(0, 0, this.doc.page.width, this.doc.page.height)
        .fill(this.theme.pageBg);

      let y = this.drawHeader();
      y = this.drawTable(y);
      y = this.drawTotals(y);
      this.drawFooter(y);

      this.doc.end();
    });
  }
}

export default async function buildReceiptPdfBuffer(args = {}) {
  const generator = new ReceiptGenerator(args);
  return await generator.generate();
}
