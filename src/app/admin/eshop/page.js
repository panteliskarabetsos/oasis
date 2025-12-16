"use client";

import React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Store,
  LayoutDashboard,
  PackageSearch,
  ListOrdered,
  Image as ImageIcon,
  Mail,
  Settings,
  RefreshCw,
  Search,
  Plus,
  Eye,
  Trash2,
  Edit,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Euro,
  ToggleLeft,
  ToggleRight,
  ArrowUp,
  ArrowDown,
  X,
  CheckCircle2,
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
  page: "min-h-screen bg-gradient-to-b from-zinc-50 via-stone-50 to-amber-50/40 text-zinc-900",
  container: "mx-auto max-w-7xl px-4 sm:px-6 py-8",
  panel:
    "rounded-2xl border border-zinc-200/70 bg-white/70 backdrop-blur shadow-sm",
  card: "rounded-2xl border border-zinc-200/70 bg-white shadow-sm",
  softCard:
    "rounded-2xl border border-zinc-200/70 bg-white/70 backdrop-blur shadow-sm",
  muted: "text-zinc-600",
  brand: "text-zinc-900",
  accent: "text-amber-700",
  outlineBtn: "border-zinc-200 bg-white hover:bg-zinc-50",
  dangerBtn: "border-red-200 text-red-600 hover:bg-red-50",
  primaryBtn: "bg-zinc-900 text-white hover:bg-zinc-800",
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
    { key: "overview", label: "Overview", icon: LayoutDashboard },
    { key: "products", label: "Products", icon: PackageSearch },
    { key: "orders", label: "Orders", icon: ListOrdered },
    { key: "images", label: "Images", icon: ImageIcon },
    { key: "subscribers", label: "Subscribers", icon: Mail },
    { key: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className={ui.page}>
      <div className={ui.container}>
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <Store className="h-5 w-5 text-zinc-900" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">
                  E-shop Manager
                </h1>
                <Badge className="rounded-full bg-amber-100 text-amber-800 hover:bg-amber-100">
                  Admin
                </Badge>
              </div>
              <p className={cx("text-sm", ui.muted)}>
                Manage products, orders, images, subscribers and shop
                availability.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/eshop/new-product"
              className={cx(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm shadow-sm transition",
                ui.primaryBtn
              )}
            >
              <Plus className="h-4 w-4" />
              New product
            </Link>

            <div className="hidden items-center gap-2 text-xs text-zinc-500 md:flex">
              <kbd className="rounded-md border border-zinc-200 bg-white px-2 py-1">
                g
              </kbd>
              <span>then</span>
              <kbd className="rounded-md border border-zinc-200 bg-white px-2 py-1">
                o/p/r/i/s/t
              </kbd>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
          {/* Sidebar (desktop) */}
          <aside className={cx("hidden lg:block", ui.panel)}>
            <div className="p-3">
              <div className="px-2 pb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                Navigation
              </div>
              <div className="space-y-1">
                {nav.map((it) => (
                  <NavItem
                    key={it.key}
                    active={tab === it.key}
                    onClick={() => setTab(it.key)}
                    icon={it.icon}
                    label={it.label}
                  />
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-3">
                <div className="text-sm font-medium text-zinc-900">Tips</div>
                <div className="mt-1 text-xs text-zinc-600">
                  Use quick keys: <span className="font-mono">g</span> then{" "}
                  <span className="font-mono">o/p/r/i/s/t</span>.
                </div>
              </div>
            </div>
          </aside>

          {/* Top nav (mobile/tablet) */}
          <div className="lg:hidden">
            <div className={cx("sticky top-4 z-30", ui.panel)}>
              <div className="flex gap-2 overflow-x-auto p-2">
                {nav.map((it) => (
                  <button
                    key={it.key}
                    onClick={() => setTab(it.key)}
                    className={cx(
                      "inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm transition",
                      tab === it.key
                        ? "bg-zinc-900 text-white shadow-sm"
                        : "bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700"
                    )}
                  >
                    <it.icon className="h-4 w-4" />
                    {it.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Content */}
          <main className="min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18 }}
                className="space-y-6"
              >
                {tab === "overview" && <OverviewSection />}
                {tab === "products" && <ProductsSection />}
                {tab === "orders" && <OrdersSection />}
                {tab === "images" && <ImagesSection />}
                {tab === "subscribers" && <SubscribersSection />}
                {tab === "settings" && <SettingsSection />}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
}

function NavItem({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition",
        active
          ? "bg-zinc-900 text-white shadow-sm"
          : "hover:bg-white/70 text-zinc-700"
      )}
    >
      <span
        className={cx(
          "grid h-9 w-9 place-items-center rounded-xl border",
          active ? "border-white/15 bg-white/10" : "border-zinc-200 bg-white"
        )}
      >
        <Icon
          className={cx("h-4 w-4", active ? "text-white" : "text-zinc-800")}
        />
      </span>
      <span className="font-medium">{label}</span>
    </button>
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
        setError("");
      } catch (err) {
        setError(String(err.message || err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <Card className={ui.softCard}>
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm text-zinc-600">Dashboard</div>
              <div className="text-xl font-semibold tracking-tight text-zinc-900">
                Store health at a glance
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full bg-white text-zinc-700 border border-zinc-200 hover:bg-white">
                Live data
              </Badge>
              <Badge className="rounded-full bg-white text-zinc-700 border border-zinc-200 hover:bg-white">
                Cache: no-store
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Products"
          value={stats.productCount}
          icon={<PackageSearch className="h-5 w-5" />}
          loading={loading}
          error={error}
        />
        <KpiCard
          title="Active products"
          value={stats.activeProductCount}
          icon={<CheckCircle2 className="h-5 w-5" />}
          loading={loading}
        />
        <KpiCard
          title="Pending orders"
          value={stats.ordersPendingCount}
          icon={<ListOrdered className="h-5 w-5" />}
          loading={loading}
        />
        <KpiCard
          title="Revenue (30d)"
          value={formatCents(stats.revenue30dCents)}
          icon={<Euro className="h-5 w-5" />}
          loading={loading}
        />
      </div>
    </div>
  );
}

function KpiCard({ title, value, icon, loading, error }) {
  return (
    <Card className={ui.card}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-zinc-600">
          {title}
        </CardTitle>
        <div className="grid h-9 w-9 place-items-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-800">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : error ? (
          <div className="text-sm text-red-600">{error}</div>
        ) : (
          <div className="text-2xl font-semibold tracking-tight text-zinc-900">
            {value}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------
   Products
------------------------------------------------------------- */
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
    <div className="space-y-4">
      {/* Toolbar / summary */}
      <Card className={ui.softCard}>
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-lg font-semibold tracking-tight">
                  Products
                </div>
                <Badge className="rounded-full bg-white text-zinc-700 border border-zinc-200 hover:bg-white">
                  {totals.total} total
                </Badge>
                <Badge className="rounded-full bg-green-50 text-green-700 border border-green-200 hover:bg-green-50">
                  {totals.active} active
                </Badge>
                <Badge className="rounded-full bg-zinc-50 text-zinc-700 border border-zinc-200 hover:bg-zinc-50">
                  {totals.inactive} inactive
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <FilterPill
                  active={activeFilter === "all"}
                  onClick={() => setActiveFilter("all")}
                >
                  All
                </FilterPill>
                <FilterPill
                  active={activeFilter === "active"}
                  onClick={() => setActiveFilter("active")}
                >
                  Active
                </FilterPill>
                <FilterPill
                  active={activeFilter === "inactive"}
                  onClick={() => setActiveFilter("inactive")}
                >
                  Inactive
                </FilterPill>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search title, slug…"
                  className="pl-9 w-full sm:w-72"
                />
              </div>

              <Button
                variant="outline"
                className={ui.outlineBtn}
                onClick={fetchProducts}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>

              <select
                className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
                value={`${sort.key}:${sort.dir}`}
                onChange={(e) => {
                  const [k, d] = e.target.value.split(":");
                  setSort({ key: k, dir: d });
                }}
                title="Sort"
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
                className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
                value={size}
                onChange={(e) => {
                  setSize(Number(e.target.value || 10));
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
                className={cx(
                  "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm shadow-sm transition",
                  ui.primaryBtn
                )}
              >
                <Plus className="h-4 w-4" />
                New
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className={ui.card}>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-50 text-zinc-600">
                <tr className="border-b border-zinc-200">
                  <ThSort
                    onClick={() => sortBy("title")}
                    active={sort.key === "title"}
                    dir={sort.dir}
                  >
                    Product
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
                  <th className="px-4 py-3 text-left">State</th>
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
                      className="px-4 py-10 text-center text-red-600"
                    >
                      {error}
                    </td>
                  </tr>
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12">
                      <EmptyState
                        title="No products found"
                        subtitle="Try a different search, or create your first product."
                        action={
                          <Link
                            href="/admin/eshop/new-product"
                            className={cx(
                              "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm shadow-sm transition",
                              ui.primaryBtn
                            )}
                          >
                            <Plus className="h-4 w-4" />
                            Create product
                          </Link>
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  pageRows.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-zinc-100 hover:bg-zinc-50/60 transition"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="grid h-9 w-9 place-items-center rounded-xl border border-zinc-200 bg-white">
                            <span className="text-xs font-semibold text-zinc-700">
                              {String(p.title || "P")
                                .slice(0, 1)
                                .toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-medium text-zinc-900">
                              {p.title}
                            </div>
                            <div className="text-xs text-zinc-500">
                              ID: {p.id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zinc-600">{p.slug}</td>
                      <td className="px-4 py-3 font-medium">
                        {formatCents(p.price_cents, p.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleActive(p)}
                          className={cx(
                            "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition",
                            p.active
                              ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                              : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                          )}
                          title="Toggle active"
                        >
                          {p.active ? (
                            <span className="inline-flex items-center">
                              <ToggleRight className="h-4 w-4" />
                            </span>
                          ) : (
                            <span className="inline-flex items-center">
                              <ToggleLeft className="h-4 w-4" />
                            </span>
                          )}
                          {p.active ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {formatDate(p.updated_at || p.updatedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            className={ui.outlineBtn}
                            onClick={() => setEditing(p)}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </Button>

                          <Link
                            href={`/admin/eshop/products/${p.id}/images`}
                            className="inline-flex items-center rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
                          >
                            <ImageIcon className="mr-2 h-4 w-4" />
                            Images
                          </Link>

                          <Button
                            variant="outline"
                            className={ui.dangerBtn}
                            onClick={() => removeProduct(p)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              {!loading && !error && prepared.length > size ? (
                <tfoot>
                  <tr>
                    <td colSpan={6} className="px-4 py-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-xs text-zinc-600">
                          {prepared.length} items • page {page} of {maxPage}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            className={ui.outlineBtn}
                            disabled={page <= 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            className={ui.outlineBtn}
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

function FilterPill({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "rounded-full px-3 py-1.5 text-xs font-medium transition border",
        active
          ? "bg-zinc-900 text-white border-zinc-900"
          : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
      )}
    >
      {children}
    </button>
  );
}

function ThSort({ children, onClick, active, dir }) {
  return (
    <th className="px-4 py-3 text-left">
      <button
        onClick={onClick}
        className="inline-flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-zinc-100 transition"
      >
        <span>{children}</span>
        <span className="text-zinc-400">
          <ArrowUpDown className="h-4 w-4" />
        </span>
        {active ? (
          <span className="text-xs text-zinc-500">
            {dir === "asc" ? "↑" : "↓"}
          </span>
        ) : null}
      </button>
    </th>
  );
}

function SkeletonRows({ cols }) {
  return (
    <>
      {Array.from({ length: 7 }).map((_, i) => (
        <tr key={i} className="border-b border-zinc-100">
          <td colSpan={cols} className="px-4 py-4">
            <div className="h-4 w-full animate-pulse rounded bg-zinc-200/60" />
          </td>
        </tr>
      ))}
    </>
  );
}

function EmptyState({ title, subtitle, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-8 text-center">
      <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl border border-zinc-200 bg-zinc-50">
        <PackageSearch className="h-5 w-5 text-zinc-700" />
      </div>
      <div className="text-base font-semibold text-zinc-900">{title}</div>
      <div className="mx-auto mt-1 max-w-md text-sm text-zinc-600">
        {subtitle}
      </div>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------
   Product Modal (self-contained)
------------------------------------------------------------- */
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

  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState("");

  const save = async () => {
    try {
      setSaving(true);
      setErr("");

      const payload = {
        title,
        slug,
        price_cents: centsFromInput(price),
        currency,
        description,
        active,
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={{ duration: 0.18 }}
        className="relative w-full max-w-2xl"
      >
        <Card className={cx(ui.card, "overflow-hidden")}>
          <CardHeader className="border-b border-zinc-200 bg-zinc-50">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Edit product</CardTitle>
                <div className="mt-1 text-sm text-zinc-600">
                  ID: {existing.id}
                </div>
              </div>
              <Button
                variant="outline"
                className={ui.outlineBtn}
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-5 sm:p-6 space-y-4">
            {err ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {err}
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <LabeledInput
                label="Title"
                value={title}
                onChange={setTitle}
                placeholder="Product name"
              />
              <LabeledInput
                label="Slug"
                value={slug}
                onChange={setSlug}
                placeholder="product-slug"
              />
              <LabeledInput
                label="Price"
                helper="Use decimals (e.g. 12.50)"
                value={price}
                onChange={setPrice}
                placeholder="0.00"
              />
              <div className="space-y-1">
                <div className="text-sm font-medium text-zinc-900">
                  Currency
                </div>
                <select
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                </select>
                <div className="text-xs text-zinc-500">
                  Must match how you charge customers.
                </div>
              </div>
            </div>

            <LabeledTextarea
              label="Description"
              value={description}
              onChange={setDescription}
              placeholder="Short description for the storefront…"
            />

            <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4">
              <div>
                <div className="text-sm font-medium text-zinc-900">Active</div>
                <div className="text-xs text-zinc-600">
                  Visible and purchasable in the store.
                </div>
              </div>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
              <Button
                variant="outline"
                className={ui.outlineBtn}
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                onClick={save}
                disabled={saving}
                className={ui.primaryBtn}
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Save changes
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
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

  return (
    <div className="space-y-4">
      <Card className={ui.softCard}>
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-lg font-semibold tracking-tight">Orders</div>
              <div className="text-sm text-zinc-600">
                Review payments and fulfillment status.
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
              >
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="fulfilled">Fulfilled</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by email, id…"
                  className="pl-9 w-full sm:w-72"
                />
              </div>

              <Button
                variant="outline"
                className={ui.outlineBtn}
                onClick={fetchOrders}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={ui.card}>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-50 text-zinc-600">
                <tr className="border-b border-zinc-200">
                  <th className="px-4 py-3 text-left">Order #</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Total</th>
                  <th className="px-4 py-3 text-left">Placed</th>
                  <th className="px-4 py-3 text-left">Payment</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows cols={6} />
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-12">
                      <EmptyState
                        title="No orders"
                        subtitle="When customers place orders, they’ll show up here."
                      />
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => (
                    <tr
                      key={o.id}
                      className="border-b border-zinc-100 hover:bg-zinc-50/60 transition"
                    >
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        {o.id}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={o.status} />
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {formatCents(o.total_cents, o.currency)}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {formatDate(o.placed_at || o.created_at)}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {o.stripe_payment_intent_id ? "Stripe" : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="outline"
                          className={ui.outlineBtn}
                          onClick={() => setSelected(o)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View
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
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    paid: "bg-green-50 text-green-700 border-green-200",
    fulfilled: "bg-blue-50 text-blue-700 border-blue-200",
    cancelled: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        map[status] || "bg-zinc-50 text-zinc-700 border-zinc-200"
      )}
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

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <motion.div
        initial={{ x: 30, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 30, opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="h-full w-full max-w-xl overflow-auto bg-white shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl border border-zinc-200 bg-zinc-50">
              <ListOrdered className="h-5 w-5 text-zinc-800" />
            </div>
            <div>
              <div className="text-sm text-zinc-600">Order</div>
              <div className="font-semibold tracking-tight text-zinc-900">
                #{orderId}
              </div>
            </div>
          </div>
          <Button variant="outline" className={ui.outlineBtn} onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="p-5 space-y-5">
          {loading ? (
            <div className="text-zinc-500">
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : err ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {err}
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
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

              <Card className={ui.card}>
                <CardHeader>
                  <CardTitle className="text-base">Items</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-zinc-50 text-zinc-600">
                        <tr className="border-b border-zinc-200">
                          <th className="px-3 py-2 text-left">Product</th>
                          <th className="px-3 py-2 text-left">Qty</th>
                          <th className="px-3 py-2 text-left">Unit</th>
                          <th className="px-3 py-2 text-left">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data.items || []).map((it) => (
                          <tr key={it.id} className="border-b border-zinc-100">
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
                </CardContent>
              </Card>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className={ui.outlineBtn}
                  disabled={updating}
                  onClick={() => updateStatus("paid")}
                >
                  Mark paid
                </Button>
                <Button
                  variant="outline"
                  className={ui.outlineBtn}
                  disabled={updating}
                  onClick={() => updateStatus("fulfilled")}
                >
                  Mark fulfilled
                </Button>
                <Button
                  variant="outline"
                  className={ui.dangerBtn}
                  disabled={updating}
                  onClick={() => updateStatus("cancelled")}
                >
                  Cancel order
                </Button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-sm text-zinc-900">{value}</div>
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
    <div className="space-y-4">
      <Card className={ui.softCard}>
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-lg font-semibold tracking-tight">Images</div>
              <div className="text-sm text-zinc-600">
                Add and order product gallery images.
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div>
                <div className="text-xs font-medium text-zinc-600">
                  Product ID
                </div>
                <Input
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  placeholder="e.g. 12"
                  className="w-full sm:w-44"
                />
              </div>
              <Button
                onClick={load}
                variant="outline"
                className={ui.outlineBtn}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Load
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={ui.card}>
        <CardHeader>
          <CardTitle className="text-base">Add image</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <LabeledInput
            label="Image URL"
            value={url}
            onChange={setUrl}
            placeholder="https://…"
          />
          <LabeledInput
            label="Alt text"
            value={alt}
            onChange={setAlt}
            placeholder="Optional…"
          />
          <div className="flex items-end">
            <Button
              onClick={add}
              disabled={!productId || !url}
              className={cx(ui.primaryBtn, "w-full")}
            >
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className={ui.card}>
        <CardHeader>
          <CardTitle className="text-base">Gallery</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-zinc-500">
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : images.length === 0 ? (
            <EmptyState
              title="No images"
              subtitle="Load a product ID and add the first image URL."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {images
                .sort((a, b) => (a.sort || 0) - (b.sort || 0))
                .map((img) => (
                  <div
                    key={img.id}
                    className="rounded-2xl border border-zinc-200 bg-white p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-14 w-20 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.url}
                          alt={img.alt || ""}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-zinc-900">
                          {img.url}
                        </div>
                        <div className="text-xs text-zinc-600">
                          alt: {img.alt || "—"} • sort: {img.sort ?? 0}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        className={ui.outlineBtn}
                        onClick={() => bump(img, -1)}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        className={ui.outlineBtn}
                        onClick={() => bump(img, 1)}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        className={ui.dangerBtn}
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
    <div className="space-y-4">
      <Card className={ui.softCard}>
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl border border-zinc-200 bg-white">
                <Mail className="h-5 w-5 text-zinc-800" />
              </div>
              <div>
                <div className="text-lg font-semibold tracking-tight">
                  Newsletter subscribers
                </div>
                <div className="text-sm text-zinc-600">{rows.length} total</div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search email…"
                  className="pl-9 w-full sm:w-72"
                />
              </div>
              <Button onClick={exportCsv} className={ui.primaryBtn}>
                Export CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={ui.card}>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-50 text-zinc-600">
                <tr className="border-b border-zinc-200">
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Joined</th>
                  <th className="px-4 py-3 text-left">Confirmed</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows cols={3} />
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="px-4 py-12">
                      <EmptyState
                        title="No subscribers"
                        subtitle="Subscribers will appear as users sign up."
                      />
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <tr
                      key={r.email}
                      className="border-b border-zinc-100 hover:bg-zinc-50/60 transition"
                    >
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        {r.email}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {formatDate(r.created_at)}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
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
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className={ui.card}>
        <CardHeader>
          <CardTitle className="text-base">Shop availability</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4">
            <div>
              <div className="text-sm font-medium text-zinc-900">
                Pause shop
              </div>
              <div className="text-xs text-zinc-600">
                Temporarily disable checkout & show a message.
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
            <Button onClick={save} disabled={saving} className={ui.primaryBtn}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save settings
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className={ui.softCard}>
        <CardHeader>
          <CardTitle className="text-base">Data notes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700">
              <li>
                Products:{" "}
                <code className="rounded bg-zinc-100 px-1">shop_product</code>,
                images:{" "}
                <code className="rounded bg-zinc-100 px-1">shop_image</code>.
              </li>
              <li>
                Orders:{" "}
                <code className="rounded bg-zinc-100 px-1">shop_order</code> &{" "}
                <code className="rounded bg-zinc-100 px-1">
                  shop_order_item
                </code>
                . Payments link via{" "}
                <code className="rounded bg-zinc-100 px-1">payment</code>.
              </li>
              <li>
                Invoices (optional):{" "}
                <code className="rounded bg-zinc-100 px-1">invoice</code>.
              </li>
              <li>
                Newsletter:{" "}
                <code className="rounded bg-zinc-100 px-1">
                  newsletter_subscribers
                </code>
                .
              </li>
            </ul>
          </div>
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
      <div className="text-sm font-medium text-zinc-900">{label}</div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      />
      {helper ? <div className="text-xs text-zinc-500">{helper}</div> : null}
    </div>
  );
}

function LabeledTextarea({ label, value, onChange, ...rest }) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium text-zinc-900">{label}</div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      />
    </div>
  );
}
