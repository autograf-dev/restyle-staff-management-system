import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

// POST /api/bookings/create - Create a booking directly in Supabase (service role)
export async function POST(req: NextRequest) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Supabase environment variables are not configured')
      return NextResponse.json({ 
        error: "Supabase is not configured. Please check environment variables." 
      }, { status: 500 })
    }

    const body = await req.json()
    const {
      // optional caller-specified id (rare). If not provided, we'll generate one.
      id,
      // required for calendar visibility
      start_time,
      end_time,
      booking_duration,
      // descriptive fields
      title,
      service_name,
      booking_price,
      customer_name_,
      assigned_barber_name,
      // statuses
      payment_status = 'paid',
      appointment_status = 'confirmed',
      // optional identifiers
      contact_id,
      assigned_user_id,
      calendar_id,
      // walk-in marker
      is_walk_in,
    } = body || {}

    const durationNumber = typeof booking_duration === 'number' ? booking_duration : Number(booking_duration)
    if (!start_time || !end_time || !Number.isFinite(durationNumber)) {
      return NextResponse.json({ 
        error: "start_time, end_time and booking_duration are required" 
      }, { status: 400 })
    }

    // Generate a 20-char base62 ID (A-Za-z0-9) to match existing booking id style
    const genId = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
      let out = ''
      for (let i = 0; i < 20; i++) {
        const idx = Math.floor(Math.random() * chars.length)
        out += chars[idx]
      }
      return out
    }
    const finalId = (typeof id === 'string' && id.trim().length > 0) ? id : genId()

    // Resolve contact id: use provided, else env, else last-resort fallback (to avoid NOT NULL errors on guest walk-ins)
    const envGuestId = process.env.GUEST_CONTACT_ID || process.env.NEXT_PUBLIC_GUEST_CONTACT_ID
    const finalContactId = (typeof contact_id === 'string' && contact_id.trim().length > 0)
      ? contact_id
      : (envGuestId && envGuestId.trim().length > 0 ? envGuestId.trim() : 'OER8NNUr22uURWHAFFsW')

    const insertData: Record<string, unknown> = {
      id: finalId,
      apptId: finalId,
      contact_id: finalContactId,
      start_time,
      end_time,
      booking_duration: durationNumber,
      // include title if provided, otherwise set a sensible default
      title: (title ?? null) || 'Walk-in',
      service_name: service_name ?? null,
      booking_price: booking_price ?? null,
      customer_name_: customer_name_ ?? null,
      assigned_barber_name: assigned_barber_name ?? null,
      // keep consistent with existing data
      status: 'booked',
      payment_status,
      appointment_status,
      is_walk_in: Boolean(is_walk_in) || false,
    }

    if (contact_id !== undefined) insertData.contact_id = contact_id
    if (assigned_user_id !== undefined) insertData.assigned_user_id = assigned_user_id
    if (calendar_id !== undefined) insertData.calendar_id = calendar_id

    const { data, error } = await supabaseAdmin
      .from("restyle_bookings")
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('❌ Supabase insert error:', error)
      return NextResponse.json({ error: error.message, details: error }, { status: 500 })
    }

    return NextResponse.json({ success: true, booking: data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('❌ Error creating booking:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
