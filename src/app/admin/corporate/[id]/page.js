"use client";

/**
 * One corporate account: who they are, how they may pay, and what they owe.
 *
 * The bookings and invoices panels read booking."companyId" and
 * invoice.company_id. Until dump_sql/20260917_corporate_accounts.sql has been
 * run neither column exists, so the API reports `linked: false` and the panels
 * say so — rather than printing a zero that looks like a real answer.
 */

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Ban,
  CalendarDays,
  CheckCircle2,
  FileText,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Receipt,
  User,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  CardHeader,
  ErrorNote,
  Muted,
  Page,
  PageHeader,
  Skeleton,
  StatCard,
} from "@/app/admin/_ui";
import Modal from "../_components/Modal";
import CompanyForm from "../_components/CompanyForm";
import { netDays, termsLabel } from "@/lib/corporate/company";

export default function CorporateAccountPage({ params }) {
  const { id } = use(params);

  const [company, setCompany] = useState(null);
  const [bookings, setBookings] = useState(null);
  const [invoices, setInvoices] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/corporate/companies/${id}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Could not load the account (${res.status})`);
      setCompany(data.company);
      setBookings(data.bookings);
      setInvoices(data.invoices);
      setBillingColumns(data.billingColumns !== false);
      setLoadError("");
    } catch (err) {
      setLoadError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Terms only save once the migration has been run; the form disables them.
  const [billingColumns, setBillingColumns] = useState(true);

  async function patch(body, { onDone } = {}) {
    setSaving(true);
    setSaveError("");
    setFieldErrors({});
    try {
      const res = await fetch(`/api/admin/corporate/companies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (data?.field) setFieldErrors({ [data.field]: data.error });
        throw new Error(data?.error || `Could not save (${res.status})`);
      }
      setCompany(data.company);
      setNotice(
        data.needsMigration
          ? `Saved, except ${data.skipped.join(", ")} — those need the 20260917 migration.`
          : "Saved."
      );
      onDone?.();
    } catch (err) {
      setSaveError(String(err?.message || err));
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  if (loading) {
    return (
      <Page className="pb-10">
        <Skeleton className="mb-6 h-10 w-64" />
        <div className="grid gap-5 lg:grid-cols-3">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </Page>
    );
  }

  if (loadError || !company) {
    return (
      <Page className="pb-10">
        <BackLink />
        <ErrorNote className="mt-4">
          {loadError || "No such account."}{" "}
          <button type="button" onClick={load} className="font-semibold underline underline-offset-2">
            Try again
          </button>
        </ErrorNote>
      </Page>
    );
  }

  return (
    <Page className="pb-10">
      <BackLink />

      <PageHeader
        className="mt-3"
        eyebrow="Corporate account"
        title={company.name}
        description={company.vat ? `Tax ID ${company.vat}` : "No tax id on file"}
        actions={
          <>
            <Badge variant={company.isActive ? "success" : "danger"}>
              {company.isActive ? "Active" : "Disabled"}
            </Badge>
            <Button
              onClick={() => {
                setDraft(company);
                setSaveError("");
                setFieldErrors({});
                setEditing(true);
              }}
            >
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            <Button
              variant={company.isActive ? "secondary" : "primary"}
              disabled={saving}
              onClick={() => patch({ isActive: !company.isActive })}
            >
              {company.isActive ? (
                <>
                  <Ban className="h-4 w-4" /> Disable
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Enable
                </>
              )}
            </Button>
          </>
        }
      />

      {notice ? (
        <Card className="mb-5 border-[#d3e5d3] bg-[#e9f2e9] py-3">
          <p className="text-[13px] text-[#3f6b3f]">{notice}</p>
        </Card>
      ) : null}
      {saveError && !editing ? <ErrorNote className="mb-5">{saveError}</ErrorNote> : null}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Terms"
          value={termsLabel(company.paymentTerms)}
          accent={netDays(company.paymentTerms) > 0 ? "info" : "brand"}
          hint={netDays(company.paymentTerms) > 0 ? `${netDays(company.paymentTerms)} days to pay` : "Pays before arrival"}
        />
        <StatCard
          label="Credit limit"
          value={company.creditCents > 0 ? euros(company.creditCents) : "None"}
          accent="warning"
          hint={company.creditCents > 0 ? "May stand unpaid" : "No balance allowed"}
        />
        <StatCard
          label="Standing discount"
          value={Number(company.discountPct) > 0 ? `${trimPct(company.discountPct)}%` : "—"}
          accent="success"
          hint="Before any promo code"
        />
        <StatCard
          label="Purchase order"
          value={company.poRequired ? "Required" : "Not required"}
          hint={company.poRequired ? "Do not invoice without one" : "Invoice freely"}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader title="Contact" description="Who to reach about this account." />
            <dl className="grid gap-4 sm:grid-cols-2">
              <Detail icon={<User className="h-4 w-4" />} label="Contact" value={company.contactName} />
              <Detail
                icon={<Mail className="h-4 w-4" />}
                label="Email"
                value={company.email}
                href={company.email ? `mailto:${company.email}` : null}
              />
              <Detail
                icon={<Phone className="h-4 w-4" />}
                label="Phone"
                value={company.phone}
                href={company.phone ? `tel:${company.phone.replace(/\s+/g, "")}` : null}
              />
              <Detail
                icon={<MapPin className="h-4 w-4" />}
                label="Billing address"
                value={company.billingAddress}
                multiline
              />
            </dl>
          </Card>

          {company.notes ? (
            <Card>
              <CardHeader title="Notes" description="Internal only — the company never sees these." />
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#3f3127]">
                {company.notes}
              </p>
            </Card>
          ) : null}
        </div>

        <div className="space-y-5">
          <ActivityCard
            title="Bookings"
            icon={<CalendarDays className="h-4 w-4" />}
            rollup={bookings}
            emptyLabel="Nothing billed to this account yet."
            searchHref={searchHref("/admin/bookings", company)}
            searchLabel="Search bookings"
            rows={
              bookings?.linked
                ? [
                    ["Total", bookings.count],
                    ["Upcoming", bookings.upcoming],
                    ["Paid", euros(bookings.paidCents)],
                  ]
                : null
            }
          />

          <ActivityCard
            title="Invoices"
            icon={<Receipt className="h-4 w-4" />}
            rollup={invoices}
            emptyLabel="No invoices raised against this account."
            searchHref={searchHref("/admin/invoices", company)}
            searchLabel="Search invoices"
            rows={
              invoices?.linked
                ? [
                    ["Total", invoices.count],
                    ["Outstanding", euros(invoices.outstandingCents)],
                    ["Overdue", invoices.overdue],
                  ]
                : null
            }
          />

          <Card>
            <CardHeader title="Requests" description="Private and group enquiries." />
            <Muted className="mb-3 text-[12px]">
              Enquiries are handled on the requests board, searchable by the name they came in
              under.
            </Muted>
            <Button as={Link} href={searchHref("/admin/requests", company)} size="sm" className="w-full">
              <FileText className="h-3.5 w-3.5" /> Open requests
            </Button>
          </Card>
        </div>
      </div>

      {editing && draft ? (
        <Modal
          title="Edit account"
          description={company.name}
          wide
          onClose={() => (saving ? null : setEditing(false))}
          footer={
            <>
              <Button onClick={() => setEditing(false)} disabled={saving}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={saving || !draft.name?.trim()}
                onClick={() => patch(draft, { onDone: () => setEditing(false) })}
              >
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </>
          }
        >
          {saveError ? <ErrorNote className="mb-4">{saveError}</ErrorNote> : null}
          <CompanyForm
            value={draft}
            onChange={setDraft}
            errors={fieldErrors}
            billingColumns={billingColumns}
          />
        </Modal>
      ) : null}
    </Page>
  );
}

