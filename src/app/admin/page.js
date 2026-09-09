"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

import Icon from "./_ui/Icon";
import { can, effectiveAccess } from "./_ui/nav";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorNote,
  Eyebrow,
  Muted,
  Page,
  PageHeader,
  Section,
  Skeleton,
  StatCard,
  StatusBadge,
} from "./_ui";

/* -------------------------------- helpers -------------------------------- */

const eur = (n) =>
  new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);

const pct = (n) => `${Math.round(Number(n) || 0)}%`;

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/** Real deltas from /api/admin/metrics — hidden when there is no basis. */
function formatDelta(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return undefined;
  const r = Math.abs(v) >= 10 ? Math.round(v) : Math.round(v * 10) / 10;
  return `${r >= 0 ? "+" : ""}${r}%`;
}
function formatPoints(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return undefined;
  const r = Math.round(v * 10) / 10;
  return `${r >= 0 ? "+" : ""}${r} pts`;
}

function useJson(url, { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: enabled });
  const load = useCallback(async () => {
    if (!enabled) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
      setState({ data: json, error: null, loading: false });
    } catch (e) {
      setState({ data: null, error: e.message || "Something went wrong", loading: false });
    }
  }, [url, enabled]);
  useEffect(() => {
    load();
  }, [load]);
  return { ...state, reload: load };
}

/* --------------------------------- page ---------------------------------- */

