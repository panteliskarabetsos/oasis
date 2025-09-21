'use client';

import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="w-full border-t border-[#e5e0d8] dark:border-[#2a2824] bg-[#fdfaf5]/60 dark:bg-[#13110f]/60 backdrop-blur-md text-xs text-[#5a4a3f] dark:text-[#dcd8d1] print:hidden">
      <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Left - Copyright */}
        <p className="tracking-tight opacity-70">
          © {new Date().getFullYear()} Oasis. All rights reserved.
        </p>

        {/* Center - Minimal Links */}
        <div className="flex gap-4">
          <Link
            href="/privacy"
            className="hover:opacity-100 opacity-70 transition-opacity"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="hover:opacity-100 opacity-70 transition-opacity"
          >
            Terms
          </Link>
        </div>

        {/* Right - Credit */}
        <button
          onClick={() => window.open('https://panteliskarabetsos.com', '_blank')}
          className="opacity-70 hover:opacity-100 transition-opacity"
        >
         Developed by Pantelis Karabetsos
        </button>
      </div>
    </footer>
  );
}
