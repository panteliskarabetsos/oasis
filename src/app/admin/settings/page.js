// app/admin/settings/page.js
import "server-only";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Optional migration (run once) if you don't have a settings table:
 *
 * create table if not exists public."Setting" (
 *   key text primary key,
 *   value jsonb,
 *   updated_at timestamptz default now(),
 *   updated_by uuid
 * );
 * alter table public."Setting" enable row level security;
 * -- RLS example (allow admins only): create a policy in Supabase or handle with service role.
 */

// ----------------------------- Server Actions -----------------------------
export async function saveSettings(formData) {
  "use server";

  const admin = createSupabaseAdmin();
  if (!admin) return redirect("/admin/settings?err=no_admin");

  // Read values from form
  const siteName = (formData.get("siteName") || "").toString().trim();
  const logoUrl = (formData.get("logoUrl") || "").toString().trim();

  const emailFrom = (formData.get("emailFrom") || "").toString().trim();
  const replyTo = (formData.get("replyTo") || "").toString().trim();

  const locale = (formData.get("locale") || "en-GB").toString().trim();
  const timezone = (formData.get("timezone") || "Europe/Athens")
    .toString()
    .trim();

  const attachInvoicePdf = formData.get("attachInvoicePdf") === "on";
  const includeReceiptLink = formData.get("includeReceiptLink") === "on";

  const automaticTax = formData.get("automaticTax") === "on";
  const taxIdCollection = formData.get("taxIdCollection") === "on";

  const invoicePrefix = (formData.get("invoicePrefix") || "INV-")
    .toString()
    .trim();

  const entries = [
    ["siteName", siteName],
    ["logoUrl", logoUrl],
    ["emailFrom", emailFrom],
    ["replyTo", replyTo],
    ["locale", locale],
    ["timezone", timezone],
    ["attachInvoicePdf", attachInvoicePdf],
    ["includeReceiptLink", includeReceiptLink],
    ["automaticTax", automaticTax],
    ["taxIdCollection", taxIdCollection],
    ["invoicePrefix", invoicePrefix],
  ];

  // Upsert each key to keep it simple & explicit
  const payload = entries.map(([key, value]) => ({
    key,
    value,
    updated_by: null,
  }));

  const { error } = await admin.from("Setting").upsert(payload, {
    onConflict: "key",
  });

  if (error) {
    console.error("[settings] save error:", error.message);
    return redirect("/admin/settings?err=save_fail");
  }

  revalidatePath("/admin/settings");
  return redirect("/admin/settings?saved=1");
}

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

