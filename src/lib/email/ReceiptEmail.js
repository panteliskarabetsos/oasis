// src/lib/email/ReceiptEmail.js

function formatCurrency(amount, currency = "EUR") {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: (currency || "EUR").toUpperCase(),
  }).format(amount || 0);
}

export default function generateReceiptEmailHtml(receipt) {
  // Guard against missing receipt
  if (!receipt) return "<h1>Error: No receipt data</h1>";

  const items =
    typeof receipt.items === "string"
      ? JSON.parse(receipt.items)
      : receipt.items || [];

  const receiptNumber = String(receipt.id || "0").padStart(6, "0");
  const date = new Date(receipt.created_at || Date.now()).toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    },
  );

  const itemsHtml = items
    .map(
      (item) => `
    <tr>
      <td align="left" style="padding: 12px 0; border-bottom: 1px solid #fdfbf7; color: #4c4138; font-weight: bold;">
        ${item.name}
        ${item.sku ? `<div style="font-size: 12px; color: #a09084; font-weight: normal; margin-top: 4px;">SKU: ${item.sku}</div>` : ""}
      </td>
      <td align="center" style="padding: 12px 0; border-bottom: 1px solid #fdfbf7; color: #7a6a5f;">
        ${item.quantity || item.qty}
      </td>
      <td align="right" style="padding: 12px 0; border-bottom: 1px solid #fdfbf7; color: #4c4138;">
        ${formatCurrency((item.unitPrice || item.price) * (item.quantity || item.qty), receipt.currency)}
      </td>
    </tr>
  `,
    )
    .join("");

  return `
    <div style="background-color: #f4f1ec; padding: 40px 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #4c4138;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e0dcd4;">
        <tbody>
          <tr>
            <td align="center" style="padding: 40px 20px; border-bottom: 1px dashed #d8cfc3; background-color: #ffffff;">
              <h1 style="margin: 0 0 10px; font-size: 24px; color: #8b6f47; font-weight: bold;">OASIS</h1>
              <p style="margin: 0; font-size: 14px; color: #7a6a5f;">Thank you for your purchase!</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 30px; border-bottom: 1px solid #f0ebe1;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tbody>
                  <tr>
                    <td align="left" style="font-size: 14px; color: #7a6a5f;"><strong>Date:</strong> ${date}</td>
                    <td align="right" style="font-size: 14px; color: #7a6a5f;"><strong>Receipt #:</strong> ${receiptNumber}</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px;">
                <thead>
                  <tr>
                    <th align="left" style="padding-bottom: 10px; border-bottom: 1px solid #f0ebe1; color: #8a7b70; font-weight: normal;">Item</th>
                    <th align="center" style="padding-bottom: 10px; border-bottom: 1px solid #f0ebe1; color: #8a7b70; font-weight: normal;">Qty</th>
                    <th align="right" style="padding-bottom: 10px; border-bottom: 1px solid #f0ebe1; color: #8a7b70; font-weight: normal;">Price</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 30px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 15px;">
                <tbody>
                  ${
                    receipt.discountAmount > 0
                      ? `
                    <tr>
                      <td align="right" style="padding: 8px 0; color: #7a6a5f;">Discount</td>
                      <td align="right" width="100" style="padding: 8px 0; color: #7a6a5f;">
                        -${formatCurrency(receipt.discountAmount, receipt.currency)}
                      </td>
                    </tr>
                  `
                      : ""
                  }
                  <tr>
                    <td align="right" style="padding: 12px 0; border-top: 2px solid #f0ebe1; font-weight: bold; color: #4c4138; font-size: 18px;">Total</td>
                    <td align="right" width="100" style="padding: 12px 0; border-top: 2px solid #f0ebe1; font-weight: bold; color: #8b6f47; font-size: 18px;">
                      ${formatCurrency(receipt.totalPaidAmount || receipt.totalAmount, receipt.currency)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="background-color: #fdfbf7; padding: 30px 20px; border-top: 1px dashed #d8cfc3; font-size: 13px; color: #8a7b70; line-height: 1.5;">
              <p style="margin: 0 0 8px; font-weight: bold; color: #4c4138;">Paid via ${receipt.paymentMethod || "Card"}</p>
              ${receipt.paymentReference ? `<p style="margin: 0 0 16px;">Ref: ${receipt.paymentReference}</p>` : ""}
              <p style="margin: 0;">123 Main Street, City, Country<br />info@youroasis.gr | +1 234 567 890</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}
