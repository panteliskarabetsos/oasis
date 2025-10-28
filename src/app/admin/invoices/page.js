export const dynamic = "force-dynamic";
export const revalidate = 0;
import React from "react";
import "server-only";
import { format } from "date-fns";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, PlusIcon } from "lucide-react";

/**
 * Admin → Invoices (SSR, no TypeScript)
 * - Lists paid bookings as invoices with filtering (date range, status, search) & pagination
 * - No client-side JS required; the filters use a GET form that round-trips the page
 * - Uses Supabase Admin on the server
 *
 * UI/UX upgrades (2025-10 UI Refresh):
 * - Density toggle (Compact / Cozy / Spacious) without client JS
 * - Active filter chips with one-click clear for each
 * - Quick date presets show which preset is active
 * - Accessible pagination (aria-current) and better focus styles
 * - Consistent design tokens via CSS variables (surface/border/ink/brand)
 * - Table cell paddings powered by CSS vars set from density
 * - Minor a11y improvements (aria-labels, roles)
 */

function Row({ className = "", children }) {
  const kids = [];
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child)) kids.push(child); // drop whitespace/text nodes
  });
  return <tr className={className}>{kids}</tr>;
}
// ======================== SERVER ACTION: SEND INVOICE ========================

async function sendMail({ to, subject, html, attachments }) {
  const apiKey = process.env.RESEND_API_KEY;

  let from = process.env.EMAIL_FROM;
  if (!from) {
    if (process.env.NODE_ENV !== "production") {
      from = "Oasis Bookings <onboarding@resend.dev>";
    } else {
      throw new Error("EMAIL_FROM is not set. Use a verified domain address.");
    }
  }

  if (
    /@(gmail|googlemail|outlook|hotmail|live|yahoo|icloud)\.com\s*>?$/.test(
      from
    )
  ) {
    throw new Error(
      `EMAIL_FROM cannot be a mailbox-provider domain (${from}). ` +
        `Use onboarding@resend.dev in dev or a verified domain in production.`
    );
  }

  if (!apiKey) {
    console.log("[DEV] sendMail dry-run (missing RESEND_API_KEY):", {
      to,
      subject,
    });
    return;
  }

  console.log("[sendMail] using FROM:", from);

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  const res = await resend.emails.send({
    from,
    to,
    subject,
    html,
    attachments: attachments && attachments.length ? attachments : undefined, // 👈
  });

  if (res && res.error)
    throw new Error(res.error.message || "Mail provider error");
}

function brandName() {
  return process.env.NEXT_PUBLIC_SITE_NAME || "Oasis";
}

