// src/app/experiences/ExperiencesFilterBar.js
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Calendar, Users, Search, X, Plus, Minus } from "lucide-react";

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
  const [today, setToday] = useState("");

  useEffect(() => {
    const d = new Date();
    const iso = d.toISOString().split("T")[0];
    setToday(iso);
  }, []);

  useEffect(() => {
    const spFrom = searchParams.get("from") || "";
    const spTo = searchParams.get("to") || "";
    const spParty = searchParams.get("party") || "";

    setFrom(spFrom);
    setTo(spTo);
    setParty(spParty);
  }, [searchParams]);

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

  const partyNumber = Number(party) || 0;
  const canDecrement = partyNumber > 0;
  const canIncrement = partyNumber < 8;

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

  const handleIncrement = () => {
    setParty((prev) => {
      const current = Number(prev) || 0;
      if (current >= 8) return "8";
      return String(current + 1);
    });
  };

  const handleDecrement = () => {
    setParty((prev) => {
      const current = Number(prev) || 0;
      const next = current - 1;
      if (next <= 0) return "";
      return String(next);
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full rounded-[32px] border border-[#e2d7c7] bg-[#fdf9f3]/90 px-4 py-3 shadow-sm backdrop-blur-sm flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:px-6 md:py-4"
    >
      <div className="flex-1 grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-3">
        {/* From date */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium tracking-[0.18em] uppercase text-[#8b7a6b]">
            From
          </label>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#b39c86]" />
            <input
              type="date"
              aria-label="From date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              min={today || undefined}
              className="w-full min-h-[44px] rounded-full border border-[#e2d7c7] bg-[#f9f6f1] pl-10 pr-4 py-3 text-base md:text-sm text-[#3c332c] placeholder:text-[#b3a598] focus:outline-none focus:ring-2 focus:ring-[#c6a77a] focus:border-transparent appearance-none"
            />
          </div>
          <p className="hidden text-[11px] text-[#a19081] sm:block">
            Start of your stay or preferred date.
          </p>
        </div>

        {/* To date */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium tracking-[0.18em] uppercase text-[#8b7a6b]">
            To
          </label>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#b39c86]" />
            <input
              type="date"
              aria-label="To date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              min={from || today || undefined}
              className="w-full min-h-[44px] rounded-full border border-[#e2d7c7] bg-[#f9f6f1] pl-10 pr-4 py-3 text-base md:text-sm text-[#3c332c] placeholder:text-[#b3a598] focus:outline-none focus:ring-2 focus:ring-[#c6a77a] focus:border-transparent appearance-none"
            />
          </div>
          {dateError ? (
            <p className="text-[11px] text-[#b4533b]">{dateError}</p>
          ) : (
            <p className="hidden text-[11px] text-[#a19081] sm:block">
              End of your stay or latest possible date.
            </p>
          )}
        </div>

        {/* Party size */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium tracking-[0.18em] uppercase text-[#8b7a6b]">
            Party size
          </label>
          <div className="flex items-center justify-between rounded-full border border-[#e2d7c7] bg-[#f9f6f1] px-2 py-1.5">
            <button
              type="button"
              onClick={handleDecrement}
              disabled={!canDecrement}
              className={`flex h-10 w-10 md:h-8 md:w-8 items-center justify-center rounded-full text-xs transition-colors touch-manipulation ${
                canDecrement
                  ? "bg-white/80 text-[#5a4a3f] hover:bg-[#f0e6d9]"
                  : "bg-transparent text-[#c4b6a7] cursor-not-allowed"
              }`}
            >
              <Minus className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 text-sm text-[#3c332c]">
              <Users className="h-4 w-4 text-[#b39c86]" />
              <span>
                {partyNumber > 0
                  ? `${partyNumber} guest${partyNumber > 1 ? "s" : ""}`
                  : "Add guests"}
              </span>
            </div>

            <button
              type="button"
              onClick={handleIncrement}
              disabled={!canIncrement}
              className={`flex h-10 w-10 md:h-8 md:w-8 items-center justify-center rounded-full text-xs transition-colors touch-manipulation ${
                canIncrement
                  ? "bg-white/80 text-[#5a4a3f] hover:bg-[#f0e6d9]"
                  : "bg-transparent text-[#c4b6a7] cursor-not-allowed"
              }`}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <p className="hidden text-[11px] text-[#a19081] sm:block">
            Up to 8 guests per booking.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center md:justify-end md:gap-3">
        <button
          type="submit"
          disabled={!canSearch}
          className={`inline-flex w-full md:w-auto items-center justify-center rounded-full px-5 py-3 text-sm font-medium text-white transition-all min-h-[48px] touch-manipulation ${
            canSearch
              ? "bg-[#8b6f47] hover:bg-[#a78b62]"
              : "bg-[#c7b6a1] cursor-not-allowed"
          }`}
        >
          <Search className="h-4 w-4 mr-2" />
          <span className="truncate">Show available experiences</span>
        </button>
        <button
          type="button"
          onClick={handleClear}
          disabled={!hasFilters}
          className={`inline-flex w-full md:w-auto items-center justify-center rounded-full border px-4 py-3 text-xs md:text-sm font-medium transition-all min-h-[44px] touch-manipulation ${
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
