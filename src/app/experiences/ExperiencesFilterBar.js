// src/app/experiences/ExperiencesFilterBar.js
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

export default function ExperiencesFilterBar({
  initialFrom,
  initialTo,
  initialParty,
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [from, setFrom] = useState(initialFrom || "");
  const [to, setTo] = useState(initialTo || "");
  const [party, setParty] = useState(initialParty ? String(initialParty) : "");

  // Keep local state in sync if URL changes externally
  useEffect(() => {
    setFrom(searchParams.get("from") || "");
    setTo(searchParams.get("to") || "");
    const spParty = searchParams.get("party");
    setParty(spParty || "");
  }, [searchParams]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams?.toString() || "");

    if (from) params.set("from", from);
    else params.delete("from");

    if (to) params.set("to", to);
    else params.delete("to");

    if (party && Number(party) > 0) params.set("party", party);
    else params.delete("party");

    const qs = params.toString();
    router.push(`/experiences${qs ? `?${qs}` : ""}`);
  };

  const handleClear = () => {
    setFrom("");
    setTo("");
    setParty("");
    router.push("/experiences");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full rounded-3xl border border-[#e2d7c7] bg-white/90 shadow-sm px-4 py-4 md:px-6 md:py-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"
    >
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        {/* From date */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium tracking-[0.18em] uppercase text-[#8b7a6b]">
            From
          </label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full rounded-full border border-[#e2d7c7] bg-[#f9f6f1] px-4 py-2.5 text-sm text-[#3c332c] focus:outline-none focus:ring-2 focus:ring-[#c6a77a] focus:border-transparent"
          />
        </div>

        {/* To date */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium tracking-[0.18em] uppercase text-[#8b7a6b]">
            To
          </label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full rounded-full border border-[#e2d7c7] bg-[#f9f6f1] px-4 py-2.5 text-sm text-[#3c332c] focus:outline-none focus:ring-2 focus:ring-[#c6a77a] focus:border-transparent"
          />
        </div>

        {/* Party size */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium tracking-[0.18em] uppercase text-[#8b7a6b]">
            Party size
          </label>
          <input
            type="number"
            min={1}
            value={party}
            onChange={(e) => setParty(e.target.value)}
            placeholder="e.g. 4"
            className="w-full rounded-full border border-[#e2d7c7] bg-[#f9f6f1] px-4 py-2.5 text-sm text-[#3c332c] focus:outline-none focus:ring-2 focus:ring-[#c6a77a] focus:border-transparent"
          />
        </div>
      </div>

      <div className="flex gap-2 md:gap-3">
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-full bg-[#8b6f47] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#a78b62] transition-all"
        >
          Show available experiences
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="inline-flex items-center justify-center rounded-full border border-transparent px-4 py-2.5 text-xs font-medium text-[#5a4a3f] hover:border-[#d8c8b5] hover:bg-[#f7f2eb] transition-all"
        >
          Clear
        </button>
      </div>
    </form>
  );
}
