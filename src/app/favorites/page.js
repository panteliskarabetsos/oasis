"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  MapPin,
  Clock,
  ArrowRight,
  Heart,
  Sparkles,
  Loader2,
} from "lucide-react";
import FavoriteButton from "@/app/components/FavoriteButton";
import { useAuth } from "@/app/components/SessionWrapper"; // Using your existing auth wrapper

export default function FavoritesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Wait for Auth to initialize
    if (authLoading) return;

    // 2. Redirect if not logged in
    if (!user) {
      router.push("/login");
      return;
    }

    // 3. Fetch from API
    async function loadFavorites() {
      try {
        const res = await fetch("/api/favorites");
        if (!res.ok) throw new Error("Failed to fetch");
        const json = await res.json();
        setFavorites(json.data || []);
      } catch (error) {
        console.error("Error loading favorites:", error);
      } finally {
        setLoading(false);
      }
    }

    loadFavorites();
  }, [user, authLoading, router]);

  // Show loading skeleton or spinner while checking auth or fetching data
  if (authLoading || loading) {
    return <LoadingState />;
  }

  const hasFavorites = favorites && favorites.length > 0;

  return (
    <main className="min-h-screen bg-[#f4f1ec] pb-20">
      {/* Header Section */}
      <section className="relative bg-[#e7e0d5] pt-32 pb-16 px-6 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none">
          <div className="absolute top-[-50%] right-[-10%] w-[600px] h-[600px] rounded-full bg-[#d8cfc3] blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-full bg-white/40 backdrop-blur-md border border-white/20 text-[#5a4a3f] text-xs font-bold uppercase tracking-widest">
            <Heart size={12} className="text-[#C8AA86] fill-[#C8AA86]" />
            Your Collection
          </div>
          <h1 className="text-4xl md:text-5xl font-serif text-[#4d3e33] mb-4">
            My Favorites
          </h1>
          <p className="text-[#7a6a5f] max-w-xl text-lg">
            A curated list of the experiences you're dreaming about.
          </p>
        </div>
      </section>

      {/* Content Section */}
      <section className="max-w-7xl mx-auto px-6 -mt-8 relative z-20">
        {!hasFavorites ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {favorites.map((item) => {
              const exp = item.Experience;
              // Skip invalid items
              if (!exp) return null;

              const imageUrl =
                Array.isArray(exp.images) && exp.images[0]
                  ? exp.images[0]
                  : null;

              return (
                <div
                  key={item.id}
                  className="group flex flex-col bg-white rounded-3xl overflow-hidden border border-[#e4ddd3] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-500"
                >
                  {/* Image Container */}
                  <div className="relative h-64 w-full overflow-hidden bg-gray-100">
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={exp.name}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#d8cfc3]">
                        <Sparkles size={32} />
                      </div>
                    )}

                    {/* Floating Actions */}
                    <div className="absolute top-4 right-4 flex gap-2">
                      <FavoriteButton
                        experienceId={exp.id}
                        initialIsFavorite={true}
                        isLoggedIn={true}
                      />
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="flex flex-col flex-1 p-6">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#C8AA86] mb-1">
                          {exp.location && (
                            <span className="flex items-center gap-1">
                              <MapPin size={10} /> {exp.location}
                            </span>
                          )}
                        </div>
                        <h3 className="font-serif text-2xl text-[#2A2A2A] leading-tight group-hover:text-[#C8AA86] transition-colors">
                          <Link href={`/experiences/${exp.slug}`}>
                            {exp.name}
                          </Link>
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-[#777] mb-6">
                      {exp.duration && (
                        <div className="flex items-center gap-1.5 bg-[#f4f1ec] px-2 py-1 rounded-md">
                          <Clock size={12} />
                          <span>{exp.duration}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-auto pt-5 border-t border-[#f4f1ec] flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">
                          From
                        </span>
                        <span className="font-serif text-xl text-[#2A2A2A]">
                          €{exp.priceAdult}
                        </span>
                      </div>

                      <Link
                        href={`/experiences/${exp.slug}`}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#2A2A2A] text-white text-xs font-bold uppercase tracking-widest hover:bg-[#C8AA86] transition-colors"
                      >
                        View <ArrowRight size={14} />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

// --- Sub-Components ---

function LoadingState() {
  return (
    <main className="min-h-screen bg-[#f4f1ec] pb-20">
      <section className="relative bg-[#e7e0d5] pt-32 pb-16 px-6">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="h-6 w-32 bg-black/5 rounded-full animate-pulse" />
          <div className="h-12 w-64 bg-black/5 rounded-lg animate-pulse" />
        </div>
      </section>
      <div className="max-w-7xl mx-auto px-6 mt-12 flex justify-center">
        <Loader2 className="animate-spin text-[#C8AA86]" size={40} />
      </div>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-[#e4ddd3] text-center px-6">
      <div className="w-20 h-20 bg-[#f9f6f3] rounded-full flex items-center justify-center mb-6 text-[#d8cfc3]">
        <Heart size={32} />
      </div>
      <h2 className="font-serif text-3xl text-[#4d3e33] mb-3">
        No favorites yet
      </h2>
      <p className="text-[#8b7b6f] max-w-md mb-8 leading-relaxed">
        You haven't saved any experiences to your collection yet. Browse our
        catalog to find your next adventure.
      </p>
      <Link
        href="/experiences"
        className="px-8 py-4 rounded-full bg-[#4d3e33] text-white font-medium hover:bg-[#C8AA86] transition-colors shadow-lg shadow-[#4d3e33]/10"
      >
        Explore Experiences
      </Link>
    </div>
  );
}
