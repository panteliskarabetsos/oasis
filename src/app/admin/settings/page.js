// app/admin/settings/page.js
import "server-only";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ============================= Server actions ============================= */

export async function saveSettings(formData) {
  "use server";
  const admin = createSupabaseAdmin();
  if (!admin) return redirect("/admin/settings?err=no_admin");

  const cmd = (formData.get("cmd") || "save").toString();
  const KEY = "global";

  let bookingspaused = formData.get("bookingspaused") === "on";
  let bookingspausedmessage = (formData.get("bookingspausedmessage") || "")
    .toString()
    .trim();

  const datePart = (formData.get("bookingspauseduntil_date") || "")
    .toString()
    .trim();
  const timePart = (formData.get("bookingspauseduntil_time") || "")
    .toString()
    .trim();

  if (cmd === "clear") {
    bookingspaused = false;
    bookingspausedmessage = null;
  }

  let bookingspauseduntil = null;
  if (cmd !== "clear" && datePart) {
    const t = timePart || "23:59";
    const d = new Date(`${datePart}T${t}:00`);
    bookingspauseduntil = isFinite(d.getTime()) ? d.toISOString() : null;
  }

  const payload = {
    key: KEY,
    bookingspaused,
    bookingspausedmessage: bookingspausedmessage || null,
    bookingspauseduntil,
    updatedat: new Date().toISOString(),
  };

  const { error } = await admin
    .from("AppSetting")
    .upsert(payload, { onConflict: "key" });
  if (error) {
    console.error("[settings] save error:", error.message);
    return redirect("/admin/settings?err=save_fail");
  }

  revalidatePath("/admin/settings");
  return redirect("/admin/settings?saved=1");
}

/** Quick pause preset: now + minutes (e.g., 24h, 7d) */
export async function pauseFor(formData) {
  "use server";
  const admin = createSupabaseAdmin();
  if (!admin) return redirect("/admin/settings?err=no_admin");

  const KEY = "global";
  const minutes = Number(formData.get("minutes") || 0);
  const msg = (formData.get("message") || "").toString().trim();

  const until = new Date(
    Date.now() + Math.max(1, minutes) * 60_000
  ).toISOString();
  const { error } = await admin.from("AppSetting").upsert(
    {
      key: KEY,
      bookingspaused: true,
      bookingspausedmessage: msg || "Bookings are temporarily paused.",
      bookingspauseduntil: until,
      updatedat: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) {
    console.error("[settings] pauseFor error:", error.message);
    return redirect("/admin/settings?err=pause_fail");
  }
  revalidatePath("/admin/settings");
  return redirect(
    `/admin/settings?paused=1&until=${encodeURIComponent(until)}`
  );
}

/** Housekeeping: delete expired drafts */
export async function cleanExpiredDrafts() {
  "use server";
  const admin = createSupabaseAdmin();
  if (!admin) return redirect("/admin/settings?err=no_admin");

  const nowIso = new Date().toISOString();

  // Count first
  const { count } = await admin
    .from("BookingDraft")
    .select("id", { count: "exact", head: true })
    .eq("status", "draft")
    .lt("expiresAt", nowIso);

  // Delete (don’t need to return rows; just perform)
  const del = await admin
    .from("BookingDraft")
    .delete()
    .eq("status", "draft")
    .lt("expiresAt", nowIso);

  if (del.error) {
    console.error("[settings] cleanExpiredDrafts error:", del.error.message);
    return redirect("/admin/settings?err=clean_fail");
  }
  revalidatePath("/admin/settings");
  return redirect(`/admin/settings?cleanedDrafts=${count || 0}`);
}

/** Deactivate ended campaigns */
export async function deactivateEndedCampaigns() {
  "use server";
  const admin = createSupabaseAdmin();
  if (!admin) return redirect("/admin/settings?err=no_admin");

  const nowIso = new Date().toISOString();

  // Count
  const { count } = await admin
    .from("PromotionCampaign")
    .select("id", { count: "exact", head: true })
    .lt("endsAt", nowIso)
    .eq("active", true);

  const upd = await admin
    .from("PromotionCampaign")
    .update({ active: false, updatedAt: new Date().toISOString() })
    .lt("endsAt", nowIso)
    .eq("active", true);

  if (upd.error) {
    console.error(
      "[settings] deactivateEndedCampaigns error:",
      upd.error.message
    );
    return redirect("/admin/settings?err=campaigns_fail");
  }
  revalidatePath("/admin/settings");
  return redirect(`/admin/settings?deactivatedCampaigns=${count || 0}`);
}

/** Visibility tools for experiences */
export async function setAllExperienceVisibility(formData) {
  "use server";
  const admin = createSupabaseAdmin();
  if (!admin) return redirect("/admin/settings?err=no_admin");

  const visible = (formData.get("visible") || "true").toString() === "true";

  const { count } = await admin
    .from("Experience")
    .select("id", { count: "exact", head: true });

  const upd = await admin
    .from("Experience")
    .update({ visibility: visible, updatedAt: new Date().toISOString() })
    .neq("id", 0); // update all rows

  if (upd.error) {
    console.error(
      "[settings] setAllExperienceVisibility error:",
      upd.error.message
    );
    return redirect("/admin/settings?err=experience_fail");
  }
  revalidatePath("/admin/settings");
  return redirect(
    `/admin/settings?visibilitySet=${visible ? "shown" : "hidden"}&total=${
      count || 0
    }`
  );
}

/* ============================= Data loading ============================= */

async function requireAdminOrRedirect() {
  const supa = await createSupabaseServer();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) redirect("/");

  const { data: row } = await supa
    .from("User")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if ((row?.role ?? "user") !== "admin") redirect("/");
  return supa;
}

