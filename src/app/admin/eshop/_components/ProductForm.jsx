"use client";

// One form for both creating and editing a shop product. The page used to be
// create-only; editing an existing product meant a small modal for a handful
// of fields and a separate Images tab that asked for a numeric product id.
import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import CloudinaryWidget from "@/app/admin/components/CloudinaryWidget";
import { ean13Svg, isValidEan13, normalizeScan } from "@/lib/shop/barcode";
import Icon from "@/app/admin/_ui/Icon";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ErrorNote,
  Field,
  Muted,
  Page,
  PageHeader,
  Select,
  Skeleton,
  inputClass,
} from "@/app/admin/_ui";

/* -------------------------------- helpers -------------------------------- */

const cx = (...c) => c.filter(Boolean).join(" ");

const CATEGORIES = [
  { key: "food", label: "From the land", hint: "Oil, honey, wine, preserves" },
  { key: "clothing", label: "To wear", hint: "Linen, knitwear, totes" },
  { key: "other", label: "Objects", hint: "Ceramics, candles, gifts" },
];

const CATEGORY_PRESETS = {
  clothing: [
    { name: "Size", values: ["S", "M", "L"] },
    { name: "Colour", values: ["Black", "White"] },
  ],
  food: [{ name: "Size", values: ["200ml", "500ml", "1L"] }],
  other: [],
};

