// src/lib/shop/orders.js
// Helpers shared by the e-shop order-operations routes.
import "server-only";

import { isMissingSchema } from "@/lib/shop/schema";

// Shared with the product routes; re-exported so callers here need one import.
export { isMissingSchema } from "@/lib/shop/schema";

export const MIGRATION_HINT =
  "Order history is unavailable until dump_sql/20260909_shop_order_ops.sql has been run.";

/** Who is performing an action, for the timeline. */
export async function actorFor(admin, user) {
  const email = user?.email || null;
  let name = null;
  try {
    const { data } = await admin
      .from("User")
      .select("name, surname")
      .eq("auth_user_id", user?.id)
      .maybeSingle();
    if (data) name = [data.name, data.surname].filter(Boolean).join(" ") || null;
  } catch {
    // the email alone is enough to attribute the entry
  }
  return { created_by_email: email, created_by_name: name };
}

/**
 * Append a timeline entry. Never throws: a failed log must not undo the action
 * it was describing (a refund has already left Stripe by then).
 */
export async function logEvent(admin, orderId, entry) {
  try {
    const { error } = await admin.from("shop_order_event").insert([
      {
        order_id: Number(orderId),
        type: entry.type || "note",
        message: String(entry.message || ""),
        meta: entry.meta || {},
        created_by_email: entry.created_by_email ?? null,
        created_by_name: entry.created_by_name ?? null,
      },
    ]);
    if (error) return { ok: false, missingSchema: isMissingSchema(error) };
    return { ok: true };
  } catch {
    return { ok: false, missingSchema: false };
  }
}

/** Total already refunded against a payment intent, straight from Stripe. */
export async function sumRefunds(stripe, paymentIntentId) {
  let total = 0;
  let startingAfter;
  for (;;) {
    const page = await stripe.refunds.list({
      payment_intent: paymentIntentId,
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    for (const r of page.data || []) total += Number(r.amount || 0);
    if (page.has_more && page.data?.length) {
      startingAfter = page.data[page.data.length - 1].id;
    } else {
      return total;
    }
  }
}

export const ORDER_STATUSES = [
  "pending",
  "paid",
  "fulfilled",
  "cancelled",
  "refunded",
];
