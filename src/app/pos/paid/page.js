/**
 * Where Stripe sends the customer after they scan the till's QR code.
 *
 * They are standing at the counter holding their own phone, so this says one
 * thing only: show the cashier. The till has already been told by Stripe and
 * is printing/emailing the receipt.
 */
export const metadata = { title: "Payment received · Oasis" };

export default async function PosPaidPage({ searchParams }) {
  const params = await searchParams;
  const cancelled = params?.cancelled === "1";

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "#f7f2ea",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <div
          style={{
            width: 72,
            height: 72,
            margin: "0 auto 20px",
            borderRadius: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: cancelled ? "#f2e2df" : "#e4ecdd",
            fontSize: 34,
          }}
          aria-hidden
        >
          {cancelled ? "×" : "✓"}
        </div>
        <h1
          style={{
            fontSize: 26,
            lineHeight: 1.25,
            margin: "0 0 10px",
            color: "#3a3129",
          }}
        >
          {cancelled ? "Payment cancelled" : "Payment received"}
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: "#7a6a5f", margin: 0 }}>
          {cancelled
            ? "Nothing has been charged. Please speak to the cashier if you'd like to try again."
            : "Thank you. Please show this screen to the cashier — your receipt is on its way by email."}
        </p>
      </div>
    </main>
  );
}
