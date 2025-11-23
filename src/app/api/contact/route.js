import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

const CONTACT_TYPE_LABELS = {
  planning: "Planning an experience",
  support: "Support / existing booking",
  info: "More information",
};

const BRAND_COLOR = "#8b6f47";

/**
 * Wraps inner content in a simple, Oasis-styled HTML layout.
 */
function oasisEmailLayout({ preheader, title, intro, content, footer }) {
  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>${title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style="margin:0;padding:0;background-color:#f4f1ec;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        <!-- Preheader (hidden in most clients, but used for preview) -->
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
          ${preheader || ""}
        </div>

        <table width="100%" border="0" cellPadding="0" cellSpacing="0" style="margin:0;padding:32px 0;">
          <tr>
            <td align="center">
              <table width="100%" border="0" cellPadding="0" cellSpacing="0" style="max-width:640px;margin:0 16px;background-color:transparent;">
                <!-- Brand header -->
                <tr>
                  <td style="padding:0 0 16px 0;text-align:left;">
                    <span style="
                      display:inline-block;
                      padding:6px 12px;
                      font-size:11px;
                      letter-spacing:0.22em;
                      text-transform:uppercase;
                      color:${BRAND_COLOR};
                      border-radius:999px;
                      border:1px solid #d3c2aa;
                      background-color:#fbf7ef;
                    ">
                      Oasis • Crete
                    </span>
                  </td>
                </tr>

                <!-- Card -->
                <tr>
                  <td>
                    <table width="100%" border="0" cellPadding="0" cellSpacing="0" style="
                      background-color:#ffffff;
                      border-radius:20px;
                      border:1px solid #e0d6c6;
                      box-shadow:0 14px 40px rgba(0,0,0,0.06);
                    ">
                      <tr>
                        <td style="padding:24px 24px 18px 24px;">
                          <h1 style="margin:0 0 6px 0;font-size:22px;line-height:1.3;color:#3e3128;font-family:Georgia,'Times New Roman',serif;">
                            ${title}
                          </h1>
                          ${
                            intro
                              ? `<p style="margin:0;font-size:14px;line-height:1.6;color:#5a4a3f;">${intro}</p>`
                              : ""
                          }
                        </td>
                      </tr>

                      <tr>
                        <td style="padding:6px 24px 20px 24px;">
                          ${content}
                        </td>
                      </tr>

                      ${
                        footer
                          ? `
                      <tr>
                        <td style="padding:16px 24px 22px 24px;border-top:1px solid #f0e5d7;">
                          <p style="margin:0;font-size:12px;line-height:1.6;color:#8b7a6b;">
                            ${footer}
                          </p>
                        </td>
                      </tr>`
                          : ""
                      }
                    </table>
                  </td>
                </tr>

                <!-- Small footer -->
                <tr>
                  <td style="padding:16px 4px 0 4px;text-align:center;">
                    <p style="margin:0;font-size:11px;color:#9a8b7b;line-height:1.6;">
                      You&apos;re receiving this email because someone used the contact form on the Oasis website.
                    </p>
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

export async function POST(req) {
  try {
    const body = await req.json();

    const {
      name,
      email,
      message,
      contactType = "planning",
      idealDates,
      groupSize,
      bookingRef,
    } = body || {};

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error("Missing EMAIL_USER or EMAIL_PASS in environment");
      return NextResponse.json(
        { error: "Email configuration error" },
        { status: 500 }
      );
    }

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || "smtp.gmail.com",
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: Number(process.env.EMAIL_PORT) === 465,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const typeLabel =
      CONTACT_TYPE_LABELS[contactType] || "New contact from website";

    /* -------------------- Email content blocks (HTML) -------------------- */

    const detailsTableForTeam = `
      <table width="100%" border="0" cellPadding="0" cellSpacing="0" style="font-size:14px;color:#4d3d33;">
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f2e7d9;">
            <strong style="display:inline-block;width:130px;color:#7a6a5f;">Name</strong>
            <span>${name}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f2e7d9;">
            <strong style="display:inline-block;width:130px;color:#7a6a5f;">Email</strong>
            <span>${email}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f2e7d9;">
            <strong style="display:inline-block;width:130px;color:#7a6a5f;">Contact type</strong>
            <span>${typeLabel}</span>
          </td>
        </tr>
        ${
          idealDates
            ? `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f2e7d9;">
            <strong style="display:inline-block;width:130px;color:#7a6a5f;">Ideal dates</strong>
            <span>${idealDates}</span>
          </td>
        </tr>`
            : ""
        }
        ${
          groupSize
            ? `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f2e7d9;">
            <strong style="display:inline-block;width:130px;color:#7a6a5f;">Guests</strong>
            <span>${groupSize}</span>
          </td>
        </tr>`
            : ""
        }
        ${
          bookingRef
            ? `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f2e7d9;">
            <strong style="display:inline-block;width:130px;color:#7a6a5f;">Booking ref</strong>
            <span>${bookingRef}</span>
          </td>
        </tr>`
            : ""
        }
        <tr>
          <td style="padding:12px 0 4px 0;">
            <strong style="display:block;margin-bottom:6px;color:#7a6a5f;">Message</strong>
            <div style="padding:12px 14px;border-radius:12px;background:#fbf7ef;border:1px solid #efe2cf;white-space:pre-wrap;">
              ${message}
            </div>
          </td>
        </tr>
      </table>
    `;

    const detailsTableForGuest = `
      <table width="100%" border="0" cellPadding="0" cellSpacing="0" style="font-size:14px;color:#4d3d33;">
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f2e7d9;">
            <strong style="display:inline-block;width:130px;color:#7a6a5f;">Contact type</strong>
            <span>${typeLabel}</span>
          </td>
        </tr>
        ${
          idealDates
            ? `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f2e7d9;">
            <strong style="display:inline-block;width:130px;color:#7a6a5f;">Ideal dates</strong>
            <span>${idealDates}</span>
          </td>
        </tr>`
            : ""
        }
        ${
          groupSize
            ? `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f2e7d9;">
            <strong style="display:inline-block;width:130px;color:#7a6a5f;">Guests</strong>
            <span>${groupSize}</span>
          </td>
        </tr>`
            : ""
        }
        ${
          bookingRef
            ? `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f2e7d9;">
            <strong style="display:inline-block;width:130px;color:#7a6a5f;">Booking ref</strong>
            <span>${bookingRef}</span>
          </td>
        </tr>`
            : ""
        }
        <tr>
          <td style="padding:12px 0 4px 0;">
            <strong style="display:block;margin-bottom:6px;color:#7a6a5f;">Your message</strong>
            <div style="padding:12px 14px;border-radius:12px;background:#fbf7ef;border:1px solid #efe2cf;white-space:pre-wrap;">
              ${message}
            </div>
          </td>
        </tr>
      </table>
    `;

    /* ------------------------- Email to Oasis team ------------------------ */

    const oasisHtml = oasisEmailLayout({
      preheader: "New contact from the Oasis website.",
      title: "New contact from the Oasis website",
      intro:
        "Someone just reached out through the contact form. Here are the details so you can follow up with care:",
      content: detailsTableForTeam,
      footer:
        "If you reply, remember to hit “Reply all” if others on the team should stay in the loop.",
    });

    await transporter.sendMail({
      from: `"Oasis Website" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      replyTo: email,
      subject: `[Oasis contact] ${typeLabel} – ${name}`,
      text: `
New contact message from the Oasis website.

Name: ${name}
Email: ${email}
Contact type: ${typeLabel}
${idealDates ? `Ideal dates / timeframe: ${idealDates}\n` : ""}${
        groupSize ? `Number of guests: ${groupSize}\n` : ""
      }${bookingRef ? `Booking reference: ${bookingRef}\n` : ""}

Message:
${message}
      `.trim(),
      html: oasisHtml,
    });

    /* ---------------------- Confirmation to the sender -------------------- */

    const confirmationHtml = oasisEmailLayout({
      preheader:
        "We’ve received your message – the Oasis team will reply soon.",
      title: "We’ve received your message",
      intro: `Hi ${name || ""},<br /><br />
        Thank you for reaching out to Oasis. We&apos;ve received your message and a member of our team will get back to you as soon as possible (usually within one working day).<br /><br />
        Here&apos;s a copy of what you sent us:`,
      content: detailsTableForGuest,
      footer:
        "If you didn’t intend to contact us, you can safely ignore this email.",
    });

    await transporter.sendMail({
      from: `"Oasis" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "We’ve received your message – Oasis",
      text: `
Hi ${name || ""},

Thank you for reaching out to Oasis. We’ve received your message and a member of our team will get back to you as soon as possible (usually within one working day).

Contact type: ${typeLabel}
${idealDates ? `Ideal dates / timeframe: ${idealDates}\n` : ""}${
        groupSize ? `Number of guests: ${groupSize}\n` : ""
      }${bookingRef ? `Booking reference: ${bookingRef}\n` : ""}

Your message:
${message}

Warmly,
The Oasis team
      `.trim(),
      html: confirmationHtml,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error in /api/contact:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
