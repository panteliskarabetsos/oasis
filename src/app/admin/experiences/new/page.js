// src/app/admin/experiences/new/page.js
"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
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
  Compass,
  FileText,
  ShieldCheck,
  CheckCircle2,
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
  <div className={`flex flex-col gap-1.5 ${className}`}>
    <label className="text-[10px] font-bold uppercase tracking-wider text-[#a09084] flex items-center gap-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {hint && <p className="text-[10px] text-[#8b6f47] font-medium">{hint}</p>}
  </div>
);

const inputClass =
  "w-full p-3 rounded-xl border border-[#e0dcd4] bg-[#fdfcfb] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/30 text-[#3a2f28] placeholder:text-[#a09084] shadow-sm transition-all";

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
  // Defaulting to "strict" to match your bespoke Oasis policy
  const [cancellationPolicy, setCancellationPolicy] = useState("strict");
  const [images, setImages] = useState([]);

  // Dynamic Arrays
  const [meetupPoints, setMeetupPoints] = useState([]);
  const [reviews, setReviews] = useState([]);

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
  /* --- Dynamic Array Handlers --- */
  const addMeetupPoint = () =>
    setMeetupPoints((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        name: "",
        mapPin: "",
        instructions: "",
        time: "",
      },
    ]);
  const updateMeetupPoint = (id, field, value) =>
    setMeetupPoints((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
    );
  const removeMeetupPoint = (id) =>
    setMeetupPoints((prev) => prev.filter((p) => p.id !== id));

  const addReview = () =>
    setReviews((prev) => [
      ...prev,
      { id: Date.now().toString(), name: "", comment: "" },
    ]);
  const updateReview = (id, field, value) =>
    setReviews((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    );
  const removeReview = (id) =>
    setReviews((prev) => prev.filter((r) => r.id !== id));

  /* --- Submit --- */
  async function submit(e, publish = false) {
    e?.preventDefault?.();
    if (!canSubmit)
      return toast.error("Please fill the required fields correctly.");

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
        cancellationPolicy,
        images,
        meetupPoints: cleanedMeetupPoints,
        guestReviews: cleanedReviews,
        frequency,
        visibility: finalVisibility,
        priceAdult: priceAdult === "" ? 85 : Number(priceAdult),
        priceKid: priceKid === "" ? null : Number(priceKid),
        updatedAt: new Date().toISOString(),
      };

      if (!payload.slug)
        return toast.error(
          "Slug could not be generated. Please enter a valid name.",
        );

      const res = await fetch("/api/admin/experiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify(payload),
      });

      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({})))?.error ||
            "Could not create experience.",
        );

      const created = await res.json();
      toast.success(
        publish ? "Published successfully!" : "Draft saved securely.",
      );

      if (created?.id) router.push(`/admin/experiences/${created.id}`);
      else router.push(`/admin/experiences?toast=saved`);
    } catch (err) {
      toast.error(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
      setPublishing(false);
    }
  }

  /* --- Image Upload --- */
  const openCloudinaryWidget = () => {
    const cloudName =
      process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "docgxigth";
    const uploadPreset =
      process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "ml_default";

    if (typeof window === "undefined" || !window.cloudinary)
      return toast.error("Cloudinary widget script is not loaded.");
    if (!cloudName) return toast.error("Cloud name is missing.");

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

  const removeImage = (index) =>
    setImages((prev) => prev.filter((_, i) => i !== index));

  return (
    <main className="min-h-screen bg-[#fdfcfb] text-[#3f3127] selection:bg-[#8b6f47]/20 pb-24 relative overflow-hidden">
      <Script
        src="https://widget.cloudinary.com/v2.0/global/all.js"
        strategy="lazyOnload"
      />

      {/* Ambient background decoration */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-[#8b6f47]/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[50%] h-[50%] rounded-full bg-[#e3ddd2]/30 blur-[100px]" />
      </div>

      {/* Sticky Header */}
      <div className="sticky top-0 z-30 border-b border-[#e3ddd2] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              onClick={() => router.back()}
              className="flex items-center justify-center w-10 h-10 rounded-full border border-[#e3ddd2] bg-[#fdfaf5] text-[#5a4a3f] hover:bg-[#f5f1ea] transition-colors shrink-0"
              title="Back"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#a09084]">
                New Offering
              </span>
              <div className="flex items-center text-sm font-semibold text-[#3f3127] truncate">
                Create Experience
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <button
              onClick={(e) => submit(e, false)}
              disabled={!canSubmit || loading || publishing}
              className="rounded-xl border border-[#e3ddd2] bg-white px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-[#3f3127] hover:bg-[#fdfaf5] disabled:opacity-50 transition-colors shadow-sm flex items-center gap-2"
            >
              {loading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Check size={14} />
              )}{" "}
              <span className="hidden sm:inline">Save Draft</span>
            </button>
            <button
              onClick={(e) => submit(e, true)}
              disabled={!canSubmit || loading || publishing}
              className="rounded-xl bg-[#1A1A1A] px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#C8AA86] disabled:opacity-50 transition-colors shadow-lg flex items-center gap-2"
            >
              {publishing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Upload size={14} />
              )}{" "}
              <span className="hidden sm:inline">Publish Live</span>
            </button>
          </div>
        </div>
      </div>

      <div className="relative z-10 mx-auto grid max-w-7xl grid-cols-1 lg:grid-cols-12 gap-8 px-4 sm:px-8 pt-8 items-start">
        {/* Left Column: Form (8 cols) */}
        <form className="lg:col-span-8 space-y-8 flex flex-col">
          {/* Basic Information */}
          <div className="rounded-[2rem] border border-[#e3ddd2] bg-white p-6 sm:p-8 shadow-sm space-y-6">
            <div className="border-b border-[#e3ddd2] pb-4 flex items-center gap-2">
              <FileText size={18} className="text-[#8b6f47]" />
              <h2 className="font-serif text-xl text-[#3a2f28]">
                Basic Information
              </h2>
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
                className={`${inputClass} resize-none`}
                placeholder="Immerse yourself in the authentic rhythm of Cretan life..."
              />
            </Field>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 p-5 bg-[#fdfcfb] rounded-2xl border border-[#e3ddd2]">
              <Field label="Duration">
                <input
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. 4 Hours"
                />
              </Field>
              <Field label="Adult Price (€)" required>
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
              <Field label="Child Price (€)">
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

            <div className="flex items-center justify-between p-4 rounded-xl border border-[#e3ddd2] bg-[#fdfaf5]">
              <span className="text-sm font-semibold text-[#3a2f28]">
                Make this experience public
              </span>
              <button
                type="button"
                onClick={() => setVisibility((v) => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${visibility ? "bg-[#8b6f47]" : "bg-gray-300"}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${visibility ? "translate-x-6" : "translate-x-1"}`}
                />
              </button>
            </div>
          </div>

          {/* Booking Policies */}
          <div className="rounded-[2rem] border border-[#e3ddd2] bg-white p-6 sm:p-8 shadow-sm space-y-6">
            <div className="border-b border-[#e3ddd2] pb-4 flex items-center gap-2">
              <ShieldCheck size={18} className="text-[#8b6f47]" />
              <h2 className="font-serif text-xl text-[#3a2f28]">
                Booking Policies
              </h2>
            </div>

            <Field
              label="Cancellation Policy"
              hint="Select the refund rules that apply to this specific experience."
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
                {[
                  {
                    id: "flexible",
                    name: "Flexible",
                    desc: "Full refund up to 48 hours before the experience starts.",
                  },
                  {
                    id: "moderate",
                    name: "Moderate",
                    desc: "Full refund up to 7 days before, 50% refund up to 48 hours before.",
                  },
                  {
                    id: "strict",
                    name: "Strict (Oasis Bespoke)",
                    desc: "100% refund up to 14 days, 50% refund 7-13 days, no refund under 7 days.",
                  },
                ].map((policy) => (
                  <button
                    key={policy.id}
                    type="button"
                    onClick={() => setCancellationPolicy(policy.id)}
                    className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col h-full ${
                      cancellationPolicy === policy.id
                        ? "bg-[#fdfaf5] border-[#8b6f47] ring-1 ring-[#8b6f47] shadow-sm"
                        : "bg-white border-[#e3ddd2] hover:border-[#a09084] hover:bg-[#fdfcfb]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`text-[11px] font-bold uppercase tracking-wider ${cancellationPolicy === policy.id ? "text-[#8b6f47]" : "text-[#3a2f28]"}`}
                      >
                        {policy.name}
                      </span>
                      {cancellationPolicy === policy.id && (
                        <CheckCircle2
                          size={16}
                          className="text-[#8b6f47] shrink-0"
                        />
                      )}
                    </div>
                    <p className="text-xs text-[#7a6a5f] leading-relaxed font-medium mt-auto">
                      {policy.desc}
                    </p>
                  </button>
                ))}
              </div>
            </Field>
          </div>

          {/* Itinerary & Logistics */}
          <div className="rounded-[2rem] border border-[#e3ddd2] bg-white p-6 sm:p-8 shadow-sm space-y-6">
            <div className="border-b border-[#e3ddd2] pb-4 flex items-center gap-2">
              <Compass size={18} className="text-[#8b6f47]" />
              <h2 className="font-serif text-xl text-[#3a2f28]">
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
                className={`${inputClass} resize-none`}
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
                  className={`${inputClass} resize-none`}
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
                  className={`${inputClass} resize-none`}
                  placeholder="Comfortable closed-toe shoes&#10;Sunscreen&#10;A light jacket"
                />
              </Field>
            </div>

            <Field
              label="Availability Schedule"
              className="pt-4 border-t border-[#e3ddd2]"
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
                      className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all ${
                        isActive
                          ? "bg-[#8b6f47] border-[#8b6f47] text-white shadow-sm"
                          : "bg-white border-[#e3ddd2] text-[#5a4a3f] hover:bg-[#fdfaf5]"
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>

          {/* Meeting Points */}
          <div className="rounded-[2rem] border border-[#e3ddd2] bg-white p-6 sm:p-8 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e3ddd2] pb-4 mb-6">
              <div className="flex items-center gap-2">
                <MapPin size={18} className="text-[#8b6f47]" />
                <h2 className="font-serif text-xl text-[#3a2f28]">
                  Meeting Points
                </h2>
              </div>
              <button
                type="button"
                onClick={addMeetupPoint}
                className="flex items-center gap-2 px-4 py-2 bg-[#fdfcfb] border border-[#e3ddd2] text-[#3a2f28] text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-[#fdfaf5] transition-colors shadow-sm shrink-0"
              >
                <Plus size={14} /> Add Location
              </button>
            </div>

            <div className="space-y-4">
              {meetupPoints.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-[#e3ddd2] rounded-2xl bg-[#fdfcfb]">
                  <p className="text-sm text-[#a09084] font-medium">
                    No meeting locations defined yet.
                  </p>
                </div>
              ) : (
                meetupPoints.map((point, index) => (
                  <div
                    key={point.id}
                    className="relative p-6 border border-[#e3ddd2] rounded-2xl bg-[#fdfcfb] group hover:border-[#8b6f47]/40 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => removeMeetupPoint(point.id)}
                      className="absolute top-4 right-4 p-2 rounded-full text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Remove Location"
                    >
                      <Trash2 size={16} />
                    </button>
                    <h4 className="text-[10px] font-bold text-[#8b6f47] uppercase tracking-[0.15em] mb-4 pr-10">
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

                      {/* --- ADDED: Pickup Time Field --- */}
                      <Field label="Pickup Time" hint="e.g. 08:30 AM">
                        <input
                          value={point.time || ""}
                          onChange={(e) =>
                            updateMeetupPoint(point.id, "time", e.target.value)
                          }
                          className={inputClass}
                          placeholder="08:30 AM"
                        />
                      </Field>

                      <Field
                        label="Google Map Coordinates"
                        hint="Must be exact lat, lng for the map."
                        className="sm:col-span-2" // <-- Spans both columns now
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
                          placeholder="35.513980, 24.020404"
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
                          className={`${inputClass} resize-none`}
                          placeholder="Wait by the large fountain. Guide wears a beige hat."
                        />
                      </Field>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Guest Reviews */}
          <div className="rounded-[2rem] border border-[#e3ddd2] bg-white p-6 sm:p-8 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e3ddd2] pb-4 mb-6">
              <div className="flex items-center gap-2">
                <MessageSquare size={18} className="text-[#8b6f47]" />
                <h2 className="font-serif text-xl text-[#3a2f28]">
                  Guest Reviews
                </h2>
              </div>
              <button
                type="button"
                onClick={addReview}
                className="flex items-center gap-2 px-4 py-2 bg-[#fdfcfb] border border-[#e3ddd2] text-[#3a2f28] text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-[#fdfaf5] transition-colors shadow-sm shrink-0"
              >
                <Plus size={14} /> Add Review
              </button>
            </div>

            <div className="space-y-4">
              {reviews.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-[#e3ddd2] rounded-2xl bg-[#fdfcfb]">
                  <p className="text-sm text-[#a09084] font-medium">
                    No reviews added yet.
                  </p>
                </div>
              ) : (
                reviews.map((review) => (
                  <div
                    key={review.id}
                    className="relative p-5 pr-12 border border-[#e3ddd2] rounded-2xl bg-white shadow-sm flex flex-col sm:flex-row gap-4 items-start"
                  >
                    <button
                      type="button"
                      onClick={() => removeReview(review.id)}
                      className="absolute top-4 right-4 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
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
                        placeholder="Guest Name"
                      />
                    </div>
                    <div className="w-full sm:w-2/3">
                      <textarea
                        value={review.comment}
                        onChange={(e) =>
                          updateReview(review.id, "comment", e.target.value)
                        }
                        rows={2}
                        className={`${inputClass} !py-2 resize-none`}
                        placeholder="An amazing, authentic experience..."
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Image Gallery */}
          <div className="rounded-[2rem] border border-[#e3ddd2] bg-white shadow-sm overflow-hidden mb-8">
            <div className="px-6 sm:px-8 py-5 border-b border-[#e3ddd2] bg-[#fdfcfb] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <ImageIcon size={18} className="text-[#8b6f47]" />
                <h2 className="font-serif text-xl text-[#3a2f28]">
                  Image Gallery
                </h2>
              </div>
              <button
                type="button"
                onClick={openCloudinaryWidget}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#1A1A1A] text-white text-xs font-bold uppercase tracking-wider shadow-sm hover:bg-[#333] transition-colors shrink-0"
              >
                <Upload size={14} /> Upload Media
              </button>
            </div>

            <div className="p-6 sm:p-8">
              {images.length === 0 ? (
                <div className="p-12 text-center border border-dashed border-[#e3ddd2] rounded-2xl bg-[#fdfcfb]">
                  <ImageIcon
                    className="mx-auto text-[#e3ddd2] mb-3"
                    size={32}
                  />
                  <p className="text-sm text-[#a09084] font-medium">
                    No media uploaded.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {images.map((img, i) => (
                    <div
                      key={i}
                      className="relative aspect-square rounded-2xl overflow-hidden border border-[#e3ddd2] group bg-[#fdfaf5] shadow-sm"
                    >
                      {i === 0 && (
                        <div className="absolute top-2 left-2 z-10 bg-[#8b6f47] text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md shadow-sm">
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

        {/* Right Column: Sticky Preview Card */}
        <aside className="lg:col-span-4 relative mt-4 lg:mt-0 z-10">
          <div className="lg:sticky lg:top-28 rounded-[2rem] border border-[#e3ddd2] bg-white p-6 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-5 shrink-0 border-b border-[#e3ddd2] pb-4">
              <h3 className="font-serif text-lg text-[#3a2f28]">
                Card Preview
              </h3>
              <span
                className={`rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border ${visibility ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}
              >
                {visibility ? "Published" : "Draft"}
              </span>
            </div>

            <div className="overflow-hidden rounded-[1.5rem] border border-[#e3ddd2] bg-white shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
              <div className="relative h-48 sm:h-56 w-full bg-[#fdfcfb]">
                {images[0] ? (
                  <img
                    src={images[0]}
                    alt="Cover preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center text-[#e3ddd2] gap-2">
                    <ImageIcon size={32} />
                    <span className="text-xs font-medium text-[#a09084]">
                      Cover Image
                    </span>
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

                <div className="mt-4 pt-4 border-t border-[#e3ddd2] flex items-center justify-between shrink-0">
                  <div className="flex flex-col gap-1">
                    {reviews.length > 0 && (
                      <div className="flex items-center gap-1">
                        <Star
                          size={12}
                          className="fill-[#8b6f47] text-[#8b6f47]"
                        />
                        <span className="text-[11px] font-bold text-[#3a2f28]">
                          4.9{" "}
                          <span className="text-[#a09084] font-normal">
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
                    <span className="text-[10px] uppercase tracking-wider text-[#a09084] block mb-0.5">
                      From
                    </span>
                    <span className="font-serif text-lg text-[#1A1A1A]">
                      {priceAdult ? `€${Number(priceAdult)}` : "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-[#fdfaf5] border border-[#e3ddd2] rounded-xl flex items-start gap-3 shrink-0">
              <Info size={16} className="text-[#8b6f47] shrink-0 mt-0.5" />
              <p className="text-[11px] text-[#7a6a5f] leading-relaxed">
                This preview shows how the primary card will look on the public
                catalog. Make sure your cover image and title are compelling.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
