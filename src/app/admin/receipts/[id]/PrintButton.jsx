"use client";

import { Printer } from "lucide-react";

export default function PrintButton({ receiptId }) {
  return (
    <button
      onClick={() => window.open(`/api/receipts/${receiptId}/pdf`, "_blank")}
      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#8b6f47] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#765e3c] print:hidden"
    >
      <Printer className="h-4 w-4" />
      View / Print PDF
    </button>
  );
}
