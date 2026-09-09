// src/lib/shop/notify.js
// The automation layer between an order changing and an email going out.
//
// Every trigger point calls notifyOrder(); this decides whether the automation
// is switched on, whether the message has already gone, sends it, and writes
// the result onto the order's timeline so staff can see what the customer
// received. It never throws — a mail server having a bad day must not undo a
// refund or a status change.
import "server-only";

import sendShopOrderEmail from "@/lib/email/sendShopOrderEmail";
import { isMissingSchema } from "@/lib/shop/schema";
import { logEvent } from "@/lib/shop/orders";

export const AUTOMATIONS = {
  paid: {
    label: "Order confirmation",
    description: "To the customer the moment payment succeeds.",
    audience: "customer",
  },
  shipped: {
    label: "Dispatch notice",
    description: "To the customer when an order is marked fulfilled.",
    audience: "customer",
  },
  cancelled: {
    label: "Cancellation notice",
    description: "To the customer when an order is cancelled.",
    audience: "customer",
  },
  refunded: {
    label: "Refund notice",
    description: "To the customer each time money is returned.",
    audience: "customer",
  },
  staff_new_order: {
    label: "New order alert",
    description: "To your team when an order is paid.",
    audience: "staff",
  },
};

const DEFAULTS = Object.fromEntries(Object.keys(AUTOMATIONS).map((k) => [k, true]));

/** Read the shop's email settings, tolerating the pre-migration schema. */
export async function getEmailSettings(admin) {
  const fallbackStaffTo =
    process.env.SHOP_ORDERS_EMAIL ||
    process.env.APP_SUPPORT_EMAIL ||
    process.env.EMAIL_FROM ||
    process.env.EMAIL_USER ||
    "";
  try {
    const { data, error } = await admin
      .from("AppSetting")
      .select("settings")
      .eq("key", "shop")
      .maybeSingle();
    if (error) {
      if (isMissingSchema(error)) {
        return { ...DEFAULTS, staffTo: fallbackStaffTo, available: false };
      }
      throw error;
    }
    const emails = (data?.settings && data.settings.emails) || {};
    return {
      ...DEFAULTS,
      ...Object.fromEntries(
        Object.keys(AUTOMATIONS).map((k) => [k, emails[k] !== false])
      ),
      staffTo: String(emails.staffTo || "").trim() || fallbackStaffTo,
      available: true,
    };
  } catch {
    return { ...DEFAULTS, staffTo: fallbackStaffTo, available: false };
  }
}

/** Has this kind of message already gone out for this order? */
async function alreadySent(admin, orderId, kind) {
  try {
    const { data, error } = await admin
      .from("shop_order_event")
      .select("id")
      .eq("order_id", orderId)
      .eq("type", "email")
      .contains("meta", { kind })
      .limit(1);
    if (error) return false; // no timeline table yet — fall through and send
    return Boolean(data?.length);
  } catch {
    return false;
  }
}

/**
 * Run one automation for an order.
 *
 * @param {object} admin        service-role Supabase client
 * @param {number|string} orderId
 * @param {keyof AUTOMATIONS} kind
 * @param {object} [opts]
 * @param {boolean} [opts.force]  send even if one has gone before (manual resend)
 * @param {object}  [opts.extra]  template extras (refund amount, tracking…)
 * @param {string}  [opts.actorEmail] who triggered it, for the timeline
 */
export async function notifyOrder(admin, orderId, kind, opts = {}) {
  const id = Number(orderId);
  if (!admin || !Number.isFinite(id) || !AUTOMATIONS[kind]) {
    return { sent: false, reason: "bad-request" };
  }

  try {
    const settings = await getEmailSettings(admin);
    if (!opts.force && settings[kind] === false) {
      return { sent: false, reason: "automation-off" };
    }

    // Refund emails are per refund, so a previous one must not block the next.
    const oncePerOrder = kind !== "refunded";
    if (!opts.force && oncePerOrder && (await alreadySent(admin, id, kind))) {
      return { sent: false, reason: "already-sent" };
    }

    const { data: order, error } = await admin
      .from("shop_order")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !order) return { sent: false, reason: "order-not-found" };

    const { data: items } = await admin
      .from("shop_order_item")
      .select("id, product_id, quantity, unit_price_cents, currency, title_snapshot")
      .eq("order_id", id)
      .order("id");

    const isStaff = AUTOMATIONS[kind].audience === "staff";
    const to = isStaff ? settings.staffTo : order.billing_address?.email;
    if (!to) return { sent: false, reason: isStaff ? "no-staff-address" : "no-customer-email" };

    const result = await sendShopOrderEmail({
      kind,
      order,
      items: items || [],
      to,
      extra: opts.extra || {},
    });

    await logEvent(admin, id, {
      type: "email",
      message: result.sent
        ? `${AUTOMATIONS[kind].label} sent to ${to}`
        : `${AUTOMATIONS[kind].label} could not be sent to ${to} — ${result.error}`,
      meta: { kind, to, ok: result.sent, error: result.error || null },
      created_by_email: opts.actorEmail ?? null,
      created_by_name: opts.actorEmail ? null : "Automation",
    });

    return { sent: result.sent, to, error: result.error, reason: result.sent ? "sent" : "send-failed" };
  } catch (e) {
    console.error("[shop notify]", kind, e?.message || e);
    return { sent: false, reason: "error", error: String(e?.message || e) };
  }
}

/** Fire the two messages a freshly paid order produces. */
export async function notifyOrderPaid(admin, orderId, opts = {}) {
  const customer = await notifyOrder(admin, orderId, "paid", opts);
  const staff = await notifyOrder(admin, orderId, "staff_new_order", opts);
  return { customer, staff };
}
