import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, full_name, ghl_id, role = "barber", password: providedPassword } = body as { email: string; full_name: string; ghl_id: string; role?: "barber" | "manager"; password?: string }

    if (!email || !full_name || !ghl_id) {
      return NextResponse.json({ ok: false, error: "email, full_name and ghl_id are required" }, { status: 400 })
    }

    const password = providedPassword && providedPassword.length >= 8 ? providedPassword : (Math.random().toString(36).slice(-10) + "@A1")

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role, ghl_id },
    })

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, data, tempPassword: providedPassword ? undefined : password })
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Failed to create user" }, { status: 500 })
  }
}


