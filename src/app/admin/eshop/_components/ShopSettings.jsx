"use client";

// Shop settings: whether the shop is open, what delivery costs, and what the
// shop sends on its own. One save for the lot, with the state of each thing
// shown rather than implied — an earlier version presented a filled-in rate
// table above an off switch and saved "off" without a word.
import React from "react";

import Icon from "@/app/admin/_ui/Icon";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ErrorNote,
  Field,
  Muted,
  Select,
  Skeleton,
  inputClass,
} from "@/app/admin/_ui";
import { ScaledNumberInput } from "@/app/admin/_ui/client";
import { COUNTRY_CODES } from "@/lib/phone";
import { quoteShipping } from "@/lib/shop/shipping";

/* -------------------------------- helpers -------------------------------- */

const toEuro = (cents) => ((Number(cents) || 0) / 100).toFixed(2);
const fromEuro = (v) => Math.round(Number(String(v).replace(",", ".")) * 100) || 0;
const fromKg = (v) => Math.round(Number(String(v).replace(",", ".")) * 1000) || 0;
const money = (cents) => `€${toEuro(cents)}`;

const EMPTY_ZONE = {
  id: "",
  label: "",
  countries: [],
  baseCents: 350,
  baseGrams: 2000,
  extraCentsPerKg: 100,
  maxGrams: 20000,
};

