// src/app/components/LinkWithLoader.js
"use client";

import { useLocale } from "next-intl";
import { useRouteLoader } from "./RouteLoader";

export default function LinkWithLoader({
  href,
  children,
  className,
  onClick,
  ...props
}) {
  const locale = useLocale();
  const { triggerRouteChange } = useRouteLoader() || {};

  // Normalize href to include locale, except for admin & external links
  const finalHref = (() => {
    if (!href || typeof href !== "string") return href;

    // external links: leave untouched
    if (/^https?:\/\//i.test(href)) return href;

    // non-localized admin area
    if (href.startsWith("/admin")) return href;

    // root
    if (href === "/") return `/${locale}`;

    // already has locale prefix
    if (href.startsWith(`/${locale}/`)) return href;

    // normal localized internal path, e.g. "/experiences"
    return `/${locale}${href}`;
  })();

  const handleClick = (e) => {
    if (onClick) onClick(e);
    if (e.defaultPrevented) return;

    // Allow normal browser behaviour for modified clicks / middle click
    if (
      e.button !== 0 || // not left click
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    ) {
      return;
    }

    // If we have a loader, intercept and drive navigation via RouteLoader
    if (triggerRouteChange && finalHref && typeof finalHref === "string") {
      e.preventDefault();
      triggerRouteChange(finalHref);
    }
    // If no RouteLoader context, let the browser follow href normally
  };

  return (
    <a
      href={finalHref || "#"}
      onClick={handleClick}
      className={className}
      {...props}
    >
      {children}
    </a>
  );
}
