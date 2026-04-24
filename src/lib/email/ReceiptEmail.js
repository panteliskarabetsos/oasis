function formatCurrency(amount, currency = "EUR") {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: String(currency || "EUR").toUpperCase(),
  }).format(Number(amount) || 0);
}

function parseItems(raw) {
  try {
    if (typeof raw === "string") return JSON.parse(raw);
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function itemParts(item) {
  const qty = Number(item.quantity || item.qty || 1) || 1;
  const grossUnit = Number(item.unitPrice || item.price || 0) || 0;
  const vatRate = Number(item.vatRate ?? item.vat ?? 24) || 0;

  const grossTotal = grossUnit * qty;
  const netTotal = vatRate > 0 ? grossTotal / (1 + vatRate / 100) : grossTotal;
  const taxTotal = grossTotal - netTotal;

  return {
    qty,
    grossUnit,
    vatRate,
    grossTotal,
    netTotal,
    taxTotal,
  };
}

function taxSummary(items, receipt) {
  const discount = Number(receipt.discountAmount || 0) || 0;

  const grossBeforeDiscount = items.reduce(
    (sum, item) => sum + itemParts(item).grossTotal,
    0,
  );

  const discountRatio =
    grossBeforeDiscount > 0 ? Math.min(discount / grossBeforeDiscount, 1) : 0;

  const groups = {};

  for (const item of items) {
    const p = itemParts(item);
    const discountedGross = p.grossTotal * (1 - discountRatio);
    const net =
      p.vatRate > 0 ? discountedGross / (1 + p.vatRate / 100) : discountedGross;
    const tax = discountedGross - net;

    if (!groups[p.vatRate]) {
      groups[p.vatRate] = {
        rate: p.vatRate,
        net: 0,
        tax: 0,
        gross: 0,
      };
    }

    groups[p.vatRate].net += net;
    groups[p.vatRate].tax += tax;
    groups[p.vatRate].gross += discountedGross;
  }

  return {
    discount,
    netTotal: Object.values(groups).reduce((s, g) => s + g.net, 0),
    taxTotal: Object.values(groups).reduce((s, g) => s + g.tax, 0),
    grossTotal: Object.values(groups).reduce((s, g) => s + g.gross, 0),
    groups,
  };
}

export default function generateReceiptEmailHtml(receipt) {
  if (!receipt) return "<h1>Error: No receipt data</h1>";

  const items = parseItems(receipt.items);
  const receiptNumber = String(receipt.id || "0").padStart(6, "0");
  const currency = receipt.currency || "EUR";
  const summary = taxSummary(items, receipt);

  const total =
    Number(receipt.totalPaidAmount || receipt.totalAmount) ||
    summary.grossTotal;

  const date = new Date(receipt.created_at || Date.now()).toLocaleDateString(
    "en-GB",
    {
      year: "numeric",
      month: "long",
      day: "2-digit",
    },
  );

  const itemsHtml = items
    .map((item) => {
      const p = itemParts(item);

      return `
        <tr>
          <td style="padding: 16px 0; border-bottom: 1px solid #eaeaea; color: #111111;">
            <div style="font-weight: 700; font-size: 14px; line-height: 1.35;">
              ${escapeHtml(item.name || "Custom Charge")}
            </div>
            ${
              item.sku
                ? `<div style="font-size: 11px; color: #767676; margin-top: 4px;">SKU: ${escapeHtml(item.sku)}</div>`
                : ""
            }
            <div style="font-size: 11px; color: #767676; margin-top: 5px;">
              VAT ${p.vatRate}% - ${formatCurrency(p.grossUnit, currency)} each
            </div>
          </td>
          <td align="center" style="padding: 16px 0; border-bottom: 1px solid #eaeaea; color: #767676; font-size: 13px;">
            ${p.qty}
          </td>
          <td align="right" style="padding: 16px 0; border-bottom: 1px solid #eaeaea; color: #111111; font-size: 13px;">
            ${formatCurrency(p.grossTotal, currency)}
          </td>
        </tr>
      `;
    })
    .join("");

  const vatRows = Object.values(summary.groups)
    .sort((a, b) => Number(a.rate) - Number(b.rate))
    .map(
      (group) => `
        <tr>
          <td align="right" style="padding: 6px 0; color: #767676; font-size: 13px;">VAT ${group.rate}%</td>
          <td align="right" width="120" style="padding: 6px 0; color: #111111; font-size: 13px;">
            ${formatCurrency(group.tax, currency)}
          </td>
        </tr>
      `,
    )
    .join("");

  return `
    <!doctype html>
    <html>
      <body style="margin:0; padding:0; background:#f4f1ec;">
        <div style="background:#f4f1ec; padding:40px 16px; font-family: Helvetica, Arial, sans-serif; color:#111111;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #eaeaea;">
            <tbody>
              <tr>
                <td style="padding:42px 48px 28px;">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td valign="top">
                        <div style="font-size:22px; font-weight:800; letter-spacing:2px; color:#111111;">
                          OASIS
                        </div>
                        <div style="margin-top:16px; font-size:12px; line-height:1.7; color:#767676;">
                          123 Artisan Lane<br />
                          Chania, Crete 73100<br />
                          VAT: EL123456789
                        </div>
                      </td>
                      <td valign="top" align="right">
                        <div style="font-size:22px; font-weight:800; letter-spacing:2px; color:#111111;">
                          RECEIPT
                        </div>
                        <div style="margin-top:16px; font-size:11px; letter-spacing:1px; color:#767676;">
                          RECEIPT NO.
                        </div>
                        <div style="margin-top:4px; font-size:17px; font-weight:800; letter-spacing:2px; color:#111111;">
                          ${receiptNumber}
                        </div>
                        <div style="margin-top:8px; font-size:12px; color:#767676;">
                          ${date}
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding:0 48px;">
                  <div style="border-top:2px solid #111111; height:1px;"></div>
                </td>
              </tr>

              <tr>
                <td style="padding:28px 48px 8px;">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <thead>
                      <tr>
                        <th align="left" style="padding-bottom:12px; border-bottom:1px solid #eaeaea; color:#767676; font-size:11px; letter-spacing:1px; font-weight:700;">
                          ITEM / TAX
                        </th>
                        <th align="center" style="padding-bottom:12px; border-bottom:1px solid #eaeaea; color:#767676; font-size:11px; letter-spacing:1px; font-weight:700;">
                          QTY
                        </th>
                        <th align="right" style="padding-bottom:12px; border-bottom:1px solid #eaeaea; color:#767676; font-size:11px; letter-spacing:1px; font-weight:700;">
                          TOTAL
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      ${
                        itemsHtml ||
                        `<tr><td colspan="3" style="padding:20px 0; color:#767676;">No items found.</td></tr>`
                      }
                    </tbody>
                  </table>
                </td>
              </tr>

            <tr>
  <td style="padding:16px 48px 34px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tbody>
        <tr>
          <td align="right" style="padding:6px 0; color:#767676; font-size:13px;">
            Amount before tax
          </td>
          <td align="right" width="120" style="padding:6px 0; color:#111111; font-size:13px;">
            ${formatCurrency(summary.netTotal, currency)}
          </td>
        </tr>

        <tr>
          <td align="right" style="padding:6px 0; color:#767676; font-size:13px;">
            Tax
          </td>
          <td align="right" width="120" style="padding:6px 0; color:#111111; font-size:13px;">
            ${formatCurrency(summary.taxTotal, currency)}
          </td>
        </tr>

        ${
          summary.discount > 0
            ? `
              <tr>
                <td align="right" style="padding:6px 0; color:#767676; font-size:13px;">
                  Discount
                </td>
                <td align="right" width="120" style="padding:6px 0; color:#111111; font-size:13px;">
                  -${formatCurrency(summary.discount, currency)}
                </td>
              </tr>
            `
            : ""
        }

        <tr>
          <td colspan="2" style="padding-top:10px;">
            <div style="border-top:1px solid #eaeaea;"></div>
          </td>
        </tr>

        <tr>
          <td align="right" style="padding-top:16px; font-size:18px; font-weight:800;">
            Total
          </td>
          <td align="right" width="120" style="padding-top:16px; font-size:18px; font-weight:800;">
            ${formatCurrency(total, currency)}
          </td>
        </tr>
      </tbody>
    </table>
  </td>
</tr>

              <tr>
                <td style="padding:0 48px 42px;">
                  <table width="250" cellpadding="0" cellspacing="0" role="presentation" style="background:#f9f9f9;">
                    <tr>
                      <td style="padding:16px;">
                        <div style="font-size:10px; color:#767676; letter-spacing:1px; font-weight:800;">
                          PAYMENT METHOD
                        </div>
                        <div style="margin-top:8px; font-size:13px; color:#111111;">
                          ${escapeHtml(String(receipt.paymentMethod || "Card").toUpperCase())}
                        </div>
                        ${
                          receipt.paymentReference
                            ? `<div style="margin-top:6px; font-size:10px; color:#767676; word-break:break-all;">REF: ${escapeHtml(receipt.paymentReference)}</div>`
                            : ""
                        }
                        <div style="margin-top:6px; font-size:10px; color:#767676;">
                          Receipt ID: ${escapeHtml(receipt.id || "-")}
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td align="center" style="padding:24px 32px 36px; border-top:1px solid #eaeaea; color:#767676; font-size:12px; line-height:1.6;">
                  Thank you for your visit. We hope to see you again soon.<br />
                  <span style="font-size:11px;">info@youroasis.gr</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </body>
    </html>
  `;
}