/** A switch that reads as a sentence, not a checkbox. */
function Toggle({ on, onChange, title, onLabel, offLabel, tone = "brand", disabled }) {
  const active = tone === "danger" ? "#a33c22" : tone === "success" ? "#3f6b3f" : "#8b6f47";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#e6e0d6] bg-[#faf8f4] px-3.5 py-3 text-left disabled:opacity-50"
    >
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-[#2a211a]">{title}</span>
        <span className="mt-0.5 block text-[11.5px] text-[#9a8c7e]">
          {on ? onLabel : offLabel}
        </span>
      </span>
      <span
        className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
        style={{ background: on ? active : "#d8cfc2" }}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            on ? "left-[22px]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

/* ================================= page ================================== */

export default function ShopSettings() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [savedAt, setSavedAt] = React.useState(null);

  const [paused, setPaused] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [emails, setEmails] = React.useState(null);
  const [automations, setAutomations] = React.useState({});
  const [shipping, setShipping] = React.useState(null);
  const [baseline, setBaseline] = React.useState(null);

  const [products, setProducts] = React.useState([]);
  const [testKind, setTestKind] = React.useState("paid");
  const [testTo, setTestTo] = React.useState("");
  const [testing, setTesting] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const [sRes, pRes] = await Promise.all([
        fetch("/api/admin/shop/settings", { cache: "no-store" }),
        fetch("/api/admin/shop/products", { cache: "no-store" }),
      ]);
      const data = await sRes.json();
      if (!sRes.ok) throw new Error(data?.error || "Could not load settings");

      const sh = data.shipping || null;
      // A shop that has never configured delivery opens with charging on —
      // that is why you are on this screen — while an unconfigured shop still
      // ships free until it is saved.
      const shipState = sh
        ? { ...sh, enabled: sh.configured === false ? true : sh.enabled !== false }
        : null;

      setPaused(Boolean(data.paused));
      setMessage(data.message || "");
      setEmails(data.emails || null);
      setAutomations(data.automations || {});
      setShipping(shipState);
      setBaseline(
        JSON.stringify({
          paused: Boolean(data.paused),
          message: data.message || "",
          emails: data.emails || null,
          shipping: shipState,
        })
      );
      setProducts(pRes.ok ? await pRes.json().catch(() => []) : []);
      setError("");
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const current = JSON.stringify({ paused, message, emails, shipping });
  const dirty = baseline !== null && current !== baseline;

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/shop/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paused,
          message,
          emails: emails || undefined,
          shipping: shipping || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Could not save");
      setBaseline(current);
      setSavedAt(new Date());
      if (data.warning) setError(data.warning);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    try {
      const res = await fetch("/api/admin/shop/settings/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: testKind, to: testTo.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Could not send");
      alert(`Sent to ${data.to}.\n\nSubject: ${data.subject}`);
    } catch (e) {
      alert(String(e.message || e));
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-40" />
        <Skeleton className="h-72" />
        <Skeleton className="h-56" />
      </div>
    );
  }

  const noWeight = products.filter(
    (p) => p.active && !(Number(p.shipping_weight_grams) > 0)
  );
  const weightsUnknown = products.length > 0 && products[0].shipping_weight_grams === undefined;

  return (
    <div className="space-y-5 pb-24">
      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <StorefrontCard
        paused={paused}
        setPaused={setPaused}
        message={message}
        setMessage={setMessage}
      />

      <DeliveryCard
        value={shipping}
        onChange={setShipping}
        noWeight={noWeight}
        weightsUnknown={weightsUnknown}
      />

      <EmailCard
        emails={emails}
        setEmails={setEmails}
        automations={automations}
        testKind={testKind}
        setTestKind={setTestKind}
        testTo={testTo}
        setTestTo={setTestTo}
        testing={testing}
        onTest={sendTest}
      />

      {/* one save for everything above */}
      {dirty || savedAt ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e6e0d6] bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <Muted className="text-[12px]">
              {dirty
                ? "Unsaved changes"
                : savedAt
                  ? `Saved at ${savedAt.toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`
                  : ""}
            </Muted>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={load} disabled={saving || !dirty}>
                Discard
              </Button>
              <Button variant="primary" onClick={save} disabled={saving || !dirty}>
                {saving ? "Saving…" : "Save settings"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------- storefront ------------------------------- */

function StorefrontCard({ paused, setPaused, message, setMessage }) {
  return (
    <Card>
      <CardHeader
        title="The storefront"
        description="Whether customers can buy right now."
        actions={
          paused ? <Badge variant="warning">Closed</Badge> : <Badge variant="success">Open</Badge>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Toggle
          on={paused}
          onChange={setPaused}
          tone="danger"
          title={paused ? "Checkout is paused" : "Open for business"}
          onLabel="Customers can browse but not buy."
          offLabel="Customers can browse and buy."
        />
        <Field
          label="What to tell customers while paused"
          hint="Shown on the shop and returned if anyone tries to check out."
        >
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Back on Monday — thank you for your patience."
            className={inputClass}
          />
        </Field>
      </div>
    </Card>
  );
}

/* -------------------------------- delivery -------------------------------- */

function DeliveryCard({ value, onChange, noWeight, weightsUnknown }) {
  const [previewKg, setPreviewKg] = React.useState("2.4");
  const [previewCountry, setPreviewCountry] = React.useState("GR");
  const [previewBasket, setPreviewBasket] = React.useState("40.00");

  if (!value) {
    return (
      <Card>
        <CardHeader title="Delivery" />
        <ErrorNote>
          Delivery settings need dump_sql/20260909_shop_emails.sql to be run first.
        </ErrorNote>
      </Card>
    );
  }

  const set = (patch) => onChange({ ...value, ...patch });
  const setZone = (i, patch) =>
    onChange({ ...value, zones: (value.zones || []).map((z, k) => (k === i ? { ...z, ...patch } : z)) });

  const charging = value.enabled !== false;

  // A country listed in two zones is ambiguous — the first zone wins — so the
  // picker greys it out and says which zone already has it.
  const claimedBy = (zoneIndex) => {
    const map = new Map();
    (value.zones || []).forEach((z, k) => {
      if (k === zoneIndex) return;
      for (const c of z.countries || []) map.set(c, z.label || `Zone ${k + 1}`);
    });
    return map;
  };

  // Priced with the very function the storefront and checkout use, so what is
  // shown here is what a customer will actually be charged.
  const preview = quoteShipping({
    lines: [{ quantity: 1, shipping_weight_grams: fromKg(previewKg) }],
    settings: value,
    country: previewCountry,
    subtotalCents: fromEuro(previewBasket),
  });

  return (
    <Card>
      <CardHeader
        title="Delivery"
        description="What a courier costs, per destination and per kilo."
        actions={
          charging ? (
            <Badge variant="success">Charging</Badge>
          ) : (
            <Badge variant="neutral">Everything free</Badge>
          )
        }
      />

      <Toggle
        on={charging}
        onChange={(v) => set({ enabled: v })}
        tone="success"
        title={charging ? "Charging for delivery" : "Delivery is free"}
        onLabel="Customers pay the rates below."
        offLabel="Nothing below is charged — every order ships free."
      />

      {!charging && value.zones?.length ? (
        <ErrorNote className="mt-3">
          These rates are configured but <strong>not being charged</strong>. Switch the
          toggle above on and save.
        </ErrorNote>
      ) : null}

      {charging && noWeight.length && !weightsUnknown ? (
        <ErrorNote className="mt-3">
          {noWeight.length} live product{noWeight.length === 1 ? " has" : "s have"} no shipping
          weight, so {noWeight.length === 1 ? "it is" : "they are"} priced at the base rate
          only — {noWeight.slice(0, 3).map((p) => p.title).join(", ")}
          {noWeight.length > 3 ? ` and ${noWeight.length - 3} more` : ""}.
        </ErrorNote>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Field label="Free over" hint="0 turns the threshold off.">
          <ScaledNumberInput
            value={value.freeOverCents}
            onChange={(freeOverCents) => set({ freeOverCents })}
          />
        </Field>
        <Field
          label="Handling fee"
          hint="Added to every courier order, on top of the zone rate."
          error={
            Number(value.handlingCents) > 1000
              ? `${money(value.handlingCents)} on every order — is that right?`
              : null
          }
        >
          <ScaledNumberInput
            value={value.handlingCents}
            onChange={(handlingCents) => set({ handlingCents })}
          />
        </Field>
        <Field label="Volumetric divisor" hint="5000 is the usual courier figure.">
          <ScaledNumberInput
            value={value.volumetricDivisor ?? 5000}
            scale={1}
            decimals={null}
            onChange={(volumetricDivisor) => set({ volumetricDivisor })}
          />
        </Field>
      </div>

      {/* what a customer would actually pay */}
      <div className="mt-4 rounded-xl border border-[#e6e0d6] bg-[#faf8f4] p-4">
        <span className="mb-2.5 block text-[12px] font-semibold text-[#3f3127]">
          Try it
        </span>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-[11px] text-[#9a8c7e]">Parcel (kg)</span>
            <input
              value={previewKg}
              onChange={(e) => setPreviewKg(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              className={`${inputClass} w-24`}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-[#9a8c7e]">Basket (€)</span>
            <input
              value={previewBasket}
              onChange={(e) => setPreviewBasket(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              className={`${inputClass} w-24`}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-[#9a8c7e]">To</span>
            <input
              value={previewCountry}
              onChange={(e) => setPreviewCountry(e.target.value.toUpperCase().slice(0, 2))}
              className={`${inputClass} w-20 font-mono`}
            />
          </label>
          <div className="ml-auto text-right">
            {preview.available ? (
              <>
                <p className="font-serif text-[24px] leading-none text-[#2a211a]">
                  {preview.cents === 0 ? "Free" : money(preview.cents)}
                </p>
                <p className="mt-1 text-[11px] text-[#9a8c7e]">
                  {preview.method === "free"
                    ? "delivery is switched off"
                    : preview.free
                      ? "over the free threshold"
                      : preview.label}
                </p>
              </>
            ) : (
              <p className="max-w-[260px] text-[12px] text-[#a33c22]">{preview.reason}</p>
            )}
          </div>
        </div>
      </div>

      {/* zones */}
      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12px] font-semibold text-[#3f3127]">Destinations</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              onChange({
                ...value,
                zones: [
                  ...(value.zones || []),
                  { ...EMPTY_ZONE, id: `zone${(value.zones?.length || 0) + 1}` },
                ],
              })
            }
          >
            <Icon name="plus" size={14} /> Add a destination
          </Button>
        </div>

        {!value.zones?.length ? (
          <Muted className="text-[12.5px]">
            No destinations — nothing can be delivered anywhere until you add one.
          </Muted>
        ) : (
          <div className="space-y-3">
            {value.zones.map((z, i) => (
              <div key={i} className="rounded-xl border border-[#e6e0d6] bg-[#fdfbf7] p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Name">
                    <input
                      value={z.label || ""}
                      onChange={(e) => setZone(i, { label: e.target.value })}
                      placeholder="Greece — mainland"
                      className={inputClass}
                    />
                  </Field>
                  <div>
                    <span className="mb-1.5 block text-[12px] font-semibold text-[#3f3127]">
                      Countries
                    </span>
                    <ZoneCountries
                      codes={z.countries}
                      onChange={(countries) => setZone(i, { countries })}
                      claimedElsewhere={claimedBy(i)}
                    />
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-4">
                  <Field label="Base price">
                    <ScaledNumberInput
                      value={z.baseCents}
                      onChange={(baseCents) => setZone(i, { baseCents })}
                    />
                  </Field>
                  <Field label="Covers up to (kg)">
                    <ScaledNumberInput
                      value={z.baseGrams}
                      scale={1000}
                      decimals={null}
                      onChange={(baseGrams) => setZone(i, { baseGrams })}
                    />
                  </Field>
                  <Field label="Each extra kg">
                    <ScaledNumberInput
                      value={z.extraCentsPerKg}
                      onChange={(extraCentsPerKg) => setZone(i, { extraCentsPerKg })}
                    />
                  </Field>
                  <Field label="Refuse over (kg)" hint="0 for no limit.">
                    <ScaledNumberInput
                      value={z.maxGrams}
                      scale={1000}
                      decimals={null}
                      onChange={(maxGrams) => setZone(i, { maxGrams })}
                    />
                  </Field>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-[#eee8de] pt-3">
                  <Muted className="text-[11.5px]">
                    {!(z.countries || []).length
                      ? "No countries — this destination will never match."
                      : charging
                        ? `A 3 kg parcel here: ${money(
                            (Number(z.baseCents) || 0) +
                              Math.ceil(Math.max(0, 3000 - (Number(z.baseGrams) || 0)) / 1000) *
                                (Number(z.extraCentsPerKg) || 0) +
                              (Number(value.handlingCents) || 0)
                          )}${
                            Number(value.handlingCents) > 0
                              ? ` (incl. ${money(value.handlingCents)} handling)`
                              : ""
                          }`
                        : "Not charged — delivery is switched off."}
                  </Muted>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-[#a33c22] hover:bg-[#fbeae5]"
                    onClick={() =>
                      onChange({ ...value, zones: value.zones.filter((_, k) => k !== i) })
                    }
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* collection */}
      <div className="mt-5">
        <Toggle
          on={value.pickup?.enabled !== false}
          onChange={(v) => set({ pickup: { ...(value.pickup || {}), enabled: v } })}
          title="Collection in person"
          onLabel="Customers can pick up instead of paying a courier."
          offLabel="Everything must be delivered."
        />
        {value.pickup?.enabled !== false ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="What to call it">
              <input
                value={value.pickup?.label || ""}
                onChange={(e) => set({ pickup: { ...(value.pickup || {}), label: e.target.value } })}
                placeholder="Collect from us in Chania"
                className={inputClass}
              />
            </Field>
            <Field label="Collection fee" hint="Usually nothing.">
              <ScaledNumberInput
                value={value.pickup?.cents || 0}
                onChange={(cents) => set({ pickup: { ...(value.pickup || {}), cents } })}
              />
            </Field>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

/* --------------------------------- email ---------------------------------- */

function EmailCard({
  emails,
  setEmails,
  automations,
  testKind,
  setTestKind,
  testTo,
  setTestTo,
  testing,
  onTest,
}) {
  const keys = Object.keys(automations);
  const onCount = keys.filter((k) => (emails ? emails[k] !== false : true)).length;

  return (
    <Card>
      <CardHeader
        title="Email"
        description="What the shop sends on its own, and to whom."
        actions={
          keys.length ? (
            <Badge variant={onCount === keys.length ? "success" : "warning"}>
              {onCount} of {keys.length} on
            </Badge>
          ) : null
        }
      />

      {emails?.available === false ? (
        <ErrorNote className="mb-4">
          Switches show their defaults — run dump_sql/20260909_shop_emails.sql to save changes.
        </ErrorNote>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        {keys.map((key) => {
          const meta = automations[key];
          const on = emails ? emails[key] !== false : true;
          return (
            <Toggle
              key={key}
              on={on}
              onChange={(v) => setEmails((prev) => ({ ...(prev || {}), [key]: v }))}
              title={meta.label}
              onLabel={meta.description}
              offLabel={`Off — ${meta.description.replace(/^To /, "not sent to ")}`}
            />
          );
        })}
        {!keys.length ? <Muted className="text-[12.5px]">Loading…</Muted> : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field
          label="Send staff alerts to"
          hint="Leave empty to use the shop's own sending address."
        >
          <input
            value={emails?.staffTo || ""}
            onChange={(e) => setEmails((prev) => ({ ...(prev || {}), staffTo: e.target.value }))}
            placeholder="orders@youroasis.gr"
            className={inputClass}
          />
        </Field>

        <div>
          <span className="mb-1.5 block text-[12px] font-semibold text-[#3f3127]">
            Send yourself a test
          </span>
          <div className="flex gap-2">
            <Select
              value={testKind}
              onChange={(e) => setTestKind(e.target.value)}
              aria-label="Which email to test"
            >
              {keys.map((k) => (
                <option key={k} value={k}>
                  {automations[k].label}
                </option>
              ))}
            </Select>
            <Button variant="secondary" onClick={onTest} disabled={testing}>
              <Icon name="mail" size={14} /> {testing ? "Sending…" : "Send"}
            </Button>
          </div>
          <input
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="Your own address (defaults to your account)"
            className={`${inputClass} mt-2`}
          />
          <Muted className="mt-1.5 text-[11px]">
            Sends the real template filled with a worked example. Nothing is recorded
            against a customer.
          </Muted>
        </div>
      </div>
    </Card>
  );
}

/* ---------------------------- zone country picker ------------------------- */

const ANYWHERE = "*";

function ZoneCountries({ codes, onChange, claimedElsewhere }) {
  const selected = Array.isArray(codes) ? codes : [];
  const known = new Map(COUNTRY_CODES.map((c) => [c.iso, c]));

  const add = (code) => {
    if (!code || selected.includes(code)) return;
    onChange([...selected, code]);
  };
  const remove = (code) => onChange(selected.filter((c) => c !== code));

  const available = COUNTRY_CODES.filter((c) => !selected.includes(c.iso));

  return (
    <div>
      {selected.length ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selected.map((code) => {
            const country = known.get(code);
            const claimed = claimedElsewhere.get(code);
            const unknown = code !== ANYWHERE && !country;
            return (
              <span
                key={code}
                title={
                  claimed
                    ? `Already covered by “${claimed}” — that zone wins`
                    : unknown
                      ? "Not a country code we recognise"
                      : undefined
                }
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] ${
                  claimed || unknown
                    ? "border-[#e8d9b0] bg-[#fdf7e8] text-[#8a6412]"
                    : "border-[#e6e0d6] bg-white text-[#3f3127]"
                }`}
              >
                {code === ANYWHERE ? (
                  <>🌍 Everywhere else</>
                ) : (
                  <>
                    {country?.flag ?? ""} {country?.name ?? code}
                  </>
                )}
                {claimed || unknown ? <Icon name="warning" size={11} /> : null}
                <button
                  type="button"
                  onClick={() => remove(code)}
                  aria-label={`Remove ${country?.name ?? code}`}
                  className="rounded-full p-0.5 text-[#9a8c7e] hover:bg-[#f2ede4] hover:text-[#a33c22]"
                >
                  <Icon name="x" size={11} />
                </button>
              </span>
            );
          })}
        </div>
      ) : null}

      <Select
        value=""
        onChange={(e) => add(e.target.value)}
        aria-label="Add a country to this destination"
      >
        <option value="">Add a country…</option>
        {!selected.includes(ANYWHERE) ? (
          <option value={ANYWHERE}>🌍 Everywhere else</option>
        ) : null}
        {available.map((c) => (
          <option key={c.iso} value={c.iso}>
            {c.flag} {c.name}
          </option>
        ))}
      </Select>

      {!selected.length ? (
        <Muted className="mt-1 text-[11px]">
          Pick at least one, or this destination will never match.
        </Muted>
      ) : null}
    </div>
  );
}
