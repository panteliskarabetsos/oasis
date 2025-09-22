// src/app/admin/experiences/page.js
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Clock, Euro, Pencil, Trash2, Eye } from "lucide-react";
import { useAuth } from "@/app/components/SessionWrapper";

const AdminExperiencesPage = () => {
  const router = useRouter();
  const { user, loading } = useAuth(); // still fine to read, just not used for redirect

  const [isClient, setIsClient] = useState(false);
  const [experiences, setExperiences] = useState(null);
  const [editingExperience, setEditingExperience] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
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
            setImagePreviews((prev) => [...prev, result.info.secure_url]);
          }
        }
      );
    }
  }, [isClient]);

  const openCloudinaryWidget = () => {
    if (typeof window === "undefined" || !window.cloudinary) return;
    const widget = window.cloudinary.createUploadWidget(
      {
        cloudName: "docgxigth",
        uploadPreset: "ml_default",
        multiple: true,
        maxFiles: 5,
      },
      (error, result) => {
        if (!error && result && result.event === "success") {
          setUploadedImages((prev) => [...prev, result.info.secure_url]);
          setImagePreviews((prev) => [...prev, result.info.secure_url]);
        }
      }
    );
    widget.open();
  };

  const handleDeleteImage = (index, isNew = false) => {
    if (isNew) {
      setUploadedImages((prev) => prev.filter((_, i) => i !== index));
    } else {
      const upd = { ...editingExperience };
      upd.images = (upd.images || []).filter((_, i) => i !== index);
      setEditingExperience(upd);
    }
  };
  const handleDeleteImageFromNew = (i) =>
    setUploadedImages((prev) => prev.filter((_, idx) => idx !== i));

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

  const handleEditExperience = (experience) => setEditingExperience(experience);

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

  const handleUpdateExperience = async (updatedExperience) => {
    const res = await fetch("/api/admin/experiences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedExperience),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setExperiences((prev) =>
        prev.map((e) => (e.id === updatedExperience.id ? updatedExperience : e))
      );
      setEditingExperience(null);
    } else {
      alert((data && data.error) || "Failed to update experience.");
    }
  };

  // While we’re checking auth (or loading experiences), render nothing / a spinner
  if (!isClient || loading || experiences === null) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#faf8f4] via-white to-[#f4f1ec]">
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

              {!showAddForm && (
                <button
                  onClick={() => {
                    setShowAddForm(true);
                    setUploadedImages([]);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#8b6f47] text-white font-medium shadow-sm hover:bg-[#a78b62] focus:outline-none focus:ring-2 focus:ring-[#c7b29e] transition-all"
                >
                  <span className="text-lg leading-none">＋</span>
                  Add New Experience
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <section className="container mx-auto px-6 pt-6 pb-12">
        {/* Add form card */}
        {showAddForm && (
          <div className="mb-8 rounded-3xl border border-[#e8e2d8] bg-white/90 shadow-xl overflow-hidden">
            <div className="px-6 sm:px-8 py-6 border-b border-[#efe9e1] bg-[#faf7f1]">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl sm:text-3xl font-serif text-[#5a4a3f]">
                  Add New Experience
                </h3>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 rounded-full text-[#5a4a3f] bg-[#efeae2] hover:bg-[#e7e1d7] border border-[#e0d9cf] text-sm"
                  title="Close"
                >
                  Close ✕
                </button>
              </div>
            </div>

            <form
              className="p-6 sm:p-8 grid grid-cols-1 gap-6 text-[#5a4a3f] font-serif"
              onSubmit={(e) => {
                e.preventDefault();
                const selectedDays = Array.from(
                  e.currentTarget.querySelectorAll(
                    'input[name="frequency"]:checked'
                  )
                ).map((c) => c.value);

                const newExperience = {
                  name: e.currentTarget.name.value,
                  description: e.currentTarget.description.value,
                  price: parseFloat(e.currentTarget.price.value),
                  location: e.currentTarget.location.value,
                  duration: e.currentTarget.duration.value,
                  whatsIncluded: e.currentTarget.whatsIncluded.value,
                  whatToBring: e.currentTarget.whatToBring.value,
                  whyYoullLove: e.currentTarget.whyYoullLove.value,
                  images: uploadedImages,
                  mapPin: e.currentTarget.mapPin.value,
                  guestReviews: e.currentTarget.guestReviews.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                  frequency: selectedDays,
                  visibility: e.currentTarget.visibility.checked,
                };

                handleAddExperience(newExperience);
                e.currentTarget.reset();
                setShowAddForm(false);
                setUploadedImages([]);
              }}
            >
              {/* Inputs */}
              <div className="rounded-2xl border border-[#e8e2d8] p-5 sm:p-6 bg-white/70">
                <h4 className="text-lg font-medium mb-4 text-[#5a4a3f]">
                  Basics
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {[
                    {
                      label: "Name",
                      name: "name",
                      placeholder: "Olive Harvest & Brunch",
                    },
                    {
                      label: "Location",
                      name: "location",
                      placeholder: "Chania, Crete",
                    },
                    {
                      label: "Duration",
                      name: "duration",
                      placeholder: "3 hours",
                    },
                    {
                      label: "Price (€)",
                      name: "price",
                      type: "number",
                      placeholder: "120",
                    },
                    {
                      label: "Map Pin",
                      name: "mapPin",
                      placeholder: "35.513, 24.019",
                    },
                    {
                      label: "Guest Reviews (comma-separated)",
                      name: "guestReviews",
                      placeholder: "Unforgettable!, Would do again",
                    },
                  ].map(({ label, name, type = "text", placeholder }) => (
                    <div key={name}>
                      <label className="block text-xs tracking-wide uppercase text-[#8a7c6d] mb-1">
                        {label}
                      </label>
                      <input
                        type={type}
                        name={name}
                        placeholder={placeholder}
                        required={name !== "mapPin" && name !== "guestReviews"}
                        className="w-full px-4 py-2.5 rounded-xl border border-[#dcd2c3] bg-white focus:outline-none focus:ring-2 focus:ring-[#8b6f47] shadow-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Details */}
              <div className="rounded-2xl border border-[#e8e2d8] p-5 sm:p-6 bg-white/70">
                <h4 className="text-lg font-medium mb-4 text-[#5a4a3f]">
                  Details
                </h4>
                <div className="grid grid-cols-1 gap-5">
                  {[
                    {
                      label: "Description",
                      name: "description",
                      placeholder: "What guests can expect...",
                    },
                    {
                      label: "What’s Included",
                      name: "whatsIncluded",
                      placeholder: "Guided tour, tasting...",
                    },
                    {
                      label: "What to Bring",
                      name: "whatToBring",
                      placeholder: "Comfortable shoes...",
                    },
                    {
                      label: "Why You’ll Love It",
                      name: "whyYoullLove",
                      placeholder: "Authentic, intimate...",
                    },
                  ].map(({ label, name, placeholder }) => (
                    <div key={name}>
                      <label className="block text-xs tracking-wide uppercase text-[#8a7c6d] mb-1">
                        {label}
                      </label>
                      <textarea
                        name={name}
                        placeholder={placeholder}
                        required
                        rows={3}
                        className="w-full px-4 py-3 rounded-xl border border-[#dcd2c3] bg-white focus:outline-none focus:ring-2 focus:ring-[#8b6f47] shadow-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Frequency & Visibility */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-[#e8e2d8] p-5 sm:p-6 bg-white/70">
                  <h4 className="text-lg font-medium mb-4 text-[#5a4a3f]">
                    Frequency (Select Days)
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                        <input type="checkbox" name="frequency" value={day} />
                        <span className="text-sm">{day}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#e8e2d8] p-5 sm:p-6 bg-white/70">
                  <h4 className="text-lg font-medium mb-4 text-[#5a4a3f]">
                    Visibility
                  </h4>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="visibility"
                      className="h-4 w-4"
                    />
                    <span className="text-sm">Public (visible on site)</span>
                  </label>
                </div>
              </div>

              {/* Images */}
              <div className="rounded-2xl border border-[#e8e2d8] p-5 sm:p-6 bg-white/70">
                <h4 className="text-lg font-medium mb-4 text-[#5a4a3f]">
                  Images
                </h4>
                <button
                  type="button"
                  onClick={openCloudinaryWidget}
                  className="px-4 py-2 rounded-full bg-[#8b6f47] text-white font-medium shadow-sm hover:bg-[#a78b62] transition-all"
                >
                  Upload Images
                </button>

                {uploadedImages.length > 0 && (
                  <div className="mt-5">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {uploadedImages.map((img, i) => (
                        <div
                          key={i}
                          className="group relative aspect-video rounded-xl overflow-hidden border border-[#e8e2d8]"
                        >
                          <img
                            src={img}
                            alt={`Uploaded ${i + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => handleDeleteImage(i, true)}
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 rounded-full text-white bg-red-600/90 text-xs"
                            title="Remove"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-6 py-3 rounded-full bg-[#efeae2] text-[#5a4a3f] hover:bg-[#e7e1d7] border border-[#e0d9cf] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 rounded-full bg-[#8b6f47] text-white font-medium shadow-sm hover:bg-[#a78b62] transition-all"
                >
                  Save Experience
                </button>
              </div>
            </form>
          </div>
        )}

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
                      {experience.price}
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
                        onClick={() => handleEditExperience(experience)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-400 text-white hover:bg-amber-500 transition-all"
                        title="Edit"
                      >
                        <Pencil size={18} /> Edit
                      </button>
                      <button
                        onClick={() => handleDeleteExperience(experience.id)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500 text-white hover:bg-red-600 transition-all"
                        title="Delete"
                      >
                        <Trash2 size={18} /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Edit modal — viewport-safe & scrollable */}
      {editingExperience && (
        <div
          className="fixed inset-0 z-50 bg-black/50 p-4 sm:p-6 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="mx-auto w-full max-w-3xl">
            <div className="bg-white rounded-3xl shadow-2xl flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)]">
              {/* Sticky header */}
              <div className="px-6 py-4 border-b border-[#efe9e1] bg-[#faf7f1] sticky top-0 z-10">
                <h3 className="text-2xl font-serif text-center text-[#5a4a3f]">
                  Edit Experience
                </h3>
              </div>

              {/* Scrollable form content */}
              <form
                className="flex-1 overflow-y-auto p-6 grid grid-cols-1 sm:grid-cols-2 gap-6 text-[#5a4a3f] font-serif"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const selectedDays = Array.from(
                    form.querySelectorAll('input[name="frequency"]:checked')
                  ).map((c) => c.value);

                  const updatedExperience = {
                    id: editingExperience.id,
                    name: form.name.value,
                    description: form.description.value,
                    price: parseFloat(form.price.value),
                    location: form.location.value,
                    duration: form.duration.value,
                    whatsIncluded: form.whatsIncluded.value,
                    whatToBring: form.whatToBring.value,
                    whyYoullLove: form.whyYoullLove.value,
                    images: [
                      ...(editingExperience.images || []),
                      ...uploadedImages,
                    ],
                    mapPin: form.mapPin.value,
                    guestReviews: form.guestReviews.value
                      .split(",")
                      .map((r) => r.trim())
                      .filter(Boolean),
                    frequency: selectedDays,
                    visibility: form.visibility.checked,
                  };

                  handleUpdateExperience(updatedExperience);
                }}
              >
                {/* Left */}
                <div className="space-y-4">
                  <LabeledInput
                    name="name"
                    label="Name"
                    defaultValue={editingExperience.name}
                  />
                  <LabeledInput
                    name="location"
                    label="Location"
                    defaultValue={editingExperience.location}
                  />
                  <LabeledInput
                    name="duration"
                    label="Duration"
                    defaultValue={editingExperience.duration}
                  />
                  <LabeledInput
                    name="price"
                    label="Price (€)"
                    type="number"
                    defaultValue={editingExperience.price}
                  />
                  <LabeledInput
                    name="mapPin"
                    label="Map Pin"
                    defaultValue={editingExperience.mapPin}
                    required={false}
                  />
                </div>

                {/* Right */}
                <div className="space-y-4">
                  <LabeledTextarea
                    name="description"
                    label="Description"
                    defaultValue={editingExperience.description}
                  />
                  <LabeledTextarea
                    name="whatsIncluded"
                    label="What’s Included"
                    defaultValue={editingExperience.whatsIncluded}
                    required={false}
                  />
                  <LabeledTextarea
                    name="whatToBring"
                    label="What to Bring"
                    defaultValue={editingExperience.whatToBring}
                    required={false}
                  />
                  <LabeledTextarea
                    name="whyYoullLove"
                    label="Why You’ll Love It"
                    defaultValue={editingExperience.whyYoullLove}
                    required={false}
                  />
                </div>

                {/* Images */}
                <div className="col-span-1 sm:col-span-2 space-y-4">
                  <label className="block text-sm font-medium">
                    Uploaded Images
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {(editingExperience.images || []).map((img, i) => (
                      <div
                        key={i}
                        className="relative aspect-video rounded-xl overflow-hidden border border-[#e8e2d8]"
                      >
                        <img
                          src={img}
                          alt={`Uploaded ${i + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleDeleteImage(i)}
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
                          onClick={() => handleDeleteImageFromNew(i)}
                          className="absolute top-2 right-2 px-2 py-1 rounded-full text-white bg-red-600/90 text-xs"
                          title="Remove"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={openCloudinaryWidget}
                    className="px-4 py-2 rounded-full bg-[#8b6f47] text-white font-medium shadow-sm hover:bg-[#a78b62] transition-all"
                  >
                    Upload New Image
                  </button>

                  <LabeledInput
                    name="guestReviews"
                    label="Guest Reviews (comma-separated)"
                    defaultValue={(editingExperience.guestReviews || []).join(
                      ","
                    )}
                    required={false}
                  />
                </div>

                {/* Frequency */}
                <div className="mb-2 col-span-1 sm:col-span-2">
                  <label className="block text-sm font-medium mb-1">
                    Frequency (Select Days)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                          defaultChecked={editingExperience.frequency?.includes(
                            day
                          )}
                        />
                        <span className="text-sm">{day}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Sticky footer (inside scroll container) */}
                <div className="col-span-1 sm:col-span-2 sticky bottom-0 -mx-6 sm:-mx-6 bg-white/90 backdrop-blur border-t border-[#e8e2d8] px-6 py-3 flex items-center justify-between">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="visibility"
                      defaultChecked={editingExperience.visibility}
                    />
                    <span className="text-sm">Public (visibility)</span>
                  </label>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setEditingExperience(null)}
                      className="px-6 py-2 rounded-full bg-[#efeae2] text-[#5a4a3f] hover:bg-[#e7e1d7] border border-[#e0d9cf] transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 rounded-full bg-[#8b6f47] text-white hover:bg-[#a78b62] transition-all shadow-sm"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

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
                    €{previewExperience.price}
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
                      {previewExperience.whatsIncluded
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

                {previewExperience.guestReviews?.length > 0 && (
                  <section className="max-w-4xl mx-auto">
                    <h3 className="text-2xl font-serif text-[#5a4a3f] mb-4 text-center">
                      Guest Reviews
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {previewExperience.guestReviews.map((review, i) => (
                        <div
                          key={i}
                          className="bg-white p-5 rounded-2xl shadow border border-[#e0dcd4]"
                        >
                          <p className="font-semibold text-[#5a4a3f]">Guest</p>
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
