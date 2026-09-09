"use client";

import React from "react";
import Link from "next/link";

import { Edit, Image as ImageIcon, LayoutDashboard, ListOrdered, Loader2, Mail, PackageSearch, Search, Settings } from "lucide-react";

// shadcn/ui

import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";

import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";

import Icon from "../_ui/Icon";
import { Badge as UIBadge, Button as UIButton, Card as UICard, EmptyState as UIEmptyState, ErrorNote, Field, Muted, Page, PageHeader, Select as UISelect, Skeleton, StatCard, StatusBadge as UIStatusBadge, Table, Td, Th, Tr, inputClass } from "../_ui";

/* -------------------------------------------------------------
   Small utils
------------------------------------------------------------- */
function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function formatCents(cents, currency = "EUR") {
  const v = Number(cents || 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(v);
  } catch {
    return `€${v.toFixed(2)}`;
  }
}

function formatDate(s) {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d) ? String(s) : d.toLocaleString();
}

function centsFromInput(value) {
  // accepts "12", "12.3", "12,30"
  const normalized = String(value || "")
    .replace(",", ".")
    .trim();
  const n = Number(normalized);
  if (!isFinite(n)) return 0;
  return Math.round(n * 100);
}
function inputFromCents(cents) {
  const v = Number(cents || 0) / 100;
  return String(v.toFixed(2));
}

/* -------------------------------------------------------------
   Visual tokens
------------------------------------------------------------- */
const ui = {
  page: "min-h-screen bg-[#f7f4ef] text-[#2a211a]",
  container: "mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8",
  panel:
    "rounded-2xl border border-[#e6e0d6] bg-white shadow-[0_1px_2px_rgba(42,33,26,0.04)]",
  card:
    "rounded-2xl border border-[#e6e0d6] bg-white shadow-[0_1px_2px_rgba(42,33,26,0.04)]",
  softCard:
    "rounded-2xl border border-[#e6e0d6] bg-[#fdfbf7] shadow-[0_1px_2px_rgba(42,33,26,0.04)]",
  muted: "text-[#7a6a5f]",
  brand: "text-[#2a211a]",
  accent: "text-[#8b6f47]",
  outlineBtn: "border-[#e6e0d6] bg-white hover:border-[#c9b393] hover:bg-[#fdfbf7]",
  dangerBtn: "border-[#f3d5cb] text-[#a33c22] hover:bg-[#fbeae5]",
  primaryBtn: "bg-[#8b6f47] text-white hover:bg-[#7a6039]",
};

