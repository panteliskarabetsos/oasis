import {
  useEffect as useEffect2,
  useMemo as useMemo2,
  useState as useState2,
} from "react";
import { X, Calendar, Check, ChevronDown } from "lucide-react";

function computeTotals(items) {
  const subtotal = items.reduce(
    (s, it) => s + Number(it.quantity || 0) * Number(it.unitPrice || 0),
    0
  );
  const tax = items.reduce(
    (s, it) =>
      s +
      Number(it.quantity || 0) *
        Number(it.unitPrice || 0) *
        (Number(it.taxRate || 0) / 100),
    0
  );
  const total = subtotal + tax;
  return { subtotal, tax, total };
}

export function InvoiceFormModal({ init, onClose, onCreated }) {
  const [eligible, setEligible] = useState2(init?._eligibleBookings || []);
  const [form, setForm] = useState2({
    number: init?.number || "",
    issueDate: init?.issueDate || new Date().toISOString(),
    dueDate: init?.dueDate || null,
    currency: init?.currency || "EUR",
    status: init?.status || (init?.fromBooking ? "paid" : "draft"),
    customerName: "",
    customerEmail: "",
    customerVat: "",
    billingAddress: "",
    bookingId: init?.bookingId || null,
    items: init?.items || [],
    notes: "",
  });
  const [saving, setSaving] = useState2(false);

  useEffect2(() => {
    if (init?.fromBooking) {
      // fetch details for selected booking to prefill items & customer
      const run = async () => {
        const res = await fetch(
          `/api/admin/invoices/booking/${form.bookingId}`
        );
        const data = await res.json();
        if (data?.prefill) {
          setForm((f) => ({ ...f, ...data.prefill }));
        }
      };
      run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [init?.fromBooking, form.bookingId]);

  const totals = useMemo2(() => computeTotals(form.items || []), [form.items]);

  const updateItem = (idx, patch) => {
    setForm((f) => {
      const items = [...(f.items || [])];
      items[idx] = { ...items[idx], ...patch };
      return { ...f, items };
    });
  };

  const addItem = () => {
    setForm((f) => ({
      ...f,
      items: [
        ...(f.items || []),
        { description: "", quantity: 1, unitPrice: 0, taxRate: 0 },
      ],
    }));
  };

  const removeItem = (idx) => {
    setForm((f) => ({
      ...f,
      items: (f.items || []).filter((_, i) => i !== idx),
    }));
  };

  const save = async () => {
    try {
      setSaving(true);
      const res = await fetch("/api/admin/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create invoice");
      onCreated?.(data);
    } catch (e) {
      console.error(e);
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-semibold">
            {init?.fromBooking ? "Invoice from booking" : "New invoice"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-muted/40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 grid gap-4">
          {init?.fromBooking && (
            <div>
              <label className="text-sm font-medium">Select paid booking</label>
              <select
                value={form.bookingId || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, bookingId: Number(e.target.value) }))
                }
                className="w-full px-3 py-2 rounded-xl border bg-white mt-1"
              >
                {eligible.map((b) => (
                  <option key={b.id} value={b.id}>
                    #{b.id} — {b.experienceName} —{" "}
                    {b.primary_contact?.email || b.primary_contact?.name || ""}{" "}
                    —{" "}
                    {money(
                      b.totalPaidAmount,
                      b.currency?.toUpperCase?.() || "EUR"
                    )}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                The invoice will be marked <strong>paid</strong> and linked to
                the booking.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">
                Invoice number (optional)
              </label>
              <input
                value={form.number || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, number: e.target.value }))
                }
                placeholder="Leave empty to auto-generate"
                className="w-full px-3 py-2 rounded-xl border"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Issue date</label>
                <input
                  type="date"
                  value={(form.issueDate || new Date().toISOString()).slice(
                    0,
                    10
                  )}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      issueDate: new Date(e.target.value).toISOString(),
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl border"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Due date</label>
                <input
                  type="date"
                  value={form.dueDate ? form.dueDate.slice(0, 10) : ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      dueDate: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : null,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl border"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Customer name</label>
              <input
                value={form.customerName || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, customerName: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-xl border"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Customer email</label>
              <input
                value={form.customerEmail || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, customerEmail: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-xl border"
              />
            </div>
            <div>
              <label className="text-sm font-medium">
                VAT / Tax ID (optional)
              </label>
              <input
                value={form.customerVat || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, customerVat: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-xl border"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Billing address</label>
              <input
                value={form.billingAddress || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, billingAddress: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-xl border"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Items</label>
              <button
                onClick={addItem}
                className="text-sm px-3 py-1 rounded-lg border hover:bg-muted/30"
              >
                + Add item
              </button>
            </div>
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-3 py-2 text-left w-[50%]">Description</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Unit</th>
                    <th className="px-3 py-2 text-right">Tax %</th>
                    <th className="px-3 py-2 text-right">Line total</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {(form.items || []).map((it, idx) => {
                    const line =
                      Number(it.quantity || 0) * Number(it.unitPrice || 0);
                    const tax = line * (Number(it.taxRate || 0) / 100);
                    return (
                      <tr key={idx} className="border-t">
                        <td className="px-3 py-2">
                          <input
                            value={it.description || ""}
                            onChange={(e) =>
                              updateItem(idx, { description: e.target.value })
                            }
                            className="w-full px-2 py-1 rounded border"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            value={it.quantity}
                            onChange={(e) =>
                              updateItem(idx, {
                                quantity: Number(e.target.value),
                              })
                            }
                            className="w-24 px-2 py-1 rounded border text-right"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={it.unitPrice}
                            onChange={(e) =>
                              updateItem(idx, {
                                unitPrice: Number(e.target.value),
                              })
                            }
                            className="w-28 px-2 py-1 rounded border text-right"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={it.taxRate}
                            onChange={(e) =>
                              updateItem(idx, {
                                taxRate: Number(e.target.value),
                              })
                            }
                            className="w-24 px-2 py-1 rounded border text-right"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          {money(line + tax, form.currency)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => removeItem(idx)}
                            className="text-rose-600 hover:underline"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-8 mt-3 text-sm">
              <div className="grid text-right">
                <div>Subtotal</div>
                <div>Tax</div>
                <div className="font-medium">Total</div>
              </div>
              <div className="grid text-right">
                <div>{money(totals.subtotal, form.currency)}</div>
                <div>{money(totals.tax, form.currency)}</div>
                <div className="font-medium">
                  {money(totals.total, form.currency)}
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">
              Notes (shown on invoice)
            </label>
            <textarea
              rows={3}
              value={form.notes || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              className="w-full px-3 py-2 rounded-xl border"
            />
          </div>
        </div>
        <div className="px-5 py-4 border-t flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Currency: {form.currency} · Status on save:{" "}
            <strong>{form.status}</strong>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-2 rounded-xl border bg-white hover:bg-muted/30"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 rounded-2xl bg-black text-white inline-flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save
              invoice
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
