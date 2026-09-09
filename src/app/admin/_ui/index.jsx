/**
 * Oasis Admin — shared design system.
 *
 * Pure presentational primitives (no hooks) so they can be used from both
 * server and client components. Interactive pieces live in ./client.jsx.
 *
 * Design language: warm paper canvas, white surfaces, hairline borders,
 * espresso/gold accents, Playfair headings over a compact data-dense body.
 */

/* --------------------------------- tokens -------------------------------- */

export const tone = {
  neutral: "bg-[#f2ede4] text-[#6b5c4d] ring-[#e6e0d6]",
  brand: "bg-[#f3ece1] text-[#8b6f47] ring-[#e7dcc9]",
  success: "bg-[#e9f2e9] text-[#3f6b3f] ring-[#d3e5d3]",
  warning: "bg-[#fbf1dc] text-[#8a6412] ring-[#f0e0bb]",
  danger: "bg-[#fbeae5] text-[#a33c22] ring-[#f3d5cb]",
  info: "bg-[#e8eef5] text-[#3a5d80] ring-[#d3e0ed]",
};

/* ------------------------------- typography ------------------------------ */

export function PageTitle({ children, className = "" }) {
  return (
    <h1 className={`font-serif text-[26px] leading-tight text-[#2a211a] ${className}`}>
      {children}
    </h1>
  );
}

export function Eyebrow({ children, className = "" }) {
  return (
    <p className={`text-[10px] font-semibold uppercase tracking-[0.22em] text-[#b89a6b] ${className}`}>
      {children}
    </p>
  );
}

export function Muted({ children, className = "" }) {
  return <p className={`text-[13px] text-[#7a6a5f] ${className}`}>{children}</p>;
}

/* --------------------------------- layout -------------------------------- */

