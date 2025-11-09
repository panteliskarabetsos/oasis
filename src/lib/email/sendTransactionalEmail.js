export async function sendTransactionalEmail({
  to,
  subject,
  html,
  attachments = [],
}) {
  // TODO: wire to your email provider
  // This stub avoids crashes in dev by logging
  console.log(
    "[sendTransactionalEmail] To:",
    to,
    "Subject:",
    subject,
    "Attachments:",
    attachments?.length
  );
  return { ok: true };
}
