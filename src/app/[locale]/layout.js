// src/app/[locale]/layout.js
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { notFound } from "next/navigation";
import Header from "../components/header";
import Footer from "../components/footer";
import PromoBannerGate from "../components/PromoBannerGate";

// Pre-generate /en, /el, etc.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }) {
  // In Next 15, params is a Promise
  const { locale } = await params;

  // Validate locale
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Tell next-intl which locale is active (for static generation)
  setRequestLocale(locale);

  // Load messages defined in src/i18n/request.js
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <Header />
      <PromoBannerGate />
      {children}
      <Footer />
    </NextIntlClientProvider>
  );
}
