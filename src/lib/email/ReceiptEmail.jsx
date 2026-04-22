import * as React from "react";

function formatCurrency(amount, currency = "EUR") {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount);
}

export default function ReceiptEmail({ receipt }) {
  // Parse items safely
  const items =
    typeof receipt.items === "string"
      ? JSON.parse(receipt.items)
      : receipt.items || [];
  const receiptNumber = String(receipt.id).padStart(6, "0");
  const date = new Date(receipt.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      style={{
        backgroundColor: "#f4f1ec",
        padding: "40px 20px",
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
        color: "#4c4138",
      }}
    >
      <table
        width="100%"
        cellPadding="0"
        cellSpacing="0"
        style={{
          maxWidth: "600px",
          margin: "0 auto",
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          overflow: "hidden",
          border: "1px solid #e0dcd4",
        }}
      >
        <tbody>
          {/* HEADER */}
          <tr>
            <td
              align="center"
              style={{
                padding: "40px 20px",
                borderBottom: "1px dashed #d8cfc3",
                backgroundColor: "#ffffff",
              }}
            >
              {/* Optional: Add a logo image here */}
              <h1
                style={{
                  margin: "0 0 10px",
                  fontSize: "24px",
                  color: "#8b6f47",
                  fontWeight: "bold",
                }}
              >
                Your Store Name
              </h1>
              <p style={{ margin: 0, fontSize: "14px", color: "#7a6a5f" }}>
                Thank you for your purchase!
              </p>
            </td>
          </tr>

          {/* META INFO (Date & Receipt #) */}
          <tr>
            <td
              style={{
                padding: "20px 30px",
                borderBottom: "1px solid #f0ebe1",
              }}
            >
              <table width="100%" cellPadding="0" cellSpacing="0">
                <tbody>
                  <tr>
                    <td
                      align="left"
                      style={{ fontSize: "14px", color: "#7a6a5f" }}
                    >
                      <strong>Date:</strong> {date}
                    </td>
                    <td
                      align="right"
                      style={{ fontSize: "14px", color: "#7a6a5f" }}
                    >
                      <strong>Receipt #:</strong> {receiptNumber}
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          {/* ITEMS LIST */}
          <tr>
            <td style={{ padding: "20px 30px" }}>
              <table
                width="100%"
                cellPadding="0"
                cellSpacing="0"
                style={{ fontSize: "14px" }}
              >
                <thead>
                  <tr>
                    <th
                      align="left"
                      style={{
                        paddingBottom: "10px",
                        borderBottom: "1px solid #f0ebe1",
                        color: "#8a7b70",
                        fontWeight: "normal",
                      }}
                    >
                      Item
                    </th>
                    <th
                      align="center"
                      style={{
                        paddingBottom: "10px",
                        borderBottom: "1px solid #f0ebe1",
                        color: "#8a7b70",
                        fontWeight: "normal",
                      }}
                    >
                      Qty
                    </th>
                    <th
                      align="right"
                      style={{
                        paddingBottom: "10px",
                        borderBottom: "1px solid #f0ebe1",
                        color: "#8a7b70",
                        fontWeight: "normal",
                      }}
                    >
                      Price
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx}>
                      <td
                        align="left"
                        style={{
                          padding: "12px 0",
                          borderBottom: "1px solid #fdfbf7",
                          color: "#4c4138",
                          fontWeight: "bold",
                        }}
                      >
                        {item.name}
                        {item.sku && (
                          <div
                            style={{
                              fontSize: "12px",
                              color: "#a09084",
                              fontWeight: "normal",
                              marginTop: "4px",
                            }}
                          >
                            SKU: {item.sku}
                          </div>
                        )}
                      </td>
                      <td
                        align="center"
                        style={{
                          padding: "12px 0",
                          borderBottom: "1px solid #fdfbf7",
                          color: "#7a6a5f",
                        }}
                      >
                        {item.quantity || item.qty}
                      </td>
                      <td
                        align="right"
                        style={{
                          padding: "12px 0",
                          borderBottom: "1px solid #fdfbf7",
                          color: "#4c4138",
                        }}
                      >
                        {formatCurrency(
                          (item.unitPrice || item.price) *
                            (item.quantity || item.qty),
                          receipt.currency,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </td>
          </tr>

          {/* TOTALS */}
          <tr>
            <td style={{ padding: "0 30px 30px" }}>
              <table
                width="100%"
                cellPadding="0"
                cellSpacing="0"
                style={{ fontSize: "15px" }}
              >
                <tbody>
                  {receipt.discountAmount > 0 && (
                    <tr>
                      <td
                        align="right"
                        style={{ padding: "8px 0", color: "#7a6a5f" }}
                      >
                        Discount
                      </td>
                      <td
                        align="right"
                        width="100"
                        style={{ padding: "8px 0", color: "#7a6a5f" }}
                      >
                        -
                        {formatCurrency(
                          receipt.discountAmount,
                          receipt.currency,
                        )}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td
                      align="right"
                      style={{
                        padding: "12px 0",
                        borderTop: "2px solid #f0ebe1",
                        fontWeight: "bold",
                        color: "#4c4138",
                        fontSize: "18px",
                      }}
                    >
                      Total
                    </td>
                    <td
                      align="right"
                      width="100"
                      style={{
                        padding: "12px 0",
                        borderTop: "2px solid #f0ebe1",
                        fontWeight: "bold",
                        color: "#8b6f47",
                        fontSize: "18px",
                      }}
                    >
                      {formatCurrency(
                        receipt.totalPaidAmount || receipt.totalAmount,
                        receipt.currency,
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          {/* FOOTER */}
          <tr>
            <td
              align="center"
              style={{
                backgroundColor: "#fdfbf7",
                padding: "30px 20px",
                borderTop: "1px dashed #d8cfc3",
                fontSize: "13px",
                color: "#8a7b70",
                lineHeight: "1.5",
              }}
            >
              <p
                style={{
                  margin: "0 0 8px",
                  fontWeight: "bold",
                  color: "#4c4138",
                }}
              >
                Paid via {receipt.paymentMethod || "Card"}
              </p>
              {receipt.paymentReference && (
                <p style={{ margin: "0 0 16px" }}>
                  Ref: {receipt.paymentReference}
                </p>
              )}
              <p style={{ margin: 0 }}>
                123 Main Street, City, Country
                <br />
                hello@yourstore.com | +1 234 567 890
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
