// src/app/admin/experiences/page.js
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MapPin,
  Clock,
  Pencil,
  Trash2,
  Eye,
  Plus,
  ArrowLeft,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  TriangleAlert, // Added for modal
  Loader2, // Added for loading state
} from "lucide-react";
import { useAuth } from "@/app/components/SessionWrapper";
import Link from "next/link";

// Normalize reviews for display in the preview modal
function reviewsToDisplay(rv) {
  if (!rv) return [];
  if (Array.isArray(rv)) return rv;
  return [];
}

export default function AdminExperiencesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();

  const [isClient, setIsClient] = useState(false);
  const [experiences, setExperiences] = useState(null);
  const [previewExperience, setPreviewExperience] = useState(null);

  // Deletion States
  const [experienceToDelete, setExperienceToDelete] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast State
  const [toast, setToast] = useState(null);
  const seenRef = useRef(false);

  useEffect(() => setIsClient(true), []);

  // Fetch Data & Auth Check
  useEffect(() => {
    if (!isClient || loading) return;

    (async () => {
      const res = await fetch("/api/admin/experiences", { cache: "no-store" });
      if (res.status === 401 || res.status === 403) {
        router.replace("/");
        return;
      }
      const data = await res.json().catch(() => []);
      setExperiences(Array.isArray(data) ? data : []);
    })();
  }, [isClient, loading, router]);

  // Handle URL Toasts (e.g. ?toast=saved)
  useEffect(() => {
    if (seenRef.current) return;
    const t = searchParams.get("toast");
    if (!t) return;

    const messages = {
      saved: "Experience saved successfully",
      deleted: "Experience deleted permanently",
    };
    const types = { saved: "success", deleted: "danger" };

    if (messages[t]) {
      seenRef.current = true;
      setToast({ message: messages[t], type: types[t] });

      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("toast");
        window.history.replaceState(null, "", url.toString());
      }
    }
  }, [searchParams]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // This opens the modal
  const promptDelete = (experience) => {
    setExperienceToDelete(experience);
    setDeleteConfirmText("");
  };

  // This performs the actual API call
  const handleConfirmDelete = async () => {
    if (!experienceToDelete || deleteConfirmText !== "DELETE") return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/experiences`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: experienceToDelete.id }),
      });

      if (res.ok) {
        setExperiences((prev) =>
          prev.filter((e) => e.id !== experienceToDelete.id),
        );
        setToast({
          message: "Experience deleted successfully",
          type: "success",
        });
        setExperienceToDelete(null);
      } else {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete experience.");
      }
    } catch (err) {
      setToast({ message: err.message, type: "danger" });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isClient || loading || experiences === null) {
    return (
      <main className="min-h-screen bg-[#fdfcf8] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-4 border-[#8b6f47] border-t-transparent animate-spin" />
          <span className="text-[#5a4a3f] font-serif text-lg">
            Loading Experiences…
          </span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fdfcf8] text-[#3a2f28] pb-24">
      {/* Page Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-[#e6e0d8] shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 py-4 lg:py-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/admin/")}
                className="hidden sm:flex items-center justify-center w-10 h-10 rounded-full border border-[#e0dcd4] bg-[#fdfaf7] text-[#5a4a3f] hover:bg-[#f1ede7] transition-colors shrink-0"
                title="Back to Dashboard"
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <h1 className="text-2xl sm:text-3xl font-serif text-[#3a2f28]">
                  Experiences
                </h1>
                <p className="text-sm text-[#7a6a5f] mt-1">
                  Manage, preview, and create your offerings.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push("/admin/")}
                className="sm:hidden flex items-center justify-center px-4 py-2.5 rounded-full border border-[#e0dcd4] bg-[#fdfaf7] text-[#5a4a3f] hover:bg-[#f1ede7] transition-colors text-sm font-medium"
              >
                <ArrowLeft size={16} className="mr-2" /> Dashboard
              </button>
              <Link
                href="/admin/experiences/new"
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-[#8b6f47] text-white text-sm font-medium shadow-sm hover:bg-[#735b38] hover:shadow-md transition-all active:scale-95"
              >
                <Plus size={18} />
                New Experience
              </Link>
            </div>
          </div>
        </div>
      </header>

      <section className="container mx-auto px-4 sm:px-6 pt-8">
        {/* Empty State */}
        {experiences.length === 0 ? (
          <div className="max-w-2xl mx-auto mt-12 p-10 sm:p-16 text-center border-2 border-dashed border-[#e6e0d8] rounded-[2.5rem] bg-white shadow-sm">
            <div className="w-20 h-20 bg-[#fdfaf7] border border-[#e0dcd4] rounded-full flex items-center justify-center mx-auto mb-6 text-[#c5b9aa]">
              <ImageIcon size={32} />
            </div>
            <h2 className="text-2xl font-serif text-[#3a2f28] mb-3">
              No Experiences Yet
            </h2>
            <p className="text-[#7a6a5f] mb-8 leading-relaxed">
              You haven't created any experiences. Add your first offering to
              start accepting bookings and showcasing your agrotourism journeys.
            </p>
            <Link
              href="/admin/experiences/new"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-[#8b6f47] text-white text-sm font-medium hover:bg-[#735b38] transition-all shadow-md hover:shadow-lg"
            >
              <Plus size={18} /> Create First Experience
            </Link>
          </div>
        ) : (
          /* Experiences Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {experiences.map((experience) => (
              <div
                key={experience.id}
                className="group flex flex-col bg-white rounded-[2rem] border border-[#e6e0d8] shadow-[0_4px_20px_rgb(0,0,0,0.02)] hover:shadow-[0_10px_30px_rgb(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300 overflow-hidden"
              >
                {/* Image Area */}
                <div className="relative aspect-[4/3] w-full bg-[#f4f1ec] overflow-hidden border-b border-[#e6e0d8]">
                  {Array.isArray(experience.images) && experience.images[0] ? (
                    <img
                      src={experience.images[0]}
                      alt={experience.name}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#c5b9aa]">
                      <ImageIcon size={32} />
                    </div>
                  )}

                  {/* Status Badge */}
                  <div className="absolute top-4 left-4">
                    <span
                      className={`backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm border ${
                        experience.visibility
                          ? "bg-white/90 text-[#4a7854] border-white/50"
                          : "bg-[#1A1A1A]/80 text-white border-black/20"
                      }`}
                    >
                      {experience.visibility ? "Live Public" : "Draft Hidden"}
                    </span>
                  </div>

                  {/* Quick Delete Action */}
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        promptDelete(experience); // Changed from handleDeleteExperience
                      }}
                      className="p-2 bg-white/90 backdrop-blur text-red-600 hover:bg-red-50 hover:text-red-700 rounded-full shadow-sm transition-colors"
                      title="Delete Experience"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Content Area */}
                <div className="p-6 sm:p-8 flex flex-col flex-1">
                  <div className="flex-1 mb-6">
                    <h3 className="text-2xl font-serif text-[#3a2f28] mb-2 leading-tight group-hover:text-[#8b6f47] transition-colors">
                      {experience.name}
                    </h3>
                    <p className="text-sm text-[#7a6a5f] line-clamp-2 leading-relaxed">
                      {experience.description || "No description provided."}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs mb-8 border-l-2 border-[#e6e0d8] pl-3">
                    {experience.location && (
                      <span className="flex items-center gap-1.5 text-[#5a4a3f] font-medium">
                        <MapPin size={12} className="text-[#8b6f47]" />{" "}
                        {experience.location}
                      </span>
                    )}
                    {experience.duration && (
                      <span className="flex items-center gap-1.5 text-[#5a4a3f] font-medium">
                        <Clock size={12} className="text-[#8b6f47]" />{" "}
                        {experience.duration}
                      </span>
                    )}
                  </div>

                  {/* Bottom Actions */}
                  <div className="flex items-center justify-between pt-5 border-t border-[#e6e0d8]">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wider text-[#a1978d] mb-0.5">
                        Price
                      </span>
                      <span className="font-serif text-lg text-[#1A1A1A]">
                        €{experience.priceAdult || 0}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPreviewExperience(experience)}
                        className="p-2 rounded-full bg-[#fdfaf7] text-[#5a4a3f] border border-[#e0dcd4] hover:bg-[#f1ede7] transition-colors"
                        title="Preview Details"
                      >
                        <Eye size={16} />
                      </button>

                      <Link
                        href={`/admin/experiences/${experience.id}`}
                        className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#1A1A1A] text-white text-xs font-bold uppercase tracking-wider hover:bg-[#333] transition-colors"
                      >
                        Edit
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* --- PREVIEW MODAL --- */}
      {previewExperience && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto flex items-center justify-center"
          onClick={() => setPreviewExperience(null)}
        >
          <div
            className="w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-5 sm:px-8 sm:py-6 border-b border-[#e6e0d8] bg-[#fcfbf9] flex items-center justify-between sticky top-0 z-10">
              <div>
                <span
                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider mb-2 inline-block ${previewExperience.visibility ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700"}`}
                >
                  {previewExperience.visibility
                    ? "Live Public"
                    : "Draft Hidden"}
                </span>
                <h2 className="text-2xl sm:text-3xl font-serif text-[#3a2f28]">
                  {previewExperience.name}
                </h2>
              </div>
              <button
                onClick={() => setPreviewExperience(null)}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-white border border-[#e0dcd4] text-[#5a4a3f] hover:bg-gray-50 transition-colors shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-12 text-[#3a2f28]">
              {/* Quick Stats */}
              <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-12 bg-[#fdfcf8] p-6 rounded-2xl border border-[#e6e0d8]">
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[#a1978d] mb-1">
                    Duration
                  </p>
                  <p className="font-serif text-xl">
                    {previewExperience.duration || "—"}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[#a1978d] mb-1">
                    Adult Price
                  </p>
                  <p className="font-serif text-xl">
                    €{previewExperience.priceAdult || 0}
                  </p>
                </div>
                {previewExperience.priceKid !== null && (
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[#a1978d] mb-1">
                      Child Price
                    </p>
                    <p className="font-serif text-xl">
                      €{previewExperience.priceKid}
                    </p>
                  </div>
                )}
              </div>

              {previewExperience.description && (
                <section className="max-w-3xl mx-auto text-center">
                  <p className="text-lg leading-relaxed text-[#555] whitespace-pre-line">
                    {previewExperience.description}
                  </p>
                </section>
              )}

              {/* Gallery Preview */}
              {Array.isArray(previewExperience.images) &&
                previewExperience.images.length > 0 && (
                  <section className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {previewExperience.images.slice(0, 3).map((img, i) => (
                      <div
                        key={i}
                        className="aspect-square rounded-2xl overflow-hidden border border-[#e0dcd4]"
                      >
                        <img
                          src={img}
                          alt={`Preview ${i + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </section>
                )}

              {/* Text Grids */}
              <div className="grid sm:grid-cols-2 gap-8 pt-8 border-t border-[#e6e0d8]">
                {previewExperience.whatsIncluded && (
                  <section>
                    <h3 className="text-xl font-serif text-[#3a2f28] mb-4">
                      What’s Included
                    </h3>
                    <ul className="space-y-2">
                      {String(previewExperience.whatsIncluded)
                        .split("\n")
                        .filter(Boolean)
                        .map((item, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-[#555]"
                          >
                            <span className="text-[#8b6f47] mt-1">•</span>{" "}
                            {item}
                          </li>
                        ))}
                    </ul>
                  </section>
                )}

                {previewExperience.whatToBring && (
                  <section>
                    <h3 className="text-xl font-serif text-[#3a2f28] mb-4">
                      What to Bring
                    </h3>
                    <p className="text-[#555] whitespace-pre-line">
                      {previewExperience.whatToBring}
                    </p>
                  </section>
                )}
              </div>

              {/* Meetup Points Preview */}
              {Array.isArray(previewExperience.meetupPoints) &&
                previewExperience.meetupPoints.length > 0 && (
                  <section className="pt-8 border-t border-[#e6e0d8]">
                    <h3 className="text-xl font-serif text-[#3a2f28] mb-4 text-center">
                      Meeting Points
                    </h3>
                    <div className="grid sm:grid-cols-2 gap-4">
                      {previewExperience.meetupPoints.map((point) => (
                        <div
                          key={point.id}
                          className="p-5 border border-[#e0dcd4] rounded-2xl bg-[#fcfbf9]"
                        >
                          <h4 className="font-bold text-[#3a2f28] mb-1">
                            {point.name}
                          </h4>
                          <p className="text-sm text-[#7a6a5f]">
                            {point.mapPin}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

              {/* Reviews Preview */}
              {reviewsToDisplay(previewExperience.guestReviews).length > 0 && (
                <section className="pt-8 border-t border-[#e6e0d8]">
                  <h3 className="text-xl font-serif text-[#3a2f28] mb-6 text-center">
                    Guest Reviews
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {reviewsToDisplay(previewExperience.guestReviews).map(
                      (review, i) => (
                        <div
                          key={i}
                          className="bg-[#fcfbf9] p-6 rounded-2xl border border-[#e0dcd4]"
                        >
                          <p className="font-bold text-sm text-[#8b6f47] mb-2 uppercase tracking-wider">
                            {review.name || "Guest"}
                          </p>
                          <p className="italic text-[#555] leading-relaxed">
                            “{review.comment || review}”
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                </section>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-[#e6e0d8] bg-[#fcfbf9] flex justify-end">
              <Link
                href={`/admin/experiences/${previewExperience.id}`}
                className="px-8 py-3 rounded-full bg-[#1A1A1A] text-white text-sm font-bold uppercase tracking-wider hover:bg-[#333] transition-colors"
              >
                Edit Experience
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* --- DELETE CONFIRMATION MODAL --- */}
      {experienceToDelete && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center animate-in fade-in duration-200"
          onClick={() => !isDeleting && setExperienceToDelete(null)}
        >
          <div
            className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-[#e6e0d8] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <TriangleAlert size={32} />
              </div>
              <h3 className="text-2xl font-serif text-[#3a2f28] mb-3">
                Delete Experience?
              </h3>
              <p className="text-sm text-[#7a6a5f] leading-relaxed mb-6">
                You are about to delete{" "}
                <strong>{experienceToDelete.name}</strong>. This action is
                permanent and cannot be undone.
              </p>

              <div className="bg-[#fcfbf9] border border-[#e6e0d8] rounded-2xl p-5 mb-8">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#a1978d] mb-3">
                  Type <span className="text-red-500">DELETE</span> to confirm
                </p>
                <input
                  autoFocus
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) =>
                    setDeleteConfirmText(e.target.value.toUpperCase())
                  }
                  className="w-full px-4 py-3 rounded-xl border border-[#e0dcd4] bg-white text-center font-bold tracking-[0.2em] outline-none focus:border-red-500 transition-all shadow-sm"
                  placeholder="••••••"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  disabled={isDeleting}
                  onClick={() => setExperienceToDelete(null)}
                  className="flex-1 py-3.5 rounded-full text-sm font-semibold border border-[#e0dcd4] text-[#5a4a3f] hover:bg-[#f6f4f0] transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  disabled={deleteConfirmText !== "DELETE" || isDeleting}
                  onClick={handleConfirmDelete}
                  className="flex-1 py-3.5 rounded-full text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed transition-all shadow-md flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Trash2 size={16} />
                  )}
                  Delete Forever
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- TOAST NOTIFICATION --- */}
      {toast && (
        <div className="fixed bottom-6 right-6 sm:bottom-10 sm:right-10 z-[110] animate-fade-in-up">
          <div
            className={`px-5 py-4 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] border flex items-center gap-3 pr-12 relative ${
              toast.type === "success"
                ? "bg-white border-green-200"
                : "bg-white border-red-200"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 size={20} className="text-green-500" />
            ) : (
              <AlertCircle size={20} className="text-red-500" />
            )}
            <span className="font-medium text-sm text-[#3a2f28]">
              {toast.message}
            </span>

            <button
              onClick={() => setToast(null)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-gray-100 text-gray-400 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
