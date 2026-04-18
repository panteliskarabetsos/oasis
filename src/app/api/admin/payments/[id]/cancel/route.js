// src/app/api/admin/payments/[id]/cancel/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

/* ------------------------------ RBAC Config ------------------------------ */
const ALLOWED_CANCEL_ROLES = ["superadmin", "finance", "admin", "manager"];

async function verifyAccess() {
  const supa = await createSupabaseServer();
  const {
    data: { user },
    error,
  } = await supa.auth.getUser();

  if (error || !user)
    return { authorized: false, res: bad("Unauthorized", 401) };

  const adminSupa = createSupabaseAdmin();
  const { data: dbUser } = await adminSupa
    .from("User")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const metaRole = user?.app_metadata?.role || user?.user_metadata?.role;
  const finalRole = dbUser?.role || metaRole || "user";

  if (!ALLOWED_CANCEL_ROLES.includes(finalRole)) {
    return {
      authorized: false,
      res: bad("Forbidden: You do not have permission to cancel payments", 403),
    };
  }

  return { authorized: true, adminSupa, user };
}

/* ------------------------------- Main POST ------------------------------- */
export async function POST(req, context) {
  try {
    // 1. Verify Access
    const access = await verifyAccess();
    if (!access.authorized) return access.res;

    // 2. Validate Params
    // Next 15: params can be async
    const { id } = (await context.params) || {};
    if (!id || !String(id).startsWith("pi_")) {
      return bad("Invalid Payment Intent ID", 400);
    }

    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return bad("Missing STRIPE_SECRET_KEY", 500);

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(key, { apiVersion: "2024-06-20" });

    // 3. Cancel the Payment Intent via Stripe
    let canceledIntent;
    try {
      // You can also pass a cancellation_reason (e.g., 'requested_by_customer', 'fraudulent', 'abandoned')
      // but an empty object defaults to standard cancellation.
      canceledIntent = await stripe.paymentIntents.cancel(id);
    } catch (stripeErr) {
      console.error("[api/payments/cancel] Stripe error:", stripeErr);
      return bad(
        stripeErr.message || "Stripe failed to cancel the payment",
        400,
      );
    }

    // Note: Because this was never captured, there is no "refund" to log.
    // The hold is simply dropped from the customer's card.

    return ok({ success: true, paymentIntent: canceledIntent });
  } catch (e) {
    console.error("[api/payments/cancel] Internal Error:", e);
    return bad("An internal server error occurred", 500);
  }
}
