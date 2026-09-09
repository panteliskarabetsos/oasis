// src/lib/email/sendShopOrderEmail.js
// Every email the e-shop sends about an order. One module so the wording and
// the look stay consistent, and so the call sites stay one line long.
import "server-only";
import { getTransporter } from "./mailer";

const EMAIL_FROM = process.env.EMAIL_FROM || process.env.EMAIL_USER;
const REPLY_TO = process.env.EMAIL_REPLY_TO || EMAIL_FROM;
const APP_NAME = process.env.APP_NAME || "Oasis";
const SITE_URL = (
  process.env.APP_ORIGIN ||
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://www.youroasis.gr"
).replace(/\/+$/, "");
const SUPPORT = process.env.APP_SUPPORT_EMAIL || "info@youroasis.gr";
const LOGO = process.env.APP_LOGO_URL || "";

/** The kinds of message an order can produce. */
export const SHOP_EMAIL_KINDS = [
  "paid",
  "shipped",
  "cancelled",
  "refunded",
  "staff_new_order",
];

/* --------------------------------- brand --------------------------------- */

const C = {
  bg: "#f4f1ec",
  panel: "#ffffff",
  text: "#2a211a",
  subtext: "#7a6a5f",
  border: "#eae6e0",
  primary: "#8b6f47",
  gold: "#b89a6b",
  danger: "#a33c22",
};

function escapeHtml(s = "") {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

function money(cents, currency = "EUR") {
  const v = (Number(cents) || 0) / 100;
  try {
    return new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(v);
  } catch {
    return `${v.toFixed(2)} ${currency}`;
  }
}

export function orderRef(id) {
  return `OS-${String(Number(id) || 0).padStart(6, "0")}`;
}

function addressBlock(a) {
  if (!a || typeof a !== "object") return "";
  const lines = [
    a.name,
    a.line1,
    a.line2,
    [a.postalCode, a.city].filter(Boolean).join(" "),
    a.country,
  ].filter(Boolean);
  return lines.map((l) => escapeHtml(l)).join("<br/>");
}

function button(href, label) {
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td ` +
    `style="background:${C.primary};border-radius:2px"><a href="${escapeHtml(href)}" ` +
    `style="display:inline-block;padding:13px 26px;color:#ffffff;font-family:Helvetica,Arial,sans-serif;` +
    `font-size:12px;letter-spacing:2px;text-transform:uppercase;text-decoration:none">${escapeHtml(
      label
    )}</a></td></tr></table>`
  );
}

