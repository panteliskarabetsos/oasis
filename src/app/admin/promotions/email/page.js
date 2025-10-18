// src/app/admin/promotions/email/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Send,
  Play,
  Eye,
  Mail,
  Plus,
  Image as ImageIcon,
  Type,
  Layout,
  Minus,
  MoveUpRight,
  Smartphone,
  Monitor,
  Trash2,
  ChevronUp,
  ChevronDown,
  Link as LinkIcon,
  MinusCircle,
  ArrowLeft,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
const CloudinaryWidget = dynamic(
  () => import("@/app/admin/components/CloudinaryWidget"),
  { ssr: false }
);
/* ---------------------------- UI helpers ---------------------------- */
const cx = (...xs) => xs.filter(Boolean).join(" ");
const uid = () => Math.random().toString(36).slice(2);
const escapeHtml = (s = "") =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

function Field({ label, hint, children, className }) {
  return (
    <label className={cx("grid gap-1", className)}>
      <span className="text-xs text-[#7a6a58]">{label}</span>
      {children}
      {hint ? <span className="text-[11px] text-[#9b8b79]">{hint}</span> : null}
    </label>
  );
}

function Badge({ children, tone = "neutral" }) {
  const tones = {
    neutral:
      "bg-[#f7f3ed] text-[#6a5a4a] border border-[#ece6de] shadow-[0_0_0_1px_#ffffff_inset]",
    success:
      "bg-[#edf7f1] text-[#285b3a] border border-[#d7eee2] shadow-[0_0_0_1px_#ffffff_inset]",
    warn: "bg-[#fff7e8] text-[#7a4b00] border border-[#ffe9c2] shadow-[0_0_0_1px_#ffffff_inset]",
    danger:
      "bg-[#fdeeee] text-[#7a2e2e] border border-[#f7d0d0] shadow-[0_0_0_1px_#ffffff_inset]",
  };
  return (
    <span className={cx("px-2 py-0.5 rounded-full text-xs", tones[tone])}>
      {children}
    </span>
  );
}

/* ---------------------------- Block model --------------------------- */
const BLOCKS = {
  heading: {
    icon: Type,
    label: "Heading",
    defaults: { level: "h1", text: "Welcome to our newsletter" },
  },
  paragraph: {
    icon: Layout,
    label: "Text",
    defaults: { text: "Write something engaging. Keep it short and clear." },
  },
  button: {
    icon: MoveUpRight,
    label: "Button",
    defaults: {
      label: "Call to action",
      url: "https://example.com",
      align: "center",
    },
  },
  image: {
    icon: ImageIcon,
    label: "Image",
    defaults: {
      url: "https://via.placeholder.com/1200x600.png?text=Banner",
      alt: "Banner",
      width: 600,
    },
  },
  divider: {
    icon: Minus,
    label: "Divider",
    defaults: { color: "#e6e2dc", thickness: 1 },
  },
  spacer: {
    icon: MinusCircle,
    label: "Spacer",
    defaults: { height: 16 },
  },
};

function newBlock(type) {
  return { id: uid(), type, data: { ...BLOCKS[type].defaults } };
}

/* --------------- Renderers: blocks -> email-safe HTML/Text ---------- */

function renderBlocksToText(blocks) {
  const lines = [];
  for (const b of blocks) {
    if (b.type === "heading") lines.push(b.data.text);
    if (b.type === "paragraph") lines.push(b.data.text);
    if (b.type === "button")
      lines.push(`${b.data.label}: ${b.data.url || ""}`.trim());
    if (b.type === "image" && b.data.alt) lines.push(`[Image] ${b.data.alt}`);
    if (b.type === "divider") lines.push("—");
    if (b.type === "spacer") lines.push("");
  }
  return lines.join("\n\n").trim();
}

