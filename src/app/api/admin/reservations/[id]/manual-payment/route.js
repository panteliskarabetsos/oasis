export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const ok = (d, s = 200) => NextResponse.json(d, { status: s });
const bad = (m, s = 400) => NextResponse.json({ error: m }, { status: s });

async function requireAdmin() {
  const supa = await createSupabaseServer();
  if (!supa)
    return { error: true, response: bad("Server not configured", 500) };

  const { data, error } = await supa.auth.getUser();
  const user = data?.user;
  if (error || !user)
    return { error: true, response: bad("Unauthorized", 401) };

  const admin = createSupabaseAdmin();
  if (!admin)
    return { error: true, response: bad("Server not configured", 500) };

  const { data: profile } = await admin
    .from("User")
    .select("id, role")
    .eq("auth_user_id", user.id)
    .single();

  const role =
    profile?.role ||
    user?.app_metadata?.role ||
    user?.user_metadata?.role ||
    "user";

  if (!["admin", "superadmin", "manager", "finance"].includes(role)) {
    return { error: true, response: bad("Forbidden", 403) };
  }

  return { error: false, admin, user };
}

export async function POST(req, { params }) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.response;
    const admin = auth.admin;

    const { id } = await params;
    const bookingId = Number(id);

    if (!Number.isFinite(bookingId) || bookingId <= 0) {
      return bad("Invalid booking ID", 400);
    }

    const body = await req.json();
    const { method, amount } = body;

    if (!method || typeof amount !== "number" || amount <= 0) {
      return bad(
        "A valid payment method and positive amount are required.",
        400,
      );
    }

    // 1. Fetch current booking to get existing paid amount AND existing notes
    const { data: booking, error: fetchErr } = await admin
      .from("booking")
      .select("id, totalPaidAmount, currency, notes")
      .eq("id", bookingId)
      .single();

    if (fetchErr || !booking) {
      return bad("Booking not found", 404);
    }

    const currentPaid = Number(booking.totalPaidAmount) || 0;
    const newTotalPaid = currentPaid + amount;
    const currency = (booking.currency || "EUR").toUpperCase();

    // 2. Generate an automated System Note
    const dateStr = new Date().toLocaleString("en-GB", {
      timeZone: "Europe/Athens",
      dateStyle: "medium",
      timeStyle: "short",
    });

    const formattedAmount = new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency,
    }).format(amount);

    const auditNote = `[SYSTEM]: Offline payment of ${formattedAmount} via ${method} logged on ${dateStr}.`;

    // Append to existing notes (if any)
    const updatedNotes = booking.notes
      ? `${booking.notes}\n\n${auditNote}`
      : auditNote;

    // 3. Update the booking row
    const { error: updateErr } = await admin
      .from("booking")
      .update({
        totalPaidAmount: newTotalPaid,
        status: "confirmed",
        stripeSessionUrl: null, // Clear active links
        notes: updatedNotes, // <-- ADD THE SYSTEM NOTE HERE
        updatedAt: new Date().toISOString(),
      })
      .eq("id", bookingId);

    if (updateErr) {
      console.error("Failed to update booking:", updateErr);
      return bad("Failed to update booking record", 500);
    }

    // 4. Map the frontend string to your DB ENUM constraint
    let dbMethod = "other";
    const methodLower = String(method).toLowerCase();
    if (methodLower.includes("cash")) dbMethod = "cash";
    else if (methodLower.includes("bank") || methodLower.includes("transfer"))
      dbMethod = "bank_transfer";

    // 5. Record the offline payment in the Ledger / Payments table
    const { error: paymentErr } = await admin.from("payment").insert({
      booking_id: bookingId,
      method: dbMethod,
      amount: amount,
      currency: currency,
      notes: `Offline settlement logged by Admin`,
      processed_at: new Date().toISOString(),
    });

    if (paymentErr) {
      console.warn(
        "Booking updated, but failed to write to payment ledger:",
        paymentErr,
      );
    }

    return ok({ success: true, totalPaid: newTotalPaid });
  } catch (error) {
    console.error("Manual Payment Endpoint Error:", error);
    return bad("Internal server error while processing manual payment", 500);
  }
}
