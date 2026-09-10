import "server-only";

/**
 * What a POS basket costs, priced on the server.
 *
 * Lifted verbatim out of /api/pos/payments/intent so that every Stripe rail —
 * the card sheet and the QR payment link — charges from one calculation. Two
 * copies of this would eventually disagree, and the customer would be charged
 * one number while the receipt showed another.
 */

const toCents = (n) => Math.round(Number(n || 0) * 100);

/**
 * @param {object} supa  service-role Supabase client
 * @param {object} body  the POS checkout payload
 * @returns {Promise<{ok:true, quote:object, cleanItems:object[], adults:number, kids:number}
 *                  | {ok:false, error:string, status:number}>}
 */
export async function quotePosSale(supa, body) {
  const {
    experienceId,
    startTime,
    counts,
    items = [],
    manualDiscount = 0,
    promoCode,
    giftCode,
    currency = "eur",
  } = body || {};

  /* -------- Experience (optional) -------- */
  const adults = Number(counts?.adults || 0);
  const kids = Number(counts?.kids || 0);

  let unitAdult = 0,
    unitKid = 0;
  if (experienceId) {
    const { data: e, error: ee } = await supa
      .from("Experience")
      .select("id,priceAdult,priceKid")
      .eq("id", experienceId)
      .single();
    if (ee || !e) return { ok: false, error: "Experience not found", status: 404 };
    if (adults + kids <= 0) return { ok: false, error: "No attendees", status: 400 };
    if (!startTime) return { ok: false, error: "Missing startTime", status: 400 };

    unitAdult = Number(e.priceAdult || 0);
    unitKid = Number(e.priceKid || 0);
  }

  const expSubtotalCents = toCents(unitAdult) * adults + toCents(unitKid) * kids;

  /* -------------- Items --------------- */
  // (For full trust, fetch prices server-side by id.)
  const cleanItems = (items || [])
    .filter((it) => Number(it.quantity) > 0)
    .map((it) => ({
      id: it.id ?? null,
      name: String(it.name || "").slice(0, 120),
      sku: it.sku ? String(it.sku).slice(0, 80) : null,
      unitPriceCents: toCents(it.unitPrice),
      quantity: Number(it.quantity || 0),
    }));

  const itemsSubtotalCents = cleanItems.reduce(
    (s, it) => s + it.unitPriceCents * it.quantity,
    0,
  );

  const grossCents = expSubtotalCents + itemsSubtotalCents;

  /* -------------- Promo --------------- */
  let promoDeductionCents = 0;
  if (promoCode) {
    const { data: pc } = await supa
      .from("DiscountCode")
      .select("*")
      .ilike("code", String(promoCode).trim())
      .maybeSingle();

    if (pc && pc.active) {
      const now = new Date();
      const within =
        (!pc.startsAt || new Date(pc.startsAt) <= now) &&
        (!pc.endsAt || new Date(pc.endsAt) >= now);
      const scopeOk =
        pc.scope === "global" ||
        (experienceId &&
          Array.isArray(pc.experienceIds) &&
          pc.experienceIds.includes(experienceId));
      const notMaxed =
        pc.maxRedemptions == null ||
        Number(pc.redemptionCount || 0) < Number(pc.maxRedemptions || 0);

      if (within && scopeOk && notMaxed) {
        const t = pc.discountType;
        const v = Number(pc.discountValue || 0);
        promoDeductionCents =
          t === "percent"
            ? Math.round((grossCents * v) / 100)
            : Math.min(grossCents, toCents(v));
      }
    }
  }

  /* -------------- Gift --------------- */
  let giftDeductionCents = 0;
  if (giftCode) {
    const { data: gc } = await supa
      .from("GiftCard")
      .select("*")
      .ilike("code", String(giftCode).trim())
      .maybeSingle();

    if (gc && gc.status === "active" && Number(gc.remaining_amount_cents) > 0) {
      const baseAfterPromoCents = Math.max(0, grossCents - promoDeductionCents);
      giftDeductionCents = Math.min(
        baseAfterPromoCents,
        Number(gc.remaining_amount_cents),
      );
    }
  }

  const manualCents = Math.max(0, toCents(manualDiscount));
  const netCents = Math.max(
    0,
    grossCents - promoDeductionCents - giftDeductionCents - manualCents,
  );

  const stripeCurrency = (currency || "eur").toLowerCase();

  return {
    ok: true,
    adults,
    kids,
    cleanItems,
    quote: {
      gross: grossCents / 100,
      net: netCents / 100,
      promoDeduction: promoDeductionCents / 100,
      giftDeduction: giftDeductionCents / 100,
      manual: manualCents / 100,
      amountCents: netCents,
      currency: stripeCurrency,
      grossCents,
      promoDeductionCents,
      giftDeductionCents,
      manualCents,
      netCents,
    },
  };
}

export { toCents };
