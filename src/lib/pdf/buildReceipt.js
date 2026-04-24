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
    currency: String(currency || "EUR").toUpperCase(),
  }).format(Number(amount) || 0);
}

function safeItems(items) {
  try {
    if (typeof items === "string") return JSON.parse(items);
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function itemQty(item) {
  return Number(item.quantity || item.qty || 1) || 1;
}

function itemGrossUnit(item) {
  return Number(item.unitPrice || item.price || 0) || 0;
}

function itemVatRate(item) {
  return Number(item.vatRate ?? item.vat ?? 24) || 0;
}

function getItemTaxParts(item) {
  const qty = itemQty(item);
  const grossUnit = itemGrossUnit(item);
  const vatRate = itemVatRate(item);

  const grossTotal = grossUnit * qty;
  const netTotal = vatRate > 0 ? grossTotal / (1 + vatRate / 100) : grossTotal;
  const taxTotal = grossTotal - netTotal;
  const netUnit = qty > 0 ? netTotal / qty : netTotal;

  return {
    qty,
    vatRate,
    grossUnit,
    grossTotal,
    netUnit,
    netTotal,
    taxTotal,
  };
}

class ReceiptGenerator {
  constructor(args = {}) {
    this.args = args;
    this.receipt = args.receipt || {};
    this.store = args.store || {
      name: "Oasis",
      address: "123 Artisan Lane\nChania, Crete 73100",
      taxId: "EL123456789",
    };

    this.theme = {
      primary: "#000000",
      text: "#111111",
      subtext: "#767676",
      border: "#eaeaea",
      panel: "#f9f9f9",
      pageBg: "#ffffff",
    };

    this.items = safeItems(this.receipt.items);
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
        `[receipt] Premium font files not found.\nChecked:\n${candidates.join(
          "\n",
        )}\nPlease add ${fontRegular} and ${fontBold} to your fonts folder.`,
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
      w,
      h,
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

  divider(y, thickness = 1, color = this.theme.border) {
    this.doc
      .moveTo(this.layout.x, y)
      .lineTo(this.layout.rightEdge, y)
      .strokeColor(color)
      .lineWidth(thickness)
      .stroke();
  }

  newPage() {
    this.doc.addPage();
    this.setupLayout();

    this.doc
      .rect(0, 0, this.doc.page.width, this.doc.page.height)
      .fill(this.theme.pageBg);

    return this.layout.y;
  }

  checkPage(y, needed = 120) {
    if (y + needed < this.layout.h - this.inset) return y;
    return this.newPage();
  }

  drawHeader() {
    const { x, contentW } = this.layout;
    const { store, receipt, theme } = this;

    let currentY = this.layout.y;

    this.doc
      .font("Body-Bold")
      .fontSize(20)
      .fillColor(theme.text)
      .text(String(store.name || "Oasis").toUpperCase(), x, currentY, {
        characterSpacing: 2,
      });

    currentY += 28;

    this.doc
      .font("Body")
      .fontSize(10)
      .fillColor(theme.subtext)
      .text(store.address || "", x, currentY, { lineGap: 4 });

    this.doc.text(`VAT: ${store.taxId || "-"}`, x, this.doc.y + 4);

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
      .font("Body")
      .fontSize(9)
      .fillColor(theme.subtext)
      .text("RECEIPT NO.", x, metaY + 28, {
        width: contentW,
        align: "right",
        characterSpacing: 1,
      });

    this.doc
      .font("Body-Bold")
      .fontSize(14)
      .fillColor(theme.text)
      .text(receiptNum, x, metaY + 42, {
        width: contentW,
        align: "right",
        characterSpacing: 2,
      });

    this.doc
      .font("Body")
      .fontSize(10)
      .fillColor(theme.subtext)
      .text(dateStr, x, metaY + 62, {
        width: contentW,
        align: "right",
      });

    currentY = Math.max(this.doc.y, metaY + 76) + 28;
    this.divider(currentY, 2, theme.primary);

    return currentY + 20;
  }

  drawTable(startY) {
    const { cols } = this.layout;
    const { theme, items, currency } = this;

    let y = startY;

    this.doc.font("Body-Bold").fontSize(9).fillColor(theme.subtext);
    this.doc.text("QTY", cols.qty, y, { characterSpacing: 1 });
    this.doc.text("ITEM / TAX", cols.item, y, { characterSpacing: 1 });
    this.doc.text("NET UNIT", cols.price, y, {
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

    for (const item of items) {
      y = this.checkPage(y, 90);

      const name = item.name || "Custom Charge";
      const sku = item.sku || null;
      const parts = getItemTaxParts(item);
      const itemW = cols.price - cols.item - 20;

      this.doc
        .font("Body")
        .fontSize(11)
        .fillColor(theme.subtext)
        .text(String(parts.qty), cols.qty, y);

      this.doc
        .font("Body-Bold")
        .fontSize(11)
        .fillColor(theme.text)
        .text(name, cols.item, y, { width: itemW });

      const nameHeight = this.doc.heightOfString(name, { width: itemW });

      let detailY = y + nameHeight + 3;

      if (sku) {
        this.doc
          .font("Body")
          .fontSize(8)
          .fillColor(theme.subtext)
          .text(`SKU: ${sku}`, cols.item, detailY, { width: itemW });
        detailY += 11;
      }

      this.doc
        .font("Body")
        .fontSize(8)
        .fillColor(theme.subtext)
        .text(
          `VAT ${parts.vatRate}% - Net ${formatCurrency(
            parts.netTotal,
            currency,
          )} - Tax ${formatCurrency(parts.taxTotal, currency)}`,
          cols.item,
          detailY,
          { width: itemW },
        );

      this.doc.font("Body").fontSize(11).fillColor(theme.text);

      this.doc.text(formatCurrency(parts.netUnit, currency), cols.price, y, {
        width: 80,
        align: "right",
      });

      this.doc.text(formatCurrency(parts.grossTotal, currency), cols.total, y, {
        width: 80,
        align: "right",
      });

      y = Math.max(detailY + 14, y + nameHeight + 28);
      this.divider(y, 1, theme.border);
      y += 15;
    }

    return y;
  }

  getTaxSummary() {
    const discount = Number(this.receipt.discountAmount || 0);

    const grossBeforeDiscount = this.items.reduce((sum, item) => {
      const parts = getItemTaxParts(item);
      return sum + parts.grossTotal;
    }, 0);

    const discountRatio =
      grossBeforeDiscount > 0 ? Math.min(discount / grossBeforeDiscount, 1) : 0;

    const groups = {};

    for (const item of this.items) {
      const parts = getItemTaxParts(item);
      const discountedGross = parts.grossTotal * (1 - discountRatio);
      const net =
        parts.vatRate > 0
          ? discountedGross / (1 + parts.vatRate / 100)
          : discountedGross;
      const tax = discountedGross - net;

      if (!groups[parts.vatRate]) {
        groups[parts.vatRate] = {
          rate: parts.vatRate,
          net: 0,
          tax: 0,
          gross: 0,
        };
      }

      groups[parts.vatRate].net += net;
      groups[parts.vatRate].tax += tax;
      groups[parts.vatRate].gross += discountedGross;
    }

    const netTotal = Object.values(groups).reduce((s, g) => s + g.net, 0);
    const taxTotal = Object.values(groups).reduce((s, g) => s + g.tax, 0);
    const grossTotal = Object.values(groups).reduce((s, g) => s + g.gross, 0);

    return {
      discount,
      grossBeforeDiscount,
      groups,
      netTotal,
      taxTotal,
      grossTotal,
    };
  }

  drawTotals(startY) {
    const { rightEdge } = this.layout;
    const { theme, receipt, currency } = this;

    let y = this.checkPage(startY + 10, 170);

    const labelX = rightEdge - 230;
    const valX = rightEdge - 100;
    const valW = 100;

    const tax = this.getTaxSummary();

    const receiptTotal = Number(
      receipt.totalPaidAmount || receipt.totalAmount || tax.grossTotal || 0,
    );

    this.doc.font("Body").fontSize(11).fillColor(theme.subtext);
    this.doc.text("Amount before tax", labelX, y);
    this.doc
      .fillColor(theme.text)
      .text(formatCurrency(tax.netTotal, currency), valX, y, {
        width: valW,
        align: "right",
      });
    y += 20;

    Object.values(tax.groups)
      .sort((a, b) => Number(a.rate) - Number(b.rate))
      .forEach((group) => {
        this.doc
          .font("Body")
          .fontSize(11)
          .fillColor(theme.subtext)
          .text(`VAT ${group.rate}%`, labelX, y);

        this.doc
          .fillColor(theme.text)
          .text(formatCurrency(group.tax, currency), valX, y, {
            width: valW,
            align: "right",
          });

        y += 20;
      });

    this.doc.font("Body").fontSize(11).fillColor(theme.subtext);
    this.doc.text("Tax total", labelX, y);
    this.doc
      .fillColor(theme.text)
      .text(formatCurrency(tax.taxTotal, currency), valX, y, {
        width: valW,
        align: "right",
      });
    y += 20;

    if (tax.discount > 0) {
      this.doc.fillColor(theme.subtext).text("Discount", labelX, y);
      this.doc
        .fillColor(theme.text)
        .text(`-${formatCurrency(tax.discount, currency)}`, valX, y, {
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
    this.doc.text("Total after tax", labelX, y);
    this.doc.text(formatCurrency(receiptTotal, currency), valX, y, {
      width: valW,
      align: "right",
    });

    return y + 50;
  }

  drawFooter(startY) {
    const { x, contentW, h } = this.layout;
    const { theme, receipt } = this;

    let y = this.checkPage(startY, 120);

    this.doc.save().rect(x, y, 250, 78).fill(theme.panel).restore();

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
        .fontSize(8)
        .fillColor(theme.subtext)
        .text(`REF: ${receipt.paymentReference}`, x + 15, y + 49, {
          width: 220,
          ellipsis: true,
        });
    }

    this.doc
      .font("Body")
      .fontSize(8)
      .fillColor(theme.subtext)
      .text(`Receipt ID: ${receipt.id || "-"}`, x + 15, y + 62);

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

    this.doc = new PDFDocument({
      size: "A4",
      margin: 0,
      font: fonts.regular,
    });

    this.doc.registerFont("Body", fonts.regular);
    this.doc.registerFont("Body-Bold", fonts.bold);
    this.doc.font("Body");

    this.setupLayout();

    this.doc.info.Title = `Receipt ${this.receipt.id || ""}`;
    this.doc.info.Author = String(this.store.name || "");
    this.doc.info.Subject = "Customer Receipt";

    const chunks = [];

    return new Promise((resolve, reject) => {
      this.doc.on("data", (c) => chunks.push(c));
      this.doc.on("end", () => resolve(Buffer.concat(chunks)));
      this.doc.on("error", reject);

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