/* -------------------------------------------------------------
   Page
------------------------------------------------------------- */
export default function AdminEshopManagePage() {
  const [tab, setTab] = React.useState("overview");

  // shortcuts: g then {o,p,r,i,s,t}
  React.useEffect(() => {
    let g = false;
    const onKey = (e) => {
      const target = e.target;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (typing) return;

      if (e.key.toLowerCase() === "g") {
        g = true;
        setTimeout(() => (g = false), 650);
        return;
      }
      if (!g) return;
      const k = e.key.toLowerCase();
      if (k === "o") setTab("overview");
      if (k === "p") setTab("products");
      if (k === "r") setTab("orders");
      if (k === "i") setTab("images");
      if (k === "s") setTab("subscribers");
      if (k === "t") setTab("settings");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const nav = [
    { key: "overview", label: "Overview", icon: LayoutDashboard, blurb: "How the shop is trading right now." },
    { key: "products", label: "Products", icon: PackageSearch, blurb: "Catalogue, pricing and stock on hand." },
    { key: "orders", label: "Orders", icon: ListOrdered, blurb: "Fulfilment queue and order history." },
    { key: "images", label: "Images", icon: ImageIcon, blurb: "Product photography." },
    { key: "subscribers", label: "Subscribers", icon: Mail, blurb: "Newsletter list." },
    { key: "settings", label: "Settings", icon: Settings, blurb: "Shop availability and storefront copy." },
  ];

  const current = nav.find((n) => n.key === tab);

  return (
    <Page className="pb-10">
      <PageHeader
        eyebrow="Growth"
        title="e-Shop"
        description={current?.blurb ?? "Products, orders, images, subscribers and shop availability."}
        actions={
          <>
            <UIButton as="a" href="/shop" target="_blank" rel="noreferrer" variant="secondary">
              <Icon name="external" size={15} /> Storefront
            </UIButton>
            <UIButton as={Link} href="/admin/eshop/new-product" variant="primary">
              <Icon name="plus" size={15} /> New product
            </UIButton>
          </>
        }
      />

      {/* section switch */}
      <div className="mb-5 flex flex-wrap gap-1.5">
        {nav.map((it) => (
          <button
            key={it.key}
            onClick={() => setTab(it.key)}
            className={cx(
              "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-colors",
              tab === it.key
                ? "bg-[#2a211a] text-white"
                : "bg-white text-[#6b5c4d] ring-1 ring-inset ring-[#e6e0d6] hover:bg-[#f2ede4]",
            )}
          >
            <it.icon className="h-4 w-4" />
            {it.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? <OverviewSection /> : null}
      {tab === "products" ? <ProductsSection /> : null}
      {tab === "orders" ? <OrdersSection /> : null}
      {tab === "images" ? <ImagesSection /> : null}
      {tab === "subscribers" ? <SubscribersSection /> : null}
      {tab === "settings" ? <SettingsSection /> : null}
    </Page>
  );
}

function OverviewSection() {
  const [loading, setLoading] = React.useState(true);
  const [stats, setStats] = React.useState({
    productCount: 0,
    activeProductCount: 0,
    ordersPendingCount: 0,
    revenue30dCents: 0,
  });
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/admin/shop/stats", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load stats");
        setStats(data);
        setError("");
      } catch (err) {
        setError(String(err.message || err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-5">
      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {loading ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <StatCard
              label="Products"
              value={stats.productCount ?? 0}
              hint={`${stats.activeProductCount ?? 0} live`}
              icon={<Icon name="bag" size={16} />}
            />
            <StatCard
              label="Live products"
              value={stats.activeProductCount ?? 0}
              hint="Visible in the shop"
              accent="info"
              icon={<Icon name="check" size={16} />}
            />
            <StatCard
              label="Orders to fulfil"
              value={stats.ordersPendingCount ?? 0}
              hint="Awaiting action"
              accent={stats.ordersPendingCount > 0 ? "warning" : "brand"}
              icon={<Icon name="inbox" size={16} />}
            />
            <StatCard
              label="Revenue"
              value={formatCents(stats.revenue30dCents ?? 0)}
              hint="Last 30 days"
              accent="success"
              icon={<Icon name="chart" size={16} />}
            />
          </>
        )}
      </div>

      <UICard>
        <h2 className="font-serif text-[17px] text-[#2a211a]">Getting things done</h2>
        <Muted className="mt-0.5 text-[12px]">
          The usual jobs, in the order they normally come up.
        </Muted>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {[
            ["Add a product", "Create it, set a price and put stock against it.", "/admin/eshop/new-product"],
            ["Fulfil orders", "Work the queue and mark orders as they ship.", null],
          ].map(([title, body, href]) => (
            <div
              key={title}
              className="rounded-2xl border border-[#e6e0d6] bg-[#fdfbf7] px-4 py-3"
            >
              <p className="text-[13.5px] font-semibold text-[#2a211a]">{title}</p>
              <p className="mt-0.5 text-[12px] text-[#7a6a5f]">{body}</p>
              {href ? (
                <UIButton as={Link} href={href} size="sm" variant="secondary" className="mt-2.5">
                  Open
                </UIButton>
              ) : null}
            </div>
          ))}
        </div>
      </UICard>
    </div>
  );
}

function ProductsSection() {
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState([]);
  const [error, setError] = React.useState("");
  const [editing, setEditing] = React.useState(null);

  const [activeFilter, setActiveFilter] = React.useState("all"); // all|active|inactive

  // sort & paging (client-side)
  const [sort, setSort] = React.useState({ key: "updated_at", dir: "desc" });
  const [page, setPage] = React.useState(1);
  const [size, setSize] = React.useState(10);

  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(id);
  }, [search]);

  const fetchProducts = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/admin/shop/products?search=${encodeURIComponent(debounced)}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to fetch products");
      setItems(Array.isArray(data) ? data : []);
      setError("");
      setPage(1);
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setLoading(false);
    }
  }, [debounced]);

  React.useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const toggleActive = async (prod) => {
    const prev = prod.active;
    setItems((list) =>
      list.map((p) => (p.id === prod.id ? { ...p, active: !p.active } : p))
    );
    try {
      const res = await fetch(`/api/admin/shop/products/${prod.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !prev }),
      });
      if (!res.ok) {
        setItems((list) =>
          list.map((p) => (p.id === prod.id ? { ...p, active: prev } : p))
        );
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to update");
      }
    } catch (err) {
      alert(err.message || String(err));
    }
  };

  const removeProduct = async (prod) => {
    if (!confirm(`Delete “${prod.title}”? This cannot be undone.`)) return;
    const prev = items;
    setItems((list) => list.filter((p) => p.id !== prod.id));
    try {
      const res = await fetch(`/api/admin/shop/products/${prod.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setItems(prev);
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to delete");
      }
    } catch (err) {
      alert(err.message || String(err));
    }
  };

  function sortBy(key) {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  }

  const prepared = React.useMemo(() => {
    let arr = [...items];

    if (activeFilter === "active") arr = arr.filter((p) => !!p.active);
    if (activeFilter === "inactive") arr = arr.filter((p) => !p.active);

    const { key, dir } = sort;
    arr.sort((a, b) => {
      const va = a[key] ?? (key === "updated_at" ? a.updatedAt : null);
      const vb = b[key] ?? (key === "updated_at" ? b.updatedAt : null);
      if (key === "price_cents")
        return (Number(va) - Number(vb)) * (dir === "asc" ? 1 : -1);
      return (
        String(va || "").localeCompare(String(vb || ""), undefined, {
          numeric: true,
        }) * (dir === "asc" ? 1 : -1)
      );
    });
    return arr;
  }, [items, sort, activeFilter]);

  const maxPage = Math.max(1, Math.ceil(prepared.length / size));
  const pageRows = React.useMemo(
    () => prepared.slice((page - 1) * size, (page - 1) * size + size),
    [prepared, page, size]
  );

  const totals = React.useMemo(() => {
    const total = items.length;
    const active = items.filter((p) => !!p.active).length;
    return { total, active, inactive: total - active };
  }, [items]);

  React.useEffect(() => {
    setPage(1);
  }, [activeFilter, size]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Products" value={totals.total} icon={<Icon name="bag" size={16} />} />
        <StatCard label="Live" value={totals.active} accent="success" icon={<Icon name="check" size={16} />} />
        <StatCard label="Hidden" value={totals.inactive} accent="warning" icon={<Icon name="x" size={16} />} />
      </div>

      <UICard padded={false} className="overflow-hidden">
        <div className="border-b border-[#e6e0d6]">
          <div className="flex flex-wrap items-center gap-2 p-4 pb-3">
            <div className="relative min-w-[240px] flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#b0a294]">
                <Icon name="search" size={16} />
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search a product by name or slug"
                className={`${inputClass} h-11 pl-9 ${search ? "pr-9" : ""}`}
              />
              {search ? (
                <button
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#9a8c7e] hover:bg-[#f2ede4]"
                >
                  <Icon name="x" size={14} />
                </button>
              ) : null}
            </div>

            <div className="inline-flex rounded-xl border border-[#e6e0d6] bg-[#fdfbf7] p-1">
              {[
                ["all", "All"],
                ["active", "Live"],
                ["inactive", "Hidden"],
              ].map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setActiveFilter(v)}
                  className={cx(
                    "rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
                    activeFilter === v
                      ? "bg-[#2a211a] text-white"
                      : "text-[#6b5c4d] hover:bg-[#f2ede4]",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <UIButton as={Link} href="/admin/eshop/new-product" variant="primary" className="h-11">
              <Icon name="plus" size={15} /> New
            </UIButton>
          </div>
        </div>

        {error ? (
          <div className="p-5">
            <ErrorNote>{error}</ErrorNote>
            <UIButton className="mt-3" variant="secondary" onClick={fetchProducts}>
              Try again
            </UIButton>
          </div>
        ) : loading ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : !pageRows.length ? (
          <UIEmptyState
            icon={<Icon name="bag" size={20} />}
            title={items.length ? "No matches" : "No products yet"}
            description={
              items.length
                ? "Nothing matches that search or filter."
                : "Create your first product to start selling."
            }
            action={
              items.length ? (
                <UIButton
                  variant="secondary"
                  onClick={() => {
                    setSearch("");
                    setActiveFilter("all");
                  }}
                >
                  Clear filters
                </UIButton>
              ) : (
                <UIButton as={Link} href="/admin/eshop/new-product" variant="primary">
                  New product
                </UIButton>
              )
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <SortTh label="Product" k="title" sort={sort} onSort={sortBy} />
                <SortTh label="Price" k="price_cents" sort={sort} onSort={sortBy} align="right" />
                <SortTh label="Stock" k="stock_qty" sort={sort} onSort={sortBy} />
                <Th>State</Th>
                <SortTh label="Updated" k="updated_at" sort={sort} onSort={sortBy} />
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((p) => (
                <Tr key={p.id}>
                  <Td>
                    <span className="block font-semibold text-[#2a211a]">{p.title}</span>
                    <span className="block font-mono text-[11px] text-[#9a8c7e]">
                      {p.slug}
                      {p.sku_code ? ` · ${p.sku_code}` : ""}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap text-right font-semibold">
                    {formatCents(p.price_cents, p.currency)}
                  </Td>
                  <Td>
                    <StockCell product={p} onSaved={fetchProducts} />
                  </Td>
                  <Td>
                    <button
                      onClick={() => toggleActive(p)}
                      title={p.active ? "Hide from the shop" : "Show in the shop"}
                    >
                      <UIBadge variant={p.active ? "success" : "neutral"}>
                        {p.active ? "Live" : "Hidden"}
                      </UIBadge>
                    </button>
                  </Td>
                  <Td className="whitespace-nowrap text-[#7a6a5f]">
                    {p.updated_at ? formatDate(p.updated_at) : "—"}
                  </Td>
                  <Td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditing(p)}
                        title="Edit product"
                        className="rounded-lg p-1.5 text-[#7a6a5f] hover:bg-[#f2ede4] hover:text-[#2a211a]"
                      >
                        <Icon name="file" size={15} />
                      </button>
                      <button
                        onClick={() => removeProduct(p)}
                        title="Delete product"
                        className="rounded-lg p-1.5 text-[#7a6a5f] hover:bg-[#fbeae5] hover:text-[#a33c22]"
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}

        {!loading && !error && prepared.length ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e6e0d6] px-4 py-3">
            <div className="flex items-center gap-2">
              <Muted className="text-[12px]">
                Page {page} of {maxPage} · {prepared.length} product
                {prepared.length === 1 ? "" : "s"}
              </Muted>
              <UISelect
                value={String(size)}
                onChange={(e) => setSize(Number(e.target.value))}
                className="h-8 !w-auto text-[12px]"
                aria-label="Rows per page"
              >
                {[10, 25, 50].map((n) => (
                  <option key={n} value={n}>
                    {n} / page
                  </option>
                ))}
              </UISelect>
            </div>
            <div className="flex items-center gap-2">
              <UIButton size="sm" variant="secondary" disabled={page <= 1}
                onClick={() => setPage((x) => Math.max(1, x - 1))}>
                Previous
              </UIButton>
              <UIButton size="sm" variant="secondary" disabled={page >= maxPage}
                onClick={() => setPage((x) => Math.min(maxPage, x + 1))}>
                Next
              </UIButton>
            </div>
          </div>
        ) : null}
      </UICard>

      {editing ? (
        <ProductModal
          existing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            fetchProducts();
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * Stock, editable in place.
 *
 * Restocking is the routine job, and until now stock could only be set once at
 * product creation — the list never returned it and the update route never
 * accepted it, so the figure the POS enforces went stale immediately.
 */
function StockCell({ product, onSaved }) {
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(String(product.stock_qty ?? 0));
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setValue(String(product.stock_qty ?? 0));
  }, [product.stock_qty]);

  const qty = Number(product.stock_qty);
  const known = Number.isFinite(qty);

  async function save() {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) {
      setValue(String(product.stock_qty ?? 0));
      setEditing(false);
      return;
    }
    if (n === product.stock_qty) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/shop/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ stock_qty: n }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Could not update stock");
      }
      onSaved?.();
    } catch (e) {
      window.alert(e.message || "Could not update stock");
      setValue(String(product.stock_qty ?? 0));
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        min="0"
        step="1"
        value={value}
        disabled={saving}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") {
            setValue(String(product.stock_qty ?? 0));
            setEditing(false);
          }
        }}
        className="w-20 rounded-lg border border-[#d9d0c3] px-2 py-1 text-sm focus:border-[#2a211a] focus:outline-none"
      />
    );
  }

  const tone = !known
    ? "text-[#b0a294]"
    : qty === 0
      ? "bg-[#fbeae5] text-[#a33c22] ring-[#f3d5cb]"
      : qty <= 5
        ? "bg-[#fbf1dc] text-[#8a6412] ring-[#f0e0bb]"
        : "bg-[#faf8f4] text-[#6b5c4d] ring-[#e6e0d6]";

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Click to change stock"
      className={cx(
        "inline-flex min-w-[54px] items-center justify-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset transition-colors hover:brightness-95",
        tone,
      )}
    >
      {!known ? "—" : qty === 0 ? "Out" : qty}
    </button>
  );
}

