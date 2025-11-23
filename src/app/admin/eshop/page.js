"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Store,
  PackageSearch,
  PackagePlus,
  Image as ImageIcon,
  ListOrdered,
  RefreshCw,
  Search,
  CheckCircle2,
  Loader2,
  Euro,
  Mail,
  Edit,
  Trash2,
  Eye,
  ToggleLeft,
  ToggleRight,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// shadcn/ui
import { Button } from "@/app/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";
import { Switch } from "@/app/components/ui/switch";

/* -------------------------------------------------------------
   Helpers
------------------------------------------------------------- */
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
const ui = {
  page: "min-h-screen bg-[#f6f3ee]",
  card: "rounded-2xl border-[#e8e2d8] bg-white",
  chip: "bg-[#efeae2] text-[#5a4a3f]",
  brand: "text-[#4a3f35]",
  text: "text-[#4a3f35]",
  soft: "text-[#6b625a]",
  cta: "bg-[#8b6f47] text-white hover:bg-[#a78b62]",
  outline: "border-[#e3ddd5] text-[#5a4a3f]",
};

/* -------------------------------------------------------------
   Page
------------------------------------------------------------- */
export default function AdminEshopManagePage() {
  const [tab, setTab] = React.useState("overview");

  // shortcuts: g then {o,p,r,i,s}
  React.useEffect(() => {
    let g = false;
    const onKey = (e) => {
      if (e.key.toLowerCase() === "g") {
        g = true;
        setTimeout(() => (g = false), 600);
        return;
      }
      if (!g) return;
      const k = e.key.toLowerCase();
      if (k === "o") setTab("overview");
      if (k === "p") setTab("products");
      if (k === "r") setTab("orders");
      if (k === "i") setTab("images");
      if (k === "s") setTab("subscribers");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={ui.page}>
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Header */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Store className="h-6 w-6 text-[#6f5e48]" />
            <h1 className="text-2xl font-serif text-[#4a3f35]">
              E-shop Manager
            </h1>
            <Badge className={ui.chip}>Admin</Badge>
          </div>
          <TabBar tab={tab} onTab={setTab} />
        </div>

        {tab === "overview" && <OverviewSection />}
        {tab === "products" && <ProductsSection />}
        {tab === "orders" && <OrdersSection />}
        {tab === "images" && <ImagesSection />}
        {tab === "subscribers" && <SubscribersSection />}
        {tab === "settings" && <SettingsSection />}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------
   Tab Bar
------------------------------------------------------------- */
function TabButton({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`rounded-full px-3 py-1.5 text-sm transition ${
        active
          ? "bg-white border border-[#e7e0d6] shadow-sm " + ui.text
          : "border border-transparent hover:bg-[#efeae2] " + ui.soft
      }`}
    >
      {children}
    </button>
  );
}
function TabBar({ tab, onTab }) {
  return (
    <div className="sticky top-[72px] z-30 -mx-2 flex flex-wrap items-center gap-2 rounded-2xl border border-[#eadfd2] bg-white/80 px-3 py-2 backdrop-blur md:mx-0">
      <TabButton active={tab === "overview"} onClick={() => onTab("overview")}>
        Overview
      </TabButton>
      <TabButton active={tab === "products"} onClick={() => onTab("products")}>
        Products
      </TabButton>
      <TabButton active={tab === "orders"} onClick={() => onTab("orders")}>
        Orders
      </TabButton>
      <TabButton active={tab === "images"} onClick={() => onTab("images")}>
        Images
      </TabButton>
      <TabButton
        active={tab === "subscribers"}
        onClick={() => onTab("subscribers")}
      >
        Subscribers
      </TabButton>
      <TabButton active={tab === "settings"} onClick={() => onTab("settings")}>
        Settings
      </TabButton>
      <div className="ml-auto hidden items-center gap-2 text-xs text-neutral-500 md:flex">
        <kbd className="rounded bg-neutral-100 px-1.5 py-0.5">g</kbd> then
        <span className="rounded bg-neutral-100 px-1.5 py-0.5">o/p/r/i/s</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------
   Overview
------------------------------------------------------------- */
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
      } catch (err) {
        setError(String(err.message || err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Products"
        value={stats.productCount}
        icon={<PackageSearch className="h-5 w-5" />}
        loading={loading}
        error={error}
      />
      <StatCard
        title="Active Products"
        value={stats.activeProductCount}
        icon={<CheckCircle2 className="h-5 w-5" />}
        loading={loading}
      />
      <StatCard
        title="Pending Orders"
        value={stats.ordersPendingCount}
        icon={<ListOrdered className="h-5 w-5" />}
        loading={loading}
      />
      <StatCard
        title="Revenue (30d)"
        value={formatCents(stats.revenue30dCents)}
        icon={<Euro className="h-5 w-5" />}
        loading={loading}
      />
    </div>
  );
}
function StatCard({ title, value, icon, loading, error }) {
  return (
    <Card className={ui.card}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-[#6b625a]">
          {title}
        </CardTitle>
        <div className="text-[#8b6f47]">{icon}</div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : error ? (
          <div className="text-sm text-red-600">{error}</div>
        ) : (
          <div className="text-2xl font-semibold text-[#4a3f35]">{value}</div>
        )}
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------
   Products (debounced search, client sort + paging, optimistic toggle)
------------------------------------------------------------- */
function ProductsSection() {
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState([]);
  const [error, setError] = React.useState("");
  const [showNew, setShowNew] = React.useState(false);
  const [editing, setEditing] = React.useState(null);

  // sort & paging (client-side)
  const [sort, setSort] = React.useState({ key: "updated_at", dir: "desc" }); // key: 'title'|'slug'|'price_cents'|'updated_at'
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

  function sortBy(key) {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  }

  const sorted = React.useMemo(() => {
    const arr = [...items];
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
  }, [items, sort]);

  const maxPage = Math.max(1, Math.ceil(sorted.length / size));
  const pageRows = React.useMemo(
    () => sorted.slice((page - 1) * size, (page - 1) * size + size),
    [sorted, page, size]
  );

  // optimistic toggle
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

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products…"
              className="pl-9 w-64"
            />
          </div>
          <Button
            variant="outline"
            className={ui.outline}
            onClick={fetchProducts}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="rounded-md border border-[#e3ddd5] bg-white px-3 py-2 text-sm"
            value={`${sort.key}:${sort.dir}`}
            onChange={(e) => {
              const [k, d] = e.target.value.split(":");
              setSort({ key: k, dir: d });
            }}
          >
            <option value="updated_at:desc">Updated ↓</option>
            <option value="updated_at:asc">Updated ↑</option>
            <option value="title:asc">Title A→Z</option>
            <option value="title:desc">Title Z→A</option>
            <option value="slug:asc">Slug A→Z</option>
            <option value="slug:desc">Slug Z→A</option>
            <option value="price_cents:asc">Price ↑</option>
            <option value="price_cents:desc">Price ↓</option>
          </select>
          <select
            className="rounded-md border border-[#e3ddd5] bg-white px-3 py-2 text-sm"
            value={size}
            onChange={(e) => {
              setSize(Number(e.target.value || 10));
              setPage(1);
            }}
            title="Rows per page"
          >
            {[10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}/page
              </option>
            ))}
          </select>
          <Link
            href="/admin/eshop/new-product"
            className="inline-flex items-center rounded-md px-4 py-2 text-sm bg-[#8b6f47] text-white hover:bg-[#a78b62]"
          >
            <PackagePlus className="mr-2 h-4 w-4" />
            New product
          </Link>
        </div>
      </div>

      {/* Table */}
      <Card className={ui.card}>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[#faf7f1] text-[#6b625a]">
                <tr>
                  <ThSort
                    onClick={() => sortBy("title")}
                    active={sort.key === "title"}
                    dir={sort.dir}
                  >
                    Title
                  </ThSort>
                  <ThSort
                    onClick={() => sortBy("slug")}
                    active={sort.key === "slug"}
                    dir={sort.dir}
                  >
                    Slug
                  </ThSort>
                  <ThSort
                    onClick={() => sortBy("price_cents")}
                    active={sort.key === "price_cents"}
                    dir={sort.dir}
                  >
                    Price
                  </ThSort>
                  <th className="px-4 py-3 text-left">Active</th>
                  <ThSort
                    onClick={() => sortBy("updated_at")}
                    active={sort.key === "updated_at"}
                    dir={sort.dir}
                  >
                    Updated
                  </ThSort>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows cols={6} />
                ) : error ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-red-600"
                    >
                      {error}
                    </td>
                  </tr>
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-neutral-500"
                    >
                      No products found.{" "}
                      <button
                        onClick={() => setShowNew(true)}
                        className="underline text-[#8b6f47]"
                      >
                        Create the first one
                      </button>
                      .
                    </td>
                  </tr>
                ) : (
                  pageRows.map((p) => (
                    <tr key={p.id} className="border-t border-[#f0ebe4]">
                      <td className="px-4 py-3 font-medium text-[#4a3f35]">
                        {p.title}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">{p.slug}</td>
                      <td className="px-4 py-3">
                        {formatCents(p.price_cents, p.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleActive(p)}
                          className="inline-flex items-center gap-2 rounded-full border border-[#e8e2d9] bg-white px-3 py-1 text-xs text-[#5a4a3f] hover:bg-[#faf7f1]"
                          title="Toggle active"
                        >
                          {p.active ? <ToggleRightIcon /> : <ToggleLeftIcon />}{" "}
                          {p.active ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {formatDate(p.updated_at || p.updatedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            className={ui.outline}
                            onClick={() => setEditing(p)}
                          >
                            <Edit className="mr-1 h-4 w-4" /> Edit
                          </Button>
                          <Link
                            href={`/admin/eshop/products/${p.id}/images`}
                            className="inline-flex items-center rounded-md border border-[#e3ddd5] px-3 py-2 text-sm"
                          >
                            <ImageIcon className="mr-1 h-4 w-4" /> Images
                          </Link>
                          <Button
                            variant="outline"
                            className="border-red-200 text-red-600 hover:bg-red-50"
                            onClick={() => removeProduct(p)}
                          >
                            <Trash2 className="mr-1 h-4 w-4" /> Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {!loading && !error && sorted.length > size ? (
                <tfoot>
                  <tr>
                    <td colSpan={6} className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-neutral-600">
                          {sorted.length} items • page {page} of {maxPage}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            className={ui.outline}
                            disabled={page <= 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            className={ui.outline}
                            disabled={page >= maxPage}
                            onClick={() =>
                              setPage((p) => Math.min(maxPage, p + 1))
                            }
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </CardContent>
      </Card>

      {editing && (
        <ProductModal
          existing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            fetchProducts();
          }}
        />
      )}
    </div>
  );
}
function ThSort({ children, onClick, active, dir }) {
  return (
    <th className="px-4 py-3 text-left">
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-[#efeae2]"
      >
        <span>{children}</span>
        {active ? (
          dir === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )
        ) : (
          <span className="text-neutral-400">•</span>
        )}
      </button>
    </th>
  );
}
function SkeletonRows({ cols }) {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="border-t border-[#f0ebe4]">
          <td colSpan={cols} className="px-4 py-3">
            <div className="h-4 w-full animate-pulse rounded bg-neutral-200/60" />
          </td>
        </tr>
      ))}
    </>
  );
}
function ToggleRightIcon() {
  return (
    <span className="inline-flex items-center text-green-700">
      <ToggleRight className="h-4 w-4" />
    </span>
  );
}
function ToggleLeftIcon() {
  return (
    <span className="inline-flex items-center text-red-600">
      <ToggleLeft className="h-4 w-4" />
    </span>
  );
}

/* -------------------------------------------------------------
   Orders (unchanged wiring, tidied UI)
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

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-md border border-[#e3ddd5] bg-white px-3 py-2 text-sm"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="fulfilled">Fulfilled</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by email, id…"
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            className={ui.outline}
            onClick={fetchOrders}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card className={ui.card}>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[#faf7f1] text-[#6b625a]">
                <tr>
                  <th className="px-4 py-3 text-left">Order #</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Total</th>
                  <th className="px-4 py-3 text-left">Placed</th>
                  <th className="px-4 py-3 text-left">Payment</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows cols={6} />
                ) : orders.length === 0 ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="px-4 py-8 text-center text-neutral-500"
                    >
                      No orders.
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => (
                    <tr key={o.id} className="border-t border-[#f0ebe4]">
                      <td className="px-4 py-3 font-medium text-[#4a3f35]">
                        {o.id}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={o.status} />
                      </td>
                      <td className="px-4 py-3">
                        {formatCents(o.total_cents, o.currency)}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {formatDate(o.placed_at || o.created_at)}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {o.stripe_payment_intent_id ? "Stripe" : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="outline"
                          className={ui.outline}
                          onClick={() => setSelected(o)}
                        >
                          <Eye className="mr-1 h-4 w-4" /> View
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {selected && (
        <OrderDrawer orderId={selected.id} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
function StatusBadge({ status }) {
  const map = {
    pending: "bg-amber-100 text-amber-700",
    paid: "bg-green-100 text-green-700",
    fulfilled: "bg-blue-100 text-blue-700",
    cancelled: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs ${
        map[status] || "bg-neutral-100 text-neutral-700"
      }`}
    >
      {status}
    </span>
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

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="h-full w-full max-w-xl overflow-auto bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#f0ebe4] px-5 py-3">
          <div className="flex items-center gap-2">
            <ListOrdered className="h-5 w-5 text-[#8b6f47]" />
            <h3 className="font-serif text-lg text-[#4a3f35]">
              Order #{orderId}
            </h3>
          </div>
          <Button variant="outline" className={ui.outline} onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="text-neutral-500">
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : err ? (
            <div className="text-red-600">{err}</div>
          ) : (
            <>
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <InfoRow
                  label="Status"
                  value={<StatusBadge status={data.order.status} />}
                />
                <InfoRow
                  label="Total"
                  value={formatCents(
                    data.order.total_cents,
                    data.order.currency
                  )}
                />
                <InfoRow
                  label="Placed"
                  value={formatDate(
                    data.order.placed_at || data.order.created_at
                  )}
                />
                <InfoRow
                  label="Payment"
                  value={data.order.stripe_payment_intent_id ? "Stripe" : "—"}
                />
              </div>

              <div className="mb-4">
                <h4 className="mb-2 font-medium text-[#4a3f35]">Items</h4>
                <div className="overflow-x-auto rounded-lg border border-[#f0ebe4]">
                  <table className="min-w-full text-sm">
                    <thead className="bg-[#faf7f1] text-[#6b625a]">
                      <tr>
                        <th className="px-3 py-2 text-left">Product</th>
                        <th className="px-3 py-2 text-left">Qty</th>
                        <th className="px-3 py-2 text-left">Unit</th>
                        <th className="px-3 py-2 text-left">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.items || []).map((it) => (
                        <tr key={it.id} className="border-t border-[#f0ebe4]">
                          <td className="px-3 py-2">{it.title_snapshot}</td>
                          <td className="px-3 py-2">{it.quantity}</td>
                          <td className="px-3 py-2">
                            {formatCents(it.unit_price_cents, it.currency)}
                          </td>
                          <td className="px-3 py-2">
                            {formatCents(
                              it.unit_price_cents * it.quantity,
                              it.currency
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className={ui.outline}
                  disabled={updating}
                  onClick={() => updateStatus("paid")}
                >
                  Mark paid
                </Button>
                <Button
                  variant="outline"
                  className={ui.outline}
                  disabled={updating}
                  onClick={() => updateStatus("fulfilled")}
                >
                  Mark fulfilled
                </Button>
                <Button
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50"
                  disabled={updating}
                  onClick={() => updateStatus("cancelled")}
                >
                  Cancel order
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="flex-1 bg-black/40" onClick={onClose} />
    </div>
  );
}
function InfoRow({ label, value }) {
  return (
    <div className="rounded-xl border border-[#e8e2d8] bg-[#fff] p-3">
      <div className="text-xs uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="text-sm text-[#4a3f35]">{value}</div>
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
        { cache: "no-store" }
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <div className="text-sm text-neutral-600">Product ID</div>
          <Input
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            placeholder="e.g. 12"
            className="w-40"
          />
        </div>
        <Button onClick={load} variant="outline" className={ui.outline}>
          <RefreshCw className="mr-2 h-4 w-4" /> Load
        </Button>
      </div>

      {/* Add */}
      <Card className={ui.card}>
        <CardHeader>
          <CardTitle className={ui.brand}>Add image</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <LabeledInput
            label="Image URL"
            value={url}
            onChange={setUrl}
            placeholder="https://…"
          />
          <LabeledInput label="Alt text" value={alt} onChange={setAlt} />
          <div className="flex items-end">
            <Button
              onClick={add}
              disabled={!productId || !url}
              className={ui.cta + " w-full"}
            >
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card className={ui.card}>
        <CardHeader>
          <CardTitle className={ui.brand}>Images</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-neutral-500">
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : images.length === 0 ? (
            <div className="text-neutral-500">No images.</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {images
                .sort((a, b) => (a.sort || 0) - (b.sort || 0))
                .map((img) => (
                  <div
                    key={img.id}
                    className="flex items-center justify-between rounded-xl border border-[#f0ebe4] p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="h-12 w-16 overflow-hidden rounded bg-[#f3eee6]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.url}
                          alt={img.alt || ""}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm text-[#4a3f35]">
                          {img.url}
                        </div>
                        <div className="text-xs text-neutral-600">
                          alt: {img.alt || "—"} • sort: {img.sort ?? 0}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        className={ui.outline}
                        onClick={() => bump(img, -1)}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        className={ui.outline}
                        onClick={() => bump(img, 1)}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        className="border-red-200 text-red-600 hover:bg-red-50"
                        onClick={() => remove(img)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------
   Subscribers
------------------------------------------------------------- */
function SubscribersSection() {
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-[#8b6f47]" />
          <h3 className="font-serif text-lg text-[#4a3f35]">
            Newsletter subscribers
          </h3>
        </div>
        <div className="text-sm text-neutral-600">{rows.length} total</div>
      </div>

      <Card className={ui.card}>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[#faf7f1] text-[#6b625a]">
                <tr>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Joined</th>
                  <th className="px-4 py-3 text-left">Confirmed</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows cols={3} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan="3"
                      className="px-4 py-8 text-center text-neutral-500"
                    >
                      No subscribers yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.email} className="border-t border-[#f0ebe4]">
                      <td className="px-4 py-3">{r.email}</td>
                      <td className="px-4 py-3">{formatDate(r.created_at)}</td>
                      <td className="px-4 py-3">
                        {r.confirmed_at ? formatDate(r.confirmed_at) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={exportCsv} className={ui.cta}>
          Export CSV
        </Button>
      </div>
    </div>
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
    <div className="grid gap-4 md:grid-cols-2">
      <Card className={ui.card}>
        <CardHeader>
          <CardTitle className={ui.brand}>Shop availability</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-[#e8e2d8] p-3">
            <div>
              <div className="text-sm font-medium text-[#4a3f35]">
                Pause shop
              </div>
              <div className="text-xs text-neutral-600">
                Temporarily hide checkout
              </div>
            </div>
            <Switch checked={paused} onCheckedChange={setPaused} />
          </div>
          <LabeledTextarea
            label="Pause message"
            value={message}
            onChange={setMessage}
            placeholder="We are closed for harvest week…"
          />
          <div className="flex justify-end">
            <Button onClick={save} disabled={saving} className={ui.cta}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className={ui.card}>
        <CardHeader>
          <CardTitle className={ui.brand}>Data notes</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
            <li>
              Products: <code>shop_product</code>, images:{" "}
              <code>shop_image</code>.
            </li>
            <li>
              Orders: <code>shop_order</code> & <code>shop_order_item</code>.
              Payments link via <code>payment</code>.
            </li>
            <li>
              Invoices (optional): table <code>invoice</code>.
            </li>
            <li>
              Newsletter: <code>newsletter_subscribers</code>.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------
   Reusable fields
------------------------------------------------------------- */
function LabeledInput({ label, helper, value, onChange, ...rest }) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium text-[#4a3f35]">{label}</div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      />
      {helper ? <div className="text-xs text-neutral-600">{helper}</div> : null}
    </div>
  );
}
function LabeledTextarea({ label, value, onChange, ...rest }) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium text-[#4a3f35]">{label}</div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      />
    </div>
  );
}
