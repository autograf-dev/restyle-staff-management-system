import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY on server" },
      { status: 500 }
    );
  }

  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();
    
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ 
      ok: true, 
      users: data.users 
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
