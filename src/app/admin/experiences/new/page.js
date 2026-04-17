// src/app/admin/experiences/new/page.js
"use client";
// Add this to your imports at the top of the file
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import {
  ArrowLeft,
  Image as ImageIcon,
  Upload,
  Check,
  Loader2,
  Plus,
  Trash2,
  MapPin,
  Clock,
  MessageSquare,
  Star,
  Info,
} from "lucide-react";

/* ---------------------------- helpers ---------------------------- */
const slugify = (s = "") =>
  s
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const Field = ({ label, children, hint, required = false, className = "" }) => (
  <label className={`block group min-w-0 ${className}`}>
    <span className="flex items-center gap-2 text-sm font-semibold tracking-wide text-[#5a4a3f] mb-1.5">
      {label} {required ? <span className="text-[#b44d4d]">*</span> : null}
    </span>
    <div className="w-full">{children}</div>
    {hint ? (
      <p className="mt-1.5 text-xs text-[#7a6a5f] font-medium">{hint}</p>
    ) : null}
  </label>
);

export default function NewExperiencePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // DB fields
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("Chania, Crete");
  const [duration, setDuration] = useState("");
  const [priceAdult, setPriceAdult] = useState("85");
  const [priceKid, setPriceKid] = useState("");
  const [whatsIncluded, setWhatsIncluded] = useState("");
  const [whatToBring, setWhatToBring] = useState("");
  const [whyYoullLove, setWhyYoullLove] = useState("");
  const [visibility, setVisibility] = useState(true);
  const [frequency, setFrequency] = useState([]);
  const [images, setImages] = useState([]);

  // Dynamic Arrays
  const [meetupPoints, setMeetupPoints] = useState([]);
  const [reviews, setReviews] = useState([]);

  // derived UI
  const [status, setStatus] = useState("published");

  // auto-slug from name
  useEffect(() => {
    if (!name) return;
    setSlug((prev) => {
      const next = slugify(name);
      if (!prev) return next;
      const prevAsSlug = slugify(prev);
      return prev === prevAsSlug ? next : prev;
    });
  }, [name]);

  // keep status pill in sync with visibility
  useEffect(() => {
    setStatus(visibility ? "published" : "draft");
  }, [visibility]);

  const canSubmit =
    name.trim().length >= 3 &&
    slug.trim().length >= 3 &&
    (priceAdult === "" || !Number.isNaN(Number(priceAdult))) &&
    (priceKid === "" || !Number.isNaN(Number(priceKid)));

  function toggleDay(day) {
    setFrequency((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }

  /* --- Dynamic Array Handlers --- */
  const addMeetupPoint = () => {
    setMeetupPoints((prev) => [
      ...prev,
      { id: Date.now().toString(), name: "", mapPin: "", instructions: "" },
    ]);
  };

  const updateMeetupPoint = (id, field, value) => {
    setMeetupPoints((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
    );
  };

  const removeMeetupPoint = (id) => {
    setMeetupPoints((prev) => prev.filter((p) => p.id !== id));
  };

  const addReview = () => {
    setReviews((prev) => [
      ...prev,
      { id: Date.now().toString(), name: "", comment: "" },
    ]);
  };

  const updateReview = (id, field, value) => {
    setReviews((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    );
  };

  const removeReview = (id) => {
    setReviews((prev) => prev.filter((r) => r.id !== id));
  };

  /* --- Submit --- */
  async function submit(e, publish = false) {
    e?.preventDefault?.();
    if (!canSubmit) {
      toast.error("Please fill the required fields correctly.");
      return;
    }

    const finalVisibility = publish ? true : false;
    publish ? setPublishing(true) : setLoading(true);

    try {
      const cleanedMeetupPoints = meetupPoints.filter(
        (p) => p.name.trim() || p.mapPin.trim(),
      );

      const cleanedReviews = reviews
        .filter((r) => r.comment.trim())
        .map(({ name, comment }) => ({
          name: name.trim() || "Guest",
          comment: comment.trim(),
        }));

      const payload = {
        name: name.trim(),
        slug: slugify(slug),
        description: description.trim() || null,
        location: location.trim() || "Chania, Crete",
        duration: duration.trim() || null,
        whatsIncluded: whatsIncluded.trim() || null,
        whatToBring: whatToBring.trim() || null,
        whyYoullLove: whyYoullLove.trim() || null,
        images,
        meetupPoints: cleanedMeetupPoints,
        guestReviews: cleanedReviews,
        frequency,
        visibility: finalVisibility,
        priceAdult: priceAdult === "" ? 85 : Number(priceAdult),
        priceKid: priceKid === "" ? null : Number(priceKid),
        updatedAt: new Date().toISOString(),
      };

      if (!payload.slug) {
        toast.error("Slug could not be generated. Please enter a valid name.");
        return;
      }

      const res = await fetch("/api/admin/experiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const msg =
          (await res.json().catch(() => ({})))?.error ||
          "Could not create experience.";
        throw new Error(msg);
      }

      const created = await res.json();
      toast.success(
        publish ? "Published successfully!" : "Draft saved securely.",
      );

      if (created?.id) {
        router.push(`/admin/experiences/${created.id}`);
      } else {
        router.push(`/admin/experiences?toast=saved`);
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
      setPublishing(false);
    }
  }

  /* --- Image Upload --- */
  /* --- Image Upload --- */
  const openCloudinaryWidget = () => {
    // Restored your original hardcoded fallbacks here!
    const cloudName =
      process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "docgxigth";
    const uploadPreset =
      process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "ml_default";

    if (typeof window === "undefined" || !window.cloudinary) {
      toast.error("Cloudinary widget script is not loaded on this page.");
      console.error("Missing Cloudinary script tag in your layout/document.");
      return;
    }

    if (!cloudName) {
      toast.error("Cloud name is missing.");
      return;
    }

    const widget = window.cloudinary.createUploadWidget(
      {
        cloudName,
        uploadPreset,
        multiple: true,
        maxFiles: 10,
        folder: "oasis/experiences",
      },
      (error, result) => {
        if (!error && result && result.event === "success") {
          setImages((prev) => [...prev, result.info.secure_url]);
          toast.success("Image added to gallery");
        }
      },
    );
    widget.open();
  };

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const inputClass =
    "w-full min-w-0 rounded-xl border border-[#e0dcd4] bg-white px-4 py-2.5 text-sm text-[#3a2f28] placeholder:text-[#a1978d] outline-none transition-all focus:border-[#8b6f47] focus:ring-1 focus:ring-[#8b6f47] shadow-sm";

  return (
    <div className="relative pb-24 bg-[#fdfcf8] min-h-screen pt-4">
      <Script
        src="https://widget.cloudinary.com/v2.0/global/all.js"
        strategy="lazyOnload"
      />
      {/* Top controls (Sticky) 
        FIXED: Changed top-4 to top-20 (to clear the main header) 
        FIXED: Changed z-40 to z-20 (so it slides under main navigation dropdowns)
      */}
      <div className="sticky top-20 lg:top-24 z-20 mx-auto mb-8 max-w-7xl px-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#e6e0d8] bg-white/90 backdrop-blur-md px-4 py-3 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-full border border-[#e0dcd4] bg-[#fdfaf7] px-4 py-2 text-sm font-medium text-[#5a4a3f] hover:bg-[#f1ede7] transition-colors shrink-0"
          >
            <ArrowLeft size={16} /> Back
          </button>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <button
              onClick={(e) => submit(e, false)}
              disabled={!canSubmit || loading || publishing}
              className="rounded-full border border-[#e0dcd4] bg-white px-4 sm:px-5 py-2 text-sm font-medium text-[#5a4a3f] hover:bg-[#f6f4f0] disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 transition-colors shadow-sm"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Check size={16} />
              )}
              Save Draft
            </button>
            <button
              onClick={(e) => submit(e, true)}
              disabled={!canSubmit || loading || publishing}
              className="rounded-full bg-[#8b6f47] px-4 sm:px-6 py-2 text-sm font-medium text-white hover:bg-[#735b38] disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 transition-colors shadow-md"
            >
              {publishing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Upload size={16} />
              )}
              Publish Live
            </button>
          </div>
        </div>
      </div>

      {/* Content Layout: 12-column Grid */}
      <div className="mx-auto grid max-w-7xl grid-cols-1 lg:grid-cols-12 gap-8 px-4 sm:px-6 items-start">
        {/* Left Column: Form (8 cols on desktop) */}
        <form className="lg:col-span-8 space-y-8 min-w-0 flex flex-col">
          {/* Section: Basic Info */}
          <div className="rounded-[2rem] border border-[#e6e0d8] bg-white p-6 sm:p-8 shadow-sm space-y-6">
            <div className="border-b border-[#e6e0d8] pb-4 mb-2">
              <h2 className="font-serif text-2xl text-[#3a2f28]">
                Basic Information
              </h2>
              <p className="text-sm text-[#7a6a5f] mt-1">
                The core details displayed on the primary listing.
              </p>
            </div>

            <Field
              label="Experience Name"
              required
              hint="A short, evocative title."
            >
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                placeholder="e.g. Traditional Olive Harvest & Feast"
              />
            </Field>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <Field
                label="URL Slug"
                required
                hint="Auto-generates from the name."
              >
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className={inputClass}
                  placeholder="traditional-olive-harvest"
                />
              </Field>

              <Field label="General Location" hint="Displayed on badges.">
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className={inputClass}
                  placeholder="Chania, Crete"
                />
              </Field>
            </div>

            <Field
              label="Full Description"
              hint="Tell the story. Use paragraphs to format nicely on the front end."
            >
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className={inputClass}
                placeholder="Immerse yourself in the authentic rhythm of Cretan life..."
              />
            </Field>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 p-5 bg-[#fcfbf9] rounded-2xl border border-[#e6e0d8]">
              <Field label="Duration">
                <input
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. 4 Hours"
                />
              </Field>

              <Field label="Price per Adult (€)" required>
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={priceAdult}
                  onChange={(e) => setPriceAdult(e.target.value)}
                  className={inputClass}
                  placeholder="85"
                />
              </Field>

              <Field label="Price per Child (€)">
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={priceKid}
                  onChange={(e) => setPriceKid(e.target.value)}
                  className={inputClass}
                  placeholder="45"
                />
              </Field>
            </div>

            <Field label="Listing Visibility">
              <label className="flex items-center gap-3 mt-2 cursor-pointer w-fit p-3 pr-5 border border-[#e6e0d8] rounded-xl hover:bg-[#fcfbf9] transition-colors">
                <div
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${visibility ? "bg-[#8b6f47]" : "bg-gray-300"}`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={visibility}
                    onChange={(e) => setVisibility(e.target.checked)}
                  />
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${visibility ? "translate-x-6" : "translate-x-1"}`}
                  />
                </div>
                <span className="text-sm font-medium text-[#3a2f28]">
                  Make this experience public
                </span>
              </label>
            </Field>
          </div>

          {/* Section: Itinerary & Logistics */}
          <div className="rounded-[2rem] border border-[#e6e0d8] bg-white p-6 sm:p-8 shadow-sm space-y-6">
            <div className="border-b border-[#e6e0d8] pb-4 mb-2">
              <h2 className="font-serif text-2xl text-[#3a2f28]">
                Itinerary & Details
              </h2>
            </div>

            <Field
              label="Why Guests Will Love It"
              hint="Highlight the emotional or premium aspects."
            >
              <textarea
                value={whyYoullLove}
                onChange={(e) => setWhyYoullLove(e.target.value)}
                rows={3}
                className={inputClass}
                placeholder="You'll step away from the tourist path and connect with local culture..."
              />
            </Field>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <Field
                label="What’s Included"
                hint="Break items by pressing Enter. Renders as a checkmark list."
              >
                <textarea
                  value={whatsIncluded}
                  onChange={(e) => setWhatsIncluded(e.target.value)}
                  rows={5}
                  className={inputClass}
                  placeholder="Welcome coffee&#10;Guided farm walk&#10;Full traditional meal"
                />
              </Field>

              <Field
                label="What to Bring"
                hint="Break items by pressing Enter."
              >
                <textarea
                  value={whatToBring}
                  onChange={(e) => setWhatToBring(e.target.value)}
                  rows={5}
                  className={inputClass}
                  placeholder="Comfortable closed-toe shoes&#10;Sunscreen&#10;A light jacket"
                />
              </Field>
            </div>

            <Field
              label="Availability Schedule"
              className="pt-4 border-t border-[#e6e0d8]"
            >
              <div className="flex flex-wrap gap-2 mt-2">
                {[
                  "Monday",
                  "Tuesday",
                  "Wednesday",
                  "Thursday",
                  "Friday",
                  "Saturday",
                  "Sunday",
                ].map((day) => {
                  const isActive = frequency.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                        isActive
                          ? "bg-[#8b6f47] border-[#8b6f47] text-white shadow-sm"
                          : "bg-white border-[#e0dcd4] text-[#5a4a3f] hover:bg-[#f6f4f0]"
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>

          {/* Section: Meeting Points */}
          <div className="rounded-[2rem] border border-[#e6e0d8] bg-white p-6 sm:p-8 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e6e0d8] pb-4 mb-6">
              <div>
                <h2 className="font-serif text-2xl text-[#3a2f28]">
                  Meeting Points
                </h2>
                <p className="text-sm text-[#7a6a5f] mt-1">
                  Options for the client to select at checkout.
                </p>
              </div>
              <button
                type="button"
                onClick={addMeetupPoint}
                className="flex items-center gap-2 px-4 py-2 bg-[#fcfbf9] border border-[#e0dcd4] text-[#3a2f28] text-sm font-medium rounded-full hover:bg-[#f1ede7] transition-colors shadow-sm shrink-0"
              >
                <Plus size={16} /> Add Location
              </button>
            </div>

            <div className="space-y-4">
              {meetupPoints.length === 0 ? (
                <div className="p-10 text-center border-2 border-dashed border-[#e6e0d8] rounded-[1.5rem] bg-[#fcfbf9]">
                  <MapPin className="mx-auto text-[#c5b9aa] mb-3" size={28} />
                  <p className="text-sm text-[#7a6a5f] font-medium">
                    No meeting locations defined yet.
                  </p>
                </div>
              ) : (
                meetupPoints.map((point, index) => (
                  <div
                    key={point.id}
                    className="relative p-6 border border-[#e0dcd4] rounded-[1.5rem] bg-[#fcfbf9] group hover:border-[#8b6f47]/40 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => removeMeetupPoint(point.id)}
                      className="absolute top-5 right-5 p-2 bg-white rounded-full text-[#b44d4d]/70 hover:text-[#b44d4d] hover:bg-red-50 transition-all border border-transparent hover:border-red-100"
                      title="Remove Location"
                    >
                      <Trash2 size={16} />
                    </button>

                    <h4 className="text-xs font-bold text-[#8b6f47] uppercase tracking-[0.15em] mb-4 pr-10">
                      Location Option {index + 1}
                    </h4>

                    <div className="grid sm:grid-cols-2 gap-5">
                      <Field label="Point Name" hint="e.g. Rethymno Center">
                        <input
                          value={point.name}
                          onChange={(e) =>
                            updateMeetupPoint(point.id, "name", e.target.value)
                          }
                          className={inputClass}
                          placeholder="Rethymno Center"
                        />
                      </Field>

                      <Field
                        label="Google Map Address"
                        hint="Must be exact for map embeds."
                      >
                        <input
                          value={point.mapPin}
                          onChange={(e) =>
                            updateMeetupPoint(
                              point.id,
                              "mapPin",
                              e.target.value,
                            )
                          }
                          className={inputClass}
                          placeholder="Arkadiou 10, Rethymno 741 00"
                        />
                      </Field>

                      <Field
                        label="Arrival Instructions"
                        className="sm:col-span-2"
                      >
                        <textarea
                          value={point.instructions}
                          onChange={(e) =>
                            updateMeetupPoint(
                              point.id,
                              "instructions",
                              e.target.value,
                            )
                          }
                          rows={2}
                          className={inputClass}
                          placeholder="Wait by the large fountain. Guide wears a beige hat."
                        />
                      </Field>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Section: Guest Reviews Builder */}
          <div className="rounded-[2rem] border border-[#e6e0d8] bg-white p-6 sm:p-8 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e6e0d8] pb-4 mb-6">
              <div>
                <h2 className="font-serif text-2xl text-[#3a2f28]">
                  Guest Reviews
                </h2>
                <p className="text-sm text-[#7a6a5f] mt-1">
                  Add curated past reviews to build trust.
                </p>
              </div>
              <button
                type="button"
                onClick={addReview}
                className="flex items-center gap-2 px-4 py-2 bg-[#fcfbf9] border border-[#e0dcd4] text-[#3a2f28] text-sm font-medium rounded-full hover:bg-[#f1ede7] transition-colors shadow-sm shrink-0"
              >
                <Plus size={16} /> Add Review
              </button>
            </div>

            <div className="space-y-4">
              {reviews.length === 0 ? (
                <div className="p-10 text-center border-2 border-dashed border-[#e6e0d8] rounded-[1.5rem] bg-[#fcfbf9]">
                  <MessageSquare
                    className="mx-auto text-[#c5b9aa] mb-3"
                    size={28}
                  />
                  <p className="text-sm text-[#7a6a5f] font-medium">
                    No reviews added yet.
                  </p>
                </div>
              ) : (
                reviews.map((review) => (
                  <div
                    key={review.id}
                    className="relative p-5 pr-12 border border-[#e0dcd4] rounded-2xl bg-white shadow-sm flex flex-col sm:flex-row gap-4 items-start"
                  >
                    <button
                      type="button"
                      onClick={() => removeReview(review.id)}
                      className="absolute top-4 right-4 p-2 text-[#b44d4d]/70 hover:text-[#b44d4d] hover:bg-red-50 rounded-full transition-colors"
                      title="Delete Review"
                    >
                      <Trash2 size={16} />
                    </button>

                    <div className="w-full sm:w-1/3">
                      <input
                        value={review.name}
                        onChange={(e) =>
                          updateReview(review.id, "name", e.target.value)
                        }
                        className={`${inputClass} !py-2`}
                        placeholder="Guest Name (e.g. Sarah M.)"
                      />
                    </div>
                    <div className="w-full sm:w-2/3">
                      <textarea
                        value={review.comment}
                        onChange={(e) =>
                          updateReview(review.id, "comment", e.target.value)
                        }
                        rows={2}
                        className={`${inputClass} !py-2`}
                        placeholder="An amazing, authentic experience..."
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Section: Image Gallery */}
          <div className="rounded-[2rem] border border-[#e6e0d8] bg-white shadow-sm overflow-hidden">
            <div className="px-6 sm:px-8 py-6 border-b border-[#e6e0d8] bg-[#fcfbf9] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-serif text-[#3a2f28]">
                  Image Gallery
                </h3>
                <p className="text-sm text-[#7a6a5f] mt-1">
                  Upload high-quality photos. The first acts as the cover.
                </p>
              </div>
              <button
                type="button"
                onClick={openCloudinaryWidget}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#1a1a1a] text-white text-sm font-medium shadow-sm hover:bg-[#333] transition-colors shrink-0"
              >
                <Upload size={16} /> Upload Media
              </button>
            </div>

            <div className="p-6 sm:p-8">
              {images.length === 0 ? (
                <div className="p-12 text-center border-2 border-dashed border-[#e6e0d8] rounded-[1.5rem] bg-[#fdfaf7]">
                  <ImageIcon
                    className="mx-auto text-[#c5b9aa] mb-4"
                    size={40}
                  />
                  <p className="text-sm text-[#7a6a5f] font-medium">
                    No media uploaded.
                  </p>
                  <p className="text-xs text-[#a1978d] mt-1">
                    Click the button above to select images.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {images.map((img, i) => (
                    <div
                      key={i}
                      className="relative aspect-square rounded-2xl overflow-hidden border border-[#e8e2d8] group bg-[#f4f1ec] shadow-sm"
                    >
                      {i === 0 && (
                        <div className="absolute top-2 left-2 z-10 bg-[#8b6f47] text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg shadow-sm">
                          Cover
                        </div>
                      )}
                      <img
                        src={img}
                        alt={`Gallery Image ${i + 1}`}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute top-2 right-2 p-2 rounded-full text-white bg-black/50 hover:bg-red-600 shadow-sm transition-all opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0"
                        title="Remove Image"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Right Column: Sticky Preview Card 
          FIXED: Adjusted top-28 to top-40 so it doesn't collide with the newly lowered top bar
        */}
        <aside className="lg:col-span-4 relative mt-4 lg:mt-0 z-10">
          <div className="lg:sticky lg:top-40 rounded-[2rem] border border-[#e6e0d8] bg-white p-6 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] flex flex-col max-h-none lg:max-h-[calc(100vh-10rem)]">
            <div className="flex items-center justify-between mb-5 shrink-0">
              <h3 className="font-serif text-lg text-[#3a2f28]">
                Card Preview
              </h3>
              <span
                className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${visibility ? "bg-[#f4f8f4] text-[#4a7854] border border-[#d3e3d3]" : "bg-[#f6f4f0] text-[#7a6a5f] border border-[#e6e0d8]"}`}
              >
                {status}
              </span>
            </div>

            <div className="overflow-y-auto pr-1 pb-1 -mr-1 no-scrollbar shrink-0">
              <div className="overflow-hidden rounded-[1.5rem] border border-[#e6e0d8] bg-white shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
                <div className="relative h-48 sm:h-56 w-full bg-[#f4f1ec]">
                  {images[0] ? (
                    <img
                      src={images[0]}
                      alt="Cover preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center text-[#c5b9aa] gap-2">
                      <ImageIcon size={32} />
                      <span className="text-xs font-medium">Cover Image</span>
                    </div>
                  )}

                  {location && (
                    <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                      <MapPin size={10} /> {location}
                    </div>
                  )}
                </div>

                <div className="p-5 flex flex-col min-h-[160px]">
                  <div className="flex-1">
                    <h4 className="font-serif text-xl text-[#1A1A1A] mb-2 leading-tight line-clamp-2">
                      {name || "Experience Title..."}
                    </h4>
                    <p className="text-sm text-[#7a6a5f] line-clamp-2 leading-relaxed">
                      {whyYoullLove ||
                        "Write a compelling reason why guests will absolutely love this experience..."}
                    </p>
                  </div>

                  <div className="mt-4 pt-4 border-t border-[#e6e0d8] flex items-center justify-between shrink-0">
                    <div className="flex flex-col gap-1">
                      {reviews.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Star
                            size={12}
                            className="fill-[#8b6f47] text-[#8b6f47]"
                          />
                          <span className="text-[11px] font-bold text-[#3a2f28]">
                            4.9{" "}
                            <span className="text-[#a1978d] font-normal">
                              ({reviews.length})
                            </span>
                          </span>
                        </div>
                      )}
                      <span className="text-xs font-medium text-[#7a6a5f] flex items-center gap-1.5">
                        <Clock size={12} /> {duration || "TBD"}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase tracking-wider text-[#a1978d] block mb-0.5">
                        From
                      </span>
                      <span className="font-serif text-lg text-[#1A1A1A]">
                        {priceAdult ? `€${Number(priceAdult)}` : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-[#fcfbf9] border border-[#e6e0d8] rounded-2xl flex items-start gap-3 shrink-0">
              <Info size={16} className="text-[#8b6f47] shrink-0 mt-0.5" />
              <p className="text-[11px] text-[#7a6a5f] leading-relaxed">
                This preview shows how the primary card will look on the public
                catalog. Make sure your cover image and title are compelling.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
