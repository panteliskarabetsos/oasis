'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export default function TermsPage() {
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
          Terms of Use
        </h1>

        {/* Content */}
        <div className="space-y-10 text-[#5a4a3f] text-[15px] leading-relaxed">

          <p className="text-center text-[#7b6d5f] max-w-2xl mx-auto">
            Welcome to our platform. By using our services, you agree to be bound by the following Terms of Use.
          </p>

          <section>
            <h2 className="text-xl font-bold mb-3 text-[#7a644c]">1. Acceptance of Terms</h2>
            <p>
              By using this website, you confirm that you have read, understood, and agreed to these Terms of Use. If you do not agree with any part of these terms, please do not use our website.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-[#7a644c]">2. Modifications to Terms</h2>
            <p>
              We reserve the right to modify these terms at any time. Changes will be effective immediately upon posting on this page. Your continued use of the website after changes are posted constitutes your acceptance of the revised terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-[#7a644c]">3. Use of the Website</h2>
            <p>
              You agree to use the website for lawful purposes only and in a way that does not infringe the rights of, restrict, or inhibit anyone else's use and enjoyment of the website.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-[#7a644c]">4. Intellectual Property Rights</h2>
            <p>
              All content on this website, including text, graphics, logos and images, is the property of Oasis or its content suppliers and is protected by international copyright laws.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-[#7a644c]">5. User Accounts</h2>
            <p>
              If you create an account on our website, you are responsible for maintaining the confidentiality of your account information and for all activities that occur under your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-[#7a644c]">6.  Privacy Policy</h2>
            <p>
              Your use of the website is also governed by our Privacy Policy, which can be found at 
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-[#7a644c]">7. Data Processing and Handling in Booking System</h2>
            <p>We are committed to protecting your personal data and ensuring its confidentiality. Our booking system collects and processes personal data in accordance with applicable data protection laws, including the General Data Protection Regulation (GDPR). The following outlines how we handle your data:</p>
             <p> Data Collection: When you make a booking, we collect personal information such as your name, contact details, and payment information necessary to process your reservation.</p>
              <p>Purpose of Processing: Your data is used solely for the purpose of managing your bookings, providing customer support, and improving our services.</p>
              <p>Data Retention: We retain your personal data only for as long as necessary to fulfill the purposes for which it was collected, including any legal or reporting requirements.</p>
              <p>Data Sharing: We do not share your personal data with third parties except as necessary to process your booking or as required by law.</p>
              <p>Data Security: We implement appropriate technical and organizational measures to protect your personal data against unauthorized access, alteration, disclosure, or destruction.</p>
              <p>Your Rights: You have the right to access, correct, or delete your personal data. You may also object to or restrict certain processing of your data. To exercise these rights, please contact us at oasis.mailsystem@gmail.com.</p>
              <p>For more detailed information, please refer to our  <a href="/privacy" className="underline text-[#8b6f47]">Privacy Policy</a>.</p>
              
            
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-[#7a644c]">8. Limitation of Liability</h2>
            <p>
             Oasis will not be liable for any indirect, incidental or consequential damages arising out of or in connection with your use of our services or experiences.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-[#7a644c]">9. Governing Law</h2>
            <p>
              These Terms shall be governed by the laws of Greece. Any disputes shall be resolved exclusively by the courts of that jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-[#7a644c]">10. Contact Us</h2>
            <p>
              If you have any questions or concerns about these Terms, please contact us at&nbsp;
              <a href="mailto:oasis.mailsystem@gmail.com" className="underline text-[#8b6f47]">oasis.mailsystem@gmail.com</a>.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
