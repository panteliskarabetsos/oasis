// app/api/admin/accounts/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";

// ✅ Adjust this import to match your project:
// If you have authOptions exported from your NextAuth route:
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

function jsonError(message, status = 400, extra = {}) {
  return NextResponse.json({ ok: false, message, ...extra }, { status });
}

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "admin") return null;
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return jsonError("Unauthorized", 401);

  // 1) Find admin profiles
  const { data: adminProfiles, error: profErr } = await supabaseAdmin
    .from("profiles")
    .select("id, name, role, created_at")
    .eq("role", "admin")
    .order("created_at", { ascending: false });

  if (profErr)
    return jsonError(profErr.message || "Failed to fetch admins", 500);

  // 2) Get emails from Supabase Auth users (so you don't need profiles.email)
  const { data: usersPage, error: usersErr } =
    await supabaseAdmin.auth.admin.listUsers({
      // Some versions support pagination; this is fine for typical admin counts.
      perPage: 1000,
      page: 1,
    });

  if (usersErr)
    return jsonError(usersErr.message || "Failed to fetch users", 500);

  const emailById = new Map(
    (usersPage?.users || []).map((u) => [u.id, u.email || ""])
  );

  const admins = (adminProfiles || []).map((p) => ({
    id: p.id,
    name: p.name || "",
    role: p.role,
    created_at: p.created_at,
    email: emailById.get(p.id) || "",
  }));

  return NextResponse.json({ ok: true, admins });
}

export async function POST(req) {
  const session = await requireAdmin();
  if (!session) return jsonError("Unauthorized", 401);

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const name = String(body?.name || "").trim();
  const email = String(body?.email || "")
    .trim()
    .toLowerCase();
  const mode = body?.mode === "invite" ? "invite" : "password";
  const password = String(body?.password || "");

  if (!email) return jsonError("Email is required.");
  if (mode === "password" && password.length < 8) {
    return jsonError("Password must be at least 8 characters.");
  }

  try {
    let userId = null;
    let inviteLink = null;

    if (mode === "invite") {
      // Creates user + returns an invite link (requires Supabase email config)
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: "invite",
        email,
        options: {
          data: { name },
          // You can optionally set a redirect URL after accept:
          // redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/login`,
        },
      });

      if (error) return jsonError(error.message || "Invite failed.", 400);

      userId = data?.user?.id || null;
      inviteLink = data?.properties?.action_link || null;

      if (!userId)
        return jsonError("Invite created, but user id missing.", 500);
    } else {
      // Create user with password
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      });

      if (error) return jsonError(error.message || "Create user failed.", 400);

      userId = data?.user?.id || null;
      if (!userId) return jsonError("User created, but user id missing.", 500);
    }

    // Upsert profile role=admin
    const { error: upsertErr } = await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        name: name || null,
        role: "admin",
      },
      { onConflict: "id" }
    );

    if (upsertErr) {
      return jsonError(upsertErr.message || "Failed to update profile.", 500);
    }

    return NextResponse.json({
      ok: true,
      admin: { id: userId, email, name, role: "admin" },
      inviteLink,
    });
  } catch (e) {
    return jsonError(e?.message || "Something went wrong.", 500);
  }
}
