import { createSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// -----------------------------------------------------------------------------
// GET: Fetch all favorites for the logged-in user
// -----------------------------------------------------------------------------
export async function GET(request) {
  const supabase = await createSupabaseServer();

  if (!supabase) {
    return NextResponse.json({ error: "Server config error" }, { status: 500 });
  }

  // 1. Auth Check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 2. Get Public User ID
    const { data: publicUser } = await supabase
      .from("User")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (!publicUser) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // 3. Fetch Favorites with Experience details
    const { data: favorites, error: fetchError } = await supabase
      .from("UserFavorite")
      .select(
        `
        id,
        created_at,
        Experience (
          id,
          name,
          slug,
          location,
          priceAdult,
          images
        )
      `
      )
      .eq("user_id", publicUser.id)
      .order("created_at", { ascending: false });

    if (fetchError) throw fetchError;

    return NextResponse.json({ data: favorites });
  } catch (error) {
    console.error("GET Favorites Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// POST: Toggle (Add or Remove) a favorite
// -----------------------------------------------------------------------------
export async function POST(request) {
  const supabase = await createSupabaseServer();

  if (!supabase) {
    return NextResponse.json({ error: "Server config error" }, { status: 500 });
  }

  // 1. Auth Check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { experienceId } = await request.json();

    if (!experienceId) {
      return NextResponse.json(
        { error: "Experience ID required" },
        { status: 400 }
      );
    }

    // 2. Get Public User ID
    const { data: publicUser } = await supabase
      .from("User")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (!publicUser) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // 3. Check if it already exists
    const { data: existing } = await supabase
      .from("UserFavorite")
      .select("id")
      .eq("user_id", publicUser.id)
      .eq("experience_id", experienceId)
      .single();

    let isFavorite = false;
    let action = "";

    if (existing) {
      // 4a. DELETE (Unlike)
      const { error: deleteError } = await supabase
        .from("UserFavorite")
        .delete()
        .eq("id", existing.id);

      if (deleteError) throw deleteError;

      isFavorite = false;
      action = "removed";
    } else {
      // 4b. INSERT (Like)
      const { error: insertError } = await supabase
        .from("UserFavorite")
        .insert({
          user_id: publicUser.id,
          experience_id: experienceId,
        });

      if (insertError) throw insertError;

      isFavorite = true;
      action = "added";
    }

    return NextResponse.json({ success: true, isFavorite, action });
  } catch (error) {
    console.error("POST Favorites Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
