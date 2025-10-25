export const dynamic = "force-dynamic";
export const revalidate = 0;
import React from "react";
import "server-only";
import { format } from "date-fns";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/**
 * Admin → Invoices (SSR, no TypeScript)
 * - Lists paid bookings as invoices with filtering (date range, status, search) & pagination
 * - No client-side JS required; the filters use a GET form that round-trips the page
 * - Uses Supabase Admin on the server
 *
 * UI/UX upgrades:
 * - Sticky, shadowed table header and zebra rows
 * - Responsive mobile card list (no horizontal scrolling on phones)
 * - Quick date presets (Today, Last 7, MTD, Last 30, YTD)
 * - KPI cards (Page Revenue, Avg Invoice, Guests, Results)
 * - Clear Filters button
 * - Better pagination with number buttons + ellipses that preserve filters
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
  const sent = (get("sent") || "").toString();
  const err = (get("err") || "").toString();
  const updated = (get("updated") || "").toString();

  // ---------- build base query ----------
  const baseSelect =
    "id, createdAt, startTime, status, numberOfPeople, totalPaidAmount, currency, primary_contact, stripePaymentIntentId, stripeSessionId, invoiceEmailSentAt";
  let listQ = admin
    .from("Booking")
    .select(baseSelect)
    .order("createdAt", { ascending: false });

  let countQ = admin
    .from("Booking")
    .select("id", { count: "exact", head: true });

  // status filter (default: paid)
  if (status && status !== "all") {
    listQ = listQ.eq("status", status);
    countQ = countQ.eq("status", status);
  }

  // date window on createdAt
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

  // search across id / customer / stripe ids
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

  // pagination
  const fromIdx = (page - 1) * perPage;
  const toIdx = fromIdx + perPage - 1;
  listQ = listQ.range(fromIdx, toIdx);

  // run queries
  const [{ data: rows, error: listErr }, { count, error: countErr }] =
    await Promise.all([listQ, countQ]);

  if (listErr) return renderError(listErr.message || "Failed to load invoices");
  const total = countErr ? null : Number(count || 0);

  const pageTotal = (rows || []).reduce(
    (s, r) => s + (Number(r?.totalPaidAmount || 0) || 0),
    0
  );
  const guestsTotal = (rows || []).reduce(
    (s, r) => s + (Number(r?.numberOfPeople || 1) || 1),
    0
  );
  const avgInvoice = rows?.length ? pageTotal / rows.length : 0;

  const initial = { q, status, from, to, perPage, page };

  // ---------------- UI helpers ----------------
  // Minimal, accessible icon-only button
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
      "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#e8e5df] text-[#3f382f] shadow-sm transition hover:bg-[#fcfbf8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50";

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

  // lazy import-friendly icons (lucide-react) — adjust to your setup
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

  // ---------- render ----------
  return (
    <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 isolate before:absolute before:inset-0 before:-z-10 before:bg-[radial-gradient(1200px_600px_at_50%_-50%,rgba(139,111,71,0.06),transparent_60%)] after:absolute after:inset-x-0 after:top-0 after:-z-10 after:h-24 after:bg-[linear-gradient(to_bottom,rgba(252,251,248,0.85),transparent)]">
      <h1 className="sr-only">Invoices</h1>
      <Header />

      {/* notices (supports ?sent= & ?updated=) */}
      <div aria-live="polite" aria-atomic="true">
        <AlertBar sent={sent} err={err} updated={updated} />
      </div>

      {/* Filters card – clearer structure, subtle glassy surface */}
      <section
        aria-label="Filters"
        className="rounded-2xl border border-[#e8e5df] bg-white/70 backdrop-blur supports-[backdrop-filter]:backdrop-blur p-4 shadow-[0_1px_0_rgba(0,0,0,0.04)] md:p-5"
      >
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
          <FiltersBar initial={initial} />
          <div className="md:pl-3">
            <QuickRanges initial={initial} />
          </div>
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
                  className="rounded-2xl border border-[#e8e5df] bg-white p-4 shadow-[0_1px_0_rgba(0,0,0,0.03)] transition-colors hover:bg-[#faf7f2]/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[#3f382f] tracking-wide tabular-nums">
                        {formatInv(r.id)}
                      </div>
                      <div className="mt-1 text-xs text-[#7a6a58]">
                        {fmtDate(r.createdAt)}
                      </div>
                    </div>
                    <StatusPill status={r.status} />
                  </div>

                  <div className="mt-3 text-sm text-[#3f382f]">
                    {nameFromPrimary(r.primary_contact)}
                  </div>
                  <div className="text-xs text-[#7a6a58] break-all">
                    {emailFromPrimary(r.primary_contact)}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-[#3f382f] tabular-nums">
                        {fmtMoney(r.totalPaidAmount, r.currency)}
                      </div>
                      <div className="text-[11px] text-[#7a6a58]">
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
                      {/* Edit (icon style) — ensure your EditDetails supports className/variant="icon" */}
                      <EditDetails
                        id={r.id}
                        pc={r.primary_contact}
                        variant="icon"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#e8e5df] text-[#3f382f] shadow-sm transition hover:bg-[#fcfbf8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-white"
                      >
                        <Pencil />
                        <span className="sr-only">Edit</span>
                      </EditDetails>

                      <IconButton
                        as="a"
                        href={`/api/admin/invoices/${r.id}/download`}
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

                      <form action="/api/admin/invoices/send" method="POST">
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="mode" value="custom" />
                        <IconButton
                          as="button"
                          type="submit"
                          disabled={!canSend}
                          title={canSend ? "Send invoice" : "No customer email"}
                        >
                          <SendIcon />
                          <span className="sr-only">Send</span>
                        </IconButton>
                      </form>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Desktop table – sticky first & last columns, compact icon action bar */}
          <div className="mt-6 hidden md:block">
            <div className="overflow-hidden rounded-2xl border border-[#e8e5df] bg-white shadow-[0_1px_0_rgba(0,0,0,0.04)]">
              <div className="relative max-h-[70vh] overflow-auto [scrollbar-gutter:stable_both-edges]">
                <table className="min-w-full table-fixed text-sm">
                  <thead className="sticky top-0 z-10 bg-[#fcfbf8]/95 backdrop-blur supports-[backdrop-filter]:backdrop-blur text-[#7a6a58] shadow-[0_1px_0_#efeae1]">
                    <Row>
                      <Th className="w-[160px] sticky left-0 z-20 bg-[#fcfbf8]/95 backdrop-blur supports-[backdrop-filter]:backdrop-blur shadow-[1px_0_0_#efeae1]">
                        #
                      </Th>
                      <Th>Created</Th>
                      <Th>Start</Th>
                      <Th>Customer</Th>
                      <Th className="text-right">Amount</Th>
                      <Th>Status</Th>
                      <Th>Stripe PI</Th>
                      <Th>Email</Th>
                      <Th className="text-right sticky right-0 z-20 pr-4 bg-[#fcfbf8]/95 backdrop-blur supports-[backdrop-filter]:backdrop-blur shadow-[-1px_0_0_#efeae1] w-[168px]">
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
                          <Td className="sticky left-0 z-10 bg-white group-hover:bg-[#faf7f2]/70 shadow-[1px_0_0_#efeae1]">
                            <div className="font-medium text-[#3f382f] tracking-wide tabular-nums">
                              {formatInv(r.id)}
                            </div>
                            <div className="text-[11px] text-[#7a6a58] truncate">
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
                            <div className="text-[#3f382f]">
                              {nameFromPrimary(r.primary_contact)}
                            </div>
                            <div className="text-[11px] text-[#7a6a58] truncate max-w-[240px]">
                              {emailFromPrimary(r.primary_contact)}
                            </div>
                          </Td>
                          <Td className="text-right">
                            <div className="font-semibold text-[#3f382f] tabular-nums">
                              {fmtMoney(r.totalPaidAmount, r.currency)}
                            </div>
                            <div className="text-[11px] text-[#7a6a58]">
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
                              <span className="text-[#7a6a58]">—</span>
                            )}
                          </Td>
                          <Td className="whitespace-nowrap">
                            {sentAt ? (
                              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-800">
                                ✓ Sent · {fmtDateTime(sentAt)}
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] text-neutral-700">
                                Not sent
                              </span>
                            )}
                          </Td>
                          <Td className="text-right sticky right-0 z-10 pr-4 bg-white group-hover:bg-[#faf7f2]/70 shadow-[-1px_0_0_#efeae1]">
                            <div className="inline-flex items-center gap-2">
                              {/* Edit */}
                              <EditDetails
                                id={r.id}
                                pc={r.primary_contact}
                                variant="icon"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#e8e5df] text-[#3f382f] shadow-sm transition hover:bg-[#fcfbf8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-white"
                              >
                                <Pencil />
                                <span className="sr-only">Edit</span>
                              </EditDetails>

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

                              {/* View */}
                              {/* <IconButton
                                as="a"
                                href={`/admin/reservations/${r.id}`}
                                title="View reservation"
                              >
                                <Eye />
                                <span className="sr-only">View</span>
                              </IconButton> */}

                              {/* Send */}
                              <form
                                action="/api/admin/invoices/send"
                                method="POST"
                              >
                                <input type="hidden" name="id" value={r.id} />
                                <input
                                  type="hidden"
                                  name="mode"
                                  value="custom"
                                />
                                <IconButton
                                  as="button"
                                  type="submit"
                                  disabled={!canSend}
                                  title={
                                    canSend
                                      ? "Send invoice"
                                      : "No customer email"
                                  }
                                >
                                  <SendIcon />
                                  <span className="sr-only">Send</span>
                                </IconButton>
                              </form>
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

      {/* Sticky footer pagination on long lists */}
      <div className="mt-6 md:sticky md:bottom-3 md:z-30">
        <div className="rounded-2xl border border-[#e8e5df] bg-white/85 backdrop-blur supports-[backdrop-filter]:backdrop-blur shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
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

