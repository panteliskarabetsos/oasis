// src/app/admin/experiences/[id]/page.js
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Script from "next/script";
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
  Eye,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/app/components/SessionWrapper";

/* ---------------------------- helpers ---------------------------- */
function makeSlug(text = "") {
  return text
    .toString()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 80);
}

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

export default function AdminExperienceEditPage() {
  const router = useRouter();
  const params = useParams();
  const { loading: authLoading } = useAuth();

  const id = useMemo(() => {
    const raw = params?.id;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params]);

  // Loading & Action States
  const [isFetching, setIsFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Modals
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  // DB fields
  const [experienceId, setExperienceId] = useState(null);
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
  const [cancellationPolicy, setCancellationPolicy] = useState("strict");
  const [images, setImages] = useState([]);

  // Dynamic Arrays
  const [meetupPoints, setMeetupPoints] = useState([]);
  const [reviews, setReviews] = useState([]);

  // derived UI
  const [status, setStatus] = useState("published");
  const [slugTouched, setSlugTouched] = useState(true); // Default true for edits

  useEffect(() => {
    setStatus(visibility ? "published" : "draft");
  }, [visibility]);

  // Fetch Experience Data
  useEffect(() => {
    if (!id || authLoading) return;
    let cancelled = false;

    async function fetchOne() {
      setIsFetching(true);
      try {
        let res = await fetch(`/api/admin/experiences/${id}`, {
          cache: "no-store",
        });
        if (res.status === 401 || res.status === 403)
          return router.replace("/");

        if (res.ok) {
          const data = await res.json();
          if (!cancelled) applyIncoming(data);
          return;
        }

        res = await fetch(
          `/api/admin/experiences?id=${encodeURIComponent(id)}`,
          { cache: "no-store" },
        );
        if (res.ok) {
          const data = await res.json();
          const one = Array.isArray(data)
            ? data.find((e) => `${e.id}` === `${id}`)
            : data;
          if (one && !cancelled) applyIncoming(one);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setIsFetching(false);
      }
    }

    const applyIncoming = (obj) => {
      if (!obj) return;

      setExperienceId(obj.id);
      setName(obj.name || "");
      setSlug(obj.slug || "");
      setDescription(obj.description || "");
      setLocation(obj.location || "Chania, Crete");
      setDuration(obj.duration || "");
      setPriceAdult(obj.priceAdult ?? "");
      setPriceKid(obj.priceKid ?? "");
      setWhatsIncluded(obj.whatsIncluded || "");
      setWhatToBring(obj.whatToBring || "");
      setWhyYoullLove(obj.whyYoullLove || "");
      setVisibility(obj.visibility ?? true);
      setFrequency(obj.frequency || []);
      setCancellationPolicy(obj.cancellationPolicy || "strict"); // Load saved policy

      // Normalize Images
      setImages(
        Array.isArray(obj.images) ? obj.images : obj.images ? [obj.images] : [],
      );

      // Handle Meetup Points
      setMeetupPoints(Array.isArray(obj.meetupPoints) ? obj.meetupPoints : []);

      // Handle Reviews (Migrate old string arrays to new object format safely)
      const fetchedReviews = Array.isArray(obj.guestReviews)
        ? obj.guestReviews
        : obj.guestReviews && typeof obj.guestReviews === "object"
          ? Object.values(obj.guestReviews)
          : [];

      const formattedReviews = fetchedReviews.map((r, i) => {
        if (typeof r === "string")
          return { id: `old-${i}`, name: "Guest", comment: r };
        return {
          id: r.id || `rev-${i}`,
          name: r.name || "Guest",
          comment: r.comment || "",
        };
      });
      setReviews(formattedReviews);
    };

    fetchOne();
    return () => {
      cancelled = true;
    };
  }, [id, authLoading, router]);

  /* --- Input Handlers --- */
  const handleNameChange = (e) => {
    const newName = e.target.value;
    setName(newName);
    if (!slugTouched) {
      setSlug(makeSlug(newName));
    }
  };

  function toggleDay(day) {
    setFrequency((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }

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
  const canSubmit = name.trim().length >= 3 && slug.trim().length >= 3;

  async function submit(e, publish = false) {
    e?.preventDefault?.();
    if (!canSubmit) {
      toast.error("Please fill the required fields correctly.");
      return;
    }

    const finalVisibility = publish ? true : false;
    publish ? setPublishing(true) : setSaving(true);

    try {
      const cleanedMeetupPoints = meetupPoints
        .filter((p) => p.name.trim() || p.mapPin.trim())
        .map((p) => ({
          ...p,
          time: p.time?.trim() || "",
        }));
      const cleanedReviews = reviews
        .filter((r) => r.comment.trim())
        .map(({ name, comment }) => ({
          name: name.trim() || "Guest",
          comment: comment.trim(),
        }));

      const payload = {
        id: experienceId,
        name: name.trim(),
        slug: makeSlug(slug),
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

      const res = await fetch(`/api/admin/experiences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save changes.");
      }

      toast.success(publish ? "Published successfully!" : "Changes saved.");
      setVisibility(finalVisibility);
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Something went wrong.");
    } finally {
      setSaving(false);
      setPublishing(false);
    }
  }

  /* --- Delete Handling --- */
  const handleDeleteExperience = async () => {
    if (!experienceId) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/admin/experiences`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: experienceId }),
      });
      if (!res.ok) throw new Error("Failed to delete.");
      router.push(`/admin/experiences?toast=deleted`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDeleting(false);
    }
  };

  /* --- Image Upload --- */
  const openCloudinaryWidget = () => {
    const cloudName =
      process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "docgxigth";
    const uploadPreset =
      process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "ml_default";

    if (typeof window === "undefined" || !window.cloudinary) {
      toast.error("Cloudinary widget script is not loaded on this page.");
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

  const removeImage = (index) =>
    setImages((prev) => prev.filter((_, i) => i !== index));

  if (isFetching || authLoading) {
    return (
      <main className="min-h-screen bg-[#fdfcf8] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="animate-spin text-[#8b6f47]" size={28} />
          <span className="text-[#5a4a3f] font-serif text-lg">
            Loading Experience…
          </span>
        </div>
      </main>
    );
  }

  const inputClass =
    "w-full min-w-0 rounded-xl border border-[#e0dcd4] bg-white px-4 py-2.5 text-sm text-[#3a2f28] placeholder:text-[#a1978d] outline-none transition-all focus:border-[#8b6f47] focus:ring-1 focus:ring-[#8b6f47] shadow-sm";

  return (
    <div className="relative pb-24 bg-[#fdfcf8] min-h-screen pt-4">
      <Script
        src="https://widget.cloudinary.com/v2.0/global/all.js"
        strategy="lazyOnload"
      />

      {/* Top controls (Sticky) */}
      <div className="sticky top-20 lg:top-24 z-20 mx-auto mb-8 max-w-7xl px-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#e6e0d8] bg-white/90 backdrop-blur-md px-4 py-3 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 rounded-full border border-[#e0dcd4] bg-[#fdfaf7] px-4 py-2 text-sm font-medium text-[#5a4a3f] hover:bg-[#f1ede7] transition-colors shrink-0"
            >
              <ArrowLeft size={16} /> Back
            </button>
            <button
              onClick={() => setPreviewOpen(true)}
              className="hidden sm:inline-flex items-center gap-2 rounded-full border border-[#e0dcd4] bg-white px-4 py-2 text-sm font-medium text-[#5a4a3f] hover:bg-[#f6f4f0] transition-colors shrink-0"
            >
              <Eye size={16} /> Full Preview
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <button
              onClick={() => setDeleteOpen(true)}
              className="p-2 sm:px-4 sm:py-2 rounded-full border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors shadow-sm text-sm font-medium flex items-center gap-2"
            >
              <Trash2 size={16} />{" "}
              <span className="hidden sm:inline">Delete</span>
            </button>

            <button
              onClick={(e) => submit(e, false)}
              disabled={!canSubmit || saving || publishing}
              className="rounded-full border border-[#e0dcd4] bg-white px-4 sm:px-5 py-2 text-sm font-medium text-[#5a4a3f] hover:bg-[#f6f4f0] disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 transition-colors shadow-sm"
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Check size={16} />
              )}
              Save Changes
            </button>

            <button
              onClick={(e) => submit(e, true)}
              disabled={!canSubmit || saving || publishing}
              className="rounded-full bg-[#8b6f47] px-4 sm:px-6 py-2 text-sm font-medium text-white hover:bg-[#735b38] disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 transition-colors shadow-md"
            >
              {publishing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Upload size={16} />
              )}
              Publish
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
            </div>

            <Field label="Experience Name" required>
              <input
                value={name}
                onChange={handleNameChange}
                className={inputClass}
                placeholder="e.g. Traditional Olive Harvest"
              />
            </Field>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <Field label="URL Slug" required>
                <div className="flex items-center gap-2">
                  <input
                    value={slug}
                    onChange={(e) => {
                      setSlug(e.target.value);
                      setSlugTouched(true);
                    }}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSlug(makeSlug(name));
                      setSlugTouched(true);
                    }}
                    className="px-4 py-2 rounded-xl border border-[#dcd2c3] bg-[#f7f4ef] hover:bg-[#efeae2] text-sm font-medium shrink-0"
                  >
                    Auto
                  </button>
                </div>
              </Field>
              <Field label="General Location">
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>

            <Field label="Full Description">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className={inputClass}
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

          {/* Section: Booking Policies */}
          <div className="rounded-[2rem] border border-[#e6e0d8] bg-white p-6 sm:p-8 shadow-sm space-y-6">
            <div className="border-b border-[#e6e0d8] pb-4 mb-2">
              <h2 className="font-serif text-2xl text-[#3a2f28]">
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
                        ? "bg-[#fcfbf9] border-[#8b6f47] ring-1 ring-[#8b6f47] shadow-sm"
                        : "bg-white border-[#e6e0d8] hover:border-[#b8a99a] hover:bg-[#fcfbf9]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`text-xs font-bold uppercase tracking-wider ${cancellationPolicy === policy.id ? "text-[#8b6f47]" : "text-[#5a4a3f]"}`}
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

          {/* Section: Itinerary & Logistics */}
          <div className="rounded-[2rem] border border-[#e6e0d8] bg-white p-6 sm:p-8 shadow-sm space-y-6">
            <div className="border-b border-[#e6e0d8] pb-4 mb-2">
              <h2 className="font-serif text-2xl text-[#3a2f28]">
                Itinerary & Details
              </h2>
            </div>

            <Field label="Why Guests Will Love It">
              <textarea
                value={whyYoullLove}
                onChange={(e) => setWhyYoullLove(e.target.value)}
                rows={3}
                className={inputClass}
              />
            </Field>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <Field
                label="What’s Included"
                hint="Break items by pressing Enter."
              >
                <textarea
                  value={whatsIncluded}
                  onChange={(e) => setWhatsIncluded(e.target.value)}
                  rows={5}
                  className={inputClass}
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
                      className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${isActive ? "bg-[#8b6f47] border-[#8b6f47] text-white shadow-sm" : "bg-white border-[#e0dcd4] text-[#5a4a3f] hover:bg-[#f6f4f0]"}`}
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
              <h2 className="font-serif text-2xl text-[#3a2f28]">
                Meeting Points
              </h2>
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
                      <Field label="Point Name">
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
                      <Field label="Pickup Time">
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
                        label="Google Map Address"
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
                          className={inputClass}
                          placeholder="Wait by the fountain."
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
              <h2 className="font-serif text-2xl text-[#3a2f28]">
                Guest Reviews
              </h2>
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
                        className={`${inputClass} !py-2`}
                        placeholder="An amazing experience..."
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
              <h3 className="text-xl font-serif text-[#3a2f28]">
                Image Gallery
              </h3>
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

        {/* Right Column: Sticky Preview Card */}
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
                Make sure your cover image and title are compelling before
                saving changes.
              </p>
            </div>
          </div>
        </aside>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          onClick={() => setDeleteOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-[2rem] bg-white shadow-2xl overflow-hidden border border-[#e6e0d8]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 sm:p-8 space-y-5 text-center">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-2">
                <Trash2 size={28} />
              </div>
              <h3 className="text-2xl font-serif text-[#3a2f28]">
                Delete Experience?
              </h3>
              <p className="text-[#555] leading-relaxed text-sm">
                This will permanently delete <strong>{name}</strong> and all
                associated data. This action cannot be undone.
              </p>

              <div className="bg-[#fcfbf9] border border-[#e6e0d8] rounded-2xl p-4 text-left">
                <p className="text-xs text-[#7a6a5f] font-medium mb-2">
                  Please type{" "}
                  <span className="font-bold text-[#3a2f28]">DELETE</span> to
                  confirm:
                </p>
                <input
                  autoFocus
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className={inputClass}
                  placeholder="DELETE"
                />
              </div>
            </div>

            <div className="p-4 sm:px-8 sm:pb-8 flex flex-col-reverse sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                className="flex-1 py-3 rounded-full text-sm font-medium border border-[#e0dcd4] text-[#5a4a3f] hover:bg-[#f6f4f0] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirmText !== "DELETE" || deleting}
                onClick={handleDeleteExperience}
                className="flex-1 py-3 rounded-full text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed transition-colors"
              >
                {deleting ? "Deleting…" : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Preview Modal (Optional View) */}
      {previewOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="bg-white rounded-[2rem] w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewOpen(false)}
              className="sticky top-4 left-[calc(100%-3rem)] bg-white shadow-md p-2 rounded-full border border-[#e6e0d8] hover:bg-gray-50 z-10"
            >
              ✕
            </button>
            <div className="p-8 sm:p-12 text-center space-y-6">
              <h2 className="font-serif text-4xl text-[#3a2f28]">{name}</h2>
              <p className="text-[#7a6a5f] text-lg max-w-2xl mx-auto leading-relaxed">
                {description}
              </p>

              {images.length > 0 && (
                <div className="grid grid-cols-2 gap-4 mt-8 rounded-3xl overflow-hidden border border-[#e6e0d8]">
                  {images.slice(0, 4).map((img, i) => (
                    <img
                      key={i}
                      src={img}
                      className="w-full h-48 object-cover"
                      alt={`Preview ${i}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
