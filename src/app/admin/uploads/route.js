// inside your upload component:
import { createSupabaseBrowser } from "@/lib/supabase/browser";

async function uploadToSupabase(file, folder = "products") {
  const supabase = createSupabaseBrowser();
  const ext = file.name.split(".").pop() || "bin";
  const path = `${folder}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${ext}`;

  const { data, error } = await supabase.storage
    .from("product-images") // <- your bucket name
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "application/octet-stream",
    });

  if (error) throw error;

  const { data: pub } = supabase.storage
    .from("product-images")
    .getPublicUrl(path);

  return { path, url: pub.publicUrl };
}

// Example onDrop handler
async function onDrop(acceptedFiles) {
  const results = [];
  for (const file of acceptedFiles) {
    const res = await uploadToSupabase(file, `products/${slug || "temp"}`);
    results.push(res);
  }
  // Update your images state with results[i].url
}
