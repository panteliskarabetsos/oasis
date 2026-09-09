// src/app/api/shop/checkout/route.js
// Creates a pending shop_order from a client-supplied basket and hands back
// either a PaymentIntent client secret (native PaymentSheet) or a Stripe
// Checkout URL. Prices, stock and currency are ALWAYS re-read from the
// database — the basket only ever contributes product ids and quantities.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  ADDRESS_FIELDS,
  CONTACT_FIELDS,
  ORDER_PENDING,
  SHIPPING_COLUMNS,
  cleanBlob,
  getShippingSettings,
} from "@/lib/shop/server";
import { isMissingSchema } from "@/lib/shop/schema";
import { quoteShipping } from "@/lib/shop/shipping";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

const MAX_QTY_PER_LINE = 20;
const MAX_LINES = 25;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The signed-in customer, when the request carried a Supabase session. */
async function currentAuthUserId() {
  try {
    const supa = await createSupabaseServer();
    if (!supa) return null;
    const {
      data: { user },
    } = await supa.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export async function POST(req) {
  const admin = createSupabaseAdmin();
  if (!admin) return bad("Server not configured", 500);

  let body;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON body");
  }

  const mode = body?.mode === "checkout" ? "checkout" : "elements";

  /* ----------------------------- shop paused? ---------------------------- */
  try {
    const { data: setting } = await admin
      .from("AppSetting")
      .select("bookingspaused, bookingspausedmessage")
      .eq("key", "shop")
      .maybeSingle();
    if (setting?.bookingspaused) {
      return bad(
        setting.bookingspausedmessage ||
          "Our shop is briefly closed. Please try again soon.",
        409
      );
    }
  } catch {
    // a settings read failure must not block a sale
  }

  /* ------------------------------- basket -------------------------------- */
  const rawItems = Array.isArray(body?.items) ? body.items : [];
  if (!rawItems.length) return bad("Your bag is empty");
  if (rawItems.length > MAX_LINES) return bad("Too many items in one order");

  const wanted = new Map(); // productId -> { quantity, option }
  for (const line of rawItems) {
    const pid = Number(line?.productId ?? line?.id);
    const qty = Math.floor(Number(line?.quantity ?? 1));
    if (!Number.isFinite(pid) || pid <= 0) return bad("Invalid product in bag");
    if (!Number.isFinite(qty) || qty <= 0) return bad("Invalid quantity");
    if (qty > MAX_QTY_PER_LINE)
      return bad(`Maximum ${MAX_QTY_PER_LINE} of any single item per order`);
    const option = line?.option ? String(line.option).slice(0, 60) : null;
    // One product may legitimately appear twice with different options.
    const key = `${pid}::${option ?? ""}`;
    const prev = wanted.get(key);
    wanted.set(key, {
      productId: pid,
      option,
      quantity: Math.min((prev?.quantity ?? 0) + qty, MAX_QTY_PER_LINE),
    });
  }

  const productIds = [...new Set([...wanted.values()].map((l) => l.productId))];

  /* ---------------------------- contact details -------------------------- */
  const contact = cleanBlob(body?.contact, CONTACT_FIELDS);
  if (!contact.name) return bad("Please tell us your name");
  if (!contact.email || !EMAIL_RE.test(contact.email))
    return bad("Please enter a valid email address");

  const wantsPickup = body?.shippingMethod === "pickup";
  const shipping = cleanBlob(
    { ...(body?.shipping || {}), name: body?.shipping?.name || contact.name },
    ADDRESS_FIELDS
  );
  // Collection needs no address; anything going on a courier does.
  if (!wantsPickup && (!shipping.line1 || !shipping.city || !shipping.postalCode)) {
    return bad("Please complete your delivery address");
  }
  if (!shipping.country) shipping.country = "GR";

  /* ------------------------- price from the database --------------------- */
  const PRODUCT_BASE = "id, slug, title, price_cents, currency, active, stock_qty";
  let { data: products, error: prodErr } = await admin
    .from("shop_product")
    .select(`${PRODUCT_BASE}, ${SHIPPING_COLUMNS}`)
    .in("id", productIds);
  if (prodErr && isMissingSchema(prodErr)) {
    // Pre-migration: nothing has dimensions, so delivery prices at zero.
    ({ data: products, error: prodErr } = await admin
      .from("shop_product")
      .select(PRODUCT_BASE)
      .in("id", productIds));
  }
  if (prodErr) return bad(prodErr.message || "Could not price your bag", 500);

  const byId = new Map((products || []).map((p) => [Number(p.id), p]));

  // Stock is checked against the whole basket, so two lines of the same
  // product (different options) cannot each pass on the same last unit.
  const perProduct = new Map();
  for (const line of wanted.values()) {
    perProduct.set(
      line.productId,
      (perProduct.get(line.productId) || 0) + line.quantity
    );
  }

  const lines = [];
  let currency = null;
  let totalCents = 0;

  for (const line of wanted.values()) {
    const p = byId.get(line.productId);
    if (!p || !p.active) return bad("One of the items is no longer available", 409);

    const stock = Number(p.stock_qty ?? 0);
    const claimed = perProduct.get(line.productId) || 0;
    if (stock < claimed) {
      return bad(
        stock <= 0
          ? `${p.title} has just sold out.`
          : `Only ${stock} × ${p.title} left in stock.`,
        409
      );
    }

    const cur = (p.currency || "EUR").toUpperCase();
    if (!currency) currency = cur;
    else if (currency !== cur)
      return bad("Items in your bag use different currencies", 409);

    const unit = Math.round(Number(p.price_cents ?? 0));
    if (!Number.isFinite(unit) || unit < 0) return bad("Invalid product price", 500);

    totalCents += unit * line.quantity;
    lines.push({
      product_id: p.id,
      quantity: line.quantity,
      unit_price_cents: unit,
      currency: cur,
      title_snapshot: line.option ? `${p.title} — ${line.option}` : p.title,
    });
  }

  if (totalCents <= 0) return bad("This order has no payable total", 409);
  currency = currency || "EUR";

  /* ------------------------------- delivery ------------------------------ */
  // Priced here rather than trusted from the client, with the same function the
  // storefront quoted with.
  const goodsCents = totalCents;
  const shippingMethod = wantsPickup ? "pickup" : "courier";
  const shippingSettings = await getShippingSettings(admin);
  const shipQuote = quoteShipping({
    lines: [...wanted.values()].map((l) => {
      const p = byId.get(l.productId) || {};
      return {
        quantity: l.quantity,
        shipping_weight_grams: p.shipping_weight_grams,
        shipping_length_cm: p.shipping_length_cm,
        shipping_width_cm: p.shipping_width_cm,
        shipping_height_cm: p.shipping_height_cm,
      };
    }),
    settings: shippingSettings,
    country: shipping.country,
    method: shippingMethod,
    subtotalCents: goodsCents,
  });

  if (!shipQuote.available) {
    return bad(shipQuote.reason || "We cannot deliver to that address.", 409);
  }
  const shippingCents = Math.max(0, Number(shipQuote.cents) || 0);
  totalCents = goodsCents + shippingCents;

  /* ----------------------------- persist order --------------------------- */
  const userId = await currentAuthUserId();

  const orderRow = {
    user_id: userId,
    status: ORDER_PENDING,
    total_cents: totalCents,
    currency,
    billing_address: contact,
    shipping_address: shipping,
  };
  let { data: order, error: orderErr } = await admin
    .from("shop_order")
    .insert([{ ...orderRow, shipping_cents: shippingCents, shipping_method: shipQuote.method }])
    .select("id")
    .single();
  if (orderErr && isMissingSchema(orderErr)) {
    ({ data: order, error: orderErr } = await admin
      .from("shop_order")
      .insert([orderRow])
      .select("id")
      .single());
  }
  if (orderErr) return bad(orderErr.message || "Could not open your order", 500);

  const { error: itemsErr } = await admin
    .from("shop_order_item")
    .insert(lines.map((l) => ({ ...l, order_id: order.id })));
  if (itemsErr) {
    await admin.from("shop_order").delete().eq("id", order.id);
    return bad(itemsErr.message || "Could not save your order", 500);
  }

  /* --------------------------------- Stripe ------------------------------ */
  const metadata = {
    kind: "shop",
    shop_order_id: String(order.id),
    customer_email: contact.email,
  };

  try {
    const stripe = getStripe();

    if (mode === "checkout") {
      const origin =
        process.env.NEXT_PUBLIC_SITE_URL ||
        req.headers.get("origin") ||
        "https://www.youroasis.gr";
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: contact.email,
        client_reference_id: `shop-${order.id}`,
        metadata,
        payment_intent_data: { metadata },
        line_items: [
          ...lines.map((l) => ({
            quantity: l.quantity,
            price_data: {
              currency: currency.toLowerCase(),
              unit_amount: l.unit_price_cents,
              product_data: { name: l.title_snapshot },
            },
          })),
          ...(shippingCents > 0
            ? [
                {
                  quantity: 1,
                  price_data: {
                    currency: currency.toLowerCase(),
                    unit_amount: shippingCents,
                    product_data: { name: shipQuote.label || "Delivery" },
                  },
                },
              ]
            : []),
        ],
        success_url: `${origin}/shop/thank-you?order=${order.id}`,
        cancel_url: `${origin}/shop`,
      });

      await admin
        .from("shop_order")
        .update({ stripe_session_id: session.id })
        .eq("id", order.id);

      return ok({
        mode: "checkout",
        orderId: order.id,
        url: session.url,
        amountCents: totalCents,
        goodsCents,
        shippingCents,
        shippingLabel: shipQuote.label,
        currency,
      });
    }

    const intent = await createIntent(stripe, {
      amount: totalCents,
      currency: currency.toLowerCase(),
      metadata,
      receipt_email: contact.email,
      description: `Oasis shop order #${order.id}`,
    });

    await admin
      .from("shop_order")
      .update({ stripe_payment_intent_id: intent.id })
      .eq("id", order.id);

    return ok({
      mode: "elements",
      orderId: order.id,
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      amountCents: totalCents,
      goodsCents,
      shippingCents,
      shippingLabel: shipQuote.label,
      currency,
    });
  } catch (e) {
    // The order row would otherwise linger forever as an unpayable pending.
    await admin.from("shop_order_item").delete().eq("order_id", order.id);
    await admin.from("shop_order").delete().eq("id", order.id);
    return bad(String(e?.message || e) || "Could not start the payment", 502);
  }
}

/** Automatic payment methods, falling back to card-only on older accounts. */
async function createIntent(stripe, base) {
  try {
    return await stripe.paymentIntents.create({
      ...base,
      automatic_payment_methods: { enabled: true },
    });
  } catch (e) {
    if (e?.code !== "parameter_unknown" || e?.param !== "automatic_payment_methods") {
      throw e;
    }
    return await stripe.paymentIntents.create({
      ...base,
      payment_method_types: ["card"],
    });
  }
}
