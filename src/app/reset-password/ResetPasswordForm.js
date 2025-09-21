'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [recaptchaToken, setRecaptchaToken] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!recaptchaToken) {
      setMessage('Please complete the reCAPTCHA verification.');
      return;
    }

    setIsLoading(true);

    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password, recaptchaToken }),
    });

    setIsLoading(false);

    if (res.ok) {
      setMessage('Password updated! Redirecting...');
      setTimeout(() => router.push('/login'), 2000);
    } else {
      const data = await res.json();
      setMessage(data.error || 'Something went wrong.');
    }
  };

  const handleRecaptchaChange = (token) => {
    setRecaptchaToken(token);
    setMessage(''); // clear any previous recaptcha errors
  };

  const handleRecaptchaExpired = () => {
    setRecaptchaToken(null);
    setMessage('reCAPTCHA expired, please complete it again.');
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-6 bg-white shadow rounded text-[#5a4a3f]">
      <h1 className="text-xl font-bold mb-4">Reset Password</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full p-2 mb-4 border border-[#d8cfc3] rounded"
        />

        {/* reCAPTCHA Component */}
        <div className="flex justify-center mb-4">
          <ReCAPTCHA
            sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}
            onChange={handleRecaptchaChange}
            onExpired={handleRecaptchaExpired} 
          />
        </div>

        <button
          type="submit"
          className="w-full bg-[#8b6f47] text-white py-2 rounded hover:bg-[#7a5f3a]"
          disabled={isLoading}
        >
          {isLoading ? 'Processing...' : 'Reset Password'}
        </button>
      </form>

      {message && <p className="text-sm mt-4 text-center">{message}</p>}
    </div>
  );
}
