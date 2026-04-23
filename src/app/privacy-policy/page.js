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
    <div className="text-sm md:text-[15px] font-light leading-relaxed text-[#6b625a] space-y-5">
      {children}
    </div>
  </motion.section>
);

export default function PrivacyPolicyPage() {
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
              Privacy{" "}
              <span className="italic text-[#8b6f47] font-normal">Policy</span>
            </h1>
            <p className="text-base md:text-lg text-[#6b625a] font-light leading-relaxed max-w-xl">
              We respect your privacy and are committed to protecting your
              personal information. This document explains how we collect, use,
              and share your data across all Oasis experiences.
            </p>
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#8b7a6b] pt-4">
              Last updated: 23 September 2025
            </p>
          </header>
        </motion.div>

        {/* --- EDITORIAL CONTENT GRID --- */}
        <div className="relative border-b border-[#eadfce]">
          <PolicySection number="01" title="Who We Are & Scope">
            <p>
              This Privacy Policy applies to the Oasis website, booking
              platform, retreat and experience bookings, online shop,
              newsletter, and related services (collectively, the "Services").
            </p>
            <p>
              When we say "we", "us" or "Oasis", we refer to the operators of
              this website and the experiences offered through it, based in
              Greece. For the purposes of applicable data protection laws (such
              as the EU General Data Protection Regulation – GDPR), Oasis acts
              as the "data controller" for the personal data described in this
              Policy.
            </p>
            <p>
              By using our Services, you acknowledge that you have read and
              understood this Privacy Policy. If you do not agree, please
              refrain from using the Services.
            </p>
          </PolicySection>

          <PolicySection number="02" title="Data We Collect">
            <p>
              The data we collect depends on how you interact with us. We may
              collect the following categories of personal data:
            </p>
            <ul className="space-y-3 mt-4">
              <li className="pl-4 border-l border-[#8b6f47]/30">
                <span className="font-medium text-[#4d3d33]">
                  Identity & contact data:
                </span>{" "}
                name, surname, email address, phone number, country, and date of
                birth.
              </li>
              <li className="pl-4 border-l border-[#8b6f47]/30">
                <span className="font-medium text-[#4d3d33]">
                  Booking & experience data:
                </span>{" "}
                selected experience or retreat, dates, number of guests,
                composition of your group, preferences, notes, and check-in
                information.
              </li>
              <li className="pl-4 border-l border-[#8b6f47]/30">
                <span className="font-medium text-[#4d3d33]">
                  Account & authentication data:
                </span>{" "}
                login email, encrypted password, and account activity.
              </li>
              <li className="pl-4 border-l border-[#8b6f47]/30">
                <span className="font-medium text-[#4d3d33]">
                  Payment, billing & invoice data:
                </span>{" "}
                payment method details processed via our providers, billing
                details, invoice data, and transaction references.
              </li>
              <li className="pl-4 border-l border-[#8b6f47]/30">
                <span className="font-medium text-[#4d3d33]">
                  Corporate & B2B data:
                </span>{" "}
                company name, VAT number, contact person, budgets, purchase
                order numbers, and booking details.
              </li>
              <li className="pl-4 border-l border-[#8b6f47]/30">
                <span className="font-medium text-[#4d3d33]">
                  Technical & usage data:
                </span>{" "}
                IP address, browser type, device information, and interactions
                with the website collected via cookies.
              </li>
            </ul>
            <p className="mt-4">
              We do not intentionally collect sensitive categories of personal
              data unless you voluntarily share it (e.g., dietary restrictions
              or accessibility needs) to help us tailor your experience safely.
            </p>
          </PolicySection>

          <PolicySection number="03" title="How We Collect">
            <p>We collect personal data in several ways:</p>
            <ul className="list-disc list-outside ml-4 space-y-2 mt-4 text-[#6b625a] marker:text-[#d6c6b2]">
              <li>
                Directly from you when you make a booking, purchase a product,
                create an account, subscribe to the newsletter, or schedule a
                call.
              </li>
              <li>
                Automatically when you use our website, via cookies, server logs
                and similar technologies.
              </li>
              <li>
                From third-party services we use (for example, payment
                processors or email delivery platforms), but only to the extent
                necessary to provide the Services.
              </li>
            </ul>
          </PolicySection>

          <PolicySection number="04" title="Purposes & Legal Bases">
            <p>
              We process your personal data only where we have a valid legal
              basis under applicable law, such as:
            </p>
            <div className="space-y-6 mt-6">
              <div>
                <strong className="text-[#4d3d33] block mb-2">Contract</strong>
                <p>
                  To perform a contract with you. For example: processing
                  bookings, issuing invoices, and communicating regarding
                  availability or changes.
                </p>
              </div>
              <div>
                <strong className="text-[#4d3d33] block mb-2">
                  Legitimate Interests
                </strong>
                <p>
                  Improving the website, managing our relationship with you,
                  preventing fraud, and running internal analytics.
                </p>
              </div>
              <div>
                <strong className="text-[#4d3d33] block mb-2">
                  Legal Obligation
                </strong>
                <p>
                  Keeping invoices, payment records and booking data for tax and
                  accounting requirements, or responding to lawful requests from
                  authorities.
                </p>
              </div>
              <div>
                <strong className="text-[#4d3d33] block mb-2">Consent</strong>
                <p>
                  Sending newsletters, marketing communications, or using
                  analytics cookies. You may withdraw consent at any time.
                </p>
              </div>
            </div>
          </PolicySection>

          <PolicySection number="05" title="Cookies & Technologies">
            <p>
              We use cookies and similar technologies to operate and improve our
              website. Cookies are small text files stored on your device that
              help us recognize your browser and remember certain information.
            </p>
            <ul className="list-disc list-outside ml-4 space-y-2 mt-4 text-[#6b625a] marker:text-[#d6c6b2]">
              <li>
                <strong>Strictly necessary:</strong> for basic site
                functionality and security.
              </li>
              <li>
                <strong>Performance & analytics:</strong> to understand how the
                site is used.
              </li>
              <li>
                <strong>Functional:</strong> to remember your preferences.
              </li>
            </ul>
            <p className="mt-4">
              You can control cookies through your browser settings. Disabling
              them may affect website functionality.
            </p>
          </PolicySection>

          <PolicySection number="06" title="Booking & Payments">
            <p>
              When you make a booking or purchase, we process the necessary data
              to reserve places for you, apply correct pricing, process payments
              securely, and issue receipts.
            </p>
            <p>
              Card payments are processed by external payment providers. We do
              not store your full card details on our own servers. Tokens or
              references may be stored solely to link payments to bookings or
              refunds.
            </p>
          </PolicySection>

          <PolicySection number="07" title="Gift Cards & Vouchers">
            <p>
              If you purchase or redeem a gift card, discount code, or voucher,
              we process data such as the code, value, currency, and associated
              email addresses. This prevents misuse and ensures tax compliance.
            </p>
          </PolicySection>

          <PolicySection number="08" title="Corporate & Groups">
            <p>
              For corporate or group bookings, we may process additional data
              about your organization (VAT number, billing address, contact
              person) to prepare proposals, manage bookings, and issue invoices.
            </p>
          </PolicySection>

          <PolicySection number="09" title="Newsletter & Marketing">
            <p>
              When you subscribe to our journal, we process your email address
              to send updates about new experiences. We may track general
              engagement (opens or clicks) to ensure our content is relevant.
            </p>
            <p>
              You can unsubscribe at any time via the link in our emails. Note
              that essential service communications regarding your bookings will
              still be sent.
            </p>
          </PolicySection>

          <PolicySection number="10" title="Sharing Data">
            <p>
              We do not sell or rent your personal data. We may share your data
              with:
            </p>
            <ul className="list-disc list-outside ml-4 space-y-2 mt-4 text-[#6b625a] marker:text-[#d6c6b2]">
              <li>
                <strong>Service providers:</strong> hosting providers, payment
                processors, email delivery services, and accountants.
              </li>
              <li>
                <strong>Professional advisors:</strong> lawyers or tax
                consultants for compliance.
              </li>
              <li>
                <strong>Authorities:</strong> where legally required to protect
                rights.
              </li>
            </ul>
          </PolicySection>

          <PolicySection number="11" title="International Transfers">
            <p>
              Our servers and some service providers may be located outside your
              country, including outside the European Economic Area (EEA). We
              ensure adequate protection is in place, such as standard
              contractual clauses, for any international transfers.
            </p>
          </PolicySection>

          <PolicySection number="12" title="Data Retention">
            <p>
              We retain personal data only for as long as necessary. Booking and
              invoice data may be kept for several years for tax requirements.
              Newsletter data is kept until you unsubscribe. When no longer
              needed, data is securely deleted or anonymized.
            </p>
          </PolicySection>

          <PolicySection number="13" title="Security">
            <p>
              We implement appropriate technical and organizational measures to
              protect your personal data against unlawful destruction, loss, or
              unauthorized access. This includes secure hosting, encryption, and
              access controls. However, no internet transmission is completely
              secure.
            </p>
          </PolicySection>

          <PolicySection number="14" title="Your Rights">
            <p>
              Depending on where you live, you may have the right to access,
              rectify, erase, or restrict the processing of your data. You may
              also request data portability or withdraw your consent.
            </p>
            <p>
              To exercise these rights, please contact us. You also have the
              right to lodge a complaint with your local data protection
              authority.
            </p>
          </PolicySection>

          <PolicySection number="15" title="Children's Privacy">
            <p>
              Our Services are primarily intended for adults. We do not
              knowingly collect personal data from children without appropriate
              consent from a parent or legal guardian.
            </p>
          </PolicySection>

          <PolicySection number="16" title="Policy Changes">
            <p>
              We may update this Privacy Policy from time to time. When we do,
              we will adjust the "Last updated" date. We encourage you to review
              this page periodically.
            </p>
          </PolicySection>

          <PolicySection number="17" title="Contact Us">
            <p>
              If you have any questions, concerns, or requests regarding this
              Privacy Policy, please reach out to us:
            </p>
            <div className="mt-4 p-6 bg-white/40 border border-[#eadfce] rounded-2xl inline-block">
              <span className="block text-[10px] uppercase tracking-[0.2em] text-[#8b6f47] mb-2">
                Email
              </span>
              <a
                href="mailto:info@youroasis.gr"
                className="text-lg font-serif text-[#4d3d33] hover:text-[#8b6f47] transition-colors"
              >
                info@youroasis.gr
              </a>
            </div>
          </PolicySection>
        </div>
      </div>
    </main>
  );
}
