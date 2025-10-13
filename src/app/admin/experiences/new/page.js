// src/app/admin/experiences/new/page.js
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import {
  ArrowLeft,
  Image as ImageIcon,
  Upload,
  Check,
  Loader2,
} from "lucide-react";

/* ---------------------------- helpers ---------------------------- */
const slugify = (s = "") =>
  s
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

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

const Field = ({ label, children, hint, required = false }) => (
  <label className="block">
    <span className="flex items-center gap-2 text-sm font-medium text-[#5a4a3f]">
      {label} {required ? <span className="text-[#b44d4d]">*</span> : null}
    </span>
    <div className="mt-1">{children}</div>
    {hint ? <p className="mt-1 text-xs text-[#7a6a5f]/80">{hint}</p> : null}
  </label>
);

export default function NewExperiencePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [experience, setExperience] = useState({ images: [] });
  // DB fields
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("Chania, Crete"); // default
  const [duration, setDuration] = useState(""); // text, e.g. "3 hours"
  const [priceAdult, setPriceAdult] = useState("85"); // NOT NULL (default 85)
  const [priceKid, setPriceKid] = useState("");
  const [mapPin, setMapPin] = useState("");
  const [whatsIncluded, setWhatsIncluded] = useState("");
  const [whatToBring, setWhatToBring] = useState("");
  const [whyYoullLove, setWhyYoullLove] = useState("");
  const [guestReviewsInput, setGuestReviewsInput] = useState(""); // CSV or JSON
  const [visibility, setVisibility] = useState(true);
  const [frequency, setFrequency] = useState([]); // text[]
  const [images, setImages] = useState([]); // text[] (urls)
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [uploadedImages, setUploadedImages] = useState([]);
  // derived UI
  const [status, setStatus] = useState("published"); // mirrors visibility

  const coverRef = useRef(null);

  // auto-slug from name (but allow manual edits)
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

  function openCloudinary() {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!window?.cloudinary) {
      toast.error("Cloudinary widget not available.");
      return;
    }
    if (!cloudName || !uploadPreset) {
      toast.error("Missing Cloudinary env (cloud name / upload preset).");
      return;
    }

    const widget = window.cloudinary.createUploadWidget(
      {
        cloudName,
        uploadPreset,
        multiple: true,
        sources: ["local", "url", "camera"],
        folder: "oasis/experiences",
        maxFiles: 10,
      },
      (error, result) => {
        if (error) {
          console.error(error);
          toast.error("Upload failed.");
        } else if (result?.event === "success") {
          const url = result.info.secure_url;
          setImages((prev) => [...prev, url]);
          toast.success("Image uploaded.");
        }
      }
    );
    widget.open();
  }

  function removeImage(idx) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  function toggleDay(day) {
    setFrequency((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  async function submit(e, publish = false) {
    e?.preventDefault?.();
    if (!canSubmit) {
      toast.error("Please fill the required fields correctly.");
      return;
    }

    // visibility from intent
    const finalVisibility = publish ? true : false;
    publish ? setPublishing(true) : setLoading(true);

    try {
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
        mapPin: mapPin.trim() || null,
        guestReviews: parseGuestReviews(guestReviewsInput), // jsonb
        frequency, // text[]
        visibility: finalVisibility, // boolean
        priceAdult: priceAdult === "" ? 85 : Number(priceAdult), // double precision NOT NULL
        priceKid: priceKid === "" ? null : Number(priceKid), // double precision NULL
        updatedAt: new Date().toISOString(),
      };

      // sanity
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
      toast.success(publish ? "Published" : "Saved (private)");
      // go to edit page if exists, else list
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

  // Close delete modal on Escape
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") setDeleteOpen(false);
    }
    if (deleteOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteOpen]);

  // Cloudinary upload widget (on-demand creation)
  const openCloudinaryWidget = () => {
    if (typeof window === "undefined" || !window.cloudinary) {
      alert("Cloudinary widget not available in this environment.");
      return;
    }
    const widget = window.cloudinary.createUploadWidget(
      {
        cloudName: "docgxigth",
        uploadPreset: "ml_default",
        multiple: true,
        maxFiles: 10,
      },
      (error, result) => {
        if (!error && result && result.event === "success") {
          setUploadedImages((prev) => [...prev, result.info.secure_url]);
        }
      }
    );
    widget.open();
  };

  const handleDeleteExistingImage = (index) => {
    setExperience((prev) => ({
      ...prev,
      images: (prev?.images || []).filter((_, i) => i !== index),
    }));
  };

  const handleDeleteNewImage = (index) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  };
  return (
    <div className="relative">
      {/* Top controls */}
      <div className="sticky top-2 z-30 mx-auto mb-4 max-w-7xl px-2 sm:px-6">
        <div className="flex items-center justify-between rounded-2xl border border-[#e6e0d8] bg-white/80 backdrop-blur px-3 py-2 shadow-sm">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-full border border-[#e0dcd4] bg-[#fdfaf7] px-3 py-1.5 text-sm text-[#5a4a3f] hover:bg-[#f1ede7]"
          >
            <ArrowLeft size={16} /> Back
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={(e) => submit(e, false)}
              disabled={!canSubmit || loading || publishing}
              className="rounded-full border border-[#e0dcd4] bg-white px-3 py-1.5 text-sm text-[#5a4a3f] hover:bg-[#fff4e1] disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
              title="Save as draft (visibility off)"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Check size={16} />
              )}
              Save draft
            </button>
            <button
              onClick={(e) => submit(e, true)}
              disabled={!canSubmit || loading || publishing}
              className="rounded-full bg-[#8b6f47] px-4 py-1.5 text-sm text-white hover:bg-[#7a5f3a] disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
              title="Publish (visibility on)"
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

      {/* Content */}
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Left: form */}
        <form
          onSubmit={(e) => submit(e, false)}
          className="rounded-3xl border border-[#e6e0d8] bg-white/80 p-6 backdrop-blur"
        >
          <div className="grid gap-5">
            <Field label="Name" required hint="A short, descriptive title.">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-[#e0dcd4] bg-white px-3 py-2 text-sm text-[#5a4a3f] outline-none focus:ring-2 focus:ring-[#8b6f47]/40"
                placeholder="Olive Harvest & Brunch"
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Slug" required hint="URL-safe identifier">
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full rounded-xl border border-[#e0dcd4] bg-white px-3 py-2 text-sm text-[#5a4a3f] outline-none focus:ring-2 focus:ring-[#8b6f47]/40"
                  placeholder="olive-harvest-brunch"
                />
              </Field>

              <Field label="Location" hint='Defaults to "Chania, Crete".'>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full rounded-xl border border-[#e0dcd4] bg-white px-3 py-2 text-sm text-[#5a4a3f] outline-none focus:ring-2 focus:ring-[#8b6f47]/40"
                  placeholder="Chania, Crete"
                />
              </Field>
            </div>

            <Field
              label="Description"
              hint="Long-form details about the experience."
            >
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                className="w-full rounded-xl border border-[#e0dcd4] bg-white px-3 py-2 text-sm text-[#5a4a3f] outline-none focus:ring-2 focus:ring-[#8b6f47]/40"
                placeholder="What guests can expect..."
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Duration (text)">
                <input
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full rounded-xl border border-[#e0dcd4] bg-white px-3 py-2 text-sm text-[#5a4a3f] outline-none focus:ring-2 focus:ring-[#8b6f47]/40"
                  placeholder="3 hours"
                />
              </Field>

              <Field label="Price Adult (€)" required>
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={priceAdult}
                  onChange={(e) => setPriceAdult(e.target.value)}
                  className="w-full rounded-xl border border-[#e0dcd4] bg-white px-3 py-2 text-sm text-[#5a4a3f] outline-none focus:ring-2 focus:ring-[#8b6f47]/40"
                  placeholder="85"
                />
              </Field>

              <Field label="Price Kid (€)">
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={priceKid}
                  onChange={(e) => setPriceKid(e.target.value)}
                  className="w-full rounded-xl border border-[#e0dcd4] bg-white px-3 py-2 text-sm text-[#5a4a3f] outline-none focus:ring-2 focus:ring-[#8b6f47]/40"
                  placeholder="45"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Map Pin" hint="lat,lng">
                <input
                  value={mapPin}
                  onChange={(e) => setMapPin(e.target.value)}
                  className="w-full rounded-xl border border-[#e0dcd4] bg-white px-3 py-2 text-sm text-[#5a4a3f] outline-none focus:ring-2 focus:ring-[#8b6f47]/40"
                  placeholder="35.513, 24.019"
                />
              </Field>

              <Field label="Visibility">
                <div className="flex items-center gap-2">
                  <input
                    id="vis"
                    type="checkbox"
                    checked={visibility}
                    onChange={(e) => setVisibility(e.target.checked)}
                  />
                  <label htmlFor="vis" className="text-sm text-[#5a4a3f]">
                    Public (visible on site)
                  </label>
                </div>
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="What’s Included"
                hint="One per line (will render as a list)."
              >
                <textarea
                  value={whatsIncluded}
                  onChange={(e) => setWhatsIncluded(e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-[#e0dcd4] bg-white px-3 py-2 text-sm text-[#5a4a3f] outline-none focus:ring-2 focus:ring-[#8b6f47]/40"
                  placeholder="Guided tour&#10;Tasting&#10;Transfers"
                />
              </Field>

              <Field label="What to Bring">
                <textarea
                  value={whatToBring}
                  onChange={(e) => setWhatToBring(e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-[#e0dcd4] bg-white px-3 py-2 text-sm text-[#5a4a3f] outline-none focus:ring-2 focus:ring-[#8b6f47]/40"
                  placeholder="Comfortable shoes, hat..."
                />
              </Field>
            </div>

            <Field label="Why You’ll Love It">
              <textarea
                value={whyYoullLove}
                onChange={(e) => setWhyYoullLove(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-[#e0dcd4] bg-white px-3 py-2 text-sm text-[#5a4a3f] outline-none focus:ring-2 focus:ring-[#8b6f47]/40"
                placeholder="Authentic, intimate, unforgettable..."
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Guest Reviews"
                hint='CSV or JSON array, e.g. `Great!, Amazing!` or `["Great!","Amazing!"]`'
              >
                <textarea
                  value={guestReviewsInput}
                  onChange={(e) => setGuestReviewsInput(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-[#e0dcd4] bg-white px-3 py-2 text-sm text-[#5a4a3f] outline-none focus:ring-2 focus:ring-[#8b6f47]/40"
                />
              </Field>

              <Field label="Frequency (days)">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                    "Sunday",
                  ].map((day) => (
                    <label
                      key={day}
                      className="inline-flex items-center gap-2 rounded-xl border border-[#e8e2d8] px-3 py-2 hover:bg-[#fbfaf7]"
                    >
                      <input
                        type="checkbox"
                        checked={frequency.includes(day)}
                        onChange={() => toggleDay(day)}
                      />
                      <span className="text-sm">{day}</span>
                    </label>
                  ))}
                </div>
              </Field>
            </div>

            {/* Images */}
            <div className="rounded-3xl border border-[#e8e2d8] bg-white/90 shadow-sm">
              <div className="px-6 py-4 border-b border-[#efe9e1] bg-[#faf7f1] rounded-t-3xl flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold">Images</h3>
                  <p className="text-xs text-[#7a6a5f]">
                    Upload and manage gallery
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openCloudinaryWidget}
                  className="px-4 py-2 rounded-full bg-[#8b6f47] text-white font-medium shadow-sm hover:bg-[#a78b62] transition-all"
                >
                  Upload Images
                </button>
              </div>
              <div className="p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {(experience.images || []).map((img, i) => (
                  <div
                    key={`old-${i}`}
                    className="relative aspect-video rounded-xl overflow-hidden border border-[#e8e2d8]"
                  >
                    <img
                      src={img}
                      alt={`Image ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteExistingImage(i)}
                      className="absolute top-2 right-2 px-2 py-1 rounded-full text-white bg-red-600/90 text-xs"
                      title="Remove"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {uploadedImages.map((img, i) => (
                  <div
                    key={`new-${i}`}
                    className="relative aspect-video rounded-xl overflow-hidden border border-[#e8e2d8]"
                  >
                    <img
                      src={img}
                      alt={`New ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteNewImage(i)}
                      className="absolute top-2 right-2 px-2 py-1 rounded-full text-white bg-red-600/90 text-xs"
                      title="Remove"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <p className="text-xs text-[#7a6a5f]">
                Status:{" "}
                <span className="rounded-full border border-[#efe7d9] bg-[#fbf7ef] px-2 py-0.5 text-[11px] text-[#5a4a3f]">
                  {status}
                </span>
              </p>
            </div>
          </div>
        </form>

        {/* Right: preview card */}
        <aside className="rounded-3xl border border-[#e6e0d8] bg-white/70 p-6 backdrop-blur">
          <h3 className="mb-3 font-serif text-lg text-[#5a4a3f]">
            Live Preview
          </h3>

          <div className="overflow-hidden rounded-2xl border border-[#e0dcd4] bg-white shadow-sm">
            <div className="relative h-40 w-full bg-[#faf7f1]">
              {images[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={images[0]}
                  alt="Cover preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[#7a6a5f]">
                  <ImageIcon size={28} />
                </div>
              )}
            </div>
            <div className="space-y-2 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm uppercase tracking-wide text-[#7a6a5f]">
                  {location || "Location"}
                </p>
                <p className="rounded-full border border-[#efe7d9] bg-[#fbf7ef] px-2 py-0.5 text-[11px] text-[#5a4a3f]">
                  {visibility ? "published" : "draft"}
                </p>
              </div>
              <h4 className="font-serif text-xl text-[#5a4a3f]">
                {name || "Untitled experience"}
              </h4>
              <p className="text-sm text-[#5a4a3f]/90">
                {whyYoullLove || "Why guests will love it…"}
              </p>
              <div className="mt-2 flex items-center justify-between text-sm text-[#5a4a3f]">
                <span>{duration ? duration : "Duration TBD"}</span>
                <span className="font-medium">
                  {priceAdult
                    ? `€${Number(priceAdult).toFixed(0)}`
                    : "Price TBD"}
                  {priceKid && ` (kid €${Number(priceKid).toFixed(0)})`}
                </span>
              </div>
            </div>
          </div>

          <p className="mt-4 text-xs text-[#7a6a5f]">
            The preview is indicative. Final rendering may vary on the public
            catalog page.
          </p>
        </aside>
      </div>
    </div>
  );
}
