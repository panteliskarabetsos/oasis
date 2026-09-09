"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Same account the experiences pages have always uploaded to.
const DEFAULT_CLOUD_NAME =
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "docgxigth";
const DEFAULT_UPLOAD_PRESET =
  process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "ml_default";

/**
 * Cloudinary upload button.
 *
 * Two call styles, because two parts of the admin grew up separately:
 *   • setUploadedImages — a state setter that collects secure_url strings
 *     (ExperienceForm).
 *   • onUploaded(assets) — receives the raw Cloudinary asset objects, so the
 *     caller can keep alt text / filenames (the e-shop product form).
 * Both fire on every successful file; pass either, or both.
 *
 * Children, when given, become the trigger — otherwise a default button is
 * rendered.
 */
const CloudinaryWidget = ({
  cloudName,
  uploadPreset,
  folder,
  multiple = true,
  maxFiles = 10,
  onUploaded,
  setUploadedImages,
  children,
  label = "Upload Images",
  helper,
  className = "",
}) => {
  const [ready, setReady] = useState(false);
  const widgetRef = useRef(null);

  // The loader script lives in the root layout, but it is async — poll briefly
  // so the button doesn't sit dead if we render before it lands.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.cloudinary) {
      setReady(true);
      return;
    }
    let tries = 0;
    const timer = setInterval(() => {
      if (window.cloudinary) {
        setReady(true);
        clearInterval(timer);
      } else if (++tries > 40) {
        clearInterval(timer);
      }
    }, 250);
    return () => clearInterval(timer);
  }, []);

  // Rebuilding the widget on every click leaks iframes; keep one per config.
  useEffect(() => {
    widgetRef.current = null;
  }, [cloudName, uploadPreset, folder, multiple, maxFiles]);

  const open = useCallback(() => {
    if (typeof window === "undefined" || !window.cloudinary) {
      alert("The Cloudinary upload widget hasn't loaded yet — please retry in a moment.");
      return;
    }
    const name = cloudName || DEFAULT_CLOUD_NAME;
    const preset = uploadPreset || DEFAULT_UPLOAD_PRESET;
    if (!name || !preset) {
      alert("Cloudinary is not configured (missing cloud name or upload preset).");
      return;
    }

    if (!widgetRef.current) {
      widgetRef.current = window.cloudinary.createUploadWidget(
        {
          cloudName: name,
          uploadPreset: preset,
          multiple,
          maxFiles,
          ...(folder ? { folder } : {}),
        },
        (error, result) => {
          if (error) {
            console.error("Cloudinary upload error:", error);
            return;
          }
          if (!result || result.event !== "success" || !result.info?.secure_url) return;
          // Notify per file — the widget fires "success" once per upload.
          if (typeof onUploaded === "function") onUploaded([result.info]);
          if (typeof setUploadedImages === "function") {
            setUploadedImages((prev) => [...(prev || []), result.info.secure_url]);
          }
        }
      );
    }
    widgetRef.current.open();
  }, [cloudName, uploadPreset, folder, multiple, maxFiles, onUploaded, setUploadedImages]);

  if (children) {
    return (
      <span
        role="button"
        tabIndex={0}
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open();
          }
        }}
        className={`inline-flex ${className}`}
      >
        {children}
      </span>
    );
  }

  return (
    <div className={className || "mb-6"}>
      <button
        type="button"
        onClick={open}
        className="px-4 py-2 bg-[#8b6f47] text-white rounded-full font-medium shadow-sm hover:bg-[#a78b62] transition-all"
      >
        {label}
      </button>
      {helper ? <p className="text-sm text-gray-500 mt-2">{helper}</p> : null}
      {!ready ? (
        <p className="text-sm text-gray-400 mt-2">Loading the uploader…</p>
      ) : null}
    </div>
  );
};

export default CloudinaryWidget;
