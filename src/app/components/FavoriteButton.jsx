"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";

export default function FavoriteButton({
  experienceId,
  initialIsFavorite,
  isLoggedIn,
}) {
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleToggle = async () => {
    if (!isLoggedIn) {
      router.push("/login"); // Redirect if not logged in
      return;
    }

    // Optimistic UI Update
    const previousState = isFavorite;
    setIsFavorite(!isFavorite);
    setIsLoading(true);

    try {
      const response = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experienceId }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      router.refresh(); // Refresh server components to sync state
    } catch (error) {
      console.error("Favorite Error:", error);
      setIsFavorite(previousState); // Revert on error
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isLoading}
      className={`group p-2.5 rounded-full backdrop-blur-md border transition-all duration-300 active:scale-95 ${
        isFavorite
          ? "bg-red-50 border-red-200 text-red-500"
          : "bg-white/10 border-white/10 text-white hover:bg-white hover:text-black"
      }`}
    >
      <Heart
        size={18}
        className={`transition-all duration-300 ${
          isFavorite ? "fill-current scale-110" : "group-hover:scale-105"
        }`}
      />
    </button>
  );
}
