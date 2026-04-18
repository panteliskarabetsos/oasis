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
    // Adjust for local timezone offset to get accurate YYYY-MM-DD
    const offset = d.getTimezoneOffset() * 60000;
    const localISOTime = new Date(d.getTime() - offset)
      .toISOString()
      .split("T")[0];
    setToday(localISOTime);
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
        setDateError("End date must be after check-in.");
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
      className="w-full flex flex-col md:flex-row gap-3 md:gap-4 md:items-center"
    >
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        {/* Check-In Field */}
        <div className="group relative flex flex-col justify-center px-4 lg:px-5 py-2.5 rounded-2xl border border-[#e2d7c7] bg-white transition-all duration-300 focus-within:border-[#8b6f47] focus-within:ring-1 focus-within:ring-[#8b6f47]/50 hover:border-[#d3c2aa] shadow-sm min-h-[56px] lg:min-h-[60px]">
          <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#a7988a] group-focus-within:text-[#8b6f47] mb-0.5 transition-colors">
            Check In
          </label>
          <div className="relative flex items-center">
            <input
              type="date"
              value={from}
              min={today || undefined}
              onChange={(e) => setFrom(e.target.value)}
              className={`w-full bg-transparent text-sm outline-none cursor-pointer appearance-none ${
                from ? "text-[#3a2f28] font-medium" : "text-[#bbaea0]"
              } 
              /* Invisible overlay to make the entire container trigger the native date picker */
              [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
            />
            <Calendar className="absolute right-0 h-4 w-4 text-[#d3c2aa] group-focus-within:text-[#8b6f47] transition-colors pointer-events-none" />
          </div>
        </div>

        {/* Check-Out Field */}
        <div className="group relative flex flex-col justify-center px-4 lg:px-5 py-2.5 rounded-2xl border border-[#e2d7c7] bg-white transition-all duration-300 focus-within:border-[#8b6f47] focus-within:ring-1 focus-within:ring-[#8b6f47]/50 hover:border-[#d3c2aa] shadow-sm min-h-[56px] lg:min-h-[60px]">
          <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#a7988a] group-focus-within:text-[#8b6f47] mb-0.5 transition-colors">
            Check Out
          </label>
          <div className="relative flex items-center">
            <input
              type="date"
              value={to}
              min={from || today || undefined}
              onChange={(e) => setTo(e.target.value)}
              className={`w-full bg-transparent text-sm outline-none cursor-pointer appearance-none ${
                to ? "text-[#3a2f28] font-medium" : "text-[#bbaea0]"
              } 
              [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
            />
            <Calendar className="absolute right-0 h-4 w-4 text-[#d3c2aa] group-focus-within:text-[#8b6f47] transition-colors pointer-events-none" />
          </div>
          {dateError && (
            <span className="absolute -bottom-5 left-2 text-[10px] font-medium text-red-500">
              {dateError}
            </span>
          )}
        </div>

        {/* Party Size Field */}
        <div className="group relative flex flex-col justify-center px-3 lg:px-5 py-2.5 rounded-2xl border border-[#e2d7c7] bg-white transition-all duration-300 focus-within:border-[#8b6f47] focus-within:ring-1 focus-within:ring-[#8b6f47]/50 hover:border-[#d3c2aa] shadow-sm min-h-[56px] lg:min-h-[60px]">
          <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#a7988a] group-focus-within:text-[#8b6f47] mb-1 transition-colors px-1 lg:px-0">
            Guests
          </label>
          <div className="flex items-center justify-between mt-[-2px]">
            <button
              type="button"
              onClick={handleDecrement}
              disabled={!canDecrement}
              className={`flex h-6 w-6 items-center justify-center rounded-full transition-all touch-manipulation shrink-0 ${
                canDecrement
                  ? "bg-[#f4ede4] text-[#8b6f47] hover:bg-[#8b6f47] hover:text-white"
                  : "bg-gray-100 text-gray-300 cursor-not-allowed"
              }`}
            >
              <Minus strokeWidth={2.5} className="h-3 w-3" />
            </button>

            <div className="flex items-center gap-1 lg:gap-2 text-xs lg:text-sm font-medium text-[#3a2f28] text-center">
              {partyNumber > 0 ? (
                <span className="whitespace-nowrap">
                  {partyNumber} Guest{partyNumber > 1 ? "s" : ""}
                </span>
              ) : (
                <span className="text-[#bbaea0] font-normal whitespace-nowrap">
                  Add guests
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleIncrement}
              disabled={!canIncrement}
              className={`flex h-6 w-6 items-center justify-center rounded-full transition-all touch-manipulation shrink-0 ${
                canIncrement
                  ? "bg-[#f4ede4] text-[#8b6f47] hover:bg-[#8b6f47] hover:text-white"
                  : "bg-gray-100 text-gray-300 cursor-not-allowed"
              }`}
            >
              <Plus strokeWidth={2.5} className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center gap-2 lg:gap-3 shrink-0">
        <button
          type="submit"
          disabled={!canSearch}
          className={`group flex w-full sm:w-auto items-center justify-center gap-2 rounded-2xl px-6 lg:px-8 py-3 lg:py-4 text-[11px] font-bold uppercase tracking-[0.15em] text-white transition-all duration-300 shadow-md h-full min-h-[56px] lg:min-h-[60px] ${
            canSearch
              ? "bg-[#1A1A1A] hover:bg-[#8b6f47] hover:shadow-lg active:scale-95"
              : "bg-[#d3c2aa] cursor-not-allowed opacity-80"
          }`}
        >
          <Search className="h-4 w-4" />
          <span>Search</span>
        </button>

        {hasFilters && (
          <button
            type="button"
            onClick={handleClear}
            className="flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-2xl border border-[#e2d7c7] bg-white/50 px-5 lg:px-6 py-3 lg:py-4 text-[11px] font-bold uppercase tracking-[0.15em] text-[#6b625a] transition-all hover:bg-white hover:text-[#3a2f28] h-full min-h-[56px] lg:min-h-[60px] active:scale-95"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>
    </form>
  );
}
