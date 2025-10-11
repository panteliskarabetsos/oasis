// src/app/api/admin/reservations/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { transporter } from "@/lib/email/nodemailer";
import { sendConfirmationEmail } from "@/lib/email/sendConfirmationEmail";
import { generateCancellationEmail } from "@/lib/email/cancellationEmail";

const ok = (data, status = 200) => NextResponse.json(data, { status });
const err = (msg, status = 500) =>
  NextResponse.json({ error: msg }, { status });

async function getAuthUser() {
  const supa = await createSupabaseServer();
  const { data, error } = await supa.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}

async function requireAdmin() {
  const user = await getAuthUser();
  if (!user) return err("Unauthorized", 401);

  if (
    user?.app_metadata?.role === "admin" ||
    user?.user_metadata?.role === "admin"
  ) {
    return { user };
  }

  const admin = createSupabaseAdmin();
  if (!admin) return err("Server not configured", 500);

  const { data: dbUser, error: roleErr } = await admin
    .from("User")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (roleErr) {
    console.error("[reservations] role lookup error", roleErr);
    return err("Server error", 500);
  }
  if (dbUser?.role === "admin") return { user };
  return err("Unauthorized", 401);
}

async function requireUserAndDbId() {
  const user = await getAuthUser();
  if (!user) return { error: err("Unauthorized", 401) };

  const admin = createSupabaseAdmin();
  if (!admin) return { error: err("Server not configured", 500) };

  const { data: dbUser, error: upErr } = await admin
    .from("User")
    .select("id,email")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (upErr) {
    console.error("[reservations] user map error", upErr);
    return { error: err("Server error", 500) };
  }
  if (!dbUser) return { error: err("User profile not found", 404) };

  return { authUser: user, dbUserId: dbUser.id };
}

/* ===================== GET (Admin) ===================== */
export async function GET() {
  const gate = await requireAdmin();
  if ("body" in gate) return gate;

  const admin = createSupabaseAdmin();
  try {
    const { data, error } = await admin
      .from("Booking")
      .select(
        `
        id,
        numberOfPeople,
        notes,
        user:User ( id, email, name, surname, phone ),
        scheduleSlot:ScheduleSlot (
          id, date,
          experience:Experience ( id, name )
        )
      `
      )
      .order("date", { foreignTable: "ScheduleSlot", ascending: false });

    if (error) throw error;
    return ok(Array.isArray(data) ? data : []);
  } catch (e) {
    console.error("Error fetching reservations:", e);
    return err("Failed to fetch reservations", 500);
  }
}

/* ===================== POST (User) ===================== */
export async function POST(req) {
  const map = await requireUserAndDbId();
  if (map.error) return map.error;

  const admin = createSupabaseAdmin();
  if (!admin) return err("Server not configured", 500);

  const { dbUserId } = map;
  const { scheduleSlotId, numberOfPeople = 1, notes = "" } = await req.json();
  const nowIso = new Date().toISOString();

  try {
    // 1) load slot
    const { data: slot, error: slotErr } = await admin
      .from("ScheduleSlot")
      .select("id, totalSlots, bookedSlots")
      .eq("id", Number(scheduleSlotId))
      .single();

    if (slotErr) throw slotErr;
    if (!slot) return err("Schedule slot not found", 404);

    if (slot.bookedSlots + Number(numberOfPeople) > slot.totalSlots) {
      return err("Not enough available slots for this date", 400);
    }

    // 2) increment slot.bookedSlots (+ touch updatedAt)
    const newBooked = slot.bookedSlots + Number(numberOfPeople);
    const { error: incErr } = await admin
      .from("ScheduleSlot")
      .update({ bookedSlots: newBooked, updatedAt: nowIso })
      .eq("id", slot.id);
    if (incErr) throw incErr;

    // 3) create booking with timestamps
    const { data: booking, error: bookErr } = await admin
      .from("Booking")
      .insert({
        userId: Number(dbUserId),
        scheduleSlotId: Number(scheduleSlotId),
        numberOfPeople: Number(numberOfPeople),
        notes: notes || null,
        createdAt: nowIso,
        updatedAt: nowIso,
        // status: "confirmed",      // if you don't have a default
      })
      .select(
        `
        id,
        user:User ( name, email ),
        scheduleSlot:ScheduleSlot ( date, experience:Experience ( name, location ) )
      `
      )
      .single();

    // If insert failed, roll back the increment to keep counts consistent
    if (bookErr) {
      await admin
        .from("ScheduleSlot")
        .update({ bookedSlots: slot.bookedSlots, updatedAt: nowIso })
        .eq("id", slot.id);
      throw bookErr;
    }

    // 4) send email (best-effort)
    try {
      const { subject, html } = sendBookingConfirmationEmail(booking);
      await transporter.sendMail({
        from: `"Oasis" <${process.env.EMAIL_USER}>`,
        to: booking.user?.email,
        subject,
        html,
      });
    } catch (mailErr) {
      console.warn("[reservations] mail send failed", mailErr);
    }

    return ok({ id: booking.id }, 201);
  } catch (e) {
    console.error("Error creating reservation:", e);
    return err("Failed to create reservation", 500);
  }
}

