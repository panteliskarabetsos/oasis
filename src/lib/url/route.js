// src/lib/url/origin.js
export function computeOrigin(req) {
  let envUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    ""
  ).trim();
  if (envUrl) {
    if (!/^https?:\/\//i.test(envUrl)) envUrl = `https://${envUrl}`;
    const u = new URL(envUrl);
    return `${u.protocol}//${u.host}`.replace(/\/$/, "");
  }
  const u = new URL(req.url);
  return `${u.protocol}//${u.host}`.replace(/\/$/, "");
}
