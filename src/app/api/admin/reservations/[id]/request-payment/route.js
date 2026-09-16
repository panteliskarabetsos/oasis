export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "server-only";
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { HOLD_HOURS, holdExpiryFrom } from "@/lib/bookings/holds";
import { createBookingPaymentLink } from "@/lib/bookings/paymentLink";
import { isPaidStatus } from "@/lib/bookings/paymentStatus";
import sendPaymentRequest from "@/lib/email/sendPaymentRequest";

/** Deliberately loose — the mail server is the real judge of an address. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Put a booking on hold and ask the guest to pay.
 *
 * One call rather than three: generate the Stripe link, email it, and stamp
 * the hold. Doing it from the client in stages meant a booking could end up
 * created with no link, or with a link nobody was sent.
 *
 * Paying confirms the booking (the Stripe webhook); the hold lapsing cancels
 * it and returns the seats to availability.
 *
 * Safe to call again. The body may carry { email } to send the link somewhere
 * other than the guest's own address — a corrected typo, or whoever is
 * actually paying — which is how the booking page resends it.
 */
export async function POST(req, { params }) {
  const auth = await requireAdmin("bookings");
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const override = String(body?.email || "").trim();
  if (override && !EMAIL_RE.test(override)) {
    return NextResponse.json(
      { error: "That does not look like an email address." },
      { status: 400 },
    );
  }

  try {
    const link = await createBookingPaymentLink(auth.admin, id, {
      baseUrl: new URL(req.url).origin,
    });
    if (!link.ok) {
      return NextResponse.json({ error: link.error }, { status: link.status });
    }

    const booking = link.booking;
    const guestEmail =
      booking.primary_contact?.email ||
      booking.guest?.email ||
      booking.User?.email ||
      null;
    const to = override || guestEmail;

    // A booking that has already been paid for keeps its status.
    //
    // This route flips a booking to "pending" and starts the hold clock, which
    // is the point when the booking is first made. Resending the link for an
    // outstanding balance on a *confirmed* booking — a part payment, say —
    // must not knock it back to pending and put its seats on a countdown.
    const alreadyPaidFor = isPaidStatus(booking.status);

    // The hold is what makes the link meaningful, so it is stamped whether or
    // not the email lands — the seats are held either way and the admin can
    // resend. Tolerates the column not existing yet.
    const expiresAt = holdExpiryFrom();
    let held = false;
    if (!alreadyPaidFor) try {
      const { error } = await auth.admin
        .from("booking")
        .update({ status: "pending", holdExpiresAt: expiresAt.toISOString() })
        .eq("id", id);
      if (error) {
        if (error.code !== "42703" && error.code !== "PGRST204") throw error;
        // No hold column on this deployment: still pending, just not timed.
        await auth.admin.from("booking").update({ status: "pending" }).eq("id", id);
      } else {
        held = true;
      }
    } catch (e) {
      console.error("[request-payment] could not set the hold", id, e?.message || e);
    }

    let emailed = false;
    let emailError = null;
    if (!to) {
      emailError =
        "This booking has no guest email on file. Send it to a specific address instead.";
    } else {
      const result = await sendPaymentRequest({
        to,
        // The row fetched for the link already carries attendees, the meeting
        // point and the unit prices the email breaks down.
        booking,
        paymentLink: link.url,
        amountDue: link.amountDue,
        holdHours: HOLD_HOURS,
      });
      emailed = Boolean(result?.sent);
      if (!emailed) emailError = result?.error || "The email could not be sent.";
    }

    return NextResponse.json({
      ok: true,
      url: link.url,
      amountDue: link.amountDue,
      sentTo: emailed ? to : null,
      sentToGuest: emailed && !override,
      emailed,
      emailError,
      held,
      holdHours: HOLD_HOURS,
      holdExpiresAt: held ? expiresAt.toISOString() : null,
    });
  } catch (e) {
    console.error("[request-payment]", e?.message || e);
    return NextResponse.json(
      { error: e?.message || "Could not request payment for this booking" },
      { status: 500 },
    );
  }
}
