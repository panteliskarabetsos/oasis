// app/admin/layout.js
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import AdminHeader from "@/app/admin/components/header";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin • Oasis",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }) {
  const supa = await createSupabaseServer();
  const {
    data: { user },
  } = await supa.auth.getUser();

  if (!user) redirect("/");

  const { data: row } = await supa
    .from("User")
    .select("role,name,surname,email")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const role = row?.role ?? "user";
  if (role !== "admin") redirect("/");

  const displayName =
    row?.name || row?.surname
      ? [row?.name, row?.surname].filter(Boolean).join(" ")
      : row?.email || user.email;

  return (
    <div className="min-h-screen bg-[#f4f1ec] relative">
      <div className="pointer-events-none absolute -top-40 -left-24 h-[28rem] w-[28rem] rounded-full bg-[#e9e4dc] blur-3xl opacity-70" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-[32rem] w-[32rem] rounded-full bg-[#fff4e1] blur-3xl opacity-80" />

      <a
        href="#admin-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 rounded bg-white px-3 py-2 text-sm text-[#5a4a3f] shadow"
      >
        Skip to content
      </a>

      <AdminHeader displayName={displayName} />

      <main id="admin-content" className="relative mx-auto px-6 py-6 max-w-7xl">
        {children}
      </main>
    </div>
  );
}