function genSku(prefix = "OAS") {
  const year = new Date().getFullYear().toString().slice(2);
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${year}-${rnd}`;
}

function toCents(value) {
  const raw = String(value ?? "").replace(",", ".").trim();
  return Math.round(Number(raw || 0) * 100);
}

function money(cents, currency = "EUR") {
  const v = Math.max(0, Number(cents) || 0) / 100;
  try {
    return new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(v);
  } catch {
    return `${v.toFixed(2)} ${currency}`;
  }
}

function isUrl(s) {
  try {
    const u = new URL(String(s));
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Option groups are stored as jsonb; tolerate the older flat-string shape. */
function normaliseOptions(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const entry of raw) {
    if (typeof entry === "string" && entry.trim()) {
      out.push({ name: "Option", values: [entry.trim()] });
    } else if (entry && typeof entry === "object" && entry.name) {
      out.push({
        name: String(entry.name),
        values: Array.isArray(entry.values) ? entry.values.map(String) : [],
      });
    }
  }
  return out;
}

/* ------------------------------ small pieces ------------------------------ */

function Pill({ active, onClick, children, title }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cx(
        "rounded-full border px-3 py-1.5 text-[12px] font-semibold transition",
        active
          ? "border-[#2a211a] bg-[#2a211a] text-white"
          : "border-[#e6e0d6] bg-white text-[#5c4d40] hover:border-[#c9b393]"
      )}
    >
      {children}
    </button>
  );
}

function ValueChips({ values, onAdd, onRemove }) {
  const [text, setText] = React.useState("");
  const commit = () => {
    const v = text.trim();
    if (v) onAdd(v);
    setText("");
  };
  return (
    <div>
      {values.length ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {values.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 rounded-full border border-[#e6e0d6] bg-[#faf8f4] px-2 py-1 text-[11.5px] text-[#3f3127]"
            >
              {v}
              <button
                type="button"
                onClick={() => onRemove(v)}
                aria-label={`Remove ${v}`}
                className="rounded-full p-0.5 text-[#9a8c7e] hover:bg-[#efe8dc] hover:text-[#a33c22]"
              >
                <Icon name="x" size={11} />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commit();
            }
          }}
          placeholder="Add a value, then Enter"
          className={inputClass}
        />
        <Button variant="secondary" onClick={commit} disabled={!text.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
}

/* ================================== form ================================== */

export default function ProductForm({ productId = null }) {
  const router = useRouter();
  const isEdit = Boolean(productId);

  const [loading, setLoading] = React.useState(isEdit);
  const [loadError, setLoadError] = React.useState(null);

  const [title, setTitle] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [slugTouched, setSlugTouched] = React.useState(isEdit);
  const [description, setDescription] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [currency, setCurrency] = React.useState("EUR");
  const [active, setActive] = React.useState(true);
  const [category, setCategory] = React.useState("other");
  const [sku, setSku] = React.useState(isEdit ? "" : genSku());
  const [stock, setStock] = React.useState("0");
  const [optionGroups, setOptionGroups] = React.useState([]);
  const [newGroupName, setNewGroupName] = React.useState("");
  const [barcode, setBarcode] = React.useState("");
  const [barcodeDraft, setBarcodeDraft] = React.useState("");
  const [labelCount, setLabelCount] = React.useState("12");

  const [images, setImages] = React.useState([]); // [{id?, url, alt, sort}]
  const [imgUrl, setImgUrl] = React.useState("");
  const [imageBusy, setImageBusy] = React.useState(false);

  const [errors, setErrors] = React.useState({});
  const [busy, setBusy] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState(null);
  const [baseline, setBaseline] = React.useState(null);

  /* ------------------------------- loading ------------------------------- */

  // imageRows omitted => leave the gallery alone (it may have just reloaded).
  const applyProduct = React.useCallback((product, imageRows) => {
    setTitle(product.title || "");
    setSlug(product.slug || "");
    setDescription(product.description || "");
    setPrice(((Number(product.price_cents) || 0) / 100).toFixed(2));
    setCurrency(product.currency || "EUR");
    setActive(Boolean(product.active));
    setCategory(product.category || "other");
    setSku(product.sku_code || "");
    setStock(String(product.stock_qty ?? 0));
    setOptionGroups(normaliseOptions(product.options));
    setBarcode(product.barcode || "");
    setBarcodeDraft(product.barcode || "");
    if (imageRows) {
      setImages(
        imageRows.map((i) => ({
          id: i.id,
          url: i.url,
          alt: i.alt || "",
          sort: Number(i.sort) || 0,
        }))
      );
    }
    setBaseline(
      JSON.stringify({
        title: product.title || "",
        slug: product.slug || "",
        description: product.description || "",
        price: ((Number(product.price_cents) || 0) / 100).toFixed(2),
        currency: product.currency || "EUR",
        active: Boolean(product.active),
        category: product.category || "other",
        sku: product.sku_code || "",
        stock: String(product.stock_qty ?? 0),
        optionGroups: normaliseOptions(product.options),
        barcode: product.barcode || "",
      })
    );
  }, []);

  React.useEffect(() => {
    if (!isEdit) return;
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/admin/shop/products/${productId}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Could not load this product");
        if (!alive) return;
        applyProduct(data.product, data.images);
        setLoadError(null);
      } catch (e) {
        if (alive) setLoadError(String(e.message || e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [isEdit, productId, applyProduct]);

  // Auto-slug from the title, until the slug is edited by hand.
  React.useEffect(() => {
    if (slugTouched) return;
    setSlug(slugify(title));
  }, [title, slugTouched]);

  const current = JSON.stringify({
    title,
    slug,
    description,
    price,
    currency,
    active,
    category,
    sku,
    stock,
    optionGroups,
    barcode,
  });
  const dirty = isEdit
    ? baseline !== null && current !== baseline
    : Boolean(title || description || price || optionGroups.length || images.length);

  React.useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!dirty || busy) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, busy]);

  /* -------------------------------- images ------------------------------- */
  // In edit mode every change is written straight away, so the gallery on the
  // storefront always matches what is on screen. While creating, images are
  // held locally and posted once the product row exists.

  const reloadImages = React.useCallback(async () => {
    if (!isEdit) return;
    const res = await fetch(`/api/admin/shop/images?product_id=${productId}`, {
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Could not load images");
    setImages(
      (Array.isArray(data) ? data : []).map((i) => ({
        id: i.id,
        url: i.url,
        alt: i.alt || "",
        sort: Number(i.sort) || 0,
      }))
    );
  }, [isEdit, productId]);

  async function addImages(entries) {
    const fresh = entries
      .map((e) => ({ url: String(e.url || "").trim(), alt: String(e.alt || "") }))
      .filter((e) => isUrl(e.url))
      .filter((e) => !images.some((i) => i.url === e.url));
    if (!fresh.length) return;

    if (!isEdit) {
      setImages((arr) => [
        ...arr,
        ...fresh.map((e, i) => ({ ...e, sort: arr.length + i })),
      ]);
      return;
    }

    setImageBusy(true);
    try {
      let nextSort = images.reduce((m, i) => Math.max(m, i.sort), -1) + 1;
      for (const entry of fresh) {
        const res = await fetch(`/api/admin/shop/images`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            product_id: Number(productId),
            url: entry.url,
            alt: entry.alt || title,
            sort: nextSort++,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || `Could not attach ${entry.url}`);
        }
      }
      await reloadImages();
    } catch (e) {
      setErrors((p) => ({ ...p, images: String(e.message || e) }));
    } finally {
      setImageBusy(false);
    }
  }

  async function removeImage(idx) {
    const img = images[idx];
    if (!img) return;
    if (!isEdit || !img.id) {
      setImages((arr) => arr.filter((_, i) => i !== idx));
      return;
    }
    if (!confirm("Remove this image from the product?")) return;
    setImageBusy(true);
    try {
      const res = await fetch(`/api/admin/shop/images/${img.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Could not remove the image");
      }
      await reloadImages();
    } catch (e) {
      setErrors((p) => ({ ...p, images: String(e.message || e) }));
    } finally {
      setImageBusy(false);
    }
  }

  async function moveImage(idx, dir) {
    const target = idx + dir;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[idx], next[target]] = [next[target], next[idx]];
    const renumbered = next.map((img, i) => ({ ...img, sort: i }));
    setImages(renumbered);
    if (!isEdit) return;

    setImageBusy(true);
    try {
      // Renumber every row whose position changed. Writing only the swapped
      // pair breaks down once a delete has left gaps in the stored sorts.
      for (let i = 0; i < renumbered.length; i++) {
        const img = renumbered[i];
        const was = images[i];
        if (!img?.id) continue;
        if (was && was.id === img.id && was.sort === img.sort) continue;
        await fetch(`/api/admin/shop/images/${img.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sort: img.sort }),
        });
      }
    } catch (e) {
      setErrors((p) => ({ ...p, images: String(e.message || e) }));
    } finally {
      setImageBusy(false);
    }
  }

  /** Open a print sheet of shelf labels for this product. */
  function printLabels() {
    const svg = ean13Svg(barcode, { moduleWidth: 2, height: 54 });
    if (!svg) {
      alert("This product has no valid barcode to print yet.");
      return;
    }
    const n = Math.max(1, Math.min(96, Number(labelCount) || 1));
    const priceLabel = money(toCents(price), currency);
    const esc = (v) =>
      String(v ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
    const one = `<div class="label"><p class="t">${esc(title)}</p>` +
      `<p class="p">${esc(priceLabel)}</p>${svg}` +
      `<p class="s">${esc(sku || "")}</p></div>`;
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) {
      alert("Your browser blocked the print window.");
      return;
    }
    win.document.write(
      `<!doctype html><html><head><title>${esc(title)} — labels</title><style>
        @page { margin: 10mm; }
        body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0;
               display: grid; grid-template-columns: repeat(3, 1fr); gap: 6mm; }
        .label { border: 1px dashed #ccc; padding: 4mm; text-align: center;
                 break-inside: avoid; }
        .t { margin: 0 0 1mm; font-size: 11px; font-weight: 600; }
        .p { margin: 0 0 2mm; font-size: 13px; }
        .s { margin: 1mm 0 0; font-size: 9px; color: #666; font-family: monospace; }
        svg { max-width: 100%; height: auto; }
      </style></head><body>${one.repeat(n)}</body></html>`
    );
    win.document.close();
    win.focus();
    win.print();
  }

  function setImageAlt(idx, alt) {
    setImages((arr) => arr.map((img, i) => (i === idx ? { ...img, alt } : img)));
  }

  async function commitImageAlt(idx) {
    const img = images[idx];
    if (!isEdit || !img?.id) return;
    await fetch(`/api/admin/shop/images/${img.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alt: img.alt }),
    }).catch(() => {});
  }

  function addUrlFromInput() {
    const lines = imgUrl
      .split(/\r?\n|,/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!lines.length) return;
    addImages(lines.map((url) => ({ url, alt: "" })));
    setImgUrl("");
  }

  /* -------------------------------- options ------------------------------ */

  function addGroup(name) {
    const clean = String(name || "").trim();
    if (!clean) return;
    if (optionGroups.some((g) => g.name.toLowerCase() === clean.toLowerCase())) return;
    setOptionGroups((g) => [...g, { name: clean, values: [] }]);
    setNewGroupName("");
  }

  function applyPreset() {
    const preset = CATEGORY_PRESETS[category] || [];
    if (!preset.length) return;
    setOptionGroups((groups) => {
      const next = [...groups];
      for (const p of preset) {
        if (next.some((g) => g.name.toLowerCase() === p.name.toLowerCase())) continue;
        next.push({ name: p.name, values: [...p.values] });
      }
      return next;
    });
  }

  /* --------------------------------- save -------------------------------- */

  function validate() {
    const next = {};
    if (!title.trim()) next.title = "Title is required.";
    if (!slug.trim()) next.slug = "Slug is required.";
    else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
      next.slug = "Lowercase letters, numbers and dashes only.";
    const cents = toCents(price);
    if (!(cents > 0)) next.price = "Price must be greater than 0.";
    const stockNum = Number(stock);
    if (!Number.isInteger(stockNum) || stockNum < 0)
      next.stock = "Stock must be a whole number of 0 or more.";
    if (sku && !/^[A-Z0-9\-_.]+$/i.test(sku))
      next.sku = "Use letters, numbers, dash, underscore or dot.";
    return { ok: Object.keys(next).length === 0, next, cents, stockNum };
  }

  const cleanedOptions = React.useMemo(
    () =>
      optionGroups
        .map((g) => ({
          name: String(g.name || "").trim(),
          values: (g.values || []).map((v) => String(v).trim()).filter(Boolean),
        }))
        .filter((g) => g.name && g.values.length),
    [optionGroups]
  );

  async function save(publish = active) {
    const { ok, next, cents, stockNum } = validate();
    setErrors(next);
    if (!ok) return;

    setBusy(true);
    try {
      const payload = {
        title: title.trim(),
        slug: slug.trim(),
        description,
        price_cents: cents,
        currency,
        active: publish,
        sku_code: sku.trim() || null,
        stock_qty: stockNum,
        category,
        options: cleanedOptions,
        // Empty hands it back to the trigger, which assigns ours from the sku.
        barcode,
      };

      if (isEdit) {
        const res = await fetch(`/api/admin/shop/products/${productId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Could not save this product");
        setActive(publish);
        applyProduct({ ...data, options: cleanedOptions });
        await reloadImages().catch(() => {});
        setSavedAt(new Date());
        return;
      }

      const res = await fetch(`/api/admin/shop/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setErrors((e) => ({ ...e, sku: "That SKU is already in use." }));
        return;
      }
      if (!res.ok) throw new Error(data?.error || "Could not create this product");

      const failures = [];
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        try {
          const imgRes = await fetch(`/api/admin/shop/images`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              product_id: data.id,
              url: img.url,
              alt: img.alt || title,
              sort: i,
            }),
          });
          if (!imgRes.ok) {
            const d = await imgRes.json().catch(() => ({}));
            failures.push(`${img.url} — ${d?.error || imgRes.status}`);
          }
        } catch (err) {
          failures.push(`${img.url} — ${err?.message || "network error"}`);
        }
      }

      if (failures.length) {
        // We are about to navigate, which would discard an inline note — so
        // block on it, then land on the edit page where they can retry.
        alert(
          `Product created, but ${failures.length} image${
            failures.length === 1 ? "" : "s"
          } could not be attached:\n\n${failures.join(
            "\n"
          )}\n\nYou can add them again on the next screen.`
        );
      }
      router.push(`/admin/eshop/product/${data.id}`);
    } catch (e) {
      setErrors((p) => ({ ...p, submit: String(e.message || e) }));
    } finally {
      setBusy(false);
    }
  }

  async function destroy() {
    if (!isEdit) return;
    if (!confirm(`Delete “${title}” permanently? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/shop/products/${productId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // A product that has been ordered can only ever be hidden.
        if (res.status === 409 && active) {
          if (
            confirm(
              `${data?.error || "This product cannot be deleted."}\n\nHide it from the shop now?`
            )
          ) {
            setActive(false);
            await save(false);
          }
          setBusy(false);
          return;
        }
        throw new Error(data?.error || "Could not delete this product");
      }
      router.push("/admin/eshop?tab=products");
    } catch (e) {
      setErrors((p) => ({ ...p, submit: String(e.message || e) }));
      setBusy(false);
    }
  }

  /* --------------------------------- render ------------------------------- */

  if (loading) {
    return (
      <Page className="py-8">
        <Skeleton className="h-9 w-56" />
        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <Skeleton className="h-64" />
            <Skeleton className="h-48" />
          </div>
          <div className="space-y-5">
            <Skeleton className="h-40" />
            <Skeleton className="h-56" />
          </div>
        </div>
      </Page>
    );
  }

  if (loadError) {
    return (
      <Page className="py-8">
        <PageHeader eyebrow="E-shop" title="Product" />
        <ErrorNote>{loadError}</ErrorNote>
        <Button as={Link} href="/admin/eshop?tab=products" variant="secondary" className="mt-4">
          Back to products
        </Button>
      </Page>
    );
  }

  const priceCents = toCents(price);
  const stockNum = Number(stock) || 0;
  const barcodeSvg = barcode ? ean13Svg(barcode, { moduleWidth: 2, height: 52 }) : null;

  return (
    <Page className="py-8 pb-28">
      <PageHeader
        eyebrow={isEdit ? `E-shop · product #${productId}` : "E-shop"}
        title={isEdit ? title || "Untitled product" : "New product"}
        description={
          isEdit
            ? "Edit the listing, its photographs and the choices customers can make."
            : "Everything a customer sees in the shop, in one place."
        }
        actions={
          <>
            <Button as={Link} href="/admin/eshop?tab=products" variant="ghost">
              Back
            </Button>
            <Button variant="secondary" onClick={() => save(false)} disabled={busy}>
              {isEdit ? "Save as draft" : "Save draft"}
            </Button>
            <Button variant="primary" onClick={() => save(true)} disabled={busy}>
              {busy ? "Saving…" : isEdit ? "Save & publish" : "Publish"}
            </Button>
          </>
        }
      />

      {errors.submit ? (
        <ErrorNote className="mb-5 whitespace-pre-line">{errors.submit}</ErrorNote>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        {/* ------------------------------ main ------------------------------ */}
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="The basics"
              description="Title and address are what the shop and the app show first."
            />
            <div className="space-y-4">
              <Field label="Title" error={errors.title}>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Oasis Olive Oil 500ml"
                  className={inputClass}
                />
              </Field>

              <div>
                <span className="mb-1.5 block text-[12px] font-semibold text-[#3f3127]">
                  Web address
                </span>
                <div className="flex gap-2">
                  <input
                    value={slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setSlug(e.target.value);
                    }}
                    aria-label="Web address"
                    className={inputClass}
                  />
                  {slugTouched ? (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setSlugTouched(false);
                        setSlug(slugify(title));
                      }}
                      title="Regenerate from the title"
                    >
                      Reset
                    </Button>
                  ) : null}
                </div>
                {errors.slug ? (
                  <span className="mt-1 block text-[11px] text-[#a33c22]">{errors.slug}</span>
                ) : (
                  <span className="mt-1 block text-[11px] text-[#9a8c7e]">
                    {slug ? `youroasis.gr/shop/${slug}` : "Generated from the title."}
                  </span>
                )}
              </div>

              <div>
                <span className="mb-1.5 block text-[12px] font-semibold text-[#3f3127]">
                  Category
                </span>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <Pill
                      key={c.key}
                      title={c.hint}
                      active={category === c.key}
                      onClick={() => setCategory(c.key)}
                    >
                      {c.label}
                    </Pill>
                  ))}
                </div>
              </div>

              <Field
                label="Description"
                hint="A few honest sentences. Shown under the photograph."
              >
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  placeholder="Cold-extracted in the valley, bottled the same week…"
                  className={`${inputClass} h-auto py-2.5 leading-relaxed`}
                />
              </Field>
            </div>
          </Card>

          {/* ------------------------------ images --------------------------- */}
          <Card>
            <CardHeader
              title="Photographs"
              description={
                isEdit
                  ? "Saved as you go. The first image is the one customers see in the grid."
                  : "Added to the product when you save. The first is the cover."
              }
              actions={
                <CloudinaryWidget
                  folder="oasis/products"
                  multiple
                  onUploaded={(assets = []) =>
                    addImages(
                      assets.map((a) => ({
                        url: a.secure_url,
                        alt: a.original_filename || "",
                      }))
                    )
                  }
                >
                  <Button variant="secondary" as="span">
                    <Icon name="plus" size={14} /> Upload
                  </Button>
                </CloudinaryWidget>
              }
            />

            {errors.images ? (
              <ErrorNote className="mb-4">{errors.images}</ErrorNote>
            ) : null}

            <div className="mb-4 flex gap-2">
              <input
                value={imgUrl}
                onChange={(e) => setImgUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addUrlFromInput();
                  }
                }}
                placeholder="…or paste an image URL"
                className={inputClass}
              />
              <Button
                variant="secondary"
                onClick={addUrlFromInput}
                disabled={!imgUrl.trim() || imageBusy}
              >
                Add
              </Button>
            </div>

            {!images.length ? (
              <div className="rounded-xl border border-dashed border-[#e6e0d6] bg-[#faf8f4] px-5 py-10 text-center">
                <Muted className="text-[12.5px]">
                  No photographs yet. Products without one show a placeholder tile in
                  the app.
                </Muted>
              </div>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {images.map((img, idx) => (
                  <li
                    key={img.id ?? img.url}
                    className="overflow-hidden rounded-xl border border-[#e6e0d6] bg-white"
                  >
                    <div className="relative aspect-[4/3] bg-[#faf8f4]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={img.alt || ""}
                        className="h-full w-full object-cover"
                      />
                      {idx === 0 ? (
                        <span className="absolute left-2 top-2">
                          <Badge variant="success">Cover</Badge>
                        </span>
                      ) : null}
                    </div>
                    <div className="space-y-2 p-3">
                      <input
                        value={img.alt}
                        onChange={(e) => setImageAlt(idx, e.target.value)}
                        onBlur={() => commitImageAlt(idx)}
                        placeholder="Alt text"
                        className={`${inputClass} h-9 text-[12px]`}
                      />
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Move earlier"
                            disabled={idx === 0 || imageBusy}
                            onClick={() => moveImage(idx, -1)}
                          >
                            ↑
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Move later"
                            disabled={idx === images.length - 1 || imageBusy}
                            onClick={() => moveImage(idx, 1)}
                          >
                            ↓
                          </Button>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeImage(idx)}
                          disabled={imageBusy}
                          className="text-[#a33c22] hover:bg-[#fbeae5]"
                        >
                          <Icon name="trash" size={14} /> Remove
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* ----------------------------- options --------------------------- */}
          <Card>
            <CardHeader
              title="Choices"
              description="Sizes, colours and the like. Customers pick one before adding to their bag."
              actions={
                (CATEGORY_PRESETS[category] || []).length ? (
                  <Button variant="ghost" size="sm" onClick={applyPreset}>
                    Use {CATEGORIES.find((c) => c.key === category)?.label} preset
                  </Button>
                ) : null
              }
            />

            {optionGroups.length ? (
              <div className="mb-4 space-y-4">
                {optionGroups.map((group, gi) => (
                  <div
                    key={group.name}
                    className="rounded-xl border border-[#e6e0d6] bg-[#fdfbf7] p-4"
                  >
                    <div className="mb-2.5 flex items-center justify-between gap-3">
                      <span className="text-[13px] font-semibold text-[#2a211a]">
                        {group.name}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[#a33c22] hover:bg-[#fbeae5]"
                        onClick={() =>
                          setOptionGroups((groups) => groups.filter((_, i) => i !== gi))
                        }
                      >
                        Remove
                      </Button>
                    </div>
                    <ValueChips
                      values={group.values}
                      onAdd={(v) =>
                        setOptionGroups((groups) =>
                          groups.map((g, i) =>
                            i === gi && !g.values.includes(v)
                              ? { ...g, values: [...g.values, v] }
                              : g
                          )
                        )
                      }
                      onRemove={(v) =>
                        setOptionGroups((groups) =>
                          groups.map((g, i) =>
                            i === gi
                              ? { ...g, values: g.values.filter((x) => x !== v) }
                              : g
                          )
                        )
                      }
                    />
                  </div>
                ))}
              </div>
            ) : (
              <Muted className="mb-4 text-[12.5px]">
                No choices — the product is sold exactly as described.
              </Muted>
            )}

            <div className="flex gap-2">
              <input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addGroup(newGroupName);
                  }
                }}
                placeholder="New choice, e.g. Size"
                className={inputClass}
              />
              <Button
                variant="secondary"
                onClick={() => addGroup(newGroupName)}
                disabled={!newGroupName.trim()}
              >
                <Icon name="plus" size={14} /> Add
              </Button>
            </div>
            <Muted className="mt-3 text-[11.5px]">
              Stock is counted per product, not per choice — there is no separate
              inventory for each size.
            </Muted>
          </Card>
        </div>

        {/* ------------------------------ sidebar --------------------------- */}
        <div className="space-y-5 lg:sticky lg:top-6">
          <Card>
            <CardHeader title="Visibility" />
            <button
              type="button"
              onClick={() => setActive((a) => !a)}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#e6e0d6] bg-[#faf8f4] px-3 py-2.5 text-left"
            >
              <span>
                <span className="block text-[13px] font-semibold text-[#2a211a]">
                  {active ? "Live in the shop" : "Draft"}
                </span>
                <span className="block text-[11.5px] text-[#9a8c7e]">
                  {active ? "Customers can see and buy it." : "Hidden from customers."}
                </span>
              </span>
              <span
                className={cx(
                  "relative h-6 w-11 shrink-0 rounded-full transition",
                  active ? "bg-[#3f6b3f]" : "bg-[#d8cfc2]"
                )}
              >
                <span
                  className={cx(
                    "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
                    active ? "left-[22px]" : "left-0.5"
                  )}
                />
              </span>
            </button>
          </Card>

          <Card>
            <CardHeader title="Price" />
            <div className="grid grid-cols-[minmax(0,1fr)_92px] gap-2">
              <Field label="Amount" error={errors.price}>
                <input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  inputMode="decimal"
                  placeholder="19.99"
                  className={inputClass}
                />
              </Field>
              <Field label="Currency">
                <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                </Select>
              </Field>
            </div>
            <div className="mt-3 rounded-xl bg-[#faf8f4] px-3 py-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9a8c7e]">
                Customers pay
              </span>
              <p className="font-serif text-[22px] text-[#2a211a]">
                {money(priceCents, currency)}
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Inventory" />
            <div className="space-y-4">
              <Field label="Stock on hand" error={errors.stock}>
                <input
                  value={stock}
                  onChange={(e) => setStock(e.target.value.replace(/[^0-9]/g, ""))}
                  inputMode="numeric"
                  className={inputClass}
                />
              </Field>
              <div>
                <span className="mb-1.5 block text-[12px] font-semibold text-[#3f3127]">
                  SKU
                </span>
                <div className="flex gap-2">
                  <input
                    value={sku}
                    onChange={(e) => setSku(e.target.value.toUpperCase())}
                    aria-label="SKU"
                    className={`${inputClass} font-mono`}
                  />
                  <Button variant="ghost" onClick={() => setSku(genSku())} title="Generate a new SKU">
                    <Icon name="copy" size={14} />
                  </Button>
                </div>
                {errors.sku ? (
                  <span className="mt-1 block text-[11px] text-[#a33c22]">{errors.sku}</span>
                ) : (
                  <span className="mt-1 block text-[11px] text-[#9a8c7e]">Your own reference.</span>
                )}
              </div>
              {stockNum === 0 ? (
                <Badge variant="warning">Shows as sold out</Badge>
              ) : stockNum <= 5 ? (
                <Badge variant="warning">Low stock — {stockNum} left</Badge>
              ) : (
                <Badge variant="success">{stockNum} in stock</Badge>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Barcode"
              description="Scannable at the till and in the stockroom."
            />
            {barcodeSvg ? (
              <div
                className="flex justify-center rounded-xl border border-[#e6e0d6] bg-white p-3"
                dangerouslySetInnerHTML={{ __html: barcodeSvg }}
              />
            ) : (
              <Muted className="text-[12.5px]">
                {isEdit
                  ? "No barcode yet — one is assigned automatically when the product is saved."
                  : "Assigned automatically once you save this product."}
              </Muted>
            )}

            {barcode ? (
              <div className="mt-3 flex items-center gap-2">
                <code className="flex-1 truncate rounded-lg bg-[#faf8f4] px-2 py-1.5 font-mono text-[12px] text-[#2a211a]">
                  {barcode}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Copy the barcode"
                  onClick={() => navigator.clipboard?.writeText(barcode)}
                >
                  <Icon name="copy" size={14} />
                </Button>
              </div>
            ) : null}

            <div className="mt-4 space-y-2 border-t border-[#f0ebe2] pt-4">
              <span className="block text-[12px] font-semibold text-[#3f3127]">
                Use a different barcode
              </span>
              <input
                value={barcodeDraft}
                onChange={(e) => setBarcodeDraft(e.target.value)}
                inputMode="numeric"
                placeholder="Scan or type an EAN-13"
                aria-label="Barcode"
                className={`${inputClass} font-mono`}
              />
              {barcodeDraft && !isValidEan13(normalizeScan(barcodeDraft)) ? (
                <span className="block text-[11px] text-[#a33c22]">
                  Not a valid EAN-13 — 13 digits including the check digit.
                </span>
              ) : (
                <span className="block text-[11px] text-[#9a8c7e]">
                  Keep a bought-in product&rsquo;s own barcode, or clear it to use ours.
                </span>
              )}
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  disabled={
                    normalizeScan(barcodeDraft) === barcode ||
                    (Boolean(barcodeDraft.trim()) &&
                      !isValidEan13(normalizeScan(barcodeDraft)))
                  }
                  onClick={() => setBarcode(normalizeScan(barcodeDraft))}
                >
                  Apply
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setBarcode("");
                    setBarcodeDraft("");
                  }}
                  title="Clear it and let the shop assign ours on save"
                >
                  Use ours
                </Button>
              </div>
            </div>

            {barcodeSvg ? (
              <div className="mt-4 flex items-center gap-2 border-t border-[#f0ebe2] pt-4">
                <input
                  value={labelCount}
                  onChange={(e) => setLabelCount(e.target.value.replace(/[^0-9]/g, ""))}
                  inputMode="numeric"
                  aria-label="Number of labels"
                  className={`${inputClass} w-20`}
                />
                <Button variant="secondary" className="flex-1" onClick={printLabels}>
                  <Icon name="file" size={14} /> Print labels
                </Button>
              </div>
            ) : null}
          </Card>

          <Card>
            <CardHeader title="How it will look" />
            <div className="overflow-hidden rounded-xl border border-[#e6e0d6]">
              <div className="aspect-[4/3] bg-[#faf8f4]">
                {images[0]?.url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={images[0].url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[#c9b393]">
                    <Icon name="leaf" size={22} />
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="font-serif text-[15px] text-[#2a211a]">
                  {title || "Untitled product"}
                </p>
                <p className="text-[12px] text-[#b89a6b]">
                  {money(priceCents, currency)}
                </p>
              </div>
            </div>
          </Card>

          {isEdit ? (
            <Card>
              <CardHeader
                title="Danger zone"
                description="Products that have been ordered can only be deactivated."
              />
              <Button variant="danger" onClick={destroy} disabled={busy} className="w-full">
                <Icon name="trash" size={14} /> Delete product
              </Button>
            </Card>
          ) : null}
        </div>
      </div>

      {/* ------------------------------ save bar ------------------------------ */}
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
              <Button variant="secondary" onClick={() => save(false)} disabled={busy || !dirty}>
                Save as draft
              </Button>
              <Button variant="primary" onClick={() => save(true)} disabled={busy || !dirty}>
                {busy ? "Saving…" : "Save & publish"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </Page>
  );
}
