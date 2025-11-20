'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicyPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#f4f1ec] px-6 py-20 flex flex-col items-center font-serif">
      <div className="w-full max-w-5xl bg-white p-12 rounded-3xl shadow-2xl border border-[#e0dcd4] relative overflow-hidden">

        {/* Decorative background */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#f0e9dd] rounded-full opacity-30 blur-2xl translate-x-1/3 -translate-y-1/3"></div>

        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-[#8b6f47] hover:text-[#5a4a3f] text-sm font-medium mb-10"
        >
          <ArrowLeft size={18} />
          Back
        </button>

        {/* Title */}
        <h1 className="text-5xl font-extrabold text-[#5a4a3f] mb-10 text-center leading-tight">
          Privacy Policy
        </h1>

        {/* Content */}
        <div className="space-y-10 text-[#5a4a3f] text-[15px] leading-relaxed">

          <p className="text-center text-[#7b6d5f] max-w-2xl mx-auto">
            We respect your privacy and are committed to protecting your personal information. By using our services, you agree to the practices described in this Privacy Policy.
          </p>

          <section>
            <h2 className="text-xl font-bold mb-3 text-[#7a644c]">1. Information We Collect</h2>
            <p>
              We collect personal data that you provide when you use our services. This includes, but is not limited to:
            </p>
            <ul className="list-disc ml-5">
              <li>Your name, email address, phone number, and date of birth</li>
              <li>Payment details necessary for processing reservations</li>
              <li>Booking history and preferences</li>
              <li>Communication with our support team</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-[#7a644c]">2. How We Use Your Data</h2>
            <p>
              Your personal information is used for the following purposes:
            </p>
            <ul className="list-disc ml-5">
              <li>To process and confirm bookings</li>
              <li>To provide customer support and respond to your inquiries</li>
              <li>To improve our services based on your preferences and feedback</li>
              <li>To send transactional emails related to your bookings and account</li>
              <li>To comply with legal obligations and resolve any disputes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-[#7a644c]">3. Cookies and Tracking Technologies</h2>
            <p>
              We use cookies to enhance your browsing experience, analyze traffic, and provide personalized features. Cookies may collect information such as:
            </p>
            <ul className="list-disc ml-5">
              <li>Your browsing behavior and preferences</li>
              <li>Your IP address and device information</li>
              <li>Pages visited and time spent on the website</li>
            </ul>
            <p>
              You can control the use of cookies through your browser settings, but please note that disabling cookies may limit certain features of our website.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-[#7a644c]">4. Data Retention and Deletion</h2>
            <p>
              We retain your personal data only for as long as necessary to fulfill the purposes for which it was collected, including for legal, accounting, or reporting purposes. After this period, your data will be securely deleted or anonymized.
            </p>
            <p>
              You have the right to request the deletion of your data at any time. To request data deletion, please contact us at <a href="mailto:oasis.mailsystem@gmail.com" className="underline text-[#8b6f47]">oasis.mailsystem@gmail.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-[#7a644c]">5. Data Security</h2>
            <p>
              We take the security of your personal data seriously and implement appropriate technical and organizational measures to protect it against unauthorized access, alteration, or destruction. These measures include:
            </p>
            <ul className="list-disc ml-5">
              <li>Encryption of sensitive data during transmission and storage</li>
              <li>Regular security audits and updates to our systems</li>
              <li>Access controls and secure authentication for users</li>
            </ul>
            <p>
              While we strive to protect your personal data, no method of transmission over the internet or method of electronic storage is 100% secure. Therefore, we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-[#7a644c]">6. Sharing of Personal Information</h2>
            <p>
              We do not sell or rent your personal information to third parties. However, we may share your information in the following situations:
            </p>
            <ul className="list-disc ml-5">
              <li>With third-party service providers who help us manage bookings and process payments</li>
              <li>With law enforcement or regulatory authorities if required by law</li>
              <li>With our partners and affiliates, for business purposes such as marketing and customer support</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-[#7a644c]">7. Your Rights</h2>
            <p>
              You have the following rights with respect to your personal data:
            </p>
            <ul className="list-disc ml-5">
              <li>The right to access and review the personal data we hold about you</li>
              <li>The right to correct any inaccurate or incomplete data</li>
              <li>The right to delete your personal data in certain circumstances</li>
              <li>The right to object to or restrict processing of your personal data</li>
            </ul>
            <p>
              To exercise these rights, please contact us at <a href="mailto:oasis.mailsystem@gmail.com" className="underline text-[#8b6f47]">oasis.mailsystem@gmail.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-[#7a644c]">8. Third-Party Websites</h2>
            <p>
              Our website may contain links to third-party websites that are not operated by us. We are not responsible for the privacy practices or content of these websites. We encourage you to review their privacy policies before providing any personal information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-[#7a644c]">9. Updates to This Privacy Policy</h2>
            <p>
              We may update our Privacy Policy from time to time. Any changes to the policy will be posted on this page with an updated date. We encourage you to check this page periodically for any updates.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-[#7a644c]">10. Contact Us</h2>
            <p>
              If you have any questions, concerns, or requests regarding this Privacy Policy or the handling of your personal data, please contact us at&nbsp;
              <a href="oasis.mailsystem@gmail.com" className="underline text-[#8b6f47]">oasis.mailsystem@gmail.com</a>.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
