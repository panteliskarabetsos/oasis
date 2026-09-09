"use client";

// Interactive primitives, kept out of ./index.jsx so that file can stay
// hook-free and importable from server components, as its header promises.

import React from "react";

import { inputClass } from "./index";

/* ------------------------------ numeric input ----------------------------- */

/**
 * An input that shows a decimal but stores an integer (cents, grams).
 *
 * The naive version — value={(cents/100).toFixed(2)} with onChange parsing back
 * — reformats on every keystroke, so a half-typed "4." becomes "0.00" and the
 * field can never be cleared. Editing 3.50 to 4.50 landed on 0.01. This keeps
 * the raw text while the field has focus and only normalises on blur.
 */
export function ScaledNumberInput({
  value,
  onChange,
  scale = 100,
  decimals = 2,
  className = "",
  ...rest
}) {
  const format = React.useCallback(
    (v) => {
      const n = (Number(v) || 0) / scale;
      return decimals == null ? String(n) : n.toFixed(decimals);
    },
    [scale, decimals]
  );

  const [text, setText] = React.useState(() => format(value));
  const [editing, setEditing] = React.useState(false);

  // Adopt an external change (loading, discarding) but never fight the typist.
  React.useEffect(() => {
    if (!editing) setText(format(value));
  }, [value, editing, format]);

  const parse = (raw) => {
    const cleaned = String(raw).replace(",", ".").replace(/[^0-9.]/g, "");
    if (cleaned === "" || cleaned === ".") return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? Math.round(n * scale) : null;
  };

  return (
    <input
      {...rest}
      value={text}
      inputMode="decimal"
      className={`${inputClass} ${className}`}
      onFocus={(e) => {
        setEditing(true);
        rest.onFocus?.(e);
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(",", ".").replace(/[^0-9.]/g, "");
        setText(raw);
        const parsed = parse(raw);
        if (parsed !== null) onChange(parsed);
      }}
      onBlur={(e) => {
        setEditing(false);
        const parsed = parse(text) ?? 0;
        onChange(parsed);
        setText(format(parsed));
        rest.onBlur?.(e);
      }}
    />
  );
}

/**
 * Comma-separated list input.
 *
 * Same trap as ScaledNumberInput: deriving the displayed text from the parsed
 * array means a freshly-typed separator is filtered away before it can be used
 * — "GR" + ", IT" collapsed to the single country "GRIT". Hold the raw text
 * while focused, parse on change, and tidy on blur.
 */
export function TextListInput({
  values,
  onChange,
  transform = (v) => v,
  className = "",
  ...rest
}) {
  const join = React.useCallback((list) => (list || []).join(", "), []);
  const [text, setText] = React.useState(() => join(values));
  const [editing, setEditing] = React.useState(false);

  React.useEffect(() => {
    if (!editing) setText(join(values));
  }, [values, editing, join]);

  const parse = (raw) =>
    String(raw)
      .split(",")
      .map((v) => transform(v.trim()))
      .filter(Boolean);

  return (
    <input
      {...rest}
      value={text}
      className={`${inputClass} ${className}`}
      onFocus={(e) => {
        setEditing(true);
        rest.onFocus?.(e);
      }}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parse(e.target.value));
      }}
      onBlur={(e) => {
        setEditing(false);
        const parsed = parse(text);
        onChange(parsed);
        setText(join(parsed));
        rest.onBlur?.(e);
      }}
    />
  );
}
