// src/lib/email/sendGiftcardEmail.js
import { sendEmail } from "./mailer";

export async function sendGiftcardEmail({ to, card }) {
  const appName = process.env.APP_NAME || "Oasis";
  const siteUrl = process.env.APP_URL || "https://youroasis.gr";
  const logoUrl = process.env.APP_LOGO_URL || ""; // optional
  const support =
    process.env.APP_SUPPORT_EMAIL ||
    process.env.EMAIL_FROM ||
    "hello@youroasis.gr";

  const subject = `${appName} • Your gift card ${card.code}`;
  const preheader = card.recipientName
    ? `A gift for ${card.recipientName} — code ${card.code}`
    : `Your gift card — code ${card.code}`;

  const html = renderGiftcardHtml({
    appName,
    siteUrl,
    logoUrl,
    support,
    card,
    preheader,
  });
  const text = renderGiftcardText({ appName, siteUrl, support, card });

  return sendEmail({
    to,
    subject,
    html,
    text,
    from: process.env.EMAIL_FROM, // optional override
  });
}

/* ------------------------------ Template ------------------------------ */

function money(cents, currency = "EUR") {
  const n = (Number(cents) || 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

function renderGiftcardHtml({
  appName,
  siteUrl,
  logoUrl,
  support,
  card,
  preheader,
}) {
  const initial = money(card.initialAmountCents, card.currency);
  const remaining = money(card.remainingAmountCents, card.currency);
  const exp = card.expiresAt
    ? new Date(card.expiresAt).toLocaleDateString()
    : "No expiry";

  // Brand colors (align with your admin palette)
  const brand = "#8b6f47"; // primary
  const brandTxt = "#ffffff";
  const bg = "#f6f3ee"; // page background
  const paper = "#ffffff"; // panels
  const ink = "#2b2a28"; // main text
  const muted = "#6f6a63"; // muted text
  const border = "#e7e1d7";

  const statusChip = chip(card.status, brand, muted);

  return `
  <!doctype html>
  <html>
  <head>
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <title>${escapeHtml(appName)} Gift Card</title>
    <style>
      /* Some clients respect this; inline styles do the heavy lifting */
      @media (prefers-color-scheme: dark) {
        .paper { background:#111111 !important; color:#f5f5f5 !important; }
        .page  { background:#0c0c0c !important; }
        .muted { color:#b8b8b8 !important; }
        .border{ border-color:#333333 !important; }
        .btn   { background:${brand} !important; color:${brandTxt} !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:${bg};">
    <!-- Preheader (hidden preview text) -->
    <div style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">
      ${escapeHtml(preheader)}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
    </div>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="page" style="background:${bg};">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;">
            <!-- Header -->
            <tr>
              <td align="center" style="padding: 8px 8px 16px 8px;">
                ${
                  logoUrl
                    ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(
                        appName
                      )}" width="120" style="display:block;border:0;outline:none;text-decoration:none;height:auto;margin:0 auto 4px auto;" />`
                    : `<div style="font:600 20px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:${ink};">${escapeHtml(
                        appName
                      )}</div>`
                }
                <div class="muted" style="color:${muted}; font:14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">Digital Gift Card</div>
              </td>
            </tr>

            <!-- Gift Card panel -->
            <tr>
              <td class="paper border" style="background:${paper}; border:1px solid ${border}; border-radius:16px; padding:0; overflow:hidden;">
                <!-- Ribbon -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, ${brand} 0%, #c2a57a 100%);">
                  <tr>
                    <td style="padding:16px 20px;">
                      <div style="color:${brandTxt}; font:600 18px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
                        🎁 Your Gift from ${escapeHtml(appName)}
                      </div>
                      <div style="color:${brandTxt}; opacity:0.9; font:13px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
                        Redeem on our website at checkout
                      </div>
                    </td>
                  </tr>
                </table>

                <!-- Body -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:20px;">
                      <div style="color:${ink}; font:15px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
                        Hello${
                          card.recipientName
                            ? " " + escapeHtml(card.recipientName)
                            : ""
                        },
                        <br/>Here are your gift card details:
                      </div>

                      <!-- Code badge -->
                      <div style="margin:14px 0 8px 0;">
                        <div style="display:inline-block; font:700 18px ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:1.5px; color:${ink};
                                    background:#faf7f2; border:1px dashed ${border}; border-radius:10px; padding:10px 14px;">
                          ${escapeHtml(card.code)}
                        </div>
                      </div>

                      <!-- Details grid (2 columns) -->
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
                        <tr>
                          <td width="50%" style="padding:8px 0; color:${muted}; font:12px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">Initial value</td>
                          <td width="50%" align="right" style="padding:8px 0; color:${ink}; font:600 14px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">${initial}</td>
                        </tr>
                        <tr>
                          <td width="50%" style="padding:8px 0; color:${muted}; font:12px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">Remaining</td>
                          <td width="50%" align="right" style="padding:8px 0; color:${ink}; font:600 14px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">${remaining}</td>
                        </tr>
                        <tr>
                          <td width="50%" style="padding:8px 0; color:${muted}; font:12px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">Expires</td>
                          <td width="50%" align="right" style="padding:8px 0; color:${ink}; font:600 14px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">${escapeHtml(
    exp
  )}</td>
                        </tr>
                        <tr>
                          <td width="50%" style="padding:8px 0; color:${muted}; font:12px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">Status</td>
                          <td width="50%" align="right" style="padding:8px 0;">
                            ${statusChip}
                          </td>
                        </tr>
                      </table>

                      ${
                        card.message
                          ? `<div style="margin-top:14px; padding:12px; background:#fbfaf7; border:1px solid ${border}; border-radius:10px; color:${ink}; font:14px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
                               <em>${escapeHtml(card.message)}</em>
                             </div>`
                          : ""
                      }

             
                      <div style="margin:18px 0 6px 0;">
                        <a href="${siteUrl}"
                           class="btn"
                           style="display:inline-block; background:${brand}; color:${brandTxt}; text-decoration:none; font:600 14px system-ui,-apple-system,Segoe UI,Roboto,sans-serif; padding:10px 14px; border-radius:10px;">
                           Explore Experiences
                        </a>
                      </div>

                      <div class="muted" style="color:${muted}; font:12px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; margin-top:6px;">
                        Redeem by entering the code above during checkout at <a href="${siteUrl}" style="color:${muted}; text-decoration:underline;">${siteUrl.replace(
    /^https?:\/\//,
    ""
  )}
</a>.
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td align="center" style="padding:16px 8px 8px 8px;">
                <div class="muted" style="color:${muted}; font:12px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
                  Need help? <a href="mailto:${escapeHtml(
                    support
                  )}" style="color:${muted}; text-decoration:underline;">${escapeHtml(
    support
  )}</a>
                </div>
                <div class="muted" style="color:${muted}; font:11px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; margin-top:4px;">
                  © ${new Date().getFullYear()} ${escapeHtml(
    appName
  )} · All rights reserved
                </div>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
}

