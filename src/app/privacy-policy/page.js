"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicyPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#f4f1ec] px-6 py-16 md:py-20 flex flex-col items-center text-[#4a3f35]">
      <div className="w-full max-w-5xl bg-white/95 p-7 md:p-10 lg:p-12 rounded-3xl shadow-2xl border border-[#e0dcd4] relative overflow-hidden">
        {/* Decorative background */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
        >
          <div className="absolute -top-20 -right-10 h-40 w-40 rounded-full bg-[#f0e9dd] blur-3xl" />
          <div className="absolute bottom-[-3rem] left-[-3rem] h-32 w-32 rounded-full bg-[#e6dccb] blur-3xl" />
        </div>

        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="relative z-10 mb-8 inline-flex items-center gap-2 text-[#8b6f47] hover:text-[#5a4a3f] text-sm font-medium"
        >
          <ArrowLeft size={18} />
          Back
        </button>

        {/* Title + meta */}
        <header className="relative z-10 mb-10 text-center">
          <h1 className="mt-4 text-3xl md:text-4xl lg:text-5xl font-serif font-semibold text-[#5a4a3f] leading-tight">
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-[#7b6d5f] max-w-2xl mx-auto">
            We respect your privacy and are committed to protecting your
            personal information. This Privacy Policy explains how we collect,
            use, store and share your data when you visit our website, make a
            booking, join a retreat or private gathering, purchase products, or
            otherwise interact with Oasis.
          </p>
          <p className="mt-2 text-xs text-[#8f8272]">
            Last updated: 23 September 2025
          </p>
        </header>

        {/* Content */}
        <div className="relative z-10 space-y-10 text-[14px] leading-relaxed">
          {/* 1. Who we are */}
          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2 text-[#7a644c]">
              1. Who We Are &amp; Scope of This Policy
            </h2>
            <p>
              This Privacy Policy applies to the Oasis website, booking
              platform, retreat and experience bookings, online shop,
              newsletter, and related services (collectively, the
              &quot;Services&quot;).
            </p>
            <p className="mt-2">
              When we say &quot;we&quot;, &quot;us&quot; or &quot;Oasis&quot;,
              we refer to the operators of this website and the experiences
              offered through it, based in Greece. For the purposes of
              applicable data protection laws (such as the EU General Data
              Protection Regulation &ndash; GDPR), Oasis acts as the &quot;data
              controller&quot; for the personal data described in this Policy.
            </p>
            <p className="mt-2">
              By using our Services, you acknowledge that you have read and
              understood this Privacy Policy. If you do not agree, please
              refrain from using the Services.
            </p>
          </section>

          {/* 2. Data we collect */}
          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2 text-[#7a644c]">
              2. What Personal Data We Collect
            </h2>
            <p>
              The data we collect depends on how you interact with us. We may
              collect the following categories of personal data:
            </p>
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li>
                <span className="font-semibold">
                  Identity &amp; contact data
                </span>
                : name, surname, email address, phone number, country, and
                (where relevant) date of birth.
              </li>
              <li>
                <span className="font-semibold">
                  Booking &amp; experience data
                </span>
                : selected experience or retreat, dates and schedule slots,
                number of guests, composition of your group (e.g.
                adults/children), preferences, notes you share with us, booking
                status, check-in and participation information.
              </li>
              <li>
                <span className="font-semibold">
                  Account &amp; authentication data
                </span>
                (if you create an account): login email, encrypted password,
                account settings, and account activity relating to bookings or
                purchases.
              </li>
              <li>
                <span className="font-semibold">
                  Payment, billing &amp; invoice data
                </span>
                : payment method details processed via our payment providers,
                billing details, invoice data (such as name, address, VAT
                details, invoice numbers, amounts, currency, status), and
                payment/transaction references or refunds.
              </li>
              <li>
                <span className="font-semibold">
                  Gift cards, discount codes &amp; vouchers
                </span>
                : gift card codes, remaining balances, currency, discount codes
                or vouchers you use, redemption history, and in some cases the
                assigned recipient or corporate company.
              </li>
              <li>
                <span className="font-semibold">Corporate &amp; B2B data</span>:
                company name, VAT number, contact person, email, phone, budgets,
                purchase order numbers, invoice numbers, and booking details for
                corporate experiences or group events.
              </li>
              <li>
                <span className="font-semibold">Shop &amp; order data</span> (if
                you buy products): items ordered, quantities, price, shipping
                address and billing details, order status, and related payment
                information.
              </li>
              <li>
                <span className="font-semibold">Communication data</span>:
                messages you send via our contact forms, &quot;Schedule a
                call&quot; or email, support notes, feedback, reviews or survey
                responses, and any information you voluntarily provide in those
                contexts.
              </li>
              <li>
                <span className="font-semibold">
                  Newsletter &amp; marketing preferences
                </span>
                : your subscription status, email address, newsletter engagement
                (e.g. opens, clicks) where permitted by law, and your opt-in or
                opt-out choices.
              </li>
              <li>
                <span className="font-semibold">
                  Technical &amp; usage data
                </span>
                : IP address, browser type and version, device information,
                operating system, pages viewed, time and date of visits, and how
                you interact with the website (e.g. clicks, scrolls, time on
                page). This is often collected via cookies and similar
                technologies.
              </li>
            </ul>
            <p className="mt-2">
              We do not intentionally collect sensitive categories of personal
              data (such as health information) unless you choose to share it
              with us in the context of tailoring your experience (for example,
              dietary restrictions, allergies or accessibility needs). In that
              case, we will use such data only to support your experience and
              with appropriate safeguards.
            </p>
          </section>

          {/* 3. How we collect data */}
          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2 text-[#7a644c]">
              3. How We Collect Your Data
            </h2>
            <p>We collect personal data in several ways:</p>
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li>
                Directly from you when you make a booking, purchase a product,
                create an account, subscribe to the newsletter, schedule a call,
                or contact us.
              </li>
              <li>
                Automatically when you use our website, via cookies, server logs
                and similar technologies.
              </li>
              <li>
                From third-party services we use (for example, payment
                processors, email delivery platforms, or analytics tools), but
                only to the extent necessary to provide the Services and in line
                with their privacy practices.
              </li>
            </ul>
          </section>

          {/* 4. Purposes & legal bases */}
          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2 text-[#7a644c]">
              4. Why We Use Your Data (Purposes &amp; Legal Bases)
            </h2>
            <p>
              We process your personal data only where we have a valid legal
              basis under applicable law, such as:
            </p>
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li>
                <span className="font-semibold">Contract</span> &ndash; to
                perform a contract with you or to take steps at your request
                before entering into a contract. For example:
                <ul className="mt-1 ml-5 list-[circle] space-y-1">
                  <li>Processing and managing your bookings and orders.</li>
                  <li>
                    Issuing booking confirmations, invoices and payment
                    receipts.
                  </li>
                  <li>
                    Communicating with you about dates, availability, changes or
                    special requests.
                  </li>
                </ul>
              </li>
              <li>
                <span className="font-semibold">Legitimate interests</span>{" "}
                &ndash; where necessary for our legitimate interests and not
                overridden by your rights. For example:
                <ul className="mt-1 ml-5 list-[circle] space-y-1">
                  <li>Improving the website and our Services.</li>
                  <li>
                    Managing our relationship with you (e.g. tailored offers to
                    existing guests, asking for feedback).
                  </li>
                  <li>
                    Preventing fraud, misuse of discount codes, or abuse of our
                    booking system.
                  </li>
                  <li>
                    Running internal analytics on bookings, gift cards or
                    voucher usage, and shop performance.
                  </li>
                </ul>
              </li>
              <li>
                <span className="font-semibold">Legal obligation</span> &ndash;
                to comply with laws, such as:
                <ul className="mt-1 ml-5 list-[circle] space-y-1">
                  <li>
                    Keeping invoices, payment records and booking data for tax
                    and accounting requirements.
                  </li>
                  <li>
                    Responding to lawful requests from public authorities or
                    courts.
                  </li>
                </ul>
              </li>
              <li>
                <span className="font-semibold">Consent</span> &ndash; where you
                have given us explicit permission. For example:
                <ul className="mt-1 ml-5 list-[circle] space-y-1">
                  <li>
                    Sending you newsletters and broader marketing
                    communications.
                  </li>
                  <li>
                    Using certain cookies or analytics tools beyond what is
                    strictly necessary.
                  </li>
                </ul>
              </li>
            </ul>
            <p className="mt-2">
              Where we rely on consent, you may withdraw it at any time, without
              affecting the lawfulness of processing based on consent before
              withdrawal.
            </p>
          </section>

          {/* 5. Cookies */}
          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2 text-[#7a644c]">
              5. Cookies &amp; Similar Technologies
            </h2>
            <p>
              We use cookies and similar technologies to operate and improve our
              website. Cookies are small text files stored on your device that
              help us recognize your browser and remember certain information.
            </p>
            <p className="mt-2">We may use, for example:</p>
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li>
                <span className="font-semibold">
                  Strictly necessary cookies
                </span>{" "}
                for basic site functionality, security and booking flows.
              </li>
              <li>
                <span className="font-semibold">
                  Performance &amp; analytics cookies
                </span>{" "}
                to understand how the site is used, which pages are visited and
                how we can improve the experience.
              </li>
              <li>
                <span className="font-semibold">Functional cookies</span> to
                remember your preferences, such as language or region.
              </li>
            </ul>
            <p className="mt-2">
              You can control cookies through your browser settings. If you
              disable or block certain cookies, parts of the website may not
              function properly.
            </p>
          </section>

          {/* 6. Bookings, payments, invoices */}
          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2 text-[#7a644c]">
              6. Booking, Payment &amp; Invoicing Data
            </h2>
            <p>
              When you make a booking or purchase, we process the necessary data
              to:
            </p>
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li>Reserve places for you and your group on a specific date.</li>
              <li>
                Apply the correct pricing, discount codes, vouchers or gift
                cards.
              </li>
              <li>
                Process payments through secure payment providers (for example,
                card processors or bank transfer partners).
              </li>
              <li>
                Issue invoices, receipts and, if applicable, credit notes or
                refunds.
              </li>
            </ul>
            <p className="mt-2">
              Card payments are typically processed by external payment
              providers. We do not store your full card details on our own
              servers; instead, tokens or references provided by the payment
              providers may be stored so we can link payments to bookings,
              invoices or refunds.
            </p>
          </section>

          {/* 7. Gift cards, discount codes, vouchers */}
          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2 text-[#7a644c]">
              7. Gift Cards, Discount Codes &amp; Vouchers
            </h2>
            <p>
              If you purchase or redeem a gift card, discount code or voucher,
              we will process data such as the code, value, currency, associated
              bookings or orders, and, where applicable, the email addresses or
              names of purchasers and recipients.
            </p>
            <p className="mt-2">
              We use this data to issue, track and manage redemptions, prevent
              misuse, and comply with tax and accounting obligations.
            </p>
          </section>

          {/* 8. Corporate & B2B */}
          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2 text-[#7a644c]">
              8. Corporate &amp; Group Bookings
            </h2>
            <p>
              For corporate or group bookings, we may process additional data
              about your company or organization (such as VAT number, billing
              address, contact person, budgets and invoice references). This
              data is used to prepare proposals, manage bookings, allocate
              credits, and issue invoices and receipts.
            </p>
          </section>

          {/* 9. Newsletter & marketing */}
          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2 text-[#7a644c]">
              9. Newsletter &amp; Marketing Communications
            </h2>
            <p>
              You may choose to subscribe to our newsletter or receive updates
              about new experiences, retreats, shop items and special offers.
              When you do so, we process your email address and, in some cases,
              your name and language preferences.
            </p>
            <p className="mt-2">
              We may track general engagement (e.g. email opens or link clicks)
              to understand which content is most relevant. You can unsubscribe
              at any time by using the link in our emails or by contacting us
              directly.
            </p>
            <p className="mt-2">
              Even if you unsubscribe from marketing emails, we may still send
              you essential service communications about your bookings,
              payments, or legal matters.
            </p>
          </section>

          {/* 10. Sharing data */}
          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2 text-[#7a644c]">
              10. How We Share Your Data
            </h2>
            <p>
              We do not sell or rent your personal data. We may share your data
              with:
            </p>
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li>
                <span className="font-semibold">Service providers</span> who
                help us operate the Services, such as hosting providers, payment
                processors, email delivery services, analytics tools, booking
                management tools and accountants.
              </li>
              <li>
                <span className="font-semibold">Professional advisors</span>{" "}
                such as lawyers or tax consultants, where necessary for
                compliance or to protect our legal rights.
              </li>
              <li>
                <span className="font-semibold">
                  Public authorities or courts
                </span>{" "}
                where we are legally required to do so or where necessary to
                protect our rights or the rights of others.
              </li>
            </ul>
            <p className="mt-2">
              When we share data with third-party service providers, we do so
              under data protection agreements that require them to handle your
              data securely and only for the specified purposes.
            </p>
          </section>

          {/* 11. International transfers */}
          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2 text-[#7a644c]">
              11. International Data Transfers
            </h2>
            <p>
              Our servers and some of our service providers may be located in
              different countries. This means that your data may be transferred
              and processed outside of your country of residence, including
              outside the European Economic Area (EEA).
            </p>
            <p className="mt-2">
              Where we transfer personal data outside the EEA, we take steps to
              ensure that an adequate level of protection is in place, such as
              using the European Commission&apos;s standard contractual clauses
              or relying on decisions of adequacy, where available.
            </p>
          </section>

          {/* 12. Retention */}
          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2 text-[#7a644c]">
              12. How Long We Keep Your Data
            </h2>
            <p>
              We retain personal data only for as long as necessary to fulfill
              the purposes described in this Policy, including for legal,
              accounting, or reporting requirements. Retention periods may vary
              depending on the type of data and the context.
            </p>
            <p className="mt-2">
              For example, booking and invoice data may be kept for several
              years in accordance with tax and accounting laws. Newsletter
              subscription data is generally kept for as long as you remain
              subscribed (and for a limited period afterward to record your
              opt-out). Data relating to support enquiries is usually kept for a
              reasonable period to follow up on your request and improve our
              services.
            </p>
            <p className="mt-2">
              When data is no longer needed, we will either delete it securely
              or anonymize it so that it can no longer be linked to you.
            </p>
          </section>

          {/* 13. Security */}
          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2 text-[#7a644c]">
              13. How We Protect Your Data
            </h2>
            <p>
              We implement appropriate technical and organizational measures to
              protect your personal data against accidental or unlawful
              destruction, loss, alteration, unauthorized disclosure or access.
              These measures may include:
            </p>
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li>
                Use of secure hosting environments and encryption in transit.
              </li>
              <li>Access controls and authentication for internal systems.</li>
              <li>Regular updates and security patches to our software.</li>
              <li>
                Limiting access to your data to staff and service providers who
                need it for legitimate purposes.
              </li>
            </ul>
            <p className="mt-2">
              However, no method of transmission over the internet or electronic
              storage is completely secure. While we strive to protect your
              personal data, we cannot guarantee absolute security.
            </p>
          </section>

          {/* 14. Your rights */}
          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2 text-[#7a644c]">
              14. Your Rights
            </h2>
            <p>
              Depending on where you live and subject to certain conditions, you
              may have the following rights regarding your personal data:
            </p>
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li>
                <span className="font-semibold">Right of access</span> &ndash;
                to obtain confirmation as to whether we process your personal
                data and to receive a copy.
              </li>
              <li>
                <span className="font-semibold">Right to rectification</span>{" "}
                &ndash; to request correction of inaccurate or incomplete data.
              </li>
              <li>
                <span className="font-semibold">Right to erasure</span>{" "}
                (&quot;right to be forgotten&quot;) &ndash; to request deletion
                of your data in certain circumstances.
              </li>
              <li>
                <span className="font-semibold">Right to restriction</span>{" "}
                &ndash; to request that we restrict the processing of your data
                in certain cases.
              </li>
              <li>
                <span className="font-semibold">Right to data portability</span>{" "}
                &ndash; to receive your data in a structured, commonly used and
                machine-readable format and to transmit it to another
                controller, where technically feasible.
              </li>
              <li>
                <span className="font-semibold">Right to object</span> &ndash;
                to object to certain types of processing, such as direct
                marketing or processing based on legitimate interests.
              </li>
              <li>
                <span className="font-semibold">Right to withdraw consent</span>{" "}
                &ndash; where processing is based on consent, you can withdraw
                your consent at any time.
              </li>
            </ul>
            <p className="mt-2">
              To exercise any of these rights, please contact us using the
              details in the &quot;Contact Us&quot; section below. We may need
              to verify your identity before responding. You also have the right
              to lodge a complaint with your local data protection authority if
              you believe your data protection rights have been infringed.
            </p>
          </section>

          {/* 15. Children */}
          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2 text-[#7a644c]">
              15. Children&apos;s Privacy
            </h2>
            <p>
              Our Services are primarily intended for adults. We do not
              knowingly collect personal data from children without appropriate
              consent from a parent or legal guardian, where required by law. If
              you believe that a child has provided us with personal data
              without such consent, please contact us and we will take steps to
              delete it.
            </p>
          </section>

          {/* 16. Changes */}
          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2 text-[#7a644c]">
              16. Changes to This Privacy Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time to reflect
              changes in our Services, legal requirements or privacy practices.
              When we do, we will post the updated version on this page and
              adjust the &quot;Last updated&quot; date at the top.
            </p>
            <p className="mt-2">
              We encourage you to review this page periodically to stay informed
              about how we protect your data. If we make material changes, we
              may also notify you by email or through the website.
            </p>
          </section>

          {/* 17. Contact */}
          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2 text-[#7a644c]">
              17. How to Contact Us
            </h2>
            <p>
              If you have any questions, concerns or requests regarding this
              Privacy Policy or our handling of your personal data, you can
              contact us at:
            </p>
            <ul className="mt-2 list-none space-y-1">
              <li>
                Email:&nbsp;
                <a
                  href="mailto:info@youroasis.gr"
                  className="text-[#8b6f47] underline underline-offset-2 hover:text-[#5a4a3f]"
                >
                  info@youroasis.gr
                </a>
              </li>
              <li>
                Or via our contact form at{" "}
                <a
                  href="/contact"
                  className="text-[#8b6f47] underline underline-offset-2 hover:text-[#5a4a3f]"
                >
                  youroasis.gr/contact
                </a>
                .
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
