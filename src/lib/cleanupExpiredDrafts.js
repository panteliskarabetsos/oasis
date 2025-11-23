// src/lib/cleanupExpiredDrafts.js
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const TABLE = "BookingDraft";
const COL = {
  expiresAt: '"expiresAt"',
  convertedBookingId: '"convertedBookingId"',
  scheduleSlotId: '"scheduleSlotId"',
};

export async function cleanupExpiredDrafts({
  scheduleSlotId = null, // number | null (null = global)
  includeNullExpires = true,
  statuses = ["draft", "checkout"],
  adminClient = null,
} = {}) {
  const admin = adminClient || createSupabaseAdmin();
  if (!admin) throw new Error("Server not configured");

  // Match TIMESTAMP WITHOUT TIME ZONE
  const nowNaive = new Date().toISOString().slice(0, 19).replace("T", " ");

  // 1) delete expired
  let q1 = admin.from(TABLE).delete();
  q1 = q1
    .in("status", statuses)
    .is(COL.convertedBookingId, null)
    .lte(COL.expiresAt, nowNaive);
  if (scheduleSlotId != null) q1 = q1.eq(COL.scheduleSlotId, scheduleSlotId);
  const { data: delExpired, error: err1 } = await q1.select("id");
  if (err1) throw err1;

  // 2) delete null-expiry
  let delNull = [];
  if (includeNullExpires) {
    let q2 = admin.from(TABLE).delete();
    q2 = q2
      .in("status", statuses)
      .is(COL.convertedBookingId, null)
      .is(COL.expiresAt, null);
    if (scheduleSlotId != null) q2 = q2.eq(COL.scheduleSlotId, scheduleSlotId);
    const { data: d2, error: err2 } = await q2.select("id");
    if (err2) throw err2;
    delNull = d2 || [];
  }

  return {
    deletedExpired: delExpired?.length || 0,
    deletedNull: delNull.length,
    totalDeleted: (delExpired?.length || 0) + delNull.length,
    deletedIds: [...(delExpired || []), ...delNull].map((r) => r.id),
  };
}
