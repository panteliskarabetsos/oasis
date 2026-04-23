"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

// --- Reusable Editorial Section Component ---
const PolicySection = ({ number, title, children }) => (
  <motion.section
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-50px" }}
    transition={{ duration: 0.8, ease: "easeOut" }}
    className="grid grid-cols-1 md:grid-cols-[1fr,2fr] gap-6 md:gap-16 border-t border-[#eadfce] py-12 md:py-16"
  >
    <div className="md:sticky md:top-32 h-fit">
      <span className="text-[10px] uppercase tracking-[0.3em] text-[#8b6f47] font-medium">
        {number}
      </span>
      <h2 className="text-2xl md:text-3xl font-serif text-[#4d3d33] mt-3 leading-snug">
        {title}
      </h2>
    </div>
    <div className="text-sm md:text-[15px] font-light leading-relaxed text-[#6b625a] space-y-6">
      {children}
    </div>
  </motion.section>
);

export default function TermsOfUsePage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[#f4f1ec] selection:bg-[#8b6f47] selection:text-white overflow-x-hidden">
      {/* --- AMBIENT BACKGROUND GLOW --- */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-32 left-0 w-[40rem] h-[40rem] bg-[radial-gradient(circle_at_center,rgba(234,223,206,0.6)_0%,transparent_70%)]" />
        <div className="absolute top-1/2 right-0 w-[40rem] h-[40rem] bg-[radial-gradient(circle_at_center,rgba(234,223,206,0.4)_0%,transparent_70%)]" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-20 md:py-32">
        {/* --- NAVIGATION & HEADER --- */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="mb-20"
        >
          <button
            onClick={() => router.back()}
            className="group inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-[#8b6f47] hover:text-[#4d3d33] transition-colors mb-16"
          >
            <span className="flex items-center justify-center w-8 h-8 rounded-full border border-[#8b6f47]/30 group-hover:border-[#4d3d33] transition-colors">
              <ArrowLeft className="w-3 h-3" />
            </span>
            Return
          </button>

          <header className="max-w-3xl space-y-6">
            <h1 className="text-5xl md:text-7xl font-serif text-[#4d3d33] leading-[1.1] tracking-tight">
              Terms{" "}
              <span className="italic text-[#8b6f47] font-normal">of Use</span>
            </h1>
            <p className="text-base md:text-lg text-[#6b625a] font-light leading-relaxed max-w-xl">
              Please read these terms carefully. By accessing our website,
              booking an experience, or purchasing a product, you agree to be
              bound by these comprehensive policies governing your interaction
              with Oasis.
            </p>
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#8b7a6b] pt-4">
              Last updated: April 2026
            </p>
          </header>
        </motion.div>

        {/* --- EDITORIAL CONTENT GRID --- */}
        <div className="relative border-b border-[#eadfce]">
          <PolicySection number="01" title="Who We Are & Acceptance">
            <p>
              These Terms of Use govern your use of the Oasis website, booking
              platform, online shop, and related services (collectively, the
              "Services"). References to "we", "us" or "Oasis" refer to the
              operators of this website and the curated experiences offered
              through it, operating out of Crete, Greece.
            </p>
            <p>
              By accessing or using the Services, you confirm that you are at
              least 18 years old (or the age of legal majority in your
              jurisdiction) and that you have read, understood, and agreed to be
              bound by these Terms. We reserve the right to update or modify
              these Terms at any time without prior notice. Continued use of the
              Services constitutes acceptance of any updated Terms.
            </p>
          </PolicySection>

          <PolicySection number="02" title="User Accounts & Conduct">
            <p>
              To access certain features, you may be required to create an
              account. You must provide accurate, current, and complete
              information and maintain the security of your credentials. You are
              entirely responsible for all activities occurring under your
              account. Oasis reserves the right to suspend or terminate accounts
              that provide false data or engage in unauthorized activity.
            </p>
            <p>
              <strong>Acceptable Use:</strong> You agree not to use the Services
              in any way that violates applicable laws or regulations.
              Prohibited actions include, but are not limited to: transmitting
              harmful or abusive content, engaging in automated scraping or data
              harvesting, attempting to bypass security protocols, and
              interfering with the operational integrity of the website or
              booking systems.
            </p>
          </PolicySection>

          <PolicySection number="03" title="Booking & Payment Framework">
            <p>
              Due to the highly personalized nature of our experiences, our
              commitments to local partners, and the sourcing of fresh, premium
              materials, Oasis operates under a strict booking framework:
            </p>
            <ul className="space-y-4 mt-6">
              <li className="pl-5 border-l border-[#8b6f47]/40">
                <span className="font-medium text-[#4d3d33] block mb-1">
                  1. Payment Confirmation:
                </span>
                To finalize and secure a booking, 100% prepayment of the service
                cost is generally required at checkout, unless explicitly stated
                otherwise during the booking process.
              </li>
              <li className="pl-5 border-l border-[#8b6f47]/40">
                <span className="font-medium text-[#4d3d33] block mb-1">
                  2. Payment Deadlines:
                </span>
                For inquiries or bookings requiring manual invoicing, payments
                must be completed and cleared no later than 48 hours prior to
                the scheduled start time to avoid automatic cancellation.
              </li>
              <li className="pl-5 border-l border-[#8b6f47]/40">
                <span className="font-medium text-[#4d3d33] block mb-1">
                  3. Pricing & Currency:
                </span>
                Unless otherwise indicated, all prices are in Euros (€) and
                include applicable local taxes. We are not responsible for
                dynamic currency conversion fees or charges levied by your bank
                or credit card provider.
              </li>
            </ul>
          </PolicySection>

          <PolicySection number="04" title="Tiered Cancellation Policy">
            <p>
              We understand that travel plans can change unexpectedly. Because
              our offerings range from casual group walks to highly orchestrated
              private chef dinners, we utilize a{" "}
              <strong>Tiered Cancellation Policy</strong>.
            </p>
            <p>
              The specific tier applying to your booking will always be clearly
              displayed on the experience page and in your confirmation email.
              Our three cancellation tiers are defined as follows:
            </p>

            <div className="space-y-4 mt-8">
              {/* TIER 1: Flexible */}
              <div className="bg-white/50 border border-[#eadfce] rounded-2xl p-6 relative overflow-hidden group hover:bg-white/80 transition-colors">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-[#a3b19b]" />
                <h3 className="font-serif text-xl text-[#4d3d33] mb-3">
                  Flexible
                </h3>
                <div className="flex items-center justify-between text-sm border-b border-[#eadfce]/50 pb-3 mb-3">
                  <span className="text-[#6b625a]">
                    Up to 48 hours before start:
                  </span>
                  <span className="font-medium text-[#4d3d33]">
                    100% Full Refund
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#6b625a]">
                    Less than 48 hours before:
                  </span>
                  <span className="font-medium text-[#b44d4d]">No Refund</span>
                </div>
              </div>

              {/* TIER 2: Moderate */}
              <div className="bg-white/50 border border-[#eadfce] rounded-2xl p-6 relative overflow-hidden group hover:bg-white/80 transition-colors">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-[#d6c6b2]" />
                <h3 className="font-serif text-xl text-[#4d3d33] mb-3">
                  Moderate
                </h3>
                <div className="flex items-center justify-between text-sm border-b border-[#eadfce]/50 pb-3 mb-3">
                  <span className="text-[#6b625a]">
                    Up to 7 days before start:
                  </span>
                  <span className="font-medium text-[#4d3d33]">
                    100% Full Refund
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm border-b border-[#eadfce]/50 pb-3 mb-3">
                  <span className="text-[#6b625a]">
                    Up to 48 hours before start:
                  </span>
                  <span className="font-medium text-[#8b6f47]">50% Refund</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#6b625a]">
                    Less than 48 hours before:
                  </span>
                  <span className="font-medium text-[#b44d4d]">No Refund</span>
                </div>
              </div>

              {/* TIER 3: Strict / Bespoke */}
              <div className="bg-white/50 border border-[#eadfce] rounded-2xl p-6 relative overflow-hidden group hover:bg-white/80 transition-colors">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-[#8b6f47]" />
                <h3 className="font-serif text-xl text-[#4d3d33] mb-1">
                  Strict{" "}
                  <span className="text-sm font-sans font-light italic text-[#8b6f47] ml-2">
                    (Oasis Bespoke & Private)
                  </span>
                </h3>
                <p className="text-xs text-[#8b7a6b] mb-4">
                  Applied to highly customized events requiring upfront
                  investments with external artisans.
                </p>
                <div className="flex items-center justify-between text-sm border-b border-[#eadfce]/50 pb-3 mb-3">
                  <span className="text-[#6b625a]">
                    Up to 14 days before start:
                  </span>
                  <span className="font-medium text-[#4d3d33]">
                    100% Full Refund
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm border-b border-[#eadfce]/50 pb-3 mb-3">
                  <span className="text-[#6b625a]">
                    7 to 13 days before start:
                  </span>
                  <span className="font-medium text-[#8b6f47]">
                    50% Refund*
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#6b625a]">
                    Less than 7 days before start:
                  </span>
                  <span className="font-medium text-[#b44d4d]">No Refund</span>
                </div>
              </div>
            </div>

            <p className="text-xs mt-4 text-[#8b7a6b] italic leading-relaxed">
              *Where a 50% refund is issued, the retained balance covers
              non-recoverable administrative costs, prep work, and guaranteed
              payouts required by our third-party hosts, chefs, and estates.
            </p>
          </PolicySection>

          <PolicySection number="05" title="Modifications & No-Shows">
            <p>
              <strong className="text-[#4d3d33] font-medium">
                Date Changes:
              </strong>{" "}
              You may request to modify the date of your booking subject to the
              timeframes outlined in your specific cancellation tier. Changes
              requested outside the "100% Refund" window are evaluated strictly
              on a case-by-case basis, are subject to availability, and may
              incur additional administrative or rebooking charges.
            </p>
            <p className="mt-4">
              <strong className="text-[#4d3d33] font-medium">
                Late Arrivals & No-Shows:
              </strong>{" "}
              Respecting the rhythm of the group and the preparation of our
              hosts is critical. A "No-Show" is defined as a guest arriving more
              than <strong>15 minutes late</strong> to the scheduled meeting
              point without prior notice. In this event, the experience will
              proceed without the delayed guest, and no refund or credit will be
              issued.
            </p>
          </PolicySection>

          <PolicySection
            number="06"
            title="Cancellations & Alterations by Oasis"
          >
            <p>
              While rare, Oasis reserves the right to alter, reschedule, or
              cancel an experience under the following circumstances:
            </p>
            <ul className="space-y-4 mt-6">
              <li className="pl-5 border-l border-[#8b6f47]/40">
                <span className="font-medium text-[#4d3d33] block mb-1">
                  Minimum Participation:
                </span>
                Certain group tours require a minimum number of participants to
                operate (typically 4). If this minimum is not met, guests will
                be notified at least 48 hours in advance. We will offer an
                alternative date, a private upgrade (subject to an additional
                fee), or a full 100% refund.
              </li>
              <li className="pl-5 border-l border-[#8b6f47]/40">
                <span className="font-medium text-[#4d3d33] block mb-1">
                  Force Majeure & Safety:
                </span>
                In cases of extreme weather conditions, natural disasters, or
                unforeseen events rendering the experience unsafe or impossible,
                Oasis will propose an alternative date or provide a full refund.
                Oasis assumes no liability for ancillary costs incurred by the
                guest (e.g., flights, rental cars, or accommodation).
              </li>
              <li className="pl-5 border-l border-[#8b6f47]/40">
                <span className="font-medium text-[#4d3d33] block mb-1">
                  Our Service Guarantee:
                </span>
                In the highly unlikely event that a specific external partner
                (e.g., a chef or artisan) is unable to attend, Oasis maintains a
                "Plan B" protocol. If a suitable replacement is impossible and
                we must cancel, you will receive an immediate 100% refund
                alongside a complimentary gesture of goodwill.
              </li>
            </ul>
          </PolicySection>

          <PolicySection number="07" title="Health, Safety & Code of Conduct">
            <p>
              <strong>Health Declarations:</strong> The safety of our guests is
              paramount. Guests are strictly required to declare any food
              allergies, dietary restrictions, or severe medical conditions in
              writing at the time of booking. We manage this data with complete
              confidentiality.
            </p>
            <p className="mt-4">
              <strong>Medical Incidents:</strong> In the event of a medical
              emergency during an experience, our First-Aid equipped staff will
              immediately pause the activity. For severe cases, emergency
              services will be contacted and an Oasis representative will
              facilitate transport to a local clinic. Guests are responsible for
              any medical expenses incurred.
            </p>
            <p className="mt-4">
              <strong>Code of Conduct & Leave No Trace:</strong> Oasis operates
              on an ethos of profound respect for the Cretan land and local
              community. Guests must adhere to a "Leave No Trace" policy in
              nature. Furthermore, during wine tastings or pairing dinners, our
              hosts retain the undeniable right to politely refuse alcohol
              service to any guest who exceeds limits or disrupts the harmony of
              the group.
            </p>
          </PolicySection>

          <PolicySection number="08" title="Shop, Gift Cards & Vouchers">
            <p>
              <strong>Gift Cards & Vouchers:</strong> Gift cards are
              non-refundable and cannot be exchanged for cash, except where
              mandated by local law. If a booking exceeds the value of a gift
              card, the user must pay the remaining balance. Discount codes are
              generally for single-use and cannot be stacked unless explicitly
              stated.
            </p>
            <p className="mt-4">
              <strong>Online Shop:</strong> For physical goods purchased through
              our website, shipping costs and estimated delivery times are
              provided at checkout. Oasis is not liable for shipping delays
              caused by customs or external courier services. Return and
              exchange policies for physical products are detailed on their
              respective product pages.
            </p>
          </PolicySection>

          <PolicySection number="09" title="Intellectual Property">
            <p>
              All content on the Oasis website—including but not limited to
              text, photography, graphics, logos, video, audio, and underlying
              software—is the exclusive property of or licensed to Oasis. It is
              protected by Greek and international copyright and intellectual
              property laws.
            </p>
            <p className="mt-4">
              You may access and view the website for personal, non-commercial
              use only. You may not reproduce, distribute, modify, create
              derivative works from, or publicly display our content without our
              explicit, prior written consent. If you submit reviews,
              testimonials, or imagery to Oasis, you grant us a royalty-free,
              worldwide license to use that content for marketing and
              promotional purposes.
            </p>
          </PolicySection>

          <PolicySection number="10" title="Limitation of Liability">
            <p>
              Many of our experiences involve outdoor activities, rugged
              terrain, and participation in culinary or physical practices
              (e.g., hiking, cooking over fire). While we take every reasonable
              precaution to ensure a safe environment, you acknowledge that such
              activities involve inherent risks. We highly recommend that all
              guests secure comprehensive travel and medical insurance prior to
              their visit to Greece.
            </p>
            <p className="mt-4">
              To the fullest extent permitted by applicable law, Oasis, its
              founders, employees, and third-party partners shall not be liable
              for any indirect, incidental, special, consequential, or punitive
              damages arising out of or related to your use of the Services or
              participation in our experiences. Our maximum cumulative liability
              for any claim shall not exceed the total amount paid by you for
              the specific booking or product in question.
            </p>
          </PolicySection>

          <PolicySection number="11" title="Governing Law & Jurisdiction">
            <p>
              These Terms of Use, and any disputes arising directly or
              indirectly from them or from your participation in our
              experiences, shall be governed by and construed in accordance with
              the laws of the Hellenic Republic (Greece), without regard to its
              conflict-of-law principles.
            </p>
            <p className="mt-4">
              Any legal action or proceeding related to the Services shall be
              brought exclusively in the competent courts located in Chania,
              Crete, Greece.
            </p>
          </PolicySection>

          <PolicySection number="12" title="Contact Us">
            <p>
              If you have any questions regarding these terms, a specific
              booking policy, or require assistance with an existing
              reservation, please reach out to our concierge team:
            </p>
            <div className="mt-6 p-6 bg-white/40 border border-[#eadfce] rounded-2xl inline-block">
              <span className="block text-[10px] uppercase tracking-[0.2em] text-[#8b6f47] mb-2">
                Concierge & Support
              </span>
              <a
                href="mailto:info@youroasis.gr"
                className="text-lg font-serif text-[#4d3d33] hover:text-[#8b6f47] transition-colors block"
              >
                info@youroasis.gr
              </a>
            </div>
            <p className="mt-6 text-xs text-[#8f8272]">
              Please keep a copy of these Terms for your records. Your continued
              use of the Oasis website and services constitutes your ongoing
              agreement to these conditions.
            </p>
          </PolicySection>
        </div>
      </div>
    </main>
  );
}