function renderInvoiceEmail(b) {
  const inv = formatInv(b.id);
  const customer = nameFromPrimary(b.primary_contact);
  const email = emailFromPrimary(b.primary_contact);
  const amt = fmtMoney(b.totalPaidAmount, b.currency);
  const created = fmtDatePlain(b.createdAt);
  const start = fmtDateTimePlain(b.startTime);
  const guests = b.numberOfPeople || 1;
  return `
  <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color:#1f2937;">
    <h2 style="margin:0 0 6px;">${brandName()} — Invoice ${inv}</h2>
    <div style="font-size:12px;color:#6b7280;margin-bottom:12px;">Created ${created}</div>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <tbody>
        <tr>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;background:#fafaf9;width:180px;">Customer</td>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(
            customer
          )}<br/><span style="color:#6b7280;font-size:12px;">${escapeHtml(
    email
  )}</span></td>
        </tr>
        <tr>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;background:#fafaf9;">Start</td>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(
            start
          )}</td>
        </tr>
        <tr>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;background:#fafaf9;">Guests</td>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${guests}</td>
        </tr>
        <tr>
          <td style="padding:10px;background:#fafaf9;">Amount</td>
          <td style="padding:10px;"><strong>${escapeHtml(amt)}</strong></td>
        </tr>
      </tbody>
    </table>
    <p style="font-size:12px;color:#6b7280;margin-top:12px;">Status: ${escapeHtml(
      b.status || "paid"
    )} • Invoice #: ${inv}</p>
    <p style="font-size:12px;color:#6b7280;">Thank you for your business!</p>
  </div>`;
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export default async function InvoicesPage({ searchParams }) {
  const admin = createSupabaseAdmin();
  if (!admin) return renderError("Server not configured (Supabase admin)");

  // ---------- read filters from URL ----------
  const sp = await searchParams;
  const get = (k) => (typeof sp?.get === "function" ? sp.get(k) : sp?.[k]);
  const q = (get("q") || "").toString().trim();
  const status = (get("status") || "paid").toString();
  const from = (get("from") || "").toString(); // ISO date or yyyy-mm-dd
  const to = (get("to") || "").toString(); // ISO date or yyyy-mm-dd
  const page = Math.max(1, Number(get("p") || 1));
  const perPage = clamp(Number(get("per") || 25), 5, 200);
  const density = (get("density") || "cozy").toString(); // NEW: compact|cozy|spacious
  const source = (get("source") || "bookings").toString(); // "stripe" | "bookings"
  const sent = (get("sent") || "").toString();
  const err = (get("err") || "").toString();
  const updated = (get("updated") || "").toString();
  const edit = (get("edit") || "").toString();

  // ---------- build base query ----------
  // ---------- fetch rows (stripe OR bookings) ----------
  let rows = [];
  let total = null;

  if (source === "stripe") {
    const stripe = await getStripe();
    const toUnix = (iso) => (iso ? Math.floor(new Date(iso).getTime() / 1000) : undefined);
    const createdGte = from ? toUnix(normalizeDateStart(from)) : undefined;
    const createdLte = to ? toUnix(normalizeDateEnd(to)) : undefined;

    // Prefer the Search API for better filtering + total_count
    const terms = [];
    if (status && status !== "all") terms.push(`status:"${status}"`); // open|paid|draft|void|uncollectible
   if (createdGte) terms.push(`created>=${createdGte}`);
    if (createdLte) terms.push(`created<=${createdLte}`);
    if (q) terms.push(`(number~"${q}" OR id:"${q}" OR customer_email~"${q}")`);
    const query = terms.length ? terms.join(" AND ") : 'status:"paid"';

    const resp = await stripe.invoices.search({
      query,
      limit: perPage,
      // NOTE: for real paging, add page token (you can store in URL as pageToken)
      expand: ["data.customer", "data.payment_intent"],
    });
    rows = resp.data.map(mapStripeInvoiceToRow);
    total = resp.total_count ?? null;
  } else {
    // ----- existing Supabase path (unchanged logic) -----
    const baseSelect =
      "id, createdAt, startTime, status, numberOfPeople, totalPaidAmount, currency, primary_contact, stripePaymentIntentId, stripeSessionId, invoiceEmailSentAt";
    let listQ = admin
      .from("Booking")
      .select(baseSelect)
      .order("createdAt", { ascending: false });
    let countQ = admin.from("Booking").select("id", { count: "exact", head: true });

    if (status && status !== "all") {
      listQ = listQ.eq("status", status);
      countQ = countQ.eq("status", status);
    }
    if (from) {
      const fromIso = normalizeDateStart(from);
      if (fromIso) {
        listQ = listQ.gte("createdAt", fromIso);
        countQ = countQ.gte("createdAt", fromIso);
      }
    }
    if (to) {
      const toIso = normalizeDateEnd(to);
      if (toIso) {
        listQ = listQ.lte("createdAt", toIso);
        countQ = countQ.lte("createdAt", toIso);
      }
    }
    if (q) {
      const like = `%${q}%`;
      const ors = [
        `stripePaymentIntentId.ilike.${like}`,
        `stripeSessionId.ilike.${like}`,
        `primary_contact->>email.ilike.${like}`,
        `primary_contact->>fullName.ilike.${like}`,
        `primary_contact->>firstName.ilike.${like}`,
        `primary_contact->>lastName.ilike.${like}`,
      ];
      const asNum = Number(q);
      if (Number.isFinite(asNum)) ors.push(`id.eq.${asNum}`);
      listQ = listQ.or(ors.join(","));
      countQ = countQ.or(ors.join(","));
    }
    const fromIdx = (page - 1) * perPage;
    const toIdx = fromIdx + perPage - 1;
    listQ = listQ.range(fromIdx, toIdx);

   const [{ data, error: listErr }, { count, error: countErr }] = await Promise.all([listQ, countQ]);
    if (listErr) return renderError(listErr.message || "Failed to load invoices");
    rows = data || [];
    total = countErr ? null : Number(count || 0);
  }
  const pageTotal = (rows || []).reduce(
    (s, r) => s + (Number(r?.totalPaidAmount || 0) || 0),
    0
  );
  const guestsTotal = (rows || []).reduce(
    (s, r) => s + (Number(r?.numberOfPeople || 1) || 1),
    0
  );
  const avgInvoice = rows?.length ? pageTotal / rows.length : 0;

  const initial = { q, status, from, to, perPage, page, density,source };

  // modal edit support via query param (?edit=<id>)
  const editId = Number(edit) || null;
  const showEdit = Number.isFinite(editId) && editId > 0;
  const editRow = showEdit
    ? (rows || []).find((r) => Number(r.id) === editId) || null
    : null;

  // density → padding vars
  const tdPy =
    density === "compact"
      ? "0.5rem"
      : density === "spacious"
      ? "0.875rem"
      : "0.75rem"; // 2 / 3.5 / 3
  const thPy =
    density === "compact"
      ? "0.375rem"
      : density === "spacious"
      ? "0.75rem"
      : "0.5rem"; // 1.5 / 3 / 2

  // ---------- render ----------
  return (
    <div
      className=" relative mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 isolate before:absolute before:inset-0 before:-z-10 before:bg-[radial-gradient(1200px_600px_at_50%_-50%,rgba(139,111,71,0.06),transparent_60%)] after:absolute after:inset-x-0 after:top-0 after:-z-10 after:h-24 after:bg-[linear-gradient(to_bottom,rgba(252,251,248,0.85),transparent)]"
      style={{
        // design tokens
        ["--surface"]: "#ffffff",
        ["--surface-veil"]: "#fcfbf8",
        ["--border"]: "#e8e5df",
        ["--ink"]: "#3f382f",
        ["--muted-ink"]: "#7a6a58",
        ["--brand"]: "#8b6f47",
        // paddings for table / headers
        ["--td-py"]: tdPy,
        ["--th-py"]: thPy,
      }}
    >
      <h1 className="sr-only">Invoices</h1>
      <Header />

      {/* notices (supports ?sent= & ?updated=) */}
      <div aria-live="polite" aria-atomic="true">
        <AlertBar sent={sent} err={err} updated={updated} />
      </div>

      {/* Filters card – clearer structure, subtle glassy surface */}
      <section
        aria-label="Filters"
        className="rounded-2xl border border-[var(--border)] bg-white/70 backdrop-blur supports-[backdrop-filter]:backdrop-blur p-4 shadow-[0_1px_0_rgba(0,0,0,0.04)] md:p-5"
      >
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
          <FiltersBar initial={initial} />
          <div className="md:pl-3">
            <QuickRanges initial={initial} />
          </div>
        </div>
        <div className="mt-3">
          <FilterChips initial={initial} />
        </div>
      </section>

      {/* KPIs */}
      <div className="mt-5">
        <StatsBar
          count={rows?.length || 0}
          pageTotal={pageTotal}
          avgInvoice={avgInvoice}
          guestsTotal={guestsTotal}
          currency={guessCurrency(rows)}
          totalAll={total}
          page={page}
          perPage={perPage}
        />
      </div>

      {!rows || rows.length === 0 ? (
        <EmptyState initial={initial} />
      ) : (
        <>
          {/* Mobile cards – compact icon actions */}
          <ul
            role="list"
            aria-label="Invoices list"
            className="mt-6 space-y-3 md:hidden"
          >
            {rows.map((r) => {
              const canSend = Boolean(emailFromPrimary(r.primary_contact));
              const sentAt = r.invoiceEmailSentAt;
              return (
                <li
                  key={r.id}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[0_1px_0_rgba(0,0,0,0.03)] transition-colors hover:bg-[#faf7f2]/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[var(--ink)] tracking-wide tabular-nums">
                        {formatInv(r.id)}
                      </div>
                      <div className="mt-1 text-xs text-[var(--muted-ink)]">
                        {fmtDate(r.createdAt)}
                      </div>
                    </div>
                    <StatusPill status={r.status} />
                  </div>

                  <div className="mt-3 text-sm text-[var(--ink)]">
                    {nameFromPrimary(r.primary_contact)}
                  </div>
                  <div className="text-xs text-[var(--muted-ink)] break-all">
                    {emailFromPrimary(r.primary_contact)}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-[var(--ink)] tabular-nums">
                        {fmtMoney(r.totalPaidAmount, r.currency)}
                      </div>
                      <div className="text-[11px] text-[var(--muted-ink)]">
                        {r.numberOfPeople || 1} guest(s)
                      </div>
                      <div className="mt-1 text-[11px]">
                        {sentAt ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-800">
                            ✓ Sent · {fmtDateTime(sentAt)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-neutral-700">
                            Not sent
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Edit (icon style) → open modal */}
                      <a
                        href={qsFromInitial(initial, { edit: r.id })}
                        title="Edit"
                        aria-label="Edit"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--ink)] shadow-sm transition hover:bg-[#fcfbf8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-white"
                      >
                        <Pencil />
                        <span className="sr-only">Edit</span>
                      </a>

                    <IconButton
   as="a"
   href={r.__stripe?.pdf || `/api/admin/invoices/${r.id}/download`}
  title="Download PDF"
   download
 >
                        <DownloadIcon />
                        <span className="sr-only">Download</span>
                      </IconButton>

                      <IconButton
                        as="a"
                        href={`/admin/reservations/${r.id}`}
                        title="View reservation"
                      >
                        <Eye />
                        <span className="sr-only">View</span>
                      </IconButton>

                     {r.kind === "stripe" ? (
   <form action="/api/admin/stripe-invoices/send" method="POST">
     <input type="hidden" name="invoice_id" value={r.__stripe?.id} />
    <IconButton
       as="button"
      type="submit"
       disabled={!canSend}
       title={canSend ? "Send from Stripe" : "No customer email"}
     >
       <SendIcon /><span className="sr-only">Send</span>
     </IconButton>
   </form>
 ) : (
   <form action="/api/admin/invoices/send" method="POST">
     <input type="hidden" name="id" value={r.id} />
     <input type="hidden" name="mode" value="custom" />
     <IconButton
       as="button"
       type="submit"
       disabled={!canSend}
       title={canSend ? "Send invoice" : "No customer email"}
     >
       <SendIcon /><span className="sr-only">Send</span>
    </IconButton>
   </form>
 )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Desktop table – sticky first & last columns, compact icon action bar */}
          <div className="mt-6 hidden md:block">
            <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_1px_0_rgba(0,0,0,0.04)]">
              <div className="relative max-h-[70vh] overflow-auto [scrollbar-gutter:stable_both-edges]">
                <table className="min-w-full table-fixed text-sm">
                  <thead className="sticky top-0 z-10 bg-[#fcfbf8]/95 backdrop-blur supports-[backdrop-filter]:backdrop-blur text-[var(--muted-ink)] shadow-[0_1px_0_#efeae1]">
                    <Row>
                      <Th className="w-[160px] sticky left-0 z-20 bg-[#fcfbf8]/95 backdrop-blur supports-[backdrop-filter]:backdrop-blur shadow-[1px_0_#efeae1]">
                        #
                      </Th>
                      <Th>Created</Th>
                      <Th>Start</Th>
                      <Th>Customer</Th>
                      <Th className="text-right">Amount</Th>
                      <Th>Status</Th>
                      <Th>Stripe PI</Th>
                      <Th>Email</Th>
                      <Th className="text-right sticky right-0 z-20 pr-4 bg-[#fcfbf8]/95 backdrop-blur supports-[backdrop-filter]:backdrop-blur shadow-[-1px_0_#efeae1] w-[168px]">
                        Actions
                      </Th>
                    </Row>
                  </thead>
                  <tbody className="divide-y divide-[#efeae1]">
                    {rows.map((r) => {
                      const canSend = Boolean(
                        emailFromPrimary(r.primary_contact)
                      );
                      const sentAt = r.invoiceEmailSentAt;
                      return (
                        <tr
                          key={r.id}
                          className="group odd:bg-white even:bg-[#fcfbf8]/40 hover:bg-[#faf7f2]/70 transition-colors"
                        >
                          <Td className="sticky left-0 z-10 bg-white group-hover:bg-[#faf7f2]/70 shadow-[1px_0_#efeae1]">
                            <div className="font-medium text-[var(--ink)] tracking-wide tabular-nums">
                              {formatInv(r.id)}
                            </div>
                            <div className="text-[11px] text-[var(--muted-ink)] truncate">
                              ID: {r.id}
                            </div>
                          </Td>
                          <Td className="whitespace-nowrap">
                            {fmtDate(r.createdAt)}
                          </Td>
                          <Td className="whitespace-nowrap">
                            {fmtDateTime(r.startTime)}
                          </Td>
                          <Td>
                            <div className="text-[var(--ink)]">
                              {nameFromPrimary(r.primary_contact)}
                            </div>
                            <div className="text-[11px] text-[var(--muted-ink)] truncate max-w-[240px]">
                              {emailFromPrimary(r.primary_contact)}
                            </div>
                          </Td>
                          <Td className="text-right">
                            <div className="font-semibold text-[var(--ink)] tabular-nums">
                              {fmtMoney(r.totalPaidAmount, r.currency)}
                            </div>
                            <div className="text-[11px] text-[var(--muted-ink)]">
                              {r.numberOfPeople || 1} guest(s)
                            </div>
                          </Td>
                          <Td>
                            <StatusPill status={r.status} />
                          </Td>
                          <Td className="whitespace-nowrap">
                            {r.stripePaymentIntentId ? (
                              <a
                                href={stripeDashboardUrl(
                                  r.stripePaymentIntentId
                                )}
                                target="_blank"
                                rel="noreferrer"
                                title="Open in Stripe"
                                className="text-[#6b5a48] underline decoration-dotted underline-offset-4 hover:text-[#8b6f47] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/30 rounded focus-visible:ring-offset-1 focus-visible:ring-offset-white"
                              >
                                {shorten(r.stripePaymentIntentId)}
                              </a>
                            ) : (
                              <span className="text-[var(--muted-ink)]">—</span>
                            )}
                          </Td>
                          <Td className="whitespace-nowrap">
                            {sentAt ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-800">
                                ✓ Sent · {fmtDateTime(sentAt)}
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] text-neutral-700">
                                Not sent
                              </span>
                            )}
                          </Td>
                          <Td className="text-right sticky right-0 z-10 pr-4 bg-white group-hover:bg-[#faf7f2]/70 shadow-[-1px_0_#efeae1]">
                            <div className="inline-flex items-center gap-2">
                              {/* Edit → open modal */}
                              <a
                                href={qsFromInitial(initial, { edit: r.id })}
                                title="Edit"
                                aria-label="Edit"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--ink)] shadow-sm transition hover:bg-[#fcfbf8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-white"
                              >
                                <Pencil />
                                <span className="sr-only">Edit</span>
                              </a>

                              {/* Download */}
                              <IconButton
                                as="a"
                                href={`/api/admin/invoices/${r.id}/download`}
                                title="Download PDF"
                                download
                              >
                                <DownloadIcon />
                                <span className="sr-only">Download</span>
                              </IconButton>

                              {/* Send */}
                         {r.kind === "stripe" ? (
  <form action="/api/admin/stripe-invoices/send" method="POST">
     <input type="hidden" name="invoice_id" value={r.__stripe?.id} />
    <IconButton
       as="button"
       type="submit"
       disabled={!canSend}
      title={canSend ? "Send from Stripe" : "No customer email"}
     >
       <SendIcon /><span className="sr-only">Send</span>
     </IconButton>
   </form>
 ) : (
   <form action="/api/admin/invoices/send" method="POST">
     <input type="hidden" name="id" value={r.id} />
     <input type="hidden" name="mode" value="custom" />
     <IconButton
       as="button"
       type="submit"
       disabled={!canSend}
       title={canSend ? "Send invoice" : "No customer email"}
     >
       <SendIcon /><span className="sr-only">Send</span>
     </IconButton>
   </form>
 )}
                            </div>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {showEdit ? <EditDialog row={editRow} initial={initial} /> : null}

      {/* Sticky footer pagination on long lists */}
      <div className="mt-6 md:sticky md:bottom-3 md:z-30">
        <div className="rounded-2xl border border-[var(--border)] bg-white/85 backdrop-blur supports-[backdrop-filter]:backdrop-blur shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
          <div className="p-3">
            <Pagination
              page={page}
              perPage={perPage}
              total={total}
              initial={initial}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

async function getStripe() {
  const Stripe = (await import("stripe")).default;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  return new Stripe(key, { apiVersion: "2024-06-20" });
}

// Map Stripe invoice → your row shape
function mapStripeInvoiceToRow(inv) {
  return {
     kind: "stripe",
    id: inv.number || inv.id, // shown as INV-000123 in your UI; keep raw here
    createdAt: new Date(inv.created * 1000).toISOString(),
    startTime: null,
    status: inv.status, // open/paid/draft/void/uncollectible
    numberOfPeople: 1,
    totalPaidAmount: inv.total / 100,
    currency: (inv.currency || "eur").toUpperCase(),
    primary_contact: {
      fullName: inv.customer?.name || "",
      email: inv.customer_email || inv.customer?.email || "",
    },
    stripePaymentIntentId:
      typeof inv.payment_intent === "object" ? inv.payment_intent?.id : inv.payment_intent || null,
    stripeSessionId: null,
    invoiceEmailSentAt: inv.status_transitions?.paid_at
      ? new Date(inv.status_transitions.paid_at * 1000).toISOString()
      : null,
    __stripe: {
      id: inv.id,
      hosted: inv.hosted_invoice_url,
      pdf: inv.invoice_pdf,
      number: inv.number,
    },
  };
}


/* ============================== UI bits ============================== */

function Header() {
  return (
    <div className=" mb-6 flex items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">
          Invoices
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-ink)]">
          Review and search customer invoices generated from paid bookings.
        </p>
      </div>

      <div className="shrink-0">
        <Link
          href="/admin"
          aria-label="Back to dashboard"
          className="inline-flex items-center gap-2 rounded-xl border border-[#e8e5df] bg-white px-3 py-2 text-sm text-[#5a4a3f] hover:bg-[#fcf9f4] shadow-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back to dashboard</span>
        </Link>
        <Link
          href="/admin/invoices/new"
          aria-label="+ Create Invoice"
          className="inline-flex items-center gap-2 rounded-xl border border-[#e8e5df] bg-[#8c7147] px-3 py-2 text-sm text-[#ffffff] hover:bg-[#d3aa68] shadow-sm"
        >
          <PlusIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Create Invoice</span>
        </Link>
      </div>
    </div>
  );
}

function AlertBar({ sent, err, updated }) {
  if (updated) {
    return (
      <div
        role="status"
        className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
      >
        Saved changes for{" "}
        <span className="font-semibold">Invoice {formatInv(updated)}</span>.
      </div>
    );
  }
  if (!sent && !err) return null;
  if (sent) {
    return (
      <div
        role="status"
        className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
      >
        Invoice <span className="font-semibold">{formatInv(sent)}</span> sent.
      </div>
    );
  }
  const messages = {
    bad_id: "Invalid booking id.",
    no_admin: "Server not configured (Supabase admin).",
    not_found: "Booking not found.",
    no_email: "This booking has no customer email.",
    send_fail: "Email provider error while sending invoice.",
    mail_restricted:
     "Email blocked by provider: verify your sending domain or use Stripe email.",
   not_sendable:
     "This Stripe invoice can’t be emailed in its current state (not open/send_invoice).",
 
  };
  return (
    <div
      role="alert"
      className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
    >
      {messages[err] || "Failed to process request."}
    </div>
  );
}

function FiltersBar({ initial }) {
  const {
    q,
    status,
    from,
    to,
    perPage,
    density,
    source: initialSource,
  } = initial || {};

  const source = initialSource || "bookings";
  const isStripe = source === "stripe";

  // Status options depend on data source
  const STATUS_BOOKINGS = [
    { value: "paid", label: "paid" },
    { value: "confirmed", label: "confirmed" },
    { value: "completed", label: "completed" },
    { value: "checked_in", label: "checked_in" },
    { value: "cancelled", label: "cancelled" },
    { value: "all", label: "All" },
  ];
  const STATUS_STRIPE = [
    { value: "paid", label: "paid" },
    { value: "open", label: "open" },
    { value: "draft", label: "draft" },
    { value: "void", label: "void" },
    { value: "uncollectible", label: "uncollectible" },
    { value: "all", label: "All" },
  ];
  const statusOptions = isStripe ? STATUS_STRIPE : STATUS_BOOKINGS;
  const safeStatus = statusOptions.some((o) => o.value === status)
    ? status
    : "paid";

  const hasActiveFilters = Boolean(q || from || to || (safeStatus && safeStatus !== "paid"));
  const activeCount = [q, from, to, safeStatus && safeStatus !== "paid"].filter(Boolean).length;

  const clearHref = qsFromInitial(initial, {
    q: "",
    from: "",
    to: "",
    status: "paid",
    source, // preserve current source on clear
    p: 1,
  });

  const searchPlaceholder = isStripe
    ? "Invoice #, Stripe ID, email…"
    : "Name, email, PI id, booking id…";

  return (
    <form
      method="GET"
      className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end"
      aria-labelledby="filters-legend"
    >
      {/* ensure we reset paging on Apply */}
      <input type="hidden" name="p" value="1" />

      {/* group: Search */}
      <fieldset className="md:col-span-4">
        <legend id="filters-legend" className="sr-only">
          Invoice filters
        </legend>
        <label className="block text-xs text-[var(--muted-ink)]" htmlFor="f-q">
          Search
        </label>
        <div className="relative mt-1">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
            {/* magnifier */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </span>
          <input
            id="f-q"
            type="search"
            name="q"
            defaultValue={q}
            placeholder={searchPlaceholder}
            enterKeyHint="search"
            className="w-full rounded-lg border border-[var(--border)] bg-white pl-9 pr-3 py-2 text-sm text-[var(--ink)] placeholder:text-[#b1a595] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/40"
          />
        </div>
      </fieldset>

      {/* group: Data source */}
      <fieldset className="md:col-span-2">
        <label className="block text-xs text-[var(--muted-ink)]" htmlFor="f-source">
          Data source
        </label>
        <div className="relative mt-1">
          <select
            id="f-source"
            name="source"
            defaultValue={source}
            className="w-full appearance-none rounded-lg border border-[var(--border)] bg-white px-3 py-2 pr-8 text-sm text-[var(--ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/40"
          >
            <option value="bookings">Bookings Invoices</option>
            <option value="stripe">Manual Invoices</option>
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
            {/* chevron */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </fieldset>

      {/* group: Status (options depend on source) */}
      <fieldset className="md:col-span-2">
        <label className="block text-xs text-[var(--muted-ink)]" htmlFor="f-status">
          Status
        </label>
        <div className="relative mt-1">
          <select
            id="f-status"
            name="status"
            defaultValue={safeStatus || "paid"}
            className="w-full appearance-none rounded-lg border border-[var(--border)] bg-white px-3 py-2 pr-8 text-sm text-[var(--ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/40"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
            {/* chevron */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </fieldset>

      {/* group: From */}
      <fieldset className="md:col-span-2">
        <label className="block text-xs text-[var(--muted-ink)]" htmlFor="f-from">
          From
        </label>
        <div className="relative mt-1">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
            {/* calendar */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M16 3v4M8 3v4M3 10h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </span>
          <input
            id="f-from"
            type="date"
            name="from"
            defaultValue={dateInput(from)}
            max={dateInput(to) || undefined}
            className="w-full rounded-lg border border-[var(--border)] bg-white pl-9 pr-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/40"
          />
        </div>
      </fieldset>

      {/* group: To */}
      <fieldset className="md:col-span-2">
        <label className="block text-xs text-[var(--muted-ink)]" htmlFor="f-to">
          To
        </label>
        <div className="relative mt-1">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
            {/* calendar */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M16 3v4M8 3v4M3 10h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </span>
          <input
            id="f-to"
            type="date"
            name="to"
            defaultValue={dateInput(to)}
            min={dateInput(from) || undefined}
            className="w-full rounded-lg border border-[var(--border)] bg-white pl-9 pr-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/40"
          />
        </div>
      </fieldset>

      {/* group: Per page */}
      <fieldset className="md:col-span-1">
        <label className="block text-xs text-[var(--muted-ink)]" htmlFor="f-per">
          Rows/page
        </label>
        <div className="relative mt-1">
          <select
            id="f-per"
            name="per"
            defaultValue={String(perPage || 25)}
            className="w-full appearance-none rounded-lg border border-[var(--border)] bg-white px-3 py-2 pr-8 text-sm text-[var(--ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/40"
          >
            <option>10</option>
            <option>25</option>
            <option>50</option>
            <option>100</option>
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </fieldset>

      {/* group: Density */}
      <fieldset className="md:col-span-3">
        <label className="block text-xs text-[var(--muted-ink)]" htmlFor="f-density">
          Density
        </label>
        <div className="mt-1 grid grid-cols-3 overflow-hidden rounded-lg border border-[var(--border)]">
          {["compact", "cozy", "spacious"].map((opt) => (
            <label key={opt} className="relative cursor-pointer select-none">
              <input
                type="radio"
                name="density"
                value={opt}
                id={opt === density ? "f-density" : undefined}
                defaultChecked={opt === density}
                className="peer sr-only"
              />
              <span className="block px-3 py-2 text-center text-sm text-[var(--ink)] transition peer-checked:bg-[var(--ink)] peer-checked:text-white">
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Actions */}
      <div
        role="toolbar"
        className="md:col-span-12 flex flex-col sm:flex-row items-stretch sm:items-end justify-end gap-2 flex-wrap"
      >
        {hasActiveFilters ? (
          <a
            href={clearHref}
            className="inline-flex items-center justify-center rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--ink)] shadow-sm transition hover:bg-[#fcfbf8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/40 shrink-0 whitespace-nowrap w-full sm:w-auto"
          >
            Clear
          </a>
        ) : null}
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--ink)] px-4 py-2 text-sm text-white shadow transition hover:bg-[#2f2922] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/40 shrink-0 whitespace-nowrap w-full sm:w-auto"
        >
          {/* search icon */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          Apply
        </button>
      </div>

      {/* Active counter (a11y) */}
      <div className="col-span-full text-[11px] text-[var(--muted-ink)]" aria-live="polite">
        {hasActiveFilters ? `Filters active: ${activeCount}` : null}
      </div>
    </form>
  );
}


function QuickRanges({ initial }) {
  const presets = buildPresets();
  const isActive = (p) =>
    dateInput(initial.from) === p.from && dateInput(initial.to) === p.to;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {presets.map((p) => {
        const active = isActive(p);
        return (
          <a
            key={p.key}
            href={qsFromInitial(initial, { from: p.from, to: p.to, p: 1 })}
            aria-pressed={active}
            className={
              "rounded-full border px-3 py-1.5 text-xs transition " +
              (active
                ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                : "border-[var(--border)] bg-white text-[var(--ink)] hover:bg-[#fcfbf8]")
            }
          >
            {p.label}
          </a>
        );
      })}
    </div>
  );
}

function FilterChips({ initial }) {
  const chips = [];
  if (initial.q)
    chips.push({
      key: "q",
      label: `Search: ${initial.q}`,
      clear: { q: "", p: 1 },
    });
  if (initial.status && initial.status !== "paid")
    chips.push({
      key: "status",
      label: `Status: ${initial.status}`,
      clear: { status: "paid", p: 1 },
    });
  if (initial.from)
    chips.push({
      key: "from",
      label: `From: ${initial.from}`,
      clear: { from: "", p: 1 },
    });
  if (initial.to)
    chips.push({
      key: "to",
      label: `To: ${initial.to}`,
      clear: { to: "", p: 1 },
    });
  if (!chips.length) return null;
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      aria-label="Active filters"
    >
      {chips.map((c) => (
        <a
          key={c.key}
          href={qsFromInitial(initial, c.clear)}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs text-[var(--ink)] hover:bg-[#fcfbf8]"
        >
          <span>{c.label}</span>
          <span aria-hidden>×</span>
          <span className="sr-only">(clear)</span>
        </a>
      ))}
    </div>
  );
}

function StatsBar({
  count,
  pageTotal,
  avgInvoice,
  guestsTotal,
  currency,
  totalAll,
  page,
  perPage,
}) {
  const last = totalAll ? Math.max(1, Math.ceil(totalAll / perPage)) : null;
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
      <StatCard label="Page Revenue" value={fmtMoney(pageTotal, currency)} />
      <StatCard label="Avg Invoice" value={fmtMoney(avgInvoice, currency)} />
      <StatCard label="Guests (page)" value={String(guestsTotal)} />
      <StatCard
        label="Results"
        value={
          typeof totalAll === "number"
            ? `${count} shown · ${totalAll} total${
                last ? ` · Page ${page}/${last}` : ""
              }`
            : `${count} shown`
        }
      />
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[0_1px_0_0_rgba(0,0,0,0.02)]">
      <div className="text-xs uppercase tracking-wide text-[var(--muted-ink)]">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-[var(--ink)] tabular-nums">
        {value}
      </div>
    </div>
  );
}

function EditDialog({ row, initial }) {
  if (!row) return null;
  const closeHref = qsFromInitial(initial, { edit: "" });
  const pc = row.primary_contact || {};
  const id = row && row.id;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
      {/* Backdrop that closes the dialog */}
      <a
        href={closeHref}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        aria-label="Close edit dialog"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-title"
        className="relative w-[min(720px,92vw)] max-h-[85vh] overflow-auto rounded-2xl border border-[var(--border)] bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)]  py-60 "></div>
        <div className="absolute inset-0 flex items-start justify-center p-4 md:p-6">
          <div className="relative w-full max-w-[640px] overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <h2 className="text-base font-semibold text-[var(--ink)]">
                Edit customer
              </h2>
              <a
                href={closeHref}
                className="rounded-md p-1 text-[var(--muted-ink)] hover:bg-[#fcfbf8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/30"
                aria-label="Close"
              >
                ×
              </a>
            </div>

            <div className="px-5 py-4">
              {id ? (
                <form
                  action="/api/admin/invoices/update"
                  method="POST"
                  className="space-y-3"
                >
                  <input type="hidden" name="id" value={id} />

                  <div className="grid grid-cols-2 gap-2 py-24">
                    <div>
                      <label className="block text-xs text-[var(--muted-ink)]">
                        Full name
                      </label>
                      <input
                        name="fullName"
                        defaultValue={nameFromPrimary(pc)}
                        className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--muted-ink)]">
                        Email
                      </label>
                      <input
                        name="email"
                        defaultValue={emailFromPrimary(pc)}
                        className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--muted-ink)]">
                        Phone
                      </label>
                      <input
                        name="phone"
                        defaultValue={pc?.phone || ""}
                        className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--muted-ink)]">
                        Business
                      </label>
                      <input
                        name="businessName"
                        defaultValue={pc?.businessName || ""}
                        className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--muted-ink)]">
                        Tax number
                      </label>
                      <input
                        name="taxNumber"
                        defaultValue={pc?.taxNumber || ""}
                        className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-xs text-[var(--muted-ink)]">
                        Address line 1
                      </label>
                      <input
                        name="addressLine1"
                        defaultValue={pc?.address?.line1 || ""}
                        className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-[var(--muted-ink)]">
                        Address line 2
                      </label>
                      <input
                        name="addressLine2"
                        defaultValue={pc?.address?.line2 || ""}
                        className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--muted-ink)]">
                        City
                      </label>
                      <input
                        name="city"
                        defaultValue={pc?.address?.city || ""}
                        className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--muted-ink)]">
                        Postal code
                      </label>
                      <input
                        name="postalCode"
                        defaultValue={pc?.address?.postalCode || ""}
                        className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--muted-ink)]">
                        Country
                      </label>
                      <input
                        name="country"
                        defaultValue={pc?.address?.country || "GR"}
                        className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-end gap-2">
                    <a
                      href={closeHref}
                      className="inline-flex items-center rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--ink)] hover:bg-[#fcfbf8]"
                    >
                      Cancel
                    </a>
                    <button
                      type="submit"
                      className="inline-flex items-center rounded-lg bg-[var(--ink)] px-3 py-1.5 text-xs text-white shadow hover:bg-[#2f2922]"
                    >
                      Save
                    </button>
                  </div>
                </form>
              ) : (
                <div className="text-sm text-[var(--muted-ink)]">
                  We couldn't find this invoice on the current page.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditDetails({ id, pc }) {
  return (
    <details className="relative inline-block">
      <summary className="inline-flex cursor-pointer select-none items-center rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--ink)] shadow-sm hover:bg-[#fcfbf8]">
        Edit
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-[380px] rounded-xl border border-[var(--border)] bg-white p-4 text-left shadow-lg">
        <form
          action="/api/admin/invoices/update"
          method="POST"
          className="space-y-3"
        >
          <input type="hidden" name="id" value={id} />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-[var(--muted-ink)]">
                Full name
              </label>
              <input
                name="fullName"
                defaultValue={nameFromPrimary(pc)}
                className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--muted-ink)]">
                Email
              </label>
              <input
                name="email"
                defaultValue={emailFromPrimary(pc)}
                className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--muted-ink)]">
                Phone
              </label>
              <input
                name="phone"
                defaultValue={pc?.phone || ""}
                className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--muted-ink)]">
                Business
              </label>
              <input
                name="businessName"
                defaultValue={pc?.businessName || ""}
                className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--muted-ink)]">
                Tax number
              </label>
              <input
                name="taxNumber"
                defaultValue={pc?.taxNumber || ""}
                className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs text-[var(--muted-ink)]">
                Address line 1
              </label>
              <input
                name="addressLine1"
                defaultValue={pc?.address?.line1 || ""}
                className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-[var(--muted-ink)]">
                Address line 2
              </label>
              <input
                name="addressLine2"
                defaultValue={pc?.address?.line2 || ""}
                className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--muted-ink)]">
                City
              </label>
              <input
                name="city"
                defaultValue={pc?.address?.city || ""}
                className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--muted-ink)]">
                Postal code
              </label>
              <input
                name="postalCode"
                defaultValue={pc?.address?.postalCode || ""}
                className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--muted-ink)]">
                Country
              </label>
              <input
                name="country"
                defaultValue={pc?.address?.country || "GR"}
                className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="submit"
              className="inline-flex items-center rounded-lg bg-[var(--ink)] px-3 py-1.5 text-xs text-white shadow hover:bg-[#2f2922]"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </details>
  );
}

