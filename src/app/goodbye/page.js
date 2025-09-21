'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function GoodbyePage() {
  const router = useRouter();

  useEffect(() => {
    setTimeout(() => {
      router.push('/'); // Redirect to homepage
    }, 10000); // Redirect after 5 seconds
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8f6f1] to-[#fdfaf5] flex items-center justify-center px-4 py-10">
      <div className="bg-white shadow-lg p-10 rounded-2xl w-full max-w-lg text-center">
        <h1 className="text-3xl font-extrabold text-[#8b6f47] mb-4">Goodbye!</h1>
        <p className="text-lg text-[#5a4a3f] mb-6">
          We're sorry to see you go. Your account has been successfully deleted.
        </p>
        <p className="text-sm text-[#7a6a5f]">
          You will be redirected to the homepage in a few seconds...
        </p>
        <div className="mt-6">
          <button
            onClick={() => router.push('/')}
            className="bg-[#8b6f47] text-white px-6 py-2 rounded-full hover:bg-[#7a5f3a] transition-all"
          >
            Go to Homepage
          </button>
        </div>
        <div className="mt-4">
          <p className="text-sm text-[#7a6a5f]">
            If you changed your mind, please contact support.
          </p>
          <a href="/support" className="text-[#8b6f47] underline text-sm hover:text-[#7a5f3a]">
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}
