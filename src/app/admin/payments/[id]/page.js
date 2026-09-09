"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";

import Icon from "../../_ui/Icon";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ErrorNote,
  Field,
  Input,
  Page,
  PageHeader,
  Select,
  Skeleton,
  StatusBadge,
  Table,
  Td,
  Th,
  Tr,
} from "../../_ui";

/* -------------------------------- helpers -------------------------------- */

const money = (cents, ccy = "EUR") =>
  new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: (ccy || "EUR").toUpperCase(),
  }).format((Number(cents) || 0) / 100);

const stamp = (unixSeconds) =>
  unixSeconds
    ? new Date(unixSeconds * 1000).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const CANCELLABLE = [
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
  "requires_capture",
];

/* --------------------------------- page ---------------------------------- */

export default function PaymentDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [busy, setBusy] = useState("");
  const [todayLocked, setTodayLocked] = useState(false);

  // refund panel
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundError, setRefundError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/payments/${id}`, {
        cache: "no-store",
        credentials: "include",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || `Failed to load payment (${res.status})`);
      setItem(j?.item || j);
    } catch (e) {
      setError(e?.message || "Failed to load payment");
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  useEffect(() => {
    (async () => {
      try {
        const d = new Date().toISOString().slice(0, 10);
        const res = await fetch(`/api/admin/reports/daily?date=${d}`, { cache: "no-store" });
        if (!res.ok) return;
        const j = await res.json();
        setTodayLocked(Boolean(j?.locked));
      } catch {
        /* non-critical */
      }
    })();
  }, [refreshKey]);

  const agg = item?.aggregates || {};
  const currency = agg.currency || (item?.currency || "EUR").toUpperCase();
  const available = agg.available_to_refund_cents ?? 0;
  const refundedTotal = agg.refunds_total_cents ?? 0;

  const displayStatus = useMemo(() => {
    if (!item) return "";
    const received = agg.amount_received_cents ?? item.amount_received ?? 0;
    if (received > 0 && refundedTotal >= received) return "refunded";
    if (refundedTotal > 0) return "partially_refunded";
    return item.status;
  }, [item, agg, refundedTotal]);

  useEffect(() => {
    if (refundOpen) setRefundAmount((available / 100).toFixed(2));
  }, [refundOpen, available]);

  /* ------------------------------- actions -------------------------------- */

  async function act(kind, url, body, successMessage) {
    setBusy(kind);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        credentials: "include",
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || `${kind} failed`);
      toast.success(typeof successMessage === "function" ? successMessage(j) : successMessage);
      setRefundOpen(false);
      setRefreshKey((k) => k + 1);
      return true;
    } catch (e) {
      toast.error(e?.message || `${kind} failed`);
      if (kind === "refund") setRefundError(e?.message || "Refund failed");
      return false;
    } finally {
      setBusy("");
    }
  }

  function submitRefund() {
    const cents = Math.round(Number(refundAmount) * 100);
    if (!cents || cents <= 0) return setRefundError("Enter an amount greater than zero.");
    if (cents > available)
      return setRefundError(`Only ${money(available, currency)} is still refundable.`);
    setRefundError("");
    act(
      "refund",
      `/api/admin/payments/${id}/refund`,
      { amount_cents: cents, reason: refundReason || "requested_by_customer" },
      `Refunded ${money(cents, currency)}`
    );
  }

  /* --------------------------------- view --------------------------------- */

  if (loading && !item) {
    return (
      <Page>
        <Skeleton className="mb-5 h-16" />
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </Page>
    );
  }

  if (error && !item) {
    return (
      <Page>
        <PageHeader eyebrow="Revenue" title="Payment" />
        <ErrorNote>{error}</ErrorNote>
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" onClick={() => setRefreshKey((k) => k + 1)}>
            Try again
          </Button>
          <Button as={Link} href="/admin/payments" variant="ghost">
            Back to payments
          </Button>
        </div>
      </Page>
    );
  }

  const canCapture = item.status === "requires_capture";
  const canCancel = CANCELLABLE.includes(item.status);
  const canRefund = available > 0 && !todayLocked;

  return (
    <Page>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <Link href="/admin/payments" className="hover:underline">
              Payments
            </Link>
            <span className="text-[#c9bfb3]">/</span>
            <span className="font-mono text-[10px] normal-case tracking-normal">{item.id}</span>
          </span>
        }
        title={money(agg.amount_received_cents ?? item.amount_received ?? item.amount, currency)}
        description={`${stamp(item.created)} · ${
          item.card_brand ? `${item.card_brand} •••• ${item.card_last4 || ""}` : item.method || "card"
        }`}
        actions={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                navigator.clipboard?.writeText(item.id);
                toast.success("Payment intent copied");
              }}
            >
              <Icon name="file" size={15} /> Copy ID
            </Button>
            {item.receipt_url ? (
              <Button as="a" href={item.receipt_url} target="_blank" rel="noreferrer" variant="secondary">
                <Icon name="external" size={15} /> Receipt
              </Button>
            ) : null}
            {item.links?.dashboard_pi ? (
              <Button
                as="a"
                href={item.links.dashboard_pi}
                target="_blank"
                rel="noreferrer"
                variant="secondary"
              >
                <Icon name="external" size={15} /> Stripe
              </Button>
            ) : null}
          </>
        }
      />

      <div className="-mt-2 mb-5 flex flex-wrap items-center gap-2">
        <StatusBadge status={displayStatus} />
        {!item.livemode ? <Badge variant="warning">Test mode</Badge> : null}
        {item.booking_id ? (
          <Link
            href={`/admin/bookings/${item.booking_id}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#f3ece1] px-2.5 py-0.5 text-[11px] font-semibold text-[#8b6f47] ring-1 ring-inset ring-[#e7dcc9] hover:bg-[#ece0cd]"
          >
            <Icon name="calendar" size={12} /> Booking #{item.booking_id}
          </Link>
        ) : null}
      </div>

      {todayLocked ? (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-[#f0e0bb] bg-[#fbf1dc] px-4 py-3">
          <Icon name="lock" size={17} className="text-[#8a6412]" />
          <span className="text-[13px] font-semibold text-[#8a6412]">
            Today’s Z-report is locked — refunds and captures are disabled until it is reopened.
          </span>
          <Button as={Link} href="/admin/reports/daily" size="sm" variant="secondary" className="ml-auto">
            Open Z-report
          </Button>
        </div>
      ) : null}

      {/* aggregates */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Authorised", money(agg.amount_intended_cents ?? item.amount, currency), false],
          ["Received", money(agg.amount_received_cents ?? item.amount_received, currency), false],
          ["Refunded", refundedTotal ? `−${money(refundedTotal, currency)}` : money(0, currency), refundedTotal > 0],
          ["Refundable", money(available, currency), false],
        ].map(([label, value, danger]) => (
          <Card key={label} className="py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9a8c7e]">{label}</p>
            <p className={`mt-1 font-serif text-[20px] ${danger ? "text-[#a33c22]" : "text-[#2a211a]"}`}>
              {value}
            </p>
          </Card>
        ))}
      </div>

      {/* actions */}
      <Card className="mb-5">
        <CardHeader
          title="Actions"
          description="Operations run directly against Stripe and take effect immediately."
        />
        <div className="flex flex-wrap gap-2">
          {canCapture ? (
            <Button
              variant="primary"
              disabled={!!busy || todayLocked}
              onClick={() =>
                act("capture", `/api/admin/payments/${id}/capture`, null, "Payment captured")
              }
            >
              <Icon name="check" size={15} />
              {busy === "capture" ? "Capturing…" : "Capture payment"}
            </Button>
          ) : null}

          <Button
            variant="secondary"
            disabled={!canRefund || !!busy}
            onClick={() => {
              setRefundError("");
              setRefundOpen((v) => !v);
            }}
            title={
              todayLocked
                ? "Z-report is locked"
                : available > 0
                  ? "Refund this payment"
                  : "Nothing left to refund"
            }
          >
            <Icon name="tag" size={15} /> Refund
          </Button>

          <Button
            variant="secondary"
            disabled={!!busy || !item.latest_charge}
            onClick={() =>
              act(
                "receipt",
                `/api/admin/payments/${id}/resend-receipt`,
                null,
                (j) => `Receipt sent to ${j?.sentTo || "the guest"}`
              )
            }
            title={item.latest_charge ? "Resend the Stripe receipt" : "No charge to send a receipt for"}
          >
            <Icon name="inbox" size={15} />
            {busy === "receipt" ? "Sending…" : "Resend receipt"}
          </Button>

          {canCancel ? (
            <Button
              variant="danger"
              disabled={!!busy}
              onClick={() => {
                if (!confirm("Cancel this payment? The authorisation hold will be released.")) return;
                act("cancel", `/api/admin/payments/${id}/cancel`, null, "Payment canceled");
              }}
            >
              <Icon name="x" size={15} />
              {busy === "cancel" ? "Canceling…" : "Cancel payment"}
            </Button>
          ) : null}

          <Button variant="ghost" onClick={() => setRefreshKey((k) => k + 1)} disabled={!!busy}>
            <Icon name="clock" size={15} /> Refresh
          </Button>
        </div>

        {refundOpen ? (
          <div className="mt-4 rounded-2xl border border-[#e6e0d6] bg-[#fdfbf7] p-4">
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-[#9a8c7e]">
              Refund up to {money(available, currency)}
            </p>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)_auto] sm:items-end">
              <Field label={`Amount (${currency})`}>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max={(available / 100).toFixed(2)}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                />
              </Field>
              <Field label="Reason">
                <Select value={refundReason} onChange={(e) => setRefundReason(e.target.value)}>
                  <option value="">Requested by customer</option>
                  <option value="duplicate">Duplicate</option>
                  <option value="fraudulent">Fraudulent</option>
                </Select>
              </Field>
              <Button variant="danger" onClick={submitRefund} disabled={busy === "refund"}>
                {busy === "refund"
                  ? "Refunding…"
                  : `Refund ${money(Math.round(Number(refundAmount || 0) * 100), currency)}`}
              </Button>
            </div>
            <div className="mt-2 flex gap-2">
              {[
                ["25%", 0.25],
                ["50%", 0.5],
                ["Full", 1],
              ].map(([label, f]) => (
                <button
                  key={label}
                  onClick={() => setRefundAmount(((available * f) / 100).toFixed(2))}
                  className="rounded-full bg-[#f2ede4] px-3 py-1 text-[12px] font-medium text-[#6b5c4d] hover:bg-[#e8e0d3]"
                >
                  {label}
                </button>
              ))}
            </div>
            {refundError ? <ErrorNote className="mt-3">{refundError}</ErrorNote> : null}
          </div>
        ) : null}
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          {/* refunds */}
          <Card padded={false}>
            <div className="px-5 pt-5">
              <CardHeader
                title="Refunds"
                description={
                  item.refunds?.length
                    ? `${item.refunds.length} refund${item.refunds.length === 1 ? "" : "s"} totalling ${money(refundedTotal, currency)}`
                    : "No refunds have been issued on this payment."
                }
              />
            </div>
            {item.refunds?.length ? (
              <Table>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th className="text-right">Amount</Th>
                    <Th>Reason</Th>
                    <Th>Issued by</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {item.refunds.map((r) => (
                    <Tr key={r.id}>
                      <Td className="whitespace-nowrap text-[#7a6a5f]">{stamp(r.created)}</Td>
                      <Td className="whitespace-nowrap text-right font-semibold text-[#a33c22]">
                        −{money(r.amount, r.currency || currency)}
                      </Td>
                      <Td className="text-[#7a6a5f]">{(r.reason || "—").replace(/_/g, " ")}</Td>
                      <Td className="text-[#7a6a5f]">
                        {r.performed_by_name || r.performed_by_email || (
                          <span className="text-[#b0a294]">system</span>
                        )}
                      </Td>
                      <Td>
                        <StatusBadge status={r.status} />
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <div className="px-5 pb-5" />
            )}
          </Card>

          {/* charges */}
          {item.charges?.data?.length ? (
            <Card padded={false}>
              <div className="px-5 pt-5">
                <CardHeader title="Charges" description="Every charge attached to this payment intent." />
              </div>
              <Table>
                <thead>
                  <tr>
                    <Th>Charge</Th>
                    <Th>Date</Th>
                    <Th className="text-right">Captured</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Receipt</Th>
                  </tr>
                </thead>
                <tbody>
                  {item.charges.data.map((c) => (
                    <Tr key={c.id}>
                      <Td className="font-mono text-[11.5px] text-[#7a6a5f]">{c.id}</Td>
                      <Td className="whitespace-nowrap text-[#7a6a5f]">{stamp(c.created)}</Td>
                      <Td className="whitespace-nowrap text-right font-semibold">
                        {money(c.amount_captured, c.currency || currency)}
                      </Td>
                      <Td>
                        <StatusBadge status={c.status} />
                      </Td>
                      <Td className="text-right">
                        {c.receipt_url ? (
                          <a
                            href={c.receipt_url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-[#8b6f47] hover:underline"
                          >
                            Open
                          </a>
                        ) : (
                          <span className="text-[#b0a294]">—</span>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          ) : null}
        </div>

        {/* sidebar */}
        <div className="space-y-5">
          <Card>
            <CardHeader title="Customer" />
            <dl className="space-y-2.5 text-[13px]">
              <Row label="Name" value={item.customer?.name} />
              <Row label="Email" value={item.customer?.email} />
              <Row label="Method" value={
                item.card_brand ? `${item.card_brand} •••• ${item.card_last4 || ""}` : item.method
              } />
              {item.booking_id ? (
                <div className="pt-2">
                  <Button as={Link} href={`/admin/bookings/${item.booking_id}`} size="sm" variant="secondary" className="w-full">
                    <Icon name="calendar" size={14} /> Open booking #{item.booking_id}
                  </Button>
                </div>
              ) : null}
            </dl>
          </Card>

          {item.metadata && Object.keys(item.metadata).length ? (
            <Card>
              <CardHeader title="Stripe metadata" />
              <dl className="space-y-2 text-[12.5px]">
                {Object.entries(item.metadata).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="shrink-0 text-[#9a8c7e]">{k}</dt>
                    <dd className="truncate text-right font-medium text-[#2a211a]">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="References" />
            <dl className="space-y-2.5 text-[13px]">
              <Row label="Payment intent" value={item.id} mono />
              <Row label="Latest charge" value={item.latest_charge} mono />
              <Row label="Created" value={stamp(item.created)} />
            </dl>
          </Card>
        </div>
      </div>

      <div className="mt-6">
        <Button variant="ghost" onClick={() => router.push("/admin/payments")}>
          ← Back to payments
        </Button>
      </div>
    </Page>
  );
}

function Row({ label, value, mono }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-[#9a8c7e]">{label}</dt>
      <dd className={`truncate text-right font-medium text-[#2a211a] ${mono ? "font-mono text-[11.5px]" : ""}`}>
        {value || <span className="text-[#b0a294]">—</span>}
      </dd>
    </div>
  );
}
