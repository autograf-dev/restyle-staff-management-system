import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY on server" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { email, password, full_name, role } = body;

    if (!email || !password || !full_name || !role) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { 
        full_name,
        role: role
      },
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ 
      ok: true, 
      user: data.user 
    });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to create user" },
      { status: 500 }
    );
  }
}
