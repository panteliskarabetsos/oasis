export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { sendGuestConfirmation } from "@/lib/email/bookingConfirmation";

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

/** Deliberately loose — the mail server is the real judge of an address. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * POST /api/admin/reservations/[id]/resend-confirmation
 *
 * Send the guest's booking confirmation again — the same message and ticket
 * PDF the website's own flow sends, not a plainer admin variant. Body may
 * carry { email } to direct the copy somewhere other than the guest's own
 * address.
 */
export async function POST(req, { params }) {
  const auth = await requireAdmin("bookings");
  if (!auth.ok) return auth.response;
  const { admin } = auth;

  const { id } = await params;
  const bookingId = Number(Array.isArray(id) ? id[0] : id);
  if (!Number.isFinite(bookingId) || bookingId <= 0) {
    return bad("Invalid booking id", 400);
  }

  const body = await req.json().catch(() => ({}));
  const override = String(body?.email || "").trim();
  if (override && !EMAIL_RE.test(override)) {
    return bad("That does not look like an email address.", 400);
  }

  try {
    const { data: booking } = await admin
      .from("booking")
      .select("id, primary_contact, userId")
      .eq("id", bookingId)
      .maybeSingle();
    if (!booking) return bad("Booking not found", 404);

    const result = await sendGuestConfirmation(admin, bookingId, {
      to: override || null,
    });

    if (!result.sent) {
      if (result.error === "no-guest-email") {
        return bad(
          "This booking has no guest email on file. Send it to a specific address instead.",
          422,
        );
      }
      return bad(result.error || "The email could not be sent.", 502);
    }

    // Only a send to the guest's own address updates "last sent".
    //
    // That timestamp is also the guard that stops the webhook and the success
    // page both emailing a guest when they pay. Stamping it for a copy sent to
    // the office would silently cancel the guest's own confirmation later.
    let sentAt = null;
    if (!override) {
      sentAt = new Date().toISOString();
      const { error } = await admin
        .from("booking")
        .update({ confirmationEmailSentAt: sentAt })
        .eq("id", bookingId);
      if (error) sentAt = null; // no such column on this deployment
    }

    return NextResponse.json({
      success: true,
      to: override || null,
      confirmationEmailSentAt: sentAt,
    });
  } catch (e) {
    console.error("[resend confirmation]", bookingId, e?.message || e);
    return bad(e?.message || "The email could not be sent.", 500);
  }
}