function itemsTable(items = [], currency) {
  if (!items.length) return "";
  const rows = items
    .map(
      (l) =>
        `<tr><td style="padding:10px 0;border-bottom:1px solid ${C.border};font-size:14px;color:${C.text}">` +
        `${escapeHtml(l.title_snapshot)}<br/><span style="font-size:12px;color:${C.subtext}">` +
        `${Number(l.quantity)} × ${money(l.unit_price_cents, currency)}</span></td>` +
        `<td align="right" style="padding:10px 0;border-bottom:1px solid ${C.border};font-size:14px;color:${C.text};white-space:nowrap">` +
        `${money(Number(l.unit_price_cents) * Number(l.quantity), currency)}</td></tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`;
}

function totalRow(label, value, strong = false) {
  return (
    `<tr><td style="padding:6px 0;font-size:${strong ? 15 : 13}px;color:${
      strong ? C.text : C.subtext
    };${strong ? "font-weight:bold" : ""}">${escapeHtml(label)}</td>` +
    `<td align="right" style="padding:6px 0;font-size:${strong ? 15 : 13}px;color:${
      strong ? C.text : C.subtext
    };${strong ? "font-weight:bold" : ""};white-space:nowrap">${escapeHtml(value)}</td></tr>`
  );
}

function shell({ preheader, eyebrow, heading, body }) {
  return `<!doctype html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:${C.bg}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader || "")}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:32px 16px">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="max-width:560px;background:${C.panel};border:1px solid ${C.border};border-radius:4px">
    <tr><td style="padding:32px 32px 0">
      ${
        LOGO
          ? `<img src="${escapeHtml(LOGO)}" alt="${escapeHtml(APP_NAME)}" height="28" style="display:block;margin-bottom:24px"/>`
          : `<div style="font-family:Georgia,serif;font-size:20px;color:${C.text};margin-bottom:24px">${escapeHtml(APP_NAME)}</div>`
      }
      <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${C.gold}">${escapeHtml(eyebrow)}</div>
      <h1 style="margin:8px 0 0;font-family:Georgia,serif;font-size:25px;line-height:1.25;font-weight:normal;color:${C.text}">${escapeHtml(heading)}</h1>
    </td></tr>
    <tr><td style="padding:20px 32px 32px;font-family:Helvetica,Arial,sans-serif;color:${C.text}">${body}</td></tr>
    <tr><td style="padding:0 32px 28px;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:${C.subtext};border-top:1px solid ${C.border}">
      <p style="margin:16px 0 0">Questions? Reply to this email or write to
        <a href="mailto:${escapeHtml(SUPPORT)}" style="color:${C.primary}">${escapeHtml(SUPPORT)}</a>.</p>
      <p style="margin:8px 0 0">${escapeHtml(APP_NAME)} · Chania, Crete</p>
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

/* -------------------------------- templates ------------------------------- */

function render({ kind, order, items, extra = {} }) {
  const currency = order.currency || "EUR";
  const ref = orderRef(order.id);
  const name = order.billing_address?.name || "there";
  const first = String(name).split(" ")[0];
  const refunded = Number(extra.refundedCents || order.refunded_cents || 0);
  const total = Number(order.total_cents || 0);

  const summary =
    `${itemsTable(items, currency)}` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px">` +
    (refunded > 0 ? totalRow("Refunded", `−${money(refunded, currency)}`) : "") +
    totalRow("Total", money(total, currency), true) +
    `</table>`;

  const delivery = order.shipping_address?.line1
    ? `<p style="margin:24px 0 6px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${C.gold}">Delivering to</p>
       <p style="margin:0;font-size:14px;line-height:1.6;color:${C.text}">${addressBlock(order.shipping_address)}</p>`
    : "";

  switch (kind) {
    case "paid":
      return {
        subject: `Your Oasis order ${ref}`,
        preheader: `We have your order — ${money(total, currency)}.`,
        html: shell({
          preheader: `We have your order — ${money(total, currency)}.`,
          eyebrow: ref,
          heading: "Thank you — your order is confirmed",
          body:
            `<p style="margin:0 0 20px;font-size:15px;line-height:1.6">Dear ${escapeHtml(first)}, we have your order and are packing it by hand in Chania. You will hear from us again the moment it leaves us.</p>` +
            summary +
            delivery,
        }),
        text:
          `Thank you — your order ${ref} is confirmed.\n\n` +
          items.map((l) => `${l.quantity} x ${l.title_snapshot} — ${money(l.unit_price_cents * l.quantity, currency)}`).join("\n") +
          `\n\nTotal: ${money(total, currency)}\n\nWe pack by hand in Chania and will write again when it ships.\n${SUPPORT}`,
      };

    case "shipped": {
      const tracking = extra.trackingNumber || order.tracking_number || "";
      const trackUrl = extra.trackingUrl || order.tracking_url || "";
      return {
        subject: `Your Oasis order ${ref} is on its way`,
        preheader: "It has left Chania.",
        html: shell({
          preheader: "It has left Chania.",
          eyebrow: ref,
          heading: "Your order is on its way",
          body:
            `<p style="margin:0 0 20px;font-size:15px;line-height:1.6">Dear ${escapeHtml(first)}, your order has left us.</p>` +
            (tracking
              ? `<p style="margin:0 0 4px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${C.gold}">Tracking</p>
                 <p style="margin:0;font-family:monospace;font-size:15px;color:${C.text}">${escapeHtml(tracking)}</p>`
              : "") +
            (trackUrl ? button(trackUrl, "Track your parcel") : "") +
            summary +
            delivery,
        }),
        text:
          `Your order ${ref} is on its way.\n` +
          (tracking ? `Tracking: ${tracking}\n` : "") +
          (trackUrl ? `${trackUrl}\n` : ""),
      };
    }

    case "cancelled":
      return {
        subject: `Your Oasis order ${ref} has been cancelled`,
        preheader: "Nothing further will be charged.",
        html: shell({
          preheader: "Nothing further will be charged.",
          eyebrow: ref,
          heading: "Your order has been cancelled",
          body:
            `<p style="margin:0 0 20px;font-size:15px;line-height:1.6">Dear ${escapeHtml(first)}, we have cancelled this order${
              refunded > 0 ? " and returned the payment" : ""
            }. If this is a surprise, please write to us — we would rather put it right.</p>` +
            summary,
        }),
        text: `Your order ${ref} has been cancelled.${refunded > 0 ? " The payment has been returned." : ""}`,
      };

    case "refunded": {
      const amount = Number(extra.amountCents || 0);
      const full = refunded >= total;
      return {
        subject: `A refund for your Oasis order ${ref}`,
        preheader: `${money(amount, currency)} is on its way back to you.`,
        html: shell({
          preheader: `${money(amount, currency)} is on its way back to you.`,
          eyebrow: ref,
          heading: full ? "Your order has been refunded" : "A partial refund is on its way",
          body:
            `<p style="margin:0 0 20px;font-size:15px;line-height:1.6">Dear ${escapeHtml(first)}, we have returned <strong>${escapeHtml(
              money(amount, currency)
            )}</strong> to the card you paid with. Banks usually take five to ten days to show it.</p>` +
            summary,
        }),
        text: `We have refunded ${money(amount, currency)} for order ${ref}. Banks usually take 5–10 days to show it.`,
      };
    }

    case "staff_new_order": {
      const adminUrl = `${SITE_URL}/admin/eshop/order/${order.id}`;
      return {
        subject: `New shop order ${ref} — ${money(total, currency)}`,
        preheader: `${order.billing_address?.name || "Guest"} · ${money(total, currency)}`,
        html: shell({
          preheader: `${order.billing_address?.name || "Guest"} · ${money(total, currency)}`,
          eyebrow: "New order",
          heading: `${ref} — ${money(total, currency)}`,
          body:
            `<p style="margin:0 0 16px;font-size:15px;line-height:1.6">` +
            `${escapeHtml(order.billing_address?.name || "Guest")}` +
            (order.billing_address?.email
              ? ` &lt;${escapeHtml(order.billing_address.email)}&gt;`
              : "") +
            (order.billing_address?.phone ? ` · ${escapeHtml(order.billing_address.phone)}` : "") +
            `</p>` +
            summary +
            delivery +
            button(adminUrl, "Open the order"),
        }),
        text: `New shop order ${ref} — ${money(total, currency)}\n${adminUrl}`,
      };
    }

    default:
      return null;
  }
}

/**
 * Send one order email. Never throws: a failed send must not roll back the
 * refund or status change that triggered it.
 * @returns {Promise<{sent:boolean, error?:string, subject?:string}>}
 */
export default async function sendShopOrderEmail({ kind, order, items = [], to, extra }) {
  try {
    if (!SHOP_EMAIL_KINDS.includes(kind)) return { sent: false, error: `unknown kind ${kind}` };
    if (!order) return { sent: false, error: "no order" };
    const recipient = String(to || order.billing_address?.email || "").trim();
    if (!recipient) return { sent: false, error: "no recipient" };

    const message = render({ kind, order, items, extra });
    if (!message) return { sent: false, error: "no template" };

    await getTransporter().sendMail({
      from: EMAIL_FROM,
      to: recipient,
      replyTo: REPLY_TO,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    return { sent: true, subject: message.subject };
  } catch (e) {
    console.error("[shop email]", kind, e?.message || e);
    return { sent: false, error: String(e?.message || e) };
  }
}

export { render as renderShopOrderEmail };
