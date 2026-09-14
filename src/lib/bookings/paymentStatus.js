// One definition of "has this booking been paid for", and one of "how much is
// still owed". Both answers are needed in several places — the ticket PDF, the
// wallet passes, the guest portal, the check-in desk — and the moment two of
// them disagree, a guest is either handed a ticket they should not have or
// refused one they should.

/**
 * Statuses that mean the money is in.
 *
 * `checked_in` is included because a guest already admitted has, by
 * definition, cleared the desk; re-issuing their ticket must keep working.
 */
export const PAID_STATUSES = Object.freeze(["confirmed", "paid", "checked_in"]);

export function isPaidStatus(status) {
  return PAID_STATUSES.includes(String(status || "").toLowerCase());
}

/**
 * What the booking costs, what has been taken, and what is left.
 *
 * This mirrors the payment link exactly — including the meeting-point
 * surcharge — so the figure shown to staff at the door is the figure the guest
 * would be charged if a link were sent instead. A separate formula here would
 * quietly drift from the one that actually moves money.
 */
export function bookingBalance(booking) {
  const adults = Number(booking?.adultsCount ?? 1);
  const kids = Number(booking?.kidsCount ?? 0);
  const priceA = Number(booking?.unitPriceAdult ?? 0);
  const priceK = Number(booking?.unitPriceKid ?? 0);
  const discount = Number(booking?.discountAmount ?? 0);
  const paid = Number(booking?.totalPaidAmount ?? 0);

  const meetup = booking?.selected_meetup_point || null;
  const surcharge = Math.max(0, Number(meetup?.surcharge) || 0);

  const total = adults * priceA + kids * priceK + surcharge - discount;
  const due = Math.max(0, total - paid);

  return {
    total,
    paid,
    due,
    // Stored inconsistently across rows ("EUR" and "eur" both occur), so it is
    // normalised once here rather than at every display site.
    currency: String(booking?.currency || "EUR").toUpperCase(),
  };
}

/** The columns bookingBalance() reads, for callers that select explicitly. */
export const BALANCE_COLUMNS = Object.freeze([
  "adultsCount",
  "kidsCount",
  "unitPriceAdult",
  "unitPriceKid",
  "discountAmount",
  "totalPaidAmount",
  "currency",
  "selected_meetup_point",
]);
