"use client";

import { useState } from "react";
import { Share2, Check, Copy } from "lucide-react";

export default function ShareButton({ title, text, url }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    // 1. Try Native Share API (Mobile/Tablets/Modern Browsers)
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: text,
          url: url,
        });
      } catch (error) {
        // User cancelled share, do nothing
        console.log("Share cancelled");
      }
    } else {
      // 2. Fallback to Clipboard (Desktop)
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000); // Reset after 2s
      } catch (err) {
        console.error("Failed to copy", err);
      }
    }
  };

  return (
    <button
      onClick={handleShare}
      aria-label="Share experience"
      className="group relative p-2.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white hover:bg-white hover:text-black transition-all duration-300 active:scale-95"
    >
      <div className="relative z-10">
        {copied ? (
          <Check size={18} className="animate-in zoom-in duration-300" />
        ) : (
          <Share2 size={18} />
        )}
      </div>

      {/* Optional: Simple Tooltip for Desktop */}
      <span className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap backdrop-blur-sm">
        {copied ? "Link Copied!" : "Share"}
      </span>
    </button>
  );
}
