"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  Plus,
  X,
  Hash,
  Boxes,
  Settings2,
  ArrowUp,
  ArrowDown,
  Star,
} from "lucide-react";

import { Button } from "@/app/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";
import { Switch } from "@/app/components/ui/switch";
import CloudinaryWidget from "@/app/admin/components/CloudinaryWidget";

/* ------------------------------ UI tokens ------------------------------ */
const ui = {
  card: "rounded-2xl border-[#e8e2d8] bg-white",
  brand: "text-[#4a3f35]",
  soft: "text-[#6b625a]",
  cta: "bg-[#8b6f47] text-white hover:bg-[#a78b62]",
  outline: "border-[#e3ddd5] text-[#5a4a3f]",
};

/* ---------------------------- helpers/utils ---------------------------- */
function genSku(prefix = "OAS") {
  const y = new Date().getFullYear().toString().slice(2);
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${y}-${rnd}`;
}

function safeMoney(priceStr, currency = "EUR") {
  if (!priceStr)
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(0);
  const cents = Math.round(Number(String(priceStr).replace(",", ".")) * 100);
  const v = Math.max(0, cents) / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(v);
  } catch {
    return `€${v.toFixed(2)}`;
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

function Field({ label, helper, error, children }) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium text-[#4a3f35]">{label}</div>
      {children}
      {helper ? <div className="text-xs text-neutral-600">{helper}</div> : null}
      {error ? <div className="text-xs text-red-600">{error}</div> : null}
    </div>
  );
}

function ChipInput({ values = [], onAdd, onRemove, placeholder }) {
  const [text, setText] = React.useState("");
  function commit() {
    const v = text.trim();
    if (v) onAdd?.(v);
    setText("");
  }
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded-full bg-[#efeae2] px-2 py-1 text-xs text-[#5a4a3f]"
          >
            {v}
            <button
              type="button"
              className="rounded-full p-1 hover:bg-[#e8e2d9]"
              onClick={() => onRemove?.(v)}
              aria-label={`Remove ${v}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commit();
            }
          }}
          placeholder={placeholder}
        />
        <Button
          type="button"
          variant="outline"
          className="border-[#e3ddd5] text-[#5a4a3f]"
          onClick={commit}
        >
          Add
        </Button>
      </div>
    </div>
  );
}

/* ----------------------- variants / combinations ----------------------- */
const CATEGORY_PRESETS = {
  clothing: [
    { name: "Size", values: ["S", "M", "L"] },
    { name: "Color", values: ["Black", "White"] },
  ],
  food: [{ name: "Size", values: ["200ml", "1L"] }],
  other: [],
};

function cartesian(arrs) {
  if (!arrs.length) return [[]];
  const [head, ...tail] = arrs;
  const rest = cartesian(tail);
  const out = [];
  head.forEach((h) => rest.forEach((r) => out.push([h, ...r])));
  return out;
}

function makeCombos(groups) {
  const clean = (groups || [])
    .map((g) => ({
      name: String(g.name || "").trim(),
      values: (g.values || []).map((v) => String(v).trim()).filter(Boolean),
    }))
    .filter((g) => g.name && g.values.length);
  if (!clean.length) return [];
  const axes = clean.map((g) => g.values.map((v) => ({ [g.name]: v })));
  const raw = cartesian(axes);
  return raw.map((parts) => Object.assign({}, ...parts));
}

function comboKey(obj) {
  return Object.keys(obj)
    .sort()
    .map((k) => `${k}:${obj[k]}`)
    .join("|");
}

