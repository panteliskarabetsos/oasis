import Link from "next/link";
import { Mail, MapPin, Phone, Instagram, Facebook } from "lucide-react";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative border-t border-[#e0d6c6] bg-[#f4f1ec] text-[#3e3128] overflow-hidden pt-8 md:pt-22">
      {/* Subtle background accents, smaller */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
      >
        <div className="absolute -top-16 left-[-3rem] h-28 w-28 rounded-full bg-[#e3d3bc]/70 blur-3xl" />
        <div className="absolute -bottom-14 right-[-3rem] h-28 w-28 rounded-full bg-[#d2c3aa]/70 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 pt-5 pb-2 md:px-10 md:pt-6 md:pb-2">
        {/* Top section */}
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          {/* Brand + tagline */}
          <div className="max-w-sm space-y-2.5">
            {/* <div className="inline-flex items-center gap-2 rounded-full border border-[#d3c2aa] bg-white/80 px-3 py-0.5 text-[10px] uppercase tracking-[0.22em] text-[#8b6f47]">
              Oasis • Crete
            </div> */}
            <h3 className="font-serif text-lg text-[#3e3128]">
              Slow-crafted experiences by the sea.
            </h3>
            <p className="text-[13px] leading-relaxed text-[#6a5a49]">
              Intimate retreats, unhurried days and thoughtful gatherings in and
              around Chania — designed with softness, space and care.
            </p>
          </div>

          {/* Links */}
          <div className="grid flex-1 grid-cols-2 gap-6 text-sm md:grid-cols-3">
            <div className="space-y-2.5">
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b7a6b]">
                Explore
              </h4>
              <ul className="space-y-1.5 text-[13px] text-[#4d3d33]">
                <li>
                  <Link href="/" className="transition hover:text-[#8b6f47]">
                    Home
                  </Link>
                </li>
                <li>
                  <Link
                    href="/experiences"
                    className="transition hover:text-[#8b6f47]"
                  >
                    Experiences
                  </Link>
                </li>
                <li>
                  <Link
                    href="/about"
                    className="transition hover:text-[#8b6f47]"
                  >
                    About Oasis
                  </Link>
                </li>
                <li>
                  <Link
                    href="/contact"
                    className="transition hover:text-[#8b6f47]"
                  >
                    Contact
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-2.5">
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b7a6b]">
                Plan
              </h4>
              <ul className="space-y-1.5 text-[13px] text-[#4d3d33]">
                <li>
                  <Link
                    href="/retreats"
                    className="transition hover:text-[#8b6f47]"
                  >
                    Retreats
                  </Link>
                </li>
                <li>
                  <Link
                    href="/private"
                    className="transition hover:text-[#8b6f47]"
                  >
                    Private gatherings
                  </Link>
                </li>
                <li>
                  <Link
                    href="/appointments"
                    className="transition hover:text-[#8b6f47]"
                  >
                    Schedule a call
                  </Link>
                </li>
              </ul>
            </div>

            {/* Contact */}
            <div className="col-span-2 space-y-2.5 md:col-span-1">
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b7a6b]">
                Contact
              </h4>
              <ul className="space-y-1.5 text-[13px] text-[#4d3d33]">
                <li className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-[#8b6f47]" />
                  <a
                    href="mailto:info@youroasis.gr"
                    className="transition hover:text-[#8b6f47]"
                  >
                    info@youroasis.gr
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-[#8b6f47]" />
                  <a
                    href="tel:+302100000000"
                    className="transition hover:text-[#8b6f47]"
                  >
                    +30 210 000 0000
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-[#8b6f47]" />
                  <span>Chania, Crete</span>
                </li>
              </ul>

              {/* Socials */}
              <div className="mt-2 flex items-center gap-2.5">
                <a
                  href="#"
                  aria-label="Oasis on Instagram"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-[#ddcdbd] bg-white/80 text-[#8b6f47] transition hover:-translate-y-0.5 hover:border-[#c4b096] hover:bg-[#f8f2e8]"
                >
                  <Instagram className="h-4 w-4" />
                </a>
                <a
                  href="#"
                  aria-label="Oasis on Facebook"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-[#ddcdbd] bg-white/80 text-[#8b6f47] transition hover:-translate-y-0.5 hover:border-[#c4b096] hover:bg-[#f8f2e8]"
                >
                  <Facebook className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-3 border-t border-[#e7dbcb] pt-3 text-[11px] text-[#8b7a6b] md:mt-4 md:flex md:items-center md:justify-between">
          <p className="mb-1.5 md:mb-0">© {year} Oasis. All rights reserved.</p>
          <div className="flex flex-wrap gap-3">
            <span className="text-[#b3a596]">Made with care in Crete.</span>
            <a
              href="https://www.panteliskarabetsos.com"
              target="_blank"
              rel="noreferrer"
              className="underline-offset-2 hover:underline"
            >
              Created by Pantelis
            </a>
            <Link
              href="/privacy-policy"
              className="underline-offset-2 hover:underline"
            >
              Privacy
            </Link>
            <Link
              href="/terms-of-use"
              className="underline-offset-2 hover:underline"
            >
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
