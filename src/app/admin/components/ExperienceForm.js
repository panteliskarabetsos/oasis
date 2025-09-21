'use client';

import { useState } from 'react';
import CloudinaryWidget from './CloudinaryWidget';

const ExperienceForm = ({ experience, handleSubmit }) => {
  const [uploadedImages, setUploadedImages] = useState(experience?.images || []);
  const [showAddForm, setShowAddForm] = useState(false);

  const handleFormSubmit = (e) => {
    e.preventDefault();
    const selectedDays = Array.from(
      e.target.querySelectorAll('input[name="frequency"]:checked')
    ).map((checkbox) => checkbox.value);

    const newExperience = {
      name: e.target.name.value,
      description: e.target.description.value,
      price: parseFloat(e.target.price.value),
      location: e.target.location.value,
      duration: e.target.duration.value,
      whatsIncluded: e.target.whatsIncluded.value,
      whatToBring: e.target.whatToBring.value,
      whyYoullLove: e.target.whyYoullLove.value,
      images: uploadedImages, // Store uploaded image URLs from Cloudinary
      mapPin: e.target.mapPin.value,
      guestReviews: e.target.guestReviews.value.split(',').map((s) => s.trim()),
      frequency: selectedDays, // Frequency (selected days)
      visibility: e.target.visibility.checked, // Visibility toggle (public/private)
    };

    handleSubmit(newExperience);
  };

  return (
    <div className="p-8 bg-[#fefcf9] rounded-2xl shadow-xl border border-[#e8e2d8] max-w-4xl mx-auto">
      <h3 className="text-4xl font-serif font-semibold text-[#5a4a3f] mb-10 text-center">
        {experience ? 'Edit Experience' : 'Add New Experience'}
      </h3>

      <form className="space-y-6 font-serif text-[#5a4a3f]" onSubmit={handleFormSubmit}>
        {/* Basic Experience Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { label: 'Name', name: 'name' },
            { label: 'Location', name: 'location' },
            { label: 'Duration', name: 'duration' },
            { label: 'Price (€)', name: 'price', type: 'number' },
            { label: 'Map Pin', name: 'mapPin' },
            { label: 'Guest Reviews (comma-separated)', name: 'guestReviews' },
          ].map(({ label, name, type = 'text' }) => (
            <div key={name}>
              <label className="block text-sm mb-1 font-medium">{label}</label>
              <input
                type={type}
                name={name}
                defaultValue={experience ? experience[name] : ''}
                required={name !== 'mapPin' && name !== 'guestReviews'}
                className="w-full px-4 py-2 rounded-lg border border-[#dcd2c3] bg-white focus:outline-none focus:ring-2 focus:ring-[#8b6f47] shadow-sm"
              />
            </div>
          ))}
        </div>

        {/* Textarea Fields */}
        <div className="grid grid-cols-1 gap-6">
          {[
            { label: 'Description', name: 'description' },
            { label: 'What’s Included', name: 'whatsIncluded' },
            { label: 'What to Bring', name: 'whatToBring' },
            { label: 'Why You’ll Love It', name: 'whyYoullLove' },
          ].map(({ label, name }) => (
            <div key={name}>
              <label className="block text-sm mb-1 font-medium">{label}</label>
              <textarea
                name={name}
                defaultValue={experience ? experience[name] : ''}
                required
                rows={3}
                className="w-full px-4 py-2 rounded-lg border border-[#dcd2c3] bg-white focus:outline-none focus:ring-2 focus:ring-[#8b6f47] shadow-sm"
              />
            </div>
          ))}
        </div>

        {/* Frequency: Days of the Week */}
        <div className="mb-6">
          <label className="block text-sm mb-1 font-medium">Frequency (Select Days)</label>
          <div className="grid grid-cols-2 gap-4">
            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
              <label key={day} className="inline-flex items-center">
                <input
                  type="checkbox"
                  name="frequency"
                  value={day}
                  defaultChecked={experience?.frequency?.includes(day)}
                  className="form-checkbox"
                />
                <span className="ml-2">{day}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Visibility Toggle */}
        <div className="mb-6">
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              name="visibility"
              defaultChecked={experience?.visibility || true}
              className="form-checkbox"
            />
            <span className="ml-2">Public (visibility)</span>
          </label>
        </div>

        {/* Cloudinary Widget Component */}
        <CloudinaryWidget setUploadedImages={setUploadedImages} />

        {/* Display Uploaded Images */}
        {uploadedImages.length > 0 && (
          <div className="mt-4">
            <h4 className="font-medium">Uploaded Images:</h4>
            <ul className="list-disc pl-5">
              {uploadedImages.map((image, index) => (
                <li key={index} className="text-sm text-[#5a4a3f]">{image}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Submit and Cancel Buttons */}
        <div className="flex justify-end gap-4 pt-6">
          <button
            type="submit"
            className="px-6 py-3 bg-[#8b6f47] text-white rounded-full font-medium hover:bg-[#a78b62] transition-all shadow-sm"
          >
            {experience ? 'Save Changes' : 'Save Experience'}
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
  );
};

export default ExperienceForm;
