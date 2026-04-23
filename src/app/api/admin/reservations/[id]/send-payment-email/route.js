import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import sendPaymentRequest from "@/lib/email/sendPaymentRequest";

export async function POST(req, { params }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { admin } = auth;
  const { id } = params;

  try {
    const { paymentLink } = await req.json();

    const { data: booking } = await admin
      .from("booking")
      .select("*, Experience(name)")
      .eq("id", id)
      .single();

    const result = await sendPaymentRequest({
      to: booking.primary_contact.email,
      booking,
      paymentLink,
    });

    if (!result.sent) throw new Error(result.error);

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
