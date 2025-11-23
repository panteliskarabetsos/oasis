import { useEffect } from 'react';

const CloudinaryWidget = ({ setUploadedImages }) => {
  useEffect(() => {
    if (window.cloudinary) {
      window.cloudinary.createUploadWidget(
        {
          cloudName: 'docgxigth', // Your Cloudinary cloud name
          uploadPreset: 'oasis_photos', // Your Cloudinary upload preset
          multiple: true, // Allow multiple image uploads
        },
        (error, result) => {
          if (!error && result && result.event === 'success') {
            setUploadedImages((prevImages) => [
              ...prevImages,
              result.info.secure_url, // Store the uploaded image URL
            ]);
          }
        }
      );
    }
  }, [setUploadedImages]);

  const openCloudinaryWidget = () => {
    if (window.cloudinary) {
      const widget = window.cloudinary.createUploadWidget(
        {
          cloudName: 'docgxigth', // Your Cloudinary cloud name
          uploadPreset: 'ml_default', // Your Cloudinary upload preset
          multiple: true, // Allow multiple image uploads
          maxFiles: 5, // Maximum number of files
        },
        (error, result) => {
          if (!error && result && result.event === 'success') {
            setUploadedImages((prevImages) => [
              ...prevImages,
              result.info.secure_url,
            ]);
          }
          if (error) {
            console.error('Cloudinary upload error:', error);
          }
        }
      );
      widget.open(); // Open the widget when the button is clicked
    } else {
      console.error('Cloudinary is not loaded.');
    }
  };

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={openCloudinaryWidget}
        className="px-4 py-2 bg-[#8b6f47] text-white rounded-full font-medium shadow-sm hover:bg-[#a78b62] transition-all"
      >
        Upload Images
      </button>
      <p className="text-sm text-gray-500 mt-2">Click to upload images for the experience.</p>
    </div>
  );
};

export default CloudinaryWidget;