/** Standard page frame: consistent max width and gutters on every screen. */
export function Page({ children, className = "" }) {
  return (
    <div className={`mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions, className = "" }) {
  return (
    <header className={`mb-6 flex flex-wrap items-end justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        {eyebrow ? <Eyebrow className="mb-1.5">{eyebrow}</Eyebrow> : null}
        <PageTitle>{title}</PageTitle>
        {description ? <Muted className="mt-1.5">{description}</Muted> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Card({ children, className = "", padded = true }) {
  return (
    <div
      className={`rounded-2xl border border-[#e6e0d6] bg-white shadow-[0_1px_2px_rgba(42,33,26,0.04)] ${
        padded ? "p-5" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, description, actions, className = "" }) {
  return (
    <div className={`mb-4 flex items-start justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        <h2 className="font-serif text-[17px] text-[#2a211a]">{title}</h2>
        {description ? <Muted className="mt-0.5 text-[12px]">{description}</Muted> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Section({ title, children, actions, className = "" }) {
  return (
    <section className={`mb-8 ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex items-center justify-between gap-4">
          {title ? <Eyebrow>{title}</Eyebrow> : <span />}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/* --------------------------------- badges -------------------------------- */

export function Badge({ children, variant = "neutral", className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
        tone[variant] || tone.neutral
      } ${className}`}
    >
      {children}
    </span>
  );
}

/** Maps a booking/payment status to a sensible badge colour. */
export function StatusBadge({ status, className = "" }) {
  const s = String(status || "").toLowerCase();
  const variant =
    ["confirmed", "paid", "succeeded", "completed", "active", "approved", "finalized"].includes(s)
      ? "success"
      : ["checked_in", "sent", "processing", "issued"].includes(s)
        ? "info"
        : ["pending", "draft", "requires_capture", "partially_refunded", "sending"].includes(s)
          ? "warning"
          : ["cancelled", "canceled", "no_show", "failed", "refunded", "void", "rejected"].includes(s)
            ? "danger"
            : "neutral";
  return (
    <Badge variant={variant} className={className}>
      {String(status || "—").replace(/_/g, " ")}
    </Badge>
  );
}

/* -------------------------------- controls ------------------------------- */

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl text-[13px] font-semibold transition-all " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b6f47]/40 disabled:opacity-50 disabled:pointer-events-none";

const BTN_VARIANTS = {
  primary: "bg-[#8b6f47] text-white hover:bg-[#7a6039] shadow-sm",
  secondary: "bg-white text-[#3f3127] border border-[#e6e0d6] hover:border-[#c9b393] hover:bg-[#fdfbf7]",
  ghost: "text-[#6b5c4d] hover:bg-[#f2ede4]",
  danger: "bg-[#a33c22] text-white hover:bg-[#8d3320] shadow-sm",
  dark: "bg-[#2a211a] text-white hover:bg-[#3a2f25]",
};

const BTN_SIZES = {
  sm: "h-8 px-3",
  md: "h-10 px-4",
  lg: "h-11 px-5",
  icon: "h-9 w-9",
};

export function Button({
  children,
  variant = "secondary",
  size = "md",
  className = "",
  as: As = "button",
  ...rest
}) {
  return (
    <As className={`${BTN_BASE} ${BTN_VARIANTS[variant] || BTN_VARIANTS.secondary} ${BTN_SIZES[size]} ${className}`} {...rest}>
      {children}
    </As>
  );
}

export const inputClass =
  "h-10 w-full rounded-xl border border-[#e6e0d6] bg-white px-3 text-[13px] text-[#2a211a] " +
  "placeholder:text-[#b0a294] focus:outline-none focus:ring-2 focus:ring-[#8b6f47]/30 focus:border-[#c9b393]";

export function Field({ label, hint, error, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      {label ? (
        <span className="mb-1.5 block text-[12px] font-semibold text-[#3f3127]">{label}</span>
      ) : null}
      {children}
      {error ? (
        <span className="mt-1 block text-[11px] text-[#a33c22]">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-[11px] text-[#9a8c7e]">{hint}</span>
      ) : null}
    </label>
  );
}

export function Input({ className = "", ...rest }) {
  return <input className={`${inputClass} ${className}`} {...rest} />;
}

export function Select({ className = "", children, ...rest }) {
  return (
    <select className={`${inputClass} pr-8 ${className}`} {...rest}>
      {children}
    </select>
  );
}

/* --------------------------------- tables -------------------------------- */

export function Table({ children, className = "" }) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full border-collapse text-[13px]">{children}</table>
    </div>
  );
}

export function Th({ children, className = "", ...rest }) {
  return (
    <th
      className={`whitespace-nowrap border-b border-[#e6e0d6] px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-[#9a8c7e] ${className}`}
      {...rest}
    >
      {children}
    </th>
  );
}

export function Td({ children, className = "", ...rest }) {
  return (
    <td className={`border-b border-[#f0ebe2] px-4 py-3 align-middle text-[#3f3127] ${className}`} {...rest}>
      {children}
    </td>
  );
}

export function Tr({ children, className = "", onClick, ...rest }) {
  return (
    <tr
      onClick={onClick}
      className={`${onClick ? "cursor-pointer" : ""} transition-colors hover:bg-[#fdfbf7] ${className}`}
      {...rest}
    >
      {children}
    </tr>
  );
}

/* --------------------------------- states -------------------------------- */

export function EmptyState({ icon, title, description, action, className = "" }) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-16 text-center ${className}`}>
      {icon ? (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f7f3ec] text-[#b89a6b]">
          {icon}
        </div>
      ) : null}
      <h3 className="font-serif text-[19px] text-[#2a211a]">{title}</h3>
      {description ? <Muted className="mt-1.5 max-w-sm">{description}</Muted> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded-xl bg-[#eee8de] ${className}`} />;
}

export function ErrorNote({ children, className = "" }) {
  return (
    <div className={`rounded-xl border border-[#f3d5cb] bg-[#fbeae5] px-4 py-3 text-[13px] text-[#a33c22] ${className}`}>
      {children}
    </div>
  );
}

/* ------------------------------- stat tiles ------------------------------ */

export function StatCard({ label, value, delta, hint, icon, accent = "brand", children }) {
  const accents = {
    brand: "text-[#8b6f47]",
    success: "text-[#3f6b3f]",
    warning: "text-[#8a6412]",
    info: "text-[#3a5d80]",
  };
  const positive = typeof delta === "string" && delta.trim().startsWith("+");
  return (
    <Card className="relative overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9a8c7e]">
          {label}
        </span>
        {icon ? <span className={accents[accent]}>{icon}</span> : null}
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <span className="font-serif text-[28px] leading-none text-[#2a211a]">{value}</span>
        {delta ? (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              positive ? "bg-[#e9f2e9] text-[#3f6b3f]" : "bg-[#fbeae5] text-[#a33c22]"
            }`}
          >
            {delta}
          </span>
        ) : null}
      </div>
      {hint ? <p className="mt-2 text-[11px] text-[#9a8c7e]">{hint}</p> : null}
      {children ? <div className="mt-3">{children}</div> : null}
    </Card>
  );
}
