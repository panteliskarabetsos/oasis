"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/components/SessionWrapper";
import {
  Building2,
  FileText,
  ArrowLeft,
  Plus,
  Search,
  Check,
  X,
  Mail,
  Phone,
  CreditCard,
  CalendarDays,
  Download,
  ArrowUpRight,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*                             Admin Corporate Page                           */
/* -------------------------------------------------------------------------- */
export default function CorporatePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [booted, setBooted] = useState(false);
  const [isAdmin, setIsAdmin] = useState(null); // null | boolean

  // tabs: companies | requests | invoices | settings
  const [tab, setTab] = useState("requests");

  // data
  const [companies, setCompanies] = useState([]);
  const [requests, setRequests] = useState([]);
  const [invoices, setInvoices] = useState([]);

  // ui state
  const [qCompany, setQCompany] = useState("");
  const [qRequest, setQRequest] = useState("");
  const [qInvoice, setQInvoice] = useState("");

  const [creatingCompany, setCreatingCompany] = useState(false);
  const [creatingRequest, setCreatingRequest] = useState(false);

  const seqRef = useRef("");

  /* ------------------------------- auth/role ------------------------------- */
  useEffect(() => {
    let cancel = false;
    async function resolveRole() {
      if (!user) {
        setIsAdmin(false);
        setBooted(true);
        return;
      }
      try {
        const res = await fetch("/api/me", {
          cache: "no-store",
          credentials: "include",
        });
        const data = res.ok ? await res.json() : null;
        const role =
          data?.role ||
          user?.app_metadata?.role ||
          user?.user_metadata?.role ||
          "user";
        if (!cancel) {
          setIsAdmin(role === "admin");
          setBooted(true);
        }
      } catch (e) {
        if (!cancel) {
          const fallback =
            user?.app_metadata?.role || user?.user_metadata?.role || "user";
          setIsAdmin(fallback === "admin");
          setBooted(true);
        }
      }
    }
    if (!loading) resolveRole();
    return () => {
      cancel = true;
    };
  }, [user, loading]);

  useEffect(() => {
    if (!booted || isAdmin !== true) return;
    (async () => {
      try {
        const [c, r, i] = await Promise.all([
          safeJson(
            fetch("/api/admin/corporate/companies", { cache: "no-store" })
          ),
          safeJson(
            fetch("/api/admin/corporate/requests?status=any", {
              cache: "no-store",
            })
          ),
          safeJson(
            fetch("/api/admin/corporate/invoices", { cache: "no-store" })
          ),
        ]);
        setCompanies(Array.isArray(c) ? c : []);
        setRequests(Array.isArray(r) ? r : []);
        setInvoices(Array.isArray(i) ? i : []);
      } catch (e) {
        // show empty; UI stays interactive
      }
    })();
  }, [booted, isAdmin]);

  /* ------------------------------ kb shortcuts ----------------------------- */
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "/") {
        const el = document.getElementById("corp-search");
        if (el) {
          e.preventDefault();
          el.focus();
        }
        return;
      }
      if (e.key && e.key.length === 1) {
        seqRef.current = (seqRef.current + e.key).slice(-2).toLowerCase();
        if (seqRef.current === "nc") setCreatingCompany(true); // new company
        if (seqRef.current === "nr") setCreatingRequest(true); // new request
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  /* --------------------------------- guard -------------------------------- */
  if (loading || !booted || isAdmin === null) return <Skeleton />;
  if (!isAdmin) return null;

  /* --------------------------------- render -------------------------------- */
  return (
    <div className="relative min-h-screen bg-[#f4f1ec] text-[#5a4a3f]">
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute -top-40 -left-24 h-[28rem] w-[28rem] rounded-full bg-[#e9e4dc] blur-3xl opacity-70" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-[32rem] w-[32rem] rounded-full bg-[#fff4e1] blur-3xl opacity-80" />

      <div className="relative mx-auto px-6 pt-4 pb-12 max-w-6xl xl:max-w-7xl 2xl:max-w-[88rem]">
        {/* Header */}
        <div className="-mx-6 mb-4 sticky top-[env(safe-area-inset-top)] z-10 bg-gradient-to-b from-[#f4f1ec]/90 to-[#f4f1ec]/40 backdrop-blur border-b border-[#e8e2d9] px-6 py-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-serif tracking-tight flex items-center gap-2">
                <Building2 className="h-6 w-6" /> Corporate
              </h1>
              <p className="text-sm text-[#7a6a5f]">
                Companies, requests, invoices & terms.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.replace("/admin")}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 border border-[#d8cfc3] bg-[#fcf9f5] text-black text-xs shadow-sm hover:brightness-110"
                aria-label="Back to dashboard"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <button
                onClick={() => setCreatingCompany(true)}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 border border-[#d8cfc3] bg-[#8b6f47] text-white text-xs shadow-sm hover:brightness-110"
              >
                <Plus className="h-4 w-4" /> New Company (n c)
              </button>
              <button
                onClick={() => setCreatingRequest(true)}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 border border-[#d8cfc3] bg-white/70 text-xs hover:bg-[#f1ede7]"
              >
                <CalendarDays className="h-4 w-4" /> New Request (n r)
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex items-center gap-2 overflow-x-auto">
          <TabBtn
            active={tab === "requests"}
            onClick={() => setTab("requests")}
          >
            Requests
          </TabBtn>
          <TabBtn
            active={tab === "companies"}
            onClick={() => setTab("companies")}
          >
            Companies
          </TabBtn>
          <TabBtn
            active={tab === "invoices"}
            onClick={() => setTab("invoices")}
          >
            Invoices
          </TabBtn>
          <TabBtn
            active={tab === "settings"}
            onClick={() => setTab("settings")}
          >
            Settings
          </TabBtn>
        </div>

        {/* Search bar */}
        <div className="mb-4">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#7a6a5f]" />
            <input
              id="corp-search"
              value={
                tab === "companies"
                  ? qCompany
                  : tab === "invoices"
                  ? qInvoice
                  : qRequest
              }
              onChange={(e) => {
                const v = e.target.value;
                if (tab === "companies") setQCompany(v);
                else if (tab === "invoices") setQInvoice(v);
                else setQRequest(v);
              }}
              placeholder={`Search ${tab}… (/)`}
              className="w-full rounded-full border border-[#d8cfc3] bg-white/80 backdrop-blur px-9 py-2 text-sm placeholder:text-[#a09084] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/40"
            />
          </div>
        </div>

        {/* Panels */}
        {tab === "requests" && (
          <RequestsPanel
            data={filterRequests(requests, qRequest)}
            onApprove={handleApprove}
            onReject={handleReject}
            onConvert={handleConvert}
            onExport={() =>
              exportCsv(
                filterRequests(requests, qRequest),
                "corporate-requests.csv"
              )
            }
          />
        )}

        {tab === "companies" && (
          <CompaniesPanel
            data={filterCompanies(companies, qCompany)}
            onToggleActive={handleToggleCompany}
            onExport={() =>
              exportCsv(
                filterCompanies(companies, qCompany),
                "corporate-companies.csv"
              )
            }
          />
        )}

        {tab === "invoices" && (
          <InvoicesPanel
            data={filterInvoices(invoices, qInvoice)}
            onMarkPaid={handleMarkPaid}
            onExport={() =>
              exportCsv(
                filterInvoices(invoices, qInvoice),
                "corporate-invoices.csv"
              )
            }
          />
        )}

        {tab === "settings" && <SettingsPanel />}

        {/* Modals */}
        {creatingCompany && (
          <CompanyModal
            onClose={() => setCreatingCompany(false)}
            onCreate={async (payload) => {
              const ok = await postJson(
                "/api/admin/corporate/companies",
                payload
              );
              if (ok) {
                setCreatingCompany(false);
                // refresh
                const c = await safeJson(
                  fetch("/api/admin/corporate/companies", { cache: "no-store" })
                );
                setCompanies(Array.isArray(c) ? c : []);
              }
            }}
          />
        )}

        {creatingRequest && (
          <RequestModal
            companies={companies}
            onClose={() => setCreatingRequest(false)}
            onCreate={async (payload) => {
              const ok = await postJson(
                "/api/admin/corporate/requests",
                payload
              );
              if (ok) {
                setCreatingRequest(false);
                const r = await safeJson(
                  fetch("/api/admin/corporate/requests?status=any", {
                    cache: "no-store",
                  })
                );
                setRequests(Array.isArray(r) ? r : []);
              }
            }}
          />
        )}
      </div>
    </div>
  );

  /* ------------------------------- handlers ------------------------------- */
  async function handleApprove(req) {
    await postJson(`/api/admin/corporate/requests/${req.id}/approve`, {});
    setRequests((xs) =>
      xs.map((x) => (x.id === req.id ? { ...x, status: "approved" } : x))
    );
  }
  async function handleReject(req) {
    await postJson(`/api/admin/corporate/requests/${req.id}/reject`, {});
    setRequests((xs) =>
      xs.map((x) => (x.id === req.id ? { ...x, status: "rejected" } : x))
    );
  }
  async function handleConvert(req) {
    // navigate to booking creation with prefill
    const params = new URLSearchParams({
      companyId: String(req.companyId),
      experienceId: String(req.experienceId || ""),
      startTime: req.startTime || "",
      adults: String(req.adults || 0),
      kids: String(req.kids || 0),
      note: `[Corporate] ${req.notes || ""}`,
    });
    router.push(`/admin/bookings/new?${params.toString()}`);
  }
  async function handleToggleCompany(c) {
    const next = !c.isActive;
    await postJson(`/api/admin/corporate/companies/${c.id}/toggle`, {
      isActive: next,
    });
    setCompanies((xs) =>
      xs.map((x) => (x.id === c.id ? { ...x, isActive: next } : x))
    );
  }
  async function handleMarkPaid(inv) {
    await postJson(`/api/admin/corporate/invoices/${inv.id}/pay`, {});
    setInvoices((xs) =>
      xs.map((x) => (x.id === inv.id ? { ...x, status: "paid" } : x))
    );
  }
}

/* --------------------------------- Panels -------------------------------- */
function RequestsPanel({ data, onApprove, onReject, onConvert, onExport }) {
  return (
    <Card>
      <HeaderRow title="Requests" right={<ExportBtn onClick={onExport} />} />
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[#7a6a5f]">
            <Th>Company</Th>
            <Th>Experience</Th>
            <Th>Date</Th>
            <Th>Pax</Th>
            <Th>Budget</Th>
            <Th>Status</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#eee5da]">
          {data.map((r) => (
            <tr key={r.id}>
              <Td>{r.companyName}</Td>
              <Td
                className="truncate max-w-[14ch]"
                title={r.experienceName || "—"}
              >
                {r.experienceName || "—"}
              </Td>
              <Td>{fmtDate(r.startTime)}</Td>
              <Td>{(r.adults || 0) + (r.kids || 0)}</Td>
              <Td>{formatCurrency((r.budgetCents || 0) / 100)}</Td>
              <Td>
                <Badge
                  tone={
                    r.status === "approved"
                      ? "green"
                      : r.status === "rejected"
                      ? "red"
                      : "amber"
                  }
                >
                  {capitalize(r.status || "pending")}
                </Badge>
              </Td>
              <Td className="text-right">
                <div className="inline-flex gap-1">
                  <SmallBtn
                    onClick={() => onApprove(r)}
                    disabled={r.status !== "pending"}
                  >
                    <Check className="h-3.5 w-3.5" /> Approve
                  </SmallBtn>
                  <SmallBtn
                    onClick={() => onReject(r)}
                    disabled={r.status !== "pending"}
                  >
                    <X className="h-3.5 w-3.5" /> Reject
                  </SmallBtn>
                  <SmallBtn
                    onClick={() => onConvert(r)}
                    disabled={r.status !== "approved"}
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" /> Convert
                  </SmallBtn>
                </div>
              </Td>
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <Td colSpan={7} className="py-8 text-center text-[#7a6a5f]">
                No requests.
              </Td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}

function CompaniesPanel({ data, onToggleActive, onExport }) {
  return (
    <Card>
      <HeaderRow title="Companies" right={<ExportBtn onClick={onExport} />} />
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[#7a6a5f]">
            <Th>Company</Th>
            <Th>VAT</Th>
            <Th>Contact</Th>
            <Th>Email</Th>
            <Th>Phone</Th>
            <Th>Credit</Th>
            <Th>Status</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#eee5da]">
          {data.map((c) => (
            <tr key={c.id}>
              <Td>{c.name}</Td>
              <Td>{c.vat || "—"}</Td>
              <Td>{c.contactName || "—"}</Td>
              <Td className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" /> {c.email || "—"}
              </Td>
              <Td className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" /> {c.phone || "—"}
              </Td>
              <Td>{formatCurrency((c.creditCents || 0) / 100)}</Td>
              <Td>
                <Badge tone={c.isActive ? "green" : "red"}>
                  {c.isActive ? "Active" : "Disabled"}
                </Badge>
              </Td>
              <Td className="text-right">
                <div className="inline-flex gap-1">
                  <SmallBtn onClick={() => onToggleActive(c)}>
                    {c.isActive ? "Disable" : "Enable"}
                  </SmallBtn>
                </div>
              </Td>
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <Td colSpan={8} className="py-8 text-center text-[#7a6a5f]">
                No companies.
              </Td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}

function InvoicesPanel({ data, onMarkPaid, onExport }) {
  return (
    <Card>
      <HeaderRow title="Invoices" right={<ExportBtn onClick={onExport} />} />
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[#7a6a5f]">
            <Th>#</Th>
            <Th>Company</Th>
            <Th>Issued</Th>
            <Th>Due</Th>
            <Th>Amount</Th>
            <Th>Status</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#eee5da]">
          {data.map((inv) => (
            <tr key={inv.id}>
              <Td>{inv.number}</Td>
              <Td>{inv.companyName}</Td>
              <Td>{fmtDate(inv.issuedAt)}</Td>
              <Td>{fmtDate(inv.dueAt)}</Td>
              <Td>{formatCurrency((inv.amountCents || 0) / 100)}</Td>
              <Td>
                <Badge
                  tone={
                    inv.status === "paid"
                      ? "green"
                      : inv.status === "void"
                      ? "red"
                      : "amber"
                  }
                >
                  {capitalize(inv.status)}
                </Badge>
              </Td>
              <Td className="text-right">
                <div className="inline-flex gap-1">
                  <SmallBtn as="a" href={inv.pdfUrl || "#"} target="_blank">
                    <FileText className="h-3.5 w-3.5" /> PDF
                  </SmallBtn>
                  <SmallBtn
                    onClick={() => onMarkPaid(inv)}
                    disabled={inv.status !== "issued"}
                  >
                    <CreditCard className="h-3.5 w-3.5" /> Mark paid
                  </SmallBtn>
                </div>
              </Td>
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <Td colSpan={7} className="py-8 text-center text-[#7a6a5f]">
                No invoices.
              </Td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}

function SettingsPanel() {
  return (
    <Card>
      <HeaderRow title="Settings" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Default corporate discount (%)">
          <input
            type="number"
            min={0}
            max={100}
            defaultValue={10}
            className="input"
          />
        </Field>
        <Field label="Payment terms">
          <select defaultValue="net30" className="input">
            <option value="prepaid">Prepaid</option>
            <option value="net15">Net 15</option>
            <option value="net30">Net 30</option>
            <option value="net45">Net 45</option>
          </select>
        </Field>
        <Field label="Invoice series prefix">
          <input type="text" defaultValue="CORP" className="input" />
        </Field>
        <Field label="Require PO number on requests">
          <input type="checkbox" defaultChecked className="h-4 w-4" />
        </Field>
      </div>
      <div className="mt-4">
        <button className="btn-primary">Save settings</button>
      </div>
    </Card>
  );
}

/* -------------------------------- Modals --------------------------------- */
function CompanyModal({ onClose, onCreate }) {
  const [form, setForm] = useState({
    name: "",
    vat: "",
    email: "",
    phone: "",
    contactName: "",
  });
  return (
    <Modal title="New Company" onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Company name">
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label="VAT / Tax ID">
          <input
            className="input"
            value={form.vat}
            onChange={(e) => setForm({ ...form, vat: e.target.value })}
          />
        </Field>
        <Field label="Contact name">
          <input
            className="input"
            value={form.contactName}
            onChange={(e) => setForm({ ...form, contactName: e.target.value })}
          />
        </Field>
        <Field label="Email">
          <input
            className="input"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field label="Phone">
          <input
            className="input"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </Field>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" onClick={() => onCreate(form)}>
          <Plus className="h-4 w-4" /> Create
        </button>
      </div>
    </Modal>
  );
}

function RequestModal({ onClose, onCreate, companies }) {
  const [form, setForm] = useState({
    companyId: "",
    experienceId: "",
    startTime: "",
    adults: 10,
    kids: 0,
    budgetCents: 0,
    poNumber: "",
    notes: "",
  });
  return (
    <Modal title="New Corporate Request" onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Company">
          <select
            className="input"
            value={form.companyId}
            onChange={(e) => setForm({ ...form, companyId: e.target.value })}
          >
            <option value="">Select company…</option>
            {companies.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Experience ID">
          <input
            className="input"
            value={form.experienceId}
            onChange={(e) => setForm({ ...form, experienceId: e.target.value })}
            placeholder="e.g. 17"
          />
        </Field>
        <Field label="Start time">
          <input
            className="input"
            type="datetime-local"
            value={form.startTime}
            onChange={(e) => setForm({ ...form, startTime: e.target.value })}
          />
        </Field>
        <Field label="Adults">
          <input
            className="input"
            type="number"
            min={0}
            value={form.adults}
            onChange={(e) =>
              setForm({ ...form, adults: Number(e.target.value) })
            }
          />
        </Field>
        <Field label="Kids">
          <input
            className="input"
            type="number"
            min={0}
            value={form.kids}
            onChange={(e) => setForm({ ...form, kids: Number(e.target.value) })}
          />
        </Field>
        <Field label="Budget (EUR)">
          <input
            className="input"
            type="number"
            min={0}
            value={form.budgetCents / 100}
            onChange={(e) =>
              setForm({
                ...form,
                budgetCents: Math.round(Number(e.target.value) * 100),
              })
            }
          />
        </Field>
        <Field label="PO number (optional)">
          <input
            className="input"
            value={form.poNumber}
            onChange={(e) => setForm({ ...form, poNumber: e.target.value })}
          />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <textarea
            className="input h-24"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" onClick={() => onCreate(form)}>
          <Plus className="h-4 w-4" /> Create
        </button>
      </div>
    </Modal>
  );
}

/* ------------------------------ UI primitives ----------------------------- */
function Card({ children }) {
  return (
    <div className="rounded-2xl bg-white/80 backdrop-blur border border-[#e0dcd4] shadow-xl p-5">
      {children}
    </div>
  );
}
function HeaderRow({ title, right }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="flex items-center gap-2">{right}</div>
    </div>
  );
}
function Th({ children, className = "" }) {
  return (
    <th className={`py-2 text-xs uppercase tracking-wide ${className}`}>
      {children}
    </th>
  );
}
function Td({ children, className = "", colSpan }) {
  return (
    <td className={`py-2 align-middle ${className}`} colSpan={colSpan}>
      {children}
    </td>
  );
}
function Badge({ children, tone = "amber" }) {
  const map = {
    green: "bg-green-50 text-green-700 border-green-200",
    red: "bg-rose-50 text-rose-700 border-rose-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] border ${map[tone]}`}
    >
      {children}
    </span>
  );
}
function SmallBtn({ children, onClick, disabled, as, href, target }) {
  const Comp = as || "button";
  const props = as ? { href, target } : { onClick };
  return (
    <Comp
      {...props}
      onClick={
        disabled
          ? (e) => (e.preventDefault(), e.stopPropagation())
          : props.onClick
      }
      className={`inline-flex items-center gap-1 rounded-full border border-[#d8cfc3] px-2.5 py-1 text-xs ${
        disabled
          ? "opacity-50 cursor-not-allowed pointer-events-none"
          : "hover:bg-[#f1ede7]"
      }`}
    >
      {children}
    </Comp>
  );
}
function ExportBtn({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full border border-[#d8cfc3] px-2.5 py-1 text-xs hover:bg-[#f1ede7]"
    >
      <Download className="h-3.5 w-3.5" /> Export CSV
    </button>
  );
}
function Field({ label, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs text-[#7a6a5f] mb-1">{label}</span>
      {children}
    </label>
  );
}
function Modal({ title, children, onClose }) {
  useEffect(() => {
    function esc(e) {
      if (e.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-4 bg-black/20">
      <div className="w-full sm:max-w-2xl rounded-2xl bg-white border border-[#e0dcd4] shadow-2xl p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button className="btn" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Skeleton() {
  return (
    <div className="min-h-screen bg-[#f4f1ec] animate-pulse" aria-busy>
      <div className="mx-auto px-6 py-10 max-w-6xl">
        <div className="h-6 w-40 bg-[#e8e2d9] rounded mb-4" />
        <div className="h-10 w-72 bg-[#e8e2d9] rounded mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 bg-[#e8e2d9] rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- utils ---------------------------------- */
async function safeJson(p) {
  const res = await p;
  if (!res.ok) return null;
  return res.json();
}
async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  return res.ok;
}
function formatCurrency(n) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return "€" + Math.round(n).toLocaleString();
  }
}
function fmtDate(isoLike) {
  if (!isoLike) return "—";
  const d = new Date(isoLike);
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function capitalize(s) {
  return (s || "").charAt(0).toUpperCase() + (s || "").slice(1);
}

function filterCompanies(xs, q) {
  const qq = q.toLowerCase();
  return xs.filter((x) =>
    (x.name + " " + (x.vat || "") + " " + (x.email || ""))
      .toLowerCase()
      .includes(qq)
  );
}
function filterRequests(xs, q) {
  const qq = q.toLowerCase();
  return xs.filter((x) =>
    (x.companyName + " " + (x.experienceName || "") + " " + (x.status || ""))
      .toLowerCase()
      .includes(qq)
  );
}
function filterInvoices(xs, q) {
  const qq = q.toLowerCase();
  return xs.filter((x) =>
    (String(x.number) + " " + (x.companyName || "") + " " + (x.status || ""))
      .toLowerCase()
      .includes(qq)
  );
}

function exportCsv(rows, filename) {
  if (!rows?.length) return;
  const headers = Object.keys(rows[0]);
  const esc = (v) => {
    if (v == null) return "";
    const s = String(v).replaceAll('"', '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => esc(r[h])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function TabBtn({ active = false, onClick, children, disabled = false }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-disabled={disabled}
      onClick={disabled ? undefined : onClick}
      tabIndex={disabled ? -1 : 0}
      className={
        "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm border transition " +
        (disabled
          ? "opacity-50 cursor-not-allowed border-[#e5ddd2] bg-white/70 text-[#9a8d82]"
          : active
          ? "bg-[#8b6f47] text-white border-[#8b6f47] shadow-sm"
          : "bg-white/70 text-[#5a4a3f] border-[#d8cfc3] hover:bg-[#f1ede7] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/40")
      }
    >
      {children}
    </button>
  );
}

/* -------------------------------- tailwind -------------------------------- */
// Reusable Tailwind utility classes
const inputBase =
  "w-full rounded-xl border border-[#d8cfc3] bg-white/80 backdrop-blur px-3 py-2 text-sm placeholder:text-[#a09084] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/40";
// Attach on window so class short-hands can be used in JSX (optional)
if (typeof window !== "undefined") {
  const style = document.createElement("style");
  style.innerHTML = `
    .input { ${twCss(inputBase)} }
    .btn { @apply inline-flex items-center gap-1.5 rounded-full border border-[#d8cfc3] px-3 py-1.5 text-sm hover:bg-[#f1ede7]; }
    .btn-primary { @apply inline-flex items-center gap-1.5 rounded-full border border-[#d8cfc3] bg-[#8b6f47] text-white px-3 py-1.5 text-sm shadow-sm hover:brightness-110; }
  `;
  document.head.appendChild(style);
}
function twCss(s) {
  return s.replaceAll("\n", " ");
}