async function loadSettings(supa) {
  const { data: rows, error } = await supa.from("Setting").select("key,value");
  if (error || !rows) return {};

  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

// ----------------------------- Page -----------------------------
export default async function SettingsPage({ searchParams }) {
  await requireAdminOrRedirect();

  const supa = await createSupabaseServer();
  const kv = await loadSettings(supa);

  // Defaults + env hints
  const envEmailFrom = process.env.EMAIL_FROM || process.env.EMAIL_USER || "";
  const envIsOverridingFrom = Boolean(envEmailFrom);
  const envReplyTo = process.env.EMAIL_REPLY_TO || "";
  const isTest = (
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
  ).startsWith("pk_test_");

  const q = (await searchParams) || {};
  const saved = q.saved === "1" || q.get?.("saved") === "1";
  const err = q.err || q.get?.("err");

  return (
    <div className="mx-auto w-full max-w-5xl">
      <Header />
      <AlertBar saved={saved} err={err} isTest={isTest} />

      <form action={saveSettings} className="space-y-6">
        {/* Branding */}
        <Section title="Branding" desc="Name and visuals shown to customers.">
          <Field
            label="Site name"
            name="siteName"
            defaultValue={kv.siteName || ""}
          />
          <Field
            label="Logo URL"
            name="logoUrl"
            placeholder="https://…/logo.png"
            defaultValue={kv.logoUrl || ""}
          />
        </Section>

        {/* Email */}
        <Section
          title="Email"
          desc="From/reply information for confirmation emails."
        >
          <Field
            label={`From address${
              envIsOverridingFrom ? " (env overrides)" : ""
            }`}
            name="emailFrom"
            placeholder="Bookings <hello@yourdomain.com>"
            defaultValue={kv.emailFrom || ""}
            help={
              envIsOverridingFrom
                ? `Currently using ${envEmailFrom} from environment.`
                : "Use a verified domain (not Gmail/Outlook)."
            }
          />
          <Field
            label={`Reply-To${envReplyTo ? " (env overrides)" : ""}`}
            name="replyTo"
            placeholder="support@yourdomain.com"
            defaultValue={kv.replyTo || ""}
            help={envReplyTo ? `Currently ${envReplyTo} from environment.` : ""}
          />
        </Section>

        {/* Payments & Docs */}
        <Section
          title="Payments & documents"
          desc="What customers receive after paying."
        >
          <Toggle
            name="attachInvoicePdf"
            label="Attach Stripe invoice PDF to confirmation emails"
            defaultChecked={Boolean(kv.attachInvoicePdf ?? true)}
          />
          <Toggle
            name="includeReceiptLink"
            label="Include Stripe hosted receipt link"
            defaultChecked={Boolean(kv.includeReceiptLink ?? true)}
          />
          <Field
            label="Invoice prefix"
            name="invoicePrefix"
            placeholder="INV-"
            defaultValue={kv.invoicePrefix || "INV-"}
            help="Shown as Invoice # prefix in emails/UI."
          />
          <Note>
            Stripe mode:{" "}
            <strong className={isTest ? "text-amber-700" : "text-emerald-700"}>
              {isTest ? "TEST" : "LIVE"}
            </strong>
          </Note>
        </Section>

        {/* Tax */}
        <Section title="Tax" desc="VAT/tax settings for invoices.">
          <Toggle
            name="automaticTax"
            label="Enable Stripe Automatic Tax"
            defaultChecked={Boolean(kv.automaticTax ?? false)}
          />
          <Toggle
            name="taxIdCollection"
            label="Collect customer tax IDs when supported"
            defaultChecked={Boolean(kv.taxIdCollection ?? false)}
          />
        </Section>

        {/* Locale & time */}
        <Section
          title="Locale & time"
          desc="Formatting for dates and currency."
        >
          <Field
            label="Locale"
            name="locale"
            placeholder="en-GB"
            defaultValue={kv.locale || "en-GB"}
          />
          <Field
            label="Timezone"
            name="timezone"
            placeholder="Europe/Athens"
            defaultValue={kv.timezone || "Europe/Athens"}
          />
        </Section>

        <div className="sticky bottom-4 z-10 mt-8 flex items-center justify-end">
          <button
            type="submit"
            className="inline-flex items-center rounded-lg bg-[#3f382f] px-4 py-2 text-sm text-white shadow hover:bg-[#2f2922]"
          >
            Save changes
          </button>
        </div>
      </form>
    </div>
  );
}

// ----------------------------- UI bits -----------------------------
function Header() {
  return (
    <div className="mb-4">
      <h1 className="text-2xl font-semibold tracking-tight text-[#3f382f]">
        Settings
      </h1>
      <p className="mt-1 text-sm text-[#7a6a58]">
        Manage branding, emails, payment documents, tax, and locale.
      </p>
    </div>
  );
}

function AlertBar({ saved, err, isTest }) {
  if (!saved && !err && !isTest) return null;

  return (
    <div className="mb-4 space-y-2">
      {saved ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Settings saved.
        </div>
      ) : null}
      {err ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {err === "no_admin"
            ? "Server not configured (Supabase admin)."
            : "Failed to save settings."}
        </div>
      ) : null}
      {isTest ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
          Stripe is in <strong>TEST MODE</strong>. Use test cards only; charges
          are not real.
        </div>
      ) : null}
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

function Field({ label, name, placeholder, defaultValue, help }) {
  return (
    <label className="block">
      <div className="text-xs text-[#7a6a58]">{label}</div>
      <input
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-lg border border-[#e8e5df] bg-white px-3 py-2 text-sm text-[#3f382f] placeholder:text-[#b1a595] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/40"
      />
      {help ? (
        <div className="mt-1 text-[11px] text-[#7a6a58]">{help}</div>
      ) : null}
    </label>
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

function Note({ children }) {
  return (
    <div className="col-span-1 sm:col-span-2 rounded-lg border border-dashed border-[#e8e5df] bg-[#fcfbf8] px-3 py-2 text-xs text-[#7a6a58]">
      {children}
    </div>
  );
}
