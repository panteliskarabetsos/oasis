"use client";

// Full order page: what was bought, what happened to it, and the controls to
// move it along or give the money back. Replaces the read-mostly drawer.
import React from "react";
import Link from "next/link";

import Icon from "@/app/admin/_ui/Icon";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ErrorNote,
  Muted,
  Page,
  PageHeader,
  Select,
  Skeleton,
  StatusBadge,
  Table,
  Td,
  Th,
  Tr,
  inputClass,
} from "@/app/admin/_ui";

const STATUS_FLOW = ["pending", "paid", "fulfilled", "cancelled"];

function money(cents, currency = "EUR") {
  const v = (Number(cents) || 0) / 100;
  try {
    return new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(v);
  } catch {
    return `${v.toFixed(2)} ${currency}`;
  }
}

function when(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function orderRef(id) {
  return `S-${String(Number(id) || 0).padStart(6, "0")}`;
}

const EVENT_ICON = {
  note: "file",
  email: "mail",
  status: "check",
  refund: "euro",
  fulfilment: "inbox",
  payment: "card",
  system: "clock",
};

function addressLines(a) {
  if (!a || typeof a !== "object") return [];
  return [
    a.name,
    a.line1,
    a.line2,
    [a.postalCode, a.city].filter(Boolean).join(" "),
    a.region,
    a.country,
  ].filter(Boolean);
}

export default function OrderDetail({ orderId }) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState("");

  const [note, setNote] = React.useState("");
  const [tracking, setTracking] = React.useState("");
  const [trackingUrl, setTrackingUrl] = React.useState("");

  const [refundAmount, setRefundAmount] = React.useState("");
  const [refundReason, setRefundReason] = React.useState("requested_by_customer");
  const [refundNote, setRefundNote] = React.useState("");

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/shop/orders/${orderId}`, { cache: "no-store" });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Could not load this order");
      setData(d);
      setTracking(d.order?.tracking_number || "");
      setTrackingUrl(d.order?.tracking_url || "");
      setError("");
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const order = data?.order;
  const items = data?.items ?? [];
  const products = data?.products ?? {};
  const payment = data?.payment;
  const currency = order?.currency || "EUR";

  const subtotal = items.reduce(
    (n, l) => n + Number(l.unit_price_cents || 0) * Number(l.quantity || 0),
    0
  );
  const refunded = Number(data?.refundedCents || 0);
  const received = Number(payment?.amountReceivedCents || 0);
  const remaining = Math.max(0, received - refunded);

  async function setStatus(status) {
    if (status === "cancelled" && !confirm("Cancel this order?")) return;
    setBusy("status");
    try {
      const res = await fetch(`/api/admin/shop/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Could not update the status");
      await load();
    } catch (e) {
      alert(String(e.message || e));
    } finally {
      setBusy("");
    }
  }

  async function resend(kind, label) {
    if (!confirm(`Send the ${label.toLowerCase()} again?`)) return;
    setBusy(`resend-${kind}`);
    try {
      const res = await fetch(`/api/admin/shop/orders/${orderId}/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "The email could not be sent");
      await load();
      alert(`Sent to ${d.to}.`);
    } catch (e) {
      alert(String(e.message || e));
    } finally {
      setBusy("");
    }
  }

  async function addNote() {
    const message = note.trim();
    if (!message) return;
    setBusy("note");
    try {
      const res = await fetch(`/api/admin/shop/orders/${orderId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Could not add that note");
      setNote("");
      await load();
    } catch (e) {
      alert(String(e.message || e));
    } finally {
      setBusy("");
    }
  }

  async function saveTracking() {
    setBusy("tracking");
    try {
      const res = await fetch(`/api/admin/shop/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracking_number: tracking, tracking_url: trackingUrl }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Could not save the tracking details");
      await load();
    } catch (e) {
      alert(String(e.message || e));
    } finally {
      setBusy("");
    }
  }

  async function issueRefund() {
    const cents =
      refundAmount.trim() === ""
        ? remaining
        : Math.round(Number(refundAmount.replace(",", ".")) * 100);
    if (!Number.isInteger(cents) || cents <= 0) {
      alert("Enter a refund amount greater than zero.");
      return;
    }
    if (cents > remaining) {
      alert(`Only ${money(remaining, currency)} is still refundable on this order.`);
      return;
    }
    if (
      !confirm(
        `Refund ${money(cents, currency)} to the customer?\n\nThis moves real money and cannot be undone from here.`
      )
    ) {
      return;
    }
    setBusy("refund");
    try {
      const res = await fetch(`/api/admin/shop/orders/${orderId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount_cents: cents,
          reason: refundReason,
          note: refundNote.trim() || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "The refund did not go through");
      setRefundAmount("");
      setRefundNote("");
      await load();
    } catch (e) {
      alert(String(e.message || e));
    } finally {
      setBusy("");
    }
  }

  if (loading) {
    return (
      <Page className="py-8">
        <Skeleton className="h-9 w-52" />
        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <Skeleton className="h-56" />
            <Skeleton className="h-72" />
          </div>
          <div className="space-y-5">
            <Skeleton className="h-36" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </Page>
    );
  }

  if (error || !order) {
    return (
      <Page className="py-8">
        <PageHeader eyebrow="E-shop" title="Order" />
        <ErrorNote>{error || "Order not found."}</ErrorNote>
        <Button as={Link} href="/admin/eshop?tab=orders" variant="secondary" className="mt-4">
          Back to orders
        </Button>
      </Page>
    );
  }

  const billing = order.billing_address || {};
  const shipping = order.shipping_address || {};

  return (
    <Page className="py-8">
      <PageHeader
        eyebrow="E-shop · order"
        title={orderRef(order.id)}
        description={`${billing.name || "Guest"} · placed ${when(order.placed_at || order.created_at)}`}
        actions={
          <>
            <Button as={Link} href="/admin/eshop?tab=orders" variant="ghost">
              Back
            </Button>
            <StatusBadge status={order.status} />
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="space-y-5">
          {/* ------------------------------ items ------------------------------ */}
          <Card padded={false} className="overflow-hidden">
            <div className="p-5 pb-0">
              <CardHeader title="What was ordered" />
            </div>
            <Table>
              <thead>
                <tr>
                  <Th>Item</Th>
                  <Th className="text-right">Qty</Th>
                  <Th className="text-right">Unit</Th>
                  <Th className="text-right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((line) => {
                  const product = products[line.product_id];
                  return (
                    <Tr key={line.id}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-[#e6e0d6] bg-[#faf8f4]">
                            {product?.image ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={product.image}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-[#2a211a]">
                              {line.title_snapshot}
                            </p>
                            {product ? (
                              <Link
                                href={`/admin/eshop/product/${product.id}`}
                                className="text-[11.5px] text-[#8b6f47] hover:underline"
                              >
                                {product.title}
                                {product.active ? "" : " (hidden)"}
                              </Link>
                            ) : (
                              <span className="text-[11.5px] text-[#9a8c7e]">
                                Product removed
                              </span>
                            )}
                          </div>
                        </div>
                      </Td>
                      <Td className="text-right">{line.quantity}</Td>
                      <Td className="whitespace-nowrap text-right">
                        {money(line.unit_price_cents, line.currency || currency)}
                      </Td>
                      <Td className="whitespace-nowrap text-right font-semibold">
                        {money(line.unit_price_cents * line.quantity, currency)}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>

            <div className="space-y-1.5 border-t border-[#e6e0d6] px-5 py-4 text-[13px]">
              <div className="flex justify-between">
                <span className="text-[#7a6a5f]">Line total</span>
                <span>{money(subtotal, currency)}</span>
              </div>
              {order.shipping_cents != null ? (
                <div className="flex justify-between">
                  <span className="text-[#7a6a5f]">
                    {order.shipping_method === "pickup" ? "Collection" : "Delivery"}
                  </span>
                  <span>
                    {Number(order.shipping_cents) === 0
                      ? "Free"
                      : money(order.shipping_cents, currency)}
                  </span>
                </div>
              ) : null}
              {subtotal !== Number(order.total_cents) ? (
                <div className="flex justify-between">
                  <span className="text-[#7a6a5f]">Order total</span>
                  <span>{money(order.total_cents, currency)}</span>
                </div>
              ) : null}
              {refunded > 0 ? (
                <div className="flex justify-between text-[#a33c22]">
                  <span>Refunded</span>
                  <span>−{money(refunded, currency)}</span>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-[#f0ebe2] pt-2 font-serif text-[17px] text-[#2a211a]">
                <span>Net</span>
                <span>{money(Number(order.total_cents) - refunded, currency)}</span>
              </div>
            </div>
          </Card>

          {/* ---------------------------- timeline ---------------------------- */}
          <Card>
            <CardHeader
              title="History"
              description="Status changes, refunds and anything the team notes down."
            />

            {data?.eventsAvailable === false ? (
              <ErrorNote className="mb-4">{data?.migrationHint}</ErrorNote>
            ) : null}

            <div className="mb-5">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Add an update — what you did, what the customer asked for…"
                className={`${inputClass} h-auto py-2.5 leading-relaxed`}
              />
              <div className="mt-2 flex justify-end">
                <Button
                  variant="primary"
                  onClick={addNote}
                  disabled={!note.trim() || busy === "note"}
                >
                  {busy === "note" ? "Adding…" : "Add update"}
                </Button>
              </div>
            </div>

            {!data?.events?.length ? (
              <Muted className="text-[12.5px]">Nothing recorded yet.</Muted>
            ) : (
              <ol className="space-y-0">
                {data.events.map((ev, i) => (
                  <li key={ev.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f7f3ec] text-[#b89a6b]">
                        <Icon name={EVENT_ICON[ev.type] || "file"} size={13} />
                      </span>
                      {i < data.events.length - 1 ? (
                        <span className="w-px flex-1 bg-[#eee8de]" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1 pb-5">
                      <p className="text-[13px] text-[#2a211a]">{ev.message}</p>
                      <p className="mt-0.5 text-[11px] text-[#9a8c7e]">
                        {when(ev.created_at)}
                        {ev.created_by_name || ev.created_by_email
                          ? ` · ${ev.created_by_name || ev.created_by_email}`
                          : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        {/* ------------------------------ sidebar ------------------------------ */}
        <div className="space-y-5">
          <Card>
            <CardHeader title="Move it along" />
            <div className="flex flex-wrap gap-2">
              {STATUS_FLOW.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={order.status === s ? "dark" : "secondary"}
                  disabled={order.status === s || busy === "status"}
                  onClick={() => setStatus(s)}
                >
                  {s[0].toUpperCase() + s.slice(1)}
                </Button>
              ))}
            </div>
            {order.status === "refunded" ? (
              <Muted className="mt-3 text-[11.5px]">
                This order was fully refunded.
              </Muted>
            ) : null}
          </Card>

          <Card>
            <CardHeader title="Customer" />
            <div className="space-y-1.5 text-[13px]">
              <p className="font-medium text-[#2a211a]">{billing.name || "Guest"}</p>
              {billing.email ? (
                <a
                  href={`mailto:${billing.email}`}
                  className="flex items-center gap-1.5 text-[#8b6f47] hover:underline"
                >
                  <Icon name="mail" size={13} /> {billing.email}
                </a>
              ) : null}
              {billing.phone ? (
                <a href={`tel:${billing.phone}`} className="block text-[#5c4d40]">
                  {billing.phone}
                </a>
              ) : null}
              {order.user_id ? (
                <Muted className="text-[11px]">Signed-in account</Muted>
              ) : (
                <Muted className="text-[11px]">Guest checkout</Muted>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title={order.shipping_method === "pickup" ? "Collection" : "Delivery"}
              actions={
                order.shipping_method === "pickup" ? (
                  <Badge variant="info">Not to be posted</Badge>
                ) : null
              }
            />
            {addressLines(shipping).length ? (
              <p className="whitespace-pre-line text-[13px] leading-relaxed text-[#3f3127]">
                {addressLines(shipping).join("\n")}
              </p>
            ) : (
              <Muted className="text-[12.5px]">No address on this order.</Muted>
            )}
            {shipping.notes ? (
              <Muted className="mt-2 text-[12px]">“{shipping.notes}”</Muted>
            ) : null}

            <div className="mt-4 space-y-2 border-t border-[#f0ebe2] pt-4">
              <span className="block text-[12px] font-semibold text-[#3f3127]">
                Tracking
              </span>
              <input
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                placeholder="Tracking number"
                aria-label="Tracking number"
                className={inputClass}
              />
              <input
                value={trackingUrl}
                onChange={(e) => setTrackingUrl(e.target.value)}
                placeholder="Tracking link (optional)"
                aria-label="Tracking link"
                className={inputClass}
              />
              <Button
                variant="secondary"
                className="w-full"
                onClick={saveTracking}
                disabled={busy === "tracking"}
              >
                {busy === "tracking" ? "Saving…" : "Save tracking"}
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Emails"
              description="Sent automatically. Send one again if the customer lost it."
            />
            <div className="space-y-2">
              {[
                ["paid", "Order confirmation"],
                ["shipped", "Dispatch notice"],
                ["cancelled", "Cancellation notice"],
                ["staff_new_order", "New order alert (staff)"],
              ].map(([kind, label]) => (
                <Button
                  key={kind}
                  variant="secondary"
                  size="sm"
                  className="w-full justify-start"
                  disabled={busy === `resend-${kind}`}
                  onClick={() => resend(kind, label)}
                >
                  <Icon name="mail" size={13} />
                  {busy === `resend-${kind}` ? "Sending…" : `Resend ${label.toLowerCase()}`}
                </Button>
              ))}
            </div>
            <Muted className="mt-3 text-[11px]">
              Every send is recorded in the history above.
            </Muted>
          </Card>

          <Card>
            <CardHeader title="Payment" />
            {payment?.error ? (
              <Muted className="text-[12.5px]">
                Stripe could not be reached: {payment.error}
              </Muted>
            ) : payment ? (
              <div className="space-y-1.5 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-[#7a6a5f]">Captured</span>
                  <span>{money(payment.amountReceivedCents, payment.currency)}</span>
                </div>
                {refunded > 0 ? (
                  <div className="flex justify-between text-[#a33c22]">
                    <span>Refunded</span>
                    <span>−{money(refunded, payment.currency)}</span>
                  </div>
                ) : null}
                {payment.brand ? (
                  <div className="flex justify-between">
                    <span className="text-[#7a6a5f]">Card</span>
                    <span className="capitalize">
                      {payment.brand} ···· {payment.last4}
                    </span>
                  </div>
                ) : null}
                <p className="pt-1 font-mono text-[11px] text-[#9a8c7e]">{payment.id}</p>
                {payment.receiptUrl ? (
                  <a
                    href={payment.receiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-[12px] text-[#8b6f47] hover:underline"
                  >
                    <Icon name="external" size={12} /> Stripe receipt
                  </a>
                ) : null}
              </div>
            ) : (
              <Muted className="text-[12.5px]">No card payment on this order.</Muted>
            )}
          </Card>

          {data?.canRefund && payment && !payment.error && received > 0 ? (
            <Card>
              <CardHeader
                title="Refund"
                description={`${money(remaining, currency)} still refundable.`}
              />
              {remaining <= 0 ? (
                <Badge variant="neutral">Fully refunded</Badge>
              ) : (
                <div className="space-y-2">
                  <input
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    inputMode="decimal"
                    placeholder={`${(remaining / 100).toFixed(2)} (whole remainder)`}
                    aria-label="Refund amount"
                    className={inputClass}
                  />
                  <Select
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    aria-label="Refund reason"
                  >
                    <option value="requested_by_customer">Requested by customer</option>
                    <option value="duplicate">Duplicate</option>
                    <option value="fraudulent">Fraudulent</option>
                  </Select>
                  <input
                    value={refundNote}
                    onChange={(e) => setRefundNote(e.target.value)}
                    placeholder="Note for the history (optional)"
                    aria-label="Refund note"
                    className={inputClass}
                  />
                  <Button
                    variant="danger"
                    className="w-full"
                    onClick={issueRefund}
                    disabled={busy === "refund"}
                  >
                    {busy === "refund"
                      ? "Refunding…"
                      : `Refund ${money(
                          refundAmount.trim() === ""
                            ? remaining
                            : Math.round(Number(refundAmount.replace(",", ".")) * 100) || 0,
                          currency
                        )}`}
                  </Button>
                  <Muted className="text-[11px]">
                    Money leaves your Stripe balance straight away.
                  </Muted>
                </div>
              )}
            </Card>
          ) : null}
        </div>
      </div>
    </Page>
  );
}
