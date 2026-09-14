// src/lib/pdf/buildTicket.js
import "server-only";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { normalizeMeetingPoint } from "@/lib/bookings/meetingPoint";
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

    this.overflowAttendees = [];
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
    // Falls back to the confirmed style rather than a black box, which read as
    // an alert on a ticket that is in perfectly good order.
    return styles[s] || styles.CONFIRMED;
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
    // The QR is 120 wide, so 160 left the notes beside it wrapping every few
    // words and breaking the portal address mid-word.
    const stubW = 182;
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
    //
    // The mark is a square badge with the olive branch and the OASIS wordmark
    // inside it. At 26pt both were crushed into an illegible smudge, so it is
    // set at a size where the wordmark can actually be read, and centred on
    // the same optical line as the header text rather than hung off the rule.
    const logoMaxH = 50;
    const metaY = lineY - 22; // Alignment baseline for all header text
    // Clear of the rule, not sitting astride it — the badge is a circle and
    // the line cutting through it read as a mistake.
    const logoY = Math.max(10, lineY - logoMaxH - 14);

    try {
      if (args.logoUrl && fs.existsSync(args.logoUrl)) {
        this.doc.image(args.logoUrl, contentX, logoY, {
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

  /**
   * The bottom edge of the ticket frame.
   *
   * The frame used to run to the footer whatever it held, so a booking for one
   * guest printed a card with a hand's width of nothing between the last line
   * and the total — a hole, not margin. It now ends below whichever column
   * runs longer, leaving the page's own white space around it, and still
   * reaches the footer when the content genuinely fills the sheet.
   */
  ticketBottomY() {
    const { page, contentTop, footerReserve } = this.layout;
    const maxBottom = page.h - footerReserve;
    // Enough to keep the QR panel and its notes framed even when the left
    // column is nearly empty.
    const minBottom = contentTop + 420;
    const content = Math.max(this.mainBottomY || 0, this.railBottomY || 0);
    // Room beneath the content for the total block and its divider.
    return Math.max(minBottom, Math.min(maxBottom, content + 92));
  }

  drawTicketBody() {
    const { contentX, contentW, contentTop, sepX } = this.layout;
    const ticketH = this.ticketBottomY() - contentTop;

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

    // The reference is set in the header; printing it again above the title
    // said the same thing twice and pushed the title down for nothing.

    // The title steps down a size rather than wrapping mid-phrase.
    //
    // "COOKING WITH YIAYIA" broke after "WITH" and read as two thoughts. Long
    // names still wrap — there is a limit to what 24pt can do — but the common
    // case now sits on one line.
    const title = args.experienceName || "Reservation";
    let titleSize = 24;
    this.doc.font("Body-Bold");
    while (
      titleSize > 17 &&
      this.doc.fontSize(titleSize).widthOfString(title) > mainW
    ) {
      titleSize -= 1;
    }

    this.doc
      .font("Body-Bold")
      .fontSize(titleSize)
      .fillColor(theme.text)
      .text(title, mainX, y, { width: mainW, lineGap: 2 });
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
    y = this.drawMeetingPoint(y);
    // Recorded so the frame can be sized to whichever column runs longer. The
    // total is drawn afterwards, once that height is known.
    this.mainBottomY = this.drawAttendees(y);
  }

  /**
   * Where to be, and when.
   *
   * This is the one thing a guest looks up on the morning, and it used to be
   * the last row of a table — the row that collided with its own label. Given
   * its own block it reads at a glance and has room to wrap.
   */
  /** "2 guests", from the explicit count or the names on file. */
  guestCountLabel() {
    const { args } = this;
    const n =
      Number(args.guestCount) ||
      (Array.isArray(args.attendees) ? args.attendees.length : 0);
    if (!n) return null;
    return `${n} guest${n === 1 ? "" : "s"}`;
  }

  /**
   * The meeting point, as it is actually stored.
   *
   * Bookings carry an object — name, time, map pin, instructions — and this
   * block only ever accepted a string, so the one thing a guest needs on the
   * morning was silently dropped from the ticket they were told to present.
   * Both shapes are accepted now, through the same helper the booking pages
   * and the confirmation screen read it with.
   */
  normalizePickup() {
    return normalizeMeetingPoint(this.args.pickupPoint ?? this.args.meetingPoint);
  }

  drawMeetingPoint(startY) {
    const { mainX, mainW } = this.layout;
    const { theme } = this;
    const pickup = this.normalizePickup();
    if (!pickup) return startY;

    let y = this.sectionTitle("Where to meet", mainX, startY) + 14;
    const textX = mainX + 14;
    const textW = mainW - 26;
    const top = y;

    // The place, in the same weight as the title: it is the instruction, not
    // a detail about one.
    if (pickup.name) {
      this.doc
        .font("Body-Bold")
        .fontSize(13)
        .fillColor(theme.text)
        .text(pickup.name, textX, y, { width: textW });
      y = this.doc.y + 3;
    }

    // The meeting time is not always the start time — a pickup can run ahead
    // of it — so when it differs it is stated here rather than inferred.
    const secondary = [
      pickup.time ? `Meet at ${pickup.time}` : null,
      pickup.address || null,
    ].filter(Boolean);

    if (secondary.length) {
      this.doc
        .font("Body")
        .fontSize(12)
        .fillColor(theme.text)
        .text(secondary.join(" · "), textX, y, { width: textW, lineGap: 3 });
      y = this.doc.y + 3;
    }

    if (pickup.instructions) {
      this.doc
        .font("Body")
        .fontSize(11)
        .fillColor(theme.subtext)
        .text(pickup.instructions, textX, y, { width: textW, lineGap: 3 });
      y = this.doc.y + 3;
    }

    if (pickup.mapPin) {
      this.doc
        .font("Body")
        .fontSize(10)
        .fillColor(theme.subtext)
        .text(pickup.mapPin, textX, y, { width: textW, characterSpacing: 0.3 });
      y = this.doc.y;
    }

    // A hairline down the left edge, the same weight as the dividers — enough
    // to mark the block as its own without introducing a new visual idea.
    this.doc
      .save()
      .lineWidth(1)
      .strokeColor(theme.text)
      .moveTo(mainX, top - 2)
      .lineTo(mainX, y + 2)
      .stroke()
      .restore();

    return y + 24;
  }

  drawOrderSummary(startY) {
    const { mainX, mainW } = this.layout;
    const { args, theme } = this;
    const rowPad = 14;

    let sy = this.sectionTitle("Order Summary", mainX, startY) + 16;

    // The experience name is the title directly above this table, so listing
    // it again as a row said the same thing twice and cost a line that the
    // guest count now uses.
    //
    // Date and time are separate rows because joined they ran past the column
    // and wrapped to "Friday, 9 October 2026 at" / "09:00" — the time, which
    // is the part people check on the morning, orphaned on its own line.
    const rows = [
      { label: "Date", value: args.dateLabel || "-" },
      ...(args.timeLabel ? [{ label: "Time", value: args.timeLabel }] : []),
      ...(this.guestCountLabel()
        ? [{ label: "Guests", value: this.guestCountLabel() }]
        : []),
    ];

    // Top border of summary
    this.divider(mainX, mainX + mainW, sy);
    sy += rowPad;

    // Labels sit left, values right — each in its own column.
    //
    // Both used to be drawn across the full width, so a value long enough to
    // wrap started its second line at the left margin and its first line ran
    // back over the label: "Pickup" and the pickup point printed on top of
    // each other. Giving the value its own box makes that impossible.
    const labelW = Math.min(120, mainW * 0.32);
    const valueX = mainX + labelW + 12;
    const valueW = mainW - labelW - 12;

    rows.forEach((r) => {
      this.doc
        .font("Body")
        .fontSize(12)
        .fillColor(theme.subtext)
        .text(r.label, mainX, sy, { width: labelW });

      this.doc
        .font("Body")
        .fontSize(12)
        .fillColor(theme.text)
        .text(r.value, valueX, sy, { width: valueW, align: "right" });

      sy +=
        Math.max(this.doc.heightOfString(r.value, { width: valueW }), 16) +
        rowPad;
      this.divider(mainX, mainX + mainW, sy);
      sy += rowPad;
    });

    return sy;
  }

  /**
   * The amount, pinned to the foot of the ticket.
   *
   * It used to sit between the date and the meeting point, which put the price
   * in the middle of the things a guest reads on the morning. At the bottom it
   * reads last — and it anchors the frame, which otherwise ended in a quarter
   * page of nothing.
   */
  drawTotal() {
    const { mainX, mainW } = this.layout;
    const { args, theme } = this;

    const ticketBottom = this.ticketBottomY();
    const sy = ticketBottom - 56;

    this.divider(mainX, mainX + mainW, sy - 18);

    const totalLabel = "Total";
    // amountLabel usually already carries the currency ("EUR 135.00"), which
    // is how the total came out reading "EUR 135.00 (EUR)".
    const amount = String(args.amountLabel || "-");
    const ccy = String(args.currency || "");
    const totalValue =
      ccy && !amount.toUpperCase().includes(ccy.toUpperCase())
        ? `${amount} (${ccy})`
        : amount;

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
  }

  drawAttendees(startY) {
    const { mainX, mainW, page, footerReserve } = this.layout;
    const { args, theme } = this;
    const rowH = 22;
    let aY = this.sectionTitle("Attendees", mainX, startY) + 10;

    const attendees = args.attendees || [];

    if (!attendees.length) {
      this.doc
        .font("Body")
        .fontSize(12)
        .fillColor(theme.subtext)
        .text("No attendee names on file.", mainX, aY);
      return this.doc.y;
    }

    // What is left of the sheet once the total block is accounted for.
    //
    // This used to reserve 70pt while the total needs 92, so the "continued
    // overleaf" line printed straight through "Total".
    const overflowNoteH = 20;
    const room = page.h - footerReserve - 92 - aY;

    // A party of eight is a common group booking and should stay on the one
    // sheet the group hands over. Now that the meeting point has taken its
    // share of the column, eight no longer fit stacked — so past five names
    // they pair up, which fits sixteen in the space eight used to need.
    const perRow =
      attendees.length > 5 && Math.floor(room / rowH) < attendees.length
        ? 2
        : 1;
    const cellW = perRow === 2 ? (mainW - 12) / 2 : mainW;
    const nameSize = perRow === 2 ? 11 : 12;
    const numW = perRow === 2 ? 22 : 30;
    const nameX = perRow === 2 ? 26 : 40;

    const maxRows = Math.max(1, Math.floor(room / rowH));
    const fits = maxRows * perRow;
    const shown = attendees.slice(0, fits);
    this.overflowAttendees = attendees.slice(fits);

    // The note needs a line of its own below the list, so when there is an
    // overflow one row is given back to it rather than overprinted.
    if (this.overflowAttendees.length && maxRows > 1) {
      const trimmed = (maxRows - 1) * perRow;
      this.overflowAttendees = attendees.slice(trimmed);
      shown.length = trimmed;
    }

    shown.forEach((a, i) => {
      const col = i % perRow;
      const x = mainX + col * (cellW + 12);

      this.doc
        .font("Body")
        .fontSize(nameSize)
        .fillColor(theme.subtext)
        .text(String(i + 1).padStart(2, "0"), x, aY + 8, { width: numW });

      this.doc
        .font("Body")
        .fontSize(nameSize)
        .fillColor(theme.text)
        .text(a?.name || "Guest", x + nameX, aY + 8, {
          width: cellW - nameX,
          lineBreak: false,
          ellipsis: true,
        });

      // The rule closes a whole row, so it is drawn once the row is complete
      // — or on the last name, when an odd party leaves the pair half full.
      if (col === perRow - 1 || i === shown.length - 1) {
        aY += rowH;
        this.divider(mainX, mainX + mainW, aY);
      }
    });

    if (this.overflowAttendees.length) {
      const n = this.overflowAttendees.length;
      this.doc
        .font("Body")
        .fontSize(11)
        .fillColor(theme.subtext)
        .text(
          `+ ${n} more guest${n === 1 ? "" : "s"} — continued overleaf`,
          mainX,
          aY + 8,
          { width: mainW },
        );
      aY = Math.max(this.doc.y, aY + overflowNoteH);
    }

    return aY;
  }

  /**
   * The guests who did not fit, on as many further sheets as it takes.
   *
   * Each carries the same header and footer, so a page separated from the
   * others still says which booking it belongs to. The QR is not repeated:
   * one ticket, one barcode, and a second scannable copy of it circulating
   * is the last thing a gate needs.
   */
  drawAttendeeOverflow() {
    const rest = this.overflowAttendees || [];
    if (!rest.length) return;

    const { page, contentX, contentW, contentTop, footerReserve } = this.layout;
    const { theme } = this;
    const innerX = contentX + 30;
    const innerW = contentW - 60;
    const rowH = 30;
    let offset = this.args.attendees.length - rest.length;

    let remaining = rest.slice();
    while (remaining.length) {
      this.doc.addPage();
      this.drawBackgroundAndHeader();

      const ticketH = page.h - contentTop - footerReserve;
      this.doc
        .save()
        .rect(contentX, contentTop, contentW, ticketH)
        .strokeColor(theme.border)
        .lineWidth(1)
        .stroke()
        .restore();

      let y = this.sectionTitle("Guests (continued)", innerX, contentTop + 30) + 14;

      const room = page.h - footerReserve - 40 - y;
      const fits = Math.max(1, Math.floor(room / rowH));
      const slice = remaining.slice(0, fits);
      remaining = remaining.slice(fits);

      slice.forEach((a, i) => {
        this.doc
          .font("Body")
          .fontSize(12)
          .fillColor(theme.subtext)
          .text(String(offset + i + 1).padStart(2, "0"), innerX, y + 8, {
            width: 30,
          });
        this.doc
          .font("Body")
          .fontSize(12)
          .fillColor(theme.text)
          .text(a?.name || "Guest", innerX + 40, y + 8, { width: innerW - 40 });
        y += rowH;
        this.divider(innerX, innerX + innerW, y);
      });

      offset += slice.length;
      this.drawFooter();
      // Last, as on the first sheet: the header paints a white background over
      // the whole page, which would otherwise wipe it out.
      this.drawWatermark();
    }
  }

  drawRightRail() {
    const { stubX, stubW, contentTop } = this.layout;
    const { args, theme } = this;

    let sY = contentTop + 30;

    // Status chip. A ticket only exists once a booking is paid for, so with no
    // status passed the honest label is "CONFIRMED" — it used to print the
    // literal word "STATUS" in a black box, which is what every ticket
    // downloaded from the booking page showed.
    const statLabel = String(args.status || "CONFIRMED").toUpperCase();
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
        .text("Show this at check-in", stubX, sY + this.qrSize + 12, {
          width: this.qrSize,
          align: "center",
          characterSpacing: 0.5,
        });

      sY += this.qrSize + 50;
    }

    sY = this.sectionTitle("Before you come", stubX, sY) + 12;

    // Three things the guest can act on. "Reply to email for changes" assumed
    // they still had the email; the portal works from the reference alone.
    const infoLines = Array.isArray(args.infoLines) && args.infoLines.length
      ? args.infoLines
      : [
          "Arrive 10 minutes before the meeting time.",
          // No em-dash inside the line: the dashes in this list are the
          // bullets, and one mid-sentence wrapped to the head of a line and
          // read as a fourth item saying "no need to print."
          "A screenshot of this QR is fine; printing is not needed.",
          `Change or cancel at ${this.manageUrl()}`,
        ];

    // The dash sits in its own gutter so a wrapped line lines up under the
    // text rather than sliding back under the dash — "Reply to email for" then
    // "changes." hard against the margin.
    const dashW = 14;
    this.doc.font("Body").fontSize(11).fillColor(theme.text);
    infoLines.forEach((line) => {
      const top = this.doc.y;
      this.doc.text("—", stubX, top, { width: dashW });
      this.doc.text(line, stubX + dashW, top, {
        width: stubW - dashW,
        lineGap: 4,
      });
      this.doc.y += 8;
    });

    this.railBottomY = this.doc.y;
  }

  /** Where a guest manages their own booking, without the confirmation email. */
  manageUrl() {
    const raw = String(
      this.args.manageUrl ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        "youroasis.gr",
    ).trim();
    const host = raw.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    return `${host}/manage-booking`;
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
      // Content before the frame: the frame is sized to whichever column runs
      // longer, so it cannot be drawn until both have been laid out. It is
      // hairline strokes in the margins and the gutter, so nothing it draws
      // lands on top of the text that is already there.
      this.drawMainContent();
      this.drawRightRail();
      this.drawTicketBody();
      this.drawTotal();
      this.drawFooter();
      this.drawWatermark();
      // Any guests the first sheet could not hold get their own.
      this.drawAttendeeOverflow();

      this.doc.end();
    });
  }
}

export default async function buildTicketPdfBuffer(args = {}) {
  const generator = new TicketGenerator(args);
  return await generator.generate();
}
