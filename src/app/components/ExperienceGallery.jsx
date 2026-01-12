"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  ImageIcon,
  Expand,
  Pause,
  Play,
} from "lucide-react";

export default function ExperienceGallery({ images, title }) {
  // --- State ---
  const [current, setCurrent] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [mounted, setMounted] = useState(false);

  // Auto-play state
  const [isPaused, setIsPaused] = useState(false);
  const autoPlayRef = useRef(null);

  // Swipe state
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const minSwipeDistance = 50;

  useEffect(() => {
    setMounted(true);
  }, []);

  // --- Auto-Play Logic ---
  useEffect(() => {
    // Only run if not paused and lightbox is closed
    if (isPaused || lightboxOpen) return;

    const startAutoPlay = () => {
      autoPlayRef.current = setInterval(() => {
        setCurrent((prev) => (prev + 1) % images.length);
      }, 5000); // Change every 5 seconds
    };

    startAutoPlay();

    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    };
  }, [isPaused, lightboxOpen, images.length, current]); // 'current' dep ensures timer resets on manual click

  if (!images || images.length === 0) return null;

  // --- Navigation Helpers ---
  const nextSlide = useCallback(() => {
    setCurrent((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const prevSlide = useCallback(() => {
    setCurrent((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  const goToSlide = (index) => {
    setCurrent(index);
  };

  // --- Lightbox Logic ---
  const openLightbox = () => {
    setLightboxIndex(current);
    setLightboxOpen(true);
    document.body.style.overflow = "hidden";
  };

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
    setCurrent(lightboxIndex);
    document.body.style.overflow = "auto";
  }, [lightboxIndex]);

  const nextLightbox = useCallback(
    (e) => {
      e?.stopPropagation();
      setLightboxIndex((prev) => (prev + 1) % images.length);
    },
    [images.length]
  );

  const prevLightbox = useCallback(
    (e) => {
      e?.stopPropagation();
      setLightboxIndex((prev) => (prev - 1 + images.length) % images.length);
    },
    [images.length]
  );

  // --- Swipe Handlers ---
  const onTouchStart = (e) => {
    setIsPaused(true); // Pause while touching
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = (nextFunc, prevFunc) => {
    setIsPaused(false); // Resume after touch
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) nextFunc();
    if (isRightSwipe) prevFunc();
  };

  // Keyboard (Lightbox Only)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (lightboxOpen) {
        if (e.key === "Escape") closeLightbox();
        if (e.key === "ArrowRight") nextLightbox();
        if (e.key === "ArrowLeft") prevLightbox();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxOpen, closeLightbox, nextLightbox, prevLightbox]);

  // --- Lightbox Component ---
  const LightboxModal = () => (
    <div
      className="fixed inset-0 z-[999999] flex items-center justify-center bg-[#050505] md:bg-black/90 md:backdrop-blur-sm animate-in fade-in duration-300 md:p-4"
      onClick={closeLightbox}
    >
      <div
        className="relative w-full h-[100dvh] md:w-[95vw] md:h-[95vh] md:max-w-[1920px] bg-[#0F0F0F] md:rounded-2xl overflow-hidden shadow-2xl flex flex-col md:border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-none flex justify-between items-center px-4 py-4 md:px-6 border-b border-white/10 bg-[#161616] z-50">
          <div className="text-white/90 flex flex-col md:block overflow-hidden">
            <span className="font-serif text-lg tracking-wide truncate block max-w-[220px] md:max-w-none">
              {title}
            </span>
            <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-white/60 md:ml-3 block">
              <span className="hidden md:inline text-white/40 mr-3">|</span>
              {lightboxIndex + 1} / {images.length}
            </span>
          </div>
          <button
            onClick={closeLightbox}
            className="flex items-center justify-center w-10 h-10 bg-white/10 hover:bg-white text-white hover:text-black rounded-full transition-all duration-200 backdrop-blur-md"
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        {/* Stage */}
        <div
          className="flex-1 relative flex items-center justify-center bg-black/20 overflow-hidden touch-none"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={() => onTouchEnd(nextLightbox, prevLightbox)}
        >
          <button
            onClick={prevLightbox}
            className="absolute left-4 z-10 p-3 rounded-full bg-black/50 text-white/70 hover:bg-white hover:text-black transition-all hidden md:flex border border-white/10"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="relative w-full h-full p-0">
            <Image
              src={images[lightboxIndex]}
              alt={`Fullscreen ${lightboxIndex + 1}`}
              fill
              className="object-contain"
              priority
              quality={100}
              sizes="95vw"
            />
          </div>
          <button
            onClick={nextLightbox}
            className="absolute right-4 z-10 p-3 rounded-full bg-black/50 text-white/70 hover:bg-white hover:text-black transition-all hidden md:flex border border-white/10"
          >
            <ChevronRight size={24} />
          </button>
        </div>

        {/* Thumbnails */}
        <div className="flex-none h-20 bg-[#161616] border-t border-white/10 hidden md:flex items-center justify-center gap-2 px-4 overflow-x-auto">
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setLightboxIndex(idx)}
              className={`
                relative h-14 w-20 shrink-0 rounded-md overflow-hidden transition-all duration-300
                ${
                  lightboxIndex === idx
                    ? "ring-2 ring-[#C8AA86] opacity-100"
                    : "opacity-40 hover:opacity-80"
                }
              `}
            >
              <Image
                src={img}
                alt="thumb"
                fill
                className="object-cover"
                sizes="100px"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* --- HEADER --- */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#C8AA86] mb-3 flex items-center gap-2">
            <ImageIcon size={14} /> Gallery
          </h2>
          <h3 className="font-serif text-3xl md:text-4xl text-[#1A1A1A]">
            Visual Journey
          </h3>
        </div>
        {/* Progress Bar / Counter */}
        <div className="hidden md:flex items-center gap-3">
          {/* Optional Play/Pause Indicator */}
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="p-2 rounded-full border border-gray-200 text-gray-400 hover:text-[#1A1A1A] hover:border-[#1A1A1A] transition-colors"
          >
            {isPaused ? (
              <Play size={12} fill="currentColor" />
            ) : (
              <Pause size={12} fill="currentColor" />
            )}
          </button>
          <span className="text-sm font-bold text-[#1A1A1A] border border-gray-200 px-4 py-2 rounded-full tabular-nums">
            {current + 1} / {images.length}
          </span>
        </div>
      </div>

      {/* --- INLINE CAROUSEL --- */}
      <div
        className="relative w-full aspect-[4/3] md:aspect-[16/9] lg:aspect-[2.35/1] rounded-3xl overflow-hidden group bg-gray-100 shadow-sm border border-gray-100"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={() => onTouchEnd(nextSlide, prevSlide)}
      >
        {/* Slider Track */}
        <div
          className="flex h-full transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)]"
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {images.map((img, idx) => (
            <div key={idx} className="min-w-full h-full relative">
              <Image
                src={img}
                alt={`${title} slide ${idx + 1}`}
                fill
                className="object-cover"
                priority={idx === 0}
                sizes="(max-width: 768px) 100vw, 80vw"
              />
              <div
                className="absolute inset-0 z-10 cursor-pointer"
                onClick={openLightbox}
              />
            </div>
          ))}
        </div>

        {/* --- Controls --- */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            prevSlide();
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white hover:text-black transition-all opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 duration-300 hidden md:flex"
        >
          <ChevronLeft size={24} />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            nextSlide();
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white hover:text-black transition-all opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 duration-300 hidden md:flex"
        >
          <ChevronRight size={24} />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            openLightbox();
          }}
          className="absolute top-4 right-4 z-20 flex items-center gap-2 px-4 py-2 rounded-full bg-black/20 hover:bg-black/50 backdrop-blur-md border border-white/10 text-white text-xs font-bold uppercase tracking-wider transition-colors opacity-0 group-hover:opacity-100 duration-300"
        >
          <Expand size={14} />
          <span className="hidden sm:inline">Fullscreen</span>
        </button>

        {/* Bottom Progress Indicators */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
          {images.map((_, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                goToSlide(idx);
              }}
              className={`h-1 rounded-full transition-all duration-500 ${
                current === idx
                  ? "w-8 bg-white"
                  : "w-1.5 bg-white/40 hover:bg-white/70"
              }`}
            />
          ))}
        </div>

        {/* Timer Bar (Visual Feedback) */}
        {!isPaused && (
          <div className="absolute bottom-0 left-0 h-1 bg-white/50 w-full z-10">
            <div
              key={current} // Key forces reset on slide change
              className="h-full bg-white animate-[progress_5s_linear]"
            />
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes progress {
          from {
            width: 0%;
          }
          to {
            width: 100%;
          }
        }
      `}</style>

      {/* --- PORTAL --- */}
      {mounted &&
        lightboxOpen &&
        createPortal(<LightboxModal />, document.body)}
    </>
  );
}
