"use client";

// Scanner station. Works with a USB/Bluetooth barcode scanner (they type like a
// keyboard and press Enter), with the laptop camera where the browser supports
// BarcodeDetector, and by typing a code by hand.
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
  inputClass,
} from "@/app/admin/_ui";
import { ean13Svg, normalizeScan } from "@/lib/shop/barcode";

const MODES = {
  lookup: { label: "Look up", hint: "Scan to see what it is. Nothing changes." },
  in: { label: "Receiving", hint: "Each scan adds to stock." },
  out: { label: "Picking", hint: "Each scan takes off stock." },
};

function money(cents, currency = "EUR") {
  const v = (Number(cents) || 0) / 100;
  try {
    return new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(v);
  } catch {
    return `${v.toFixed(2)} ${currency}`;
  }
}

/** Short two-tone feedback so the operator needn't watch the screen. */
function useBeeper() {
  const ctxRef = React.useRef(null);
  return React.useCallback((kind) => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!ctxRef.current) ctxRef.current = new Ctx();
      const ctx = ctxRef.current;
      if (ctx.state === "suspended") ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = kind === "ok" ? 880 : 220;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch {
      // audio is a nicety, never a requirement
    }
  }, []);
}

export default function ScannerStation() {
  const [mode, setMode] = React.useState("lookup");
  const [step, setStep] = React.useState("1");
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [current, setCurrent] = React.useState(null); // {product, matchedOn}
  const [miss, setMiss] = React.useState(null); // {code, suggestions}
  const [history, setHistory] = React.useState([]);
  const [camera, setCamera] = React.useState("idle"); // idle | on | unsupported | denied
  const [error, setError] = React.useState("");

  const inputRef = React.useRef(null);
  const videoRef = React.useRef(null);
  const streamRef = React.useRef(null);
  const lastScanRef = React.useRef({ code: "", at: 0 });
  const beep = useBeeper();

  // The station is used hands-free: keep the caret in the box for the wedge.
  const refocus = React.useCallback(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);
  React.useEffect(() => {
    refocus();
  }, [refocus]);

  const record = React.useCallback((entry) => {
    setHistory((h) => [{ ...entry, at: new Date() }, ...h].slice(0, 40));
  }, []);

  const handleCode = React.useCallback(
    async (raw) => {
      const clean = normalizeScan(raw);
      if (!clean) return;

      // A camera sees the same barcode many times a second; a wedge can double
      // fire. Ignore an identical code within a second.
      const now = Date.now();
      if (lastScanRef.current.code === clean && now - lastScanRef.current.at < 1000) return;
      lastScanRef.current = { code: clean, at: now };

      setBusy(true);
      setError("");
      try {
        const res = await fetch(`/api/admin/shop/lookup?code=${encodeURIComponent(clean)}`, {
          cache: "no-store",
        });
        const data = await res.json();

        if (!res.ok || !data.product) {
          beep("bad");
          setCurrent(null);
          setMiss({ code: clean, suggestions: data?.suggestions || [] });
          record({ code: clean, ok: false, message: "No product with that code" });
          return;
        }

        const product = data.product;
        setMiss(null);

        if (mode === "lookup") {
          beep("ok");
          setCurrent({ product, matchedOn: data.matchedOn });
          record({
            code: clean,
            ok: true,
            title: product.title,
            message: `${product.stock_qty} in stock`,
          });
          return;
        }

        const delta = (mode === "in" ? 1 : -1) * Math.max(1, Number(step) || 1);
        const next = Math.max(0, Number(product.stock_qty || 0) + delta);
        const patch = await fetch(`/api/admin/shop/products/${product.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stock_qty: next }),
        });
        const patched = await patch.json();
        if (!patch.ok) throw new Error(patched?.error || "Could not update stock");

        beep("ok");
        setCurrent({ product: { ...product, stock_qty: next }, matchedOn: data.matchedOn });
        record({
          code: clean,
          ok: true,
          title: product.title,
          message: `${product.stock_qty} → ${next}`,
        });
      } catch (e) {
        beep("bad");
        setError(String(e.message || e));
        record({ code: clean, ok: false, message: String(e.message || e) });
      } finally {
        setBusy(false);
        setCode("");
        refocus();
      }
    },
    [mode, step, beep, record, refocus]
  );

  /* ------------------------------- camera -------------------------------- */

  const stopCamera = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamera("idle");
  }, []);

  React.useEffect(() => stopCamera, [stopCamera]);

  async function startCamera() {
    if (typeof window === "undefined" || !("BarcodeDetector" in window)) {
      setCamera("unsupported");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setCamera("on");
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      const detector = new window.BarcodeDetector({
        formats: ["ean_13", "ean_8", "code_128", "upc_a", "qr_code"],
      });
      const tick = async () => {
        if (!streamRef.current) return; // stopped
        try {
          const found = await detector.detect(videoRef.current);
          if (found?.length) handleCode(found[0].rawValue);
        } catch {
          // a dropped frame is not worth reporting
        }
        setTimeout(tick, 350);
      };
      tick();
    } catch {
      setCamera("denied");
    }
  }

  const product = current?.product;
  const svg = product?.barcode ? ean13Svg(product.barcode, { moduleWidth: 2, height: 48 }) : null;

  return (
    <Page className="py-8">
      <PageHeader
        eyebrow="E-shop"
        title="Scanner"
        description="Point a scanner at this page — the code lands in the box and is looked up straight away."
        actions={
          <Button as={Link} href="/admin/eshop?tab=products" variant="ghost">
            Back to products
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="space-y-5">
          <Card>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[240px] flex-1">
                <span className="mb-1.5 block text-[12px] font-semibold text-[#3f3127]">
                  Scan or type a code
                </span>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleCode(code);
                  }}
                >
                  <input
                    ref={inputRef}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    onBlur={refocus}
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="Barcode, SKU or product name"
                    aria-label="Scan or type a code"
                    className={`${inputClass} h-12 font-mono text-[15px]`}
                  />
                </form>
              </div>

              <div>
                <span className="mb-1.5 block text-[12px] font-semibold text-[#3f3127]">
                  Mode
                </span>
                <Select
                  value={mode}
                  onChange={(e) => {
                    setMode(e.target.value);
                    refocus();
                  }}
                  className="h-12 !w-auto min-w-[150px]"
                  aria-label="Scanner mode"
                >
                  {Object.entries(MODES).map(([key, m]) => (
                    <option key={key} value={key}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </div>

              {mode !== "lookup" ? (
                <div>
                  <span className="mb-1.5 block text-[12px] font-semibold text-[#3f3127]">
                    Per scan
                  </span>
                  <input
                    value={step}
                    onChange={(e) => setStep(e.target.value.replace(/[^0-9]/g, ""))}
                    inputMode="numeric"
                    aria-label="Units per scan"
                    className={`${inputClass} h-12 w-20 text-center`}
                  />
                </div>
              ) : null}
            </div>

            <Muted className="mt-3 text-[12px]">
              {MODES[mode].hint}
              {busy ? " · looking up…" : ""}
            </Muted>

            {error ? <ErrorNote className="mt-4">{error}</ErrorNote> : null}
          </Card>

          {/* ------------------------------ result ----------------------------- */}
          {product ? (
            <Card>
              <CardHeader
                title={product.title}
                description={`Matched on ${current.matchedOn}`}
                actions={
                  <Button
                    as={Link}
                    href={`/admin/eshop/product/${product.id}`}
                    variant="secondary"
                    size="sm"
                  >
                    Manage
                  </Button>
                }
              />
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="space-y-1.5 text-[13px]">
                  <div className="flex justify-between gap-6">
                    <span className="text-[#7a6a5f]">Price</span>
                    <span className="font-semibold">
                      {money(product.price_cents, product.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-6">
                    <span className="text-[#7a6a5f]">In stock</span>
                    <span className="font-serif text-[20px] text-[#2a211a]">
                      {product.stock_qty}
                    </span>
                  </div>
                  <div className="flex justify-between gap-6">
                    <span className="text-[#7a6a5f]">SKU</span>
                    <span className="font-mono text-[12px]">{product.sku_code || "—"}</span>
                  </div>
                  <div className="flex justify-between gap-6">
                    <span className="text-[#7a6a5f]">Barcode</span>
                    <span className="font-mono text-[12px]">{product.barcode || "—"}</span>
                  </div>
                  <div className="pt-1">
                    {product.active ? (
                      <Badge variant="success">Live</Badge>
                    ) : (
                      <Badge variant="neutral">Hidden</Badge>
                    )}
                    {product.stock_qty === 0 ? (
                      <Badge variant="warning" className="ml-2">
                        Sold out
                      </Badge>
                    ) : null}
                  </div>
                </div>
                {svg ? (
                  <div
                    className="justify-self-center rounded-xl border border-[#e6e0d6] bg-white p-2"
                    dangerouslySetInnerHTML={{ __html: svg }}
                  />
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-[#f0ebe2] pt-4">
                {[-10, -1, 1, 10].map((d) => (
                  <Button
                    key={d}
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={async () => {
                      const next = Math.max(0, Number(product.stock_qty || 0) + d);
                      setBusy(true);
                      try {
                        const res = await fetch(`/api/admin/shop/products/${product.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ stock_qty: next }),
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data?.error || "Could not update stock");
                        setCurrent((c) => ({
                          ...c,
                          product: { ...c.product, stock_qty: next },
                        }));
                        record({
                          code: product.barcode || product.sku_code || String(product.id),
                          ok: true,
                          title: product.title,
                          message: `${product.stock_qty} → ${next} (manual)`,
                        });
                      } catch (e) {
                        setError(String(e.message || e));
                      } finally {
                        setBusy(false);
                        refocus();
                      }
                    }}
                  >
                    {d > 0 ? `+${d}` : d}
                  </Button>
                ))}
              </div>
            </Card>
          ) : miss ? (
            <Card>
              <CardHeader
                title="Nothing matched that code"
                description={miss.code}
              />
              {miss.suggestions?.length ? (
                <ul className="divide-y divide-[#f0ebe2]">
                  {miss.suggestions.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] text-[#2a211a]">{p.title}</p>
                        <p className="font-mono text-[11px] text-[#9a8c7e]">
                          {p.barcode || p.sku_code || `#${p.id}`}
                        </p>
                      </div>
                      <Button
                        as={Link}
                        href={`/admin/eshop/product/${p.id}`}
                        size="sm"
                        variant="secondary"
                      >
                        Open
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <Muted className="text-[12.5px]">
                  No product carries that barcode or SKU. Open the product and paste the
                  code into its Barcode box to attach it.
                </Muted>
              )}
            </Card>
          ) : null}
        </div>

        {/* ------------------------------ sidebar ----------------------------- */}
        <div className="space-y-5">
          <Card>
            <CardHeader title="Camera" description="For phones and laptops without a scanner." />
            {camera === "on" ? (
              <>
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  className="w-full rounded-xl bg-black"
                  style={{ aspectRatio: "4 / 3", objectFit: "cover" }}
                />
                <Button variant="secondary" className="mt-3 w-full" onClick={stopCamera}>
                  Stop camera
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" className="w-full" onClick={startCamera}>
                  <Icon name="search" size={14} /> Use the camera
                </Button>
                {camera === "unsupported" ? (
                  <Muted className="mt-2 text-[11.5px]">
                    This browser has no barcode detector. Chrome or Edge on desktop and
                    Android support it; on Safari use a handheld scanner or type the code.
                  </Muted>
                ) : camera === "denied" ? (
                  <Muted className="mt-2 text-[11.5px]">
                    Camera access was refused.
                  </Muted>
                ) : null}
              </>
            )}
          </Card>

          <Card>
            <CardHeader
              title="This session"
              description={`${history.length} scan${history.length === 1 ? "" : "s"}`}
              actions={
                history.length ? (
                  <Button variant="ghost" size="sm" onClick={() => setHistory([])}>
                    Clear
                  </Button>
                ) : null
              }
            />
            {!history.length ? (
              <Muted className="text-[12.5px]">Scans appear here as you go.</Muted>
            ) : (
              <ul className="divide-y divide-[#f0ebe2]">
                {history.map((h, i) => (
                  <li key={`${h.code}-${i}`} className="flex items-start gap-2 py-2">
                    <span
                      className={`mt-0.5 ${h.ok ? "text-[#3f6b3f]" : "text-[#a33c22]"}`}
                    >
                      <Icon name={h.ok ? "check" : "warning"} size={13} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] text-[#2a211a]">
                        {h.title || h.code}
                      </p>
                      <p className="truncate text-[11px] text-[#9a8c7e]">
                        {h.message} ·{" "}
                        {h.at.toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </Page>
  );
}
