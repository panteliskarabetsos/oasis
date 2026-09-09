"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Image as ImageIcon, LayoutDashboard, ListOrdered, Mail, PackageSearch, Search, Settings } from "lucide-react";

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


/* -------------------------------------------------------------
   Visual tokens
------------------------------------------------------------- */
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
            ["Open the scanner", "Look codes up, receive stock, pick orders.", "/admin/eshop/scan"],
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
        // 409 means something still references it — offer the only way out.
        if (res.status === 409 && prod.active) {
          if (
            confirm(
              `${data?.error || "This product cannot be deleted."}\n\nHide it from the shop now?`
            )
          ) {
            await toggleActive(prod);
          }
          return;
        }
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
            <UIButton as={Link} href="/admin/eshop/scan" variant="secondary" className="h-11">
              <Icon name="search" size={15} /> Scanner
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
                      {[p.slug, p.sku_code, p.barcode].filter(Boolean).join(" · ")}
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
                      <Link
                        href={`/admin/eshop/product/${p.id}`}
                        title="Manage product"
                        className="rounded-lg p-1.5 text-[#7a6a5f] hover:bg-[#f2ede4] hover:text-[#2a211a]"
                      >
                        <Icon name="file" size={15} />
                      </Link>
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
/* -------------------------------------------------------------
   Orders
------------------------------------------------------------- */
function OrdersSection() {
  const router = useRouter();
  // Defaulting to "pending" made the tab look empty as soon as an order was
  // paid — which is every order that actually completed.
  const [status, setStatus] = React.useState("all");
  const [q, setQ] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [orders, setOrders] = React.useState([]);

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

  // The server has already applied `q` (including the billing/shipping email,
  // which is not in the row we render). Re-filtering here would silently drop
  // exactly those matches, so the list shows what the query returned.
  const filtered = orders;

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
                : status === "all"
                  ? "No orders have been placed yet."
                  : `No ${status} orders — try “All statuses”.`
            }
            action={
              q ? (
                <UIButton variant="secondary" onClick={() => setQ("")}>
                  Clear search
                </UIButton>
              ) : status !== "all" ? (
                <UIButton variant="secondary" onClick={() => setStatus("all")}>
                  Show all statuses
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
                <Tr key={o.id} onClick={() => router.push(`/admin/eshop/order/${o.id}`)}>
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
                    <Link
                      href={`/admin/eshop/order/${o.id}`}
                      title="Open order"
                      className="inline-block rounded-lg p-1.5 text-[#7a6a5f] hover:bg-[#f2ede4] hover:text-[#2a211a]"
                    >
                      <Icon name="external" size={15} />
                    </Link>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </UICard>

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
          sort: images.reduce((m, i) => Math.max(m, Number(i.sort) || 0), -1) + 1,
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

  // Swap sort values with the neighbour. Nudging one row's sort by ±1 left
  // duplicate sorts behind (0,1,1) and the order then depended on the
  // database's tie-breaking, so a second click could do nothing at all.
  const bump = async (img, dir) => {
    const idx = images.findIndex((i) => i.id === img.id);
    const other = images[idx + dir];
    if (!other) return;
    try {
      const patch = (id, sort) =>
        fetch(`/api/admin/shop/images/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sort }),
        }).then(async (res) => {
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data?.error || "Failed to update order");
          }
        });
      // Positions, not the stored values — those can be equal or have gaps.
      await patch(img.id, idx + dir);
      await patch(other.id, idx);
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
  const [loading, setLoading] = React.useState(true);
  const [emails, setEmails] = React.useState(null);
  const [automations, setAutomations] = React.useState({});
  const [emailNotice, setEmailNotice] = React.useState("");
  const [shipping, setShipping] = React.useState(null);

  // Without this the toggle always reads "open" — even while the storefront
  // is refusing checkout — and saving would silently unpause the shop.
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/shop/settings", { cache: "no-store" });
        const data = await res.json();
        if (!alive || !res.ok) return;
        setPaused(Boolean(data?.paused));
        setMessage(data?.message || "");
        setAutomations(data?.automations || {});
        setEmails(data?.emails || null);
        setShipping(data?.shipping || null);
        if (data?.emails && data.emails.available === false) {
          setEmailNotice(
            "Switches are showing their defaults — run dump_sql/20260909_shop_emails.sql to save changes."
          );
        }
      } catch {
        // leave the defaults; saving still works
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const save = async () => {
    try {
      setSaving(true);
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
      if (!res.ok) throw new Error(data?.error || "Failed to save settings");
      alert(data?.warning ? `Saved.\n\n${data.warning}` : "Saved");
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
            disabled={loading}
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
        <h2 className="font-serif text-[17px] text-[#2a211a]">Email automations</h2>
        <Muted className="mt-0.5 text-[12px]">
          What the shop sends on its own, and to whom.
        </Muted>

        {emailNotice ? <ErrorNote className="mt-3">{emailNotice}</ErrorNote> : null}

        <div className="mt-4 space-y-2">
          {Object.entries(automations).map(([key, meta]) => {
            const on = emails ? emails[key] !== false : true;
            return (
              <label
                key={key}
                className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#e6e0d6] bg-[#fdfbf7] p-3.5"
              >
                <input
                  type="checkbox"
                  checked={on}
                  disabled={loading}
                  onChange={(e) =>
                    setEmails((prev) => ({ ...(prev || {}), [key]: e.target.checked }))
                  }
                  className="mt-0.5 h-4 w-4 accent-[#8b6f47]"
                />
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-[#2a211a]">
                    {meta.label}
                    <UIBadge
                      variant={meta.audience === "staff" ? "info" : "neutral"}
                      className="ml-2"
                    >
                      {meta.audience}
                    </UIBadge>
                  </span>
                  <span className="mt-0.5 block text-[12px] text-[#7a6a5f]">
                    {meta.description}
                  </span>
                </span>
              </label>
            );
          })}
          {!Object.keys(automations).length ? (
            <Muted className="text-[12.5px]">Loading…</Muted>
          ) : null}
        </div>

        <Field
          label="Send staff alerts to"
          hint="Leave empty to use the shop's default sending address."
          className="mt-4"
        >
          <input
            value={emails?.staffTo || ""}
            onChange={(e) =>
              setEmails((prev) => ({ ...(prev || {}), staffTo: e.target.value }))
            }
            placeholder="orders@youroasis.gr"
            className={inputClass}
          />
        </Field>

        <div className="mt-4 flex items-center gap-2 border-t border-[#f0ebe2] pt-4">
          <UIButton variant="primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </UIButton>
          <UIButton as={Link} href="/admin/eshop/new-product" variant="secondary">
            <Icon name="plus" size={15} /> Add a product
          </UIButton>
          <UIButton as={Link} href="/admin/eshop/scan" variant="secondary">
            <Icon name="search" size={15} /> Scanner
          </UIButton>
        </div>
      </UICard>
      <div className="lg:col-span-2">
        <ShippingSettings value={shipping} onChange={setShipping} onSave={save} saving={saving} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------
   Courier rates
------------------------------------------------------------- */

const EMPTY_ZONE = {
  id: "",
  label: "",
  countries: [],
  baseCents: 0,
  baseGrams: 2000,
  extraCentsPerKg: 0,
  maxGrams: 0,
};

/** cents <-> a euro string the admin actually types. */
const toEuro = (cents) => ((Number(cents) || 0) / 100).toFixed(2);
const fromEuro = (v) => Math.round(Number(String(v).replace(",", ".")) * 100) || 0;
const toKg = (grams) => ((Number(grams) || 0) / 1000).toString();
const fromKg = (v) => Math.round(Number(String(v).replace(",", ".")) * 1000) || 0;

function ShippingSettings({ value, onChange, onSave, saving }) {
  if (!value) {
    return (
      <UICard>
        <h2 className="font-serif text-[17px] text-[#2a211a]">Courier shipping</h2>
        <Muted className="mt-0.5 text-[12px]">Loading…</Muted>
      </UICard>
    );
  }

  const set = (patch) => onChange({ ...value, ...patch });
  const setZone = (i, patch) =>
    onChange({
      ...value,
      zones: (value.zones || []).map((z, k) => (k === i ? { ...z, ...patch } : z)),
    });

  return (
    <UICard>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-[17px] text-[#2a211a]">Courier shipping</h2>
          <Muted className="mt-0.5 text-[12px]">
            Priced on the greater of a parcel&rsquo;s weight and its volume, per destination.
          </Muted>
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#e6e0d6] bg-[#fdfbf7] px-3 py-2">
          <input
            type="checkbox"
            checked={value.enabled !== false}
            onChange={(e) => set({ enabled: e.target.checked })}
            className="h-4 w-4 accent-[#8b6f47]"
          />
          <span className="text-[13px] font-semibold text-[#2a211a]">
            {value.enabled !== false ? "Charging for delivery" : "Delivery is free"}
          </span>
        </label>
      </div>

      {value.available === false ? (
        <ErrorNote className="mt-4">
          These rates cannot be saved until dump_sql/20260909_shop_emails.sql has been run.
        </ErrorNote>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Field label="Free over" hint="0 turns the threshold off.">
          <input
            value={toEuro(value.freeOverCents)}
            onChange={(e) => set({ freeOverCents: fromEuro(e.target.value) })}
            inputMode="decimal"
            className={inputClass}
          />
        </Field>
        <Field label="Handling fee" hint="Added to every courier order.">
          <input
            value={toEuro(value.handlingCents)}
            onChange={(e) => set({ handlingCents: fromEuro(e.target.value) })}
            inputMode="decimal"
            className={inputClass}
          />
        </Field>
        <Field label="Volumetric divisor" hint="5000 is the usual courier figure.">
          <input
            value={String(value.volumetricDivisor ?? 5000)}
            onChange={(e) =>
              set({ volumetricDivisor: Number(e.target.value.replace(/[^0-9]/g, "")) || 5000 })
            }
            inputMode="numeric"
            className={inputClass}
          />
        </Field>
      </div>

      {/* zones */}
      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12px] font-semibold text-[#3f3127]">Destinations</span>
          <UIButton
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
          </UIButton>
        </div>

        {!value.zones?.length ? (
          <Muted className="text-[12.5px]">
            No destinations yet — add one, or switch shipping off to send everything free.
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
                  <Field
                    label="Countries"
                    hint="Two-letter codes, comma separated. Use * for everywhere else."
                  >
                    <input
                      value={(z.countries || []).join(", ")}
                      onChange={(e) =>
                        setZone(i, {
                          countries: e.target.value
                            .split(",")
                            .map((c) => c.trim().toUpperCase())
                            .filter(Boolean),
                        })
                      }
                      placeholder="GR"
                      className={`${inputClass} font-mono`}
                    />
                  </Field>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-4">
                  <Field label="Base price">
                    <input
                      value={toEuro(z.baseCents)}
                      onChange={(e) => setZone(i, { baseCents: fromEuro(e.target.value) })}
                      inputMode="decimal"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Covers up to (kg)">
                    <input
                      value={toKg(z.baseGrams)}
                      onChange={(e) => setZone(i, { baseGrams: fromKg(e.target.value) })}
                      inputMode="decimal"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Each extra kg">
                    <input
                      value={toEuro(z.extraCentsPerKg)}
                      onChange={(e) => setZone(i, { extraCentsPerKg: fromEuro(e.target.value) })}
                      inputMode="decimal"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Refuse over (kg)" hint="0 for no limit.">
                    <input
                      value={toKg(z.maxGrams)}
                      onChange={(e) => setZone(i, { maxGrams: fromKg(e.target.value) })}
                      inputMode="decimal"
                      className={inputClass}
                    />
                  </Field>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-[#eee8de] pt-3">
                  <Muted className="text-[11.5px]">
                    A 3 kg parcel here costs{" "}
                    {toEuro(
                      (Number(z.baseCents) || 0) +
                        Math.ceil(
                          Math.max(0, 3000 - (Number(z.baseGrams) || 0)) / 1000
                        ) *
                          (Number(z.extraCentsPerKg) || 0) +
                        (Number(value.handlingCents) || 0)
                    )}
                  </Muted>
                  <UIButton
                    size="sm"
                    variant="ghost"
                    className="text-[#a33c22] hover:bg-[#fbeae5]"
                    onClick={() =>
                      onChange({ ...value, zones: value.zones.filter((_, k) => k !== i) })
                    }
                  >
                    Remove
                  </UIButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* collection */}
      <div className="mt-5 rounded-xl border border-[#e6e0d6] bg-[#fdfbf7] p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={value.pickup?.enabled !== false}
            onChange={(e) => set({ pickup: { ...(value.pickup || {}), enabled: e.target.checked } })}
            className="mt-0.5 h-4 w-4 accent-[#8b6f47]"
          />
          <span>
            <span className="block text-[13px] font-semibold text-[#2a211a]">
              Offer collection
            </span>
            <span className="mt-0.5 block text-[12px] text-[#7a6a5f]">
              Customers can choose to pick the order up instead of paying a courier.
            </span>
          </span>
        </label>
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
              <input
                value={toEuro(value.pickup?.cents)}
                onChange={(e) =>
                  set({ pickup: { ...(value.pickup || {}), cents: fromEuro(e.target.value) } })
                }
                inputMode="decimal"
                className={inputClass}
              />
            </Field>
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-[#f0ebe2] pt-4">
        <UIButton variant="primary" onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save shipping"}
        </UIButton>
        <Muted className="text-[11.5px]">
          Products need a weight for this to price correctly.
        </Muted>
      </div>
    </UICard>
  );
}

/* -------------------------------------------------------------
   Reusable fields
------------------------------------------------------------- */