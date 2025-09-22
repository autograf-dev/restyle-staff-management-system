import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function DELETE(request: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY on server" },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("id");

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "User ID is required" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ 
      ok: true, 
      message: "User deleted successfully" 
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to delete user" },
      { status: 500 }
    );
  }
}
