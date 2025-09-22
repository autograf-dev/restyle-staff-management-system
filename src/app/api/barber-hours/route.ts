import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    console.log('Fetching barber hours...');
    
    const { data, error } = await supabaseAdmin
      .from('barber_hours')
      .select('*')
      .order('"Barber/Name"', { ascending: true });

    console.log('Supabase response:', { data, error });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch barber hours" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updateData }: { id: string } & Record<string, unknown> = body;

    console.log('API PUT received:', { id, updateData });

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Barber ID is required" },
        { status: 400 }
      );
    }

    // Convert time values to integers and handle 0/null for off days
    const processedData: Record<string, string | number | boolean | null> = {};
    
    Object.keys(updateData).forEach(key => {
      const value = updateData[key as keyof typeof updateData];
      
      // Handle time fields (Start Value, End Value, Lunch times)
      if (key.includes('/Start Value') || key.includes('/End Value') || 
          key.includes('Lunch/Start') || key.includes('Lunch/End')) {
        // If value is 0 or null, keep as is (day off)
        if (value === 0 || value === null || value === undefined) {
          processedData[key] = value === 0 ? '0' : null;
        } else {
          const num = parseInt(String(value));
          processedData[key] = String(Number.isFinite(num) ? num : 0);
        }
      } else {
        processedData[key] = (value as string | number | boolean | null) ?? null;
      }
    });

    console.log('Processed update data:', processedData);

    // Use quoted column name to handle special characters
    const { data, error } = await supabaseAdmin
      .from('barber_hours')
      .update(processedData)
      .eq('"🔒 Row ID"', id)
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    console.log('Updated barber data:', data);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { ok: false, error: "Failed to update barber hours" },
      { status: 500 }
    );
  }
}
