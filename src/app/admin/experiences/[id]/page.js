// src/app/admin/experiences/[id]/page.js
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Eye,
  Trash2,
  ArrowLeft,
  Link as LinkIcon,
  Image as ImageIcon,
} from "lucide-react";
import { useAuth } from "@/app/components/SessionWrapper";

// lightweight slugify to avoid an extra dependency on the client
function makeSlug(text = "") {
  return text
    .toString()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 80);
}

export default function AdminExperienceEditPage() {
  const router = useRouter();
  const params = useParams();
  const { loading } = useAuth();

  const id = useMemo(() => {
    const raw = params?.id;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params]);

  const [experience, setExperience] = useState(null);
  const [isFetching, setIsFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [guestReviews, setGuestReviews] = useState([]); // array of strings (jsonb)
  const [slugTouched, setSlugTouched] = useState(false);

  // Delete modal state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Load one experience (with graceful fallbacks)
  useEffect(() => {
    if (!id || loading) return;

    let cancelled = false;

    async function fetchOne() {
      setIsFetching(true);
      try {
        // 1) Prefer dedicated endpoint
        let res = await fetch(`/api/admin/experiences/${id}`, {
          cache: "no-store",
        });
        if (res.status === 401 || res.status === 403) {
          router.replace("/");
          return;
        }
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) applyIncoming(data);
          return;
        }

        // 2) Try the collection endpoint with query param `id`
        res = await fetch(
          `/api/admin/experiences?id=${encodeURIComponent(id)}`,
          { cache: "no-store" }
        );
        if (res.status === 401 || res.status === 403) {
          router.replace("/");
          return;
        }
        if (res.ok) {
          const data = await res.json();
          const one = Array.isArray(data)
            ? data.find((e) => `${e.id}` === `${id}`)
            : data;
          if (one && !cancelled) applyIncoming(one);
          return;
        }

        // 3) Fallback: fetch all and pick by id
        res = await fetch(`/api/admin/experiences`, { cache: "no-store" });
        if (res.status === 401 || res.status === 403) {
          router.replace("/");
          return;
        }
        if (res.ok) {
          const data = await res.json();
          const one = Array.isArray(data)
            ? data.find((e) => `${e.id}` === `${id}`)
            : null;
          if (!cancelled) applyIncoming(one || null);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setExperience(null);
      } finally {
        if (!cancelled) setIsFetching(false);
      }
    }

    const applyIncoming = (obj) => {
      if (!obj) {
        setExperience(null);
        return;
      }
      // Normalize shapes for UI
      const normalized = {
        ...obj,
        images: Array.isArray(obj.images)
          ? obj.images
          : obj.images
          ? [obj.images]
          : [],
        guestReviews: Array.isArray(obj.guestReviews)
          ? obj.guestReviews
          : obj.guestReviews && typeof obj.guestReviews === "object"
          ? Object.values(obj.guestReviews)
          : [],
      };
      setExperience(normalized);
      setGuestReviews(normalized.guestReviews || []);
    };

    fetchOne();
    return () => {
      cancelled = true;
    };
  }, [id, loading, router]);

  // Auto-slug when name changes (unless user touched slug manually)
  const handleNameChange = useCallback(
    (e) => {
      const name = e.target.value;
      setExperience((prev) => {
        if (!prev) return prev;
        const next = { ...prev, name };
        if (!slugTouched) next.slug = makeSlug(name);
        return next;
      });
    },
    [slugTouched]
  );

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

  const handleDeleteExperience = async () => {
    if (!experience?.id) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/admin/experiences`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: experience.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to delete.");
      router.push(`/admin/experiences?toast=deleted`);
    } catch (e) {
      alert(e.message);
    } finally {
      setDeleting(false);
    }
  };
  const previewImages = useMemo(
    () => [...(experience?.images || []), ...uploadedImages],
    [experience?.images, uploadedImages]
  );
  const addReview = (val) => {
    const v = val.trim();
    if (!v) return;
    setGuestReviews((prev) => Array.from(new Set([...prev, v])));
  };

  const removeReview = (idx) => {
    setGuestReviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!experience) return;
    setSaving(true);
    const form = e.currentTarget;

    const selectedDays = Array.from(
      form.querySelectorAll('input[name="frequency"]:checked')
    ).map((c) => c.value);

    const updated = {
      id: experience.id,
      name: form.name.value,
      slug: form.slug.value || makeSlug(form.name.value),
      description: form.description.value,
      location: form.location.value,
      duration: form.duration.value,
      whatsIncluded: form.whatsIncluded.value,
      whatToBring: form.whatToBring.value,
      whyYoullLove: form.whyYoullLove.value,
      mapPin: form.mapPin.value,
      images: [...(experience.images || []), ...uploadedImages],
      guestReviews: guestReviews, // jsonb array
      visibility: form.visibility.checked,
      frequency: selectedDays,
      priceAdult: parseFloat(form.priceAdult.value),
      priceKid: form.priceKid.value ? parseFloat(form.priceKid.value) : null,
      updatedAt: new Date().toISOString(),
    };

    try {
      const res = await fetch(`/api/admin/experiences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to save changes.");
      setUploadedImages([]);
      router.push("/admin/experiences?toast=saved");
      return;
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || isFetching) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-[#faf8f4] via-white to-[#f4f1ec]">
        <header className="sticky top-0 z-10 bg-gradient-to-b from-[#faf8f4]/90 to-white/80 backdrop-blur border-b border-[#e8e2d8]">
          <div className="container mx-auto px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full border-4 border-[#8b6f47] border-t-transparent animate-spin" />
              <span className="text-[#5a4a3f] font-serif">Loading…</span>
            </div>
          </div>
        </header>
      </main>
    );
  }

  if (!experience) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-[#faf8f4] via-white to-[#f4f1ec]">
        <div className="container mx-auto px-6 py-12 text-center">
          <p className="text-[#5a4a3f] font-serif text-lg">
            Experience not found.
          </p>
          <button
            onClick={() => router.push("/admin/experiences")}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#d8cfc3] bg-[#f4f1ec] text-[#5a4a3f] hover:bg-[#eee8e0] hover:border-[#cfc6b8] transition-all shadow-sm"
          >
            <ArrowLeft size={18} /> Back to list
          </button>
        </div>
      </main>
    );
  }

  const createdAt = experience.createdAt
    ? new Date(experience.createdAt)
    : null;
  const updatedAt = experience.updatedAt
    ? new Date(experience.updatedAt)
    : null;
  const confirmMatches =
    confirmText.trim() === (experience?.name || "").trim() ||
    confirmText.trim().toUpperCase() === "DELETE";

  return (
    <div className="min-h-screen ">
      <div className="p-3 sm:p-5">
        <main className="min-h-[calc(100vh-2rem)] bg-gradient-to-b from-[#faf8f4] via-white to-[#f4f1ec] rounded-[36px] border border-[#e8e2d8] shadow-xl overflow-hidden">
          {/* Header */}
          <header className="sticky top-0 z-10 bg-gradient-to-b from-[#faf8f4]/90 to-white/80 backdrop-blur supports-[backdrop-filter]:backdrop-blur border-b border-[#e8e2d8]">
            <div className="container mx-auto px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.push("/admin/experiences")}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-[#d8cfc3] bg-[#f4f1ec] text-[#5a4a3f] hover:bg-[#eee8e0] hover:border-[#cfc6b8] transition-all shadow-sm"
                >
                  <ArrowLeft size={18} /> Back
                </button>
                <div>
                  <h1 className="text-2xl md:text-3xl font-serif text-[#5a4a3f]">
                    {experience.name || "Edit Experience"}
                  </h1>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-[#7a6a5f]">
                    <span
                      className={`px-2 py-0.5 rounded-full border ${
                        experience.visibility
                          ? "bg-green-50 text-green-700 border-green-200"
                          : "bg-red-50 text-red-700 border-red-200"
                      }`}
                    >
                      {experience.visibility ? "Public" : "Private"}
                    </span>
                    {createdAt && (
                      <span>Created: {createdAt.toLocaleDateString()}</span>
                    )}
                    {updatedAt && (
                      <span>
                        Last updated: {updatedAt.toLocaleDateString()}{" "}
                        {updatedAt.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#e9f0ff] text-[#1f4ea3] hover:bg-[#dbe7ff] transition-all"
                >
                  <Eye size={18} /> Preview
                </button>
                <button
                  onClick={() => setDeleteOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500 text-white hover:bg-red-600 transition-all"
                >
                  <Trash2 size={18} /> Delete
                </button>
              </div>
            </div>
          </header>

          {/* Content */}
          <section className="container mx-auto px-6 py-8">
            <form
              onSubmit={handleSave}
              className="grid grid-cols-1 xl:grid-cols-3 gap-6 text-[#5a4a3f] font-serif"
            >
              {/* Main form (2 cols) */}
              <div className="xl:col-span-2 space-y-6">
                {/* Basics card */}
                <div className="rounded-3xl border border-[#e8e2d8] bg-white/90 shadow-sm">
                  <div className="px-6 py-4 border-b border-[#efe9e1] bg-[#faf7f1] rounded-t-3xl">
                    <h3 className="text-xl font-semibold">Basics</h3>
                    <p className="text-xs text-[#7a6a5f]">
                      Title, URL slug, location and timing
                    </p>
                  </div>
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                    <LabeledInput
                      name="name"
                      label="Name"
                      defaultValue={experience.name}
                      onChange={handleNameChange}
                    />

                    <div>
                      <label className="block text-xs tracking-wide uppercase text-[#8a7c6d] mb-1">
                        Slug
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          name="slug"
                          defaultValue={experience.slug}
                          onChange={() => setSlugTouched(true)}
                          required
                          className="w-full px-4 py-2.5 rounded-xl border border-[#dcd2c3] bg-white focus:outline-none focus:ring-2 focus:ring-[#8b6f47] shadow-sm"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const auto = makeSlug(experience?.name || "");
                            setExperience((p) => ({ ...p, slug: auto }));
                            setSlugTouched(true);
                          }}
                          className="px-3 py-2 rounded-xl border border-[#dcd2c3] bg-[#f7f4ef] hover:bg-[#efeae2]"
                          title="Generate from name"
                        >
                          Auto
                        </button>
                      </div>
                      <div className="mt-1 text-xs text-[#7a6a5f] flex items-center gap-1">
                        <LinkIcon size={14} />
                        <span>
                          /experiences/
                          <strong>{experience.slug || "your-slug"}</strong>
                        </span>
                      </div>
                    </div>

                    <LabeledInput
                      name="location"
                      label="Location"
                      defaultValue={experience.location || "Chania, Crete"}
                      onChange={(e) =>
                        setExperience((p) => ({
                          ...p,
                          location: e.target.value,
                        }))
                      }
                    />
                    <LabeledInput
                      name="duration"
                      label="Duration"
                      defaultValue={experience.duration}
                      placeholder="e.g., 3 hours"
                      onChange={(e) =>
                        setExperience((p) => ({
                          ...p,
                          duration: e.target.value,
                        }))
                      }
                    />
                    <LabeledInput
                      name="mapPin"
                      label="Map Pin"
                      defaultValue={experience.mapPin}
                      required={false}
                      placeholder="35.513, 24.019"
                    />
                  </div>
                </div>

                {/* Pricing card */}
                <div className="rounded-3xl border border-[#e8e2d8] bg-white/90 shadow-sm">
                  <div className="px-6 py-4 border-b border-[#efe9e1] bg-[#faf7f1] rounded-t-3xl">
                    <h3 className="text-xl font-semibold">Pricing</h3>
                    <p className="text-xs text-[#7a6a5f]">
                      Adult and child pricing
                    </p>
                  </div>
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                    <LabeledInput
                      name="priceAdult"
                      type="number"
                      label="Adult Price (€)"
                      defaultValue={experience.priceAdult ?? 85}
                      placeholder="85"
                      onChange={(e) =>
                        setExperience((p) => ({
                          ...p,
                          priceAdult:
                            e.target.value === ""
                              ? undefined
                              : parseFloat(e.target.value),
                        }))
                      }
                    />
                    <LabeledInput
                      name="priceKid"
                      type="number"
                      label="Child Price (€)"
                      defaultValue={experience.priceKid ?? ""}
                      required={false}
                      placeholder="Optional"
                      onChange={(e) =>
                        setExperience((p) => ({
                          ...p,
                          priceKid:
                            e.target.value === ""
                              ? null
                              : parseFloat(e.target.value),
                        }))
                      }
                    />
                  </div>
                </div>

                {/* Details card */}
                <div className="rounded-3xl border border-[#e8e2d8] bg-white/90 shadow-sm">
                  <div className="px-6 py-4 border-b border-[#efe9e1] bg-[#faf7f1] rounded-t-3xl">
                    <h3 className="text-xl font-semibold">Details</h3>
                    <p className="text-xs text-[#7a6a5f]">
                      Description, inclusions and highlights
                    </p>
                  </div>
                  <div className="p-6 grid grid-cols-1 gap-5">
                    <LabeledTextarea
                      name="description"
                      label="Description"
                      defaultValue={experience.description}
                    />
                    <LabeledTextarea
                      name="whatsIncluded"
                      label="What’s Included"
                      defaultValue={experience.whatsIncluded}
                      required={false}
                      placeholder="One per line"
                    />
                    <LabeledTextarea
                      name="whatToBring"
                      label="What to Bring"
                      defaultValue={experience.whatToBring}
                      required={false}
                    />
                    <LabeledTextarea
                      name="whyYoullLove"
                      label="Why You’ll Love It"
                      defaultValue={experience.whyYoullLove}
                      required={false}
                      onChange={(e) =>
                        setExperience((p) => ({
                          ...p,
                          whyYoullLove: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                {/* Images card */}
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

                {/* Reviews card */}
                <div className="rounded-3xl border border-[#e8e2d8] bg-white/90 shadow-sm">
                  <div className="px-6 py-4 border-b border-[#efe9e1] bg-[#faf7f1] rounded-t-3xl">
                    <h3 className="text-xl font-semibold">Guest Reviews</h3>
                    <p className="text-xs text-[#7a6a5f]">
                      Short quotes shown on the page
                    </p>
                  </div>
                  <div className="p-6">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Type a short quote and press Add"
                        className="flex-1 px-4 py-2.5 rounded-xl border border-[#dcd2c3] bg-white focus:outline-none focus:ring-2 focus:ring-[#8b6f47] shadow-sm"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addReview(e.currentTarget.value);
                            e.currentTarget.value = "";
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          const input = e.currentTarget.previousSibling;
                          if (input && input.value) {
                            addReview(input.value);
                            input.value = "";
                          }
                        }}
                        className="px-4 py-2 rounded-full bg-[#8b6f47] text-white hover:bg-[#a78b62]"
                      >
                        Add
                      </button>
                    </div>

                    {guestReviews.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {guestReviews.map((r, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#efeae2] border border-[#e0d9cf]"
                          >
                            <span className="text-sm italic">“{r}”</span>
                            <button
                              type="button"
                              onClick={() => removeReview(i)}
                              className="text-[#7a6a5f] hover:text-red-600"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Side card (visibility, frequency, save) */}
              {/* Side: preview + controls */}
              <aside className="xl:col-span-1 space-y-6">
                {/* Live Preview card */}
                <div
                  className="rounded-3xl border border-[#e6e0d8] bg-white/70 p-6 backdrop-blur"
                  aria-live="polite"
                >
                  <h3 className="mb-3 font-serif text-lg text-[#5a4a3f]">
                    Live Preview
                  </h3>

                  <div className="overflow-hidden rounded-2xl border border-[#e0dcd4] bg-white shadow-sm">
                    <div className="relative h-40 w-full bg-[#faf7f1]">
                      {previewImages?.[0] ||
                      experience?.images?.[0] ||
                      uploadedImages?.[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={
                            previewImages?.[0] ||
                            experience?.images?.[0] ||
                            uploadedImages?.[0]
                          }
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
                          {experience.location || "Location"}
                        </p>
                        <p className="rounded-full border border-[#efe7d9] bg-[#fbf7ef] px-2 py-0.5 text-[11px] text-[#5a4a3f]">
                          {experience.visibility ? "published" : "draft"}
                        </p>
                      </div>

                      <h4 className="font-serif text-xl text-[#5a4a3f]">
                        {experience.name || "Untitled experience"}
                      </h4>

                      <p className="text-sm text-[#5a4a3f]/90">
                        {experience.whyYoullLove || "Why guests will love it…"}
                      </p>

                      <div className="mt-2 flex items-center justify-between text-sm text-[#5a4a3f]">
                        <span>{experience.duration || "Duration TBD"}</span>
                        <span className="font-medium">
                          {typeof experience.priceAdult === "number"
                            ? `€${Number(experience.priceAdult).toFixed(0)}`
                            : "Price TBD"}
                          {typeof experience.priceKid === "number" &&
                            ` (kid €${Number(experience.priceKid).toFixed(0)})`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="mt-4 text-xs text-[#7a6a5f]">
                    The preview is indicative. Final rendering may vary on the
                    public catalog page.
                  </p>
                </div>

                {/* Controls (sticky) */}
                <div className="rounded-3xl border border-[#e8e2d8] bg-white/90 shadow-sm sticky top-[92px]">
                  <div className="p-6 space-y-6">
                    <div>
                      <h4 className="text-lg font-medium mb-2">Visibility</h4>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          name="visibility"
                          defaultChecked={experience.visibility}
                          onChange={(e) =>
                            setExperience((p) => ({
                              ...p,
                              visibility: e.target.checked,
                            }))
                          }
                        />
                        <span className="text-sm">
                          Public (visible on site)
                        </span>
                      </label>
                    </div>

                    <div>
                      <h4 className="text-lg font-medium mb-2">
                        Frequency (Select Days)
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
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
                            className="inline-flex items-center gap-2 rounded-xl border border-[#e8e2d8] px-3 py-2"
                          >
                            <input
                              type="checkbox"
                              name="frequency"
                              value={day}
                              defaultChecked={experience.frequency?.includes(
                                day
                              )}
                            />
                            <span className="text-sm">{day}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full px-6 py-3 rounded-full bg-[#8b6f47] text-white font-medium shadow-sm hover:bg-[#a78b62] transition-all disabled:opacity-60"
                    >
                      {saving ? "Saving…" : "Save Changes"}
                    </button>
                  </div>
                </div>
              </aside>
            </form>
          </section>

          {/* Preview modal */}
          {previewOpen && (
            <div
              className="fixed inset-0 z-50 bg-black/50 p-4 sm:p-6 overflow-y-auto"
              role="dialog"
              aria-modal="true"
            >
              <div className="mx-auto w-full max-w-6xl">
                <div className="bg-[#f4f1ec] rounded-3xl shadow-2xl flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)]">
                  <div className="px-6 py-4 border-b border-[#e8e2d8] bg-[#faf7f1] relative sticky top-0 z-10">
                    <button
                      onClick={() => setPreviewOpen(false)}
                      className="absolute right-4 top-3 px-3 py-1.5 rounded-full text-[#5a4a3f] bg-[#efeae2] hover:bg-[#e7e1d7] border border-[#e0d9cf] text-sm"
                      title="Close"
                    >
                      ✕
                    </button>
                    <div className="text-center">
                      <h2 className="text-2xl sm:text-3xl font-serif text-[#5a4a3f]">
                        {experience.name}
                      </h2>
                      <p className="text-sm text-[#7a6a5f]">
                        {experience.visibility ? "Public" : "Private"} •{" "}
                        {experience.location}
                      </p>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 text-[#2f2f2f]">
                    <div className="text-center space-y-1">
                      <p className="text-lg text-[#4a4a4a] italic">
                        {experience.duration}
                      </p>
                      <p className="text-xl text-[#5a4a3f]">
                        Adult: €{experience.priceAdult ?? 85}
                        {typeof experience.priceKid === "number"
                          ? ` • Child: €${experience.priceKid}`
                          : ""}
                      </p>
                    </div>

                    {experience.description && (
                      <section className="max-w-4xl mx-auto text-center">
                        <p className="text-lg sm:text-xl leading-relaxed text-[#4a4a4a] whitespace-pre-line">
                          {experience.description}
                        </p>
                      </section>
                    )}

                    {experience.images?.length > 0 && (
                      <section className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                        {experience.images.map((img, i) => (
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

                    {experience.whatsIncluded && (
                      <section className="max-w-4xl mx-auto">
                        <h3 className="text-2xl font-serif text-[#5a4a3f] mb-3 text-center">
                          What’s Included
                        </h3>
                        <ul className="list-disc list-inside text-[#4a4a4a] space-y-1">
                          {experience.whatsIncluded.split("").map((item, i) => (
                            <li key={i} className="text-lg">
                              {item}
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}

                    {experience.whatToBring && (
                      <section className="max-w-4xl mx-auto text-center">
                        <h3 className="text-2xl font-serif text-[#5a4a3f] mb-3">
                          What to Bring
                        </h3>
                        <p className="text-lg text-[#4a4a4a]">
                          {experience.whatToBring}
                        </p>
                      </section>
                    )}

                    {experience.whyYoullLove && (
                      <section className="max-w-4xl mx-auto text-center">
                        <h3 className="text-2xl font-serif text-[#5a4a3f] mb-3">
                          Why You’ll Love It
                        </h3>
                        <p className="text-lg text-[#4a4a4a] whitespace-pre-line">
                          {experience.whyYoullLove}
                        </p>
                      </section>
                    )}

                    {experience.mapPin && (
                      <section className="max-w-5xl mx-auto">
                        <h3 className="text-2xl font-serif text-[#5a4a3f] mb-3 text-center">
                          Where You'll Be
                        </h3>
                        <div className="w-full h-[300px] rounded-xl overflow-hidden shadow-lg border border-[#e0dcd4]">
                          <iframe
                            src={`https://www.google.com/maps?q=${experience.mapPin}&z=14&output=embed`}
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

                    {guestReviews.length > 0 && (
                      <section className="max-w-4xl mx-auto">
                        <h3 className="text-2xl font-serif text-[#5a4a3f] mb-4 text-center">
                          Guest Reviews
                        </h3>
                        <div className="grid gap-4 sm:grid-cols-2">
                          {guestReviews.map((review, i) => (
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
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Delete modal */}
          {deleteOpen && (
            <div
              className="fixed inset-0 z-[60] bg-black/50 p-4 sm:p-6 flex items-center justify-center"
              role="dialog"
              aria-modal="true"
              onClick={() => setDeleteOpen(false)}
            >
              <div
                className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-[#e8e2d8]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-6 py-4 border-b border-[#efe9e1] bg-[#fff8f7] rounded-t-2xl">
                  <h3 className="text-xl font-serif text-[#5a4a3f]">
                    Delete Experience
                  </h3>
                </div>
                <div className="px-6 py-5 space-y-4 text-[#5a4a3f]">
                  <p>
                    This action{" "}
                    <span className="font-semibold">cannot be undone</span>. It
                    will permanently delete
                    <span className="font-semibold">
                      {" "}
                      “{experience.name}”
                    </span>{" "}
                    and its media references.
                  </p>
                  <p className="text-sm text-[#7a6a5f]">
                    To confirm, type{" "}
                    <span className="font-mono bg-[#f7f0ea] px-1 rounded">
                      {experience.name}
                    </span>{" "}
                    or{" "}
                    <span className="font-mono bg-[#f7f0ea] px-1 rounded">
                      DELETE
                    </span>{" "}
                    below:
                  </p>
                  <input
                    autoFocus
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#dcd2c3] focus:outline-none focus:ring-2 focus:ring-red-400"
                    placeholder={`Type "${experience.name}" or DELETE`}
                  />
                </div>
                <div className="px-6 py-4 border-t border-[#efe9e1] bg-[#faf7f1] rounded-b-2xl flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setDeleteOpen(false)}
                    className="px-5 py-2 rounded-full bg-[#efeae2] text-[#5a4a3f] hover:bg-[#e7e1d7] border border-[#e0d9cf]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!confirmMatches || deleting}
                    onClick={handleDeleteExperience}
                    className={`px-5 py-2 rounded-full text-white border transition-all ${
                      !confirmMatches || deleting
                        ? "bg-red-300 cursor-not-allowed"
                        : "bg-red-600 hover:bg-red-700 border-red-700"
                    }`}
                  >
                    {deleting ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function LabeledInput({
  name,
  label,
  defaultValue,
  type = "text",
  required = true,
  placeholder,
  onChange,
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
        onChange={onChange}
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
  onChange,
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
