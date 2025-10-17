export const dynamic = "force-dynamic"; // always fresh

function ok(json) {
  return new Response(JSON.stringify(json), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
function err(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const codeRaw = (url.searchParams.get("code") || "").trim();
    const draftId = url.searchParams.get("draftId"); // optional (reserved for future checks)
    if (!codeRaw) return err(400, "Missing `code` parameter.");

    // Build absolute origin from the incoming request (no headers() needed)
    const origin = url.origin;

    // Pull active promos (re-use your existing API response shape)
    const res = await fetch(`${origin}/api/promotions/active`, {
      cache: "no-store",
    });
    if (!res.ok) return err(503, "Promotions service unavailable.");

    const data = await res.json().catch(() => ({}));
    const codes = Array.isArray(data?.codes) ? data.codes : [];

    // Find match (case-insensitive)
    const codeUpper = codeRaw.toUpperCase();
    const match = codes.find(
      (c) => String(c?.code || "").toUpperCase() === codeUpper
    );

    if (!match) return err(404, "Invalid code.");

    // Expiry check (if provided by your source)
    const endsAt = match?.endsAt ? new Date(match.endsAt) : null;
    if (endsAt && endsAt.getTime() < Date.now())
      return err(410, "This code has expired.");

    // (Optional) You can enforce draft-level rules here by fetching draft details:
    // const draftRes = await fetch(`${origin}/api/bookings/drafts/${draftId}`, { cache: "no-store" });
    // ...compute eligibility based on subtotal, experience, date, etc.

    // Normalize output
    const discountType = String(match.discountType || "percent").toLowerCase(); // "percent" | "fixed"
    const discountValue = Number(match.discountValue ?? 0);
    const currency = match.currency || "EUR";

    // Basic sanity checks
    const safeValue =
      discountType === "percent"
        ? Math.min(Math.max(discountValue, 0), 100) // clamp 0–100%
        : Math.max(discountValue, 0); // non-negative fixed amount

    return ok({
      code: codeUpper,
      discountType,
      discountValue: safeValue,
      currency,
      endsAt: endsAt ? endsAt.toISOString() : null,
      // You can include more metadata if your /active route exposes it
      // e.g., minTotal, allowedExperienceIds, etc.
    });
  } catch (e) {
    return err(500, "Unexpected error validating code.");
  }
}
