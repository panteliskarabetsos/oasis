import Link from "next/link";
import {
  HeartHandshake,
  Leaf,
  Sparkles,
  Utensils,
  ArrowDown,
} from "lucide-react";

export const metadata = {
  title: "Our Story | Oasis - Cretan Retreats",
  description:
    "A return to the rhythm of the Cretan land. Discover our philosophy, core values, and the standard of authentic hospitality at Oasis.",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#f7f5f0] text-[#3a2e26] selection:bg-[#8b6f47] selection:text-[#f7f5f0] overflow-hidden">
      {/* 1. CINEMATIC HERO */}
      <section className="relative min-h-[90vh] flex flex-col justify-end px-6 pb-12 pt-32 md:pb-24 overflow-hidden">
        {/* Background Image with Parallax-feel scale */}
        <div className="absolute inset-0 z-0">
          <img
            src="/gorge.webp"
            alt="Cretan olive grove landscape"
            className="w-full h-full object-cover animate-in zoom-in-[1.05] duration-[20s] ease-out"
          />
          {/* Multi-layered gradient for perfect text legibility */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#f7f5f0]/80 via-[#f7f5f0]/40 to-[#f7f5f0]" />
          <div className="absolute inset-0 bg-[#3a2e26]/5 mix-blend-multiply" />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-7xl flex flex-col md:flex-row md:items-end justify-between gap-12">
          <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300 fill-mode-both">
            <div className="flex items-center gap-4">
              <div className="w-12 h-[1px] bg-[#8b6f47]" />
              <h4 className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#8b6f47]">
                The Oasis Story
              </h4>
            </div>
            <h1 className="font-serif text-6xl md:text-8xl lg:text-[7.5rem] leading-[0.95] tracking-tight text-[#2a201a]">
              A return to the <br className="hidden md:block" />
              <span className="italic font-light text-[#8b6f47]">
                rhythm
              </span>{" "}
              of Crete.
            </h1>
          </div>

          <div className="max-w-sm md:pb-4 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-500 fill-mode-both">
            <p className="text-base md:text-lg leading-relaxed text-[#5c4e43] font-light">
              Born from a deep respect for heritage, nature, and the unhurried
              lifestyle of the island. Discover authenticity far from the
              crowds.
            </p>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-0 left-6 md:left-12 h-24 w-[1px] bg-gradient-to-b from-transparent via-[#8b6f47] to-transparent animate-pulse" />
      </section>

      {/* 2. EDITORIAL PHILOSOPHY (Asymmetrical Layout) */}
      <section className="py-32 md:py-48 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-0 items-center">
            {/* Left: Text Block */}
            <div className="lg:col-span-5 space-y-12 lg:pr-12">
              <div className="space-y-6">
                <h2 className="font-serif text-4xl md:text-6xl text-[#2a201a] leading-tight">
                  Our <br /> Philosophy
                </h2>
                <div className="w-12 h-[1px] bg-[#8b6f47]" />
              </div>

              <div className="space-y-8 text-[#5c4e43] font-light leading-loose text-base md:text-lg">
                <p>
                  We believe that true luxury lies in simplicity, connection,
                  and time. In an era of fast-paced travel, Oasis offers a
                  deliberate pause. We have meticulously designed a portfolio of
                  boutique experiences that celebrate the soul of Crete.
                </p>
                <p>
                  Whether you are foraging for wild herbs in the White
                  Mountains, molding clay at a potter's wheel, or sharing a meal
                  straight from a grandmother's wood-fired oven, every moment is
                  an invitation to slow down.
                </p>
              </div>
            </div>

            {/* Right: Dramatic Overlapping Images */}
            <div className="lg:col-span-7 relative h-[600px] lg:h-[800px] w-full mt-12 lg:mt-0">
              {/* Tall Portrait */}
              <div className="absolute top-0 right-0 w-[70%] h-[85%] overflow-hidden bg-[#e8e3da]">
                <img
                  src="/fishing-boat.webp"
                  alt="Cretan ceramics"
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-[10s]"
                />
              </div>

              {/* Landscape Breakout Overlap */}
              <div className="absolute bottom-0 left-0 w-[60%] h-[45%] overflow-hidden bg-[#dcd5c9] border-8 border-[#f7f5f0] shadow-2xl z-20">
                <img
                  src="/cretan-food.webp"
                  alt="Wood-fired oven"
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-[10s]"
                />
              </div>

              {/* Minimal Caption */}
              <div className="absolute -right-8 bottom-32 rotate-90 origin-bottom-right hidden lg:block">
                <p className="text-[9px] uppercase tracking-[0.3em] text-[#8b6f47]">
                  Archival & Authentic
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. THE MONUMENTAL QUOTE */}
      <section className="py-32 px-6 bg-[#efece6]">
        <div className="mx-auto max-w-5xl text-center space-y-12">
          <div className="w-[1px] h-24 bg-[#8b6f47]/30 mx-auto" />
          <h3 className="font-serif text-3xl md:text-5xl lg:text-6xl text-[#2a201a] leading-[1.3] text-balance">
            "To us, food and art are living histories. What you taste and what
            you make carry the profound story of the Cretan land."
          </h3>
          <div className="w-[1px] h-24 bg-[#8b6f47]/30 mx-auto" />
        </div>
      </section>

      {/* 4. CORE VALUES (Windowpane Grid) */}
      <section className="py-32 md:py-48 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-20 gap-8">
            <h2 className="font-serif text-4xl md:text-6xl text-[#2a201a] leading-none">
              The <br className="hidden md:block" /> Foundations
            </h2>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#8b6f47] max-w-[200px]">
              The four pillars of the Oasis standard.
            </p>
          </div>

          {/* Hairline Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 border-t border-l border-[#8b6f47]/15">
            {/* 01 */}
            <div className="group border-b border-r border-[#8b6f47]/15 p-10 md:p-16 bg-white/30 hover:bg-white transition-colors duration-500">
              <div className="flex items-start justify-between mb-12">
                <div className="w-12 h-12 rounded-full bg-[#efece6] flex items-center justify-center text-[#8b6f47] group-hover:bg-[#8b6f47] group-hover:text-white transition-colors duration-500">
                  <HeartHandshake strokeWidth={1.5} size={20} />
                </div>
                <span className="font-serif text-4xl text-[#8b6f47]/20 group-hover:text-[#8b6f47]/40 transition-colors">
                  01
                </span>
              </div>
              <h3 className="text-2xl font-serif text-[#2a201a] mb-6">
                Authentic Heritage
              </h3>
              <p className="text-base leading-relaxed text-[#5c4e43] font-light">
                We bypass the tourist trails to connect you directly with the
                true custodians of Cretan culture. Learn from local artisans,
                master ceramicists, and native grandmothers who share their
                craft and famous <em>kerasma</em>.
              </p>
            </div>

            {/* 02 */}
            <div className="group border-b border-r border-[#8b6f47]/15 p-10 md:p-16 bg-white/30 hover:bg-white transition-colors duration-500">
              <div className="flex items-start justify-between mb-12">
                <div className="w-12 h-12 rounded-full bg-[#efece6] flex items-center justify-center text-[#8b6f47] group-hover:bg-[#8b6f47] group-hover:text-white transition-colors duration-500">
                  <Leaf strokeWidth={1.5} size={20} />
                </div>
                <span className="font-serif text-4xl text-[#8b6f47]/20 group-hover:text-[#8b6f47]/40 transition-colors">
                  02
                </span>
              </div>
              <h3 className="text-2xl font-serif text-[#2a201a] mb-6">
                Mindful Exploration
              </h3>
              <p className="text-base leading-relaxed text-[#5c4e43] font-light">
                Nature is our sanctuary. Our experiences are designed to be
                therapeutic and grounding. We strictly adhere to a "Leave No
                Trace" philosophy, ensuring we protect the environments we
                explore.
              </p>
            </div>

            {/* 03 */}
            <div className="group border-b border-r border-[#8b6f47]/15 p-10 md:p-16 bg-white/30 hover:bg-white transition-colors duration-500">
              <div className="flex items-start justify-between mb-12">
                <div className="w-12 h-12 rounded-full bg-[#efece6] flex items-center justify-center text-[#8b6f47] group-hover:bg-[#8b6f47] group-hover:text-white transition-colors duration-500">
                  <Sparkles strokeWidth={1.5} size={20} />
                </div>
                <span className="font-serif text-4xl text-[#8b6f47]/20 group-hover:text-[#8b6f47]/40 transition-colors">
                  03
                </span>
              </div>
              <h3 className="text-2xl font-serif text-[#2a201a] mb-6">
                Bespoke Comfort
              </h3>
              <p className="text-base leading-relaxed text-[#5c4e43] font-light">
                We specialize in small-group and fully private experiences. From
                premium transportation to customized menus tailored to your
                needs, we manage every detail so you remain entirely present.
              </p>
            </div>

            {/* 04 */}
            <div className="group border-b border-r border-[#8b6f47]/15 p-10 md:p-16 bg-white/30 hover:bg-white transition-colors duration-500">
              <div className="flex items-start justify-between mb-12">
                <div className="w-12 h-12 rounded-full bg-[#efece6] flex items-center justify-center text-[#8b6f47] group-hover:bg-[#8b6f47] group-hover:text-white transition-colors duration-500">
                  <Utensils strokeWidth={1.5} size={20} />
                </div>
                <span className="font-serif text-4xl text-[#8b6f47]/20 group-hover:text-[#8b6f47]/40 transition-colors">
                  04
                </span>
              </div>
              <h3 className="text-2xl font-serif text-[#2a201a] mb-6">
                Sensory Storytelling
              </h3>
              <p className="text-base leading-relaxed text-[#5c4e43] font-light">
                To us, food and art are living histories. We focus on seasonal,
                organic ingredients, local wines, and hands-on creation,
                ensuring what you taste carries the story of the land.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. THE OASIS STANDARD (Dark Editorial Finish) */}
      <section className="relative py-32 md:py-48 px-6 bg-[#2a201a] text-[#f7f5f0] overflow-hidden">
        <div className="absolute inset-0 opacity-10 mix-blend-overlay">
          <img
            src="https://images.unsplash.com/photo-1544550581-5f7ceaf7f992?q=80&w=2500&auto=format&fit=crop"
            alt="Texture"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="relative mx-auto max-w-5xl flex flex-col items-center text-center space-y-12">
          <div className="space-y-8 max-w-3xl">
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#8b6f47]">
              Uncompromising Quality
            </h4>
            <h2 className="font-serif text-5xl md:text-7xl text-[#f7f5f0] leading-none">
              The Oasis Standard
            </h2>
            <p className="text-base md:text-lg leading-relaxed text-[#a89f91] font-light text-balance pt-6">
              Your safety, comfort, and peace of mind are the foundations of our
              hospitality. Every Oasis experience is backed by rigorous
              operational standards and a dedicated team of hosts. We partner
              exclusively with premium local vendors to ensure your journey is
              seamless.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-12 w-full max-w-md mx-auto">
            <Link
              href="/experiences"
              className="group relative w-full sm:w-auto px-10 py-5 bg-[#8b6f47] text-[#f7f5f0] text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-[#9d7d52] transition-colors duration-500 overflow-hidden"
            >
              <span className="relative z-10">Explore Experiences</span>
            </Link>
            <Link
              href="/private"
              className="group relative w-full sm:w-auto px-10 py-5 border border-[#5c4e43] text-[#f7f5f0] text-[10px] font-bold uppercase tracking-[0.2em] hover:border-[#8b6f47] hover:bg-[#8b6f47]/10 transition-colors duration-500"
            >
              <span className="relative z-10">Private Gatherings</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
