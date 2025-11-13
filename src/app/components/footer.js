"use client";

import Link from "next/link";

export default function Footer() {
  return (
    <footer className="w-full border-t border-[#e5e0d8] dark:border-[#2a2824] bg-[#fdfaf5]/90 dark:bg-[#13110f]/90 backdrop-blur-md text-xs text-[#5a4a3f] dark:text-[#dcd8d1] print:hidden">
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-6 md:gap-12">
        {/* Left - Copyright */}
        <p className="tracking-tight opacity-80 text-sm font-light">
          © {new Date().getFullYear()} Oasis. All rights reserved.
        </p>

        {/* Center - Minimal Links */}
        <div className="flex gap-6 md:gap-12 text-sm">
          <Link
            href="/privacy"
            className="opacity-80 hover:opacity-100 transition-opacity font-medium text-[#5a4a3f] dark:text-[#dcd8d1]"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="opacity-80 hover:opacity-100 transition-opacity font-medium text-[#5a4a3f] dark:text-[#dcd8d1]"
          >
            Terms
          </Link>
        </div>

        {/* Right - Credit */}
        <button
          onClick={() =>
            window.open("https://panteliskarabetsos.com", "_blank")
          }
          className="opacity-80 hover:opacity-100 transition-opacity font-medium text-sm text-[#5a4a3f] dark:text-[#dcd8d1]"
        >
          Developed by Pantelis Karabetsos
        </button>
      </div>
    </footer>
  );
}