export default function AdminDashboard() {
  const { data: me } = useJson("/api/me");
  const role = me?.role || null;

  // can() takes effective permissions, not a role name. Passing the role here
  // silently hid every gated section — including from a superadmin.
  const access = effectiveAccess(role, me?.permissions);
  const canSee = (perm) => (role ? can(access, perm) : false);

  const metrics = useJson("/api/admin/metrics?group=day&tz=Europe/Athens", {
    enabled: Boolean(role),
  });
  const activity = useJson("/api/admin/activity?limit=8", { enabled: Boolean(role) });
  const requests = useJson("/api/admin/requests", { enabled: Boolean(role) && canSee("requests") });
  const checkins = useJson("/api/admin/checkins?tz=Europe/Athens", {
    enabled: Boolean(role) && canSee("checkins"),
  });

  const m = metrics.data;
  const trend = useMemo(() => (Array.isArray(m?.trend) ? m.trend : []), [m]);

  const pendingRequests = useMemo(() => {
    const d = requests.data;
    return Array.isArray(d) ? d : d?.items || [];
  }, [requests.data]);

  const today = useMemo(() => {
    const slots = checkins.data?.slots || [];
    const bookings = slots.flatMap((s) => s.bookings || []);
    return {
      slots,
      total: bookings.length,
      arrived: bookings.filter((b) => b.status === "checked_in").length,
      noShow: bookings.filter((b) => b.status === "no_show").length,
    };
  }, [checkins.data]);

  return (
    <Page>
      <PageHeader
        eyebrow={greeting()}
        title={me?.name ? `Welcome back, ${me.name}` : "Operations overview"}
        description="Month to date, plus what needs attention today."
        actions={
          <>
            {canSee("bookings") ? (
              <Button as={Link} href="/admin/bookings/new" variant="primary">
                <Icon name="plus" size={16} /> New booking
              </Button>
            ) : null}
            {canSee("pos") ? (
              <Button as={Link} href="/admin/pos" variant="secondary">
                <Icon name="register" size={16} /> Open POS
              </Button>
            ) : null}
          </>
        }
      />

      {/* --------------------------- attention --------------------------- */}
      {pendingRequests.length > 0 ? (
        <Link href="/admin/requests" className="mb-6 block">
          <div className="flex items-center gap-3 rounded-2xl border border-[#f0e0bb] bg-[#fbf1dc] px-4 py-3 transition-colors hover:bg-[#f8ead0]">
            <Icon name="inbox" size={18} className="text-[#8a6412]" />
            <span className="text-[13px] font-semibold text-[#8a6412]">
              {pendingRequests.length} guest request
              {pendingRequests.length === 1 ? "" : "s"} waiting for review
            </span>
            <Icon name="external" size={15} className="ml-auto text-[#8a6412]" />
          </div>
        </Link>
      ) : null}

      {/* ----------------------------- KPIs ------------------------------ */}
      {metrics.error ? (
        <ErrorNote className="mb-6">
          Couldn’t load metrics — {metrics.error}
        </ErrorNote>
      ) : null}

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.loading || !m ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[132px]" />)
        ) : (
          <>
            <StatCard
              label="Bookings"
              value={m.bookings ?? 0}
              delta={formatDelta(m.deltas?.bookingsPct)}
              hint="Month to date"
              icon={<Icon name="calendar" size={16} />}
            >
              <Spark data={trend} k="bookings" />
            </StatCard>
            {canSee("financials") ? (
              <StatCard
                label="Revenue"
                value={eur(m.revenue)}
                delta={formatDelta(m.deltas?.revenuePct)}
                hint="Month to date"
                accent="success"
                icon={<Icon name="chart" size={16} />}
              >
                <Spark data={trend} k="revenue" tone="#3f6b3f" />
              </StatCard>
            ) : null}
            <StatCard
              label="Occupancy"
              value={pct(m.occupancyPct)}
              delta={formatPoints(m.deltas?.occupancyPoints)}
              hint="Seats filled vs capacity"
              accent="info"
              icon={<Icon name="layers" size={16} />}
            >
              <Spark data={trend} k="occupancyPct" tone="#3a5d80" />
            </StatCard>
            <StatCard
              label="Open seats"
              value={m.openSlots ?? 0}
              hint="Remaining capacity this month"
              accent="warning"
              icon={<Icon name="clock" size={16} />}
            >
              <Spark data={trend} k="openSlots" tone="#8a6412" />
            </StatCard>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* --------------------------- today --------------------------- */}
        {canSee("checkins") ? (
          <Card className="lg:col-span-2">
            <CardHeader
              title="Today"
              description={
                checkins.loading
                  ? "Loading the manifest…"
                  : `${today.arrived} of ${today.total} guests arrived`
              }
              actions={
                <Button as={Link} href="/admin/checkins" size="sm" variant="secondary">
                  Check-in desk
                </Button>
              }
            />
            {checkins.loading ? (
              <div className="space-y-2">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : today.slots.length === 0 ? (
              <EmptyState
                icon={<Icon name="clock" size={20} />}
                title="Nothing scheduled today"
                description="No departures on the calendar for today."
              />
            ) : (
              <>
                <div className="mb-4 h-2 overflow-hidden rounded-full bg-[#f0ebe2]">
                  <div
                    className="h-full rounded-full bg-[#8b6f47] transition-all"
                    style={{
                      width: `${today.total ? (today.arrived / today.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <ul className="divide-y divide-[#f0ebe2]">
                  {today.slots.slice(0, 6).map((s) => {
                    const list = s.bookings || [];
                    const done = list.filter(
                      (b) => b.status === "checked_in" || b.status === "no_show"
                    ).length;
                    return (
                      <li key={s.id} className="flex items-center gap-3 py-2.5">
                        <span className="w-14 shrink-0 rounded-lg bg-[#f7f3ec] px-2 py-1 text-center text-[11px] font-bold text-[#8b6f47]">
                          {new Date(s.date).toLocaleTimeString("en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#3f3127]">
                          {s.experienceName || "Experience"}
                        </span>
                        <span className="text-[12px] text-[#9a8c7e]">
                          {done}/{list.length}
                        </span>
                        {done === list.length && list.length > 0 ? (
                          <Badge variant="success">done</Badge>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </Card>
        ) : null}

        {/* -------------------------- activity ------------------------- */}
        <Card>
          <CardHeader title="Recent activity" />
          {activity.loading ? (
            <div className="space-y-2">
              <Skeleton className="h-9" />
              <Skeleton className="h-9" />
              <Skeleton className="h-9" />
            </div>
          ) : !activity.data?.length ? (
            <Muted>Nothing yet today.</Muted>
          ) : (
            <ul className="space-y-3">
              {(activity.data || []).slice(0, 8).map((a) => (
                <li key={a.id} className="flex gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#b89a6b]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-[#3f3127]">{a.label}</p>
                    {a.meta ? (
                      <p className="truncate text-[11px] text-[#9a8c7e]">{a.meta}</p>
                    ) : null}
                  </div>
                  {a.at ? (
                    <span className="shrink-0 text-[11px] text-[#b0a294]">
                      {new Date(a.at).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* ------------------------- pending queue ------------------------- */}
      {canSee("requests") && pendingRequests.length > 0 ? (
        <Section title="Awaiting your decision" className="mt-8">
          <Card padded={false}>
            <ul className="divide-y divide-[#f0ebe2]">
              {pendingRequests.slice(0, 5).map((r) => (
                <li key={r.id} className="flex items-center gap-4 px-5 py-3.5">
                  <StatusBadge status={r.type === "cancel" ? "cancelled" : "pending"} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[#3f3127]">
                      {r.guestName || r.booking?.primary_contact?.name || "Guest"}
                      {r.reference ? (
                        <span className="ml-2 text-[11px] font-medium text-[#b89a6b]">
                          {r.reference}
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-[11.5px] text-[#9a8c7e]">
                      {r.type === "cancel" ? "Cancellation" : "Reschedule"} ·{" "}
                      {r.experienceName || "—"}
                    </p>
                  </div>
                  <Button as={Link} href="/admin/requests" size="sm" variant="secondary">
                    Review
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        </Section>
      ) : null}
    </Page>
  );
}

/* -------------------------------- sparkline ------------------------------ */

function Spark({ data, k, tone = "#8b6f47" }) {
  const series = (data || [])
    .map((p) => ({ value: Number(p?.[k] ?? p?.value ?? 0) }))
    .filter((p) => Number.isFinite(p.value));

  // Never fabricate a trend — show a flat rule when there is nothing to plot.
  if (series.length < 2) return <div className="h-8 rounded bg-[#f7f3ec]" />;

  return (
    <div className="h-8">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series}>
          <defs>
            <linearGradient id={`sp-${k}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={tone} stopOpacity={0.22} />
              <stop offset="100%" stopColor={tone} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={tone}
            strokeWidth={1.8}
            fill={`url(#sp-${k})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
