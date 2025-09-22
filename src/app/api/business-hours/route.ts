import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('business_hours')
      .select('*')
      .order('day_of_week', { ascending: true });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, data });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Failed to fetch business hours" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, is_open, open_time, close_time } = body;

    console.log('API PUT received:', { id, is_open, open_time, close_time });

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Business hour ID is required" },
        { status: 400 }
      );
    }

    // Prepare update object - only include fields that are provided
    const updateData: Record<string, number | boolean | null | string> = {
      updated_at: new Date().toISOString()
    };

    // Handle is_open field
    if (is_open !== undefined) {
      updateData.is_open = is_open;
      // Only clear times when explicitly turning OFF (don't clear when turning ON)
      if (is_open === false) {
        updateData.open_time = null;
        updateData.close_time = null;
      }
    }

    // Handle time fields - always update if provided (regardless of is_open)
    if (open_time !== undefined && open_time !== null) {
      updateData.open_time = parseInt(open_time);
    }
    if (close_time !== undefined && close_time !== null) {
      updateData.close_time = parseInt(close_time);
    }

    console.log('Updating with data:', updateData);

    const { data, error } = await supabaseAdmin
      .from('business_hours')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    console.log('Updated data:', data);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { ok: false, error: "Failed to update business hours" },
      { status: 500 }
    );
  }
}
