"use client";

/**
 * Corporate — company accounts.
 *
 * This page used to carry its own Requests and Invoices tabs on tables of the
 * same name. Both were empty, nothing ever wrote a corporate invoice, and the
 * rest of admin was already handling requests on booking_request and invoices
 * on invoice. So Corporate now holds the one thing nothing else does — who the
 * company is and how they are allowed to pay — and links out for the rest.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronRight, Download, Plus, Search } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Muted,
  Page,
  PageHeader,
  Skeleton,
  StatCard,
  Table,
  Td,
  Th,
  Tr,
  controlClass,
} from "@/app/admin/_ui";
import Modal from "./_components/Modal";
import CompanyForm, { BLANK_COMPANY } from "./_components/CompanyForm";
import { hasCredit, netDays, termsLabel } from "@/lib/corporate/company";

export default function CorporatePage() {
  const router = useRouter();

  const [companies, setCompanies] = useState([]);
  const [billingColumns, setBillingColumns] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(BLANK_COMPANY);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/corporate/companies", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Could not load accounts (${res.status})`);
      setCompanies(Array.isArray(data?.companies) ? data.companies : []);
      setBillingColumns(data?.billingColumns !== false);
      setLoadError("");
    } catch (err) {
      // The old page swallowed this and showed an empty table, which reads as
      // "no accounts" rather than "the request failed".
      setLoadError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // "/" jumps to search — but not while you are typing into something, which
  // is how the previous shortcut handler made the search box refuse slashes
  // and opened a modal at every "nc" in a company name.
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target;
      const tag = el?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || el?.isContentEditable) return;
      const search = document.getElementById("corporate-search");
      if (!search) return;
      e.preventDefault();
      search.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return companies.filter((c) => {
      if (status === "active" && !c.isActive) return false;
      if (status === "disabled" && c.isActive) return false;
      if (status === "credit" && !hasCredit(c)) return false;
      if (!q) return true;
      return [c.name, c.vat, c.email, c.phone, c.contactName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [companies, query, status]);

  const stats = useMemo(() => {
    const active = companies.filter((c) => c.isActive);
    return {
      total: companies.length,
      active: active.length,
      onCredit: active.filter(hasCredit).length,
      creditCents: active.reduce((sum, c) => sum + Number(c.creditCents || 0), 0),
    };
  }, [companies]);

  async function createCompany() {
    const name = draft.name.trim();
    if (!name) {
      setFieldErrors({ name: "Required." });
      return;
    }
    setSaving(true);
    setSaveError("");
    setFieldErrors({});
    try {
      const res = await fetch("/api/admin/corporate/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (data?.field) setFieldErrors({ [data.field]: data.error });
        throw new Error(data?.error || `Could not create the account (${res.status})`);
      }
      setCreating(false);
      setDraft(BLANK_COMPANY);
      router.push(`/admin/corporate/${data.id}`);
    } catch (err) {
      setSaveError(String(err?.message || err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page className="pb-10">
      <PageHeader
        eyebrow="Revenue"
        title="Corporate"
        description="Company accounts, what they may be billed and how long they have to pay."
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setDraft(BLANK_COMPANY);
              setFieldErrors({});
              setSaveError("");
              setCreating(true);
            }}
          >
            <Plus className="h-4 w-4" /> New account
          </Button>
        }
      />

      {!billingColumns && !loading ? (
        <Card className="mb-5 border-[#f0e0bb] bg-[#fbf1dc]">
          <h2 className="font-serif text-[16px] text-[#2a211a]">Billing terms are not stored yet</h2>
          <Muted className="mt-1">
            Payment terms, standing discounts and PO rules need{" "}
            <code className="rounded bg-white/70 px-1 py-0.5 text-[12px]">
              dump_sql/20260917_corporate_accounts.sql
            </code>{" "}
            to be run. Until then every account reads as prepaid, and those fields
            will not save.
          </Muted>
        </Card>
      ) : null}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {loading ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <StatCard label="Accounts" value={stats.total} hint={`${stats.active} active`} />
            <StatCard label="On credit terms" value={stats.onCredit} accent="info" hint="Billed after the day" />
            <StatCard label="Credit extended" value={euros(stats.creditCents)} accent="warning" hint="Combined ceiling" />
            <StatCard label="Prepaid" value={stats.active - stats.onCredit} accent="success" hint="Pay before arrival" />
          </>
        )}
      </div>

      {loadError ? (
        <ErrorNote className="mb-5">
          {loadError}{" "}
          <button type="button" onClick={load} className="font-semibold underline underline-offset-2">
            Try again
          </button>
        </ErrorNote>
      ) : null}

      <Card padded={false}>
        <div className="flex flex-col gap-2 border-b border-[#f0ebe2] px-4 py-3 sm:flex-row sm:items-center">
          {/* Search gets its own row on a phone; sharing one with the filter and
              the export button squeezed it down to the magnifier. */}
          <div className="relative w-full sm:min-w-0 sm:flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#b0a294]" />
            <input
              id="corporate-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, tax id, contact…"
              className={`w-full pl-9 ${controlClass}`}
            />
          </div>

          <div className="flex items-center gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={`${controlClass} pr-8`}
            aria-label="Filter accounts"
          >
            <option value="all">All accounts</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
            <option value="credit">On credit terms</option>
          </select>

          <div className="ml-auto flex items-center gap-2">
            <Muted className="whitespace-nowrap text-[12px]">
              {visible.length === companies.length
                ? `${companies.length} ${companies.length === 1 ? "account" : "accounts"}`
                : `${visible.length} of ${companies.length}`}
            </Muted>
            <Button size="sm" onClick={() => exportCsv(visible)} disabled={!visible.length}>
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
          </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : loadError && companies.length === 0 ? (
          // Not "no accounts yet" — the list never arrived, and saying otherwise
          // reads as an answer about the data.
          <EmptyState
            icon={<Building2 className="h-5 w-5" />}
            title="Accounts could not be loaded"
            description="The list above failed to load, so there is nothing to show here yet."
            action={<Button onClick={load}>Try again</Button>}
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-5 w-5" />}
            title={companies.length ? "Nothing matches" : "No corporate accounts yet"}
            description={
              companies.length
                ? "Try a different search, or clear the filter."
                : "Add the companies you invoice directly, so their bookings can be billed to an account instead of a card."
            }
            action={
              companies.length ? (
                <Button
                  onClick={() => {
                    setQuery("");
                    setStatus("all");
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button variant="primary" onClick={() => setCreating(true)}>
                  <Plus className="h-4 w-4" /> New account
                </Button>
              )
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Account</Th>
                <Th className="hidden md:table-cell">Contact</Th>
                <Th>Terms</Th>
                <Th className="hidden sm:table-cell text-right">Credit</Th>
                <Th className="hidden lg:table-cell text-right">Discount</Th>
                <Th>Status</Th>
                <Th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <Tr key={c.id} onClick={() => router.push(`/admin/corporate/${c.id}`)}>
                  <Td>
                    <div className="font-semibold text-[#2a211a]">{c.name}</div>
                    <div className="text-[11px] text-[#9a8c7e]">{c.vat || "No tax id"}</div>
                  </Td>
                  <Td className="hidden md:table-cell">
                    <div>{c.contactName || "—"}</div>
                    <div className="text-[11px] text-[#9a8c7e]">{c.email || c.phone || ""}</div>
                  </Td>
                  <Td>
                    <Badge variant={netDays(c.paymentTerms) > 0 ? "info" : "neutral"}>
                      {termsLabel(c.paymentTerms)}
                    </Badge>
                  </Td>
                  <Td className="hidden sm:table-cell text-right tabular-nums">
                    {c.creditCents > 0 ? euros(c.creditCents) : "—"}
                  </Td>
                  <Td className="hidden lg:table-cell text-right tabular-nums">
                    {Number(c.discountPct) > 0 ? `${trimPct(c.discountPct)}%` : "—"}
                  </Td>
                  <Td>
                    <Badge variant={c.isActive ? "success" : "danger"}>
                      {c.isActive ? "Active" : "Disabled"}
                    </Badge>
                  </Td>
                  <Td className="text-right text-[#c9b393]">
                    <ChevronRight className="h-4 w-4" />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {creating ? (
        <Modal
          title="New corporate account"
          description="Who they are, and how they are allowed to pay."
          onClose={() => (saving ? null : setCreating(false))}
          wide
          footer={
            <>
              <Button onClick={() => setCreating(false)} disabled={saving}>
                Cancel
              </Button>
              <Button variant="primary" onClick={createCompany} disabled={saving || !draft.name.trim()}>
                {saving ? "Creating…" : "Create account"}
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

/* --------------------------------- utils --------------------------------- */

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

function exportCsv(rows) {
  if (!rows?.length) return;
  const columns = [
    ["Name", (c) => c.name],
    ["Tax ID", (c) => c.vat],
    ["Contact", (c) => c.contactName],
    ["Email", (c) => c.email],
    ["Phone", (c) => c.phone],
    ["Terms", (c) => termsLabel(c.paymentTerms)],
    ["Credit (EUR)", (c) => (Number(c.creditCents || 0) / 100).toFixed(2)],
    ["Discount (%)", (c) => String(c.discountPct ?? 0)],
    ["PO required", (c) => (c.poRequired ? "yes" : "no")],
    ["Status", (c) => (c.isActive ? "active" : "disabled")],
  ];
  const esc = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const csv = [
    columns.map(([h]) => h).join(","),
    ...rows.map((c) => columns.map(([, get]) => esc(get(c))).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "corporate-accounts.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}
