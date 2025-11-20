// src/app/[locale]/booking/[id]/attendees/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { format, parseISO } from "date-fns";
import { enGB, el as elLocale } from "date-fns/locale";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  Loader2,
  MapPin,
  Users,
  Phone,
  Mail,
  Info,
  User,
  CheckCircle2,
  Star,
  CreditCard,
  ChevronDown,
  Edit3,
  ShieldCheck,
} from "lucide-react";
import { useTranslations, useLocale } from "next-intl";

export default function AttendeesPage() {
  const router = useRouter();
  const { id } = useParams();
  const draftId = Number(id);
  const searchParams = useSearchParams();

  const t = useTranslations("BookingAttendees");
  const locale = useLocale();
  const dateLocale = locale === "el" ? elLocale : enGB;

  const initialExpiresAtFromQuery = searchParams.get("expiresAt") || null;

  // Draft expiry
  const [expiresAt, setExpiresAt] = useState(initialExpiresAtFromQuery);
  const {
    formatted: timeLeft,
    expired,
    progress: holdProgress,
  } = useDraftCountdown(expiresAt);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Draft data
  const [counts, setCounts] = useState({ adults: 0, kids: 0 });
  const [unitPrices, setUnitPrices] = useState({ adult: 0, kid: 0 });
  const [totalAmount, setTotalAmount] = useState(0);
  const [experience, setExperience] = useState(null);
  const [slot, setSlot] = useState(null);

  // Primary contact
  const [pcName, setPcName] = useState("");
  const [pcEmail, setPcEmail] = useState("");
  const [pcPhone, setPcPhone] = useState("");

  // Auto-link primary contact name to first adult
  const [autoPcFromFirstAdult, setAutoPcFromFirstAdult] = useState(true);

  // Attendees array
  const expectedTotal = useMemo(
    () => Number(counts.adults || 0) + Number(counts.kids || 0),
    [counts]
  );
  const [attendees, setAttendees] = useState([]);

  const completedCount = useMemo(
    () =>
      attendees.filter(
        (a) => a.firstName?.trim() && a.lastName?.trim() && a.age !== ""
      ).length,
    [attendees]
  );
  const progressPct = expectedTotal
    ? Math.round((completedCount / expectedTotal) * 100)
    : 0;

  // Figure out the first adult
  const firstAdultIndex = useMemo(
    () => attendees.findIndex((a) => a.category === "adult"),
    [attendees]
  );
  const firstAdultFullName = useMemo(() => {
    if (firstAdultIndex === -1) return "";
    const a = attendees[firstAdultIndex] || {};
    const fn = (a.firstName || "").trim();
    const ln = (a.lastName || "").trim();
    return [fn, ln].filter(Boolean).join(" ");
  }, [firstAdultIndex, attendees]);

  // Keep pcName in sync with first adult while toggle is ON
  useEffect(() => {
    if (autoPcFromFirstAdult) setPcName(firstAdultFullName);
  }, [firstAdultFullName, autoPcFromFirstAdult]);

  useEffect(() => {
    if (expired) {
      toast.error(t("toastHoldExpired"));
    }
  }, [expired, t]);

  // Fetch draft
  useEffect(() => {
    if (!Number.isFinite(draftId) || draftId <= 0) {
      setError(t("invalidBookingId"));
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/bookings/drafts/${draftId}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          const msg =
            (await res.json().catch(() => ({})))?.error ||
            t("failedToLoadDraft");
          throw new Error(msg);
        }
        const data = await res.json();

        // NEW: support either { draft, experience, slot } or legacy flat shape
        const d = data?.draft || data;
        // Keep frontend timer in sync with server expiry
        if (d?.expiresAt) {
          setExpiresAt(d.expiresAt);
        }

        // If already paid/converted, bounce to confirmation
        const st = String(d?.status || "").toLowerCase();
        if (st === "paid" || st === "converted" || data?.bookingId) {
          router.replace(`/${locale}/booking/${draftId}/confirmation`);
          return;
        }

        setCounts({
          adults: Number(d?.counts?.adults || 0),
          kids: Number(d?.counts?.kids || 0),
        });

        // Prefer unitPrices helper; fall back to unitPriceAdult/UnitPriceKid
        const up = d?.unitPrices || {
          adult: Number(d?.unitPriceAdult || 0),
          kid: Number(
            d?.unitPriceKid != null ? d.unitPriceKid : d?.unitPriceAdult || 0
          ),
        };
        setUnitPrices({
          adult: Number(up.adult || 0),
          kid: Number(up.kid || 0),
        });

        setTotalAmount(Number(d?.totalAmount || 0));

        setExperience(data?.experience || d?.experience || null);
        setSlot(data?.slot || d?.slot || null);

        const pc = d?.primary_contact || d?.primaryContact || null;
        if (pc) {
          setPcName(pc.name || "");
          setPcEmail(pc.email || "");
          setPcPhone(pc.phone || "");
          if (pc.name) setAutoPcFromFirstAdult(false);
        }

        // Build attendee list to match expected total & categories
        const catList = makeCategoryList(
          Number(d?.counts?.adults || 0),
          Number(d?.counts?.kids || 0)
        );

        const existing = Array.isArray(d?.attendees) ? d.attendees : [];
        const initial = catList.map((cat, i) => ({
          firstName: existing[i]?.firstName || "",
          lastName: existing[i]?.lastName || "",
          age: existing[i]?.age ?? "",
          allergies: existing[i]?.allergies || "",
          category: cat,
        }));

        setAttendees(initial);
        setError("");
      } catch (e) {
        console.error(e);
        setError(e.message || t("failedToLoadDraft"));
        toast.error(e.message || t("failedToLoadDraft"));
      } finally {
        setLoading(false);
      }
    })();
  }, [draftId, router, t, locale]);

  const when = useMemo(() => {
    if (!slot?.date) return null;
    const d =
      typeof slot.date === "string" ? parseISO(slot.date) : new Date(slot.date);
    return {
      dateLabel: format(d, "PPP", { locale: dateLocale }),
      timeLabel: format(d, "p", { locale: dateLocale }),
    };
  }, [slot, dateLocale]);

  // Price breakdown
  const priceBreakdown = useMemo(() => {
    const A = Number(counts.adults || 0);
    const K = Number(counts.kids || 0);
    const la = A * unitPrices.adult;
    const lk = K * unitPrices.kid;
    const sum = la + lk;
    return {
      lines: [
        A > 0 && {
          label: t("priceLineAdults", {
            count: A,
            price: eur(unitPrices.adult),
          }),
          value: eur(la),
        },
        K > 0 && {
          label: t("priceLineKids", {
            count: K,
            price: eur(unitPrices.kid),
          }),
          value: eur(lk),
        },
      ].filter(Boolean),
      total: eur(sum),
    };
  }, [counts, unitPrices, t]);

  function onChangeAttendee(idx, field, value) {
    setAttendees((prev) => {
      const next = prev.slice();
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }

  async function handleSaveAndContinue() {
    const effectivePcName = autoPcFromFirstAdult
      ? firstAdultFullName || pcName
      : pcName;

    const issues = validate(
      attendees,
      counts,
      {
        name: effectivePcName,
        email: pcEmail,
        phone: pcPhone,
      },
      t
    );
    if (issues.length) {
      toast.error(issues[0]);
      return;
    }

    try {
      setSaving(true);
      const res = await fetch(`/api/bookings/drafts/${draftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryContact: {
            name: (effectivePcName || "").trim(),
            email: pcEmail.trim(),
            phone: pcPhone.trim(),
          },
          attendees: attendees.map((a) => ({
            firstName: a.firstName.trim(),
            lastName: a.lastName.trim(),
            age: Number(a.age),
            allergies: (a.allergies || "").trim(),
            category: a.category,
          })),
        }),
      });

      if (!res.ok) {
        const msg =
          (await res.json().catch(() => ({})))?.error || t("couldNotSave");
        throw new Error(msg);
      }

      const params = new URLSearchParams();
      if (expiresAt) params.set("expiresAt", expiresAt);

      const qs = params.toString();
      router.push(`/${locale}/booking/${draftId}/payment${qs ? `?${qs}` : ""}`);
    } catch (e) {
      console.error(e);
      toast.error(e.message || t("genericError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,rgba(233,227,217,0.7),transparent_45%),linear-gradient(to_bottom,#f7f3ed,#f4f1ec)]">
      {/* Top bar */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-6 sm:pt-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 text-[#725b3b] text-sm border border-[#8b6f47]/50 rounded-full px-4 py-2 bg-white/70 hover:bg-[#f4f1ec] hover:text-[#5a4a3f] transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c4b89f] focus-visible:ring-offset-2"
            >
              <ArrowLeft size={16} />
              {t("back")}
            </button>
            <span className="hidden sm:inline-flex items-center gap-2 text-xs text-[#7a6a58] pl-2">
              <Users size={14} className="opacity-80" />
              {t("topStep2Label")}
            </span>
          </div>

          <Stepper current={2} t={t} />
        </div>
      </div>

      {/* Header */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 mt-6">
        {expiresAt && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {expired ? (
                  <span>{t("holdBannerExpired")}</span>
                ) : (
                  <span>{t("holdBannerActive", { timeLeft })}</span>
                )}
              </div>

              {!expired && (
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-amber-800/80">
                    {t("holdTimeLeftLabel")}
                  </span>
                  <div className="h-1.5 w-28 overflow-hidden rounded-full bg-amber-100">
                    <div
                      className="h-full bg-amber-500 transition-[width] duration-1000 ease-linear"
                      style={{ width: `${holdProgress * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        <div className="relative overflow-hidden rounded-3xl border border-[#e5e0d8] bg-[#fcf9f4]/95 shadow-[0_16px_40px_rgba(90,74,63,0.10)]">
          <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-[#e9e3d9] opacity-70 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-[#e1d6c5] opacity-60 blur-3xl" />
          <div className="relative z-10 p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-[#efeae2] p-2 shadow-inner">
                  <Users className="h-5 w-5 text-[#8b6f47]" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[#b09f8a]">
                    {t("guestDetailsTag")}
                  </p>
                  <h1 className="mt-1 text-2xl sm:text-3xl font-serif font-semibold text-[#5a4a3f] tracking-tight">
                    {experience?.name || t("bookingTitleFallback")}
                  </h1>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-[#6b5e53]">
                    {experience?.location && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin size={14} className="text-[#8b6f47]" />
                        {experience.location}
                      </span>
                    )}
                    {when && (
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays size={14} className="text-[#8b6f47]" />
                        {when.dateLabel}
                        <span className="inline-flex items-center gap-1.5 ml-3">
                          <Clock size={14} className="text-[#8b6f47]" />
                          {when.timeLabel}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-3">
                <div className="rounded-xl border border-[#e0dcd4] bg-white/80 px-4 py-2 text-sm text-[#5a4a3f] shadow-sm">
                  {t("groupLabel")}{" "}
                  <span className="font-semibold">
                    {counts.adults}A{counts.kids ? ` • ${counts.kids}K` : ""}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="hidden sm:inline-flex items-center text-xs px-3 py-2 rounded-lg border border-[#e0dcd4] text-[#6b5e53] bg-white/80 hover:bg-white shadow-sm gap-1"
                >
                  <Edit3 size={14} /> {t("editGroup")}
                </button>
              </div>
            </div>

            {!loading && !!error && (
              <div
                className="mt-4 flex items-start gap-2 rounded-xl border border-[#f1d7d7] bg-[#fff6f6] px-3 py-2 text-xs text-[#7a4a4a] shadow-sm"
                role="alert"
                aria-live="polite"
              >
                <Info size={14} className="mt-0.5 text-[#b14545]" />
                <p>{error}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-4 sm:px-6 pb-28 sm:pb-16">
        {loading ? (
          <LoadingBlock />
        ) : (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* Left: Attendee forms */}
            <section className="lg:col-span-2 space-y-4">
              <header className="flex items-center justify-between gap-3 pl-1">
                <div>
                  <h2 className="text-sm sm:text-base font-semibold text-[#5a4a3f]">
                    {t("guestInfoTitle")}
                  </h2>
                  <p className="mt-0.5 text-[11px] text-[#7a6a58] max-w-md">
                    {t("guestInfoSubtitle")}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-[#6b5e53]">
                  <span>
                    {t("guestsCompleted")}{" "}
                    <strong>
                      {completedCount}/{expectedTotal}
                    </strong>
                  </span>
                  <Progress value={progressPct} />
                </div>
              </header>

              {attendees.map((a, idx) => (
                <details
                  key={idx}
                  open
                  className="group rounded-3xl border border-[#e8e5df] bg-white/95 p-0 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5"
                >
                  <summary className="flex list-none items-center justify-between gap-3 cursor-pointer select-none px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 shrink-0 rounded-full bg-[#efeae2] text-[#8b6f47] grid place-items-center text-sm font-semibold shadow-inner">
                        {idx + 1}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-[#5a4a3f] flex items-center gap-2">
                          {t("guestCardTitle", { index: idx + 1 })}
                          <span className="inline-block rounded-full border border-[#e0dcd4] bg-[#faf7f1] px-2 py-0.5 text-[11px] text-[#5a4a3f]">
                            {labelForCategory(a.category, t)}
                          </span>
                          {idx === firstAdultIndex && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#8b6f47] bg-[#efeae2] border border-[#decfb7] px-2 py-0.5 rounded-full">
                              <Star className="h-3.5 w-3.5" />{" "}
                              {t("primaryContactBadge")}
                            </span>
                          )}
                        </h3>
                        <p className="text-[11px] text-[#7a6a58]">
                          {a.firstName && a.lastName
                            ? `${a.firstName} ${a.lastName}`
                            : t("guestCardTapToFill")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2
                        aria-hidden
                        className={`h-5 w-5 ${
                          a.firstName?.trim() &&
                          a.lastName?.trim() &&
                          a.age !== ""
                            ? "text-[#8b6f47]"
                            : "text-[#d9d3c7]"
                        }`}
                      />
                      <ChevronDown className="h-5 w-5 text-[#7a6a58] transition-transform group-open:rotate-180" />
                    </div>
                  </summary>

                  <div className="px-5 pb-5 pt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label={t("fieldFirstName")}>
                        <input
                          type="text"
                          autoComplete="given-name"
                          value={a.firstName}
                          onChange={(e) =>
                            onChangeAttendee(idx, "firstName", e.target.value)
                          }
                          className={inputCls}
                        />
                      </Field>
                      <Field label={t("fieldLastName")}>
                        <input
                          type="text"
                          autoComplete="family-name"
                          value={a.lastName}
                          onChange={(e) =>
                            onChangeAttendee(idx, "lastName", e.target.value)
                          }
                          className={inputCls}
                        />
                      </Field>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                      <Field
                        label={t("fieldAgeRequired")}
                        hint={hintForCategory(a.category, t)}
                      >
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={a.age}
                          onChange={(e) =>
                            onChangeAttendee(idx, "age", e.target.value)
                          }
                          className={inputCls}
                        />
                      </Field>

                      <Field label={t("fieldAllergies")}>
                        <input
                          type="text"
                          placeholder={t("fieldAllergiesPlaceholder")}
                          value={a.allergies}
                          onChange={(e) =>
                            onChangeAttendee(idx, "allergies", e.target.value)
                          }
                          className={inputCls}
                        />
                      </Field>
                    </div>
                  </div>
                </details>
              ))}

              {expectedTotal === 0 && (
                <div className="rounded-2xl border border-[#e8e5df] bg-white p-6 shadow-sm text-[#5a4a3f]">
                  <p className="mb-3">{t("noAttendeesText")}</p>
                  <button
                    type="button"
                    onClick={() => router.back()}
                    className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg border border-[#e0dcd4] text-[#6b5e53] hover:bg-[#faf7f2] shadow-sm"
                  >
                    <ArrowLeft size={16} /> {t("editGroup")}
                  </button>
                </div>
              )}
            </section>

            {/* Right: summary + primary contact */}
            <section className="space-y-6 lg:sticky lg:top-24">
              <div className="rounded-2xl border border-[#e8e5df] bg-[#fcf9f4] p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-[#5a4a3f]">
                  {t("summaryTitle")}
                </h3>

                <div className="mt-3 text-sm text-[#5a4a3f] space-y-1">
                  {experience?.name && (
                    <div className="font-medium">{experience.name}</div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {experience?.location && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin size={14} className="text-[#8b6f47]" />
                        {experience.location}
                      </span>
                    )}
                  </div>
                  {when && (
                    <div className="flex flex-wrap items-center gap-2">
                      <CalendarDays size={14} className="text-[#8b6f47]" />
                      {when.dateLabel}
                      <span className="inline-flex items-center gap-1.5 ml-3">
                        <Clock size={14} className="text-[#8b6f47]" />
                        {when.timeLabel}
                      </span>
                    </div>
                  )}
                </div>

                {/* Price summary */}
                <div className="mt-5 border border-[#e5e0d8] rounded-xl bg-[#faf7f2] px-6 py-4 shadow-inner">
                  <div className="space-y-1 text-sm text-[#5a4a3f]">
                    {priceBreakdown.lines.map((ln, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between"
                      >
                        <span>{ln.label}</span>
                        <span className="font-semibold">{ln.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 border-t border-[#e5e0d8] pt-3 flex items-center justify-between">
                    <span className="text-sm text-[#5a4a3f]">
                      {t("summaryTotalLabel")}
                    </span>
                    <span className="text-2xl font-bold text-[#8b6f47] tracking-wide">
                      {priceBreakdown.total}
                    </span>
                  </div>
                </div>

                {/* Completion meter */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-[#6b5e53]">
                    <span>{t("completionLabel")}</span>
                    <span>{progressPct}%</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-[#e6e0d5] overflow-hidden">
                    <div
                      className="h-full bg-[#8b6f47] rounded-full transition-all"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>

                {/* Primary Contact */}
                <div className="mt-6">
                  <h4 className="text-sm font-semibold text-[#5a4a3f] flex items-center gap-2">
                    <Star className="w-4 h-4 text-[#8b6f47]" />{" "}
                    {t("primaryContactTitle")}
                  </h4>
                  <p className="text-[11px] text-[#7a6a58] mb-3">
                    {t("primaryContactDescription")}
                  </p>

                  {/* Auto-bind toggle */}
                  <div className="flex items-center justify-between rounded-lg border border-[#e5e0d8] bg-white px-3 py-2 mb-3">
                    <div className="text-xs text-[#5a4a3f]">
                      {t("primaryContactToggleLabel")}
                      {firstAdultFullName ? (
                        <span className="ml-1 text-[#7a6a58]">
                          — {firstAdultFullName}
                        </span>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => setAutoPcFromFirstAdult((v) => !v)}
                      aria-pressed={autoPcFromFirstAdult}
                      aria-label={t("primaryContactToggleAria")}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all border ${
                        autoPcFromFirstAdult
                          ? "bg-[#8b6f47] border-[#7a5f3a]"
                          : "bg-[#e9e3d9] border-[#d7d2c6]"
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                          autoPcFromFirstAdult
                            ? "translate-x-5"
                            : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <Field label={t("fieldFullName")}>
                      <div className="relative">
                        <User className="w-4 h-4 text-[#8b6f47] absolute left-3 top-3.5 pointer-events-none" />
                        <input
                          type="text"
                          autoComplete="name"
                          value={
                            autoPcFromFirstAdult
                              ? firstAdultFullName || pcName
                              : pcName
                          }
                          onChange={(e) => setPcName(e.target.value)}
                          disabled={autoPcFromFirstAdult}
                          className={`${inputCls} pl-9 ${
                            autoPcFromFirstAdult
                              ? "opacity-75 cursor-not-allowed bg-[#faf7f2]"
                              : ""
                          }`}
                        />
                      </div>
                    </Field>

                    <Field label={t("fieldEmail")}>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-[#8b6f47] absolute left-3 top-3.5 pointer-events-none" />
                        <input
                          type="email"
                          autoComplete="email"
                          value={pcEmail}
                          onChange={(e) => setPcEmail(e.target.value)}
                          className={`${inputCls} pl-9`}
                        />
                      </div>
                    </Field>

                    <Field label={t("fieldPhoneOptional")}>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-[#8b6f47] absolute left-3 top-3.5 pointer-events-none" />
                        <input
                          type="tel"
                          autoComplete="tel"
                          value={pcPhone}
                          onChange={(e) => setPcPhone(e.target.value)}
                          placeholder={t("fieldPhonePlaceholder")}
                          className={`${inputCls} pl-9`}
                        />
                      </div>
                    </Field>
                  </div>

                  <button
                    type="button"
                    disabled={saving || expectedTotal === 0 || expired}
                    onClick={handleSaveAndContinue}
                    className={`mt-6 w-full py-3 rounded-xl font-semibold text-lg transition-all flex items-center justify-center gap-2 shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#c4b89f] ${
                      saving || expectedTotal === 0
                        ? "bg-gray-400 cursor-not-allowed text-white"
                        : "bg-gradient-to-r from-[#8b6f47] to-[#7a5f3a] hover:from-[#7a5f3a] hover:to-[#6b5232] text-white"
                    }`}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {t("ctaSaving")}
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-5 h-5" />{" "}
                        {expired
                          ? t("ctaHoldExpired")
                          : t("ctaContinueToPayment")}
                      </>
                    )}
                  </button>

                  <p className="mt-2 text-[11px] text-[#7a6a58] text-center flex items-center justify-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> {t("termsText")}
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Mobile bottom action bar */}
      {!loading && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 border-t border-[#e5e0d8] bg-[#fcf9f4]/95 backdrop-blur supports-[backdrop-filter]:bg-[#fcf9f4]/80 px-4 py-3">
          <div className="mx-auto max-w-6xl flex items-center justify-between gap-4">
            <div className="text-xs text-[#6b5e53]">
              <div className="font-medium text-[#5a4a3f]">
                {t("summaryTotalLabel")}
              </div>
              <div className="text-base font-semibold text-[#8b6f47]">
                {priceBreakdown.total}
              </div>
            </div>
            <button
              type="button"
              disabled={saving || expectedTotal === 0}
              onClick={handleSaveAndContinue}
              className={`flex-1 py-3 rounded-xl font-semibold text-base transition-all flex items-center justify-center gap-2 shadow-md ${
                saving || expectedTotal === 0
                  ? "bg-gray-400 cursor-not-allowed text-white"
                  : "bg-[#8b6f47] hover:bg-[#7a5f3a] text-white"
              }`}
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t("mobileSaving")}
                </>
              ) : (
                <>
                  <CreditCard className="w-5 h-5" />{" "}
                  {expired ? t("ctaHoldExpired") : t("mobilePay")}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- helpers & small components ---------- */

function Stepper({ current = 2, t }) {
  const steps = [
    { id: 1, label: t("stepperDetails"), icon: Users },
    { id: 2, label: t("stepperAttendees"), icon: User },
    { id: 3, label: t("stepperPayment"), icon: CreditCard },
  ];
  return (
    <div className="w-full sm:w-80">
      <ol className="flex items-center justify-between text-[11px] text-[#6b5e53]">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const active = s.id <= current;
          return (
            <li key={s.id} className="relative flex-1 flex items-center">
              {i !== 0 && (
                <div
                  className={`h-1.5 w-full rounded-full mx-2 ${
                    s.id <= current ? "bg-[#8b6f47]" : "bg-[#e6e0d5]"
                  }`}
                />
              )}
              <div
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 shadow-sm ${
                  active
                    ? "bg-[#8b6f47] border-[#7a5f3a] text-white"
                    : "bg-white/80 border-[#e0dcd4]"
                }`}
                aria-current={s.id === current ? "step" : undefined}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{s.label}</span>
                <span className="sm:hidden">{s.id}</span>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="mt-1.5 text-[11px] text-[#6b5e53] text-right">
        {t("stepperStepXofY", { current, total: 3 })}
      </div>
    </div>
  );
}

function Progress({ value = 0 }) {
  return (
    <div className="w-32 h-1.5 rounded-full bg-[#e6e0d5] overflow-hidden">
      <div
        className="h-full bg-[#8b6f47] rounded-full transition-all"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1">
      {typeof label === "string" ? (
        <label className="block text-xs text-[#5a4a3f]">{label}</label>
      ) : (
        <div className="block text-xs text-[#5a4a3f]">{label}</div>
      )}
      {children}
      {hint ? <p className="text-[11px] text-[#7a6a58]">{hint}</p> : null}
    </div>
  );
}

const inputCls =
  "w-full p-2.5 rounded-lg border border-[#d7d2c6] bg-white focus:outline-none focus:ring focus:ring-[#c4b89f] text-[#5a4a3f] placeholder:text-[#9b8f7e]";

function makeCategoryList(adults, kids) {
  const arr = [];
  for (let i = 0; i < adults; i++) arr.push("adult");
  for (let i = 0; i < kids; i++) arr.push("kid");
  return arr;
}

function labelForCategory(c, t) {
  if (c === "adult") return t("categoryAdultLabel");
  if (c === "kid") return t("categoryKidLabel");
  return c;
}

function hintForCategory(c, t) {
  if (c === "adult") return t("categoryAdultHint");
  if (c === "kid") return t("categoryKidHint");
  return "";
}

function eur(n) {
  return `€${(Number(n) || 0).toFixed(2)}`;
}

function isValidEmail(email = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function validate(attendees, counts, primaryContact, t) {
  const issues = [];
  const expected = Number(counts.adults || 0) + Number(counts.kids || 0);

  if (attendees.length !== expected) {
    issues.push(
      t("validationMismatchAttendeeCount", {
        expected,
        found: attendees.length,
      })
    );
  }

  let hasEighteenPlus = false;

  attendees.forEach((a, i) => {
    const idx = i + 1;
    const age = Number(a.age);

    if (!a.firstName?.trim() || !a.lastName?.trim()) {
      issues.push(t("validationAttendeeNameRequired", { index: idx }));
      return;
    }
    if (!Number.isFinite(age)) {
      issues.push(t("validationAttendeeAgeRequired", { index: idx }));
      return;
    }
    if (age < 0 || age > 100) {
      issues.push(t("validationAttendeeAgeInvalid", { index: idx }));
      return;
    }

    if (a.category === "adult") {
      if (age < 16) issues.push(t("validationAdultAgeRange", { index: idx }));
    } else if (a.category === "kid") {
      if (age < 3 || age > 15)
        issues.push(t("validationKidAgeRange", { index: idx }));
    } else {
      issues.push(t("validationUnknownCategory", { index: idx }));
    }

    if (age >= 18) hasEighteenPlus = true;
  });

  if (!hasEighteenPlus) {
    issues.push(t("validationAtLeastOneAdult18"));
  }

  if (!primaryContact.name?.trim())
    issues.push(t("validationPrimaryNameRequired"));
  if (!isValidEmail(primaryContact.email))
    issues.push(t("validationPrimaryEmailRequired"));

  return issues;
}

function LoadingBlock() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 pb-16">
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-[#e8e5df] bg-white p-5 shadow-sm"
            >
              <div className="h-4 w-40 bg-[#eee7db] rounded mb-4" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="h-10 bg-[#f0ebe3] rounded" />
                <div className="h-10 bg-[#f0ebe3] rounded" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <div className="h-10 bg-[#f0ebe3] rounded" />
                <div className="h-10 bg-[#f0ebe3] rounded" />
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-[#e8e5df] bg-[#fcf9f4] p-6 shadow-sm">
          <div className="h-4 w-40 bg-[#eee7db] rounded mb-4" />
          <div className="h-8 bg-[#f0ebe3] rounded mb-2" />
          <div className="h-8 bg-[#f0ebe3] rounded mb-2" />
          <div className="h-8 bg-[#f0ebe3] rounded mb-2" />
        </div>
      </div>
    </div>
  );
}

// Simple countdown hook for draft expiry
function useDraftCountdown(expiresAtIso) {
  const [remainingMs, setRemainingMs] = useState(() => {
    if (!expiresAtIso) return 0;
    const ts = Date.parse(expiresAtIso);
    if (!Number.isFinite(ts)) return 0;
    return Math.max(0, ts - Date.now());
  });

  const [initialMs, setInitialMs] = useState(() => {
    if (!expiresAtIso) return 0;
    const ts = Date.parse(expiresAtIso);
    if (!Number.isFinite(ts)) return 0;
    return Math.max(0, ts - Date.now());
  });

  useEffect(() => {
    if (!expiresAtIso) {
      setRemainingMs(0);
      setInitialMs(0);
      return;
    }

    const ts = Date.parse(expiresAtIso);
    if (!Number.isFinite(ts)) {
      setRemainingMs(0);
      setInitialMs(0);
      return;
    }

    const update = () => {
      const diff = Math.max(0, ts - Date.now());
      setRemainingMs(diff);
    };

    setInitialMs(Math.max(0, ts - Date.now()));
    update();

    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [expiresAtIso]);

  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const formatted = `${String(minutes).padStart(2, "0")}:${String(
    seconds
  ).padStart(2, "0")}`;
  const expired = remainingMs <= 0;
  const progress =
    initialMs > 0 ? Math.max(0, Math.min(1, remainingMs / initialMs)) : 0;

  return { remainingMs, formatted, expired, progress };
}
