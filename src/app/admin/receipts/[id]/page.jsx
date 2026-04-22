import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { ArrowLeft, ShoppingBag, AlertTriangle } from "lucide-react";
import PrintButton from "./PrintButton";
import EmailButton from "./EmailButton";

// Supabase Server Setup
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

function formatCurrency(amount, currency = "EUR") {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount || 0);
}

export default async function ReceiptPage({ params }) {
  // NEXT.JS 15: Await the params object before destructuring
  const { id } = await params;

  // 1. Fetch the Receipt from Supabase
  const { data: receipt, error } = await supabase
    .from("Receipt")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !receipt) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f4f1ec] text-[#4c4138]">
        <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold">Receipt Not Found</h1>
        <p className="mt-2 text-[#7a6a5f]">Could not find receipt #{id}</p>
        <Link
          href="/admin/pos"
          className="mt-6 flex items-center gap-2 text-[#8b6f47] hover:underline font-medium"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Register
        </Link>
      </div>
    );
  }

  // Parse items safely
  const items =
    typeof receipt.items === "string"
      ? JSON.parse(receipt.items)
      : receipt.items || [];

  // Calculate accurate subtotal directly from items
  const subtotal = items.reduce((sum, item) => {
    const price = item.unitPrice || item.price || 0;
    const qty = item.quantity || item.qty || 1;
    return sum + price * qty;
  }, 0);

  // Formatting dates securely
  const receiptDate = new Date(receipt.created_at);

  return (
    <div className="min-h-screen bg-[#f4f1ec] py-8 px-4 sm:py-12 flex flex-col items-center print:bg-white print:py-0 print:px-0">
      {/* CRITICAL FOR POS PRINTERS */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          @page { 
            margin: 0 !important; 
            size: auto;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact; 
            background: white; 
          }
          .tear-edge { display: none !important; }
        }
        
        /* Pure CSS Barcode generator for the bottom of the receipt */
        .css-barcode {
          background-image: repeating-linear-gradient(
            to right,
            #111 0, #111 2px,
            transparent 2px, transparent 4px,
            #111 4px, #111 5px,
            transparent 5px, transparent 8px,
            #111 8px, #111 12px,
            transparent 12px, transparent 14px
          );
        }
      `,
        }}
      />

      {/* Top Navigation (Hidden when printing) */}
      <div className="w-full max-w-sm mb-6 flex justify-between items-center print:hidden">
        <Link
          href="/admin/pos"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#7a6a5f] hover:text-[#4c4138] transition-colors bg-white/50 px-3 py-1.5 rounded-full border border-[#d8cfc3]/50 shadow-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Register
        </Link>
      </div>

      {/* The Receipt Canvas */}
      <div className="relative w-full max-w-sm bg-white shadow-2xl print:w-full print:max-w-full print:shadow-none text-[#4c4138] print:text-black font-mono tracking-tight text-sm">
        {/* Decorative Top Tear Edge (Hidden in print) */}
        <div className="tear-edge absolute -top-2 left-0 right-0 h-2 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCI+PHBhdGggZD0iTTAgMTBMNSAwTDEwIDEwWSIgZmlsbD0id2hpdGUiLz48L3N2Zz4=')] bg-repeat-x" />

        {/* Receipt Body */}
        <div className="px-6 py-8 print:py-2">
          {/* Header */}
          <div className="text-center mb-6">
            <ShoppingBag
              className="h-8 w-8 mx-auto text-[#4c4138] print:text-black mb-2"
              strokeWidth={1.5}
            />
            <h1 className="text-xl font-bold uppercase tracking-widest print:text-black">
              OASIS
            </h1>
            <p className="text-xs text-[#7a6a5f] print:text-black mt-1 leading-relaxed">
              123 Artisan Lane
              <br />
              Chania, Crete 73100
            </p>
            <p className="text-xs text-[#7a6a5f] print:text-black mt-1">
              VAT: EL123456789
            </p>
          </div>

          <div className="border-b-2 border-dashed border-[#d8cfc3] print:border-black mb-4" />

          {/* Meta */}
          <div className="flex justify-between text-xs text-[#4c4138] print:text-black mb-4">
            <div>
              <p>
                {receiptDate.toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </p>
              <p>
                {receiptDate.toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <div className="text-right">
              <p>Receipt #</p>
              <p className="font-bold">{String(receipt.id).padStart(6, "0")}</p>
            </div>
          </div>

          {/* Itemized List */}
          <div className="mb-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left border-b border-[#e0dcd4] print:border-black/50">
                  <th className="pb-1 font-bold w-8">Q</th>
                  <th className="pb-1 font-bold">Item</th>
                  <th className="pb-1 font-bold text-right">Total</th>
                </tr>
              </thead>
              <tbody className="align-top">
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-2 print:py-1">
                      {item.quantity || item.qty}
                    </td>
                    <td className="py-2 print:py-1 pr-2">
                      <p className="font-semibold leading-tight">{item.name}</p>
                      <p className="text-[10px] text-[#7a6a5f] print:text-black mt-0.5">
                        {formatCurrency(
                          item.unitPrice || item.price,
                          receipt.currency,
                        )}{" "}
                        ea.
                      </p>
                    </td>
                    <td className="py-2 print:py-1 text-right font-semibold">
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
          </div>

          <div className="border-b-2 border-dashed border-[#d8cfc3] print:border-black mb-4" />

          {/* Totals */}
          <div className="space-y-1 mb-6">
            <div className="flex justify-between text-xs">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal, receipt.currency)}</span>
            </div>

            {receipt.discountAmount > 0 && (
              <div className="flex justify-between text-xs">
                <span>Discount</span>
                <span>
                  -{formatCurrency(receipt.discountAmount, receipt.currency)}
                </span>
              </div>
            )}

            <div className="flex justify-between text-base font-bold pt-2 mt-2 border-t border-[#e0dcd4] print:border-black/50">
              <span>Total</span>
              <span>
                {formatCurrency(
                  receipt.totalPaidAmount || receipt.totalAmount,
                  receipt.currency,
                )}
              </span>
            </div>
          </div>

          {/* Payment Info */}
          <div className="text-center text-xs">
            <p className="font-bold uppercase mb-1">
              Paid via {receipt.paymentMethod || "Card"}
            </p>
            {receipt.paymentReference && (
              <p className="text-[10px] text-[#7a6a5f] print:text-black break-all px-4">
                Ref: {receipt.paymentReference}
              </p>
            )}

            <p className="mt-6 italic font-serif text-sm text-[#7a6a5f] print:text-black">
              Thank you for your visit.
            </p>

            {/* CSS Barcode Placeholder */}
            <div className="mt-4 flex justify-center">
              <div className="css-barcode h-8 w-48 opacity-80 print:opacity-100" />
            </div>
          </div>
        </div>

        {/* Decorative Bottom Tear Edge (Hidden in print) */}
        <div className="tear-edge absolute -bottom-2 left-0 right-0 h-2 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCI+PHBhdGggZD0iTTAgMEw1IDEwTDEwIDBZIiBmaWxsPSJ3aGl0ZSIvPjwvc3ZnPg==')] bg-repeat-x" />
      </div>

      {/* Action Buttons (Hidden when printing) */}
      <div className="w-full max-w-sm mt-8 space-y-3 print:hidden">
        <PrintButton receiptId={receipt.id} />
        <div className="flex gap-3">
          {/* Passed the receipt ID in case you need it in the Email component later */}
          <EmailButton receiptId={receipt.id} />

          <Link
            href="/admin/pos"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#d8cfc3] bg-white px-4 py-3 text-sm font-semibold text-[#4c4138] shadow-sm transition-all hover:bg-[#f0e7d9]"
          >
            New Sale
          </Link>
        </div>
      </div>
    </div>
  );
}
