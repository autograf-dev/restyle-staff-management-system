import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function PUT(request: Request) {
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

    const body = await request.json();
    const { email, password, full_name, role } = body;

    if (!email || !full_name || !role) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Prepare update data
    const updateData: {
      email: string;
      password?: string;
      user_metadata: {
        full_name: string;
        role: string;
      };
    } = {
      email,
      user_metadata: { 
        full_name,
        role: role
      },
    };

    // Only update password if provided
    if (password && password.trim() !== "") {
      updateData.password = password;
    }

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, updateData);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ 
      ok: true, 
      user: data.user 
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to update user" },
      { status: 500 }
    );
  }
}
