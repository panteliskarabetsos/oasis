import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { ArrowLeft, ShoppingBag, AlertTriangle } from "lucide-react";
import PrintButton from "./PrintButton";
import EmailButton from "./EmailButton";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

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

function getItemParts(item) {
  const qty = Number(item.quantity || item.qty || 1) || 1;
  const grossUnit = Number(item.unitPrice || item.price || 0) || 0;
  const vatRate = Number(item.vatRate ?? item.vat ?? 24) || 0;

  const grossTotal = grossUnit * qty;
  const netTotal = vatRate > 0 ? grossTotal / (1 + vatRate / 100) : grossTotal;
  const taxTotal = grossTotal - netTotal;
  const netUnit = qty > 0 ? netTotal / qty : netTotal;

  return {
    qty,
    grossUnit,
    vatRate,
    grossTotal,
    netTotal,
    taxTotal,
    netUnit,
  };
}

function getReceiptTaxSummary(items, receipt) {
  const discount = Number(receipt.discountAmount || 0) || 0;

  const grossBeforeDiscount = items.reduce((sum, item) => {
    return sum + getItemParts(item).grossTotal;
  }, 0);

  const discountRatio =
    grossBeforeDiscount > 0 ? Math.min(discount / grossBeforeDiscount, 1) : 0;

  const groups = {};

  items.forEach((item) => {
    const parts = getItemParts(item);

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
  });

  const netTotal = Object.values(groups).reduce((s, g) => s + g.net, 0);
  const taxTotal = Object.values(groups).reduce((s, g) => s + g.tax, 0);
  const grossAfterDiscount = Object.values(groups).reduce(
    (s, g) => s + g.gross,
    0,
  );

  return {
    discount,
    groups,
    grossBeforeDiscount,
    netTotal,
    taxTotal,
    grossAfterDiscount,
  };
}

export default async function ReceiptPage({ params }) {
  const { id } = await params;

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

  const items = parseItems(receipt.items);
  const taxSummary = getReceiptTaxSummary(items, receipt);
  const receiptDate = new Date(receipt.created_at);

  const finalTotal =
    Number(receipt.totalPaidAmount || receipt.totalAmount) ||
    taxSummary.grossAfterDiscount;

  return (
    <div className="min-h-screen bg-[#f4f1ec] py-8 px-4 sm:py-12 flex flex-col items-center print:bg-white print:py-0 print:px-0">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page { margin: 0 !important; size: auto; }
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                background: white;
              }
              .tear-edge { display: none !important; }
            }

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

      <div className="w-full max-w-sm mb-6 flex justify-between items-center print:hidden">
        <Link
          href="/admin/pos"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#7a6a5f] hover:text-[#4c4138] transition-colors bg-white/50 px-3 py-1.5 rounded-full border border-[#d8cfc3]/50 shadow-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Register
        </Link>
      </div>

      <div className="relative w-full max-w-sm bg-white shadow-2xl print:w-full print:max-w-full print:shadow-none text-[#4c4138] print:text-black font-mono tracking-tight text-sm">
        <div className="tear-edge absolute -top-2 left-0 right-0 h-2 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCI+PHBhdGggZD0iTTAgMTBMNSAwTDEwIDEwWSIgZmlsbD0id2hpdGUiLz48L3N2Zz4=')] bg-repeat-x" />

        <div className="px-6 py-8 print:py-2">
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

          <div className="mb-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left border-b border-[#e0dcd4] print:border-black/50">
                  <th className="pb-1 font-bold w-8">Q</th>
                  <th className="pb-1 font-bold">Item / VAT</th>
                  <th className="pb-1 font-bold text-right">Total</th>
                </tr>
              </thead>
              <tbody className="align-top">
                {items.map((item, idx) => {
                  const parts = getItemParts(item);

                  return (
                    <tr key={idx}>
                      <td className="py-2 print:py-1">{parts.qty}</td>
                      <td className="py-2 print:py-1 pr-2">
                        <p className="font-semibold leading-tight">
                          {item.name || "Custom Charge"}
                        </p>
                        <p className="text-[10px] text-[#7a6a5f] print:text-black mt-0.5">
                          Gross{" "}
                          {formatCurrency(parts.grossUnit, receipt.currency)}{" "}
                          ea.
                        </p>
                        <p className="text-[10px] text-[#7a6a5f] print:text-black mt-0.5">
                          VAT {parts.vatRate}% · Net{" "}
                          {formatCurrency(parts.netTotal, receipt.currency)} ·
                          Tax {formatCurrency(parts.taxTotal, receipt.currency)}
                        </p>
                      </td>
                      <td className="py-2 print:py-1 text-right font-semibold">
                        {formatCurrency(parts.grossTotal, receipt.currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="border-b-2 border-dashed border-[#d8cfc3] print:border-black mb-4" />

          <div className="space-y-1 mb-6">
            <div className="flex justify-between text-xs">
              <span>Amount before tax</span>
              <span>
                {formatCurrency(taxSummary.netTotal, receipt.currency)}
              </span>
            </div>

            {Object.values(taxSummary.groups)
              .sort((a, b) => Number(a.rate) - Number(b.rate))
              .map((group) => (
                <div key={group.rate} className="flex justify-between text-xs">
                  <span>VAT {group.rate}%</span>
                  <span>{formatCurrency(group.tax, receipt.currency)}</span>
                </div>
              ))}

            <div className="flex justify-between text-xs">
              <span>Tax total</span>
              <span>
                {formatCurrency(taxSummary.taxTotal, receipt.currency)}
              </span>
            </div>

            {taxSummary.discount > 0 && (
              <div className="flex justify-between text-xs">
                <span>Discount</span>
                <span>
                  -{formatCurrency(taxSummary.discount, receipt.currency)}
                </span>
              </div>
            )}

            <div className="flex justify-between text-base font-bold pt-2 mt-2 border-t border-[#e0dcd4] print:border-black/50">
              <span>Total after tax</span>
              <span>{formatCurrency(finalTotal, receipt.currency)}</span>
            </div>
          </div>

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

            <div className="mt-4 flex justify-center">
              <div className="css-barcode h-8 w-48 opacity-80 print:opacity-100" />
            </div>
          </div>
        </div>

        <div className="tear-edge absolute -bottom-2 left-0 right-0 h-2 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcm0iIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCI+PHBhdGggZD0iTTAgMEw1IDEwTDEwIDBZIiBmaWxsPSJ3aGl0ZSIvPjwvc3ZnPg==')] bg-repeat-x" />
      </div>

      <div className="w-full max-w-sm mt-8 space-y-3 print:hidden">
        <PrintButton receiptId={receipt.id} />
        <div className="flex gap-3">
          <EmailButton receipt={receipt} />

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
