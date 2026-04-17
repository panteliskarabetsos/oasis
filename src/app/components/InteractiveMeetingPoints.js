// src/app/components/InteractiveMeetingPoints.js
"use client";

import { useState } from "react";
import { MapPin, Info, Navigation } from "lucide-react";

export default function InteractiveMeetingPoints({ points }) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (!points || !Array.isArray(points) || points.length === 0) return null;

  const activePoint = points[activeIndex];

  return (
    <div className="grid lg:grid-cols-[1fr_1.5fr] gap-6 sm:gap-10 items-start">
      {/* LEFT: Scrollable List of Points */}
      <div className="flex flex-col gap-4 lg:max-h-[550px] lg:overflow-y-auto pr-1 sm:pr-4 no-scrollbar">
        {points.map((point, idx) => {
          const isActive = activeIndex === idx;
          return (
            <button
              key={point.id || idx}
              onClick={() => setActiveIndex(idx)}
              className={`text-left p-6 sm:p-8 rounded-[2rem] border transition-all duration-300 w-full group ${
                isActive
                  ? "bg-white border-[#C8AA86] shadow-md ring-1 ring-[#C8AA86]"
                  : "bg-white/50 border-[#EAE6DF] hover:border-[#C8AA86]/50 hover:bg-white"
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-colors duration-300 ${
                    isActive
                      ? "bg-[#C8AA86] text-white"
                      : "bg-[#F6F4F0] text-[#C8AA86] group-hover:bg-[#C8AA86]/10"
                  }`}
                >
                  <MapPin size={20} />
                </div>
                <div className="flex-1">
                  <h4
                    className={`font-serif text-xl sm:text-2xl mb-1.5 transition-colors ${
                      isActive ? "text-[#C8AA86]" : "text-[#1A1A1A]"
                    }`}
                  >
                    {point.name}
                  </h4>
                  <p className="text-sm font-medium text-[#555] mb-4 leading-relaxed">
                    {point.mapPin}
                  </p>

                  {/* Instructions Box */}
                  {point.instructions && (
                    <div
                      className={`p-4 rounded-xl border transition-colors ${
                        isActive
                          ? "bg-[#FDFCF8] border-[#C8AA86]/30"
                          : "bg-[#F6F4F0] border-[#EAE6DF]/60"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Info size={14} className="text-[#C8AA86]" />
                        <p className="text-[10px] font-bold uppercase text-[#A1A1A1] tracking-[0.2em]">
                          Instructions
                        </p>
                      </div>
                      <p className="text-sm text-[#555] leading-relaxed">
                        {point.instructions}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* RIGHT: Dynamic Interactive Map */}
      <div className="relative rounded-[2.5rem] overflow-hidden border border-[#EAE6DF] h-[400px] lg:h-[550px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-[#EAE6DF] group">
        <iframe
          key={activePoint.mapPin} // Forces iframe to reload when address changes
          title={`Map for ${activePoint.name}`}
          src={`https://maps.google.com/maps?q=${encodeURIComponent(
            activePoint.mapPin,
          )}&t=&z=14&ie=UTF8&iwloc=&output=embed`}
          width="100%"
          height="100%"
          className="grayscale-[0.15] group-hover:grayscale-0 transition-all duration-1000"
          style={{ border: 0 }}
          loading="lazy"
        />

        {/* Floating "Get Directions" Button inside Map */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-xs">
          <a
            href={`https://maps.google.com/maps?q=${encodeURIComponent(
              activePoint.mapPin,
            )}`}
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center justify-center gap-2 py-4 bg-[#1A1A1A]/95 backdrop-blur-md text-white text-[11px] font-bold uppercase tracking-[0.2em] rounded-2xl hover:bg-[#C8AA86] transition-all duration-300 shadow-[0_10px_30px_rgba(0,0,0,0.3)] hover:shadow-[#C8AA86]/40 hover:-translate-y-1"
          >
            Open in Google Maps{" "}
            <Navigation size={14} className="ml-1 shrink-0" />
          </a>
        </div>
      </div>
    </div>
  );
}