// Minimal, table-based, inline-styled email HTML (600px container)
function renderBlocksToHtml(
  { subject, preheader, from_name, from_email, unsubscribe_url },
  blocks
) {
  const rows = blocks
    .map((b) => {
      if (b.type === "heading") {
        const size =
          b.data.level === "h1"
            ? "26px"
            : b.data.level === "h2"
            ? "22px"
            : "18px";
        return `
<tr>
  <td style="padding:24px 24px 8px 24px;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;">
    <h1 style="margin:0;font-size:${size};line-height:1.3;color:#2f251d;font-weight:700;">${escapeHtml(
          b.data.text
        )}</h1>
  </td>
</tr>`;
      }
      if (b.type === "paragraph") {
        const text = escapeHtml(b.data.text).replaceAll("\n", "<br/>");
        return `
<tr>
  <td style="padding:8px 24px 8px 24px;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;">
    <p style="margin:0;font-size:15px;line-height:1.6;color:#4a4037;">${text}</p>
  </td>
</tr>`;
      }
      if (b.type === "button") {
        const align =
          b.data.align === "left"
            ? "left"
            : b.data.align === "right"
            ? "right"
            : "center";
        return `
<tr>
  <td style="padding:16px 24px 8px 24px;" align="${align}">
    <a href="${escapeHtml(
      b.data.url || "#"
    )}" style="display:inline-block;background:#5a4a3f;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 18px;border-radius:10px;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;font-size:14px;">${escapeHtml(
          b.data.label
        )}</a>
  </td>
</tr>`;
      }
      if (b.type === "image") {
        const w = Math.min(600, Math.max(64, Number(b.data.width) || 600));
        return `
<tr>
  <td style="padding:8px 24px 8px 24px;" align="center">
    <img src="${escapeHtml(b.data.url)}" alt="${escapeHtml(
          b.data.alt || ""
        )}" width="${w}" style="display:block;border:0;outline:none;text-decoration:none;width:${w}px;max-width:100%;height:auto;border-radius:12px"/>
  </td>
</tr>`;
      }
      if (b.type === "divider") {
        return `
<tr>
  <td style="padding:12px 24px;">
    <hr style="border:0;border-top:${b.data.thickness || 1}px solid ${
          b.data.color || "#e6e2dc"
        };margin:0"/>
  </td>
</tr>`;
      }
      if (b.type === "spacer") {
        return `
<tr><td style="height:${b.data.height || 16}px;line-height:${
          b.data.height || 16
        }px;font-size:0;">&nbsp;</td></tr>`;
      }
      return "";
    })
    .join("");

  const html = `<!doctype html>
<html>
  <head>
    <meta name="x-apple-disable-message-reformatting"/>
    <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>${escapeHtml(subject || "Newsletter")}</title>
    <style>
      @media (prefers-color-scheme: dark) {
        .bg { background: #181614 !important; }
        .card { background: #1f1b18 !important; }
        .muted { color: #b9b1a7 !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#fcf9f4;" class="bg">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#fcf9f4;">
      <tr>
        <td align="center" style="padding:24px;">
          <!-- Preheader (hidden) -->
          <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;visibility:hidden;">${escapeHtml(
            preheader || ""
          )}</div>

          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;background:#ffffff;border:1px solid #efe9e1;border-radius:16px;" class="card">
            ${rows}
            <tr>
              <td style="padding:24px;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;">
                <p class="muted" style="margin:0;color:#7a6a58;font-size:12px;line-height:1.5;">
                  Sent by ${escapeHtml(from_name || "")}${
    from_email ? ` &lt;${escapeHtml(from_email)}&gt;` : ""
  }. You received this because you subscribed to our newsletter.
                <a href="${escapeHtml(
                  unsubscribe_url || "{{UNSUBSCRIBE_URL}}"
                )}"
       style="display:inline-block;margin-top:2px;font-size:12px;color:#7a6a58;text-decoration:underline;">
      Unsubscribe
    </a>
                </p>
    
              </td>
            </tr>
          </table>

          <div style="height:24px;line-height:24px;font-size:0;">&nbsp;</div>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return html;
}

/* ------------------------------ Page ------------------------------- */

export default function EmailCampaignsPage() {
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [previewMode, setPreviewMode] = useState("desktop"); // 'desktop' | 'mobile'
  const [selectedId, setSelectedId] = useState(null);

  const [form, setForm] = useState({
    name: "",
    subject: "",
    preheader: "",
    from_name: "",
    from_email: "",
    unsubscribe_url: "{{UNSUBSCRIBE_URL}}",
    // New: block-based editor (no HTML required)
    blocks: [newBlock("heading"), newBlock("paragraph"), newBlock("button")],
  });

  const selectedBlock = useMemo(
    () => form.blocks.find((b) => b.id === selectedId) || null,
    [form.blocks, selectedId]
  );

  async function fetchCampaigns() {
    setLoading(true);
    const res = await fetch("/api/admin/promotions/email/campaigns", {
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({ campaigns: [] }));
    setCampaigns(data.campaigns || []);
    setLoading(false);
  }
  useEffect(() => {
    fetchCampaigns();
  }, []);

  function addBlock(type) {
    const b = newBlock(type);
    setForm((f) => ({ ...f, blocks: [...f.blocks, b] }));
    setSelectedId(b.id);
  }
  function updateBlock(id, patch) {
    setForm((f) => ({
      ...f,
      blocks: f.blocks.map((b) =>
        b.id === id ? { ...b, data: { ...b.data, ...patch } } : b
      ),
    }));
  }
  function moveBlock(id, dir) {
    setForm((f) => {
      const i = f.blocks.findIndex((b) => b.id === id);
      if (i < 0) return f;
      const j =
        dir === "up"
          ? Math.max(0, i - 1)
          : Math.min(f.blocks.length - 1, i + 1);
      const copy = [...f.blocks];
      const [item] = copy.splice(i, 1);
      copy.splice(j, 0, item);
      return { ...f, blocks: copy };
    });
  }
  function removeBlock(id) {
    setForm((f) => ({ ...f, blocks: f.blocks.filter((b) => b.id !== id) }));
    if (selectedId === id) setSelectedId(null);
  }

  async function createCampaign() {
    setSubmitting(true);
    try {
      const html = renderBlocksToHtml(form, form.blocks);
      const text = renderBlocksToText(form.blocks);
      const payload = {
        name: form.name,
        subject: form.subject,
        preheader: form.preheader,
        from_name: form.from_name,
        from_email: form.from_email,
        html,
        text,
      };
      const res = await fetch("/api/admin/promotions/email/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Create failed");
      setCampaigns((prev) => [data.campaign, ...prev]);
      alert("Campaign created.");
      // Reset but keep the sender fields for convenience
      setForm((f) => ({
        ...f,
        name: "",
        subject: "",
        preheader: "",
        blocks: [
          newBlock("heading"),
          newBlock("paragraph"),
          newBlock("button"),
        ],
      }));
    } catch (e) {
      alert(e.message || "Error");
    } finally {
      setSubmitting(false);
    }
  }

  async function sendNow(id) {
    const res = await fetch(
      `/api/admin/promotions/email/campaigns/${id}/send`,
      { method: "POST" }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return alert(data?.error || "Send failed");
    alert(`Enqueued ${data.enqueued} recipients. Worker started.`);
    fetchCampaigns();
  }

  async function resume(id) {
    const res = await fetch(`/api/admin/promotions/email/worker`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId: id, batchSize: 500 }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return alert(data?.error || "Worker failed");
    alert(
      `Processed ${data.processed}. Sent ${data.sent}, failed ${data.failed}.`
    );
    fetchCampaigns();
  }

  async function openEmailPreview(id) {
    // Open first to avoid popup blockers
    const popup = window.open("", "_blank", "width=960,height=800");
    if (!popup) {
      alert("Please allow pop-ups to preview the email.");
      return;
    }

    // Write a minimal shell and fully close the document so the DOM is ready
    popup.document.open();
    popup.document.write(`<!doctype html>
<html>
<head>
  <title>Email preview</title>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    :root { --bd:#e8e5df; --bg:#f6f4ef; }
    html,body{height:100%}
    body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:var(--bg);}
    .bar{position:sticky;top:0;display:flex;gap:8px;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid var(--bd);background:#fff;z-index:10}
    .title{font-size:12px;color:#5a4a3f}
    .wrap{padding:16px}
    .frame{display:block;margin:0 auto;border:1px solid var(--bd);border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.05);background:#fff}
    button{border:1px solid var(--bd);border-radius:10px;background:#faf7f2;padding:8px 10px;font-size:12px;cursor:pointer}
    button+button{margin-left:6px}
  </style>
</head>
<body>
  <div class="bar">
    <div class="title" id="ttl">Loading…</div>
    <div>
      <button onclick="setMode('desktop')">Desktop</button>
      <button onclick="setMode('mobile')">Mobile</button>
    </div>
  </div>
  <div class="wrap">
    <iframe id="frame" class="frame"
      style="width:900px;height:680px;"
      sandbox="allow-same-origin allow-popups allow-top-navigation-by-user-activation">
    </iframe>
  </div>
  <script>
    function setMode(m){
      const f = document.getElementById('frame');
      f.style.width = m==='mobile' ? '390px' : '900px';
      // Refit height after a small delay (layout settles)
      setTimeout(autoFit, 50);
    }
    function autoFit(){
      const f = document.getElementById('frame');
      try {
        const doc = f.contentDocument;
        if (!doc) return;
        const h = Math.max(
          doc.documentElement?.scrollHeight || 0,
          doc.body?.scrollHeight || 0,
          680
        );
        f.style.height = Math.min(h + 20, 3000) + 'px';
      } catch (e) { /* cross-origin guard (shouldn't happen with srcdoc + allow-same-origin) */ }
    }
    function renderEmail(subject, html){
      document.getElementById('ttl').textContent = subject || 'Email preview';
      const f = document.getElementById('frame');
      f.onload = autoFit;
      f.srcdoc = html;
    }
    window.setMode = setMode;
    window.renderEmail = renderEmail;
    window.autoFit = autoFit;
  </script>
</body>
</html>`);
    popup.document.close();

    // Helper: wait for the preview functions/elements to exist
    async function waitFor(fn, timeout = 3000) {
      const start = Date.now();
      return new Promise((resolve, reject) => {
        (function check() {
          if (fn()) return resolve();
          if (Date.now() - start > timeout)
            return reject(new Error("Preview window failed to initialize"));
          setTimeout(check, 30);
        })();
      });
    }

    try {
      await waitFor(
        () =>
          popup && popup.renderEmail && popup.document.getElementById("frame")
      );

      const res = await fetch(`/api/admin/promotions/email/campaigns/${id}`, {
        cache: "no-store",
      });
      const data = await res.json();

      const html = data?.campaign?.html ?? data?.html ?? "";
      const subject =
        data?.campaign?.subject ?? data?.subject ?? "Email preview";
      if (!html) throw new Error("No HTML found on campaign.");

      // Render inside the popup
      popup.renderEmail(subject, html);
      popup.focus();
    } catch (e) {
      if (!popup || popup.closed) return;
      popup.document.body.innerHTML =
        '<p style="padding:16px;font:14px system-ui">Failed to load preview: ' +
        (e.message || "Unknown error") +
        "</p>";
    }
  }

  /* ------------------------------ UI -------------------------------- */

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-8">
      <h1 className="text-2xl font-semibold text-[#5a4a3f] flex items-center gap-2">
        <Link
          href="/admin/promotions"
          className="inline-block rounded-xl bg-[#6e3611] px-3 py-1 text-sm font-medium text-white hover:bg-[#7a6a58] transition"
        >
          <ArrowLeft>Go Back</ArrowLeft>
        </Link>
        <Mail className="w-6 h-6 text-[#8b6f47]" /> Email campaigns
      </h1>

      {/* Create / Editor */}
      <section className="rounded-2xl border border-[#e8e5df] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#5a4a3f] mb-4">
          Create campaign
        </h2>

        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)_320px]">
          {/* Palette */}
          <div className="rounded-xl border border-[#e8e5df] p-4 bg-[#fcfbf8]">
            <div className="text-xs font-medium text-[#7a6a58] mb-2">
              Content blocks
            </div>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(BLOCKS).map(([type, meta]) => {
                const Icon = meta.icon;
                return (
                  <button
                    key={type}
                    onClick={() => addBlock(type)}
                    className="flex items-center gap-2 rounded-xl border border-[#e8e5df] px-3 py-2 text-sm text-[#5a4a3f] hover:bg-[#faf7f2]"
                  >
                    <Icon className="w-4 h-4" />
                    {meta.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 text-xs font-medium text-[#7a6a58] mb-2">
              Quick templates
            </div>
            <div className="grid gap-2">
              <button
                className="rounded-xl border border-[#e8e5df] px-3 py-2 text-sm text-[#5a4a3f] hover:bg-[#faf7f2]"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    subject: "October updates 🍂",
                    preheader: "Fresh features, seasonal promo, and more",
                    blocks: [
                      {
                        id: uid(),
                        type: "image",
                        data: {
                          url: "https://via.placeholder.com/1200x480.png?text=OCT+HERO",
                          alt: "Hero",
                          width: 600,
                        },
                      },
                      {
                        id: uid(),
                        type: "heading",
                        data: { level: "h1", text: "What’s new this month" },
                      },
                      {
                        id: uid(),
                        type: "paragraph",
                        data: {
                          text: "A short overview of what shipped and what’s coming next.",
                        },
                      },
                      {
                        id: uid(),
                        type: "button",
                        data: {
                          label: "Read the blog",
                          url: "https://youroasis.gr/",
                          align: "left",
                        },
                      },
                      {
                        id: uid(),
                        type: "divider",
                        data: { color: "#e6e2dc", thickness: 1 },
                      },
                      {
                        id: uid(),
                        type: "paragraph",
                        data: {
                          text: "Limited-time offer ends Sunday. Don’t miss out!",
                        },
                      },
                      {
                        id: uid(),
                        type: "button",
                        data: {
                          label: "Claim the offer",
                          url: "https://youroasis.gr/offer",
                          align: "center",
                        },
                      },
                    ],
                  }))
                }
              >
                Monthly Update
              </button>
              <button
                className="rounded-xl border border-[#e8e5df] px-3 py-2 text-sm text-[#5a4a3f] hover:bg-[#faf7f2]"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    subject: "Special promotion ✨",
                    preheader: "A treat just for you",
                    blocks: [
                      {
                        id: uid(),
                        type: "heading",
                        data: { level: "h1", text: "A small gift from us" },
                      },
                      {
                        id: uid(),
                        type: "paragraph",
                        data: {
                          text: "Use code FRIENDS10 at checkout to get 10% off.",
                        },
                      },
                      {
                        id: uid(),
                        type: "button",
                        data: {
                          label: "Shop now",
                          url: "https://example.com",
                          align: "center",
                        },
                      },
                      { id: uid(), type: "spacer", data: { height: 24 } },
                      {
                        id: uid(),
                        type: "paragraph",
                        data: { text: "Offer valid through Sunday 23:59." },
                      },
                    ],
                  }))
                }
              >
                Promo
              </button>
            </div>
          </div>

          {/* Canvas + Preview toggle */}
          <div className="space-y-4">
            {/* Campaign meta */}
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Internal name">
                <input
                  className="rounded-xl border border-[#e8e5df] px-3 py-2 text-sm"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label="Subject">
                <input
                  className="rounded-xl border border-[#e8e5df] px-3 py-2 text-sm"
                  value={form.subject}
                  onChange={(e) =>
                    setForm({ ...form, subject: e.target.value })
                  }
                />
              </Field>
              <Field
                label="Preheader (optional)"
                hint="Appears next to your subject in inbox previews."
              >
                <input
                  className="rounded-xl border border-[#e8e5df] px-3 py-2 text-sm"
                  value={form.preheader}
                  onChange={(e) =>
                    setForm({ ...form, preheader: e.target.value })
                  }
                />
              </Field>
              <div className="grid gap-4 md:grid-cols-2 md:col-span-2">
                <Field label="From name">
                  <input
                    className="rounded-xl border border-[#e8e5df] px-3 py-2 text-sm"
                    value={form.from_name}
                    onChange={(e) =>
                      setForm({ ...form, from_name: e.target.value })
                    }
                  />
                </Field>
                <Field
                  label="From email"
                  hint="Use a verified sender for best deliverability."
                >
                  <input
                    className="rounded-xl border border-[#e8e5df] px-3 py-2 text-sm"
                    value={form.from_email}
                    onChange={(e) =>
                      setForm({ ...form, from_email: e.target.value })
                    }
                  />
                </Field>
              </div>
            </div>

            {/* Blocks list (canvas) */}
            <div className="rounded-xl border border-[#e8e5df] bg-[#fcfbf8] p-3">
              {form.blocks.length === 0 ? (
                <div className="text-sm text-[#7a6a58] p-6 text-center">
                  No content yet. Add blocks from the left.
                </div>
              ) : (
                <ul className="space-y-2">
                  {form.blocks.map((b, idx) => {
                    const active = selectedId === b.id;
                    return (
                      <li
                        key={b.id}
                        className={cx(
                          "rounded-xl border px-3 py-2 bg-white",
                          active
                            ? "border-[#c9b89f] ring-2 ring-[#e8dcc7]"
                            : "border-[#e8e5df]"
                        )}
                        onClick={() => setSelectedId(b.id)}
                      >
                        <div className="flex items-center gap-2 justify-between">
                          <div className="flex items-center gap-2">
                            {(() => {
                              const Icon = BLOCKS[b.type].icon;
                              return (
                                <Icon className="w-4 h-4 text-[#7a6a58]" />
                              );
                            })()}
                            <span className="text-sm text-[#5a4a3f]">
                              {BLOCKS[b.type].label}
                            </span>
                            <span className="text-xs text-[#9b8b79]">
                              #{idx + 1}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              className="p-1 rounded-lg border border-[#e8e5df] hover:bg-[#faf7f2]"
                              onClick={(e) => (
                                e.stopPropagation(), moveBlock(b.id, "up")
                              )}
                              title="Move up"
                            >
                              <ChevronUp className="w-4 h-4" />
                            </button>
                            <button
                              className="p-1 rounded-lg border border-[#e8e5df] hover:bg-[#faf7f2]"
                              onClick={(e) => (
                                e.stopPropagation(), moveBlock(b.id, "down")
                              )}
                              title="Move down"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </button>
                            <button
                              className="p-1 rounded-lg border border-[#e8e5df] hover:bg-[#faf7f2] text-[#7a2e2e]"
                              onClick={(e) => (
                                e.stopPropagation(), removeBlock(b.id)
                              )}
                              title="Remove block"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Inline mini preview */}
                        <div className="mt-2 text-xs text-[#6a5a4a]">
                          {b.type === "heading" && <em>{b.data.text}</em>}
                          {b.type === "paragraph" && (
                            <span className="line-clamp-2 whitespace-pre-wrap">
                              {b.data.text}
                            </span>
                          )}
                          {b.type === "button" && (
                            <span>
                              <LinkIcon className="inline w-3 h-3 mr-1" />
                              {b.data.label} → {b.data.url}
                            </span>
                          )}
                          {b.type === "image" && (
                            <span>
                              <ImageIcon className="inline w-3 h-3 mr-1" />
                              {b.data.alt || "Image"}
                            </span>
                          )}
                          {b.type === "divider" && <span>Thin line</span>}
                          {b.type === "spacer" && (
                            <span>{b.data.height}px space</span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Preview header */}
            <div className="flex items-center justify-between">
              <div className="text-xs text-[#7a6a58]">
                Inbox preview: <strong>{form.subject || "(no subject)"}</strong>{" "}
                — {form.preheader || "No preheader"}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className={cx(
                    "inline-flex items-center gap-1 rounded-xl border border-[#e8e5df] px-2.5 py-1.5 text-xs",
                    previewMode === "desktop" ? "bg-[#faf7f2]" : "bg-white"
                  )}
                  onClick={() => setPreviewMode("desktop")}
                >
                  <Monitor className="w-4 h-4" /> Desktop
                </button>
                <button
                  className={cx(
                    "inline-flex items-center gap-1 rounded-xl border border-[#e8e5df] px-2.5 py-1.5 text-xs",
                    previewMode === "mobile" ? "bg-[#faf7f2]" : "bg-white"
                  )}
                  onClick={() => setPreviewMode("mobile")}
                >
                  <Smartphone className="w-4 h-4" /> Mobile
                </button>
              </div>
            </div>

            {/* Live preview */}
            <EmailPreview
              html={renderBlocksToHtml(form, form.blocks)}
              mode={previewMode}
            />
          </div>

          {/* Inspector */}
          <div className="rounded-xl border border-[#e8e5df] p-4 bg-[#fcfbf8]">
            <div className="text-xs font-medium text-[#7a6a58] mb-2">
              Block settings
            </div>
            {selectedBlock ? (
              <BlockInspector
                block={selectedBlock}
                onChange={(patch) => updateBlock(selectedBlock.id, patch)}
              />
            ) : (
              <p className="text-sm text-[#7a6a58]">
                Select a block to edit its settings.
              </p>
            )}

            <hr className="my-4 border-[#efe9e1]" />

            <div className="text-xs font-medium text-[#7a6a58] mb-2">
              Plain text (generated)
            </div>
            <textarea
              readOnly
              rows={6}
              value={renderBlocksToText(form.blocks)}
              className="w-full rounded-xl border border-[#e8e5df] px-3 py-2 text-xs bg-white"
            />
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-2 sm:justify-end">
          <button
            onClick={createCampaign}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-2xl border border-[#e8e5df] bg-[#5a4a3f] px-4 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Save campaign
          </button>
        </div>
      </section>

      {/* List */}
      <section className="rounded-2xl border border-[#e8e5df] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#5a4a3f] mb-4">Campaigns</h2>
        {loading ? (
          <div className="flex items-center gap-2 text-[#7a6a58]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : campaigns.length === 0 ? (
          <p className="text-sm text-[#7a6a58]">No campaigns yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-[#7a6a58]">
                <tr>
                  <th className="px-2 py-1">Name</th>
                  <th className="px-2 py-1">Subject</th>
                  <th className="px-2 py-1">Status</th>
                  <th className="px-2 py-1 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-t border-[#f0ece6]">
                    <td className="px-2 py-1">{c.name}</td>
                    <td className="px-2 py-1">
                      <div className="flex flex-col">
                        <span>{c.subject}</span>
                        {c.preheader ? (
                          <span className="text-xs text-[#9b8b79]">
                            {c.preheader}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-2 py-1">
                      <CampaignStatus status={c.status} />
                    </td>
                    <td className="px-2 py-1">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => sendNow(c.id)}
                          className="rounded-md px-2 py-1.5 border border-[#e8e5df] text-[#7a6a58] hover:bg-[#faf7f2]"
                          title="Send now (enqueue + start worker)"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => resume(c.id)}
                          className="rounded-md px-2 py-1.5 border border-[#e8e5df] text-[#7a6a58] hover:bg-[#faf7f2]"
                          title="Process next batch"
                        >
                          <Loader2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEmailPreview(c.id)}
                          className="rounded-md px-2 py-1.5 border border-[#e8e5df] text-[#7a6a58] hover:bg-[#faf7f2]"
                          title="Preview email"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

/* ------------------------- Subcomponents --------------------------- */

function CampaignStatus({ status }) {
  if (!status) return <Badge>unknown</Badge>;
  const s = String(status).toLowerCase();
  if (["draft", "created"].includes(s)) return <Badge>draft</Badge>;
  if (["queued", "pending"].includes(s))
    return <Badge tone="warn">queued</Badge>;
  if (["sending", "processing"].includes(s))
    return <Badge tone="warn">sending</Badge>;
  if (["sent", "completed"].includes(s))
    return <Badge tone="success">sent</Badge>;
  if (["failed", "error"].includes(s))
    return <Badge tone="danger">failed</Badge>;
  return <Badge>{s}</Badge>;
}

function EmailPreview({ html, mode }) {
  const width = mode === "mobile" ? 390 : 900; // visual frame; actual email has max 600px card
  return (
    <div className="w-full flex justify-center">
      <div
        className="rounded-xl border border-[#e8e5df] overflow-hidden bg-white"
        style={{ width }}
      >
        <iframe
          title="email-preview"
          sandbox=""
          srcDoc={html}
          className="w-full"
          style={{ height: 680, border: "0" }}
        />
      </div>
    </div>
  );
}

function BlockInspector({ block, onChange }) {
  if (!block) return null;
  const { type, data } = block;

  if (type === "heading") {
    return (
      <div className="grid gap-3">
        <Field label="Text">
          <input
            className="rounded-xl border border-[#e8e5df] px-3 py-2 text-sm"
            value={data.text}
            onChange={(e) => onChange({ text: e.target.value })}
          />
        </Field>
        <Field label="Size">
          <select
            className="rounded-xl border border-[#e8e5df] px-3 py-2 text-sm"
            value={data.level}
            onChange={(e) => onChange({ level: e.target.value })}
          >
            <option value="h1">Large</option>
            <option value="h2">Medium</option>
            <option value="h3">Small</option>
          </select>
        </Field>
      </div>
    );
  }

  if (type === "paragraph") {
    return (
      <Field label="Text">
        <textarea
          rows={8}
          className="rounded-xl border border-[#e8e5df] px-3 py-2 text-sm"
          value={data.text}
          onChange={(e) => onChange({ text: e.target.value })}
        />
      </Field>
    );
  }

  if (type === "button") {
    return (
      <div className="grid gap-3">
        <Field label="Label">
          <input
            className="rounded-xl border border-[#e8e5df] px-3 py-2 text-sm"
            value={data.label}
            onChange={(e) => onChange({ label: e.target.value })}
          />
        </Field>
        <Field label="URL">
          <input
            className="rounded-xl border border-[#e8e5df] px-3 py-2 text-sm"
            value={data.url}
            onChange={(e) => onChange({ url: e.target.value })}
          />
        </Field>
        <Field label="Alignment">
          <select
            className="rounded-xl border border-[#e8e5df] px-3 py-2 text-sm"
            value={data.align}
            onChange={(e) => onChange({ align: e.target.value })}
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </Field>
      </div>
    );
  }

  if (type === "image") {
    const [uploads, setUploads] = useState([]);

    useEffect(() => {
      if (uploads.length) {
        const url = uploads[uploads.length - 1];
        onChange({ url });
        if (!data.alt) onChange({ alt: "Image" });
      }
    }, [uploads]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
      <div className="grid gap-3">
        {/* Cloudinary popup (from your component) */}
        <CloudinaryWidget setUploadedImages={setUploads} />

        {/* Preview of the selected image */}
        <div className="rounded-xl border border-[#e8e5df] p-2 bg-white">
          {data.url ? (
            <img
              src={data.url}
              alt={data.alt || "Image"}
              className="w-full rounded-lg"
              style={{ maxHeight: 180, objectFit: "cover" }}
            />
          ) : (
            <div className="text-sm text-[#7a6a58] p-4 text-center">
              No image selected yet. Click “Upload Images”.
            </div>
          )}
        </div>

        {/* (Optional) Manual override */}
        <Field label="Image URL (optional manual paste)">
          <input
            className="rounded-xl border border-[#e8e5df] px-3 py-2 text-sm"
            value={data.url || ""}
            onChange={(e) => onChange({ url: e.target.value })}
            placeholder="https://res.cloudinary.com/.../image.jpg"
          />
        </Field>

        <Field label="Alt text">
          <input
            className="rounded-xl border border-[#e8e5df] px-3 py-2 text-sm"
            value={data.alt || ""}
            onChange={(e) => onChange({ alt: e.target.value })}
          />
        </Field>

        <Field label="Width (max 600)">
          <input
            type="number"
            min={64}
            max={600}
            className="rounded-xl border border-[#e8e5df] px-3 py-2 text-sm"
            value={data.width ?? 600}
            onChange={(e) => onChange({ width: Number(e.target.value) || 600 })}
          />
        </Field>
      </div>
    );
  }

  if (type === "divider") {
    return (
      <div className="grid gap-3">
        <Field label="Color (hex)">
          <input
            className="rounded-xl border border-[#e8e5df] px-3 py-2 text-sm"
            value={data.color}
            onChange={(e) => onChange({ color: e.target.value })}
          />
        </Field>
        <Field label="Thickness (px)">
          <input
            type="number"
            min={1}
            max={6}
            className="rounded-xl border border-[#e8e5df] px-3 py-2 text-sm"
            value={data.thickness}
            onChange={(e) =>
              onChange({ thickness: Number(e.target.value) || 1 })
            }
          />
        </Field>
      </div>
    );
  }

  if (type === "spacer") {
    return (
      <Field label="Height (px)">
        <input
          type="number"
          min={4}
          max={96}
          className="rounded-xl border border-[#e8e5df] px-3 py-2 text-sm"
          value={data.height}
          onChange={(e) => onChange({ height: Number(e.target.value) || 16 })}
        />
      </Field>
    );
  }

  return <p className="text-sm text-[#7a6a58]">No settings for this block.</p>;
}
