// app/api/admin/uploads/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";

// Configure via env:
// CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function uploadStreamToCloudinary(webFile, opts = {}) {
  const nodeStream = Readable.fromWeb(webFile.stream());
  return new Promise((resolve, reject) => {
    const cld = cloudinary.uploader.upload_stream(
      { resource_type: "image", ...opts },
      (err, res) => (err ? reject(err) : resolve(res))
    );
    nodeStream.pipe(cld);
  });
}

export async function POST(req) {
  try {
    const ctype = req.headers.get("content-type") || "";
    if (!ctype.toLowerCase().includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Expected multipart/form-data" },
        { status: 415 }
      );
    }

    const form = await req.formData();
    const files = form.getAll("file"); // supports multiple "file" fields
    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const folder =
      (form.get("folder") && String(form.get("folder"))) || "oasis/uploads";

    const uploads = [];
    for (const f of files) {
      // f is a web File
      if (!f || typeof f.stream !== "function") continue;
      // (Optional) basic guard
      if (f.type && !f.type.startsWith("image/")) {
        continue;
      }
      const res = await uploadStreamToCloudinary(f, {
        folder,
        overwrite: false,
        // eager: [{ width: 1600, crop: "limit", quality: "auto" }], // optional
      });
      uploads.push({
        url: res.secure_url,
        secure_url: res.secure_url,
        public_id: res.public_id,
        width: res.width,
        height: res.height,
        bytes: res.bytes,
        format: res.format,
      });
    }

    if (uploads.length === 0) {
      return NextResponse.json(
        { error: "No images uploaded" },
        { status: 400 }
      );
    }

    return NextResponse.json({ files: uploads }, { status: 200 });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: err?.message || "Upload failed" },
      { status: 500 }
    );
  }
}
