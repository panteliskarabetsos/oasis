"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
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
  Sparkles,
  Tag,
  BadgeCheck,
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

/* ------------------------------ tiny utils ------------------------------ */
function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function genSku(prefix = "OAS") {
  const y = new Date().getFullYear().toString().slice(2);
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${y}-${rnd}`;
}

function safeMoney(priceStr, currency = "EUR") {
  const raw = String(priceStr ?? "")
    .replace(",", ".")
    .trim();
  const cents = Math.round(Number(raw || 0) * 100);
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

function toCents(priceStr) {
  const raw = String(priceStr ?? "")
    .replace(",", ".")
    .trim();
  const cents = Math.round(Number(raw || 0) * 100);
  return cents;
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

/* ------------------------------ UI tokens ------------------------------ */
const ui = {
  page: "min-h-screen bg-gradient-to-b from-zinc-50 via-stone-50 to-amber-50/40 text-zinc-900",
  container: "mx-auto max-w-6xl px-4 sm:px-6 py-6",
  card: "rounded-2xl border border-zinc-200/70 bg-white shadow-sm",
  softCard:
    "rounded-2xl border border-zinc-200/70 bg-white/70 backdrop-blur shadow-sm",
  outlineBtn: "border-zinc-200 bg-white hover:bg-zinc-50",
  primaryBtn: "bg-zinc-900 text-white hover:bg-zinc-800",
  dangerBtn: "border-red-200 text-red-600 hover:bg-red-50",
  muted: "text-zinc-600",
};

/* ------------------------------ Field UI ------------------------------ */
function Field({ label, helper, error, children }) {
  return (
    <div className="space-y-1.5">
      <div className="text-sm font-medium text-zinc-900">{label}</div>
      {children}
      {helper ? <div className="text-xs text-zinc-500">{helper}</div> : null}
      {error ? <div className="text-xs text-red-600">{error}</div> : null}
    </div>
  );
}

function Pill({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition",
        active
          ? "bg-zinc-900 text-white border-zinc-900"
          : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
      )}
    >
      {children}
    </button>
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
            className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-700"
          >
            {v}
            <button
              type="button"
              className="rounded-full p-1 hover:bg-zinc-100"
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
          className={ui.outlineBtn}
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

  // images
  const [images, setImages] = React.useState([]); // [{url, alt}]
  const [imgUrl, setImgUrl] = React.useState("");
  const [imgAlt, setImgAlt] = React.useState("");

  // inventory
  const [sku, setSku] = React.useState(genSku());
  const [stock, setStock] = React.useState(0);

  // category/options/variants
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
    setSlug(slugify(title));
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
      if (e.key === "Escape") {
        // convenience: clear submit error if present
        setErrors((prev) => {
          if (!prev?.submit) return prev;
          const next = { ...prev };
          delete next.submit;
          return next;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    const cents = toCents(price);
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

  async function handleSave(publish) {
    const { ok, next, cents, cleaned } = validate();
    setErrors(next);
    if (!ok) return;

    try {
      setBusy(true);

      // variants payload (one row per combo)
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
  const combosCount = combos.length;

  const issuesCount = React.useMemo(() => {
    const keys = Object.keys(errors || {});
    return keys.length;
  }, [errors]);

  return (
    <div className={ui.page}>
      {/* Sticky header */}
      <div className="sticky top-0 z-40 border-b border-zinc-200/70 bg-white/75 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/eshop?tab=products"
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold tracking-tight">
                  New product
                </h1>
                <span
                  className={cx(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                    active
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-zinc-50 text-zinc-700 border-zinc-200"
                  )}
                >
                  {active ? (
                    <BadgeCheck className="h-3.5 w-3.5" />
                  ) : (
                    <Tag className="h-3.5 w-3.5" />
                  )}
                  {active ? "Active" : "Draft"}
                </span>
                {issuesCount ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {issuesCount} issue{issuesCount === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>
              <div className="text-xs text-zinc-500">
                ⌘/Ctrl+S saves with current visibility • Escape clears submit
                error
              </div>
            </div>
          </div>

          <div className="sm:ml-auto flex flex-wrap items-center gap-2">
            <div className="hidden md:flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2">
              <div className="text-xs text-zinc-500">Preview price</div>
              <div className="text-sm font-semibold text-zinc-900">
                {safeMoney(price, currency)}
              </div>
            </div>

            <Button
              onClick={() => handleSave(false)}
              disabled={busy}
              variant="outline"
              className={ui.outlineBtn}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save draft
            </Button>

            <Button
              onClick={() => handleSave(true)}
              disabled={busy}
              className={ui.primaryBtn}
              title="Save & publish"
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

      <div className={ui.container}>
        <div className="grid gap-6 md:grid-cols-3">
          {/* Left: main form */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="md:col-span-2 space-y-6"
          >
            {/* Basics */}
            <Card className={ui.card}>
              <CardHeader className="border-b border-zinc-200/70 bg-zinc-50/70">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-amber-700" />
                  Basics
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 sm:p-6 space-y-4">
                <Field
                  label="Title"
                  error={errors.title}
                  helper="Customer-facing product name."
                >
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Organic Cretan Mountain Tea"
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Slug"
                    helper="Lowercase letters, numbers and dashes only."
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

                  <Field label="Visibility">
                    <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-4 py-3">
                      <div>
                        <div className="text-sm font-medium text-zinc-900">
                          Active
                        </div>
                        <div className="text-xs text-zinc-600">
                          If off, it saves as a draft.
                        </div>
                      </div>
                      <Switch checked={active} onCheckedChange={setActive} />
                    </div>
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Price"
                    error={errors.price}
                    helper="Use decimals (e.g. 12.90)."
                  >
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

                  <Field
                    label="Currency"
                    helper="3-letter code (EUR, USD, GBP)."
                  >
                    <Input
                      value={currency}
                      onChange={(e) =>
                        setCurrency(e.target.value.toUpperCase())
                      }
                      placeholder="EUR"
                    />
                  </Field>
                </div>

                <Field
                  label="Description"
                  helper="Short, persuasive description for the product page."
                >
                  <Textarea
                    rows={6}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Short description that will appear on the product page…"
                  />
                </Field>
              </CardContent>
            </Card>

            {/* Options */}
            <Card className={ui.card}>
              <CardHeader className="border-b border-zinc-200/70 bg-zinc-50/70">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Settings2 className="h-4 w-4 text-amber-700" />
                  Options & variants
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 sm:p-6 space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-zinc-900">
                      Category presets
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Pill
                        active={category === "other"}
                        onClick={() => applyCategoryPreset("other")}
                      >
                        Other
                      </Pill>
                      <Pill
                        active={category === "clothing"}
                        onClick={() => applyCategoryPreset("clothing")}
                      >
                        Clothing
                      </Pill>
                      <Pill
                        active={category === "food"}
                        onClick={() => applyCategoryPreset("food")}
                      >
                        Food
                      </Pill>
                    </div>
                    <div className="text-xs text-zinc-500">
                      Presets replace your option groups (good starting point).
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className={ui.outlineBtn}
                      onClick={autoGenerateVariantSkus}
                    >
                      Auto-generate variant SKUs
                    </Button>
                  </div>
                </div>

                {/* add group */}
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-zinc-900">
                        Add option group
                      </div>
                      <div className="text-xs text-zinc-500">
                        Examples: Size, Color, Material.
                      </div>
                      <Input
                        placeholder='e.g. "Size"'
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        className="mt-2"
                      />
                    </div>
                    <Button onClick={addGroup} className={ui.primaryBtn}>
                      <Plus className="mr-2 h-4 w-4" /> Add group
                    </Button>
                  </div>
                </div>

                {optionGroups.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-6 text-sm text-zinc-700">
                    Add groups like <b>Size</b> (S, M, L) or <b>Color</b>{" "}
                    (Black, White).
                    <div className="mt-2 text-xs text-zinc-500">
                      Or click a preset above.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {optionGroups.map((g) => (
                      <div
                        key={g.name}
                        className="rounded-2xl border border-zinc-200 bg-white p-4"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="text-sm font-semibold text-zinc-900">
                              {g.name}
                            </div>
                            <div className="text-xs text-zinc-500">
                              Add values (press Enter to commit).
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            className={ui.dangerBtn}
                            onClick={() => removeGroup(g.name)}
                          >
                            <X className="h-4 w-4 mr-2" />
                            Remove
                          </Button>
                        </div>

                        <div className="mt-3">
                          <ChipInput
                            placeholder="Type a value and press Enter…"
                            values={g.values}
                            onAdd={(v) => addValue(g.name, v)}
                            onRemove={(v) => removeValue(g.name, v)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                  <div className="text-sm text-zinc-700">
                    Variants count:{" "}
                    <span className="font-semibold text-zinc-900">
                      {combosCount}
                    </span>
                  </div>
                  {combosCount > 200 ? (
                    <div className="text-xs text-amber-700">
                      Large variant set — consider fewer options for easier
                      management.
                    </div>
                  ) : (
                    <div className="text-xs text-zinc-500">
                      Variant stock overrides base stock.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Variant stock */}
            <Card className={ui.card}>
              <CardHeader className="border-b border-zinc-200/70 bg-zinc-50/70">
                <CardTitle className="text-base">Variant stock</CardTitle>
              </CardHeader>
              <CardContent className="p-5 sm:p-6 space-y-4">
                {(() => {
                  const g = (optionGroups || []).filter(
                    (x) => x?.values?.length > 0
                  );
                  if (g.length === 0) {
                    return (
                      <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-6 text-sm text-zinc-700">
                        Add at least one option group to manage per-variant
                        stock.
                      </div>
                    );
                  }

                  // 1 group -> list
                  if (g.length === 1) {
                    const [G] = g;
                    return (
                      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
                        <table className="min-w-full text-sm">
                          <thead className="bg-zinc-50 text-zinc-600">
                            <tr className="border-b border-zinc-200">
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
                                <tr
                                  key={v}
                                  className="border-b border-zinc-100"
                                >
                                  <td className="px-3 py-2 font-medium text-zinc-900">
                                    {v}
                                  </td>
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

                  // 2 groups -> matrix (nice UX)
                  if (g.length === 2) {
                    const [A, B] = g;
                    return (
                      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
                        <table className="min-w-full text-sm">
                          <thead className="bg-zinc-50 text-zinc-600">
                            <tr className="border-b border-zinc-200">
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
                                className="border-b border-zinc-100 align-top"
                              >
                                <td className="px-3 py-2 font-medium text-zinc-900">
                                  {av}
                                </td>
                                {B.values.map((bv) => {
                                  const combo = { [A.name]: av, [B.name]: bv };
                                  const key = comboKey(combo);
                                  const cell = variantForm[key] || {
                                    stock: 0,
                                    sku: "",
                                  };
                                  return (
                                    <td key={bv} className="px-3 py-2">
                                      <div className="space-y-2 min-w-[170px]">
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
                  }

                  // 3+ groups -> correct list view per combo (fixes the old UI limitation)
                  const cols = g.map((x) => x.name);
                  const rows = combos.slice(0, 250); // guard UI
                  return (
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        You have <b>{combosCount}</b> combinations. For 3+
                        option groups, variants are shown as a list.
                        {combosCount > 250 ? (
                          <span className="ml-1">
                            (Showing first 250 for performance.)
                          </span>
                        ) : null}
                      </div>

                      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
                        <table className="min-w-full text-sm">
                          <thead className="bg-zinc-50 text-zinc-600">
                            <tr className="border-b border-zinc-200">
                              {cols.map((c) => (
                                <th key={c} className="px-3 py-2 text-left">
                                  {c}
                                </th>
                              ))}
                              <th className="px-3 py-2 text-left">SKU</th>
                              <th className="px-3 py-2 text-left">Stock</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((combo) => {
                              const key = comboKey(combo);
                              const cell = variantForm[key] || {
                                stock: 0,
                                sku: "",
                              };
                              return (
                                <tr
                                  key={key}
                                  className="border-b border-zinc-100"
                                >
                                  {cols.map((c) => (
                                    <td
                                      key={c}
                                      className="px-3 py-2 font-medium text-zinc-900"
                                    >
                                      {combo[c]}
                                    </td>
                                  ))}
                                  <td className="px-3 py-2">
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
                                  </td>
                                  <td className="px-3 py-2">
                                    <Input
                                      type="number"
                                      min="0"
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
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Preview + submit error */}
            <Card className={ui.softCard}>
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-start gap-4">
                  <div className="h-16 w-16 overflow-hidden rounded-2xl border border-zinc-200 bg-white grid place-items-center">
                    {previewImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewImage}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-zinc-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold text-zinc-900">
                      {title || "Product title"}
                    </div>
                    <div className="mt-1 text-sm text-zinc-600 line-clamp-2">
                      {description || "Description preview…"}
                    </div>
                    <div className="mt-2 text-sm font-semibold text-zinc-900">
                      {safeMoney(price, currency)}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      Slug: <span className="font-mono">{slug || "—"}</span>
                    </div>
                  </div>
                </div>

                {errors.submit ? (
                  <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertCircle className="mt-0.5 h-4 w-4" />
                    <div className="min-w-0">
                      <div className="font-medium">Couldn’t save</div>
                      <div className="text-red-700/90">{errors.submit}</div>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </motion.div>

          {/* Right: controls */}
          <motion.aside
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, delay: 0.04 }}
            className="space-y-6"
          >
            {/* Inventory */}
            <Card className={ui.card}>
              <CardHeader className="border-b border-zinc-200/70 bg-zinc-50/70">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Boxes className="h-4 w-4 text-amber-700" />
                  Inventory
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-3">
                <Field
                  label="SKU (unique)"
                  error={errors.sku}
                  helper="Used for warehouse/admin reference."
                >
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
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
                      className={ui.outlineBtn}
                      onClick={() => setSku(genSku())}
                    >
                      Generate
                    </Button>
                  </div>
                </Field>

                <Field
                  label="Base stock"
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

            {/* Images */}
            <Card className={ui.card}>
              <CardHeader className="border-b border-zinc-200/70 bg-zinc-50/70">
                <CardTitle className="text-base">Images</CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <CloudinaryWidget
                  cloudName={process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}
                  uploadPreset={
                    process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
                  }
                  folder="oasis/products"
                  multiple
                  onUploaded={(assets = []) => {
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
                  <Button className={ui.primaryBtn} type="button">
                    Upload images
                  </Button>
                </CloudinaryWidget>

                <Field
                  label="Add by URL"
                  helper="Paste one or many (one per line). First image is primary."
                >
                  <div className="grid gap-2">
                    <Input
                      placeholder="https://… (single URL)"
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
                      <Button
                        className={ui.primaryBtn}
                        type="button"
                        onClick={addImage}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add
                      </Button>
                    </div>
                  </div>
                </Field>

                {images.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-5 text-sm text-zinc-700">
                    No images yet. Upload via Cloudinary or add URLs.
                    <div className="mt-1 text-xs text-zinc-500">
                      Tip: set the best image as primary (⭐).
                    </div>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {images.map((img, i) => (
                      <li
                        key={i}
                        className="rounded-2xl border border-zinc-200 bg-white p-3"
                      >
                        <div className="flex items-start gap-3">
                          <div className="h-14 w-14 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 grid place-items-center flex-shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {/^https?:\/\//.test(img.url) ? (
                              <img
                                src={img.url}
                                alt={img.alt || ""}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <ImageIcon className="h-5 w-5 text-zinc-400" />
                            )}
                          </div>

                          <div className="grid flex-1 gap-2">
                            <Input
                              value={img.url}
                              onChange={(e) =>
                                updateImageUrl(i, e.target.value)
                              }
                              placeholder="Image URL"
                            />
                            <Input
                              value={img.alt || ""}
                              onChange={(e) =>
                                updateImageAlt(i, e.target.value)
                              }
                              placeholder="Alt text"
                            />
                          </div>

                          <div className="flex flex-col items-center gap-2">
                            <button
                              type="button"
                              className="rounded-xl border border-zinc-200 bg-white p-2 hover:bg-zinc-50"
                              onClick={() => moveImage(i, -1)}
                              title="Move up"
                            >
                              <ArrowUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="rounded-xl border border-zinc-200 bg-white p-2 hover:bg-zinc-50"
                              onClick={() => moveImage(i, +1)}
                              title="Move down"
                            >
                              <ArrowDown className="h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              className={cx(
                                "rounded-xl border p-2",
                                i === 0
                                  ? "border-amber-200 bg-amber-50"
                                  : "border-zinc-200 bg-white hover:bg-zinc-50"
                              )}
                              onClick={() => setPrimary(i)}
                              title="Set as primary"
                            >
                              <Star
                                className={cx(
                                  "h-4 w-4",
                                  i === 0
                                    ? "fill-amber-600 text-amber-600"
                                    : "text-zinc-700"
                                )}
                              />
                            </button>

                            <button
                              type="button"
                              className="rounded-xl border border-red-200 bg-white p-2 text-red-600 hover:bg-red-50"
                              onClick={() => removeImage(i)}
                              title="Remove"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {i === 0 ? (
                          <div className="mt-2 text-xs text-amber-700">
                            Primary image (sort 0)
                          </div>
                        ) : (
                          <div className="mt-2 text-xs text-zinc-500">
                            Sort: {i}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Notes */}
            <Card className={ui.softCard}>
              <CardContent className="p-5 text-sm text-zinc-700">
                Images are saved to{" "}
                <code className="rounded bg-zinc-100 px-1">shop_image</code>{" "}
                with <code className="rounded bg-zinc-100 px-1">sort</code> (0 =
                primary). Cloudinary helps avoid upload body-size limits.
              </CardContent>
            </Card>
          </motion.aside>
        </div>
      </div>
    </div>
  );
}
