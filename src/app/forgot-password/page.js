'use client';

import { useState } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';  // Import reCAPTCHA component
import { Loader2 } from 'lucide-react'; // Import a spinner from lucide-react

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState(null); // Use one variable for recaptcha token

  const handleRecaptchaChange = (token) => {
    setRecaptchaToken(token);  // Store the token when reCAPTCHA is completed
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!recaptchaToken) {
      alert('Please verify you are not a robot');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, recaptchaToken }), // Send recaptcha token in request
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        const error = await res.json();
        alert(error?.message || 'Failed to send reset link. Please try again.');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Something went wrong, please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-gradient-to-br h-[800px] flex items-center justify-center">
      <div className="w-full max-w-md p-10 bg-white shadow-lg rounded-xl border border-[#e0dcd4]">
        <h1 className="text-3xl font-extrabold text-[#5a4a3f] mb-6 text-center">Forgot Password</h1>
        
        {submitted ? (
          <p className="text-sm text-[#5a4a3f] text-center">
            If the email exists, a reset link has been sent. Please check your inbox.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex flex-col">
              <label htmlFor="email" className="text-sm font-medium text-[#5a4a3f] mb-2">
                Enter your email address
              </label>
              <input
                type="email"
                id="email"
                placeholder="Your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full p-4 border border-[#d8cfc3] rounded-lg text-[#5a4a3f] focus:outline-none focus:ring-2 focus:ring-[#8b6f47] transition-all"
              />
            </div>

            {/* ReCAPTCHA V2 */}
            <div className="flex justify-center">
              <ReCAPTCHA
                sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}  // Use your own site key
                onChange={handleRecaptchaChange}
              />
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting || !email || !recaptchaToken}
              className={`w-full py-3 rounded-lg text-white transition-all ease-in-out duration-300 ${
                isSubmitting || !email || !recaptchaToken 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-[#8b6f47] hover:bg-[#7a5f3a]'
              }`}
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : (
                'Send Reset Link'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
