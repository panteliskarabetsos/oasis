import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export async function PATCH(req, { params }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { admin } = auth;

  // Await params for Next.js 15+ compatibility
  const { id } = await params;

  try {
    const body = await req.json();

    // 1. Fetch current booking to preserve un-edited JSONB data
    const { data: currentBooking, error: fetchError } = await admin
      .from("booking")
      .select("primary_contact, counts, selected_meetup_point")
      .eq("id", id)
      .single();

    if (fetchError) throw new Error("Booking not found");

    // 2. Reconstruct JSONB fields
    const updatedPrimaryContact = {
      ...currentBooking.primary_contact,
      firstName: body.guestFirstName,
      lastName: body.guestLastName,
      name: `${body.guestFirstName} ${body.guestLastName}`.trim(),
      email: body.guestEmail,
      phone: body.guestPhone,
    };

    const updatedCounts = {
      ...currentBooking.counts,
      adults: body.adultsCount,
      kids: body.kidsCount,
      total: body.adultsCount + body.kidsCount,
    };

    // If the frontend sent a full object (from the dropdown), merge it over the current one to preserve time/address
    const updatedMeetupPoint = body.fullMeetupObject
      ? { ...currentBooking.selected_meetup_point, ...body.fullMeetupObject }
      : currentBooking.selected_meetup_point;
    // 3. Prepare the update payload matching the DB schema
    const updatePayload = {
      status: body.status,
      notes: body.notes,
      customExperienceName: body.customExperienceName || null,
      duration: body.duration || null,

      adultsCount: body.adultsCount,
      kidsCount: body.kidsCount,
      numberOfPeople: body.adultsCount + body.kidsCount,

      unitPriceAdult: body.unitPriceAdult,
      unitPriceKid: body.unitPriceKid,

      // Update the total amount based on the frontend calculation
      totalAmount: body.newTotalAmount,

      // Pass the new attendees array directly
      attendees: body.attendees || [],

      primary_contact: updatedPrimaryContact,
      counts: updatedCounts,
      selected_meetup_point: updatedMeetupPoint,

      updatedAt: new Date().toISOString(),
    };

    // 4. Execute Update
    const { error: updateError } = await admin
      .from("booking")
      .update(updatePayload)
      .eq("id", id);

    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[Edit Booking Error]:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
