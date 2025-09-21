'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function FavouritesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return <div className="text-center py-32">Loading your favourites...</div>;
  }

  return (
    <div className="min-h-screen bg-[#f4f1ec] pt-28 px-6 text-[#2f2f2f]">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-serif text-[#5a4a3f] mb-6">My Favourites</h1>
        <p className="text-[#4a4a4a] mb-10">Here you can see your saved experiences for future inspiration.</p>

        {/* Placeholder content until favourites are implemented */}
        <div className="bg-white border border-[#e4ddd3] rounded-xl p-6 shadow text-center text-[#5a4a3f]">
          <p className="text-lg">You haven't saved any favourites yet.</p>
          <p className="text-sm text-[#8b6f47] mt-2">Browse our experiences and tap the heart to save your favourites.</p>
        </div>
      </div>
    </div>
  );
}