async function loadAppSetting() {
  const admin = createSupabaseAdmin();
  if (!admin)
    return {
      key: "global",
      bookingspaused: false,
      bookingspausedmessage: null,
      bookingspauseduntil: null,
    };

  const KEY = "global";
  let { data } = await admin
    .from("AppSetting")
    .select(
      "key, bookingspaused, bookingspausedmessage, bookingspauseduntil, createdat, updatedat"
    )
    .eq("key", KEY)
    .maybeSingle();

  if (!data) {
    const res = await admin

      .from("AppSetting")
      .select(
        "key, bookingspaused, bookingspausedmessage, bookingspauseduntil, createdat, updatedat"
      )
      .limit(1);
    data = res?.data?.[0] || null;
  }
  return (
    data || {
      key: KEY,
      bookingspaused: false,
      bookingspausedmessage: null,
      bookingspauseduntil: null,
    }
  );
}

async function loadStats(supa) {
  const nowIso = new Date().toISOString();

  const [
    subs,
    activePromos,
    activeVouchers,
    visibleExp,
    totalExp,
    expiredDrafts,
  ] = await Promise.all([
    supa
      .from("newsletter_subscribers")
      .select("email", { count: "exact", head: true }),
    supa
      .from("DiscountCode")
      .select("id", { count: "exact", head: true })
      .eq("active", true),
    supa
      .from("Voucher")
      .select("id", { count: "exact", head: true })
      .eq("active", true),
    supa
      .from("Experience")
      .select("id", { count: "exact", head: true })
      .eq("visibility", true),
    supa.from("Experience").select("id", { count: "exact", head: true }),
    supa
      .from("BookingDraft")
      .select("id", { count: "exact", head: true })
      .eq("status", "draft")
      .lt("expiresAt", nowIso),
  ]);

  return {
    subscribers: subs?.count || 0,
    activePromos: activePromos?.count || 0,
    activeVouchers: activeVouchers?.count || 0,
    visibleExperiences: visibleExp?.count || 0,
    totalExperiences: totalExp?.count || 0,
    expiredDrafts: expiredDrafts?.count || 0,
  };
}

/* ================================= Page ================================= */

