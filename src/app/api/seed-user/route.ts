import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY on server" },
      { status: 500 }
    );
  }

  const users = [
    {
      email: "admin@restyle.com",
      password: "adminrestyle@",
      full_name: "Admin User",
      role: "admin"
    },
    {
      email: "barber@restyle.com", 
      password: "barber@secret",
      full_name: "Barber User",
      role: "barber"
    }
  ];

  const results = [];

  for (const user of users) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { 
        full_name: user.full_name,
        role: user.role
      },
    });

    if (error) {
      results.push({ email: user.email, error: error.message });
    } else {
      results.push({ email: user.email, success: true, data });
    }
  }

  return NextResponse.json({ 
    ok: true, 
    message: "Users created successfully",
    results 
  });
}


