"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import {
  Plus,
  Loader2,
  Percent,
  Tag,
  Gift,
  Calendar as CalIcon,
  CheckCircle2,
  RefreshCw,
  Trash2,
  Power,
  PowerOff,
  Pencil,
  Layers,
  RefreshCcw,
  Check,
  X,
  Search,
  Mail,
  User2,
  Clipboard,
  UserPlus,
  UserMinus,
  UserCog,
  Copy,
  Edit,
  PauseCircle,
  Repeat2,
  PlayCircle,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { Fragment } from "react";

function UserAssign({ value, onChange }) {
  const [query, setQuery] = useState(value?.display || value?.email || "");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const boxRef = useRef(null);
  const emailOk = useMemo(() => isEmail(query), [query]);

  // click-outside to close
  useEffect(() => {
    function onDoc(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // search debounced
  useEffect(() => {
    if (!open) return;
    if (!query || query.trim().length < 2) {
      setItems([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/admin/users/search?q=${encodeURIComponent(query)}`,
          {
            cache: "no-store",
            signal: ctrl.signal,
          }
        );
        const js = res.ok ? await res.json() : { items: [] };
        setItems(Array.isArray(js?.items) ? js.items : []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, open]);

  const selectUser = (u) => {
    onChange?.({
      userId: u.id,
      email: u.email || "",
      display: displayUser(u),
    });
    setQuery(displayUser(u));
    setOpen(false);
  };

  const useEmailOnly = () => {
    onChange?.({ userId: null, email: query.trim(), display: query.trim() });
    setOpen(false);
  };

  const clearSel = () => {
    setQuery("");
    onChange?.({ userId: null, email: "", display: "" });
    setItems([]);
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-2.5 text-[#b1a79e]">
            <Search size={16} />
          </span>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search by name, email, phone… or type an email"
            className="w-full rounded-xl border border-[#e8e5df] bg-white pl-9 pr-8 py-2 text-sm focus:ring-2 focus:ring-[#dacbb9]"
          />
          {query ? (
            <button
              type="button"
              onClick={clearSel}
              className="absolute right-2 top-1.5 rounded p-1 text-[#7a6a58] hover:bg-[#fcf9f4]"
              title="Clear"
            >
              <X size={14} />
            </button>
          ) : null}
        </div>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-xl border border-[#e8e5df] bg-white shadow">
          {loading ? (
            <div className="p-3 text-sm text-[#7a6a58]">Searching…</div>
          ) : items.length === 0 ? (
            <div className="p-3 text-sm text-[#7a6a58]">
              {emailOk ? (
                <button
                  type="button"
                  onClick={useEmailOnly}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#e8e5df] bg-[#fcf9f4] px-3 py-2 text-[#5a4a3f] hover:bg-white"
                >
                  <Mail size={14} />
                  Use email “{query.trim()}”
                </button>
              ) : (
                "No results"
              )}
            </div>
          ) : (
            <ul className="max-h-72 overflow-auto">
              {items.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => selectUser(u)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-[#fcf9f4]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <User2 size={14} className="text-[#7a6a58]" />
                        <span className="truncate text-sm text-[#463a30]">
                          {displayUser(u)}
                        </span>
                      </div>
                      <div className="truncate text-xs text-[#7a6a58]">
                        {u.email || "—"}
                        {u.phone ? ` • ${u.phone}` : ""}
                      </div>
                    </div>
                    <span className="rounded-full border border-[#e8e5df] px-2 py-0.5 text-xs text-[#7a6a58]">
                      ID: {u.id}
                    </span>
                  </button>
                </li>
              ))}
              {/* email fallback row if not in results */}
              {emailOk &&
              !items.some(
                (r) =>
                  String(r.email || "").toLowerCase() ===
                  query.trim().toLowerCase()
              ) ? (
                <li className="border-t border-[#f0ece6]">
                  <button
                    type="button"
                    onClick={useEmailOnly}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[#fcf9f4]"
                  >
                    <Mail size={14} />
                    Use email “{query.trim()}”
                  </button>
                </li>
              ) : null}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
function validateVoucher() {
  const vf = voucherForm;
  if (!vf.discountType) return "Choose discount type";
  if (!vf.discountValue || Number(vf.discountValue) <= 0)
    return "Discount value must be > 0";
  if (vf.discountType === "percent" && Number(vf.discountValue) > 100)
    return "Percent cannot exceed 100";
  if (vf.discountType === "amount" && !vf.currency)
    return "Currency is required for amount discounts";
  if (!vf.startsAt || !vf.endsAt) return "Start & end required";
  if (new Date(vf.endsAt) <= new Date(vf.startsAt))
    return "End must be after start";
  if (
    vf.scope === "experience" &&
    (!vf.experienceIds || vf.experienceIds.length === 0)
  )
    return "Pick at least one experience";
  if (vf.assignedToUserId && vf.assignedToEmail)
    return "Pick user OR email, not both";
  return null;
}

function displayUser(u) {
  const name = [u.name, u.surname].filter(Boolean).join(" ").trim();
  return name || u.email || `User #${u.id}`;
}

function isEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s || "").trim());
}
/* ---------------------------- helpers ---------------------------- */
const cx = (...xs) => xs.filter(Boolean).join(" ");
const fmtDate = (d) => (d ? new Date(d).toLocaleString("el-GR") : "-");
const toISO = (s) => (s ? new Date(s).toISOString() : null);

const Field = ({ label, required = false, hint, children }) => (
  <label className="block">
    <span className="flex items-center gap-2 text-sm font-medium text-[#5a4a3f]">
      {label} {required ? <span className="text-[#b44d4d]">*</span> : null}
    </span>
    <div className="mt-1">{children}</div>
    {hint ? <p className="mt-1 text-xs text-[#7a6a58]">{hint}</p> : null}
  </label>
);

const Card = ({ title, icon: Icon, actions, children }) => (
  <section className="rounded-2xl border border-[#e8e5df] bg-white shadow-sm">
    <header className="flex items-center justify-between border-b border-[#eee8df] px-4 py-3">
      <div className="flex items-center gap-2 text-[#5a4a3f]">
        {Icon ? <Icon className="h-5 w-5" /> : null}
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <div className="flex items-center gap-2">{actions}</div>
    </header>
    <div className="p-4">{children}</div>
  </section>
);

/* ----------------------------- page ----------------------------- */
export default function PromotionsPage() {
  const [loading, setLoading] = useState(true);
  const [experiences, setExperiences] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [codes, setCodes] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [tab, setTab] = useState("campaigns");
  // state for inline reassign UI
  const [editingAssigneeFor, setEditingAssigneeFor] = useState(null);
  const [assigneeDraft, setAssigneeDraft] = useState(null);

  const [workingId, setWorkingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [voucherOpen, setVoucherOpen] = useState(false);
  const [voucherTarget, setVoucherTarget] = useState(null);

  const [assignDraft, setAssignDraft] = useState(null); // { userId|null, email }
  const [savingVoucher, setSavingVoucher] = useState(false);
  const [voucherError, setVoucherError] = useState("");
  const firstVoucherInputRef = useRef(null);

  function startReassign(v) {
    setEditingAssigneeFor(v.id);
    setAssigneeDraft({
      userId: v.assignedToUserId || null,
      email: v.assignedToEmail || "",
      display:
        v.assignedToEmail ||
        (v.assignedToUserId ? `User #${v.assignedToUserId}` : ""),
    });
  }
  function cancelReassign() {
    setEditingAssigneeFor(null);
    setAssigneeDraft(null);
  }

  async function saveReassign(v) {
    try {
      const patch = {
        assignedToUserId: assigneeDraft?.userId
          ? Number(assigneeDraft.userId)
          : null,
        assignedToEmail: assigneeDraft?.userId
          ? null
          : assigneeDraft?.email || null,
      };
      // optimistic
      setVouchers((prev) =>
        prev.map((x) => (x.id === v.id ? { ...x, ...patch } : x))
      );
      const res = await fetch(`/api/admin/promotions/vouchers/${v.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Failed to assign");
      cancelReassign();
    } catch (e) {
      console.error(e);
      alert("Failed to update assignment");
      reload?.();
    }
  }

  async function toggleVoucherActive(v) {
    try {
      const next = !v.active;
      // optimistic
      setVouchers((prev) =>
        prev.map((x) => (x.id === v.id ? { ...x, active: next } : x))
      );
      const res = await fetch(`/api/admin/promotions/vouchers/${v.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: next }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (e) {
      // revert
      setVouchers((prev) =>
        prev.map((x) => (x.id === v.id ? { ...x, active: v.active } : x))
      );
      alert("Failed to update status");
    }
  }

  async function deleteVoucher(v) {
    if (!confirm(`Delete voucher ${v.code}? This cannot be undone.`)) return;
    try {
      // optimistic
      const prev = vouchers;
      setVouchers((xs) => xs.filter((x) => x.id !== v.id));
      const res = await fetch(`/api/admin/promotions/vouchers/${v.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (e) {
      console.error(e);
      alert("Failed to delete voucher");
      reload?.();
    }
  }

  async function unassignVoucher(v) {
    try {
      // optimistic
      setVouchers((prev) =>
        prev.map((x) =>
          x.id === v.id
            ? { ...x, assignedToUserId: null, assignedToEmail: null }
            : x
        )
      );
      const res = await fetch(`/api/admin/promotions/vouchers/${v.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToUserId: null, assignedToEmail: null }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (e) {
      console.error(e);
      alert("Failed to unassign");
      reload?.();
    }
  }

  function copyVoucherCode(v) {
    const text = v.code || "";
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => toast?.success?.("Copied") || console.log("copied"),
        () => fallbackCopy(text)
      );
    } else {
      fallbackCopy(text);
    }
  }
  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch {}
    document.body.removeChild(ta);
  }

  // forms state
  const [campaignForm, setCampaignForm] = useState({
    name: "",
    description: "",
    scope: "global",
    experienceIds: [],
    startsAt: "",
    endsAt: "",
    active: true,
  });

  const [codeForm, setCodeForm] = useState({
    campaignId: "",
    code: "",
    discountType: "percent",
    discountValue: "",
    currency: "EUR",
    maxRedemptions: "",
    perUserLimit: 1,
    minSpend: "",
    scope: "global",
    experienceIds: [],
    startsAt: "",
    endsAt: "",
    stackable: false,
    active: true,
  });

  // const [voucherForm, setVoucherForm] = useState({
  //   campaignId: "",
  //   code: "",
  //   assignedToUserId: "",
  //   assignedToEmail: "",
  //   discountType: "percent",
  //   discountValue: "",
  //   currency: "EUR",
  //   maxRedemptions: 1,
  //   perUserLimit: 1,
  //   minSpend: "",
  //   scope: "global",
  //   experienceIds: [],
  //   startsAt: "",
  //   endsAt: "",
  //   active: true,
  // });

  const [submitting, setSubmitting] = useState(false);
  const [codeAvail, setCodeAvail] = useState({ status: "idle", exists: false });
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  const firstInputRef = useRef(null);

  const toLocalInput = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off * 60000);
    return local.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:mm"
  };
  const pickItems = (x) => {
    if (Array.isArray(x)) return x;
    if (Array.isArray(x?.items)) return x.items;
    if (Array.isArray(x?.data)) return x.data;
    return [];
  };
  const sanitizeCodeTyping = (s = "") =>
    s
      .toUpperCase()
      .replace(/[–—]/g, "-")
      .replace(/[^A-Z0-9-]/g, "");

  const normalizeCode = (s = "") =>
    s
      .toUpperCase()
      .replace(/[–—]/g, "-")
      .replace(/[^A-Z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");

  useEffect(() => {
    const controller = new AbortController();
    let ignore = false;

    (async () => {
      try {
        setLoading(true);

        const urls = [
          "/api/admin/experiences?visibility=all",
          "/api/admin/promotions/campaigns",
          "/api/admin/promotions/discount-codes",
          "/api/admin/promotions/vouchers",
        ];

        // be robust to any single request failing
        const resps = await Promise.allSettled(
          urls.map((u) =>
            fetch(u, { cache: "no-store", signal: controller.signal })
          )
        );

        if (ignore) return;

        const jsons = await Promise.all(
          resps.map(async (r) =>
            r.status === "fulfilled" && r.value.ok ? r.value.json() : []
          )
        );

        if (ignore) return;

        const [exJs, cJs, dJs, vJs] = jsons;

        setExperiences(pickItems(exJs));
        setCampaigns(pickItems(cJs));
        setCodes(pickItems(dJs));
        setVouchers(pickItems(vJs));
      } catch (e) {
        if (e?.name !== "AbortError") console.error(e);
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, []);

  const reload = async () => {
    setLoading(true);
    try {
      const [cRes, dRes, vRes] = await Promise.all([
        fetch("/api/admin/promotions/campaigns", { cache: "no-store" }),
        fetch("/api/admin/promotions/discount-codes", { cache: "no-store" }),
        fetch("/api/admin/promotions/vouchers", { cache: "no-store" }),
      ]);
      const [cJs, dJs, vJs] = await Promise.all([
        cRes.ok ? cRes.json() : { data: [] },
        dRes.ok ? dRes.json() : { data: [] },
        vRes.ok ? vRes.json() : { data: [] },
      ]);
      setCampaigns(cJs.data || []);
      setCodes(dJs.data || []);
      setVouchers(vJs.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  /* --------------------------- validations --------------------------- */
  const validateCampaign = () => {
    if (!campaignForm.name.trim()) return "Name is required";
    if (!campaignForm.startsAt || !campaignForm.endsAt)
      return "Dates are required";
    if (new Date(campaignForm.endsAt) <= new Date(campaignForm.startsAt))
      return "End must be after start";
    if (
      campaignForm.scope === "experience" &&
      (!campaignForm.experienceIds || campaignForm.experienceIds.length === 0)
    )
      return "Select at least one experience";
    return null;
  };

  const validateDiscountCode = () => {
    if (!codeForm.discountValue || Number(codeForm.discountValue) <= 0)
      return "Discount value must be > 0";
    if (codeForm.discountType === "percent") {
      const v = Number(codeForm.discountValue);
      if (v <= 0 || v > 100) return "Percent must be between 1–100";
    }
    if (!codeForm.startsAt || !codeForm.endsAt) return "Dates are required";
    if (new Date(codeForm.endsAt) <= new Date(codeForm.startsAt))
      return "End must be after start";
    if (
      codeForm.scope === "experience" &&
      (!codeForm.experienceIds || codeForm.experienceIds.length === 0)
    )
      return "Select at least one experience";
    return null;
  };

  const validateVoucher = () => {
    if (!voucherForm.discountValue || Number(voucherForm.discountValue) <= 0)
      return "Discount value must be > 0";
    if (voucherForm.discountType === "percent") {
      const v = Number(voucherForm.discountValue);
      if (v <= 0 || v > 100) return "Percent must be between 1–100";
    }
    if (!voucherForm.startsAt || !voucherForm.endsAt)
      return "Dates are required";
    if (new Date(voucherForm.endsAt) <= new Date(voucherForm.startsAt))
      return "End must be after start";
    if (
      voucherForm.scope === "experience" &&
      (!voucherForm.experienceIds || voucherForm.experienceIds.length === 0)
    )
      return "Select at least one experience";
    return null;
  };

  const fromLocalInput = (s) => (s ? new Date(s).toISOString() : null);

  function openVoucherModal(v) {
    setVoucherTarget(v);
    setVoucherError("");
    setVoucherForm({
      code: v.code || "",
      discountType: v.discountType || "percent", // "percent" | "fixed"
      discountValue: v.discountValue ?? 0,
      currency: v.currency || "EUR",
      maxRedemptions: v.maxRedemptions ?? null,
      startsAt: toLocalInput(v.startsAt),
      endsAt: toLocalInput(v.endsAt),
      active: !!v.active,
    });
    setAssignDraft({
      userId: v.assignedToUserId || null,
      email: v.assignedToEmail || "",
    });
    setVoucherOpen(true);
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") setVoucherOpen(false);
    }
    if (voucherOpen) {
      window.addEventListener("keydown", onKey);
      setTimeout(() => firstVoucherInputRef.current?.focus(), 0);
    }
    return () => window.removeEventListener("keydown", onKey);
  }, [voucherOpen]);

  function setVField(k, v) {
    setVoucherForm((f) => ({ ...f, [k]: v }));
  }

  function randomCode(len = 10) {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no ambiguous
    let out = "";
    for (let i = 0; i < len; i++)
      out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      ...opts,
    });
    let data = null;
    try {
      data = await res.json();
    } catch {}
    if (!res.ok)
      throw new Error(data?.error || `Request failed (${res.status})`);
    return data;
  }

  async function saveVoucher() {
    if (!voucherTarget) return;
    setSavingVoucher(true);
    setVoucherError("");

    const payload = {
      code: voucherForm.code.trim().toUpperCase(),
      discountType: voucherForm.discountType,
      discountValue: Number(voucherForm.discountValue),
      currency: (voucherForm.currency || "EUR").toUpperCase(),
      maxRedemptions:
        voucherForm.maxRedemptions == null || voucherForm.maxRedemptions === ""
          ? null
          : Number(voucherForm.maxRedemptions),
      startsAt: fromLocalInput(voucherForm.startsAt),
      endsAt: fromLocalInput(voucherForm.endsAt),
      active: !!voucherForm.active,
      // assignment
      assignedToUserId: assignDraft?.userId ?? null,
      assignedToEmail: assignDraft?.userId
        ? ""
        : (assignDraft?.email || "").trim(),
    };

    try {
      // Adjust path to your real vouchers endpoint if different:
      const { voucher: updated } = await api(
        `/api/admin/promotions/vouchers/${voucherTarget.id}`,
        { method: "PATCH", body: JSON.stringify(payload) }
      );

      // Update the list in-place
      setVouchers((prev) =>
        (prev || []).map((row) =>
          row.id === voucherTarget.id ? { ...row, ...updated } : row
        )
      );

      setVoucherOpen(false);
    } catch (e) {
      setVoucherError(e.message || "Could not save changes.");
    } finally {
      setSavingVoucher(false);
    }
  }

  async function deleteVoucherFromModal() {
    if (!voucherTarget) return;
    if (
      !confirm(`Delete voucher "${voucherTarget.code}"? This cannot be undone.`)
    )
      return;
    try {
      await api(`/api/admin/promotions/vouchers/${voucherTarget.id}`, {
        method: "DELETE",
      });
      setVouchers((prev) =>
        (prev || []).filter((r) => r.id !== voucherTarget.id)
      );
      setVoucherOpen(false);
    } catch (e) {
      setVoucherError(e.message || "Delete failed.");
    }
  }
  /* --------------------------- submissions --------------------------- */
  const submitCampaign = async () => {
    const err = validateCampaign();
    if (err) return alert(err);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/promotions/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: campaignForm.name.trim(),
          description: campaignForm.description || null,
          scope: campaignForm.scope,
          experienceIds:
            campaignForm.scope === "experience"
              ? campaignForm.experienceIds.map(Number)
              : null,
          startsAt: toISO(campaignForm.startsAt),
          endsAt: toISO(campaignForm.endsAt),
          active: !!campaignForm.active,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setCampaignForm({
        name: "",
        description: "",
        scope: "global",
        experienceIds: [],
        startsAt: "",
        endsAt: "",
        active: true,
      });
      await reload();
      setTab("campaigns");
    } catch (e) {
      console.error(e);
      alert("Failed to create campaign");
    } finally {
      setSubmitting(false);
    }
  };

  async function submitCode() {
    try {
      setSubmitting(true);
      const payload = {
        campaignId: codeForm.campaignId || null,
        discountType: codeForm.discountType,
        discountValue: Number(codeForm.discountValue),
        currency:
          codeForm.discountType === "amount"
            ? codeForm.currency || "EUR"
            : null,
        maxRedemptions: codeForm.maxRedemptions
          ? Number(codeForm.maxRedemptions)
          : null,
        perUserLimit: Number(codeForm.perUserLimit || 1),
        minSpend: codeForm.minSpend ? Number(codeForm.minSpend) : null,
        scope: codeForm.scope,
        experienceIds:
          codeForm.scope === "experience" ? codeForm.experienceIds || [] : [],
        startsAt: codeForm.startsAt,
        endsAt: codeForm.endsAt,
        stackable: !!codeForm.stackable,
        active: !!codeForm.active,
        code:
          codeForm.codeMode === "custom" && codeForm.code
            ? sanitizeCode(codeForm.code)
            : null, // << here
      };

      const res = await fetch("/api/admin/promotions/discount-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const js = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(js?.error || "Failed to create");
      toast.success(`Created code ${js.code || "(auto)"}`);
      setCodeForm({ ...codeForm, code: "", codeMode: "auto" });
      await loadAll();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const parseApiError = async (res) => {
    const text = await res.text();
    try {
      const js = JSON.parse(text);
      return js?.error || js?.message || text || "Request failed";
    } catch {
      return text || "Request failed";
    }
  };

  const submitVoucher = async () => {
    const err = validateVoucher();
    if (err) return alert(err);

    setSubmitting(true);
    try {
      const hasCustomCode = !!(voucherForm.code && voucherForm.code.trim());

      const payload = {
        campaignId: voucherForm.campaignId
          ? Number(voucherForm.campaignId)
          : null,

        // only include `code` when you actually want a custom one;
        // omit to let DB auto-generate (trigger)
        ...(hasCustomCode ? { code: normalizeCode(voucherForm.code) } : {}),

        // prefer userId; only send email if no userId
        assignedToUserId: voucherForm.assignedToUserId
          ? Number(voucherForm.assignedToUserId)
          : null,
        assignedToEmail: voucherForm.assignedToUserId
          ? null
          : voucherForm.assignedToEmail || null,

        discountType: voucherForm.discountType,
        discountValue: Number(voucherForm.discountValue),
        currency:
          voucherForm.discountType === "amount"
            ? voucherForm.currency || "EUR"
            : null,

        maxRedemptions: Math.max(1, Number(voucherForm.maxRedemptions || 1)),
        perUserLimit: Math.max(1, Number(voucherForm.perUserLimit || 1)),
        minSpend: voucherForm.minSpend ? Number(voucherForm.minSpend) : null,

        scope: voucherForm.scope,
        experienceIds:
          voucherForm.scope === "experience"
            ? (voucherForm.experienceIds || []).map(Number)
            : [], // send [] for global for consistency

        startsAt: toISO(voucherForm.startsAt),
        endsAt: toISO(voucherForm.endsAt),
        active: !!voucherForm.active,
      };

      const res = await fetch("/api/admin/promotions/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let msg = await parseApiError(res);

        if (/duplicate|exists|23505/i.test(msg)) {
          msg =
            "This voucher code already exists. Try a different code or leave it blank for auto-generation.";
        }
        throw new Error(msg);
      }

      // success → reset form
      setVoucherForm({
        campaignId: "",
        code: "",
        assignedToUserId: "",
        assignedToEmail: "",
        discountType: "percent",
        discountValue: "",
        currency: "EUR",
        maxRedemptions: 1,
        perUserLimit: 1,
        minSpend: "",
        scope: "global",
        experienceIds: [],
        startsAt: "",
        endsAt: "",
        active: true,
      });

      await reload();
      setTab("vouchers");
    } catch (e) {
      console.error(e);
      alert(e.message || "Failed to create voucher");
    } finally {
      setSubmitting(false);
    }
  };
  /* ---------------------------- UI helpers ---------------------------- */
  const ExperienceMulti = ({ value = [], onChange }) => (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {experiences.map((ex) => (
        <label
          key={ex.id}
          className={cx(
            "flex items-center gap-2 rounded-xl border p-2 text-sm",
            value.includes(ex.id)
              ? "border-[#c6b39e] bg-[#fcf9f4]"
              : "border-[#e8e5df] bg-white"
          )}
        >
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={value.includes(ex.id)}
            onChange={(e) => {
              if (e.target.checked) onChange([...value, ex.id]);
              else onChange(value.filter((x) => x !== ex.id));
            }}
          />
          <span className="truncate">{ex.name}</span>
        </label>
      ))}
    </div>
  );
  const EMPTY_VOUCHER_FORM = {
    campaignId: "",

    // discount
    discountType: "percent", // or "fixed" (see note below)
    discountValue: "", // keep as string in state for controlled inputs
    currency: "EUR",

    // assignment
    assignedToUserId: null,
    assignedToEmail: "",
    _assigneeDisplay: "",

    // limits
    maxRedemptions: "",
    perUserLimit: "",
    minSpend: "",

    // scope
    scope: "global",
    experienceIds: [],

    // period
    startsAt: "",
    endsAt: "",

    active: true,
  };

  const [voucherForm, setVoucherForm] = useState(EMPTY_VOUCHER_FORM);

  const Toolbar = () => (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="inline-flex rounded-2xl border border-[#e8e5df] bg-white p-1 text-sm">
        {[
          ["campaigns", "Campaigns"],
          ["codes", "Discount codes"],
          ["vouchers", "Vouchers"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cx(
              "rounded-xl px-3 py-1.5",
              tab === key ? "bg-[#fcf9f4] text-[#5a4a3f]" : "text-[#7a6a58]"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Link
          href="/admin/promotions/email"
          className="inline-flex items-center gap-2 rounded-2xl border border-[#e8e5df] bg-[#5a4a3f] px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:opacity-95"
        >
          <Plus className="h-4 w-4" />
          New email campaign
        </Link>

        <button
          onClick={reload}
          className="inline-flex items-center gap-2 rounded-2xl border border-[#e8e5df] bg-white px-3 py-1.5 text-sm text-[#5a4a3f] shadow-sm"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>
    </div>
  );

  /* ------------------------------- functions ------------------------------- */
  function sanitizeCode(s = "") {
    return s
      .toUpperCase()
      .replace(/\s+/g, "-")
      .replace(/[^A-Z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function generateCode(prefix = "DISC-", len = 8) {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/I/0/1
    let body = "";
    for (let i = 0; i < len; i++)
      body += alphabet[Math.floor(Math.random() * alphabet.length)];
    return prefix + body;
  }

  // live availability checker (debounced)
  useEffect(() => {
    let t;
    (async () => {
      if (codeForm.codeMode !== "custom") {
        setCodeAvail({ status: "idle", exists: false });
        return;
      }
      const code = sanitizeCode(codeForm.code || "");
      if (!code || code.length < 4) {
        setCodeAvail({ status: "idle", exists: false });
        return;
      }
      setCodeAvail({ status: "checking", exists: false });
      t = setTimeout(async () => {
        try {
          const res = await fetch(
            `/api/admin/promotions/discount-codes/check?code=${encodeURIComponent(
              code
            )}`,
            { cache: "no-store" }
          );
          const js = await res.json().catch(() => ({}));
          if (res.ok) setCodeAvail({ status: "done", exists: !!js.exists });
          else setCodeAvail({ status: "done", exists: false });
        } catch {
          setCodeAvail({ status: "done", exists: false });
        }
      }, 300);
    })();
    return () => clearTimeout(t);
  }, [codeForm.codeMode, codeForm.code]);

  function CodeAvailabilityBadge({ code }) {
    if (!code) return null;
    if (codeAvail.status === "checking") {
      return (
        <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#fff7e6] px-3 py-1 text-xs text-[#8a6d3b]">
          Checking…
        </div>
      );
    }
    if (codeAvail.status === "done" && codeAvail.exists) {
      return (
        <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#fdecec] px-3 py-1 text-xs text-[#9a3030]">
          <X className="h-3 w-3" /> Taken
        </div>
      );
    }
    if (codeAvail.status === "done" && !codeAvail.exists) {
      return (
        <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#e9f8ef] px-3 py-1 text-xs text-[#267a4a]">
          <Check className="h-3 w-3" /> Available
        </div>
      );
    }
    return null;
  }
  function StatusPill({ ok }) {
    return (
      <span
        className={
          ok
            ? "inline-flex items-center rounded-full bg-[#e9f8ef] px-2 py-1 text-xs font-medium text-[#267a4a]"
            : "inline-flex items-center rounded-full bg-[#fdecec] px-2 py-1 text-xs font-medium text-[#9a3030]"
        }
      >
        {ok ? "Active" : "Inactive"}
      </span>
    );
  }

  // scope badge (shows count for targeted experiences)
  function ScopeBadge({ c }) {
    const scoped = c.scope === "experience";
    const count = Array.isArray(c.experienceIds) ? c.experienceIds.length : 0;
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[#e8e5df] bg-white px-2 py-1 text-xs text-[#5a4a3f]">
        <Layers size={14} />
        {scoped ? `Experiences (${count || 0})` : "Global"}
      </span>
    );
  }

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      ...opts,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "Request failed");
    return data;
  }

  function optimisticUpdate(updater) {
    // assumes you already have setCodes and codes in scope
    setCodes((prev) => {
      const next = Array.isArray(prev) ? [...prev] : [];
      return updater(next) ?? next;
    });
  }

  async function onToggleActive(c) {
    setWorkingId(c.id);
    const nextActive = !c.active;

    // optimistic
    optimisticUpdate((list) => {
      const i = list.findIndex((x) => x.id === c.id);
      if (i !== -1) list[i] = { ...list[i], active: nextActive };
    });

    try {
      await api(`/api/admin/promotions/discount-codes/${c.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: nextActive }),
      });
    } catch (e) {
      // revert on error
      optimisticUpdate((list) => {
        const i = list.findIndex((x) => x.id === c.id);
        if (i !== -1) list[i] = { ...list[i], active: c.active };
      });
      alert(e.message || "Could not update code.");
    } finally {
      setWorkingId(null);
    }
  }

  async function onDelete(c) {
    if (!confirm(`Delete code "${c.code}"? This cannot be undone.`)) return;
    setWorkingId(c.id);

    // optimistic remove
    const removed = codes;
    optimisticUpdate((list) => list.filter((x) => x.id !== c.id));

    try {
      await api(`/api/admin/promotions/discount-codes/${c.id}`, {
        method: "DELETE",
      });
    } catch (e) {
      // revert
      setCodes(removed);
      alert(e.message || "Could not delete code.");
    } finally {
      setWorkingId(null);
    }
  }

  async function onCopy(c) {
    try {
      await navigator.clipboard.writeText(c.code);
      setCopiedId(c.id);
      setTimeout(() => setCopiedId(null), 1200);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = c.code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      setCopiedId(c.id);
      setTimeout(() => setCopiedId(null), 1200);
    }
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") setEditOpen(false);
    }
    if (editOpen) {
      window.addEventListener("keydown", onKey);
      // focus first input
      setTimeout(() => firstInputRef.current?.focus(), 0);
    }
    return () => window.removeEventListener("keydown", onKey);
  }, [editOpen]);

  function onEdit(c) {
    setEditTarget(c);
    setEditError("");
    setEditForm({
      code: c.code || "",
      discountType: c.discountType || "percent", // "percent" | "fixed"
      discountValue: c.discountValue ?? 0,
      currency: c.currency || "EUR",
      maxRedemptions: c.maxRedemptions ?? "",
      startsAt: toLocalInput(c.startsAt),
      endsAt: toLocalInput(c.endsAt),
      active: !!c.active,
    });
    setEditOpen(true);
  }

  function setField(k, v) {
    setEditForm((f) => ({ ...f, [k]: v }));
  }

  async function saveEdit() {
    if (!editTarget) return;
    setSavingEdit(true);
    setEditError("");

    const payload = {
      code: editForm.code.trim().toUpperCase(),
      discountType: editForm.discountType,
      discountValue: Number(editForm.discountValue),
      currency: (editForm.currency || "EUR").toUpperCase(),
      maxRedemptions:
        editForm.maxRedemptions === "" ? null : Number(editForm.maxRedemptions),
      startsAt: editForm.startsAt
        ? new Date(editForm.startsAt).toISOString()
        : null,
      endsAt: editForm.endsAt ? new Date(editForm.endsAt).toISOString() : null,
      active: !!editForm.active,
    };

    try {
      const res = await fetch(
        `/api/admin/promotions/discount-codes/${editTarget.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to save changes");

      // Update local list
      setCodes((prev) =>
        (prev || []).map((row) =>
          row.id === editTarget.id ? { ...row, ...data.promo } : row
        )
      );

      setEditOpen(false);
    } catch (e) {
      setEditError(e.message || "Could not save changes.");
    } finally {
      setSavingEdit(false);
    }
  }
  function IconButton({ title, onClick, kind = "copy" }) {
    const cls =
      "inline-flex items-center justify-center rounded-lg border border-[#e8e5df] bg-white p-2 text-[#5a4a3f] hover:bg-[#fcf9f4]";
    const icon =
      kind === "edit" ? (
        <Pencil className="h-4 w-4" />
      ) : kind === "delete" ? (
        <Trash2 className="h-4 w-4" />
      ) : kind === "on" ? (
        <Power className="h-4 w-4" />
      ) : kind === "off" ? (
        <PowerOff className="h-4 w-4" />
      ) : kind === "userplus" ? (
        <UserPlus className="h-4 w-4" />
      ) : kind === "usermin" ? (
        <UserMinus className="h-4 w-4" />
      ) : kind === "usercog" ? (
        <UserCog className="h-4 w-4" />
      ) : (
        <Clipboard className="h-4 w-4" />
      );
    return (
      <button
        className={cls}
        title={title}
        onClick={onClick}
        aria-label={title}
      >
        {icon}
      </button>
    );
  }

  /* -------- handlers -------- */
  async function toggleCampaignActive(c) {
    try {
      const next = !c.active;
      // optimistic UI
      setCampaigns((prev) =>
        prev.map((x) => (x.id === c.id ? { ...x, active: next } : x))
      );
      const res = await fetch(`/api/admin/promotions/campaigns/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: next }),
      });
      const js = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(js?.error || "Failed to update");
      toast.success(next ? "Campaign activated" : "Campaign deactivated");
    } catch (e) {
      // revert on error
      setCampaigns((prev) =>
        prev.map((x) => (x.id === c.id ? { ...x, active: c.active } : x))
      );
      toast.error(e.message);
    }
  }

  async function deleteCampaign(c) {
    const sure = window.confirm(
      `Delete campaign “${c.name}”? This cannot be undone.`
    );
    if (!sure) return;
    try {
      // optimistic UI
      setCampaigns((prev) => prev.filter((x) => x.id !== c.id));
      const res = await fetch(`/api/admin/promotions/campaigns/${c.id}`, {
        method: "DELETE",
      });
      const js = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(js?.error || "Failed to delete");
      toast.success("Campaign deleted");
    } catch (e) {
      // reload list if you want to be 100% consistent
      await loadAll?.();
      toast.error(e.message);
    }
  }

  /* ------------------------------- render ------------------------------- */
  return (
    <main className="rounded-3xl min-h-screen bg-[#fcf9f4] p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#5a4a3f]">Promotions</h1>
          <Link
            href="/admin"
            className="text-sm text-[#7a6a58] underline-offset-2 hover:underline"
          >
            ← Back to admin
          </Link>
        </div>

        <Toolbar />

        {/* CAMPAIGNS */}
        {tab === "campaigns" && (
          <div className="grid gap-4 lg:grid-cols-2">
            {/* ------------------ Create card ------------------ */}
            <Card title="Create campaign" icon={Tag}>
              <div className="grid gap-4">
                <Field label="Name" required>
                  <input
                    value={campaignForm.name}
                    onChange={(e) =>
                      setCampaignForm({ ...campaignForm, name: e.target.value })
                    }
                    placeholder="e.g. Autumn Early Bird"
                    className="w-full rounded-xl border border-[#e8e5df] bg-white px-3 py-2 text-sm placeholder-[#b1a79e] focus:ring-2 focus:ring-[#dacbb9]"
                  />
                </Field>

                <Field label="Description">
                  <textarea
                    rows={3}
                    value={campaignForm.description}
                    onChange={(e) =>
                      setCampaignForm({
                        ...campaignForm,
                        description: e.target.value,
                      })
                    }
                    placeholder="Optional admin-only notes"
                    className="w-full rounded-xl border border-[#e8e5df] bg-white px-3 py-2 text-sm placeholder-[#b1a79e] focus:ring-2 focus:ring-[#dacbb9]"
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Scope" required>
                    <select
                      value={campaignForm.scope}
                      onChange={(e) =>
                        setCampaignForm({
                          ...campaignForm,
                          scope: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-[#e8e5df] bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-[#dacbb9]"
                    >
                      <option value="global">Global</option>
                      <option value="experience">Specific experiences</option>
                    </select>
                    <p className="mt-1 text-xs text-[#7a6a58]">
                      Global applies to all experiences; “Specific” lets you
                      target IDs.
                    </p>
                  </Field>

                  <Field label="Active?">
                    <select
                      value={campaignForm.active ? "true" : "false"}
                      onChange={(e) =>
                        setCampaignForm({
                          ...campaignForm,
                          active: e.target.value === "true",
                        })
                      }
                      className="w-full rounded-xl border border-[#e8e5df] bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-[#dacbb9]"
                    >
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </Field>
                </div>

                {campaignForm.scope === "experience" && (
                  <Field label="Experiences" required hint="Pick one or more">
                    <ExperienceMulti
                      value={campaignForm.experienceIds}
                      onChange={(xs) =>
                        setCampaignForm({ ...campaignForm, experienceIds: xs })
                      }
                    />
                  </Field>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Starts at" required>
                    <input
                      type="datetime-local"
                      value={campaignForm.startsAt}
                      onChange={(e) =>
                        setCampaignForm({
                          ...campaignForm,
                          startsAt: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-[#e8e5df] bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-[#dacbb9]"
                    />
                  </Field>
                  <Field label="Ends at" required>
                    <input
                      type="datetime-local"
                      value={campaignForm.endsAt}
                      onChange={(e) =>
                        setCampaignForm({
                          ...campaignForm,
                          endsAt: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-[#e8e5df] bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-[#dacbb9]"
                    />
                  </Field>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-xs text-[#7a6a58]">
                    Tip: Keep windows tight. You can toggle Active later.
                  </div>
                  <button
                    onClick={submitCampaign}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-2xl border border-[#e8e5df] bg-[#5a4a3f] px-4 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-60"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Create campaign
                  </button>
                </div>
              </div>
            </Card>

            {/* ------------------ List + actions ------------------ */}
            <Card title="Campaigns" icon={CheckCircle2}>
              {loading ? (
                <div className="flex items-center gap-2 text-[#7a6a58]">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                </div>
              ) : campaigns.length === 0 ? (
                <p className="text-sm text-[#7a6a58]">No campaigns yet.</p>
              ) : (
                <>
                  {/* Table (desktop) */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 bg-[#fcf9f4] text-left text-[#7a6a58]">
                        <tr>
                          <th className="px-2 py-2">Name</th>
                          <th className="px-2 py-2">Scope</th>
                          <th className="px-2 py-2">Status</th>
                          <th className="px-2 py-2">Starts</th>
                          <th className="px-2 py-2">Ends</th>
                          <th className="px-2 py-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {campaigns.map((c) => (
                          <tr key={c.id} className="border-t border-[#f0ece6]">
                            <td className="px-2 py-2">
                              <div className="font-medium text-[#463a30]">
                                {c.name}
                              </div>
                              <div className="text-xs text-[#7a6a58]">
                                {c.description || "—"}
                              </div>
                            </td>
                            <td className="px-2 py-2">
                              <ScopeBadge c={c} />
                            </td>
                            <td className="px-2 py-2">
                              <StatusPill ok={!!c.active} />
                            </td>
                            <td className="px-2 py-2">{fmtDate(c.startsAt)}</td>
                            <td className="px-2 py-2">{fmtDate(c.endsAt)}</td>
                            <td className="px-2 py-2">
                              <div className="flex items-center justify-end gap-2">
                                <IconButton
                                  title={c.active ? "Deactivate" : "Activate"}
                                  onClick={() => toggleCampaignActive(c)}
                                  kind={c.active ? "off" : "on"}
                                />
                                {/* (Optional) Link to edit page if you add one */}
                                {/* <IconButton title="Edit" onClick={() => router.push(`/admin/promotions/campaign/${c.id}`)} kind="edit" /> */}
                                <IconButton
                                  title="Delete"
                                  onClick={() => deleteCampaign(c)}
                                  kind="delete"
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Cards (mobile) */}
                  <div className="sm:hidden grid gap-3">
                    {campaigns.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-xl border border-[#ece7df] bg-white p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-[#463a30] font-semibold">
                              {c.name}
                            </div>
                            <div className="text-xs text-[#7a6a58]">
                              {c.description || "—"}
                            </div>
                          </div>
                          <StatusPill ok={!!c.active} />
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#7a6a58]">
                          <ScopeBadge c={c} />
                          <span>•</span>
                          <span>
                            {fmtDate(c.startsAt)} → {fmtDate(c.endsAt)}
                          </span>
                        </div>
                        <div className="mt-3 flex items-center justify-end gap-2">
                          <IconButton
                            title={c.active ? "Deactivate" : "Activate"}
                            onClick={() => toggleCampaignActive(c)}
                            kind={c.active ? "off" : "on"}
                          />
                          {/* <IconButton title="Edit" onClick={() => router.push(`/admin/promotions/campaign/${c.id}`)} kind="edit" /> */}
                          <IconButton
                            title="Delete"
                            onClick={() => deleteCampaign(c)}
                            kind="delete"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>
          </div>
        )}

        {/* DISCOUNT CODES */}
        {tab === "codes" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Create discount code" icon={Percent}>
              <div className="grid gap-4">
                {/* --- Code Mode: Auto vs Custom --- */}
                <div>
                  <label className="text-sm font-medium text-[#5a4a3f]">
                    Code
                  </label>
                  <div className="mt-2 inline-flex rounded-xl border border-[#e8e5df] bg-white p-1">
                    <button
                      type="button"
                      className={`px-3 py-1.5 text-sm rounded-lg ${
                        codeForm.codeMode !== "custom"
                          ? "bg-[#463a30] text-white shadow"
                          : "text-[#7a6a58] hover:bg-[#fcf9f4]"
                      }`}
                      onClick={() =>
                        setCodeForm({ ...codeForm, codeMode: "auto", code: "" })
                      }
                    >
                      Auto-generate (DISC-XXXXXXXX)
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-1.5 text-sm rounded-lg ${
                        codeForm.codeMode === "custom"
                          ? "bg-[#463a30] text-white shadow"
                          : "text-[#7a6a58] hover:bg-[#fcf9f4]"
                      }`}
                      onClick={() =>
                        setCodeForm({ ...codeForm, codeMode: "custom" })
                      }
                    >
                      Custom
                    </button>
                  </div>

                  {/* Custom input */}
                  {codeForm.codeMode === "custom" ? (
                    <div className="mt-3 flex items-center gap-2">
                      <input
                        value={codeForm.code}
                        onChange={(e) =>
                          setCodeForm({
                            ...codeForm,
                            code: sanitizeCodeTyping(e.target.value),
                          })
                        }
                        placeholder="e.g. SUMMER25 or SAVE-2025"
                        className="w-full rounded-xl border border-[#e8e5df] bg-white px-3 py-2 text-sm placeholder-[#b1a79e] focus:ring-2 focus:ring-[#dacbb9] font-mono"
                      />
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-xl border border-[#e8e5df] bg-white px-3 py-2 text-sm text-[#5a4a3f] hover:bg-[#fcf9f4]"
                        onClick={() =>
                          setCodeForm({
                            ...codeForm,
                            code: generateCode("DISC-", 8),
                          })
                        }
                        title="Generate suggestion"
                      >
                        <RefreshCcw className="h-4 w-4" />
                        Suggest
                      </button>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-[#7a6a58]">
                      Code will be generated automatically (format like{" "}
                      <strong>DISC-XXXXXXXX</strong>).
                    </p>
                  )}

                  {/* Availability status */}
                  {codeForm.codeMode === "custom" && (
                    <CodeAvailabilityBadge code={codeForm.code} />
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Campaign">
                    <select
                      value={codeForm.campaignId}
                      onChange={(e) =>
                        setCodeForm({ ...codeForm, campaignId: e.target.value })
                      }
                      className="w-full rounded-xl border border-[#e8e5df] bg-white px-3 py-2 text-sm"
                    >
                      <option value="">— none —</option>
                      {campaigns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Scope" required>
                    <select
                      value={codeForm.scope}
                      onChange={(e) =>
                        setCodeForm({ ...codeForm, scope: e.target.value })
                      }
                      className="w-full rounded-xl border border-[#e8e5df] bg-white px-3 py-2 text-sm"
                    >
                      <option value="global">Global</option>
                      <option value="experience">Specific experiences</option>
                    </select>
                  </Field>
                </div>

                {codeForm.scope === "experience" && (
                  <Field label="Experiences" required>
                    <ExperienceMulti
                      value={codeForm.experienceIds}
                      onChange={(xs) =>
                        setCodeForm({ ...codeForm, experienceIds: xs })
                      }
                    />
                  </Field>
                )}

                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Type" required>
                    <select
                      value={codeForm.discountType}
                      onChange={(e) =>
                        setCodeForm({
                          ...codeForm,
                          discountType: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-[#e8e5df] bg-white px-3 py-2 text-sm"
                    >
                      <option value="percent">Percent</option>
                      <option value="amount">Amount</option>
                    </select>
                  </Field>
                  <Field label="Value" required>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={codeForm.discountValue}
                      onChange={(e) =>
                        setCodeForm({
                          ...codeForm,
                          discountValue: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-[#e8e5df] bg-white px-3 py-2 text-sm"
                    />
                  </Field>
                  {codeForm.discountType === "amount" && (
                    <Field label="Currency" required>
                      <input
                        value={codeForm.currency}
                        onChange={(e) =>
                          setCodeForm({ ...codeForm, currency: e.target.value })
                        }
                        className="w-full rounded-xl border border-[#e8e5df] bg-white px-3 py-2 text-sm"
                      />
                    </Field>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Max redemptions">
                    <input
                      type="number"
                      min="1"
                      value={codeForm.maxRedemptions}
                      onChange={(e) =>
                        setCodeForm({
                          ...codeForm,
                          maxRedemptions: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-[#e8e5df] bg-white px-3 py-2 text-sm"
                    />
                  </Field>
                  <Field label="Per-user limit" required>
                    <input
                      type="number"
                      min="1"
                      value={codeForm.perUserLimit}
                      onChange={(e) =>
                        setCodeForm({
                          ...codeForm,
                          perUserLimit: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-[#e8e5df] bg-white px-3 py-2 text-sm"
                    />
                  </Field>
                  <Field label="Min spend (optional)">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={codeForm.minSpend}
                      onChange={(e) =>
                        setCodeForm({ ...codeForm, minSpend: e.target.value })
                      }
                      className="w-full rounded-xl border border-[#e8e5df] bg-white px-3 py-2 text-sm"
                    />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Starts at" required>
                    <input
                      type="datetime-local"
                      value={codeForm.startsAt}
                      onChange={(e) =>
                        setCodeForm({ ...codeForm, startsAt: e.target.value })
                      }
                      className="w-full rounded-xl border border-[#e8e5df] bg-white px-3 py-2 text-sm"
                    />
                  </Field>
                  <Field label="Ends at">
                    <input
                      type="datetime-local"
                      value={codeForm.endsAt}
                      onChange={(e) =>
                        setCodeForm({ ...codeForm, endsAt: e.target.value })
                      }
                      className="w-full rounded-xl border border-[#e8e5df] bg-white px-3 py-2 text-sm"
                    />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Stackable?">
                    <select
                      value={codeForm.stackable ? "true" : "false"}
                      onChange={(e) =>
                        setCodeForm({
                          ...codeForm,
                          stackable: e.target.value === "true",
                        })
                      }
                      className="w-full rounded-xl border border-[#e8e5df] bg-white px-3 py-2 text-sm"
                    >
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </select>
                  </Field>
                  <Field label="Active?">
                    <select
                      value={codeForm.active ? "true" : "false"}
                      onChange={(e) =>
                        setCodeForm({
                          ...codeForm,
                          active: e.target.value === "true",
                        })
                      }
                      className="w-full rounded-xl border border-[#e8e5df] bg-white px-3 py-2 text-sm"
                    >
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </Field>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={submitCode}
                    disabled={
                      submitting ||
                      (codeForm.codeMode === "custom" &&
                        codeForm.code &&
                        codeAvail?.exists)
                    }
                    className="inline-flex items-center gap-2 rounded-2xl border border-[#e8e5df] bg-[#5a4a3f] px-4 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-60"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Create discount code
                  </button>
                </div>
              </div>
            </Card>

            <Card title="Discount codes" icon={Tag}>
              {loading ? (
                <div className="flex items-center gap-2 text-[#7a6a58]">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                </div>
              ) : codes.length === 0 ? (
                <p className="text-sm text-[#7a6a58]">No codes yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-[#7a6a58]">
                      <tr>
                        <th className="px-2 py-1">Code</th>
                        <th className="px-2 py-1">Type</th>
                        <th className="px-2 py-1">Value</th>
                        <th className="px-2 py-1">Redemptions</th>
                        <th className="px-2 py-1">Active</th>
                        <th className="px-2 py-1">Period</th>
                        <th className="px-2 py-1 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {codes.map((c) => (
                        <tr key={c.id} className="border-t border-[#f0ece6]">
                          <td className="px-2 py-1 font-mono">{c.code}</td>
                          <td className="px-2 py-1">{c.discountType}</td>
                          <td className="px-2 py-1">
                            {c.discountType === "percent"
                              ? `${c.discountValue}%`
                              : `${c.discountValue} ${c.currency || ""}`}
                          </td>
                          <td className="px-2 py-1">
                            {c.redemptionCount}/{c.maxRedemptions ?? "∞"}
                          </td>
                          <td className="px-2 py-1">
                            <span
                              className={
                                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 border " +
                                (c.active
                                  ? "border-[#e8e5df] text-[#5a4a3f] bg-[#faf7f2]"
                                  : "border-[#e8e5df] text-[#b1a595] bg-white")
                              }
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-[#d6cfc4]" />
                              {c.active ? "Yes" : "No"}
                            </span>
                          </td>
                          <td className="px-2 py-1">
                            {fmtDate(c.startsAt)} — {fmtDate(c.endsAt)}
                          </td>
                          <td className="px-2 py-1">
                            <div className="relative">
                              <div className="flex justify-end gap-1">
                                <button
                                  onClick={() => onCopy(c)}
                                  className="rounded-md px-2 py-1.5 border border-[#e8e5df] text-[#7a6a58] hover:bg-[#faf7f2]"
                                  aria-label="Copy code"
                                  title="Copy"
                                  disabled={workingId === c.id}
                                >
                                  <Copy className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => onEdit(c)}
                                  className="rounded-md px-2 py-1.5 border border-[#e8e5df] text-[#7a6a58] hover:bg-[#faf7f2]"
                                  aria-label="Edit code"
                                  title="Edit"
                                  disabled={workingId === c.id}
                                >
                                  <Edit className="w-4 h-4" />
                                </button>

                                <button
                                  onClick={() => onToggleActive(c)}
                                  className="rounded-md px-2 py-1.5 border border-[#e8e5df] text-[#7a6a58] hover:bg-[#faf7f2]"
                                  aria-label={
                                    c.active ? "Deactivate" : "Activate"
                                  }
                                  title={c.active ? "Deactivate" : "Activate"}
                                  disabled={workingId === c.id}
                                >
                                  {c.active ? (
                                    <PauseCircle className="w-4 h-4" />
                                  ) : (
                                    <PlayCircle className="w-4 h-4" />
                                  )}
                                </button>

                                <button
                                  onClick={() => onDelete(c)}
                                  className="rounded-md px-2 py-1.5 border border-[#f3dfdb] text-[#7a4a4a] hover:bg-[#fff6f6]"
                                  aria-label="Delete"
                                  title="Delete"
                                  disabled={workingId === c.id}
                                >
                                  {workingId === c.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                </button>
                                {/* Optional compact menu instead of separate buttons */}
                                {/* <button ...><MoreHorizontal /></button> */}
                              </div>

                              {/* little 'Copied!' chip */}
                              {copiedId === c.id && (
                                <span className="absolute -top-6 right-0 text-[11px] bg-[#f6f2ea] text-[#5a4a3f] border border-[#e8e5df] rounded px-2 py-0.5 shadow">
                                  Copied!
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* VOUCHERS */}
        {tab === "vouchers" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Create voucher" icon={Gift}>
              <div className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Campaign">
                    <select
                      value={voucherForm.campaignId ?? ""}
                      onChange={(e) =>
                        setVoucherForm({
                          ...voucherForm,
                          campaignId: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-[#e8e5df] bg-white px-3 py-2 text-sm"
                    >
                      <option value="">— none —</option>
                      {campaigns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="mt-1 text-xs text-[#7a6a58]">
                    Voucher code will be generated automatically (format like{" "}
                    <strong>VCHR-XXXXXXXXXX</strong>).
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Type" required>
                    <select
                      value={voucherForm.discountType || "percent"}
                      onChange={(e) =>
                        setVoucherForm({
                          ...voucherForm,
                          discountType: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-[#e8e5df] bg-white px-3 py-2 text-sm"
                    >
                      <option value="percent">Percent</option>
                      <option value="amount">Amount</option>
                    </select>
                  </Field>
                  <Field label="Value" required>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={voucherForm.discountValue ?? ""}
                      onChange={(e) =>
                        setVoucherForm({
                          ...voucherForm,
                          discountValue: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-[#e8e5df] bg-white px-3 py-2 text-sm"
                    />
                  </Field>
                  {voucherForm.discountType === "amount" && (
                    <Field label="Currency" required>
                      <input
                        value={voucherForm.currency ?? "EUR"}
                        onChange={(e) =>
                          setVoucherForm({
                            ...voucherForm,
                            currency: e.target.value,
                          })
                        }
                        className="w-full rounded-xl border border-[#e8e5df] bg-white px-3 py-2 text-sm"
                      />
                    </Field>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Assign to (optional)"
                    hint="Pick an existing user or type an email"
                  >
                    <UserAssign
                      value={{
                        userId: voucherForm.assignedToUserId || null,
                        email: voucherForm.assignedToEmail || "",
                        display: voucherForm._assigneeDisplay || "",
                      }}
                      onChange={(v) =>
                        setVoucherForm({
                          ...voucherForm,
                          assignedToUserId: v?.userId || "",
                          assignedToEmail: v?.email || "",
                          _assigneeDisplay: v?.display || "",
                        })
                      }
                    />
                  </Field>

                  <Field label="Assign to email">
                    <input
                      disabled={!!voucherForm.assignedToUserId}
                      type="email"
                      placeholder="user@example.com"
                      value={voucherForm.assignedToEmail ?? ""}
                      onChange={(e) =>
                        setVoucherForm({
                          ...voucherForm,
                          assignedToEmail: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-[#e8e5df] bg-white px-3 py-2 text-sm"
                    />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Max redemptions" required>
                    <input
                      type="number"
                      min="1"
                      value={voucherForm.maxRedemptions ?? ""}
                      onChange={(e) =>
                        setVoucherForm({
                          ...voucherForm,
                          maxRedemptions: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-[#e8e5df] bg-white px-3 py-2 text-sm"
                    />
                  </Field>
                  <Field label="Per-user limit" required>
                    <input
                      type="number"
                      min="1"
                      value={voucherForm.perUserLimit ?? ""}
                      onChange={(e) =>
                        setVoucherForm({
                          ...voucherForm,
                          perUserLimit: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-[#e8e5df] bg-white px-3 py-2 text-sm"
                    />
                  </Field>
                  <Field label="Min spend (optional)">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={voucherForm.minSpend ?? ""}
                      onChange={(e) =>
                        setVoucherForm({
                          ...voucherForm,
                          minSpend: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-[#e8e5df] bg-white px-3 py-2 text-sm"
                    />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Scope" required>
                    <select
                      value={voucherForm.scope || "global"}
                      onChange={(e) =>
                        setVoucherForm({
                          ...voucherForm,
                          scope: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-[#e8e5df] bg-white px-3 py-2 text-sm"
                    >
                      <option value="global">Global</option>
                      <option value="experience">Specific experiences</option>
                    </select>
                  </Field>
                  <Field label="Active?">
                    <select
                      value={voucherForm.active ? "true" : "false"}
                      onChange={(e) =>
                        setVoucherForm({
                          ...voucherForm,
                          active: e.target.value === "true",
                        })
                      }
                      className="w-full rounded-xl border border-[#e8e5df] bg-white px-3 py-2 text-sm"
                    >
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </Field>
                </div>

                {voucherForm.scope === "experience" && (
                  <Field label="Experiences" required>
                    <ExperienceMulti
                      value={voucherForm.experienceIds || []}
                      onChange={(xs) =>
                        setVoucherForm({ ...voucherForm, experienceIds: xs })
                      }
                    />
                  </Field>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Starts at" required>
                    <input
                      type="datetime-local"
                      value={voucherForm.startsAt || ""}
                      onChange={(e) =>
                        setVoucherForm({
                          ...voucherForm,
                          startsAt: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-[#e8e5df] bg-white px-3 py-2 text-sm"
                    />
                  </Field>
                  <Field label="Ends at" required>
                    <input
                      type="datetime-local"
                      value={voucherForm.endsAt || ""}
                      onChange={(e) =>
                        setVoucherForm({
                          ...voucherForm,
                          endsAt: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-[#e8e5df] bg-white px-3 py-2 text-sm"
                    />
                  </Field>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={submitVoucher}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-2xl border border-[#e8e5df] bg-[#5a4a3f] px-4 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-60"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Create voucher
                  </button>
                </div>
              </div>
            </Card>

            <Card title="Vouchers" icon={Gift}>
              {loading ? (
                <div className="flex items-center gap-2 text-[#7a6a58]">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                </div>
              ) : vouchers.length === 0 ? (
                <p className="text-sm text-[#7a6a58]">No vouchers yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-[#7a6a58]">
                      <tr>
                        <th className="px-2 py-1">Code</th>
                        <th className="px-2 py-1">Assigned</th>
                        <th className="px-2 py-1">Type</th>
                        <th className="px-2 py-1">Value</th>
                        <th className="px-2 py-1">Redemptions</th>
                        <th className="px-2 py-1">Active</th>
                        <th className="px-2 py-1">Period</th>
                        <th className="px-2 py-1 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vouchers.map((v) => (
                        <Fragment key={v.id}>
                          <tr className="border-t border-[#f0ece6]">
                            <td className="px-2 py-1 font-mono">{v.code}</td>
                            <td className="px-2 py-1">
                              {v.assignedToUserId
                                ? `User #${v.assignedToUserId}${
                                    v.assignedToEmail
                                      ? ` (${v.assignedToEmail})`
                                      : ""
                                  }`
                                : v.assignedToEmail || "—"}
                            </td>
                            <td className="px-2 py-1">{v.discountType}</td>
                            <td className="px-2 py-1">
                              {v.discountType === "percent"
                                ? `${v.discountValue}%`
                                : `${v.discountValue} ${v.currency || ""}`}
                            </td>
                            <td className="px-2 py-1">
                              {v.redemptionCount}/{v.maxRedemptions}
                            </td>
                            <td className="px-2 py-1">
                              <StatusPill ok={!!v.active} />
                            </td>
                            <td className="px-2 py-1">
                              {fmtDate(v.startsAt)} — {fmtDate(v.endsAt)}
                            </td>
                            <td className="px-2 py-1">
                              <div className="flex items-center justify-end gap-2">
                                <IconButton
                                  title="Copy code"
                                  onClick={() => copyVoucherCode(v)}
                                  kind="copy"
                                />
                                <IconButton
                                  title={v.active ? "Deactivate" : "Activate"}
                                  onClick={() => toggleVoucherActive(v)}
                                  kind={v.active ? "off" : "on"}
                                />
                                <IconButton
                                  title="Edit"
                                  onClick={() => openVoucherModal(v)}
                                  kind="edit"
                                />

                                <IconButton
                                  title="Delete"
                                  onClick={() => deleteVoucher(v)}
                                  kind="delete"
                                />
                              </div>
                            </td>
                          </tr>

                          {/* Inline reassignment row */}
                          {editingAssigneeFor === v.id && (
                            <tr className="border-t border-[#f0ece6] bg-[#fcf9f4]">
                              <td className="px-2 py-2" colSpan={8}>
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                  <div className="flex-1">
                                    <UserAssign
                                      value={
                                        assigneeDraft || {
                                          userId: v.assignedToUserId || null,
                                          email: v.assignedToEmail || "",
                                          display:
                                            v.assignedToEmail ||
                                            (v.assignedToUserId
                                              ? `User #${v.assignedToUserId}`
                                              : ""),
                                        }
                                      }
                                      onChange={(val) => setAssigneeDraft(val)}
                                    />
                                    <p className="mt-1 text-xs text-[#7a6a58]">
                                      Pick an existing user or type an email. If
                                      a user is selected, email will be cleared.
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => saveReassign(v)}
                                      className="inline-flex items-center gap-2 rounded-xl bg-[#463a30] px-3 py-2 text-xs font-semibold text-white hover:bg-[#3c3027]"
                                    >
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      onClick={cancelReassign}
                                      className="inline-flex items-center gap-2 rounded-xl border border-[#e8e5df] bg-white px-3 py-2 text-xs text-[#5a4a3f] hover:bg-[#fcf9f4]"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}

        {editOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-promo-title"
            className="fixed inset-0 z-50"
          >
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setEditOpen(false)}
            />
            <div className="relative mx-auto max-w-2xl mt-24 px-4">
              <div className="relative rounded-2xl border border-[#e8e5df] bg-white shadow-lg">
                <button
                  onClick={() => setEditOpen(false)}
                  className="absolute top-3 right-3 inline-flex items-center justify-center rounded-full p-1.5 hover:bg-[#f6f2ea]"
                  aria-label="Close"
                >
                  <X className="h-5 w-5 text-[#7a6a58]" />
                </button>

                <div className="p-6">
                  <h2
                    id="edit-promo-title"
                    className="text-lg font-semibold text-[#5a4a3f]"
                  >
                    Edit discount code
                  </h2>

                  {editError && (
                    <div className="mt-3 rounded-lg bg-[#fff6f6] border border-[#f1d7d7] px-3 py-2 text-sm text-[#7a4a4a]">
                      {editError}
                    </div>
                  )}

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="text-sm text-[#7a6a58]">
                      Code
                      <input
                        ref={firstInputRef}
                        value={editForm.code}
                        onChange={(e) => setField("code", e.target.value)}
                        className="mt-1 w-full rounded-lg border border-[#e8e5df] bg-white px-3 py-2 text-sm text-[#5a4a3f] placeholder:text-[#b1a595] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/40"
                        placeholder="SPRING25"
                      />
                    </label>

                    <label className="text-sm text-[#7a6a58]">
                      Type
                      <select
                        value={editForm.discountType}
                        onChange={(e) =>
                          setField("discountType", e.target.value)
                        }
                        className="mt-1 w-full rounded-lg border border-[#e8e5df] bg-white px-3 py-2 text-sm text-[#5a4a3f] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/40"
                      >
                        <option value="percent">Percent</option>
                        <option value="fixed">Fixed</option>
                      </select>
                    </label>

                    <label className="text-sm text-[#7a6a58]">
                      Value
                      <input
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        value={editForm.discountValue}
                        onChange={(e) =>
                          setField("discountValue", e.target.value)
                        }
                        className="mt-1 w-full rounded-lg border border-[#e8e5df] bg-white px-3 py-2 text-sm text-[#5a4a3f] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/40"
                        placeholder="10"
                      />
                    </label>

                    <label className="text-sm text-[#7a6a58]">
                      Currency
                      <input
                        value={editForm.currency}
                        onChange={(e) => setField("currency", e.target.value)}
                        className="mt-1 w-full rounded-lg border border-[#e8e5df] bg-white px-3 py-2 text-sm text-[#5a4a3f] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/40"
                        placeholder="EUR"
                      />
                    </label>

                    <label className="text-sm text-[#7a6a58]">
                      Max redemptions
                      <input
                        type="number"
                        inputMode="numeric"
                        value={editForm.maxRedemptions}
                        onChange={(e) =>
                          setField("maxRedemptions", e.target.value)
                        }
                        className="mt-1 w-full rounded-lg border border-[#e8e5df] bg-white px-3 py-2 text-sm text-[#5a4a3f] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/40"
                        placeholder="Unlimited"
                      />
                    </label>

                    <label className="text-sm text-[#7a6a58] sm:col-span-1">
                      Starts at
                      <input
                        type="datetime-local"
                        value={editForm.startsAt}
                        onChange={(e) => setField("startsAt", e.target.value)}
                        className="mt-1 w-full rounded-lg border border-[#e8e5df] bg-white px-3 py-2 text-sm text-[#5a4a3f] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/40"
                      />
                    </label>

                    <label className="text-sm text-[#7a6a58] sm:col-span-1">
                      Ends at
                      <input
                        type="datetime-local"
                        value={editForm.endsAt}
                        onChange={(e) => setField("endsAt", e.target.value)}
                        className="mt-1 w-full rounded-lg border border-[#e8e5df] bg-white px-3 py-2 text-sm text-[#5a4a3f] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/40"
                      />
                    </label>

                    <label className="text-sm text-[#7a6a58] sm:col-span-2 inline-flex items-center gap-2 mt-1">
                      <input
                        type="checkbox"
                        checked={editForm.active}
                        onChange={(e) => setField("active", e.target.checked)}
                        className="h-4 w-4 rounded border-[#e8e5df] text-[#8b6f47] focus:ring-[#8b6f47]/40"
                      />
                      Active
                    </label>
                  </div>
                </div>

                <div className="p-4 border-t border-[#eee9df] bg-[#fcf9f4] rounded-b-2xl flex justify-end gap-3">
                  <button
                    onClick={() => setEditOpen(false)}
                    className="rounded-lg border border-[#e8e5df] px-4 py-2 text-sm text-[#5a4a3f] hover:bg-[#f6f2ea]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEdit}
                    disabled={savingEdit}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${
                      savingEdit
                        ? "bg-gray-300 cursor-not-allowed"
                        : "bg-[#8b6f47] hover:bg-[#7a5f3a]"
                    }`}
                  >
                    {savingEdit ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Saving…
                      </span>
                    ) : (
                      "Save changes"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {voucherOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="voucher-edit-title"
            className="fixed inset-0 z-50"
          >
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setVoucherOpen(false)}
            />
            <div className="relative mx-auto max-w-2xl mt-24 px-4">
              <div className="relative rounded-2xl border border-[#e8e5df] bg-white shadow-lg">
                <button
                  onClick={() => setVoucherOpen(false)}
                  className="absolute top-3 right-3 inline-flex items-center justify-center rounded-full p-1.5 hover:bg-[#f6f2ea]"
                  aria-label="Close"
                >
                  <X className="h-5 w-5 text-[#7a6a58]" />
                </button>

                <div className="p-6">
                  <h2
                    id="voucher-edit-title"
                    className="text-lg font-semibold text-[#5a4a3f] flex items-center gap-2"
                  >
                    <Gift className="w-5 h-5 text-[#8b6f47]" />
                    Manage voucher
                  </h2>

                  {voucherError && (
                    <div className="mt-3 rounded-lg bg-[#fff6f6] border border-[#f1d7d7] px-3 py-2 text-sm text-[#7a4a4a]">
                      {voucherError}
                    </div>
                  )}

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="text-sm text-[#7a6a58]">
                      Code
                      <div className="mt-1 flex gap-2">
                        <input
                          ref={firstVoucherInputRef}
                          value={voucherForm.code}
                          onChange={(e) => setVField("code", e.target.value)}
                          className="flex-1 rounded-lg border border-[#e8e5df] bg-white px-3 py-2 text-sm text-[#5a4a3f] placeholder:text-[#b1a595] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/40"
                          placeholder="GFT-ABCD1234"
                        />
                        <button
                          type="button"
                          onClick={() => setVField("code", randomCode())}
                          className="rounded-lg border border-[#e8e5df] px-3 py-2 text-xs text-[#5a4a3f] hover:bg-[#f6f2ea]"
                          title="Generate"
                        >
                          Generate
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(
                                voucherForm.code
                              );
                            } catch {}
                          }}
                          className="rounded-lg border border-[#e8e5df] px-3 py-2 text-xs text-[#5a4a3f] hover:bg-[#f6f2ea]"
                          title="Copy"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </label>

                    <label className="text-sm text-[#7a6a58]">
                      Type
                      <select
                        value={voucherForm.discountType}
                        onChange={(e) =>
                          setVField("discountType", e.target.value)
                        }
                        className="mt-1 w-full rounded-lg border border-[#e8e5df] bg-white px-3 py-2 text-sm text-[#5a4a3f] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/40"
                      >
                        <option value="percent">Percent</option>
                        <option value="fixed">Fixed</option>
                      </select>
                    </label>

                    <label className="text-sm text-[#7a6a58]">
                      Value
                      <input
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        value={voucherForm.discountValue}
                        onChange={(e) =>
                          setVField("discountValue", e.target.value)
                        }
                        className="mt-1 w-full rounded-lg border border-[#e8e5df] bg-white px-3 py-2 text-sm text-[#5a4a3f] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/40"
                        placeholder="25"
                      />
                    </label>

                    <label className="text-sm text-[#7a6a58]">
                      Currency
                      <input
                        value={voucherForm.currency}
                        onChange={(e) => setVField("currency", e.target.value)}
                        className="mt-1 w-full rounded-lg border border-[#e8e5df] bg-white px-3 py-2 text-sm text-[#5a4a3f] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/40"
                        placeholder="EUR"
                      />
                    </label>

                    <label className="text-sm text-[#7a6a58]">
                      Max redemptions
                      <input
                        type="number"
                        inputMode="numeric"
                        value={voucherForm.maxRedemptions ?? ""}
                        onChange={(e) =>
                          setVField("maxRedemptions", e.target.value)
                        }
                        className="mt-1 w-full rounded-lg border border-[#e8e5df] bg-white px-3 py-2 text-sm text-[#5a4a3f] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/40"
                        placeholder="Unlimited"
                      />
                    </label>

                    <label className="text-sm text-[#7a6a58] sm:col-span-1">
                      Starts at
                      <input
                        type="datetime-local"
                        value={voucherForm.startsAt}
                        onChange={(e) => setVField("startsAt", e.target.value)}
                        className="mt-1 w-full rounded-lg border border-[#e8e5df] bg-white px-3 py-2 text-sm text-[#5a4a3f] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/40"
                      />
                    </label>

                    <label className="text-sm text-[#7a6a58] sm:col-span-1">
                      Ends at
                      <input
                        type="datetime-local"
                        value={voucherForm.endsAt}
                        onChange={(e) => setVField("endsAt", e.target.value)}
                        className="mt-1 w-full rounded-lg border border-[#e8e5df] bg-white px-3 py-2 text-sm text-[#5a4a3f] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/40"
                      />
                    </label>

                    <label className="text-sm text-[#7a6a58] sm:col-span-2 inline-flex items-center gap-2 mt-1">
                      <input
                        type="checkbox"
                        checked={!!voucherForm.active}
                        onChange={(e) => setVField("active", e.target.checked)}
                        className="h-4 w-4 rounded border-[#e8e5df] text-[#8b6f47] focus:ring-[#8b6f47]/40"
                      />
                      Active
                    </label>

                    {/* Assignee */}
                    <div className="sm:col-span-2">
                      <div className="text-sm text-[#7a6a58] mb-1">
                        Assignee
                      </div>
                      <UserAssign
                        value={{
                          userId: assignDraft?.userId || null,
                          email: assignDraft?.email || "",
                          display:
                            assignDraft?.email ||
                            (assignDraft?.userId
                              ? `User #${assignDraft.userId}`
                              : ""),
                        }}
                        onChange={(val) => setAssignDraft(val)}
                      />
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setAssignDraft({ userId: null, email: "" })
                          }
                          className="inline-flex items-center gap-2 rounded-xl border border-[#e8e5df] bg-white px-3 py-2 text-xs text-[#5a4a3f] hover:bg-[#fcf9f4]"
                        >
                          Clear assignee
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-[#7a6a58]">
                        Pick an existing user or type an email. If a user is
                        selected, the email will be cleared.
                      </p>
                    </div>

                    {/* Read-only stats */}
                    <div className="sm:col-span-2 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg border border-[#e8e5df] bg-[#fcf9f4] p-3">
                        <div className="text-[#7a6a58]">Redemptions</div>
                        <div className="text-[#5a4a3f] font-semibold">
                          {voucherTarget?.redemptionCount ?? 0} /{" "}
                          {voucherTarget?.maxRedemptions ?? "∞"}
                        </div>
                      </div>
                      <div className="rounded-lg border border-[#e8e5df] bg-[#fcf9f4] p-3">
                        <div className="text-[#7a6a58]">Assigned to</div>
                        <div className="text-[#5a4a3f] font-semibold">
                          {voucherTarget?.assignedToEmail ||
                            (voucherTarget?.assignedToUserId
                              ? `User #${voucherTarget.assignedToUserId}`
                              : "—")}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-[#eee9df] bg-[#fcf9f4] rounded-b-2xl flex justify-between gap-3">
                  <button
                    onClick={deleteVoucherFromModal}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#f3dfdb] bg-white px-4 py-2 text-sm text-[#7a4a4a] hover:bg-[#fff6f6]"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setVoucherOpen(false)}
                      className="rounded-lg border border-[#e8e5df] px-4 py-2 text-sm text-[#5a4a3f] hover:bg-[#f6f2ea]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveVoucher}
                      disabled={savingVoucher}
                      className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${
                        savingVoucher
                          ? "bg-gray-300 cursor-not-allowed"
                          : "bg-[#8b6f47] hover:bg-[#7a5f3a]"
                      }`}
                    >
                      {savingVoucher ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" /> Saving…
                        </span>
                      ) : (
                        "Save changes"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