export default async function SettingsPage({ searchParams }) {
  await requireAdminOrRedirect();

  const supa = await createSupabaseServer(); // keep for auth checks & stats
  const s = await loadAppSetting();
  const stats = await loadStats(supa);
  const now = Date.now();
  const untilTs = s.bookingspauseduntil
    ? Date.parse(s.bookingspauseduntil)
    : null;
  const isPausedEffective = !!s.bookingspaused && (!untilTs || untilTs > now);

  const sp = await searchParams;
  const get = (k) => (typeof sp?.get === "function" ? sp.get(k) : sp?.[k]);

  const saved = get?.("saved") === "1";
  const err = get?.("err") || null;
  const paused = get?.("paused") === "1";
  const untilParam = get?.("until") || null;
  const cleanedDrafts = Number(get?.("cleanedDrafts") || 0);
  const deactivatedCampaigns = Number(get?.("deactivatedCampaigns") || 0);
  const visibilitySet = get?.("visibilitySet") || null;
  const visibilityTotal = Number(get?.("total") || 0);

  const isPaused = Boolean(s.bookingspaused);
  const untilIso = s.bookingspauseduntil || null;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <Header />
      <AlertBar
        saved={saved}
        err={err}
        isPaused={isPaused}
        untilIso={untilIso}
        pausedNow={paused}
        pausedUntilParam={untilParam}
        cleanedDrafts={cleanedDrafts}
        deactivatedCampaigns={deactivatedCampaigns}
        visibilitySet={visibilitySet}
        visibilityTotal={visibilityTotal}
      />

      {/* Stats overview */}
      <StatsBar stats={stats} />

      {/* Bookings Pause */}
      <form action={saveSettings} className="space-y-6 mt-4">
        <Section
          title="Bookings"
          desc="Temporarily pause new bookings and show a banner to customers."
        >
          <Toggle
            name="bookingspaused"
            label="Pause new bookings"
            defaultChecked={isPaused}
          />

          <FieldArea
            label="Pause message (shown to customers)"
            name="bookingspausedmessage"
            placeholder="We're taking a short break and will be back soon."
            defaultValue={s.bookingspausedmessage || ""}
            className="sm:col-span-2"
          />

          <FieldGroup label="Pause until" className="sm:col-span-2">
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                name="bookingspauseduntil_date"
                defaultValue={dateInput(untilIso)}
                className="mt-1 w-full rounded-lg border border-[#e8e5df] bg-white px-3 py-2 text-sm text-[#3f382f] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/40"
              />
              <input
                type="time"
                name="bookingspauseduntil_time"
                step="60"
                defaultValue={timeInput(untilIso)}
                className="mt-1 w-full rounded-lg border border-[#e8e5df] bg-white px-3 py-2 text-sm text-[#3f382f] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/40"
              />
            </div>
            <p className="mt-1 text-[11px] text-[#7a6a58]">
              Leave empty to pause indefinitely (until you unpause).
            </p>
          </FieldGroup>

          {/* Live preview */}
          <Note className="sm:col-span-2">
            <span className="text-xs">Preview:</span>
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {isPaused ? (
                <>
                  <strong>Bookings are currently paused.</strong>{" "}
                  {s.bookingspausedmessage ||
                    "We're taking a short break and will be back soon."}
                  {untilIso ? (
                    <>
                      {" "}
                      (Until <em>{fmtDateTime(untilIso)}</em>)
                    </>
                  ) : null}
                </>
              ) : (
                "No pause banner will be shown to customers."
              )}
            </div>
          </Note>
        </Section>

        <div className="sticky bottom-4 z-10 mt-6 flex flex-wrap items-center justify-end gap-2">
          <button
            type="submit"
            name="cmd"
            value="clear"
            className="inline-flex items-center rounded-lg border border-[#e8e5df] bg-white px-4 py-2 text-sm text-[#3f382f] hover:bg-[#fcfbf8]"
            title="Clear pause settings"
          >
            Unpause now
          </button>
          <button
            type="submit"
            name="cmd"
            value="save"
            className="inline-flex items-center rounded-lg bg-[#3f382f] px-4 py-2 text-sm text-white shadow hover:bg-[#2f2922]"
          >
            Save changes
          </button>
        </div>
      </form>

      {/* Quick pause presets (no client JS; just server actions) */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <PresetCard
          title="Pause for 24 hours"
          desc="Immediately pause bookings for the next day."
          minutes={24 * 60}
        />
        <PresetCard
          title="Pause for 7 days"
          desc="Useful for maintenance or holidays."
          minutes={7 * 24 * 60}
        />
      </div>

      {/* Ops / Housekeeping */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <OpsCard
          title="Delete expired drafts"
          desc="Remove stale checkout drafts that have expired."
          action={cleanExpiredDrafts}
          button="Clean expired drafts"
          footNote={`Currently expired: ${stats.expiredDrafts}`}
        />
        <OpsCard
          title="Deactivate ended campaigns"
          desc="Turn off campaigns that are past their end date."
          action={deactivateEndedCampaigns}
          button="Deactivate ended"
          footNote="Only affects PromotionCampaign.active"
        />
        <VisibilityCard
          total={stats.totalExperiences}
          visible={stats.visibleExperiences}
        />
      </div>
    </div>
  );
}

/* =============================== UI bits =============================== */

function Header() {
  return (
    <div className="mb-4">
      <h1 className="text-2xl font-semibold tracking-tight text-[#3f382f]">
        Settings
      </h1>
      <p className="mt-1 text-sm text-[#7a6a58]">
        Manage booking availability and operations.
      </p>
    </div>
  );
}

function AlertBar({
  saved,
  err,
  isPaused,
  untilIso,
  pausedNow,
  pausedUntilParam,
  cleanedDrafts,
  deactivatedCampaigns,
  visibilitySet,
  visibilityTotal,
}) {
  const items = [];
  if (saved)
    items.push(
      <div
        key="saved"
        className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
      >
        Settings saved.
      </div>
    );
  if (err)
    items.push(
      <div
        key="err"
        className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
      >
        {err === "no_admin"
          ? "Server not configured (Supabase admin)."
          : "Operation failed."}
      </div>
    );
  if (pausedNow) {
    items.push(
      <div
        key="pausedNow"
        className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900"
      >
        Bookings paused{" "}
        {pausedUntilParam ? (
          <>
            until <strong>{fmtDateTime(pausedUntilParam)}</strong>
          </>
        ) : null}
        .
      </div>
    );
  } else if (isPaused) {
    items.push(
      <div
        key="paused"
        className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900"
      >
        Bookings are <strong>PAUSED</strong>
        {untilIso ? (
          <>
            {" "}
            until <strong>{fmtDateTime(untilIso)}</strong>
          </>
        ) : null}
        .
      </div>
    );
  }
  if (cleanedDrafts > 0)
    items.push(
      <div
        key="clean"
        className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-900"
      >
        Deleted <strong>{cleanedDrafts}</strong> expired draft(s).
      </div>
    );
  if (deactivatedCampaigns > 0)
    items.push(
      <div
        key="deact"
        className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-900"
      >
        Deactivated <strong>{deactivatedCampaigns}</strong> ended campaign(s).
      </div>
    );
  if (visibilitySet)
    items.push(
      <div
        key="vis"
        className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-900"
      >
        Experiences set to <strong>{visibilitySet}</strong> ({visibilityTotal}{" "}
        updated).
      </div>
    );

  if (!items.length) return null;
  return <div className="mb-4 space-y-2">{items}</div>;
}

function StatsBar({ stats }) {
  const cards = [
    { label: "Newsletter subscribers", value: stats.subscribers },
    { label: "Active promo codes", value: stats.activePromos },
    { label: "Active vouchers", value: stats.activeVouchers },
    {
      label: "Visible experiences",
      value: `${stats.visibleExperiences}/${stats.totalExperiences}`,
    },
    { label: "Expired drafts", value: stats.expiredDrafts },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-2xl border border-[#e8e5df] bg-white p-4 shadow-[0_1px_0_0_rgba(0,0,0,0.02)]"
        >
          <div className="text-xs uppercase tracking-wide text-[#7a6a58]">
            {c.label}
          </div>
          <div className="mt-1 text-lg font-semibold text-[#3f382f] tabular-nums">
            {c.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function Section({ title, desc, children }) {
  return (
    <section className="rounded-2xl border border-[#e8e5df] bg-white p-4 sm:p-5">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-[#3f382f]">{title}</h2>
        {desc ? <p className="mt-0.5 text-sm text-[#7a6a58]">{desc}</p> : null}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function FieldArea({ label, name, placeholder, defaultValue, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <div className="text-xs text-[#7a6a58]">{label}</div>
      <textarea
        name={name}
        rows={4}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-lg border border-[#e8e5df] bg-white px-3 py-2 text-sm text-[#3f382f] placeholder:text-[#b1a595] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/40"
      />
    </label>
  );
}

function FieldGroup({ label, children, className = "" }) {
  return (
    <div className={`block ${className}`}>
      <div className="text-xs text-[#7a6a58]">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Toggle({ name, label, defaultChecked }) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-[#e8e5df] bg-[#fcfbf8] p-3">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4"
      />
      <span className="text-sm text-[#3f382f]">{label}</span>
    </label>
  );
}

function Note({ children, className = "" }) {
  return (
    <div
      className={`col-span-1 sm:col-span-2 rounded-lg border border-dashed border-[#e8e5df] bg-[#fcfbf8] px-3 py-2 text-xs text-[#7a6a58] ${className}`}
    >
      {children}
    </div>
  );
}

function PresetCard({ title, desc, minutes }) {
  return (
    <form
      action={pauseFor}
      className="rounded-2xl border border-[#e8e5df] bg-white p-4 sm:p-5"
    >
      <h3 className="text-sm font-semibold text-[#3f382f]">{title}</h3>
      <p className="mt-1 text-sm text-[#7a6a58]">{desc}</p>
      <input type="hidden" name="minutes" value={minutes} />
      <label className="mt-3 block">
        <span className="text-xs text-[#7a6a58]">Message (optional)</span>
        <input
          name="message"
          placeholder="We'll be back soon!"
          className="mt-1 w-full rounded-lg border border-[#e8e5df] bg-white px-3 py-2 text-sm text-[#3f382f] placeholder:text-[#b1a595] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/40"
        />
      </label>
      <div className="mt-3 text-right">
        <button
          type="submit"
          className="inline-flex items-center rounded-lg bg-[#3f382f] px-3 py-1.5 text-xs text-white shadow hover:bg-[#2f2922]"
        >
          Apply preset
        </button>
      </div>
    </form>
  );
}

function OpsCard({ title, desc, action, button, footNote }) {
  return (
    <form
      action={action}
      className="rounded-2xl border border-[#e8e5df] bg-white p-4 sm:p-5"
    >
      <h3 className="text-sm font-semibold text-[#3f382f]">{title}</h3>
      <p className="mt-1 text-sm text-[#7a6a58]">{desc}</p>
      {footNote ? (
        <p className="mt-2 text-[11px] text-[#7a6a58]">{footNote}</p>
      ) : null}
      <div className="mt-3">
        <button
          type="submit"
          className="inline-flex items-center rounded-lg border border-[#e8e5df] bg-white px-3 py-1.5 text-xs text-[#3f382f] hover:bg-[#fcfbf8]"
        >
          {button}
        </button>
      </div>
    </form>
  );
}

function VisibilityCard({ total, visible }) {
  return (
    <div className="rounded-2xl border border-[#e8e5df] bg-white p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-[#3f382f]">
        Experience visibility
      </h3>
      <p className="mt-1 text-sm text-[#7a6a58]">
        Visible: <strong>{visible}</strong> / {total}
      </p>
      <div className="mt-3 flex gap-2">
        <form action={setAllExperienceVisibility}>
          <input type="hidden" name="visible" value="true" />
          <button
            type="submit"
            className="inline-flex items-center rounded-lg border border-[#e8e5df] bg-white px-3 py-1.5 text-xs text-[#3f382f] hover:bg-[#fcfbf8]"
            title="Set all experiences to visible"
          >
            Show all
          </button>
        </form>
        <form action={setAllExperienceVisibility}>
          <input type="hidden" name="visible" value="false" />
          <button
            type="submit"
            className="inline-flex items-center rounded-lg border border-[#e8e5df] bg-white px-3 py-1.5 text-xs text-[#3f382f] hover:bg-[#fcfbf8]"
            title="Hide all experiences"
          >
            Hide all
          </button>
        </form>
      </div>
    </div>
  );
}

/* ============================== helpers ============================== */

function dateInput(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return "";
  }
}
function timeInput(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  } catch {
    return "";
  }
}
function fmtDateTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-GB", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
