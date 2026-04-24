import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import sendPaymentRequest from "@/lib/email/sendPaymentRequest";

export async function POST(req, { params }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { admin } = auth;

  // FIX: Await the params object before destructuring (Next.js 15+ requirement)
  const { id } = await params;

  try {
    const { paymentLink, amountDue } = await req.json();

    const { data: booking } = await admin
      .from("booking")
      .select("*, Experience(name)")
      .eq("id", id)
      .single();

    const result = await sendPaymentRequest({
      to: booking.primary_contact?.email || booking.guest?.email,
      booking,
      paymentLink,
      amountDue,
    });

    if (!result.sent) throw new Error(result.error);

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Email API Error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
