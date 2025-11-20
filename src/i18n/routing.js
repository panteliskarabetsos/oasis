// src/i18n/routing.js
import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";

export const routing = defineRouting({
  locales: ["en", "el", "de"], // English & Greek
  defaultLocale: "en",
  // You can add pathnames here later if you want localized URLs
  // pathnames: {
  //   '/': '/',
  //   '/about': {
  //     en: '/about',
  //     el: '/sxetika'
  //   }
  // }
});

// This replaces createLocalizedPathnamesNavigation
export const { Link, redirect, useRouter, usePathname, getPathname } =
  createNavigation(routing);