/* ============================== UI bits ============================== */
function Header() {
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#3f382f]">
          Invoices
        </h1>
        <p className="mt-1 text-sm text-[#7a6a58]">
          Review and search customer invoices generated from paid bookings.
        </p>
      </div>
    </div>
  );
}

function AlertBar({ sent, err, updated }) {
  if (updated) {
    return (
      <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        Saved changes for{" "}
        <span className="font-semibold">Invoice {formatInv(updated)}</span>.
      </div>
    );
  }
  if (!sent && !err) return null;
  if (sent) {
    return (
      <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
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
  };
  return (
    <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
      {messages[err] || "Failed to process request."}
    </div>
  );
}

function FiltersBar({ initial }) {
  const { q, status, from, to, perPage } = initial || {};

  const hasActiveFilters = Boolean(
    q || from || to || (status && status !== "paid")
  );
  const activeCount = [q, from, to, status && status !== "paid"].filter(
    Boolean
  ).length;

  const clearHref = qsFromInitial(initial, {
    q: "",
    from: "",
    to: "",
    status: "paid",
    p: 1,
  });

  return (
    <form
      method="GET"
      className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end"
      aria-labelledby="filters-legend"
    >
      {/* group: Search */}
      <fieldset className="md:col-span-4">
        <legend id="filters-legend" className="sr-only">
          Invoice filters
        </legend>
        <label className="block text-xs text-[#7a6a58]" htmlFor="f-q">
          Search
        </label>
        <div className="relative mt-1">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
            {/* magnifier */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M21 21l-4.35-4.35"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <circle
                cx="11"
                cy="11"
                r="7"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          </span>
          <input
            id="f-q"
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Name, email, PI id, booking id…"
            enterKeyHint="search"
            className="w-full rounded-lg border border-[#e8e5df] bg-white pl-9 pr-3 py-2 text-sm text-[#3f382f] placeholder:text-[#b1a595] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/40"
          />
        </div>
      </fieldset>

      {/* group: Status */}
      <fieldset className="md:col-span-2">
        <label className="block text-xs text-[#7a6a58]" htmlFor="f-status">
          Status
        </label>
        <div className="relative mt-1">
          <select
            id="f-status"
            name="status"
            defaultValue={status || "paid"}
            className="w-full appearance-none rounded-lg border border-[#e8e5df] bg-white px-3 py-2 pr-8 text-sm text-[#3f382f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/40"
          >
            <option value="paid">paid</option>
            <option value="confirmed">confirmed</option>
            <option value="completed">completed</option>
            <option value="checked_in">checked_in</option>
            <option value="cancelled">cancelled</option>
            <option value="all">All</option>
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
            {/* chevron */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M6 9l6 6 6-6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
      </fieldset>

      {/* group: From */}
      <fieldset className="md:col-span-2">
        <label className="block text-xs text-[#7a6a58]" htmlFor="f-from">
          From
        </label>
        <div className="relative mt-1">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
            {/* calendar */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <rect
                x="3"
                y="5"
                width="18"
                height="16"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M16 3v4M8 3v4M3 10h18"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <input
            id="f-from"
            type="date"
            name="from"
            defaultValue={dateInput(from)}
            max={dateInput(to) || undefined}
            className="w-full rounded-lg border border-[#e8e5df] bg-white pl-9 pr-3 py-2 text-sm text-[#3f382f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/40"
          />
        </div>
      </fieldset>

      {/* group: To */}
      <fieldset className="md:col-span-2">
        <label className="block text-xs text-[#7a6a58]" htmlFor="f-to">
          To
        </label>
        <div className="relative mt-1">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
            {/* calendar */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <rect
                x="3"
                y="5"
                width="18"
                height="16"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M16 3v4M8 3v4M3 10h18"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <input
            id="f-to"
            type="date"
            name="to"
            defaultValue={dateInput(to)}
            min={dateInput(from) || undefined}
            className="w-full rounded-lg border border-[#e8e5df] bg-white pl-9 pr-3 py-2 text-sm text-[#3f382f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/40"
          />
        </div>
      </fieldset>

      {/* group: Per page */}
      <fieldset className="md:col-span-1">
        <label className="block text-xs text-[#7a6a58]" htmlFor="f-per">
          Rows/page
        </label>
        <div className="relative mt-1">
          <select
            id="f-per"
            name="per"
            defaultValue={String(perPage || 25)}
            className="w-full appearance-none rounded-lg border border-[#e8e5df] bg-white px-3 py-2 pr-8 text-sm text-[#3f382f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/40"
          >
            <option>10</option>
            <option>25</option>
            <option>50</option>
            <option>100</option>
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M6 9l6 6 6-6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
      </fieldset>

      {/* Actions */}
      <div
        role="toolbar"
        className="md:col-span-2 flex flex-col sm:flex-row items-stretch sm:items-end justify-end gap-2 flex-wrap"
      >
        {hasActiveFilters ? (
          <a
            href={clearHref}
            className="inline-flex items-center justify-center rounded-lg border border-[#e8e5df] bg-white px-3 py-2 text-sm text-[#3f382f] shadow-sm transition hover:bg-[#fcfbf8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/40 shrink-0 whitespace-nowrap w-full sm:w-auto"
          >
            Clear
          </a>
        ) : null}
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#3f382f] px-4 py-2 text-sm text-white shadow transition hover:bg-[#2f2922] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/40 shrink-0 whitespace-nowrap w-full sm:w-auto"
        >
          {/* search icon */}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M21 21l-4.35-4.35"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <circle
              cx="11"
              cy="11"
              r="7"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
          Apply
        </button>
      </div>

      {/* Active counter (a11y) */}
      <div
        className="col-span-full text-[11px] text-[#7a6a58]"
        aria-live="polite"
      >
        {hasActiveFilters ? `Filters active: ${activeCount}` : null}
      </div>
    </form>
  );
}

function QuickRanges({ initial }) {
  const presets = buildPresets();
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {presets.map((p) => (
        <a
          key={p.key}
          href={qsFromInitial(initial, { from: p.from, to: p.to, p: 1 })}
          className="rounded-full border border-[#e8e5df] bg-white px-3 py-1.5 text-xs text-[#3f382f] hover:bg-[#fcfbf8]"
        >
          {p.label}
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
    <div className="rounded-2xl border border-[#e8e5df] bg-white p-4 shadow-[0_1px_0_0_rgba(0,0,0,0.02)]">
      <div className="text-xs uppercase tracking-wide text-[#7a6a58]">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-[#3f382f] tabular-nums">
        {value}
      </div>
    </div>
  );
}

function EditDetails({ id, pc }) {
  return (
    <details className="relative inline-block">
      <summary className="inline-flex cursor-pointer select-none items-center rounded-lg border border-[#e8e5df] px-3 py-1.5 text-xs text-[#3f382f] shadow-sm hover:bg-[#fcfbf8]">
        Edit
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-[380px] rounded-xl border border-[#e8e5df] bg-white p-4 text-left shadow-lg">
        <form
          action="/api/admin/invoices/update"
          method="POST"
          className="space-y-3"
        >
          <input type="hidden" name="id" value={id} />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-[#7a6a58]">Full name</label>
              <input
                name="fullName"
                defaultValue={nameFromPrimary(pc)}
                className="mt-1 w-full rounded-lg border border-[#e8e5df] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-[#7a6a58]">Email</label>
              <input
                name="email"
                defaultValue={emailFromPrimary(pc)}
                className="mt-1 w-full rounded-lg border border-[#e8e5df] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-[#7a6a58]">Phone</label>
              <input
                name="phone"
                defaultValue={pc?.phone || ""}
                className="mt-1 w-full rounded-lg border border-[#e8e5df] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-[#7a6a58]">Business</label>
              <input
                name="businessName"
                defaultValue={pc?.businessName || ""}
                className="mt-1 w-full rounded-lg border border-[#e8e5df] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-[#7a6a58]">Tax number</label>
              <input
                name="taxNumber"
                defaultValue={pc?.taxNumber || ""}
                className="mt-1 w-full rounded-lg border border-[#e8e5df] px-3 py-2 text-sm"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs text-[#7a6a58]">
                Address line 1
              </label>
              <input
                name="addressLine1"
                defaultValue={pc?.address?.line1 || ""}
                className="mt-1 w-full rounded-lg border border-[#e8e5df] px-3 py-2 text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-[#7a6a58]">
                Address line 2
              </label>
              <input
                name="addressLine2"
                defaultValue={pc?.address?.line2 || ""}
                className="mt-1 w-full rounded-lg border border-[#e8e5df] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-[#7a6a58]">City</label>
              <input
                name="city"
                defaultValue={pc?.address?.city || ""}
                className="mt-1 w-full rounded-lg border border-[#e8e5df] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-[#7a6a58]">
                Postal code
              </label>
              <input
                name="postalCode"
                defaultValue={pc?.address?.postalCode || ""}
                className="mt-1 w-full rounded-lg border border-[#e8e5df] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-[#7a6a58]">Country</label>
              <input
                name="country"
                defaultValue={pc?.address?.country || "GR"}
                className="mt-1 w-full rounded-lg border border-[#e8e5df] px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="submit"
              className="inline-flex items-center rounded-lg bg-[#3f382f] px-3 py-1.5 text-xs text-white shadow hover:bg-[#2f2922]"
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
          className="rounded-2xl border border-[#e8e5df] bg-white p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-[#3f382f]">
                {formatInv(r.id)}
              </div>
              <div className="mt-1 text-xs text-[#7a6a58]">
                {fmtDate(r.createdAt)}
              </div>
            </div>
            <StatusPill status={r.status} />
          </div>
          <div className="mt-3 text-sm text-[#3f382f]">
            {nameFromPrimary(r.primary_contact)}
          </div>
          <div className="text-xs text-[#7a6a58]">
            {emailFromPrimary(r.primary_contact)}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-[#3f382f]">
                {fmtMoney(r.totalPaidAmount, r.currency)}
              </div>
              <div className="text-[11px] text-[#7a6a58]">
                {r.numberOfPeople || 1} guest(s)
              </div>
            </div>
            <a
              href={`/admin/reservations/${r.id}`}
              className="inline-flex items-center rounded-lg border border-[#e8e5df] px-3 py-1.5 text-xs text-[#3f382f] hover:bg-[#fcfbf8]"
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
    <div className="mt-8 rounded-2xl border border-dashed border-[#e8e5df] bg-[#fcfbf8] p-10 text-center">
      <p className="text-[#3f382f]">No invoices found for your filters.</p>
      <div className="mt-3">
        <a
          href={clearHref}
          className="inline-flex items-center rounded-lg border border-[#e8e5df] bg-white px-4 py-2 text-sm text-[#3f382f] hover:bg-[#faf7f2]"
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
      className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${className}`}
    >
      {children}
    </th>
  );
}
function Td({ children, className = "" }) {
  return (
    <td className={`px-4 py-3 align-top text-sm text-[#3f382f] ${className}`}>
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
          className="rounded-lg border border-[#e8e5df] px-3 py-2 text-sm text-[#3f382f] hover:bg-[#fcfbf8]"
        >
          Previous
        </a>
        <div className="hidden md:flex md:items-center md:gap-1">
          {windowed.map((it, i) =>
            typeof it === "number" ? (
              <a
                key={i}
                href={qsFromInitial(initial, { p: it })}
                className={`rounded-lg px-3 py-2 text-sm ${
                  it === page
                    ? "bg-[#3f382f] text-white"
                    : "border border-[#e8e5df] text-[#3f382f] hover:bg-[#fcfbf8]"
                }`}
              >
                {it}
              </a>
            ) : (
              <span key={i} className="px-2 text-sm text-[#7a6a58]">
                …
              </span>
            )
          )}
        </div>
        <a
          href={qsFromInitial(initial, { p: Math.min(last, page + 1) })}
          className="rounded-lg border border-[#e8e5df] px-3 py-2 text-sm text-[#3f382f] hover:bg-[#fcfbf8]"
        >
          Next
        </a>
      </div>
      <div className="text-sm text-[#7a6a58]">
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
  if (!iso) return <span className="text-[#7a6a58]">—</span>;
  try {
    return <span>{format(new Date(iso), "PPP")}</span>;
  } catch {
    return <span className="text-[#7a6a58]">—</span>;
  }
}
function fmtDateTime(iso) {
  if (!iso) return <span className="text-[#7a6a58]">—</span>;
  try {
    const d = new Date(iso);
    return <span>{format(d, "PPP p")}</span>;
  } catch {
    return <span className="text-[#7a6a58]">—</span>;
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
