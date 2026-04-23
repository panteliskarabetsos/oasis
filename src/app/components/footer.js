import Link from "next/link";
import {
  Mail,
  MapPin,
  Phone,
  Instagram,
  Facebook,
  ArrowRight,
} from "lucide-react";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative bg-[#f4f1ec] text-[#4d3d33] overflow-hidden border-t border-[#eadfce]">
      {/* Ambient Top Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-[radial-gradient(ellipse_at_top,rgba(139,111,71,0.08)_0%,transparent_70%)] pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-6 pt-24 pb-8 md:px-10 lg:pt-32">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-8">
          {/* Brand & Tagline - Takes up 5 columns on desktop */}
          <div className="lg:col-span-5 flex flex-col justify-between">
            <div className="space-y-8 max-w-sm">
              <h3 className="font-serif text-3xl md:text-4xl text-[#4d3d33] leading-snug">
                A return to the rhythm of the Cretan land.
              </h3>
              <p className="text-sm md:text-base leading-relaxed text-[#6b625a] font-light">
                Intimate retreats, unhurried days, and thoughtful gatherings in
                and around Chania — curated with softness, space, and deep
                respect for our heritage.
              </p>
            </div>

            {/* Minimal Newsletter Subscription */}
            <div className="mt-12 space-y-4">
              <h4 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#8b6f47]">
                Join our journal
              </h4>
              <form className="relative group max-w-sm">
                <input
                  type="email"
                  placeholder="Email address"
                  className="w-full bg-transparent border-b border-[#d6c6b2] py-3 pl-0 pr-10 text-sm text-[#4d3d33] placeholder:text-[#8b7a6b] focus:outline-none focus:border-[#8b6f47] transition-colors"
                  required
                />
                <button
                  type="submit"
                  className="absolute right-0 top-1/2 -translate-y-1/2 text-[#8b7a6b] group-focus-within:text-[#8b6f47] hover:text-[#4d3d33] transition-colors"
                  aria-label="Subscribe"
                >
                  <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </form>
            </div>
          </div>

          {/* Navigation Links - Takes up remaining columns */}
          <div className="lg:col-span-7 grid grid-cols-2 md:grid-cols-3 gap-12 lg:pl-12">
            {/* Explore Column */}
            <div className="space-y-6">
              <h4 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#8b6f47]">
                Explore
              </h4>
              <ul className="space-y-4 text-sm font-light text-[#6b625a]">
                <li>
                  <Link
                    href="/"
                    className="inline-block relative overflow-hidden group hover:text-[#4d3d33] transition-colors"
                  >
                    Home
                    <span className="absolute bottom-0 left-0 w-full h-[1px] bg-[#8b6f47] -translate-x-[101%] group-hover:translate-x-0 transition-transform duration-500" />
                  </Link>
                </li>
                <li>
                  <Link
                    href="/experiences"
                    className="inline-block relative overflow-hidden group hover:text-[#4d3d33] transition-colors"
                  >
                    Experiences
                    <span className="absolute bottom-0 left-0 w-full h-[1px] bg-[#8b6f47] -translate-x-[101%] group-hover:translate-x-0 transition-transform duration-500" />
                  </Link>
                </li>
                <li>
                  <Link
                    href="/about"
                    className="inline-block relative overflow-hidden group hover:text-[#4d3d33] transition-colors"
                  >
                    Our Story
                    <span className="absolute bottom-0 left-0 w-full h-[1px] bg-[#8b6f47] -translate-x-[101%] group-hover:translate-x-0 transition-transform duration-500" />
                  </Link>
                </li>
                <li>
                  <Link
                    href="/contact"
                    className="inline-block relative overflow-hidden group hover:text-[#4d3d33] transition-colors"
                  >
                    Contact
                    <span className="absolute bottom-0 left-0 w-full h-[1px] bg-[#8b6f47] -translate-x-[101%] group-hover:translate-x-0 transition-transform duration-500" />
                  </Link>
                </li>
              </ul>
            </div>

            {/* Plan Column */}
            <div className="space-y-6">
              <h4 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#8b6f47]">
                Plan
              </h4>
              <ul className="space-y-4 text-sm font-light text-[#6b625a]">
                <li>
                  <Link
                    href="/retreats"
                    className="inline-block relative overflow-hidden group hover:text-[#4d3d33] transition-colors"
                  >
                    Retreats
                    <span className="absolute bottom-0 left-0 w-full h-[1px] bg-[#8b6f47] -translate-x-[101%] group-hover:translate-x-0 transition-transform duration-500" />
                  </Link>
                </li>
                <li>
                  <Link
                    href="/private"
                    className="inline-block relative overflow-hidden group hover:text-[#4d3d33] transition-colors"
                  >
                    Private Gatherings
                    <span className="absolute bottom-0 left-0 w-full h-[1px] bg-[#8b6f47] -translate-x-[101%] group-hover:translate-x-0 transition-transform duration-500" />
                  </Link>
                </li>
              </ul>
            </div>

            {/* Contact & Socials */}
            <div className="col-span-2 md:col-span-1 space-y-6">
              <h4 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#8b6f47]">
                Connect
              </h4>
              <ul className="space-y-4 text-sm font-light text-[#6b625a]">
                <li>
                  <a
                    href="mailto:info@youroasis.gr"
                    className="group flex items-center gap-3 hover:text-[#4d3d33] transition-colors"
                  >
                    <Mail
                      className="w-4 h-4 text-[#8b6f47] group-hover:scale-110 transition-transform"
                      strokeWidth={1.5}
                    />
                    info@youroasis.gr
                  </a>
                </li>
                <li>
                  <a
                    href="tel:+302100000000"
                    className="group flex items-center gap-3 hover:text-[#4d3d33] transition-colors"
                  >
                    <Phone
                      className="w-4 h-4 text-[#8b6f47] group-hover:scale-110 transition-transform"
                      strokeWidth={1.5}
                    />
                    +30 210 000 0000
                  </a>
                </li>
                <li className="flex items-start gap-3">
                  <MapPin
                    className="w-4 h-4 text-[#8b6f47] mt-0.5 shrink-0"
                    strokeWidth={1.5}
                  />
                  <span>
                    Chania, Crete
                    <br />
                    Greece
                  </span>
                </li>
              </ul>

              <div className="pt-4 flex items-center gap-4">
                <a
                  href="#"
                  aria-label="Instagram"
                  className="text-[#8b6f47] hover:text-[#4d3d33] hover:-translate-y-1 transition-all duration-300"
                >
                  <Instagram className="w-5 h-5" strokeWidth={1.5} />
                </a>
                <a
                  href="#"
                  aria-label="Facebook"
                  className="text-[#8b6f47] hover:text-[#4d3d33] hover:-translate-y-1 transition-all duration-300"
                >
                  <Facebook className="w-5 h-5" strokeWidth={1.5} />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Giant Watermark Text */}
        <div className="mt-20 sm:mt-32 flex justify-center overflow-hidden select-none pointer-events-none opacity-5">
          <span className="text-[18vw] font-serif font-bold text-[#4d3d33] leading-none tracking-tighter">
            OASIS
          </span>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 border-t border-[#eadfce] pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] text-[#8b7a6b] font-light uppercase tracking-widest">
          <p>© {year} Oasis. All rights reserved.</p>

          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8">
            <Link
              href="/privacy-policy"
              className="hover:text-[#4d3d33] transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/terms-of-use"
              className="hover:text-[#4d3d33] transition-colors"
            >
              Terms
            </Link>
            <a
              href="https://www.panteliskarabetsos.com"
              target="_blank"
              rel="noreferrer"
              className="text-[#8b6f47] hover:text-[#4d3d33] transition-colors"
            >
              Created by Pantelis
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
