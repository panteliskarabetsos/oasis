// src/app/admin/experiences/page.js
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MapPin, Clock, Euro, Pencil, Trash2, Eye } from "lucide-react";
import { useAuth } from "@/app/components/SessionWrapper";
import Link from "next/link";
function slugifyLocal(str) {
  return (str || "")
    .toString()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

// Try to parse guestReviews input as JSON, else treat as CSV -> array of strings
function parseGuestReviews(input) {
  const raw = (input || "").trim();
  if (!raw) return [];
  if (/^[\s]*[\[{]/.test(raw)) {
    try {
      const j = JSON.parse(raw);
      return j;
    } catch {
      // fall through to CSV parsing
    }
  }
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Normalize for display: accept array of strings or array of objects with "text"/"comment"
function reviewsToDisplay(rv) {
  if (!rv) return [];
  if (Array.isArray(rv)) {
    return rv
      .map((x) =>
        typeof x === "string"
          ? x
          : typeof x === "object" && (x.text || x.comment)
          ? String(x.text || x.comment)
          : null
      )
      .filter(Boolean);
  }
  // object case not typical, ignore keys
  return [];
}

const AdminExperiencesPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth(); // still fine to read, just not used for redirect

  const [isClient, setIsClient] = useState(false);
  const [experiences, setExperiences] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [previewExperience, setPreviewExperience] = useState(null);

  useEffect(() => setIsClient(true), []);

  // Authorize via SERVER (admin route). If 401/403 => redirect.
  useEffect(() => {
    if (!isClient || loading) return;

    (async () => {
      const res = await fetch("/api/admin/experiences", { cache: "no-store" });
      if (res.status === 401 || res.status === 403) {
        router.replace("/"); // not authorized
        return;
      }
      const data = await res.json().catch(() => []);
      setExperiences(Array.isArray(data) ? data : []);
    })();
  }, [isClient, loading, router]);

  // Init Cloudinary upload widget (optional)
  useEffect(() => {
    if (!isClient) return;
    if (typeof window !== "undefined" && window.cloudinary) {
      window.cloudinary.createUploadWidget(
        {
          cloudName: "docgxigth",
          uploadPreset: "oasis_photos",
          multiple: true,
        },
        (error, result) => {
          if (!error && result && result.event === "success") {
            setUploadedImages((prev) => [...prev, result.info.secure_url]);
          }
        }
      );
    }
  }, [isClient]);

  const [toast, setToast] = useState(null);
  const seenRef = useRef(false);

  useEffect(() => {
    if (seenRef.current) return;
    const t = searchParams.get("toast");
    if (!t) return;

    const messages = {
      saved: "Experience saved successfully",
      deleted: "Experience deleted",
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

  // Handle auto-dismiss independently of URL changes
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const openCloudinaryWidget = () => {
    if (typeof window === "undefined" || !window.cloudinary) return;
    const widget = window.cloudinary.createUploadWidget(
      {
        cloudName: "docgxigth",
        uploadPreset: "oasis_photos",
        multiple: true,
        maxFiles: 5,
      },
      (error, result) => {
        if (!error && result && result.event === "success") {
          setUploadedImages((prev) => [...prev, result.info.secure_url]);
        }
      }
    );
    widget.open();
  };

  const handleRemoveUploadedImage = (index) =>
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));

  const handleDeleteExperience = async (id) => {
    if (!confirm("Are you sure you want to delete this experience?")) return;
    const res = await fetch(`/api/admin/experiences`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setExperiences((prev) => prev.filter((e) => e.id !== id));
    else alert(data.error || "Failed to delete experience.");
  };

  const handleAddExperience = async (newExperience) => {
    const res = await fetch("/api/admin/experiences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newExperience, images: uploadedImages }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data) setExperiences((prev) => [...prev, data]);
    else alert((data && data.error) || "Failed to add experience.");
  };

  // While we’re checking auth (or loading experiences), render nothing / a spinner
  if (!isClient || loading || experiences === null) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#faf8f4] via-white to-[#f4f1ec] rounded-t-3xl text-[#5a4a3f] pt-5">
      {/* Page header */}
      <header className="sticky top-0 z-10 bg-gradient-to-b from-[#faf8f4]/90 to-white/80 backdrop-blur supports-[backdrop-filter]:backdrop-blur border-b border-[#e8e2d8]">
        <div className="container mx-auto px-6 py-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-serif text-[#5a4a3f]">
                Manage Experiences
              </h1>
              <p className="text-sm text-[#7a6a5f]">
                Create, edit, preview and organize your offerings.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push("/admin/")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#d8cfc3] bg-[#f4f1ec] text-[#5a4a3f] hover:bg-[#eee8e0] hover:border-[#cfc6b8] transition-all shadow-sm"
              >
                <span className="text-lg leading-none">←</span>
                Back to Dashboard
              </button>

              <Link
                href="/admin/experiences/new"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#8b6f47] text-white font-medium shadow-sm hover:bg-[#a78b62] focus:outline-none focus:ring-2 focus:ring-[#c7b29e] transition-all"
              >
                <span className="text-lg leading-none">＋</span>
                Add New Experience
              </Link>
            </div>
          </div>
        </div>
      </header>

      <section className="container mx-auto px-6 pt-6 pb-12">
        {/* Experiences list */}
        {!experiences ? (
          <div className="flex flex-col items-center justify-center mt-16 text-[#5a4a3f] font-serif text-lg">
            <div className="animate-spin rounded-full h-9 w-9 border-4 border-[#8b6f47] border-t-transparent mb-4" />
            Loading experiences...
          </div>
        ) : experiences.length === 0 ? (
          <div className="mt-16 text-center">
            <p className="text-[#5a4a3f] font-serif text-lg italic">
              No experiences found.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
            {experiences.map((experience) => (
              <div
                key={experience.id}
                className="group bg-white rounded-3xl border border-[#e8e2d8] shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all overflow-hidden"
              >
                {/* Optional cover */}
                {Array.isArray(experience.images) && experience.images[0] && (
                  <div className="aspect-[16/9] bg-[#f1ede7]">
                    <img
                      src={experience.images[0]}
                      alt={experience.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="p-6 flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold text-[#3b2f23]">
                        {experience.name}
                      </h3>
                      <p className="mt-1 text-sm text-[#7a6a5f] line-clamp-2">
                        {experience.description}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 self-start px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide ${
                        experience.visibility
                          ? "bg-green-50 text-green-700 border border-green-200"
                          : "bg-red-50 text-red-700 border border-red-200"
                      }`}
                      title={experience.visibility ? "Public" : "Private"}
                    >
                      {experience.visibility ? "Public" : "Private"}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#e0dcd4] bg-[#faf7f1] px-3 py-1">
                      <MapPin size={14} className="text-[#8b6f47]" />
                      {experience.location}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#e0dcd4] bg-[#faf7f1] px-3 py-1">
                      <Clock size={14} className="text-[#8b6f47]" />
                      {experience.duration}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#e0dcd4] bg-[#faf7f1] px-3 py-1">
                      <Euro size={14} className="text-[#8b6f47]" />€
                      {experience.priceAdult}
                      {typeof experience.priceKid === "number" &&
                        ` (kid €${experience.priceKid})`}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap justify-between gap-2">
                    <button
                      onClick={() => setPreviewExperience(experience)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#e9f0ff] text-[#1f4ea3] hover:bg-[#dbe7ff] transition-all"
                      title="Preview"
                    >
                      <Eye size={18} /> Preview
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          router.push(`/admin/experiences/${experience.id}`)
                        }
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-400 text-white hover:bg-amber-500 transition-all"
                        title="Edit"
                      >
                        <Pencil size={18} /> Edit
                      </button>
                      {/* <button
                        onClick={() => handleDeleteExperience(experience.id)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500 text-white hover:bg-red-600 transition-all"
                        title="Delete"
                      >
                        <Trash2 size={18} /> Delete
                      </button> */}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Preview modal — scrollable & viewport-safe */}
      {previewExperience && (
        <div
          className="fixed inset-0 z-50 bg-black/50 p-4 sm:p-6 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="mx-auto w-full max-w-6xl">
            <div className="bg-[#f4f1ec] rounded-3xl shadow-2xl flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)]">
              {/* Modal header (sticky so the close button stays visible) */}
              <div className="px-6 py-4 border-b border-[#e8e2d8] bg-[#faf7f1] relative sticky top-0 z-10">
                <button
                  onClick={() => setPreviewExperience(null)}
                  className="absolute right-4 top-3 px-3 py-1.5 rounded-full text-[#5a4a3f] bg-[#efeae2] hover:bg-[#e7e1d7] border border-[#e0d9cf] text-sm"
                  title="Close"
                >
                  ✕
                </button>
                <div className="text-center">
                  <h2 className="text-2xl sm:text-3xl font-serif text-[#5a4a3f]">
                    {previewExperience.name}
                  </h2>
                  <p className="text-sm text-[#7a6a5f]">
                    {previewExperience.visibility ? "Public" : "Private"} •{" "}
                    {previewExperience.location}
                  </p>
                </div>
              </div>

              {/* Scrollable content area */}
              <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 text-[#2f2f2f]">
                <div className="text-center space-y-1">
                  <p className="text-lg text-[#4a4a4a] italic">
                    {previewExperience.duration}
                  </p>
                  <p className="text-2xl font-medium text-[#5a4a3f]">
                    €{previewExperience.priceAdult}
                    {typeof previewExperience.priceKid === "number" &&
                      ` (kid €${previewExperience.priceKid})`}
                  </p>
                </div>

                {previewExperience.description && (
                  <section className="max-w-4xl mx-auto text-center">
                    <p className="text-lg sm:text-xl leading-relaxed text-[#4a4a4a] whitespace-pre-line">
                      {previewExperience.description}
                    </p>
                  </section>
                )}

                {previewExperience.images?.length > 0 && (
                  <section className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {previewExperience.images.map((img, i) => (
                      <div
                        key={i}
                        className="relative aspect-video rounded-xl overflow-hidden border-2 border-[#e0dcd4] shadow-lg"
                      >
                        <img
                          src={img}
                          alt={`Experience Image ${i + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </section>
                )}

                {previewExperience.whatsIncluded && (
                  <section className="max-w-4xl mx-auto">
                    <h3 className="text-2xl font-serif text-[#5a4a3f] mb-3 text-center">
                      What’s Included
                    </h3>
                    <ul className="list-disc list-inside text-[#4a4a4a] space-y-1">
                      {String(previewExperience.whatsIncluded)
                        .split("\n")
                        .map((item, i) => (
                          <li key={i} className="text-lg">
                            {item}
                          </li>
                        ))}
                    </ul>
                  </section>
                )}

                {previewExperience.whatToBring && (
                  <section className="max-w-4xl mx-auto text-center">
                    <h3 className="text-2xl font-serif text-[#5a4a3f] mb-3">
                      What to Bring
                    </h3>
                    <p className="text-lg text-[#4a4a4a]">
                      {previewExperience.whatToBring}
                    </p>
                  </section>
                )}

                {previewExperience.whyYoullLove && (
                  <section className="max-w-4xl mx-auto text-center">
                    <h3 className="text-2xl font-serif text-[#5a4a3f] mb-3">
                      Why You’ll Love It
                    </h3>
                    <p className="text-lg text-[#4a4a4a] whitespace-pre-line">
                      {previewExperience.whyYoullLove}
                    </p>
                  </section>
                )}

                {previewExperience.mapPin && (
                  <section className="max-w-5xl mx-auto">
                    <h3 className="text-2xl font-serif text-[#5a4a3f] mb-3 text-center">
                      Where You'll Be
                    </h3>
                    <div className="w-full h-[300px] rounded-xl overflow-hidden shadow-lg border border-[#e0dcd4]">
                      <iframe
                        src={`https://www.google.com/maps?q=${previewExperience.mapPin}&z=14&output=embed`}
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        allowFullScreen
                        loading="lazy"
                        title="Map"
                      />
                    </div>
                  </section>
                )}

                {reviewsToDisplay(previewExperience.guestReviews).length >
                  0 && (
                  <section className="max-w-4xl mx-auto">
                    <h3 className="text-2xl font-serif text-[#5a4a3f] mb-4 text-center">
                      Guest Reviews
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {reviewsToDisplay(previewExperience.guestReviews).map(
                        (review, i) => (
                          <div
                            key={i}
                            className="bg-white p-5 rounded-2xl shadow border border-[#e0dcd4]"
                          >
                            <p className="font-semibold text-[#5a4a3f]">
                              Guest
                            </p>
                            <p className="italic text-[#4a4a4a] mt-1">
                              “{review}”
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  </section>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div
          className={[
            "fixed right-4 top-4 z-[60] px-4 py-3 rounded-xl shadow-lg border flex items-center gap-3",
            toast.type === "success"
              ? "bg-green-50 text-green-900 border-green-200"
              : "bg-red-50 text-red-900 border-red-200",
          ].join(" ")}
          role="status"
        >
          <span className="font-medium">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-2 inline-flex items-center justify-center rounded-md px-2 py-0.5 hover:bg-black/5"
            aria-label="Dismiss"
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
    </main>
  );
};

function LabeledInput({
  name,
  label,
  defaultValue,
  type = "text",
  required = true,
  placeholder,
}) {
  return (
    <div>
      <label className="block text-xs tracking-wide uppercase text-[#8a7c6d] mb-1">
        {label}
      </label>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className="w-full px-4 py-2.5 rounded-xl border border-[#dcd2c3] bg-white focus:outline-none focus:ring-2 focus:ring-[#8b6f47] shadow-sm"
      />
    </div>
  );
}

function LabeledTextarea({
  name,
  label,
  defaultValue,
  required = true,
  placeholder,
}) {
  return (
    <div>
      <label className="block text-xs tracking-wide uppercase text-[#8a7c6d] mb-1">
        {label}
      </label>
      <textarea
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        rows={3}
        className="w-full px-4 py-3 rounded-xl border border-[#dcd2c3] bg-white focus:outline-none focus:ring-2 focus:ring-[#8b6f47] shadow-sm"
      />
    </div>
  );
}

export default AdminExperiencesPage;
