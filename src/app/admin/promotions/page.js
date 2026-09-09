"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import {
  Percent,
  Trash2,
  Power,
  PowerOff,
  Pencil,
  Layers,
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
} from "lucide-react";
import { toast } from "react-hot-toast";

import Icon from "../_ui/Icon";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Field,
  Page,
  PageHeader,
  Select,
  Skeleton,
  inputClass,
} from "../_ui";

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

/* ----------------------------- page ----------------------------- */
export default function PromotionsPage() {
  const [loading, setLoading] = useState(true);
  const [experiences, setExperiences] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [codes, setCodes] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [tab, setTab] = useState("campaigns");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
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
      setCampaigns(pickItems(cJs));
      setCodes(pickItems(dJs));
      setVouchers(pickItems(vJs));
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
      await reload();
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
      await reload();
      toast.error(e.message);
    }
  }

  /* ------------------------------- render ------------------------------- */
  /* ------------------------------ presentation ----------------------------- */

  const promoStatus = (x) => {
    if (!x?.active) return "inactive";
    const now = Date.now();
    const s = x.startsAt ? new Date(x.startsAt).getTime() : null;
    const e = x.endsAt ? new Date(x.endsAt).getTime() : null;
    if (s && now < s) return "scheduled";
    if (e && now > e) return "expired";
    return "active";
  };

  const STATUS_TONE = {
    active: "success",
    scheduled: "info",
    expired: "neutral",
    inactive: "danger",
  };

  const fmtDay = (v) => {
    if (!v) return "—";
    const d = new Date(v);
    return isNaN(d) ? "—" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };

  const fmtValue = (x) =>
    x?.discountType === "percent"
      ? `${x.discountValue}%`
      : `${Number(x?.discountValue || 0).toFixed(2)} ${x?.currency || "EUR"}`;

  const activeList = tab === "campaigns" ? campaigns : tab === "codes" ? codes : vouchers;

  const matches = (x) => {
    const q = search.trim().toLowerCase();
    if (statusFilter !== "all" && promoStatus(x) !== statusFilter) return false;
    if (!q) return true;
    return [x.code, x.name, x.description, x.assignedToEmail, String(x.id)]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(q);
  };

  const visible = useMemo(
    () => (activeList || []).filter(matches),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeList, search, statusFilter],
  );

  const stats = useMemo(() => {
    const live = (xs) => (xs || []).filter((x) => promoStatus(x) === "active").length;
    return {
      campaigns: live(campaigns),
      codes: live(codes),
      vouchers: live(vouchers),
      assigned: (vouchers || []).filter((v) => v.assignedToUserId || v.assignedToEmail).length,
    };
  }, [campaigns, codes, vouchers]);

  const TABS = [
    ["campaigns", "Campaigns", campaigns.length],
    ["codes", "Discount codes", codes.length],
    ["vouchers", "Vouchers", vouchers.length],
  ];

  const StatusChip = ({ x }) => {
    const s = promoStatus(x);
    return <Badge variant={STATUS_TONE[s]}>{s}</Badge>;
  };

  const PeriodCell = ({ x }) => (
    <span className="whitespace-nowrap text-[12.5px] text-[#7a6a5f]">
      {fmtDay(x.startsAt)} → {x.endsAt ? fmtDay(x.endsAt) : "open"}
    </span>
  );

  return (
    <Page>
      <PageHeader
        eyebrow="Growth"
        title="Promotions"
        description={
          loading
            ? "Loading promotions…"
            : `${stats.campaigns} live campaign${stats.campaigns === 1 ? "" : "s"} · ${stats.codes} live code${stats.codes === 1 ? "" : "s"}`
        }
        actions={
          <>
            <Button variant="secondary" onClick={reload} disabled={loading}>
              <Icon name="clock" size={15} /> Refresh
            </Button>
            <Button as={Link} href="/admin/promotions/email" variant="secondary">
              <Icon name="mail" size={15} /> Email campaigns
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                // the voucher modal reuses voucherForm, so start a create from a clean slate
                if (!createOpen && tab === "vouchers") setVoucherForm(EMPTY_VOUCHER_FORM);
                setCreateOpen((v) => !v);
              }}
            >
              <Icon name={createOpen ? "x" : "plus"} size={15} />
              {createOpen ? "Close form" : `New ${tab === "campaigns" ? "campaign" : tab === "codes" ? "code" : "voucher"}`}
            </Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Live campaigns" value={stats.campaigns} />
        <StatCard label="Live codes" value={stats.codes} />
        <StatCard label="Live vouchers" value={stats.vouchers} />
        <StatCard label="Assigned vouchers" value={stats.assigned} />
      </div>

      {/* tabs + filters */}
      <Card padded={false} className="mb-5 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 p-4">
          <div className="inline-flex rounded-xl border border-[#e6e0d6] bg-[#fdfbf7] p-1">
            {TABS.map(([key, label, count]) => (
              <button
                key={key}
                onClick={() => { setTab(key); setSearch(""); setStatusFilter("all"); }}
                className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                  tab === key ? "bg-[#2a211a] text-white" : "text-[#6b5c4d] hover:bg-[#f2ede4]"
                }`}
              >
                {label}
                <span className={`ml-1.5 text-[11px] ${tab === key ? "text-white/60" : "text-[#b0a294]"}`}>
                  {count}
                </span>
              </button>
            ))}
          </div>

          <div className="relative ml-auto min-w-[200px] flex-1 sm:max-w-[320px]">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#b0a294]">
              <Icon name="search" size={16} />
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tab === "campaigns" ? "Search campaigns…" : "Search code or email…"}
              className={`${inputClass} h-10 pl-9 ${search ? "pr-9" : ""}`}
            />
            {search ? (
              <button onClick={() => setSearch("")} aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#9a8c7e] hover:bg-[#f2ede4]">
                <Icon name="x" size={14} />
              </button>
            ) : null}
          </div>

          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 !w-auto min-w-[140px]"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="scheduled">Scheduled</option>
            <option value="expired">Expired</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>
      </Card>

      {/* create forms */}
      {createOpen ? (
        <Card className="mb-5">
          <h2 className="mb-4 font-serif text-[17px] text-[#2a211a]">
            {tab === "campaigns" ? "New campaign" : tab === "codes" ? "New discount code" : "New voucher"}
          </h2>

          {tab === "campaigns" ? (
            <form
              onSubmit={(e) => { e.preventDefault(); submitCampaign(); }}
              className="grid gap-3 sm:grid-cols-2"
            >
              <Field label="Name" className="sm:col-span-2">
                <input value={campaignForm.name}
                  onChange={(e) => setCampaignForm((f) => ({ ...f, name: e.target.value }))}
                  className={inputClass} placeholder="Spring escape" />
              </Field>
              <Field label="Description" className="sm:col-span-2">
                <input value={campaignForm.description}
                  onChange={(e) => setCampaignForm((f) => ({ ...f, description: e.target.value }))}
                  className={inputClass} placeholder="Shown on the site banner" />
              </Field>
              <Field label="Starts">
                <input type="datetime-local" value={campaignForm.startsAt}
                  onChange={(e) => setCampaignForm((f) => ({ ...f, startsAt: e.target.value }))}
                  className={inputClass} />
              </Field>
              <Field label="Ends">
                <input type="datetime-local" value={campaignForm.endsAt}
                  onChange={(e) => setCampaignForm((f) => ({ ...f, endsAt: e.target.value }))}
                  className={inputClass} />
              </Field>
              <Field label="Scope">
                <Select value={campaignForm.scope}
                  onChange={(e) => setCampaignForm((f) => ({ ...f, scope: e.target.value }))}>
                  <option value="global">All experiences</option>
                  <option value="experience">Selected experiences</option>
                </Select>
              </Field>
              <div className="flex items-end">
                <label className="flex cursor-pointer items-center gap-2 pb-2">
                  <input type="checkbox" checked={campaignForm.active}
                    onChange={(e) => setCampaignForm((f) => ({ ...f, active: e.target.checked }))}
                    className="h-4 w-4 accent-[#8b6f47]" />
                  <span className="text-[13px] text-[#2a211a]">Active</span>
                </label>
              </div>
              {campaignForm.scope === "experience" ? (
                <div className="sm:col-span-2">
                  <span className="mb-1 block text-[11px] font-semibold text-[#6b5c4d]">Experiences</span>
                  <ExperienceMulti
                    value={campaignForm.experienceIds}
                    onChange={(ids) => setCampaignForm((f) => ({ ...f, experienceIds: ids }))}
                  />
                </div>
              ) : null}
              <div className="sm:col-span-2">
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? "Creating…" : "Create campaign"}
                </Button>
              </div>
            </form>
          ) : null}

          {tab === "codes" ? (
            <form
              onSubmit={(e) => { e.preventDefault(); submitCode(); }}
              className="grid gap-3 sm:grid-cols-2"
            >
              <Field label="Code" hint="Leave blank to generate one automatically.">
                <div className="flex gap-2">
                  <input value={codeForm.code}
                    onChange={(e) => setCodeForm((f) => ({ ...f, code: sanitizeCodeTyping(e.target.value) }))}
                    className={`${inputClass} font-mono uppercase`} placeholder="SPRING20" />
                  <Button type="button" variant="secondary"
                    onClick={() => setCodeForm((f) => ({ ...f, code: generateCode() }))}>
                    Generate
                  </Button>
                </div>
                <CodeAvailabilityBadge code={codeForm.code} />
              </Field>
              <Field label="Campaign">
                <Select value={codeForm.campaignId}
                  onChange={(e) => setCodeForm((f) => ({ ...f, campaignId: e.target.value }))}>
                  <option value="">No campaign</option>
                  {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Discount type">
                <Select value={codeForm.discountType}
                  onChange={(e) => setCodeForm((f) => ({ ...f, discountType: e.target.value }))}>
                  <option value="percent">Percentage</option>
                  <option value="amount">Fixed amount</option>
                </Select>
              </Field>
              <Field label={codeForm.discountType === "percent" ? "Percent off" : `Amount off (${codeForm.currency})`}>
                <input type="number" min="0" step="0.01" value={codeForm.discountValue}
                  onChange={(e) => setCodeForm((f) => ({ ...f, discountValue: e.target.value }))}
                  className={inputClass} />
              </Field>
              <Field label="Max redemptions" hint="Blank means unlimited.">
                <input type="number" min="0" value={codeForm.maxRedemptions}
                  onChange={(e) => setCodeForm((f) => ({ ...f, maxRedemptions: e.target.value }))}
                  className={inputClass} />
              </Field>
              <Field label="Per-customer limit">
                <input type="number" min="1" value={codeForm.perUserLimit}
                  onChange={(e) => setCodeForm((f) => ({ ...f, perUserLimit: e.target.value }))}
                  className={inputClass} />
              </Field>
              <Field label="Minimum spend">
                <input type="number" min="0" step="0.01" value={codeForm.minSpend}
                  onChange={(e) => setCodeForm((f) => ({ ...f, minSpend: e.target.value }))}
                  className={inputClass} placeholder="Optional" />
              </Field>
              <Field label="Scope">
                <Select value={codeForm.scope}
                  onChange={(e) => setCodeForm((f) => ({ ...f, scope: e.target.value }))}>
                  <option value="global">All experiences</option>
                  <option value="experience">Selected experiences</option>
                </Select>
              </Field>
              <Field label="Starts">
                <input type="datetime-local" value={codeForm.startsAt}
                  onChange={(e) => setCodeForm((f) => ({ ...f, startsAt: e.target.value }))}
                  className={inputClass} />
              </Field>
              <Field label="Ends">
                <input type="datetime-local" value={codeForm.endsAt}
                  onChange={(e) => setCodeForm((f) => ({ ...f, endsAt: e.target.value }))}
                  className={inputClass} />
              </Field>
              {codeForm.scope === "experience" ? (
                <div className="sm:col-span-2">
                  <span className="mb-1 block text-[11px] font-semibold text-[#6b5c4d]">Experiences</span>
                  <ExperienceMulti
                    value={codeForm.experienceIds}
                    onChange={(ids) => setCodeForm((f) => ({ ...f, experienceIds: ids }))}
                  />
                </div>
              ) : null}
              <div className="flex items-center gap-4 sm:col-span-2">
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={codeForm.stackable}
                    onChange={(e) => setCodeForm((f) => ({ ...f, stackable: e.target.checked }))}
                    className="h-4 w-4 accent-[#8b6f47]" />
                  <span className="text-[13px] text-[#2a211a]">Stackable with other offers</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={codeForm.active}
                    onChange={(e) => setCodeForm((f) => ({ ...f, active: e.target.checked }))}
                    className="h-4 w-4 accent-[#8b6f47]" />
                  <span className="text-[13px] text-[#2a211a]">Active</span>
                </label>
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? "Creating…" : "Create code"}
                </Button>
              </div>
            </form>
          ) : null}

          {tab === "vouchers" ? (
            <form
              onSubmit={(e) => { e.preventDefault(); submitVoucher(); }}
              className="grid gap-3 sm:grid-cols-2"
            >
              <div className="sm:col-span-2">
                <span className="mb-1 block text-[11px] font-semibold text-[#6b5c4d]">Assign to</span>
                <UserAssign
                  value={{
                    userId: voucherForm.assignedToUserId,
                    email: voucherForm.assignedToEmail,
                    display: voucherForm._assigneeDisplay,
                  }}
                  onChange={(v) =>
                    setVoucherForm((f) => ({
                      ...f,
                      assignedToUserId: v?.userId ?? null,
                      assignedToEmail: v?.email ?? "",
                      _assigneeDisplay: v?.display ?? "",
                    }))
                  }
                />
              </div>
              <Field label="Campaign">
                <Select value={voucherForm.campaignId}
                  onChange={(e) => setVField("campaignId", e.target.value)}>
                  <option value="">No campaign</option>
                  {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Discount type">
                <Select value={voucherForm.discountType}
                  onChange={(e) => setVField("discountType", e.target.value)}>
                  <option value="percent">Percentage</option>
                  <option value="amount">Fixed amount</option>
                </Select>
              </Field>
              <Field label={voucherForm.discountType === "percent" ? "Percent off" : `Amount off (${voucherForm.currency})`}>
                <input type="number" min="0" step="0.01" value={voucherForm.discountValue}
                  onChange={(e) => setVField("discountValue", e.target.value)} className={inputClass} />
              </Field>
              <Field label="Minimum spend">
                <input type="number" min="0" step="0.01" value={voucherForm.minSpend}
                  onChange={(e) => setVField("minSpend", e.target.value)} className={inputClass} placeholder="Optional" />
              </Field>
              <Field label="Starts">
                <input type="datetime-local" value={voucherForm.startsAt}
                  onChange={(e) => setVField("startsAt", e.target.value)} className={inputClass} />
              </Field>
              <Field label="Ends">
                <input type="datetime-local" value={voucherForm.endsAt}
                  onChange={(e) => setVField("endsAt", e.target.value)} className={inputClass} />
              </Field>
              <Field label="Scope">
                <Select value={voucherForm.scope} onChange={(e) => setVField("scope", e.target.value)}>
                  <option value="global">All experiences</option>
                  <option value="experience">Selected experiences</option>
                </Select>
              </Field>
              <div className="flex items-end">
                <label className="flex cursor-pointer items-center gap-2 pb-2">
                  <input type="checkbox" checked={voucherForm.active}
                    onChange={(e) => setVField("active", e.target.checked)}
                    className="h-4 w-4 accent-[#8b6f47]" />
                  <span className="text-[13px] text-[#2a211a]">Active</span>
                </label>
              </div>
              {voucherForm.scope === "experience" ? (
                <div className="sm:col-span-2">
                  <span className="mb-1 block text-[11px] font-semibold text-[#6b5c4d]">Experiences</span>
                  <ExperienceMulti
                    value={voucherForm.experienceIds}
                    onChange={(ids) => setVField("experienceIds", ids)}
                  />
                </div>
              ) : null}
              {voucherError ? <div className="sm:col-span-2"><ErrorNote>{voucherError}</ErrorNote></div> : null}
              <div className="sm:col-span-2">
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? "Creating…" : "Create voucher"}
                </Button>
              </div>
            </form>
          ) : null}
        </Card>
      ) : null}

      {/* lists */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}
        </div>
      ) : !visible.length ? (
        <Card>
          <EmptyState
            icon={<Icon name="tag" size={20} />}
            title={activeList.length ? "Nothing matches" : `No ${tab} yet`}
            description={
              activeList.length
                ? "No entries match your search or status filter."
                : "Create one to get started."
            }
            action={
              activeList.length ? (
                <Button variant="secondary" onClick={() => { setSearch(""); setStatusFilter("all"); }}>
                  Clear filters
                </Button>
              ) : (
                <Button variant="primary" onClick={() => setCreateOpen(true)}>Create</Button>
              )
            }
          />
        </Card>
      ) : (
        <Card padded={false} className="overflow-hidden">
          <ul className="divide-y divide-[#f0ebe2]">
            {visible.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {tab === "campaigns" ? (
                      <span className="text-[14px] font-semibold text-[#2a211a]">{x.name}</span>
                    ) : (
                      <span className="rounded-lg bg-[#f3ece1] px-2 py-0.5 font-mono text-[13px] font-bold tracking-wider text-[#8b6f47]">
                        {x.code || "—"}
                      </span>
                    )}
                    <StatusChip x={x} />
                    <ScopeBadge c={x} />
                    {tab !== "campaigns" ? (
                      <span className="text-[13px] font-semibold text-[#2a211a]">{fmtValue(x)}</span>
                    ) : null}
                    {x.stackable ? <Badge variant="neutral">stackable</Badge> : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[11.5px] text-[#9a8c7e]">
                    <PeriodCell x={x} />
                    {tab === "campaigns" && x.description ? <span className="truncate">{x.description}</span> : null}
                    {tab === "codes" && x.maxRedemptions ? (
                      <span>{x.redemptionCount ?? 0} / {x.maxRedemptions} used</span>
                    ) : null}
                    {tab === "vouchers" ? (
                      <span>
                        {x.assignedToEmail || x.assignedToUserId
                          ? `assigned to ${x.assignedToEmail || `user #${x.assignedToUserId}`}`
                          : "unassigned"}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {tab === "campaigns" ? (
                    <>
                      <Button size="sm" variant="ghost" disabled={workingId === x.id}
                        onClick={() => toggleCampaignActive(x)}>
                        {x.active ? "Pause" : "Resume"}
                      </Button>
                      <IconBtn title="Delete campaign" tone="bad" icon="trash" onClick={() => deleteCampaign(x)} />
                    </>
                  ) : null}

                  {tab === "codes" ? (
                    <>
                      <IconBtn title="Copy code" icon="copy" onClick={() => onCopy(x)} />
                      <IconBtn title="Edit" icon="file" onClick={() => onEdit(x)} />
                      <Button size="sm" variant="ghost" disabled={workingId === x.id}
                        onClick={() => onToggleActive(x)}>
                        {x.active ? "Pause" : "Resume"}
                      </Button>
                      <IconBtn title="Delete code" tone="bad" icon="trash" onClick={() => onDelete(x)} />
                    </>
                  ) : null}

                  {tab === "vouchers" ? (
                    <>
                      <IconBtn title="Copy code" icon="copy" onClick={() => copyVoucherCode(x)} />
                      <IconBtn title="Edit voucher" icon="file" onClick={() => openVoucherModal(x)} />
                      {x.assignedToUserId || x.assignedToEmail ? (
                        <IconBtn title="Unassign" icon="users" onClick={() => unassignVoucher(x)} />
                      ) : null}
                      <Button size="sm" variant="ghost" disabled={workingId === x.id}
                        onClick={() => toggleVoucherActive(x)}>
                        {x.active ? "Pause" : "Resume"}
                      </Button>
                      <IconBtn title="Delete voucher" tone="bad" icon="trash" onClick={() => deleteVoucher(x)} />
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ------------------------- edit discount code modal ------------------------ */}
      {editOpen && editTarget ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-t-3xl border border-[#e6e0d6] bg-white p-6 shadow-2xl sm:rounded-3xl">
            <div className="mb-4 flex items-start justify-between">
              <h2 className="font-serif text-[19px] text-[#2a211a]">Edit code</h2>
              <button onClick={() => setEditOpen(false)} aria-label="Close"
                className="rounded-lg p-1.5 text-[#9a8c7e] hover:bg-[#f2ede4]">
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <Field label="Code">
                <input value={editForm.code || ""} onChange={(e) => setField("code", e.target.value)}
                  className={`${inputClass} font-mono uppercase`} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Type">
                  <Select value={editForm.discountType} onChange={(e) => setField("discountType", e.target.value)}>
                    <option value="percent">Percentage</option>
                    <option value="amount">Fixed amount</option>
                  </Select>
                </Field>
                <Field label="Value">
                  <input type="number" min="0" step="0.01" value={editForm.discountValue ?? ""}
                    onChange={(e) => setField("discountValue", e.target.value)} className={inputClass} />
                </Field>
              </div>
              <Field label="Max redemptions" hint="Blank means unlimited.">
                <input type="number" min="0" value={editForm.maxRedemptions ?? ""}
                  onChange={(e) => setField("maxRedemptions", e.target.value)} className={inputClass} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Starts">
                  <input type="datetime-local" value={editForm.startsAt || ""}
                    onChange={(e) => setField("startsAt", e.target.value)} className={inputClass} />
                </Field>
                <Field label="Ends">
                  <input type="datetime-local" value={editForm.endsAt || ""}
                    onChange={(e) => setField("endsAt", e.target.value)} className={inputClass} />
                </Field>
              </div>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={!!editForm.active}
                  onChange={(e) => setField("active", e.target.checked)} className="h-4 w-4 accent-[#8b6f47]" />
                <span className="text-[13px] text-[#2a211a]">Active</span>
              </label>
            </div>
            {editError ? <ErrorNote className="mt-3">{editError}</ErrorNote> : null}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={saveEdit} disabled={savingEdit}>
                {savingEdit ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ----------------------------- voucher modal ------------------------------ */}
      {voucherOpen && voucherTarget ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setVoucherOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-t-3xl border border-[#e6e0d6] bg-white p-6 shadow-2xl sm:rounded-3xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="font-serif text-[19px] text-[#2a211a]">Edit voucher</h2>
                <p className="mt-0.5 font-mono text-[12px] text-[#9a8c7e]">{voucherTarget.code}</p>
              </div>
              <button onClick={() => setVoucherOpen(false)} aria-label="Close"
                className="rounded-lg p-1.5 text-[#9a8c7e] hover:bg-[#f2ede4]">
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <span className="mb-1 block text-[11px] font-semibold text-[#6b5c4d]">Assigned to</span>
                <UserAssign value={assignDraft} onChange={setAssignDraft} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Type">
                  <Select value={voucherForm.discountType} onChange={(e) => setVField("discountType", e.target.value)}>
                    <option value="percent">Percentage</option>
                    <option value="amount">Fixed amount</option>
                  </Select>
                </Field>
                <Field label="Value">
                  <input type="number" min="0" step="0.01" value={voucherForm.discountValue}
                    onChange={(e) => setVField("discountValue", e.target.value)} className={inputClass} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Starts">
                  <input type="datetime-local" value={voucherForm.startsAt}
                    onChange={(e) => setVField("startsAt", e.target.value)} className={inputClass} />
                </Field>
                <Field label="Ends">
                  <input type="datetime-local" value={voucherForm.endsAt}
                    onChange={(e) => setVField("endsAt", e.target.value)} className={inputClass} />
                </Field>
              </div>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={!!voucherForm.active}
                  onChange={(e) => setVField("active", e.target.checked)} className="h-4 w-4 accent-[#8b6f47]" />
                <span className="text-[13px] text-[#2a211a]">Active</span>
              </label>
            </div>
            {voucherError ? <ErrorNote className="mt-3">{voucherError}</ErrorNote> : null}
            <div className="mt-5 flex items-center justify-between gap-2">
              <Button variant="danger" onClick={deleteVoucherFromModal}>Delete</Button>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setVoucherOpen(false)}>Cancel</Button>
                <Button variant="primary" onClick={saveVoucher} disabled={savingVoucher}>
                  {savingVoucher ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </Page>
  );
}

/* ------------------------------- small parts ------------------------------ */

function StatCard({ label, value }) {
  return (
    <Card className="py-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9a8c7e]">{label}</p>
      <p className="mt-1 font-serif text-[20px] text-[#2a211a]">{value}</p>
    </Card>
  );
}

function IconBtn({ title, onClick, icon, tone }) {
  const hover =
    tone === "bad"
      ? "hover:bg-[#fbeae5] hover:text-[#a33c22]"
      : "hover:bg-[#f2ede4] hover:text-[#2a211a]";
  return (
    <button title={title} aria-label={title} onClick={onClick}
      className={`rounded-lg p-1.5 text-[#7a6a5f] transition-colors ${hover}`}>
      <Icon name={icon} size={15} />
    </button>
  );
}
