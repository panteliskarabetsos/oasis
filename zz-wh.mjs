import fs from "node:fs";
for (const l of fs.readFileSync(".env.local","utf8").split("\n")) {
  if (!l.includes("=")||l.trim().startsWith("#")) continue;
  const i=l.indexOf("="); process.env[l.slice(0,i).trim()] ??= l.slice(i+1).trim().replace(/^["']|["']$/g,"");
}
const Stripe = (await import("stripe")).default;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const acct = await stripe.accounts.retrieve();
console.log("account :", acct.id, "|", acct.settings?.dashboard?.display_name || acct.business_profile?.name || "(unnamed)");
console.log("mode    :", process.env.STRIPE_SECRET_KEY.startsWith("sk_live") ? "LIVE" : "TEST");
const eps = await stripe.webhookEndpoints.list({ limit: 20 });
console.log("existing endpoints on this key:", eps.data.length);
for (const e of eps.data) console.log(`  ${e.status}  ${e.url}\n    events: ${e.enabled_events.join(", ")}`);
