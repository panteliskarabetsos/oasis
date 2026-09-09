import { LegalPage } from "@/components/LegalPage";

export default function PrivacyPolicyScreen() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy Policy"
      updated="Last updated: 23 September 2025"
      intro="We respect your privacy and are committed to protecting your personal information. This document explains how we collect, use, and share your data across all Oasis experiences. This Privacy Policy applies to the Oasis website, booking platform, retreat and experience bookings, online shop, newsletter, and related services (collectively, the “Services”). For the purposes of applicable data protection laws (such as the EU GDPR), Oasis acts as the “data controller” for the personal data described in this Policy."
      sections={[
        {
          title: "The data we collect",
          paragraphs: [
            "Depending on how you interact with us, we may collect: identity & contact data; booking & experience data; account & authentication data; payment, billing & invoice data; corporate & B2B data; and technical & usage data.",
            "We do not intentionally collect sensitive categories of personal data unless you voluntarily share it (e.g., dietary restrictions or accessibility needs) to help us tailor your experience safely.",
          ],
        },
        {
          title: "How we collect it",
          paragraphs: [
            "Directly from you when you make a booking, purchase a product, create an account, subscribe to the newsletter, or schedule a call.",
            "Automatically when you use our website or app, via cookies, server logs and similar technologies.",
            "From third-party services we use (for example, payment processors or email delivery platforms), only to the extent necessary to provide the Services.",
          ],
        },
        {
          title: "Legal bases for processing",
          paragraphs: [
            "Contract — processing bookings, issuing invoices, and communicating regarding availability or changes.",
            "Legitimate interests — improving the website, managing our relationship with you, preventing fraud, and running internal analytics.",
            "Legal obligation — keeping invoices, payment records and booking data for tax and accounting requirements, or responding to lawful requests from authorities.",
            "Consent — sending newsletters, marketing communications, or using analytics cookies. You may withdraw consent at any time.",
          ],
        },
        {
          title: "Cookies & similar technologies",
          paragraphs: [
            "We use cookies and similar technologies to operate and improve our website: strictly necessary (basic functionality and security), performance & analytics (understanding how the site is used), and functional (remembering your preferences). You can control cookies through your browser settings; disabling them may affect functionality.",
          ],
        },
        {
          title: "Bookings & payments",
          paragraphs: [
            "When you make a booking or purchase, we process the necessary data to reserve places for you, apply correct pricing, process payments securely, and issue receipts.",
            "Card payments are processed by external payment providers. We do not store your full card details on our own servers. Tokens or references may be stored solely to link payments to bookings or refunds.",
            "If you purchase or redeem a gift card, discount code, or voucher, we process data such as the code, value, currency, and associated email addresses to prevent misuse and ensure tax compliance.",
          ],
        },
        {
          title: "Newsletter",
          paragraphs: [
            "When you subscribe to our journal, we process your email address to send updates about new experiences. We may track general engagement (opens or clicks) to ensure our content is relevant. You can unsubscribe at any time via the link in our emails; essential service communications regarding your bookings will still be sent.",
          ],
        },
        {
          title: "Sharing & international transfers",
          paragraphs: [
            "We do not sell or rent your personal data. We may share it with service providers (hosting, payment processors, email delivery, accountants), professional advisors, and authorities where legally required.",
            "Our servers and some service providers may be located outside your country, including outside the EEA. We ensure adequate protection is in place, such as standard contractual clauses, for any international transfers.",
          ],
        },
        {
          title: "Retention & security",
          paragraphs: [
            "We retain personal data only for as long as necessary. Booking and invoice data may be kept for several years for tax requirements; newsletter data is kept until you unsubscribe. When no longer needed, data is securely deleted or anonymized.",
            "We implement appropriate technical and organizational measures — secure hosting, encryption, and access controls — although no internet transmission is completely secure.",
          ],
        },
        {
          title: "Your rights",
          paragraphs: [
            "Depending on where you live, you may have the right to access, rectify, erase, or restrict the processing of your data, request data portability, or withdraw your consent. To exercise these rights, contact us. You also have the right to lodge a complaint with your local data protection authority.",
          ],
        },
        {
          title: "Children",
          paragraphs: [
            "Our Services are primarily intended for adults. We do not knowingly collect personal data from children without appropriate consent from a parent or legal guardian.",
          ],
        },
        {
          title: "Contact",
          paragraphs: [
            "If you have any questions, concerns, or requests regarding this Privacy Policy, please reach out: info@youroasis.gr.",
          ],
        },
      ]}
    />
  );
}
