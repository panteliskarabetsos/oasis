import { LegalPage } from "@/components/LegalPage";

export default function TermsOfUseScreen() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of Use"
      updated="Last updated: April 2026"
      intro="These Terms of Use govern your use of the Oasis website, booking platform, online shop, and related services (collectively, the “Services”), operated out of Crete, Greece. By accessing or using the Services, you confirm that you are at least 18 years old and that you have read, understood, and agreed to be bound by these Terms. We may update these Terms at any time; continued use constitutes acceptance."
      sections={[
        {
          title: "Accounts & acceptable use",
          paragraphs: [
            "To access certain features you may need an account. You must provide accurate information and maintain the security of your credentials; you are responsible for all activity under your account.",
            "You agree not to use the Services in violation of applicable law. Prohibited actions include transmitting harmful or abusive content, automated scraping or data harvesting, bypassing security protocols, and interfering with the operation of the website or booking systems.",
          ],
        },
        {
          title: "Bookings & payments",
          paragraphs: [
            "To finalize and secure a booking, 100% prepayment of the service cost is generally required at checkout, unless explicitly stated otherwise.",
            "For inquiries or bookings requiring manual invoicing, payments must clear no later than 48 hours before the scheduled start to avoid automatic cancellation.",
            "Unless otherwise indicated, all prices are in Euros (€) and include applicable local taxes. We are not responsible for currency conversion fees or bank charges.",
          ],
        },
        {
          title: "Tiered cancellation policy",
          paragraphs: [
            "Flexible — up to 48 hours before start: 100% refund; less than 48 hours: no refund.",
            "Moderate — up to 7 days before start: 100% refund; up to 48 hours: 50% refund; less than 48 hours: no refund.",
            "Strict (Oasis Bespoke & Private) — up to 14 days before start: 100% refund; 7 to 13 days: 50% refund; less than 7 days: no refund. Where a 50% refund is issued, the retained balance covers non-recoverable costs and guaranteed payouts to hosts, chefs, and estates.",
            "Late arrivals & no-shows: guests more than 15 minutes late to the meeting point without notice forfeit the experience; no refund or credit is issued.",
          ],
        },
        {
          title: "Changes by Oasis",
          paragraphs: [
            "Minimum participation: some group tours require a minimum number of participants (typically 4). If not met, we notify you at least 48 hours in advance and offer an alternative date, a private upgrade (extra fee), or a full refund.",
            "Force majeure & safety: in extreme weather or unforeseen events rendering an experience unsafe, we propose an alternative date or full refund. Oasis is not liable for ancillary costs (flights, cars, accommodation).",
            "Service guarantee: if a specific partner cannot attend and no suitable replacement exists, you receive an immediate 100% refund alongside a gesture of goodwill.",
          ],
        },
        {
          title: "Health, safety & conduct",
          paragraphs: [
            "Guests must declare food allergies, dietary restrictions, or severe medical conditions in writing at the time of booking; this data is handled confidentially.",
            "In a medical emergency our first-aid-equipped staff pause the activity; for severe cases emergency services are contacted. Guests are responsible for medical expenses incurred.",
            "Guests must follow a “Leave No Trace” ethos in nature, and hosts may politely refuse alcohol service to any guest who exceeds limits or disrupts the group.",
          ],
        },
        {
          title: "Gift cards, vouchers & shop",
          paragraphs: [
            "Gift cards are non-refundable and cannot be exchanged for cash except where mandated by law. Discount codes are generally single-use and cannot be stacked unless stated.",
            "For physical goods, shipping costs and delivery estimates are provided at checkout. Oasis is not liable for delays caused by customs or couriers.",
          ],
        },
        {
          title: "Intellectual property",
          paragraphs: [
            "All content on the Oasis website — text, photography, graphics, logos, video, audio, and software — is the exclusive property of or licensed to Oasis and protected by Greek and international law. Personal, non-commercial use only; no reproduction without prior written consent. Content you submit (reviews, imagery) may be used by Oasis for promotion under a royalty-free worldwide license.",
          ],
        },
        {
          title: "Assumption of risk & liability",
          paragraphs: [
            "Many experiences involve outdoor activities, rugged terrain, and culinary or physical practices with inherent risks. We strongly recommend comprehensive travel and medical insurance.",
            "To the fullest extent permitted by law, Oasis shall not be liable for indirect, incidental, special, consequential, or punitive damages. Our maximum cumulative liability shall not exceed the amount paid for the specific booking or product in question.",
          ],
        },
        {
          title: "Governing law",
          paragraphs: [
            "These Terms and any disputes arising from them are governed by the laws of the Hellenic Republic (Greece). Any legal proceedings shall be brought exclusively in the competent courts of Chania, Crete, Greece.",
          ],
        },
        {
          title: "Contact",
          paragraphs: [
            "Questions about these terms or an existing reservation: info@youroasis.gr (Concierge & Support).",
          ],
        },
      ]}
    />
  );
}
