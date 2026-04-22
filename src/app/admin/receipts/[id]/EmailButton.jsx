"use client";

import { Mail } from "lucide-react";

export default function EmailButton() {
  return (
    <button
      onClick={() => alert("Email receipt functionality to be implemented.")}
      className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#d8cfc3] bg-white px-4 py-3 text-sm font-semibold text-[#4c4138] shadow-sm transition-all hover:bg-[#f0e7d9]"
    >
      <Mail className="h-4 w-4" />
      Email
    </button>
  );
}
