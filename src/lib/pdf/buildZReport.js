import "server-only";
import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function money(amount, currency = "EUR") {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: String(currency || "EUR").toUpperCase(),
  }).format(Number(amount) || 0);
}

function dateTime(value) {
  if (!value) return "-";

  return new Date(value).toLocaleString("en-GB", {
    timeZone: "Europe/Athens",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeOnly(value) {
  if (!value) return "-";

  return new Date(value).toLocaleTimeString("en-GB", {
    timeZone: "Europe/Athens",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function safeText(value) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

class ZReportGenerator {
  constructor(args = {}) {
    this.args = args;
    this.report = args.report || {};
    this.summary = args.summary || {};
    this.transactions = Array.isArray(args.transactions)
      ? args.transactions
      : [];
    this.reconciliation = args.reconciliation || {};
    this.currency = args.currency || "EUR";

    this.store = args.store || {
      name: "Oasis",
      address: "Chania, Crete 73100",
      taxId: "EL123456789",
    };

    this.theme = {
      primary: "#000000",
      text: "#111111",
      subtext: "#767676",
      border: "#eaeaea",
      panel: "#f9f9f9",
      pageBg: "#ffffff",
      danger: "#b91c1c",
    };

    this.inset = 50;
  }

  async loadFonts() {
    const candidates = [
      this.args.fontDir,
      path.join(process.cwd(), "public", "fonts"),
      path.join(__dirname, "..", "..", "..", "public", "fonts"),
      path.join(__dirname, "..", "..", "..", "..", "public", "fonts"),
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
        `[z-report] Font files not found. Checked:\n${candidates.join(
          "\n",
        )}\nExpected ${fontRegular} and ${fontBold}`,
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
    };
  }

  font(name) {
    this.doc.font(name === "bold" ? "Body-Bold" : "Body");
    return this.doc;
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

  checkPage(y, needed = 80) {
    if (y + needed < this.layout.h - this.inset) return y;
    return this.newPage();
  }

  drawHeader() {
    const { x, contentW } = this.layout;
    const { store, report, theme } = this;

    let y = this.layout.y;

    this.font("bold")
      .fontSize(20)
      .fillColor(theme.text)
      .text(safeText(store.name).toUpperCase(), x, y, {
        characterSpacing: 2,
      });

    y += 28;

    this.font("regular")
      .fontSize(10)
      .fillColor(theme.subtext)
      .text(store.address || "", x, y, { lineGap: 4 });

    this.doc.text(`VAT: ${store.taxId || "-"}`, x, this.doc.y + 4);

    const metaY = this.layout.y;

    this.font("bold")
      .fontSize(20)
      .fillColor(theme.text)
      .text("Z-REPORT", x, metaY, {
        width: contentW,
        align: "right",
        characterSpacing: 2,
      });

    this.font("bold")
      .fontSize(10)
      .fillColor(theme.text)
      .text(`DATE: ${report.date || "-"}`, x, metaY + 30, {
        width: contentW,
        align: "right",
      });

    this.font("regular")
      .fontSize(10)
      .fillColor(theme.subtext)
      .text(`STATUS: ${report.status || "UNVERIFIED"}`, x, metaY + 45, {
        width: contentW,
        align: "right",
      })
      .text(`PRINTED: ${dateTime(new Date().toISOString())}`, x, metaY + 60, {
        width: contentW,
        align: "right",
      });

    if (report.id) {
      this.doc.text(`REPORT ID: ${report.id}`, x, metaY + 75, {
        width: contentW,
        align: "right",
      });
    }

    y = Math.max(this.doc.y, metaY + 90) + 22;
    this.divider(y, 2, theme.primary);

    return y + 22;
  }

  sectionTitle(title, y) {
    y = this.checkPage(y, 60);

    this.font("bold")
      .fontSize(10)
      .fillColor(this.theme.text)
      .text(String(title).toUpperCase(), this.layout.x, y, {
        characterSpacing: 1.5,
      });

    y += 16;
    this.divider(y);

    return y + 12;
  }

  line(label, value, y, opts = {}) {
    const { x, contentW } = this.layout;

    this.font(opts.bold ? "bold" : "regular")
      .fontSize(opts.big ? 13 : 10)
      .fillColor(opts.danger ? this.theme.danger : this.theme.text)
      .text(label, x, y);

    this.font(opts.bold ? "bold" : "regular")
      .fontSize(opts.big ? 13 : 10)
      .fillColor(opts.danger ? this.theme.danger : this.theme.text)
      .text(String(value), x, y, {
        width: contentW,
        align: "right",
      });

    return y + (opts.big ? 22 : 18);
  }

  drawLedger(y) {
    const s = this.summary;

    y = this.sectionTitle("System Ledger", y);

    y = this.line(
      "Credit / Debit / Stripe / Terminal",
      money(s.card, this.currency),
      y,
    );
    y = this.line("Cash Revenue", money(s.cash, this.currency), y);
    y = this.line("Bank Transfers", money(s.bank_transfer, this.currency), y);
    y = this.line(
      "Gift Cards / Voucher / Other",
      money(s.other, this.currency),
      y,
    );
    y = this.line("Gross Revenue", money(s.gross_total, this.currency), y, {
      bold: true,
    });

    y += 4;
    this.divider(y);
    y += 10;

    y = this.line(
      "Refunds Processed",
      `-${money(s.refunds, this.currency)}`,
      y,
      { danger: true },
    );

    y = this.line("Net Revenue", money(s.net_total, this.currency), y, {
      bold: true,
      big: true,
    });

    return y + 18;
  }

  drawCashAudit(y) {
    const r = this.reconciliation;

    y = this.sectionTitle("Cash Drawer Audit", y);

    y = this.line("Opening Float", money(r.opening_float, this.currency), y);
    y = this.line("Cash Revenue", money(r.cash_revenue, this.currency), y);
    y = this.line(
      "Cash Drops / Payouts",
      `-${money(r.cash_drops, this.currency)}`,
      y,
    );

    y += 4;
    this.divider(y);
    y += 10;

    y = this.line(
      "Expected in Drawer",
      money(r.expected_drawer, this.currency),
      y,
      { bold: true },
    );

    y = this.line("Actual Counted", money(r.counted_cash, this.currency), y);

    const variance = Number(r.discrepancy) || 0;

    y = this.line(
      "Variance",
      `${variance > 0 ? "+" : ""}${money(variance, this.currency)}`,
      y,
      {
        bold: true,
        big: true,
        danger: variance !== 0,
      },
    );

    return y + 18;
  }

  drawTransactions(y) {
    y = this.sectionTitle("Transaction Journal", y);

    const cols = {
      time: this.layout.x,
      type: this.layout.x + 55,
      method: this.layout.x + 125,
      source: this.layout.x + 220,
      ref: this.layout.x + 305,
      amount: this.layout.rightEdge - 90,
    };

    const drawHeader = () => {
      this.font("bold").fontSize(8).fillColor(this.theme.subtext);
      this.doc.text("TIME", cols.time, y);
      this.doc.text("TYPE", cols.type, y);
      this.doc.text("METHOD", cols.method, y);
      this.doc.text("SOURCE", cols.source, y);
      this.doc.text("REFERENCE", cols.ref, y);
      this.doc.text("AMOUNT", cols.amount, y, {
        width: 90,
        align: "right",
      });
      y += 16;
      this.divider(y);
      y += 10;
    };

    drawHeader();

    if (!this.transactions.length) {
      this.font("regular")
        .fontSize(10)
        .fillColor(this.theme.subtext)
        .text("No transactions found for this day.", this.layout.x, y);

      return y + 30;
    }

    for (const tx of this.transactions) {
      y = this.checkPage(y, 42);

      if (y === this.layout.y) {
        y = this.sectionTitle("Transaction Journal Continued", y);
        drawHeader();
      }

      const signed =
        tx.type === "outgoing"
          ? -(Number(tx.amount) || 0)
          : Number(tx.amount) || 0;

      let refParts = [];

      // Priority: human readable numbers
      if (tx.receipt_number) {
        refParts.push(`#${tx.receipt_number}`);
      } else if (tx.refund_number) {
        refParts.push(`#${tx.refund_number}`);
      } else if (tx.id) {
        refParts.push(String(tx.id).padStart(6, "0"));
      }

      // Context
      if (tx.booking_id) {
        refParts.push(`Booking ${tx.booking_id}`);
      }

      if (tx.invoice_id) {
        refParts.push(`Invoice ${tx.invoice_id}`);
      }

      const ref = refParts.length ? refParts.join(" • ") : "-";

      this.font("regular").fontSize(8).fillColor(this.theme.text);

      this.doc.text(timeOnly(tx.created_at), cols.time, y, { width: 45 });

      this.doc.text(String(tx.type || "-").toUpperCase(), cols.type, y, {
        width: 60,
      });

      this.doc.text(
        String(tx.method || "other").replaceAll("_", " "),
        cols.method,
        y,
        { width: 85 },
      );

      this.doc.text(String(tx.source || "-"), cols.source, y, { width: 75 });

      this.doc.text(String(ref), cols.ref, y, {
        width: 170,
        ellipsis: true,
      });

      this.doc
        .fillColor(signed < 0 ? this.theme.danger : this.theme.text)
        .text(
          `${signed < 0 ? "-" : ""}${money(
            Math.abs(signed),
            tx.currency || this.currency,
          )}`,
          cols.amount,
          y,
          {
            width: 90,
            align: "right",
          },
        );

      y += 18;
      this.divider(y, 1, this.theme.border);
      y += 8;
    }

    return y + 15;
  }

  drawNotes(y) {
    y = this.sectionTitle("Audit Notes / Expenses", y);

    const notes = this.reconciliation.notes || "None provided.";

    this.font("regular")
      .fontSize(10)
      .fillColor(this.theme.text)
      .text(notes, this.layout.x, y, {
        width: this.layout.contentW,
        lineGap: 4,
      });

    return this.doc.y + 30;
  }

  drawSignatures(y) {
    y = this.checkPage(y, 120);

    y += 20;
    this.divider(y, 1, this.theme.primary);
    y += 30;

    const leftX = this.layout.x;
    const rightX = this.layout.x + this.layout.contentW / 2 + 25;
    const sigW = this.layout.contentW / 2 - 35;

    this.font("bold").fontSize(9).fillColor(this.theme.text);
    this.doc.text("PREPARED BY", leftX, y);
    this.doc.text("VERIFIED BY", rightX, y);

    y += 45;

    this.doc
      .moveTo(leftX, y)
      .lineTo(leftX + sigW, y)
      .moveTo(rightX, y)
      .lineTo(rightX + sigW, y)
      .strokeColor(this.theme.primary)
      .lineWidth(1)
      .stroke();

    y += 8;

    this.font("regular").fontSize(8).fillColor(this.theme.subtext);
    this.doc.text("Manager Signature", leftX, y);
    this.doc.text("Finance Signature", rightX, y);

    return y + 30;
  }

  async generate() {
    const fonts = await this.loadFonts();

    this.doc = new PDFDocument({
      size: "A4",
      margin: 0,
      font: fonts.regular,
      autoFirstPage: true,
    });

    this.doc.registerFont("Body", fonts.regular);
    this.doc.registerFont("Body-Bold", fonts.bold);
    this.doc.font("Body");

    this.setupLayout();

    this.doc.info.Title = `Z-Report ${this.report.date || ""}`;
    this.doc.info.Author = String(this.store.name || "");
    this.doc.info.Subject = "End of Day Z-Report";

    const chunks = [];

    return new Promise((resolve, reject) => {
      this.doc.on("data", (c) => chunks.push(c));
      this.doc.on("end", () => resolve(Buffer.concat(chunks)));
      this.doc.on("error", reject);

      this.doc
        .rect(0, 0, this.doc.page.width, this.doc.page.height)
        .fill(this.theme.pageBg);

      let y = this.drawHeader();
      y = this.drawLedger(y);
      y = this.drawCashAudit(y);
      y = this.drawTransactions(y);
      y = this.drawNotes(y);
      this.drawSignatures(y);

      this.doc.end();
    });
  }
}

export default async function buildZReportPdfBuffer(args = {}) {
  const generator = new ZReportGenerator(args);
  return await generator.generate();
}
