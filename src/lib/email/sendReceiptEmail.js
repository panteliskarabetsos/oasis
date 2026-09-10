import "server-only";

import generateReceiptEmailHtml from "@/lib/email/ReceiptEmail";
import { sendEmail } from "@/lib/email/mailer";
import buildReceiptPdfBuffer from "@/lib/pdf/buildReceipt";
import { storeIdentity } from "@/lib/storeIdentity";

/** Human-facing receipt number: the row id, zero-padded. */
export function receiptNumber(receipt) {
  return String(receipt?.id ?? "0").padStart(6, "0");
}

function isEmail(value) {
  return /.+@.+\..+/.test(String(value || "").trim());
}

/**
 * Email a customer their receipt with the PDF attached.
 *
 * Never throws. It is called straight after a completed sale, and money that
 * is already banked must not be undone by a mail server having a bad day —
 * the same rule the shop automations follow.
 *
 * @returns {Promise<{sent:boolean, to?:string, reason:string, messageId?:string, error?:string}>}
 */
export default async function sendReceiptEmail({ receipt, to } = {}) {
  if (!receipt) return { sent: false, reason: "no-receipt" };

  const recipient = String(to || receipt.customerEmail || "").trim();
  if (!recipient) return { sent: false, reason: "no-email" };
  if (!isEmail(recipient)) return { sent: false, to: recipient, reason: "invalid-email" };

  try {
    const store = storeIdentity();
    const number = receiptNumber(receipt);
    const html = generateReceiptEmailHtml(receipt);
    const pdf = await buildReceiptPdfBuffer({ receipt, store });

    const info = await sendEmail({
      to: recipient,
      subject: `Your ${store.name} receipt #${number}`,
      html,
      attachments: [
        {
          filename: `receipt-${number}.pdf`,
          content: pdf,
          contentType: "application/pdf",
        },
      ],
    });

    return { sent: true, to: recipient, reason: "sent", messageId: info.messageId };
  } catch (e) {
    console.error("[receipt email]", receipt?.id, e?.message || e);
    return {
      sent: false,
      to: recipient,
      reason: "send-failed",
      error: String(e?.message || e),
    };
  }
}

/**
 * Record that a receipt was emailed.
 *
 * The `receiptEmailedAt` column only exists once
 * dump_sql/20260910_receipt_email_log.sql has been run; until then this is a
 * no-op rather than an error, so the send itself never depends on the
 * migration.
 */
export async function markReceiptEmailed(admin, receiptId, at = new Date()) {
  if (!admin || !receiptId) return false;
  try {
    const { error } = await admin
      .from("Receipt")
      .update({ receiptEmailedAt: at.toISOString() })
      .eq("id", receiptId);
    if (error) {
      // 42703 undefined_column / PGRST204 unknown column in schema cache.
      if (error.code === "42703" || error.code === "PGRST204") return false;
      throw error;
    }
    return true;
  } catch (e) {
    console.error("[receipt email] could not stamp receipt", receiptId, e?.message || e);
    return false;
  }
}