function MobileList({ rows }) {
  return (
    <ul className="mt-4 space-y-3 md:hidden">
      {rows.map((r) => (
        <li
          key={r.id}
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-[var(--ink)]">
                {formatInv(r.id)}
              </div>
              <div className="mt-1 text-xs text-[var(--muted-ink)]">
                {fmtDate(r.createdAt)}
              </div>
            </div>
            <StatusPill status={r.status} />
          </div>
          <div className="mt-3 text-sm text-[var(--ink)]">
            {nameFromPrimary(r.primary_contact)}
          </div>
          <div className="text-xs text-[var(--muted-ink)]">
            {emailFromPrimary(r.primary_contact)}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-[var(--ink)]">
                {fmtMoney(r.totalPaidAmount, r.currency)}
              </div>
              <div className="text-[11px] text-[var(--muted-ink)]">
                {r.numberOfPeople || 1} guest(s)
              </div>
            </div>
            <a
              href={`/admin/reservations/${r.id}`}
              className="inline-flex items-center rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--ink)] hover:bg-[#fcfbf8]"
            >
              View
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ initial }) {
  const clearHref = qsFromInitial(initial, {
    q: "",
    from: "",
    to: "",
    status: "paid",
    p: 1,
  });
  return (
    <div className="mt-8 rounded-2xl border border-dashed border-[var(--border)] bg-[#fcfbf8] p-10 text-center">
      <p className="text-[var(--ink)]">No invoices found for your filters.</p>
      <div className="mt-3">
        <a
          href={clearHref}
          className="inline-flex items-center rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm text-[var(--ink)] hover:bg-[#faf7f2]"
        >
          Clear filters
        </a>
      </div>
    </div>
  );
}

function Th({ children, className = "" }) {
  return (
    <th
      className={`px-4 py-[var(--th-py,0.5rem)] text-left text-xs font-semibold uppercase tracking-wider ${className}`}
    >
      {children}
    </th>
  );
}
function Td({ children, className = "" }) {
  return (
    <td
      className={`px-4 py-[var(--td-py,0.75rem)] align-top text-sm text-[var(--ink)] ${className}`}
    >
      {children}
    </td>
  );
}

function StatusPill({ status }) {
  const map = {
    paid: "bg-green-50 text-green-700 border-green-200",
    confirmed: "bg-blue-50 text-blue-700 border-blue-200",
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    checked_in: "bg-cyan-50 text-cyan-700 border-cyan-200",
    cancelled: "bg-rose-50 text-rose-700 border-rose-200",
  };
  const cls =
    map[status] || "bg-neutral-50 text-neutral-700 border-neutral-200";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${cls}`}
    >
      {status || "—"}
    </span>
  );
}

function Pagination({ page, perPage, total, initial }) {
  if (!total || total <= perPage) return null;
  const last = Math.max(1, Math.ceil(total / perPage));

  const windowed = pageWindow(page, last, 1);

  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <a
          href={qsFromInitial(initial, { p: Math.max(1, page - 1) })}
          className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] hover:bg-[#fcfbf8]"
          aria-label="Previous page"
        >
          Previous
        </a>
        <div className="hidden md:flex md:items-center md:gap-1">
          {windowed.map((it, i) =>
            typeof it === "number" ? (
              <a
                key={i}
                href={qsFromInitial(initial, { p: it })}
                aria-label={`Page ${it}`}
                aria-current={it === page ? "page" : undefined}
                className={`rounded-lg px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/30 ${
                  it === page
                    ? "bg-[var(--ink)] text-white"
                    : "border border-[var(--border)] text-[var(--ink)] hover:bg-[#fcfbf8]"
                }`}
              >
                {it}
              </a>
            ) : (
              <span
                key={i}
                className="px-2 text-sm text-[var(--muted-ink)]"
                aria-hidden
              >
                …
              </span>
            )
          )}
        </div>
        <a
          href={qsFromInitial(initial, { p: Math.min(last, page + 1) })}
          className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink)] hover:bg-[#fcfbf8]"
          aria-label="Next page"
        >
          Next
        </a>
      </div>
      <div className="text-sm text-[var(--muted-ink)]">
        Page {page} of {last}
      </div>
    </div>
  );
}

/* ============================== helpers ============================== */
function clamp(n, min, max) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function renderError(msg) {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
        <div className="text-sm">{msg}</div>
      </div>
    </div>
  );
}

function dateInput(v) {
  if (!v) return "";
  try {
    const d = new Date(v);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getDate()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

function normalizeDateStart(v) {
  // treat yyyy-mm-dd as local 00:00
  if (/^\d{4}-\d{2}-\d{2}$/.test(v))
    return new Date(`${v}T00:00:00`).toISOString();
  const d = new Date(v);
  return isNaN(d) ? undefined : d.toISOString();
}
function normalizeDateEnd(v) {
  // treat yyyy-mm-dd as local 23:59:59
  if (/^\d{4}-\d{2}-\d{2}$/.test(v))
    return new Date(`${v}T23:59:59`).toISOString();
  const d = new Date(v);
  return isNaN(d) ? undefined : d.toISOString();
}

function fmtDate(iso) {
  if (!iso) return <span className="text-[var(--muted-ink)]">—</span>;
  try {
    return <span>{format(new Date(iso), "PPP")}</span>;
  } catch {
    return <span className="text-[var(--muted-ink)]">—</span>;
  }
}
function fmtDateTime(iso) {
  if (!iso) return <span className="text-[var(--muted-ink)]">—</span>;
  try {
    const d = new Date(iso);
    return <span>{format(d, "PPP p")}</span>;
  } catch {
    return <span className="text-[var(--muted-ink)]">—</span>;
  }
}

function fmtDatePlain(iso) {
  try {
    return format(new Date(iso), "PPP");
  } catch {
    return "—";
  }
}
function fmtDateTimePlain(iso) {
  try {
    const d = new Date(iso);
    return format(d, "PPP p");
  } catch {
    return "—";
  }
}

function fmtMoney(amount, currency) {
  try {
    const nf = new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: (currency || "EUR").toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return nf.format(Number(amount || 0));
  } catch {
    return `€${Number(amount || 0).toFixed(2)}`;
  }
}

function formatInv(id) {
  return `INV-${String(id).padStart(6, "0")}`;
}

function nameFromPrimary(pc) {
  if (!pc || typeof pc !== "object") return "—";
  const full =
    pc.fullName ||
    pc.full_name ||
    [pc.firstName, pc.lastName].filter(Boolean).join(" ") ||
    [pc.first_name, pc.last_name].filter(Boolean).join(" ") ||
    pc.name ||
    null;
  return full || emailFromPrimary(pc) || "—";
}
function emailFromPrimary(pc) {
  if (!pc || typeof pc !== "object") return "";
  return pc.email || pc.contactEmail || pc.customer_email || "";
}

function shorten(id) {
  if (!id) return "";
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function stripeDashboardUrl(pi) {
  // Note: this opens in whatever Stripe mode your dashboard is in.
  // Optional: detect test vs live by env and prepend https://dashboard.stripe.com/test/payments/
  const base =
    process.env.NODE_ENV !== "production"
      ? "https://dashboard.stripe.com/test/payments/"
      : "https://dashboard.stripe.com/payments/";
  return `${base}${encodeURIComponent(pi)}`;
}

// Builds a query string preserving current filters (server-safe)
function qsFromInitial(initial, patch) {
  const params = new URLSearchParams();
  if (initial?.q) params.set("q", String(initial.q));
  if (initial?.status) params.set("status", String(initial.status));
  if (initial?.from) params.set("from", String(initial.from));
  if (initial?.to) params.set("to", String(initial.to));
  if (initial?.perPage) params.set("per", String(initial.perPage));
  if (initial?.density) params.set("density", String(initial.density)); // preserve density
  // allow overriding / clearing
  for (const [k, v] of Object.entries(patch || {})) {
    if (v === "" || v === null || typeof v === "undefined") params.delete(k);
    else params.set(k, String(v));
  }
  return `?${params.toString()}`;
}

function guessCurrency(rows) {
  const first = rows?.find((r) => r?.currency);
  return first?.currency || "EUR";
}

// Page number window with ellipses
function pageWindow(current, last, radius = 1) {
  const pages = new Set([1, last]);
  for (let i = current - radius; i <= current + radius; i++) {
    if (i >= 1 && i <= last) pages.add(i);
  }
  const arr = Array.from(pages).sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    if (i > 0 && arr[i] !== arr[i - 1] + 1) out.push("ellipsis");
    out.push(arr[i]);
  }
  return out;
}

// Quick date presets (yyyy-mm-dd strings)
function buildPresets() {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfYear = new Date(today.getFullYear(), 0, 1);
  const d = (x) => fmtYMD(x);

  return [
    { key: "today", label: "Today", from: d(today), to: d(today) },
    {
      key: "last7",
      label: "Last 7 days",
      from: d(addDays(today, -6)),
      to: d(today),
    },
    { key: "mtd", label: "Month to date", from: d(startOfMonth), to: d(today) },
    {
      key: "last30",
      label: "Last 30 days",
      from: d(addDays(today, -29)),
      to: d(today),
    },
    { key: "ytd", label: "Year to date", from: d(startOfYear), to: d(today) },
  ];
}

function fmtYMD(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// ---------- tiny icons (inline svg so we don't pull client libs) ----------
function IconButton({
  as = "button",
  href,
  title,
  disabled,
  onClick,
  type,
  download,
  children,
  className = "",
}) {
  const base =
    "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--ink)] shadow-sm transition hover:bg-[#fcfbf8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50";

  if (as === "a") {
    return (
      <a
        href={href}
        title={title}
        aria-label={title}
        className={`${base} ${className}`}
        download={download}
      >
        {children}
      </a>
    );
  }
  return (
    <button
      type={type}
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${className}`}
    >
      {children}
    </button>
  );
}

const Eye = (props) => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const DownloadIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M7 10l5 5 5-5" />
    <path d="M12 15V3" />
  </svg>
);
const SendIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M22 2L11 13" />
    <path d="M22 2l-7 20-4-9-9-4 20-7Z" />
  </svg>
);
const Pencil = (props) => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);
