// src/lib/email/passwordResetEmail.js
export function generatePasswordResetEmail({ name, email, resetUrl }) {
  const safeName = name || email || "Explorer";

  return {
    subject: "Reset your Oasis password",
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#2f2f2f;background:#f7f5f1;padding:32px;">
        <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #ece6dc;border-radius:16px;overflow:hidden">
          <div style="padding:20px 24px;border-bottom:1px solid #f0ebe2;background:#faf7f1">
            <h1 style="margin:0;font-size:20px;color:#5a4a3f;">Oasis</h1>
          </div>
          <div style="padding:28px 24px;">
            <p style="margin:0 0 12px;">Hi <strong>${safeName}</strong>,</p>
            <p style="margin:0 0 16px;">
              We received a request to reset your password. Click the button below to choose a new one.
            </p>
            <p style="margin:0 0 20px;">
              <a href="${resetUrl}" style="display:inline-block;background:#8b6f47;color:#fff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:600;">
                Reset Password
              </a>
            </p>
            <p style="margin:0 0 8px;font-size:13px;color:#6b5e53;">
              This link expires in 60 minutes. If you didn’t request this, you can safely ignore this email.
            </p>
            <p style="margin:14px 0 0;font-size:12px;color:#8a8176;word-break:break-all">
              Link: <a href="${resetUrl}">${resetUrl}</a>
            </p>
          </div>
        </div>
        <p style="text-align:center;margin-top:14px;font-size:12px;color:#8a8176">
          © ${new Date().getFullYear()} Oasis
        </p>
      </div>
    `,
  };
}
