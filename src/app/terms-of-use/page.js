"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function TermsPage() {
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
            Terms of Use
          </h1>
          <p className="mt-3 text-sm text-[#7b6d5f] max-w-2xl mx-auto">
            Please read these Terms of Use carefully. By accessing or using our
            website, booking experiences, purchasing products, or interacting
            with our services, you agree to be bound by these terms.
          </p>
          <p className="mt-2 text-xs text-[#8f8272]">
            Last updated: 23 September 2025
          </p>
        </header>

        {/* Content */}
        <div className="relative z-10 space-y-10 text-[14px] leading-relaxed">
          {/* Intro / Overview */}
          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2 text-[#7a644c]">
              1. Who We Are
            </h2>
            <p>
              These Terms of Use (&quot;Terms&quot;) govern your use of the
              Oasis website, booking platform, online shop, and related services
              (collectively, the &quot;Services&quot;). References to
              &quot;we&quot;, &quot;us&quot; or &quot;Oasis&quot; refer to the
              operators of this website and the experiences offered through it.
            </p>
            <p className="mt-2">
              Our Services include, among other things, the ability to:
            </p>
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li>Browse and book agrotourism and wellness experiences.</li>
              <li>Join retreats and private gatherings in and around Crete.</li>
              <li>
                Purchase gift cards, apply discount codes and vouchers where
                available.
              </li>
              <li>Purchase products via our online shop.</li>
              <li>Receive invoices, confirmations and other communications.</li>
            </ul>
          </section>

          {/* Acceptance & Changes */}
          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2 text-[#7a644c]">
              2. Acceptance of Terms
            </h2>
            <p>
              By accessing or using the Services, you confirm that you are at
              least 18 years old (or the age of legal majority in your
              jurisdiction) and that you have read, understood, and agreed to be
              bound by these Terms. If you do not agree with these Terms, you
              must not use our Services.
            </p>
            <p className="mt-2">
              We may update these Terms from time to time. Changes become
              effective when we post the updated version on this page, with the
              &quot;Last updated&quot; date adjusted accordingly. Your continued
              use of the Services after such changes constitutes your acceptance
              of the updated Terms.
            </p>
          </section>

          {/* Scope & Relationship to Other Policies */}
          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2 text-[#7a644c]">
              3. Scope of These Terms & Other Policies
            </h2>
            <p>
              These Terms apply to your use of our website, booking system,
              online shop, email communications, and any other features we make
              available. Additional terms may apply to specific experiences,
              retreats, corporate bookings, promotions, or products. In the
              event of a conflict, the more specific terms will prevail for that
              particular service.
            </p>
            <p className="mt-2">
              Your use of the Services is also governed by our&nbsp;
              <a
                href="/privacy"
                className="text-[#8b6f47] underline underline-offset-2 hover:text-[#5a4a3f]"
              >
                Privacy Policy
              </a>
              , which explains how we collect, use and protect your personal
              data, including data processed in connection with bookings,
              payments, gift cards, invoices, and newsletters.
            </p>
          </section>

          {/* Accounts */}
          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2 text-[#7a644c]">
              4. User Accounts & Security
            </h2>
            <p>
              Some parts of the Services may require or allow you to create an
              account. When you create an account, you agree to:
            </p>
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li>Provide accurate, current and complete information.</li>
              <li>
                Keep your login credentials confidential and not share them with
                others.
              </li>
              <li>
                Notify us promptly at{" "}
                <a
                  href="mailto:info@youroasis.gr"
                  className="text-[#8b6f47] underline underline-offset-2 hover:text-[#5a4a3f]"
                >
                  info@youroasis.gr
                </a>{" "}
                if you suspect any unauthorized use of your account.
              </li>
            </ul>
            <p className="mt-2">
              You are responsible for all activities that occur under your
              account. We reserve the right to suspend or terminate your account
              at our discretion if we reasonably believe that these Terms have
              been violated or that your account has been compromised.
            </p>
          </section>

          {/* Acceptable Use */}
          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2 text-[#7a644c]">
              5. Acceptable Use of the Website
            </h2>
            <p>You agree not to use the Services in any way that:</p>
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li>
                Violates any applicable law, regulation, or third-party right.
              </li>
              <li>
                Is harmful, abusive, harassing, defamatory, obscene or otherwise
                objectionable.
              </li>
              <li>
                Attempts to interfere with or disrupt the integrity or
                performance of the Services (including security testing without
                permission).
              </li>
              <li>
                Attempts to access data not intended for you, or to circumvent
                any security or access controls.
              </li>
              <li>
                Involves automated scraping, harvesting or extraction of data
                (except where explicitly allowed by us).
              </li>
            </ul>
          </section>

          {/* Experiences & Bookings */}
          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2 text-[#7a644c]">
              6. Experiences, Retreats & Bookings
            </h2>
            <p>
              Through our booking system, you may reserve places for experiences
              and retreats (each a &quot;Booking&quot;). The details of each
              offering, including the description, duration, location, and
              indicative pricing, are displayed on the relevant experience page.
            </p>
            <p className="mt-2">
              When you submit a booking request, you may be required to provide
              information such as:
            </p>
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li>
                Experience selection, date or schedule slot, and number of
                guests (adults and, where applicable, children).
              </li>
              <li>
                Primary contact details and any relevant notes or preferences.
              </li>
              <li>
                Payment details and any discount codes, gift cards, or vouchers.
              </li>
            </ul>
            <p className="mt-2">
              Your booking is not confirmed until you receive a written
              confirmation (for example, via email) from us. We reserve the
              right to reject or cancel a booking request (for example, if a
              schedule slot is no longer available, the experience is cancelled,
              or there is an error in pricing or description).
            </p>
          </section>

          {/* Pricing & Payments */}
          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2 text-[#7a644c]">
              7. Prices, Currency & Payments
            </h2>
            <p>
              Prices for experiences, retreats, shop products, and other
              services are shown on the website or communicated to you in
              writing. Unless otherwise stated, prices are expressed in Euros
              (EUR) and include applicable taxes where required by law.
            </p>
            <p className="mt-2">
              We may support various payment methods, such as card payments,
              bank transfers, cash on site (for certain services), gift card
              redemptions, or vouchers. The available methods will be indicated
              to you at the time of booking or checkout.
            </p>
            <p className="mt-2">
              You authorize us and our payment providers to charge the payment
              method you select for the total amount displayed (including any
              applicable taxes, fees, and discounts). Invoices or receipts may
              be issued electronically and linked to your booking or purchase.
            </p>
          </section>

          {/* Cancellation & Changes */}
          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2 text-[#7a644c]">
              8. Cancellations, Changes & No-Shows
            </h2>
            <p>
              Our cancellation and change policies may vary depending on the
              specific experience, retreat, private gathering, or corporate
              arrangement. The applicable policy will be displayed during the
              booking process or communicated in your confirmation.
            </p>
            <p className="mt-2">
              Where not otherwise specified, the following general principles
              apply:
            </p>
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li>
                <span className="font-semibold">Guest cancellations:</span>{" "}
                Cancellations must be requested in writing (for example, via
                email or our contact form). Eligibility for refunds or credits
                depends on the timing of your cancellation relative to the
                scheduled experience and on the applicable policy.
              </li>
              <li>
                <span className="font-semibold">
                  Changes to dates or names:
                </span>{" "}
                We will do our best to accommodate reasonable change requests,
                but availability cannot be guaranteed.
              </li>
              <li>
                <span className="font-semibold">No-shows:</span> If you or your
                group fail to attend a scheduled experience without prior
                notice, we may treat this as a last-minute cancellation, and no
                refund may be provided.
              </li>
              <li>
                <span className="font-semibold">Changes by us:</span> In rare
                cases (for example, due to weather, safety concerns, or
                minimum-group requirements), we may need to change or cancel an
                experience. In such cases, we will offer you an alternative date
                or, where appropriate, a refund or credit.
              </li>
            </ul>
          </section>

          {/* Gift Cards */}
          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2 text-[#7a644c]">
              9. Gift Cards
            </h2>
            <p>
              We may issue gift cards that can be used as a form of payment for
              eligible experiences, retreats or other services, subject to the
              conditions stated at the time of purchase.
            </p>
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li>
                Gift cards are typically issued in a fixed currency and amount
                and may have an expiry date communicated at the time of
                purchase.
              </li>
              <li>
                Gift cards are not redeemable for cash and are non-refundable,
                except where required by law.
              </li>
              <li>
                If the cost of a booking exceeds the value of the gift card, you
                must pay the remaining balance. If the cost is lower, any
                remaining value may stay on the card until expiry, where
                applicable.
              </li>
              <li>
                You are responsible for keeping gift card codes safe. We are not
                liable for lost, stolen or misused codes once issued.
              </li>
            </ul>
          </section>

          {/* Discount Codes & Vouchers */}
          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2 text-[#7a644c]">
              10. Discount Codes & Vouchers
            </h2>
            <p>
              From time to time, we may issue promotional discount codes or
              personal vouchers. These may be linked to specific campaigns,
              experiences, users, or time periods.
            </p>
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li>
                Each code or voucher will specify its validity period,
                applicable experiences or products, and any minimum spend or
                usage limitations.
              </li>
              <li>
                Codes are generally for one-time use per person unless stated
                otherwise and cannot be exchanged for cash.
              </li>
              <li>
                Only one discount or voucher may usually be applied per booking
                or order, unless we explicitly state that stacking is allowed.
              </li>
              <li>
                We reserve the right to refuse, cancel or adjust redemptions if
                we reasonably believe a code or voucher has been misused or
                obtained fraudulently.
              </li>
            </ul>
          </section>

          {/* Corporate */}
          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2 text-[#7a644c]">
              11. Corporate & Group Bookings
            </h2>
            <p>
              We may offer tailored experiences for companies, teams, and other
              organizations, which can involve separate proposals, budgets,
              credits, and invoicing.
            </p>
            <p className="mt-2">
              Corporate bookings may be subject to additional written terms
              covering, for example, payment schedules, cancellation windows,
              participant numbers, and invoicing details. If there is a conflict
              between those specific terms and these Terms of Use, the specific
              terms for your corporate booking will prevail for that
              arrangement.
            </p>
          </section>

          {/* Online Shop */}
          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2 text-[#7a644c]">
              12. Online Shop & Products
            </h2>
            <p>
              Our online shop may offer products such as food items, clothing,
              and other goods. Product descriptions, prices and availability are
              shown on the relevant product pages.
            </p>
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li>
                We do our best to ensure that product images and descriptions
                are accurate, but minor variations in colour, size or packaging
                may occur.
              </li>
              <li>
                Shipping options, costs, and estimated delivery times are shown
                at checkout or on the shop pages. Actual delivery times may vary
                due to factors outside our control.
              </li>
              <li>
                Any return or exchange options will be detailed in a separate
                returns policy or on the product page, where applicable.
              </li>
            </ul>
          </section>

          {/* Intellectual Property */}
          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2 text-[#7a644c]">
              13. Intellectual Property
            </h2>
            <p>
              All content on the website and within the Services—including text,
              images, graphics, logos, videos, audio, design elements, and
              underlying software—is owned by or licensed to Oasis and is
              protected by copyright, trade mark and other intellectual property
              laws.
            </p>
            <p className="mt-2">
              You may view and use the website for your personal, non-commercial
              use only. You must not copy, reproduce, modify, distribute,
              publicly display, or create derivative works from our content
              without our prior written consent, except as permitted by
              applicable law.
            </p>
          </section>

          {/* User Content & Reviews */}
          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2 text-[#7a644c]">
              14. Reviews, Feedback & User Content
            </h2>
            <p>
              If you submit reviews, feedback, testimonials, images, or other
              content (&quot;User Content&quot;) to us or the website, you grant
              us a non-exclusive, worldwide, royalty-free licence to use,
              reproduce, adapt, publish and display that content in connection
              with our Services and marketing, in accordance with applicable
              law.
            </p>
            <p className="mt-2">
              You are responsible for ensuring that your User Content does not
              infringe third-party rights or violate any law. We may remove or
              edit User Content at our discretion.
            </p>
          </section>

          {/* Data Protection */}
          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2 text-[#7a644c]">
              15. Data Protection & Privacy
            </h2>
            <p>
              We process personal data in connection with bookings, payments,
              invoices, gift cards, newsletters and account management. This
              includes information such as your name, contact details, booking
              history, and, where necessary, limited payment-related details.
            </p>
            <p className="mt-2">
              We implement appropriate technical and organizational measures to
              protect your data and only retain it for as long as necessary for
              the purposes for which it was collected, including for legal and
              accounting obligations.
            </p>
            <p className="mt-2">
              For more detailed information about how we handle your personal
              data and your rights (including access, rectification, deletion
              and objection), please refer to our&nbsp;
              <a
                href="/privacy"
                className="text-[#8b6f47] underline underline-offset-2 hover:text-[#5a4a3f]"
              >
                Privacy Policy
              </a>
              .
            </p>
          </section>

          {/* Communications & Newsletter */}
          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2 text-[#7a644c]">
              16. Communications & Newsletter
            </h2>
            <p>
              By making a booking, registering an account, or contacting us, you
              agree that we may send you transactional or service-related
              emails, such as booking confirmations, invoices, and important
              updates.
            </p>
            <p className="mt-2">
              You may also choose to subscribe to our newsletter or marketing
              emails. You can unsubscribe at any time by using the link provided
              in those emails or by contacting us. Even if you unsubscribe from
              marketing emails, we may still send you essential service
              communications related to your bookings or legal obligations.
            </p>
          </section>

          {/* Third-party services */}
          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2 text-[#7a644c]">
              17. Third-Party Services & Links
            </h2>
            <p>
              Our Services may integrate with or contain links to third-party
              websites or services, such as payment providers, mapping tools, or
              social media platforms. We do not control and are not responsible
              for the content, policies or practices of those third-party
              services.
            </p>
            <p className="mt-2">
              Your use of third-party services is subject to their own terms and
              privacy policies. We encourage you to review those documents
              before engaging with them.
            </p>
          </section>

          {/* Liability */}
          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2 text-[#7a644c]">
              18. Assumption of Risk & Limitation of Liability
            </h2>
            <p>
              Many of our experiences involve outdoor activities, interaction
              with nature, or participation in culinary or wellness practices.
              While we take reasonable care to provide a safe and nourishing
              environment, you acknowledge that such activities may involve
              inherent risks.
            </p>
            <p className="mt-2">
              To the fullest extent permitted by law, Oasis and its
              representatives shall not be liable for any indirect, incidental,
              special, consequential or punitive damages, or for any loss of
              profits, revenue, data, or goodwill, arising out of or in
              connection with:
            </p>
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li>Your use or inability to use the Services.</li>
              <li>
                Any booking, experience, retreat or product purchased through
                the Services.
              </li>
              <li>
                Any acts or omissions of third-party providers or other
                participants.
              </li>
            </ul>
            <p className="mt-2">
              Our total liability to you for any claims arising under these
              Terms shall not exceed the total amount you have paid to us for
              the relevant booking or product, except where otherwise required
              by mandatory law.
            </p>
          </section>

          {/* Disclaimer of Warranties */}
          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2 text-[#7a644c]">
              19. Disclaimer of Warranties
            </h2>
            <p>
              The Services are provided on an &quot;as is&quot; and &quot;as
              available&quot; basis. While we aim to keep the website accurate
              and up to date, we do not guarantee that it will be uninterrupted,
              error-free, or free of viruses or other harmful components.
            </p>
            <p className="mt-2">
              To the extent permitted by law, we disclaim all warranties of any
              kind, whether express or implied, including implied warranties of
              merchantability, fitness for a particular purpose, title and
              non-infringement.
            </p>
          </section>

          {/* Indemnity */}
          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2 text-[#7a644c]">
              20. Indemnification
            </h2>
            <p>
              You agree to indemnify, defend and hold harmless Oasis and its
              representatives from and against any claims, liabilities, damages,
              losses and expenses (including reasonable legal fees) arising out
              of or in any way connected with your:
            </p>
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li>Use of the Services.</li>
              <li>Violation of these Terms.</li>
              <li>Violation of any law or third-party right.</li>
            </ul>
          </section>

          {/* Force majeure */}
          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2 text-[#7a644c]">
              21. Force Majeure
            </h2>
            <p>
              We shall not be liable for any delay or failure to perform our
              obligations under these Terms if such delay or failure results
              from events beyond our reasonable control, including acts of God,
              extreme weather, natural disasters, strikes, wars, pandemics,
              government restrictions, or disruptions of essential services.
            </p>
          </section>

          {/* Termination */}
          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2 text-[#7a644c]">
              22. Suspension & Termination
            </h2>
            <p>
              We may suspend or terminate your access to the Services (including
              your account) at any time if we reasonably believe that you have
              breached these Terms or engaged in fraudulent, abusive or unlawful
              activity, or where we are required to do so by law or regulatory
              authorities.
            </p>
            <p className="mt-2">
              You may stop using the Services at any time. Termination does not
              affect any rights or obligations that have already accrued, such
              as payment obligations or limitations of liability.
            </p>
          </section>

          {/* Governing law */}
          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2 text-[#7a644c]">
              23. Governing Law & Jurisdiction
            </h2>
            <p>
              These Terms are governed by and construed in accordance with the
              laws of Greece, without regard to its conflict-of-law principles.
            </p>
            <p className="mt-2">
              You agree that the courts of Greece shall have exclusive
              jurisdiction over any dispute or claim arising out of or in
              connection with these Terms or your use of the Services, without
              prejudice to any mandatory consumer protection rules that may
              grant you additional rights in your country of residence.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2 text-[#7a644c]">
              24. Contact Us
            </h2>
            <p>
              If you have any questions about these Terms or about our Services,
              you can contact us at:
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
            <p className="mt-3 text-xs text-[#8f8272]">
              Please keep a copy of these Terms for your records. Your continued
              use of Oasis means you have read and agreed to them.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
