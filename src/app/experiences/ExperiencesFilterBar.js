// src/app/experiences/ExperiencesFilterBar.js
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Calendar, Users, Search, X } from "lucide-react";

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
  const [dateError, setDateError] = useState("");

  // Keep local state in sync if URL changes externally
  useEffect(() => {
    const spFrom = searchParams.get("from") || "";
    const spTo = searchParams.get("to") || "";
    const spParty = searchParams.get("party") || "";

    setFrom(spFrom);
    setTo(spTo);
    setParty(spParty);
  }, [searchParams]);

  // Basic date validation
  useEffect(() => {
    if (from && to) {
      const fromDate = new Date(from);
      const toDate = new Date(to);
      if (toDate < fromDate) {
        setDateError("End date must be after start date.");
      } else {
        setDateError("");
      }
    } else {
      setDateError("");
    }
  }, [from, to]);

  const hasFilters = Boolean(from || to || party);
  const hasAllFields = Boolean(from && to && party);
  const canSearch = hasAllFields && !dateError;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSearch) return;

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
      className="w-full flex flex-col gap-4 md:flex-row md:items-end md:justify-between"
    >
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        {/* From date */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium tracking-[0.18em] uppercase text-[#8b7a6b]">
            From
          </label>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#b39c86]" />
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-full border border-[#e2d7c7] bg-[#f9f6f1] pl-9 pr-4 py-2.5 text-sm text-[#3c332c] placeholder:text-[#b3a598] focus:outline-none focus:ring-2 focus:ring-[#c6a77a] focus:border-transparent"
            />
          </div>
          <p className="text-[11px] text-[#a19081]">
            Start of your stay or preferred date.
          </p>
        </div>

        {/* To date */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium tracking-[0.18em] uppercase text-[#8b7a6b]">
            To
          </label>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#b39c86]" />
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-full border border-[#e2d7c7] bg-[#f9f6f1] pl-9 pr-4 py-2.5 text-sm text-[#3c332c] placeholder:text-[#b3a598] focus:outline-none focus:ring-2 focus:ring-[#c6a77a] focus:border-transparent"
            />
          </div>
          {dateError ? (
            <p className="text-[11px] text-[#b4533b]">{dateError}</p>
          ) : (
            <p className="text-[11px] text-[#a19081]">
              End of your stay or latest possible date.
            </p>
          )}
        </div>

        {/* Party size */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium tracking-[0.18em] uppercase text-[#8b7a6b]">
            Party size
          </label>
          <div className="relative">
            <Users className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#b39c86]" />
            <input
              type="number"
              min={1}
              value={party}
              onChange={(e) => setParty(e.target.value)}
              placeholder="e.g. 4"
              className="w-full rounded-full border border-[#e2d7c7] bg-[#f9f6f1] pl-9 pr-4 py-2.5 text-sm text-[#3c332c] placeholder:text-[#b3a598] focus:outline-none focus:ring-2 focus:ring-[#c6a77a] focus:border-transparent"
            />
          </div>
          <p className="text-[11px] text-[#a19081]">
            Number of guests in total.
          </p>
        </div>
      </div>

      <div className="flex gap-2 md:gap-3">
        <button
          type="submit"
          disabled={!canSearch}
          className={`inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium text-white transition-all ${
            canSearch
              ? "bg-[#8b6f47] hover:bg-[#a78b62]"
              : "bg-[#c7b6a1] cursor-not-allowed"
          }`}
        >
          <Search className="h-4 w-4 mr-2" />
          Show available experiences
        </button>
        <button
          type="button"
          onClick={handleClear}
          disabled={!hasFilters}
          className={`inline-flex items-center justify-center rounded-full border px-4 py-2.5 text-xs font-medium transition-all ${
            hasFilters
              ? "border-[#d8c8b5] text-[#5a4a3f] hover:bg-[#f7f2eb]"
              : "border-transparent text-[#b3a79b] cursor-not-allowed"
          }`}
        >
          <X className="h-3.5 w-3.5 mr-1" />
          Clear
        </button>
      </div>
    </form>
  );
}
