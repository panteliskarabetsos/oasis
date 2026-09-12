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
    .select("*, Experience(name, location)")
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

  // An exceptional meeting point can carry its own charge; it travels on the
  // stored meeting point so there is one place it can come from.
  const meetup = booking.selected_meetup_point || null;
  const meetupSurcharge = Math.max(0, Number(meetup?.surcharge) || 0);

  const totalCost =
    adults * priceA + kids * priceK + meetupSurcharge - discount;
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
            // Stripe shows this under the line item, so the guest can check
            // what they are paying for before they pay: when, where, who.
            description: describeBooking(booking, {
              adults,
              kids,
              meetup,
              meetupSurcharge,
            }),
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
    // The same id on the PaymentIntent, so payment_intent.succeeded can
    // identify the booking too. Without it that event was anonymous and the
    // session event was the only thing that could confirm the booking.
    payment_intent_data: {
      metadata: {
        bookingId: String(bookingId),
        admin_generated: "true",
      },
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

/** Stripe caps a line-item description at 500 characters. */
const DESCRIPTION_LIMIT = 500;

/**
 * What the guest sees on the Stripe page beneath the experience name.
 *
 * Date and time, where to meet, and who is coming — the things someone checks
 * before paying. Trimmed to Stripe's limit, dropping detail from the end so
 * the date and meeting point always survive.
 */
function describeBooking(booking, { adults, kids, meetup, meetupSurcharge }) {
  const parts = [];

  if (booking.startTime) {
    const when = new Date(booking.startTime);
    if (!Number.isNaN(when.getTime())) {
      parts.push(
        when.toLocaleString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/Athens",
        }),
      );
    }
  }

  if (meetup?.name) {
    const time = meetup.time ? ` at ${meetup.time}` : "";
    const extra = meetupSurcharge > 0 ? " (private pickup)" : "";
    parts.push(`Meet: ${meetup.name}${time}${extra}`);
  }

  const party = [
    adults ? `${adults} adult${adults === 1 ? "" : "s"}` : null,
    kids ? `${kids} child${kids === 1 ? "" : "ren"}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  if (party) parts.push(party);

  const names = attendeeNames(booking.attendees);
  if (names) parts.push(`Guests: ${names}`);

  parts.push(`Ref ${booking.code || booking.id}`);

  let out = parts.join(" · ");
  if (out.length > DESCRIPTION_LIMIT) {
    // Drop from the end (guest names first) until it fits.
    while (parts.length > 2 && out.length > DESCRIPTION_LIMIT) {
      parts.splice(parts.length - 2, 1);
      out = parts.join(" · ");
    }
    if (out.length > DESCRIPTION_LIMIT) out = `${out.slice(0, DESCRIPTION_LIMIT - 1)}…`;
  }
  return out;
}

function attendeeNames(attendees) {
  if (!Array.isArray(attendees) || !attendees.length) return "";
  return attendees
    .map((a) =>
      String(
        a?.name || [a?.firstName, a?.lastName].filter(Boolean).join(" ") || "",
      ).trim(),
    )
    .filter(Boolean)
    .join(", ");
}
