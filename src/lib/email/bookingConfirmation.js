import "server-only";

/**
 * The "booking confirmed" email.
 *
 * Lifted out of the Stripe webhook so the confirmation can also be sent the
 * moment the guest lands back on the success page — a webhook that is slow,
 * misconfigured or retried should not decide whether someone gets their
 * confirmation. Both callers go through sendConfirmationEmail(), which claims
 * the booking before sending so exactly one of them does.
 */

function brandName() {
  return process.env.NEXT_PUBLIC_SITE_NAME || "Oasis";
}

function formatInv(id) {
  return `INV-${String(id).padStart(6, "0")}`;
}

async function fetchPdfBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`PDF fetch failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function sendMail({ to, subject, html, attachments }) {
  const apiKey = process.env.RESEND_API_KEY;
  let from = process.env.EMAIL_FROM;
  if (!from) from = "Oasis Bookings <onboarding@resend.dev>"; // dev fallback
  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  const res = await resend.emails.send({
    from,
    to,
    subject,
    html,
    attachments: attachments?.length ? attachments : undefined,
  });
  if (res?.error) throw new Error(res.error.message || "Mail provider error");
}

function renderConfirmationEmail(booking, { receiptUrl }) {
  const inv = formatInv(booking.id);
  const amt = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: (booking.currency || "EUR").toUpperCase(),
  }).format(Number(booking.totalPaidAmount || 0));
  const email = booking.primary_contact?.email || "";
  const name =
    booking.primary_contact?.fullName || booking.primary_contact?.name || email;
  return `
  <div style="font-family: ui-sans-serif, system-ui; color:#1f2937;">
    <h2 style="margin:0 0 6px;">${brandName()} — Booking confirmed</h2>
   <p style="margin: 8px 0 16px;">Thanks for your payment, ${name}.</p>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <tbody>
       <tr>
         <td style="padding:10px;border-bottom:1px solid #e5e7eb;background:#fafaf9;width:180px;">Invoice #</td>
         <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${inv}</td>
       </tr>
       <tr>
         <td style="padding:10px;border-bottom:1px solid #e5e7eb;background:#fafaf9;">Amount</td>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;"><strong>${amt}</strong></td>
        </tr>
      </tbody>
    </table>
    ${
      receiptUrl
        ? `<div style="margin-top:16px;">
             <a href="${receiptUrl}"
               style="display:inline-block;background:#1f2937;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">
               View Stripe Receipt
             </a>
            <div style="font-size:12px;color:#6b7280;margin-top:8px;">
               Opens Stripe’s official receipt page.
             </div>
           </div>`
        : ""
    }
    <p style="font-size:12px;color:#6b7280;margin-top:14px;">
      We’ve attached your invoice PDF.
   </p>
  </div>`;
}

async function receiptUrlFromPI(stripe, piOrId) {
  const pi =
    typeof piOrId === "string"
      ? await stripe.paymentIntents.retrieve(piOrId, {
          expand: ["latest_charge"],
        })
      : piOrId;
  if (!pi) return null;
  if (pi.latest_charge) {
    const ch =
      typeof pi.latest_charge === "string"
        ? await stripe.charges.retrieve(pi.latest_charge)
        : pi.latest_charge;
    if (ch?.receipt_url) return ch.receipt_url;
  }
  const first = pi?.charges?.data?.[0];
  return first?.receipt_url || null;
}

// Send confirmation email with invoice PDF (if any) + hosted receipt link
async function sendConfirmationEmail({
  stripe,
  admin,
  bookingId,
  sessionId,
  piId,
  invoiceId,
}) {
  // 1) Load booking (email + amounts)
  // `code` is the random reference the customer quotes back to us; without it
  // the email falls back to "BK-" plus the row id, which is guessable.
  let { data: b } = await admin
    .from("booking")
    .select("id, code, primary_contact, totalPaidAmount, currency")
    .eq("id", bookingId)
    .single();
  if (!b) {
    ({ data: b } = await admin
      .from("booking")
      .select("id, primary_contact, totalPaidAmount, currency")
      .eq("id", bookingId)
      .single());
  }
  if (!b?.primary_contact?.email) return;
  const to = b.primary_contact.email;

  // 2) Resolve sources
  let session = null,
    invoice = null,
    pi = null;
  let receiptUrl = null,
    invoicePdfUrl = null;

  if (sessionId) {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["invoice", "payment_intent.latest_charge"],
    });
    if (session?.invoice) {
      invoice =
        typeof session.invoice === "string"
          ? await stripe.invoices.retrieve(session.invoice)
          : session.invoice;
      invoicePdfUrl = invoice?.invoice_pdf || null;
    }
    if (session?.payment_intent) {
      pi = session.payment_intent;
    }
  }

  if (!invoice && invoiceId) {
    invoice = await stripe.invoices.retrieve(invoiceId);
    invoicePdfUrl = invoice?.invoice_pdf || invoicePdfUrl;
  }

  if (!pi && piId) {
    pi = await stripe.paymentIntents.retrieve(piId, {
      expand: ["latest_charge"],
    });
  }

  // 3) Hosted receipt URL (from charge)
  receiptUrl = await receiptUrlFromPI(stripe, pi || piId);
  // 4) Attach invoice PDF if available
  const attachments = [];

  if (invoicePdfUrl) {
    const pdfBuffer = await fetchPdfBuffer(invoicePdfUrl);
    attachments.push({
      filename: invoice?.number
        ? `${invoice.number}.pdf`
        : `${formatInv(b.id)}.pdf`,
      content: pdfBuffer,
      contentType: "application/pdf",
    });
  }

  const html = renderConfirmationEmail(b, { receiptUrl });
  await sendMail({
    to,
    subject: `Booking confirmed · ${brandName()}`,
    html,
    attachments,
  });

  // 5) Mark sent (best-effort)
  try {
    await admin
      .from("booking")
      .update({ confirmationEmailSentAt: new Date().toISOString() })
      .eq("id", b.id);
  } catch {}
}

/**
 * Confirm a paid booking and email the guest, once.
 *
 * The claim is a conditional write on `confirmationEmailSentAt`: whoever sets
 * it from null wins and sends, and any other caller — the webhook and the
 * success page routinely race — finds it already set and does nothing.
 *
 * @returns {Promise<{sent:boolean, reason:string}>}
 */
export async function confirmPaidBooking(
  admin,
  bookingId,
  { stripe, sessionId = null, piId = null, amountPaid = null } = {},
) {
  if (!admin || !bookingId) return { sent: false, reason: "bad-request" };

  try {
    // Land the booking's own state first; this is safe to repeat.
    const patch = {
      status: "confirmed",
      updatedAt: new Date().toISOString(),
    };
    if (Number.isFinite(Number(amountPaid))) {
      patch.totalPaidAmount = Number(amountPaid);
    }
    if (sessionId) patch.stripeSessionId = sessionId;
    if (piId) patch.stripePaymentIntentId = piId;
    // Paid: the seats are theirs and the link has done its job.
    patch.stripeSessionUrl = null;

    const { error: stateErr } = await admin
      .from("booking")
      .update(patch)
      .eq("id", bookingId);
    if (stateErr) throw stateErr;

    // Best-effort: the hold column only exists once its migration has run.
    try {
      await admin
        .from("booking")
        .update({ holdExpiresAt: null })
        .eq("id", bookingId);
    } catch {
      /* no hold column on this deployment */
    }

    // Claim the email.
    const { data: claimed, error: claimErr } = await admin
      .from("booking")
      .update({ confirmationEmailSentAt: new Date().toISOString() })
      .eq("id", bookingId)
      .is("confirmationEmailSentAt", null)
      .select("id");

    if (claimErr) {
      // Without the column we cannot dedupe; the webhook already sent one, so
      // staying quiet is better than sending a second.
      if (claimErr.code === "42703" || claimErr.code === "PGRST204") {
        return { sent: false, reason: "no-dedupe-column" };
      }
      throw claimErr;
    }
    if (!claimed?.length) return { sent: false, reason: "already-sent" };

    await sendConfirmationEmail({ stripe, admin, bookingId, sessionId, piId });
    return { sent: true, reason: "sent" };
  } catch (e) {
    console.error("[booking confirm]", bookingId, e?.message || e);
    // Let a later attempt try again rather than leaving it marked as sent.
    try {
      await admin
        .from("booking")
        .update({ confirmationEmailSentAt: null })
        .eq("id", bookingId);
    } catch {}
    return { sent: false, reason: "error" };
  }
}

export { sendConfirmationEmail };
