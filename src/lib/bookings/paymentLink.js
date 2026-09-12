import "server-only";
import Stripe from "stripe";

/**
 * The Stripe Checkout link a guest uses to pay for a booking.
 *
 * Lifted out of /api/admin/reservations/[id]/generate-payment-link so the
 * "email the guest a link" flow on the new-booking page creates exactly the
 * same link as the button on the booking detail page. Two implementations
 * would eventually disagree about what the guest owes.
 */

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * @returns {Promise<{ok:true, url:string, sessionId:string, paymentIntentId:string|null,
 *                     amountDue:number, booking:object}
 *                  | {ok:false, error:string, status:number}>}
 */
export async function createBookingPaymentLink(admin, bookingId, { baseUrl } = {}) {
  // Stripe needs absolute return URLs. NEXT_PUBLIC_SITE_URL is not set in every
  // environment, and without it `${undefined}/booking/success` was sent — which
  // Stripe rejects with "Invalid URL: An explicit scheme (such as https) must
  // be provided", so no link was ever created. Fall back to the caller's own
  // origin rather than depending on one variable being present.
  const origin = absoluteOrigin(
    baseUrl ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL,
  );
  if (!origin) {
    return {
      ok: false,
      status: 500,
      error:
        "No site URL is configured, so Stripe has nowhere to send the guest back to. Set NEXT_PUBLIC_SITE_URL.",
    };
  }

  const { data: booking, error: fetchErr } = await admin
    .from("booking")
    .select("*, Experience(name)")
    .eq("id", bookingId)
    .single();

  if (fetchErr || !booking) {
    return { ok: false, error: "Booking not found", status: 404 };
  }

  const adults = Number(booking.adultsCount ?? 1);
  const kids = Number(booking.kidsCount ?? 0);
  const priceA = Number(booking.unitPriceAdult ?? 0);
  const priceK = Number(booking.unitPriceKid ?? 0);
  const discount = Number(booking.discountAmount ?? 0);
  const alreadyPaid = Number(booking.totalPaidAmount ?? 0);

  const totalCost = adults * priceA + kids * priceK - discount;
  const balanceDue = Math.max(0, totalCost - alreadyPaid);

  if (balanceDue <= 0) {
    return { ok: false, error: "This booking is already fully paid.", status: 400 };
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: (booking.currency || "eur").toLowerCase(),
          product_data: {
            name:
              booking.customExperienceName ||
              booking.Experience?.name ||
              "Oasis Experience",
            description: `Booking Reference: ${booking.code || bookingId}`,
          },
          unit_amount: Math.round(balanceDue * 100),
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${origin}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/admin/bookings/${bookingId}/payment-setup`,
    metadata: {
      bookingId: String(bookingId),
      admin_generated: "true",
    },
    customer_email: booking.primary_contact?.email || undefined,
  });

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  const { error: updateErr } = await admin
    .from("booking")
    .update({
      stripeSessionId: session.id,
      stripeSessionUrl: session.url,
      stripePaymentIntentId: paymentIntentId,
    })
    .eq("id", bookingId);

  if (updateErr) {
    // The link is real and usable even if we failed to file it.
    console.error("[payment link] could not store the session", updateErr);
  }

  return {
    ok: true,
    url: session.url,
    sessionId: session.id,
    paymentIntentId,
    amountDue: balanceDue,
    booking,
  };
}

/** A usable absolute origin, or null if the value cannot make one. */
function absoluteOrigin(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withScheme).origin;
  } catch {
    return null;
  }
}
