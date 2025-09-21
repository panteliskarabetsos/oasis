// src/app/admin/experiences/page.js
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Clock, Euro, Pencil, Trash2, Eye } from "lucide-react";
import { useAuth } from "@/app/components/SessionWrapper";

const AdminExperiencesPage = () => {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [isClient, setIsClient] = useState(false);
  const [experiences, setExperiences] = useState(null);
  const [editingExperience, setEditingExperience] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [previewExperience, setPreviewExperience] = useState(null);

  // Derive role from Supabase auth
  const role = user?.app_metadata?.role || user?.user_metadata?.role || "user";
  const isAdmin = role === "admin";

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Redirect non-admins once auth is known
  useEffect(() => {
    if (loading) return;
    if (!user || !isAdmin) router.push("/");
  }, [user, isAdmin, loading, router]);

  // Fetch experiences for admin
  useEffect(() => {
    if (!loading && isAdmin) {
      (async () => {
        const res = await fetch("/api/admin/experiences", {
          cache: "no-store",
        });
        const data = await res.json();
        setExperiences(Array.isArray(data) ? data : []);
      })();
    }
  }, [isAdmin, loading]);

  // Initialize Cloudinary widget (if you load it in your layout)
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
    if (typeof window === "undefined" || !window.cloudinary) {
      console.error("Cloudinary is not loaded.");
      return;
    }
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
        if (error) console.error("Cloudinary upload error:", error);
      }
    );
    widget.open();
  };

  // Delete an image (existing vs new)
  const handleDeleteImage = (index, isNewImage = false) => {
    if (isNewImage) {
      setUploadedImages((prev) => prev.filter((_, i) => i !== index));
    } else {
      const updated = { ...editingExperience };
      updated.images = (updated.images || []).filter((_, i) => i !== index);
      setEditingExperience(updated);
    }
  };
  const handleDeleteImageFromNew = (index) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDeleteExperience = async (id) => {
    if (!confirm("Are you sure you want to delete this experience?")) return;
    const res = await fetch(`/api/admin/experiences`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (res.ok) {
      setExperiences((prev) => prev.filter((e) => e.id !== id));
    } else {
      alert(data.error || "Failed to delete experience.");
    }
  };

  const handleEditExperience = (experience) => setEditingExperience(experience);

  const handleAddExperience = async (newExperience) => {
    const res = await fetch("/api/admin/experiences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newExperience, images: uploadedImages }),
    });
    const data = await res.json();
    if (res.ok) {
      setExperiences((prev) => [...prev, data]);
    } else {
      alert(data?.error || "Failed to add experience.");
    }
  };

  const handleUpdateExperience = async (updatedExperience) => {
    const res = await fetch("/api/admin/experiences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedExperience),
    });
    const data = await res.json();
    if (res.ok) {
      setExperiences((prev) =>
        prev.map((e) => (e.id === updatedExperience.id ? updatedExperience : e))
      );
      setEditingExperience(null);
    } else {
      alert(data?.error || "Failed to update experience.");
    }
  };

  if (!isClient || loading) return null;
  if (!user || !isAdmin) return null;

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold text-center mb-6">
        Manage Experiences
      </h1>

      <div className="mb-4">
        <button
          onClick={() => router.push("/admin/")}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#f4f1ec] text-[#5a4a3f] border border-[#d8cfc3] rounded-full shadow-sm hover:bg-[#eae5df] hover:text-[#8b6f47] transition-all font-medium text-sm"
        >
          ← Back to Dashboard
        </button>
      </div>

      <div className="mb-6 text-center">
        {!showAddForm ? (
          <button
            onClick={() => {
              setShowAddForm(true);
              setUploadedImages([]);
            }}
            className="px-6 py-3 bg-[#8b6f47] text-white rounded-full font-medium font-serif shadow-sm hover:bg-[#a78b62] transition-all focus:outline-none focus:ring-2 focus:ring-[#c7b29e]"
          >
            + Add New Experience
          </button>
        ) : (
          <div className="p-8 bg-[#fefcf9] rounded-2xl shadow-xl border border-[#e8e2d8] max-w-4xl mx-auto">
            <h3 className="text-4xl font-serif font-semibold text-[#5a4a3f] mb-10 text-center">
              Add New Experience
            </h3>

            <form
              className="space-y-6 font-serif text-[#5a4a3f]"
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { label: "Name", name: "name" },
                  { label: "Location", name: "location" },
                  { label: "Duration", name: "duration" },
                  { label: "Price (€)", name: "price", type: "number" },
                  { label: "Map Pin", name: "mapPin" },
                  {
                    label: "Guest Reviews (comma-separated)",
                    name: "guestReviews",
                  },
                ].map(({ label, name, type = "text" }) => (
                  <div key={name}>
                    <label className="block text-sm mb-1 font-medium">
                      {label}
                    </label>
                    <input
                      type={type}
                      name={name}
                      required={name !== "mapPin" && name !== "guestReviews"}
                      className="w-full px-4 py-2 rounded-lg border border-[#dcd2c3] bg-white focus:outline-none focus:ring-2 focus:ring-[#8b6f47] shadow-sm"
                    />
                  </div>
                ))}
              </div>

              {/* Textareas */}
              <div className="grid grid-cols-1 gap-6">
                {[
                  { label: "Description", name: "description" },
                  { label: "What’s Included", name: "whatsIncluded" },
                  { label: "What to Bring", name: "whatToBring" },
                  { label: "Why You’ll Love It", name: "whyYoullLove" },
                ].map(({ label, name }) => (
                  <div key={name}>
                    <label className="block text-sm mb-1 font-medium">
                      {label}
                    </label>
                    <textarea
                      name={name}
                      required
                      rows={3}
                      className="w-full px-4 py-2 rounded-lg border border-[#dcd2c3] bg-white focus:outline-none focus:ring-2 focus:ring-[#8b6f47] shadow-sm"
                    />
                  </div>
                ))}
              </div>

              {/* Frequency */}
              <div className="mb-6">
                <label className="block text-sm mb-1 font-medium">
                  Frequency (Select Days)
                </label>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                    "Sunday",
                  ].map((day) => (
                    <label key={day} className="inline-flex items-center">
                      <input type="checkbox" name="frequency" value={day} />
                      <span className="ml-2">{day}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Visibility */}
              <div className="mb-6">
                <label className="inline-flex items-center">
                  <input type="checkbox" name="visibility" />
                  <span className="ml-2">Public (visibility)</span>
                </label>
              </div>

              {/* Image upload */}
              <div className="mb-6">
                <label className="block text-sm mb-1 font-medium">
                  Upload Images
                </label>
                <button
                  type="button"
                  onClick={openCloudinaryWidget}
                  className="px-4 py-2 bg-[#8b6f47] text-white rounded-full font-medium shadow-sm hover:bg-[#a78b62] transition-all"
                >
                  Upload Images
                </button>
                {uploadedImages.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium">Uploaded Images:</h4>
                    <div className="flex flex-wrap gap-4">
                      {uploadedImages.map((img, i) => (
                        <div key={i} className="relative w-32 h-32">
                          <img
                            src={img}
                            alt={`Uploaded ${i + 1}`}
                            className="w-full h-full object-cover rounded-md"
                          />
                          <button
                            type="button"
                            onClick={() => handleDeleteImage(i, true)}
                            className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
                          >
                            <span className="text-xs">X</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-4 pt-6">
                <button
                  type="submit"
                  className="px-6 py-3 bg-[#8b6f47] text-white rounded-full font-medium hover:bg-[#a78b62] transition-all shadow-sm"
                >
                  Save Experience
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-6 py-3 bg-[#e6e1d5] text-[#5a4a3f] rounded-full font-medium hover:bg-[#dad2c4] transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Experiences list */}
      {!experiences ? (
        <div className="flex flex-col items-center justify-center mt-12 text-[#5a4a3f] font-serif text-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#8b6f47] border-t-transparent mb-4" />
          Loading experiences...
        </div>
      ) : experiences.length === 0 ? (
        <p className="text-center text-[#5a4a3f] font-serif text-lg italic mt-12">
          No experiences found.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {experiences.map((experience) => (
            <div
              key={experience.id}
              className="relative bg-white rounded-3xl shadow-md border border-[#e8e2d8] hover:shadow-xl transition-all duration-300 flex flex-col justify-between p-6 font-serif text-[#5a4a3f]"
            >
              <div>
                <h3 className="text-2xl font-semibold mb-2">
                  {experience.name}
                </h3>
                <p className="text-sm text-[#7a6a5f] mb-4">
                  {experience.description}
                </p>
              </div>

              <div className="text-sm space-y-2">
                <p className="flex items-center gap-2">
                  <MapPin size={18} className="text-[#8b6f47]" />{" "}
                  {experience.location}
                </p>
                <p className="flex items-center gap-2">
                  <Clock size={18} className="text-[#8b6f47]" />{" "}
                  {experience.duration}
                </p>
                <p className="flex items-center gap-2">
                  <Euro size={18} className="text-[#8b6f47]" /> €
                  {experience.price}
                </p>
              </div>

              <div className="mt-6 flex flex-wrap justify-between gap-3">
                <button
                  onClick={() => handleEditExperience(experience)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-400 text-white hover:bg-yellow-500 transition-all shadow-sm"
                >
                  <Pencil size={18} /> Edit
                </button>
                <button
                  onClick={() => handleDeleteExperience(experience.id)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-500 text-white hover:bg-red-600 transition-all shadow-sm"
                >
                  <Trash2 size={18} /> Delete
                </button>
                <button
                  onClick={() => setPreviewExperience(experience)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-all shadow-sm"
                >
                  <Eye size={18} /> Preview
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editingExperience && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-3xl p-8 overflow-y-auto max-h-[90vh] text-[#5a4a3f] font-serif space-y-6">
            <h3 className="text-3xl font-semibold text-center">
              Edit Experience
            </h3>
            <form
              className="grid grid-cols-1 sm:grid-cols-2 gap-6"
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

              {/* Images + uploads */}
              <div className="col-span-1 sm:col-span-2 space-y-4">
                <label className="block text-sm font-medium mb-1">
                  Uploaded Images
                </label>
                <div className="flex flex-wrap gap-4">
                  {(editingExperience.images || []).map((img, i) => (
                    <div key={i} className="relative w-32 h-32">
                      <img
                        src={img}
                        alt={`Uploaded ${i + 1}`}
                        className="w-full h-full object-cover rounded-md"
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteImage(i)}
                        className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
                      >
                        <span className="text-xs">X</span>
                      </button>
                    </div>
                  ))}
                  {uploadedImages.map((img, i) => (
                    <div key={`new-${i}`} className="relative w-32 h-32">
                      <img
                        src={img}
                        alt={`New ${i + 1}`}
                        className="w-full h-full object-cover rounded-md"
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteImageFromNew(i)}
                        className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
                      >
                        <span className="text-xs">X</span>
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={openCloudinaryWidget}
                  className="px-4 py-2 bg-[#8b6f47] text-white rounded-full font-medium shadow-sm hover:bg-[#a78b62] transition-all"
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
              <div className="mb-6 col-span-1 sm:col-span-2">
                <label className="block text-sm mb-1 font-medium">
                  Frequency (Select Days)
                </label>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                    "Sunday",
                  ].map((day) => (
                    <label key={day} className="inline-flex items-center">
                      <input
                        type="checkbox"
                        name="frequency"
                        value={day}
                        defaultChecked={editingExperience.frequency?.includes(
                          day
                        )}
                      />
                      <span className="ml-2">{day}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Visibility */}
              <div className="mb-6 col-span-1 sm:col-span-2">
                <label className="inline-flex items-center">
                  <input
                    type="checkbox"
                    name="visibility"
                    defaultChecked={editingExperience.visibility}
                  />
                  <span className="ml-2">Public (visibility)</span>
                </label>
              </div>

              {/* Buttons */}
              <div className="col-span-1 sm:col-span-2 flex justify-end gap-3 pt-2">
                <button
                  type="submit"
                  className="px-6 py-2 rounded-full bg-[#8b6f47] text-white hover:bg-[#a78b62] transition-all shadow-sm"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditingExperience(null)}
                  className="px-6 py-2 rounded-full bg-gray-300 text-[#5a4a3f] hover:bg-gray-400 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {previewExperience && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#f4f1ec] rounded-3xl shadow-2xl w-full max-w-6xl p-8 overflow-y-auto max-h-[95vh] text-[#2f2f2f] font-serif space-y-10 relative">
            <button
              onClick={() => setPreviewExperience(null)}
              className="absolute top-6 right-6 text-3xl font-bold text-gray-500 hover:text-gray-700"
            >
              &times;
            </button>

            <div className="text-center space-y-2">
              <div className="flex flex-col items-center gap-2 mb-4">
                <h1 className="text-3xl sm:text-5xl font-serif text-[#5a4a3f]">
                  {previewExperience.name}
                </h1>
                <span
                  className={`inline-block px-4 py-1 rounded-full text-xs font-semibold tracking-wider ${
                    previewExperience.visibility
                      ? "bg-green-200 text-green-800"
                      : "bg-red-200 text-red-800"
                  }`}
                >
                  {previewExperience.visibility ? "Public" : "Private"}
                </span>
              </div>
              <p className="text-lg text-[#4a4a4a] italic">
                {previewExperience.duration}
              </p>
              <p className="text-2xl font-medium text-[#5a4a3f]">
                €{previewExperience.price}
              </p>
              <p className="text-sm text-[#8b6f47]">
                Location: {previewExperience.location}
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
                      className="w-full h-full object-cover rounded-xl"
                    />
                  </div>
                ))}
              </section>
            )}

            {previewExperience.whatsIncluded && (
              <section className="max-w-4xl mx-auto text-center">
                <h3 className="text-3xl font-serif text-[#5a4a3f] mb-6">
                  What’s Included
                </h3>
                <ul className="list-disc list-inside text-md sm:text-lg text-[#4a4a4a] space-y-2 text-left">
                  {previewExperience.whatsIncluded
                    .split("\n")
                    .map((item, i) => (
                      <li key={i} className="text-lg sm:text-xl">
                        {item}
                      </li>
                    ))}
                </ul>
              </section>
            )}

            {previewExperience.whatToBring && (
              <section className="max-w-4xl mx-auto text-center">
                <h3 className="text-3xl font-serif text-[#5a4a3f] mb-6">
                  What to Bring
                </h3>
                <p className="text-lg sm:text-xl text-[#4a4a4a]">
                  {previewExperience.whatToBring}
                </p>
              </section>
            )}

            {previewExperience.whyYoullLove && (
              <section className="max-w-4xl mx-auto text-center">
                <h3 className="text-3xl font-serif text-[#5a4a3f] mb-6">
                  Why You’ll Love It
                </h3>
                <p className="text-lg sm:text-xl text-[#4a4a4a] whitespace-pre-line">
                  {previewExperience.whyYoullLove}
                </p>
              </section>
            )}

            {previewExperience.mapPin && (
              <section className="max-w-5xl mx-auto text-center">
                <h3 className="text-3xl font-serif text-[#5a4a3f] mb-6">
                  Where You'll Be
                </h3>
                <div className="w-full h-[300px] rounded-xl overflow-hidden shadow-lg">
                  <iframe
                    src={`https://www.google.com/maps?q=${previewExperience.mapPin}&z=14&output=embed`}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                  />
                </div>
              </section>
            )}

            {previewExperience.guestReviews?.length > 0 && (
              <section className="max-w-4xl mx-auto text-center">
                <h3 className="text-3xl font-serif text-[#5a4a3f] mb-6">
                  Guest Reviews
                </h3>
                <div className="grid gap-6 sm:grid-cols-2">
                  {previewExperience.guestReviews.map((review, i) => (
                    <div
                      key={i}
                      className="bg-white p-6 rounded-2xl shadow-xl border-2 border-[#e0dcd4]"
                    >
                      <p className="font-semibold text-lg text-[#5a4a3f]">
                        Guest
                      </p>
                      <p className="italic text-[#4a4a4a] mt-2">“{review}”</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

function LabeledInput({
  name,
  label,
  defaultValue,
  type = "text",
  required = true,
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="w-full p-3 border border-[#e0dcd4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b6f47]"
      />
    </div>
  );
}

function LabeledTextarea({ name, label, defaultValue, required = true }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <textarea
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="w-full p-3 border border-[#e0dcd4] rounded-lg h-24 focus:outline-none focus:ring-2 focus:ring-[#8b6f47]"
      />
    </div>
  );
}

export default AdminExperiencesPage;