function renderGiftcardText({ appName, siteUrl, support, card }) {
  const initial = money(card.initialAmountCents, card.currency);
  const remaining = money(card.remainingAmountCents, card.currency);
  const exp = card.expiresAt
    ? new Date(card.expiresAt).toLocaleDateString()
    : "No expiry";

  return [
    `${appName} — Digital Gift Card`,
    "",
    `Code: ${card.code}`,
    `Initial value: ${initial}`,
    `Remaining: ${remaining}`,
    `Expires: ${exp}`,
    `Status: ${card.status}`,
    card.message ? `\nMessage: ${card.message}\n` : "",
    `Redeem during checkout on ${siteUrl}`,
    `Support: ${support}`,
  ].join("\n");
}

/* ------------------------------ Helpers ------------------------------ */

function chip(status, brand, muted) {
  const base =
    "display:inline-block;padding:4px 8px;border-radius:999px;font:600 12px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;";
  if (!status)
    return `<span style="${base};background:#eee;color:${muted}">unknown</span>`;
  const s = String(status).toLowerCase();
  if (s === "active")
    return `<span style="${base};background:#e8f6ee;color:#0a7c3a;border:1px solid #bfe8cf">active</span>`;
  if (s === "redeemed")
    return `<span style="${base};background:#eef3ff;color:#2b5fd9;border:1px solid #cdd9ff">redeemed</span>`;
  if (s === "void")
    return `<span style="${base};background:#fff1f1;color:#d23030;border:1px solid #ffd6d6">void</span>`;
  return `<span style="${base};background:#eee;color:${muted}">${escapeHtml(
    s
  )}</span>`;
}

function escapeHtml(s = "") {
  return String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );
}