function SortTh({ label, k, sort, onSort, align }) {
  const active = sort.key === k;
  return (
    <Th className={align === "right" ? "text-right" : ""}>
      <button
        onClick={() => onSort(k)}
        className={cx(
          "inline-flex items-center gap-1 uppercase tracking-[0.14em] hover:text-[#2a211a]",
          active && "text-[#2a211a]",
        )}
      >
        {label}
        <span className={active ? "opacity-100" : "opacity-0"}>
          {sort.dir === "asc" ? "▲" : "▼"}
        </span>
      </button>
    </Th>
  );
}
function ProductModal({ existing, onClose, onSaved }) {
  const [title, setTitle] = React.useState(existing?.title || "");
  const [slug, setSlug] = React.useState(existing?.slug || "");
  const [price, setPrice] = React.useState(
    inputFromCents(existing?.price_cents || 0)
  );
  const [currency, setCurrency] = React.useState(existing?.currency || "EUR");
  const [description, setDescription] = React.useState(
    existing?.description || ""
  );
  const [active, setActive] = React.useState(!!existing?.active);
  const [stock, setStock] = React.useState(String(existing?.stock_qty ?? 0));
  const [sku, setSku] = React.useState(existing?.sku_code || "");
  const [category, setCategory] = React.useState(existing?.category || "other");

  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState("");

  const save = async () => {
    try {
      setSaving(true);
      setErr("");

      const stockValue = Number(stock);
      if (!Number.isInteger(stockValue) || stockValue < 0) {
        setErr("Stock must be a whole number of 0 or more.");
        setSaving(false);
        return;
      }

      const payload = {
        title,
        slug,
        price_cents: centsFromInput(price),
        currency,
        description,
        active,
        stock_qty: stockValue,
        sku_code: sku.trim() || null,
        category,
      };

      const res = await fetch(`/api/admin/shop/products/${existing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to save product");

      onSaved?.();
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setSaving(false);
    }
  };

  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-[#e6e0d6] bg-white p-6 shadow-2xl sm:rounded-3xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-serif text-[19px] text-[#2a211a]">Edit product</h2>
            <p className="mt-0.5 font-mono text-[12px] text-[#9a8c7e]">{existing?.slug}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-[#9a8c7e] hover:bg-[#f2ede4]"
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <Field label="Title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Slug" hint="Used in the storefront URL.">
            <input value={slug} onChange={(e) => setSlug(e.target.value)} className={`${inputClass} font-mono`} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={`Price (${currency})`}>
              <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" className={inputClass} />
            </Field>
            <Field label="Currency">
              <UISelect value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {["EUR", "USD", "GBP"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </UISelect>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Stock" hint="The POS blocks a sale at zero.">
              <input
                type="number" min="0" step="1"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="SKU" hint="Scanned at the till.">
              <input value={sku} onChange={(e) => setSku(e.target.value)} className={`${inputClass} font-mono`} />
            </Field>
          </div>

          <Field label="Category">
            <UISelect value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="clothing">Clothing</option>
              <option value="food">Food</option>
              <option value="other">Other</option>
            </UISelect>
          </Field>

          <Field label="Description">
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${inputClass} h-auto py-2 leading-relaxed`}
            />
          </Field>

          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 accent-[#8b6f47]"
            />
            <span className="text-[13px] text-[#2a211a]">Show in the shop</span>
          </label>
        </div>

        {err ? <ErrorNote className="mt-3">{err}</ErrorNote> : null}

        <div className="mt-5 flex justify-end gap-2 border-t border-[#f0ebe2] pt-4">
          <UIButton variant="secondary" onClick={onClose}>Cancel</UIButton>
          <UIButton variant="primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </UIButton>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------
   Orders
------------------------------------------------------------- */
function OrdersSection() {
  const [status, setStatus] = React.useState("pending");
  const [q, setQ] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [orders, setOrders] = React.useState([]);
  const [selected, setSelected] = React.useState(null);

  const fetchOrders = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/admin/shop/orders?status=${encodeURIComponent(
          status
        )}&q=${encodeURIComponent(q)}&limit=50`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to fetch orders");
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      alert(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }, [status, q]);

  React.useEffect(() => {
    const id = setTimeout(fetchOrders, 250);
    return () => clearTimeout(id);
  }, [fetchOrders]);

  const filtered = orders.filter((o) => {
    if (!q.trim()) return true;
    const needle = q.trim().toLowerCase();
    return [o.id, o.status, o.stripe_payment_intent_id]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });

  return (
    <div className="space-y-5">
      <UICard padded={false} className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#e6e0d6] p-4">
          <div className="relative min-w-[220px] flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#b0a294]">
              <Icon name="search" size={16} />
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search order number or payment id"
              className={`${inputClass} h-11 pl-9 ${q ? "pr-9" : ""}`}
            />
            {q ? (
              <button
                onClick={() => setQ("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#9a8c7e] hover:bg-[#f2ede4]"
              >
                <Icon name="x" size={14} />
              </button>
            ) : null}
          </div>

          <UISelect
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-11 !w-auto min-w-[160px]"
          >
            {["pending", "paid", "fulfilled", "cancelled", "all"].map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All statuses" : s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </UISelect>

          <UIButton variant="secondary" className="h-11" onClick={fetchOrders}>
            <Icon name="clock" size={15} /> Refresh
          </UIButton>
        </div>

        {loading ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : !filtered.length ? (
          <UIEmptyState
            icon={<Icon name="inbox" size={20} />}
            title="No orders"
            description={
              q
                ? "Nothing matches that search."
                : `No ${status === "all" ? "" : status} orders to show.`
            }
            action={
              q ? (
                <UIButton variant="secondary" onClick={() => setQ("")}>
                  Clear search
                </UIButton>
              ) : null
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Order</Th>
                <Th>Status</Th>
                <Th className="text-right">Total</Th>
                <Th>Placed</Th>
                <Th>Payment</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <Tr key={o.id} onClick={() => setSelected(o.id)}>
                  <Td className="font-mono text-[12.5px] font-semibold text-[#2a211a]">
                    S-{String(o.id).padStart(6, "0")}
                  </Td>
                  <Td>
                    <UIStatusBadge status={o.status} />
                  </Td>
                  <Td className="whitespace-nowrap text-right font-semibold">
                    {formatCents(o.total_cents, o.currency)}
                  </Td>
                  <Td className="whitespace-nowrap text-[#7a6a5f]">
                    {o.placed_at || o.created_at ? formatDate(o.placed_at || o.created_at) : "—"}
                  </Td>
                  <Td className="font-mono text-[11px] text-[#9a8c7e]">
                    {o.stripe_payment_intent_id ? o.stripe_payment_intent_id.slice(0, 18) + "…" : "—"}
                  </Td>
                  <Td className="text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setSelected(o.id)}
                      title="Open order"
                      className="rounded-lg p-1.5 text-[#7a6a5f] hover:bg-[#f2ede4] hover:text-[#2a211a]"
                    >
                      <Icon name="external" size={15} />
                    </button>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </UICard>

      {selected ? (
        <OrderDrawer
          orderId={selected}
          onClose={() => {
            setSelected(null);
            fetchOrders();
          }}
        />
      ) : null}
    </div>
  );
}

function OrderDrawer({ orderId, onClose }) {
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState(null);
  const [err, setErr] = React.useState("");
  const [updating, setUpdating] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/admin/shop/orders/${orderId}`, {
          cache: "no-store",
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d?.error || "Failed to load order");
        setData(d);
        setErr("");
      } catch (e) {
        setErr(String(e.message || e));
      } finally {
        setLoading(false);
      }
    })();
  }, [orderId]);

  const updateStatus = async (status) => {
    try {
      setUpdating(true);
      const res = await fetch(`/api/admin/shop/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Failed to update status");
      setData((prev) => ({ ...prev, order: { ...prev.order, status } }));
    } catch (e) {
      alert(String(e.message || e));
    } finally {
      setUpdating(false);
    }
  };

  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const order = data?.order;
  const lines = data?.items ?? [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-[#e6e0d6] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#e6e0d6] px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b89a6b]">
              Order
            </p>
            <h2 className="font-serif text-[19px] text-[#2a211a]">
              S-{String(orderId).padStart(6, "0")}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-[#9a8c7e] hover:bg-[#f2ede4]"
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {err ? (
            <ErrorNote>{err}</ErrorNote>
          ) : loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : !order ? (
            <Muted>Order not found.</Muted>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <UIStatusBadge status={order.status} />
                <span className="font-serif text-[22px] text-[#2a211a]">
                  {formatCents(order.total_cents, order.currency)}
                </span>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#9a8c7e]">
                  Items
                </p>
                {lines.length ? (
                  <ul className="divide-y divide-[#f0ebe2] rounded-2xl border border-[#e6e0d6]">
                    {lines.map((l) => (
                      <li key={l.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-[#2a211a]">
                            {l.title_snapshot}
                          </p>
                          <p className="text-[11.5px] text-[#9a8c7e]">
                            {l.quantity} × {formatCents(l.unit_price_cents, l.currency)}
                          </p>
                        </div>
                        <span className="shrink-0 text-[13px] font-semibold">
                          {formatCents(l.unit_price_cents * l.quantity, l.currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Muted className="text-[12.5px]">No line items recorded.</Muted>
                )}
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#9a8c7e]">
                  Details
                </p>
                <dl className="space-y-2 text-[13px]">
                  <InfoRow label="Placed" value={order.placed_at ? formatDate(order.placed_at) : "—"} />
                  <InfoRow label="Created" value={order.created_at ? formatDate(order.created_at) : "—"} />
                  <InfoRow label="Payment" value={order.stripe_payment_intent_id || "—"} />
                </dl>
              </div>

              {order.shipping_address ? (
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#9a8c7e]">
                    Shipping
                  </p>
                  <pre className="overflow-x-auto whitespace-pre-wrap rounded-2xl border border-[#e6e0d6] bg-[#fdfbf7] p-3 text-[12px] text-[#3f3127]">
                    {JSON.stringify(order.shipping_address, null, 2)}
                  </pre>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {order ? (
          <div className="border-t border-[#e6e0d6] p-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#9a8c7e]">
              Move to
            </p>
            <div className="flex flex-wrap gap-2">
              {["paid", "fulfilled", "cancelled"].map((s) => (
                <UIButton
                  key={s}
                  size="sm"
                  variant={s === "cancelled" ? "danger" : order.status === s ? "dark" : "secondary"}
                  disabled={updating || order.status === s}
                  onClick={() => updateStatus(s)}
                >
                  {s[0].toUpperCase() + s.slice(1)}
                </UIButton>
              ))}
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="rounded-2xl border border-[#e6e0d6] bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-[#9a8c7e]">
        {label}
      </div>
      <div className="mt-1 text-sm text-[#2a211a]">{value}</div>
    </div>
  );
}

/* -------------------------------------------------------------
   Images
------------------------------------------------------------- */
function ImagesSection() {
  const [productId, setProductId] = React.useState("");
  const [images, setImages] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [url, setUrl] = React.useState("");
  const [alt, setAlt] = React.useState("");

  const load = async () => {
    if (!productId) return;
    try {
      setLoading(true);
      const res = await fetch(
        `/api/admin/shop/images?product_id=${productId}`,
        {
          cache: "no-store",
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to fetch images");
      setImages(Array.isArray(data) ? data : []);
    } catch (e) {
      alert(String(e.message || e));
    } finally {
      setLoading(false);
    }
  };

  const add = async () => {
    if (!productId || !url) return;
    try {
      const res = await fetch(`/api/admin/shop/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: Number(productId),
          url,
          alt,
          sort: (images[images.length - 1]?.sort || 0) + 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to add");
      setUrl("");
      setAlt("");
      load();
    } catch (e) {
      alert(String(e.message || e));
    }
  };

  const bump = async (img, dir) => {
    try {
      const res = await fetch(`/api/admin/shop/images/${img.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sort: (img.sort || 0) + dir }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update order");
      load();
    } catch (e) {
      alert(String(e.message || e));
    }
  };

  const remove = async (img) => {
    if (!confirm("Delete image?")) return;
    try {
      const res = await fetch(`/api/admin/shop/images/${img.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to delete");
      load();
    } catch (e) {
      alert(String(e.message || e));
    }
  };

  return (
    <div className="space-y-5">
      <UICard>
        <h2 className="font-serif text-[17px] text-[#2a211a]">Product images</h2>
        <Muted className="mt-0.5 text-[12px]">
          Pick a product by id, then add image URLs in the order they should appear.
        </Muted>

        <div className="mt-4 flex flex-wrap items-end gap-2">
          <Field label="Product id" className="w-[140px]">
            <input
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              inputMode="numeric"
              placeholder="e.g. 12"
              className={inputClass}
            />
          </Field>
          <UIButton variant="secondary" onClick={load} disabled={!productId || loading}>
            {loading ? "Loading…" : "Load images"}
          </UIButton>
        </div>
      </UICard>

      {productId ? (
        <UICard>
          <h3 className="font-serif text-[16px] text-[#2a211a]">Add an image</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <Field label="Image URL">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                className={inputClass}
              />
            </Field>
            <Field label="Alt text" hint="Describes the photo for screen readers.">
              <input value={alt} onChange={(e) => setAlt(e.target.value)} className={inputClass} />
            </Field>
            <UIButton variant="primary" onClick={add} disabled={!url.trim()}>
              <Icon name="plus" size={15} /> Add
            </UIButton>
          </div>
        </UICard>
      ) : null}

      <UICard padded={false} className="overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : !images.length ? (
          <UIEmptyState
            icon={<Icon name="grid" size={20} />}
            title={productId ? "No images yet" : "Pick a product"}
            description={
              productId
                ? "Add the first image using the form above."
                : "Enter a product id and load its images."
            }
          />
        ) : (
          <ul className="divide-y divide-[#f0ebe2]">
            {images.map((img, idx) => (
              <li key={img.id} className="flex items-center gap-3 px-4 py-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-[#e6e0d6] bg-[#faf8f4]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.alt || ""}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-[#2a211a]">
                    {img.alt || "No alt text"}
                  </p>
                  <p className="truncate font-mono text-[11px] text-[#9a8c7e]">{img.url}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => bump(img, -1)}
                    disabled={idx === 0}
                    title="Move up"
                    className="rounded-lg p-1.5 text-[#7a6a5f] hover:bg-[#f2ede4] disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => bump(img, 1)}
                    disabled={idx === images.length - 1}
                    title="Move down"
                    className="rounded-lg p-1.5 text-[#7a6a5f] hover:bg-[#f2ede4] disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => remove(img)}
                    title="Remove image"
                    className="rounded-lg p-1.5 text-[#7a6a5f] hover:bg-[#fbeae5] hover:text-[#a33c22]"
                  >
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </UICard>
    </div>
  );
}

/* -------------------------------------------------------------
   Subscribers
------------------------------------------------------------- */
function SubscribersSection() {
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [q, setQ] = React.useState("");

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/admin/newsletter-subscribers", {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok)
          throw new Error(data?.error || "Failed to fetch subscribers");
        setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        alert(String(e.message || e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const exportCsv = () => {
    const header = ["email", "created_at", "confirmed_at"];
    const lines = [header.join(",")].concat(
      rows.map((r) =>
        [r.email, r.created_at || "", r.confirmed_at || ""].join(",")
      )
    );
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      String(r.email || "")
        .toLowerCase()
        .includes(s)
    );
  }, [rows, q]);

  return (
    <UICard padded={false} className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#e6e0d6] p-4">
        <div className="relative min-w-[220px] flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#b0a294]">
            <Icon name="search" size={16} />
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search an email address"
            className={`${inputClass} h-11 pl-9 ${q ? "pr-9" : ""}`}
          />
          {q ? (
            <button
              onClick={() => setQ("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#9a8c7e] hover:bg-[#f2ede4]"
            >
              <Icon name="x" size={14} />
            </button>
          ) : null}
        </div>
        <UIButton variant="secondary" onClick={exportCsv} disabled={!filtered.length}>
          <Icon name="download" size={15} /> Export CSV
        </UIButton>
      </div>

      {loading ? (
        <div className="space-y-2 p-5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-11" />
          ))}
        </div>
      ) : !filtered.length ? (
        <UIEmptyState
          icon={<Icon name="mail" size={20} />}
          title={rows.length ? "No matches" : "No subscribers yet"}
          description={
            rows.length
              ? "No address matches that search."
              : "Sign-ups from the website appear here."
          }
          action={
            rows.length ? (
              <UIButton variant="secondary" onClick={() => setQ("")}>
                Clear search
              </UIButton>
            ) : null
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Email</Th>
              <Th>Status</Th>
              <Th>Subscribed</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const status = r.unsubscribed_at
                ? { label: "Unsubscribed", variant: "danger" }
                : r.confirmed_at
                  ? { label: "Confirmed", variant: "success" }
                  : { label: "Pending", variant: "warning" };
              return (
                <Tr key={r.email}>
                  <Td className="font-medium text-[#2a211a]">{r.email}</Td>
                  <Td>
                    <UIBadge variant={status.variant}>{status.label}</UIBadge>
                  </Td>
                  <Td className="whitespace-nowrap text-[#7a6a5f]">
                    {r.created_at ? formatDate(r.created_at) : "—"}
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      )}

      {!loading && filtered.length ? (
        <div className="border-t border-[#e6e0d6] px-4 py-3">
          <Muted className="text-[12px]">
            {filtered.length} of {rows.length} subscriber
            {rows.length === 1 ? "" : "s"}
          </Muted>
        </div>
      ) : null}
    </UICard>
  );
}

/* -------------------------------------------------------------
   Settings
------------------------------------------------------------- */
function SettingsSection() {
  const [paused, setPaused] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    try {
      setSaving(true);
      const res = await fetch("/api/admin/shop/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save settings");
      alert("Saved");
    } catch (e) {
      alert(String(e.message || e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <UICard>
        <h2 className="font-serif text-[17px] text-[#2a211a]">Shop availability</h2>
        <Muted className="mt-0.5 text-[12px]">
          Pausing hides checkout from customers. The storefront stays browsable.
        </Muted>

        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-[#e6e0d6] bg-[#fdfbf7] p-4">
          <input
            type="checkbox"
            checked={paused}
            onChange={(e) => setPaused(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#8b6f47]"
          />
          <span className="min-w-0">
            <span className="block text-[13.5px] font-semibold text-[#2a211a]">
              Pause the shop
            </span>
            <span className="mt-0.5 block text-[12px] text-[#7a6a5f]">
              Customers can look but not buy.
            </span>
          </span>
        </label>

        <Field
          label="Pause message"
          hint="Shown to customers while the shop is paused."
          className="mt-4"
        >
          <textarea
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Back on Monday — thank you for your patience."
            className={`${inputClass} h-auto py-2 leading-relaxed`}
          />
        </Field>

        <div className="mt-4 flex items-center gap-2 border-t border-[#f0ebe2] pt-4">
          <UIButton variant="primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </UIButton>
          {paused ? <UIBadge variant="warning">Shop paused</UIBadge> : null}
        </div>
      </UICard>

      <UICard>
        <h2 className="font-serif text-[17px] text-[#2a211a]">Storefront</h2>
        <Muted className="mt-0.5 text-[12px]">
          What customers see, and where to check it.
        </Muted>
        <div className="mt-4 space-y-2">
          <UIButton as="a" href="/shop" target="_blank" rel="noreferrer" variant="secondary" className="w-full">
            <Icon name="external" size={15} /> Open the shop
          </UIButton>
          <UIButton as={Link} href="/admin/eshop/new-product" variant="secondary" className="w-full">
            <Icon name="plus" size={15} /> Add a product
          </UIButton>
        </div>
      </UICard>
    </div>
  );
}

/* -------------------------------------------------------------
   Reusable fields
------------------------------------------------------------- */