/* ------------------------------- pieces ---------------------------------- */

function BackLink() {
  return (
    <Link
      href="/admin/corporate"
      className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#8b6f47] hover:text-[#7a6039]"
    >
      <ArrowLeft className="h-4 w-4" /> All accounts
    </Link>
  );
}

function Detail({ icon, label, value, href, multiline = false }) {
  return (
    <div className="min-w-0">
      <dt className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9a8c7e]">
        <span className="text-[#c9b393]">{icon}</span>
        {label}
      </dt>
      <dd className={`break-words text-[13px] text-[#3f3127] ${multiline ? "whitespace-pre-line" : ""}`}>
        {value ? (
          href ? (
            <a href={href} className="text-[#8b6f47] hover:underline">
              {value}
            </a>
          ) : (
            value
          )
        ) : (
          <span className="text-[#b0a294]">—</span>
        )}
      </dd>
    </div>
  );
}

function ActivityCard({ title, icon, rollup, rows, emptyLabel, searchHref, searchLabel }) {
  const linked = rollup?.linked === true;

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <span className="text-[#c9b393]">{icon}</span>
            {title}
          </span>
        }
      />

      {!linked ? (
        <Muted className="text-[12px]">
          Bookings and invoices cannot be attributed to an account until{" "}
          <code className="rounded bg-[#f7f3ec] px-1 py-0.5">20260917_corporate_accounts.sql</code>{" "}
          has been run. Search by the contact&rsquo;s details in the meantime.
        </Muted>
      ) : rollup.error ? (
        <ErrorNote>{rollup.error}</ErrorNote>
      ) : rollup.count === 0 ? (
        <Muted className="text-[12px]">{emptyLabel}</Muted>
      ) : (
        <dl className="space-y-2">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-3">
              <dt className="text-[12px] text-[#7a6a5f]">{label}</dt>
              <dd className="font-serif text-[16px] tabular-nums text-[#2a211a]">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      <Button as={Link} href={searchHref} size="sm" className="mt-4 w-full">
        {searchLabel}
      </Button>
    </Card>
  );
}

/* -------------------------------- utils ---------------------------------- */

/** The best handle the target page can actually search on. */
function searchHref(base, company) {
  const term = company.email || company.contactName || company.name || "";
  return term ? `${base}?q=${encodeURIComponent(term)}` : base;
}

function euros(cents) {
  const v = Number(cents || 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: v % 1 === 0 ? 0 : 2,
    }).format(v);
  } catch {
    return `€${v.toFixed(0)}`;
  }
}

function trimPct(n) {
  const v = Number(n || 0);
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}