/* =============================== PAGE ================================== */
export default function NewProductPage() {
  const router = useRouter();

  // basics
  const [title, setTitle] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [description, setDescription] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [currency, setCurrency] = React.useState("EUR");
  const [active, setActive] = React.useState(true);

  // images (gallery)
  const [images, setImages] = React.useState([]); // [{url, alt}]
  const [imgUrl, setImgUrl] = React.useState("");
  const [imgAlt, setImgAlt] = React.useState("");

  // inventory + codes
  const [sku, setSku] = React.useState(genSku());
  const [stock, setStock] = React.useState(0);

  // category + options + variants
  const [category, setCategory] = React.useState("other");
  const [optionGroups, setOptionGroups] = React.useState([]);
  const [newGroupName, setNewGroupName] = React.useState("");
  const [variantForm, setVariantForm] = React.useState({});

  const combos = React.useMemo(() => makeCombos(optionGroups), [optionGroups]);

  const [errors, setErrors] = React.useState({});
  const [busy, setBusy] = React.useState(false);

  // auto-slug until user edits
  React.useEffect(() => {
    if (slugTouched) return;
    const s = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    setSlug(s);
  }, [title, slugTouched]);

  // unsaved-changes guard
  const dirty =
    title ||
    description ||
    price ||
    slug ||
    sku ||
    stock ||
    optionGroups.length ||
    Object.keys(variantForm).length ||
    category !== "other" ||
    images.length > 0 ||
    imgUrl ||
    imgAlt;
  React.useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!dirty || busy) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, busy]);

  // Cmd/Ctrl+S save
  React.useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave(active);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    active,
    title,
    slug,
    description,
    price,
    currency,
    sku,
    stock,
    optionGroups,
    variantForm,
    category,
    images,
  ]);

  function validate() {
    const next = {};
    if (!title.trim()) next.title = "Title is required.";
    if (!slug.trim()) next.slug = "Slug is required.";
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
      next.slug = "Use lowercase letters, numbers and dashes.";
    const cents = Math.round(Number(String(price).replace(",", ".")) * 100);
    if (!(cents > 0)) next.price = "Price must be greater than 0.";
    if (stock < 0 || !Number.isFinite(Number(stock)))
      next.stock = "Stock must be a non-negative number.";
    if (sku && !/^[A-Z0-9-_.]+$/.test(sku))
      next.sku = "Use A–Z, 0–9, dash, underscore or dot.";

    const cleaned = optionGroups
      .map((g) => ({
        name: String(g.name || "").trim(),
        values: (g.values || []).map((v) => String(v).trim()).filter(Boolean),
      }))
      .filter((g) => g.name && g.values.length > 0);

    return { ok: Object.keys(next).length === 0, next, cents, cleaned };
  }

  function combinationsCount(groups) {
    if (!groups.length) return 0;
    return groups.reduce(
      (acc, g) => acc * Math.max(1, (g.values || []).length),
      1
    );
  }

  async function handleSave(publish) {
    const { ok, next, cents, cleaned } = validate();
    setErrors(next);
    if (!ok) return;

    try {
      setBusy(true);

      // Build variants payload
      const variantsPayload = [];
      const used = new Set();
      combos.forEach((combo) => {
        const key = comboKey(combo);
        const cell = variantForm[key] || {};
        const stockV = Math.max(0, Number(cell.stock || 0));
        const skuV = (cell.sku || "").trim() || null;
        const sig = JSON.stringify(combo, Object.keys(combo).sort());
        if (used.has(sig)) return;
        used.add(sig);

        variantsPayload.push({
          options: combo,
          stock_qty: stockV,
          sku_code: skuV,
          price_override_cents: null,
        });
      });

      // create product
      const res = await fetch("/api/admin/shop/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          slug,
          description,
          price_cents: cents,
          currency,
          active: !!publish,
          sku_code: sku?.trim() || null,
          stock_qty: Number(stock) | 0,
          category,
          options: cleaned,
          variants: variantsPayload,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 409) {
        setErrors((e) => ({ ...e, sku: "SKU already in use. Try another." }));
        setBusy(false);
        return;
      }
      if (!res.ok) throw new Error(data?.error || "Failed to create product");

      // save images (primary = first)
      if (Array.isArray(images) && images.length > 0) {
        for (let i = 0; i < images.length; i++) {
          const it = images[i];
          const url = String(it.url || "").trim();
          if (!isUrl(url)) continue;
          await fetch("/api/admin/shop/images", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              product_id: data?.id,
              url,
              alt: (it.alt || title || "").trim() || null,
              sort: i,
            }),
          }).catch(() => {});
        }
      }

      router.push("/admin/eshop?tab=products");
    } catch (e) {
      setErrors((prev) => ({ ...prev, submit: e.message || String(e) }));
      setBusy(false);
    }
  }

  /* ------------------------------ options ------------------------------ */
  function addGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    if (optionGroups.some((g) => g.name.toLowerCase() === name.toLowerCase()))
      return;
    setOptionGroups((g) => [...g, { name, values: [] }]);
    setNewGroupName("");
  }
  function removeGroup(name) {
    setOptionGroups((g) => g.filter((x) => x.name !== name));
    setVariantForm({});
  }
  function addValue(groupName, value) {
    const v = value.trim();
    if (!v) return;
    setOptionGroups((groups) =>
      groups.map((g) =>
        g.name === groupName && !g.values.includes(v)
          ? { ...g, values: [...g.values, v] }
          : g
      )
    );
    setVariantForm({});
  }
  function removeValue(groupName, value) {
    setOptionGroups((groups) =>
      groups.map((g) =>
        g.name === groupName
          ? { ...g, values: g.values.filter((x) => x !== value) }
          : g
      )
    );
    setVariantForm({});
  }

  function applyCategoryPreset(cat) {
    setCategory(cat);
    const preset = CATEGORY_PRESETS[cat] || [];
    setOptionGroups(preset);
    setVariantForm({});
  }

  function autoGenerateVariantSkus() {
    const prefix = (sku || "").trim();
    const next = { ...variantForm };
    combos.forEach((c) => {
      const key = comboKey(c);
      const abbrev = Object.values(c)
        .map((v) =>
          String(v)
            .replace(/[^A-Za-z0-9]/g, "")
            .slice(0, 3)
            .toUpperCase()
        )
        .join("-");
      next[key] = {
        ...(next[key] || {}),
        sku: prefix ? `${prefix}-${abbrev}` : `${genSku()}-${abbrev}`,
        stock: Number(next[key]?.stock || 0),
      };
    });
    setVariantForm(next);
  }

  /* ------------------------------ images ------------------------------ */
  function addImage() {
    const url = imgUrl.trim();
    if (!isUrl(url)) return;
    const alt = imgAlt.trim();
    setImages((arr) => {
      if (arr.some((x) => x.url === url)) return arr;
      return [...arr, { url, alt }];
    });
    setImgUrl("");
    setImgAlt("");
  }

  function addImagesBulkFromTextarea(text) {
    const lines = String(text || "")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const urls = lines.filter(isUrl);
    if (!urls.length) return;
    setImages((arr) => {
      const existing = new Set(arr.map((x) => x.url));
      const toAdd = urls
        .filter((u) => !existing.has(u))
        .map((u) => ({ url: u, alt: "" }));
      return [...arr, ...toAdd];
    });
  }

  function removeImage(idx) {
    setImages((arr) => arr.filter((_, i) => i !== idx));
  }
  function moveImage(idx, dir) {
    setImages((arr) => {
      const n = [...arr];
      const j = idx + dir;
      if (j < 0 || j >= n.length) return n;
      const [it] = n.splice(idx, 1);
      n.splice(j, 0, it);
      return n;
    });
  }
  function setPrimary(idx) {
    setImages((arr) => {
      if (idx <= 0) return arr;
      const n = [...arr];
      const [it] = n.splice(idx, 1);
      n.unshift(it);
      return n;
    });
  }
  function updateImageAlt(idx, alt) {
    setImages((arr) => arr.map((x, i) => (i === idx ? { ...x, alt } : x)));
  }
  function updateImageUrl(idx, url) {
    setImages((arr) => arr.map((x, i) => (i === idx ? { ...x, url } : x)));
  }

  const previewImage = images[0]?.url || "";

  /* -------------------------------- render ------------------------------ */
  return (
    <div className="min-h-screen bg-[#f6f3ee] text-[#4a3f35]">
      {/* Sticky action bar */}
      <div className="sticky top-0 z-40 border-b border-[#eadfd2] bg-white/85 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-3">
          <Link
            href="/admin/eshop?tab=products"
            className="inline-flex items-center gap-2 rounded-md border border-[#e7e0d6] bg-white px-3 py-1.5 text-sm text-[#5a4a3f] hover:bg-[#faf7f1]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <div className="ml-1 mr-auto">
            <h1 className="text-lg font-serif text-[#4a3f35]">New product</h1>
            <p className="text-xs text-neutral-600">
              Create, stock, images and configure options
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => handleSave(false)}
              disabled={busy}
              variant="outline"
              className="border-[#e3ddd5] text-[#5a4a3f]"
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save draft
            </Button>
            <Button
              onClick={() => handleSave(true)}
              disabled={busy}
              className="bg-[#8b6f47] text-white hover:bg-[#a78b62]"
              title="Save & publish (⌘/Ctrl+S uses current visibility)"
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Save & publish
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 grid gap-6 md:grid-cols-3">
        {/* Left column */}
        <div className="md:col-span-2 space-y-6">
          {/* Basics */}
          <Card className={ui.card}>
            <CardHeader>
              <CardTitle className={ui.brand}>Basics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Title" error={errors.title}>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Organic Cretan Mountain Tea"
                />
              </Field>

              <Field
                label="Slug"
                helper="Lowercase, numbers and dashes only"
                error={errors.slug}
              >
                <Input
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(e.target.value);
                  }}
                  placeholder="organic-cretan-mountain-tea"
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Price (€)" error={errors.price}>
                  <Input
                    inputMode="decimal"
                    type="number"
                    step="0.01"
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="12.90"
                  />
                </Field>
                <Field label="Currency">
                  <Input
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                  />
                </Field>
              </div>

              <Field label="Description">
                <Textarea
                  rows={6}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short, persuasive description that will appear on the product page…"
                />
              </Field>
            </CardContent>
          </Card>

          {/* Options & Category */}
          <Card className={ui.card}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-[#8b6f47]" />
                <span className={ui.brand}>Options</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Category + presets */}
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Category">
                  <select
                    className="rounded-md border border-[#e3ddd5] bg-white px-3 py-2 text-sm text-[#4a3f35]"
                    value={category}
                    onChange={(e) => applyCategoryPreset(e.target.value)}
                  >
                    <option value="other">Other</option>
                    <option value="clothing">Clothing</option>
                    <option value="food">Food</option>
                  </select>
                </Field>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    className={ui.outline}
                    onClick={() => applyCategoryPreset(category)}
                    title="Apply category preset"
                  >
                    Apply preset
                  </Button>
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    className={ui.outline}
                    onClick={autoGenerateVariantSkus}
                    title="Generate SKUs for all variants"
                  >
                    Auto-generate variant SKUs
                  </Button>
                </div>
              </div>

              {/* Add/remove option groups */}
              <div className="flex flex-wrap items-end gap-2">
                <div className="grow">
                  <div className="text-sm font-medium text-[#4a3f35]">
                    New option group
                  </div>
                  <Input
                    placeholder='e.g. "Size" or "Color"'
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                  />
                </div>
                <Button
                  onClick={addGroup}
                  className="bg-[#8b6f47] text-white hover:bg-[#a78b62]"
                >
                  <Plus className="mr-2 h-4 w-4" /> Add group
                </Button>
              </div>

              {optionGroups.length === 0 ? (
                <div className="rounded-lg border border-[#efe7db] bg-[#fffaf2] p-3 text-sm text-neutral-700">
                  Add groups like <b>Size</b> (S, M, L) or <b>Color</b> (Black,
                  White). Food preset uses <b>Size</b> (200ml, 1L).
                </div>
              ) : (
                <div className="space-y-3">
                  {optionGroups.map((g) => (
                    <div
                      key={g.name}
                      className="rounded-xl border border-[#f0ebe4] p-3"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <div className="font-medium text-[#4a3f35]">
                          {g.name}
                        </div>
                        <Button
                          variant="outline"
                          className="border-red-200 text-red-600 hover:bg-red-50"
                          onClick={() => removeGroup(g.name)}
                        >
                          <X className="h-4 w-4 mr-1" /> Remove group
                        </Button>
                      </div>
                      <ChipInput
                        placeholder="Type value and press Enter…"
                        values={g.values}
                        onAdd={(v) => addValue(g.name, v)}
                        onRemove={(v) => removeValue(g.name, v)}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="text-xs text-neutral-600">
                Variants preview: <b>{combinationsCount(optionGroups)}</b>{" "}
                combinations
              </div>
            </CardContent>
          </Card>

          {/* Variants / Stock matrix */}
          <Card className={ui.card}>
            <CardHeader>
              <CardTitle className={ui.brand}>Variant stock</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(() => {
                const g = (optionGroups || []).filter(
                  (x) => x?.values?.length > 0
                );
                if (g.length === 0) {
                  return (
                    <div className="rounded-lg border border-[#efe7db] bg-[#fffaf2] p-3 text-sm text-neutral-700">
                      Add at least one option group or apply a category preset
                      to manage per-variant stock.
                    </div>
                  );
                }
                if (g.length === 1) {
                  const [G] = g;
                  return (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-[#faf7f1] text-[#6b625a]">
                          <tr>
                            <th className="px-3 py-2 text-left">{G.name}</th>
                            <th className="px-3 py-2 text-left">SKU</th>
                            <th className="px-3 py-2 text-left">Stock</th>
                          </tr>
                        </thead>
                        <tbody>
                          {G.values.map((v) => {
                            const combo = { [G.name]: v };
                            const key = comboKey(combo);
                            const row = variantForm[key] || {
                              stock: 0,
                              sku: "",
                            };
                            return (
                              <tr key={v} className="border-t border-[#f0ebe4]">
                                <td className="px-3 py-2">{v}</td>
                                <td className="px-3 py-2">
                                  <Input
                                    placeholder="SKU"
                                    value={row.sku}
                                    onChange={(e) =>
                                      setVariantForm((prev) => ({
                                        ...prev,
                                        [key]: {
                                          ...(prev[key] || {}),
                                          sku: e.target.value.toUpperCase(),
                                        },
                                      }))
                                    }
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <Input
                                    type="number"
                                    min="0"
                                    value={row.stock}
                                    onChange={(e) =>
                                      setVariantForm((prev) => ({
                                        ...prev,
                                        [key]: {
                                          ...(prev[key] || {}),
                                          stock: Math.max(
                                            0,
                                            Number(e.target.value || 0)
                                          ),
                                        },
                                      }))
                                    }
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                }
                // two or more groups
                const [A, B, ...rest] = g;
                return (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[#faf7f1] text-[#6b625a]">
                        <tr>
                          <th className="px-3 py-2 text-left">
                            {A.name} \ {B.name}
                          </th>
                          {B.values.map((bv) => (
                            <th key={bv} className="px-3 py-2 text-left">
                              {bv}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {A.values.map((av) => (
                          <tr
                            key={av}
                            className="border-t border-[#f0ebe4] align-top"
                          >
                            <td className="px-3 py-2 font-medium text-[#4a3f35]">
                              {av}
                            </td>
                            {B.values.map((bv) => {
                              const base = { [A.name]: av, [B.name]: bv };
                              const key = comboKey(base);
                              const cell = variantForm[key] || {
                                stock: 0,
                                sku: "",
                              };
                              return (
                                <td key={bv} className="px-3 py-2">
                                  <div className="space-y-2">
                                    {rest.length > 0 ? (
                                      <div className="text-[11px] text-neutral-600">
                                        {rest.map((R) => (
                                          <div key={R.name}>
                                            {R.name}: {R.values.join(", ")}
                                          </div>
                                        ))}
                                      </div>
                                    ) : null}
                                    <Input
                                      placeholder="SKU"
                                      value={cell.sku}
                                      onChange={(e) =>
                                        setVariantForm((prev) => ({
                                          ...prev,
                                          [key]: {
                                            ...(prev[key] || {}),
                                            sku: e.target.value.toUpperCase(),
                                          },
                                        }))
                                      }
                                    />
                                    <Input
                                      type="number"
                                      min="0"
                                      placeholder="Stock"
                                      value={cell.stock}
                                      onChange={(e) =>
                                        setVariantForm((prev) => ({
                                          ...prev,
                                          [key]: {
                                            ...(prev[key] || {}),
                                            stock: Math.max(
                                              0,
                                              Number(e.target.value || 0)
                                            ),
                                          },
                                        }))
                                      }
                                    />
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Preview */}
          <Card className={ui.card}>
            <CardHeader>
              <CardTitle className={ui.brand}>Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-[#efe7db] bg-[#fffaf2] p-4">
                <div className="text-sm text-neutral-500">
                  How it might look:
                </div>
                <div className="mt-2 flex items-start gap-4">
                  <div className="h-16 w-16 overflow-hidden rounded bg-[#f3eee6] grid place-items-center">
                    {previewImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewImage}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-neutral-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-[#4a3f35]">
                      {title || "Product title"}
                    </div>
                    <div className="text-sm text-neutral-600 line-clamp-2">
                      {description || "Description preview…"}
                    </div>
                    <div className="mt-1 font-medium">
                      {safeMoney(price, currency)}
                    </div>
                  </div>
                </div>
              </div>
              {errors.submit ? (
                <div className="mt-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4" /> {errors.submit}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Visibility */}
          <Card className={ui.card}>
            <CardHeader>
              <CardTitle className={ui.brand}>Visibility</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between rounded-xl border border-[#e8e2d8] p-3">
              <div>
                <div className="text-sm font-medium text-[#4a3f35]">Active</div>
                <div className="text-xs text-neutral-600">
                  If off, the product will be saved as draft
                </div>
              </div>
              <Switch checked={active} onCheckedChange={setActive} />
            </CardContent>
          </Card>

          {/* Inventory (base) */}
          <Card className={ui.card}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Boxes className="h-5 w-5 text-[#8b6f47]" />
                <span className={ui.brand}>Inventory</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field label="SKU (unique)" error={errors.sku}>
                <div className="flex gap-2">
                  <div className="relative grow">
                    <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                    <Input
                      className="pl-9"
                      value={sku}
                      onChange={(e) => setSku(e.target.value.toUpperCase())}
                      placeholder="OAS-25-ABCD"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className={ui.outline}
                    onClick={() => setSku(genSku())}
                    title="Generate SKU"
                  >
                    Generate
                  </Button>
                </div>
              </Field>

              <Field
                label="Stock"
                error={errors.stock}
                helper="Fallback product-level inventory. Variant stock overrides this."
              >
                <Input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={stock}
                  onChange={(e) =>
                    setStock(Math.max(0, Number(e.target.value || 0)))
                  }
                />
              </Field>
            </CardContent>
          </Card>

          {/* Images (gallery) with Cloudinary widget */}
          <Card className={ui.card}>
            <CardHeader>
              <CardTitle className={ui.brand}>Images</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <CloudinaryWidget
                cloudName={process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}
                uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET}
                folder="oasis/products"
                multiple
                onUploaded={(assets = []) => {
                  // assets: array of uploadInfo objects
                  setImages((arr) => {
                    const seen = new Set(arr.map((x) => x.url));
                    const add = assets
                      .filter((a) => a?.secure_url && !seen.has(a.secure_url))
                      .map((a) => ({
                        url: a.secure_url,
                        alt: a.original_filename || "",
                      }));
                    return [...arr, ...add];
                  });
                }}
              >
                <Button className={ui.cta} type="button">
                  Upload images
                </Button>
              </CloudinaryWidget>

              <Field
                label="Add image by URL"
                helper="Paste one or many (one per line). First image is primary."
              >
                <div className="grid gap-2">
                  <Input
                    placeholder="https://… (single URL) — press Add"
                    value={imgUrl}
                    onChange={(e) => setImgUrl(e.target.value)}
                    onPaste={(e) => {
                      const txt = e.clipboardData.getData("text/plain");
                      if (txt && txt.includes("\n")) {
                        e.preventDefault();
                        addImagesBulkFromTextarea(txt);
                      }
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Alt text (optional)"
                      value={imgAlt}
                      onChange={(e) => setImgAlt(e.target.value)}
                    />
                    <Button className={ui.cta} type="button" onClick={addImage}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add
                    </Button>
                  </div>
                </div>
              </Field>

              {images.length === 0 ? (
                <div className="rounded-lg border border-[#efe7db] bg-[#fffaf2] p-3 text-sm text-neutral-700">
                  No images yet. Use the Cloudinary uploader or add URLs. The
                  first image is the <b>primary</b>.
                </div>
              ) : (
                <ul className="space-y-3">
                  {images.map((img, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-3 rounded-xl border border-[#eee4d6] bg-[#fffdfa] p-3"
                    >
                      <div className="h-14 w-14 overflow-hidden rounded-md bg-[#f3eee6] grid place-items-center flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {/^https?:\/\//.test(img.url) ? (
                          <img
                            src={img.url}
                            alt={img.alt || ""}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-neutral-400" />
                        )}
                      </div>

                      <div className="grid flex-1 gap-2 sm:grid-cols-2">
                        <Input
                          value={img.url}
                          onChange={(e) => updateImageUrl(i, e.target.value)}
                          placeholder="Image URL"
                        />
                        <Input
                          value={img.alt || ""}
                          onChange={(e) => updateImageAlt(i, e.target.value)}
                          placeholder="Alt text"
                        />
                      </div>

                      <div className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          className="rounded-md border border-[#eadfd2] p-1 hover:bg-[#faf7f1]"
                          onClick={() => moveImage(i, -1)}
                          title="Move up"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-[#eadfd2] p-1 hover:bg-[#faf7f1]"
                          onClick={() => moveImage(i, +1)}
                          title="Move down"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          className={`rounded-md border p-1 ${
                            i === 0
                              ? "border-[#d9cdbd] bg-[#efe7db]"
                              : "border-[#eadfd2] hover:bg-[#faf7f1]"
                          }`}
                          onClick={() => setPrimary(i)}
                          title="Set as primary"
                        >
                          <Star
                            className={`h-4 w-4 ${
                              i === 0 ? "fill-[#8b6f47] text-[#8b6f47]" : ""
                            }`}
                          />
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-red-200 p-1 text-red-600 hover:bg-red-50"
                          onClick={() => removeImage(i)}
                          title="Remove"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card className={ui.card}>
            <CardHeader>
              <CardTitle className={ui.brand}>Notes</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-neutral-700">
              Images are saved to <code>shop_image</code> with <code>sort</code>{" "}
              (0 = primary). Using Cloudinary avoids server body-size limits.
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