/* ===================== PATCH (Admin) ===================== */
export async function PATCH(req) {
  const gate = await requireAdmin();
  if ("body" in gate) return gate;

  const admin = createSupabaseAdmin();
  if (!admin) return err("Server not configured", 500);

  const body = await req.json();
  const { id, userId, scheduleSlotId, numberOfPeople = 1, notes = "" } = body;
  const nowIso = new Date().toISOString();

  try {
    // Load old booking
    const { data: old, error: oldErr } = await admin
      .from("Booking")
      .select("id, userId, scheduleSlotId, numberOfPeople")
      .eq("id", Number(id))
      .single();
    if (oldErr) throw oldErr;
    if (!old) return err("Booking not found", 404);

    const isSlotChanged = old.scheduleSlotId !== Number(scheduleSlotId);
    const isPeopleChanged = old.numberOfPeople !== Number(numberOfPeople);

    if (isSlotChanged || isPeopleChanged) {
      // revert old slot count
      const { data: oldSlot, error: osErr } = await admin
        .from("ScheduleSlot")
        .select("id, bookedSlots")
        .eq("id", old.scheduleSlotId)
        .single();
      if (osErr) throw osErr;

      const { error: decErr } = await admin
        .from("ScheduleSlot")
        .update({
          bookedSlots: Math.max(
            0,
            (oldSlot.bookedSlots || 0) - old.numberOfPeople
          ),
          updatedAt: nowIso,
        })
        .eq("id", oldSlot.id);
      if (decErr) throw decErr;

      // check new slot
      const { data: newSlot, error: nsErr } = await admin
        .from("ScheduleSlot")
        .select("id, totalSlots, bookedSlots")
        .eq("id", Number(scheduleSlotId))
        .single();
      if (nsErr) throw nsErr;
      if (!newSlot) return err("Schedule slot not found", 404);

      if (newSlot.bookedSlots + Number(numberOfPeople) > newSlot.totalSlots) {
        return err("Not enough availability on new slot", 400);
      }

      // increment new slot
      const { error: incErr } = await admin
        .from("ScheduleSlot")
        .update({
          bookedSlots: newSlot.bookedSlots + Number(numberOfPeople),
          updatedAt: nowIso,
        })
        .eq("id", newSlot.id);
      if (incErr) throw incErr;
    }

    // update booking (+ touch updatedAt)
    const { data: updated, error: upErr } = await admin
      .from("Booking")
      .update({
        userId: Number(userId),
        scheduleSlotId: Number(scheduleSlotId),
        numberOfPeople: Number(numberOfPeople),
        notes: notes || null,
        updatedAt: nowIso, // ✅ keep fresh
      })
      .eq("id", Number(id))
      .select()
      .single();

    if (upErr) throw upErr;
    return ok(updated);
  } catch (e) {
    console.error("Error updating reservation:", e);
    return err("Failed to update reservation", 500);
  }
}

/* ===================== DELETE (Admin) ===================== */
export async function DELETE(req) {
  const gate = await requireAdmin();
  if ("body" in gate) return gate;

  const admin = createSupabaseAdmin();
  if (!admin) return err("Server not configured", 500);

  const { id } = await req.json();

  try {
    // load full booking to email & decrement
    const { data: booking, error: loadErr } = await admin
      .from("Booking")
      .select(
        `
        id,
        numberOfPeople,
        scheduleSlotId,
        user:User ( email, name ),
        scheduleSlot:ScheduleSlot ( id, date, experience:Experience ( id, name, location ) )
      `
      )
      .eq("id", Number(id))
      .single();
    if (loadErr) throw loadErr;
    if (!booking) return err("Booking not found", 404);

    // delete booking
    const { error: delErr } = await admin
      .from("Booking")
      .delete()
      .eq("id", Number(id));
    if (delErr) throw delErr;

    // decrement slot count
    const { data: slot, error: slotErr } = await admin
      .from("ScheduleSlot")
      .select("id, bookedSlots")
      .eq("id", booking.scheduleSlotId)
      .single();
    if (slotErr) throw slotErr;

    const { error: decErr } = await admin
      .from("ScheduleSlot")
      .update({
        bookedSlots: Math.max(
          0,
          (slot.bookedSlots || 0) - booking.numberOfPeople
        ),
        updatedAt: new Date().toISOString(),
      })
      .eq("id", slot.id);
    if (decErr) throw decErr;
    // 0) Global pause check
    const { data: global, error: gErr } = await admin
      .from("AppSetting")
      .select("bookingsPaused, bookingsPausedUntil, bookingsPausedMessage")
      .eq("key", "global")
      .single();
    if (gErr) throw gErr;

    const isGloballyPaused =
      !!global?.bookingsPaused ||
      (global?.bookingsPausedUntil &&
        new Date(global.bookingsPausedUntil) > new Date());

    if (isGloballyPaused) {
      return err(
        global?.bookingsPausedMessage ||
          "Bookings are temporarily unavailable. Please try again later.",
        403
      );
    }

    // email cancellation (best-effort)
    try {
      const emailContent = generateCancellationEmail(booking);
      await transporter.sendMail({
        to: booking.user?.email,
        from: `"Oasis" <${process.env.EMAIL_USER}>`,
        subject: emailContent.subject,
        html: emailContent.html,
      });
    } catch (mailErr) {
      console.warn("[reservations] cancellation mail failed", mailErr);
    }

    return ok({ success: true });
  } catch (e) {
    console.error("Error deleting reservation:", e);
    return err("Failed to delete reservation", 500);
  }
}
