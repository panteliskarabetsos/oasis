'use client';

import { useRouter } from 'next/navigation';

export default function LegalPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f4f1ec] px-6 py-16 font-serif">
      <h1 className="text-4xl font-bold text-[#5a4a3f] mb-10 text-center">
        Legal Information
      </h1>

      <div className="flex flex-col gap-6 w-full max-w-sm">
        <button
          onClick={() => router.push('/terms')}
          className="w-full py-4 rounded-full bg-white border border-[#d8cfc3] text-[#5a4a3f] hover:bg-[#eae5df] shadow-md text-lg font-medium transition-all"
        >
          Terms of Use
        </button>

        <button
          onClick={() => router.push('/privacy')}
          className="w-full py-4 rounded-full bg-white border border-[#d8cfc3] text-[#5a4a3f] hover:bg-[#eae5df] shadow-md text-lg font-medium transition-all"
        >
          Privacy Policy
        </button>
      </div>
    </div>
  );
}
