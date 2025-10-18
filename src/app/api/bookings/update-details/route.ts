import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

// POST /api/bookings/update-details - Update booking details after creation
// This is needed because the Apointment endpoint creates records with null fields
export async function POST(req: NextRequest) {
  try {
    // Check if Supabase is configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Supabase environment variables are not configured')
      return NextResponse.json({ 
        error: "Supabase is not configured. Please check environment variables." 
      }, { status: 500 })
    }

    const body = await req.json()
    const { 
      id, 
      start_time, 
      end_time, 
      booking_duration, 
      service_name, 
      booking_price, 
      customer_name_, 
      assigned_barber_name, 
      payment_status 
    } = body

    if (!id) {
      return NextResponse.json({ error: "Booking ID is required" }, { status: 400 })
    }

    console.log('🔧 Updating booking details for ID:', id)
    console.log('📊 Update data:', {
      start_time,
      end_time,
      booking_duration,
      service_name,
      booking_price,
      customer_name_,
      assigned_barber_name,
      payment_status
    })

    // Prepare update data - only include fields that are provided
    const updateData: Record<string, unknown> = {}
    
    if (start_time !== undefined) updateData.start_time = start_time
    if (end_time !== undefined) updateData.end_time = end_time
    if (booking_duration !== undefined) updateData.booking_duration = booking_duration
    if (service_name !== undefined) updateData.service_name = service_name
    if (booking_price !== undefined) updateData.booking_price = booking_price
    if (customer_name_ !== undefined) updateData.customer_name_ = customer_name_
    if (assigned_barber_name !== undefined) updateData.assigned_barber_name = assigned_barber_name
    if (payment_status !== undefined) updateData.payment_status = payment_status

    console.log('🔄 Sending update to Supabase with service role key...')

    const { data, error } = await supabaseAdmin
      .from("restyle_bookings")
      .update(updateData)
      .eq("id", id)
      .select()

    if (error) {
      console.error('❌ Supabase update error:', error)
      return NextResponse.json({ 
        error: error.message, 
        details: error 
      }, { status: 500 })
    }

    console.log('✅ Booking details updated successfully:', data)

    return NextResponse.json({ 
      success: true, 
      booking: data?.[0] || null,
      message: `Booking details updated successfully`
    })

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error"
    console.error('❌ Error updating booking details:', errorMessage)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
