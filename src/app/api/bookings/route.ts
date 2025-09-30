import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

// GET /api/bookings?page=1&pageSize=20&status=confirmed&search=ishita&group_id=xyz
export async function GET(req: NextRequest) {
  try {
    // Check if Supabase is configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Supabase environment variables are not configured')
      return NextResponse.json({ 
        error: "Supabase is not configured. Please check environment variables." 
      }, { status: 500 })
    }

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, Number(searchParams.get("page") || 1))
    const pageSize = Math.min(5000, Math.max(1, Number(searchParams.get("pageSize") || 20)))
    const appointmentStatus = searchParams.get("appointment_status") || undefined
    const search = searchParams.get("search")?.trim() || ""
    const assignedUserId = searchParams.get("assigned_user_id") || undefined
    const startDate = searchParams.get("startDate") || undefined
    const endDate = searchParams.get("endDate") || undefined
    const bookingId = searchParams.get("id") || undefined

    console.log('Fetching bookings with params:', { page, pageSize, appointmentStatus, search, assignedUserId, startDate, endDate, bookingId })

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabaseAdmin
      .from("restyle_bookings")
      .select("*", { count: "exact" })

    // If searching for a specific booking ID, filter by it first
    if (bookingId) {
      query = query.eq("id", bookingId)
    }

    // Apply date range filtering
    if (startDate && endDate) {
      query = query
        .gte("start_time", startDate)
        .lte("start_time", endDate)
    } else if (startDate) {
      query = query.gte("start_time", startDate)
    } else if (endDate) {
      query = query.lte("start_time", endDate)
    }

    if (appointmentStatus) {
      query = query.eq("appointment_status", appointmentStatus)
    }

    if (assignedUserId) {
      query = query.eq("assigned_user_id", assignedUserId)
    }

    // Note: group_id column doesn't exist in restyle_bookings table
    // Filtering by group would need to join with services/calendars table
    // For now, we'll skip group filtering at the database level
    // if (groupId) {
    //   query = query.eq("group_id", groupId)
    // }

    if (search) {
      // Search across common text fields
      query = query.or(
        [
          `title.ilike.%${search}%`,
          `service_name.ilike.%${search}%`,
          `customer_name_.ilike.%${search}%`,
          `assigned_barber_name.ilike.%${search}%`,
        ].join(",")
      )
    }

    // Order by start_time when date filtering is used, otherwise by id for general queries
    if (startDate || endDate) {
      query = query.order("start_time", { ascending: false })
    } else {
      query = query.order("id", { ascending: false })
    }

    const { data, error, count } = await query.range(from, to)
    if (error) {
      console.error('Supabase query error:', error)
      return NextResponse.json({ error: error.message, details: error }, { status: 500 })
    }

    console.log(`Found ${count} bookings, returning ${data?.length || 0} results for page ${page}`)

    // Map to the Booking shape used on the frontend where possible
    const bookings = (data || []).map((row: Record<string, unknown>) => ({
      id: String(row.id ?? ""),
      calendar_id: String(row.calendar_id ?? ""),
      contact_id: String(row.contact_id ?? ""),
      title: row.title ?? "",
      status: row.status ?? "",
      appointment_status: row.appointment_status ?? "",
      assigned_user_id: String(row.assigned_user_id ?? ""),
      address: row.address ?? "",
      is_recurring: Boolean(row.is_recurring ?? false),
      trace_id: row.trace_id ?? "",
      // Enriched fields that now exist in the table
      serviceName: (row.service_name as string) ?? (row.title as string) ?? "",
      assignedStaffFirstName: (String(row.assigned_barber_name || "")).split(/\s+/)[0] || undefined,
      assignedStaffLastName: ((String(row.assigned_barber_name || "")).split(/\s+/).slice(1).join(" ")) || undefined,
      contactName: (row.customer_name_ as string) ?? undefined,
      createdAt: undefined, // not present; frontend sorts by startTime fallback
      // Optional extras provided by your schema
      startTime: row.start_time ?? undefined,
      endTime: row.end_time ?? undefined,
      // duration and price if present in numeric/string
      durationMinutes: row.booking_duration ? Number(row.booking_duration) : undefined,
      price: row.booking_price ? Number(row.booking_price) : undefined,
    }))

    return NextResponse.json({
      bookings,
      total: count ?? bookings.length,
      page,
      pageSize,
      totalPages: count ? Math.max(1, Math.ceil(count / pageSize)) : 1,
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

// PATCH /api/bookings - Update booking status and payment details
export async function PATCH(req: NextRequest) {
  try {
    // Check if Supabase is configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Supabase environment variables are not configured')
      return NextResponse.json({ 
        error: "Supabase is not configured. Please check environment variables." 
      }, { status: 500 })
    }

    const body = await req.json()
    const { id, status, booking_price, tax_amount, tip_amount, total_paid, payment_method, payment_date } = body

    if (!id) {
      return NextResponse.json({ error: "Booking ID is required" }, { status: 400 })
    }

    console.log('Updating booking status:', { id, status, booking_price, tax_amount, tip_amount, total_paid, payment_method })

    // Prepare update data - only include fields that are provided
    const updateData: Record<string, unknown> = {}
    
    if (status !== undefined) updateData.status = status
    if (booking_price !== undefined) updateData.booking_price = booking_price
    if (tax_amount !== undefined) updateData.tax_amount = tax_amount
    if (tip_amount !== undefined) updateData.tip_amount = tip_amount
    if (total_paid !== undefined) updateData.total_paid = total_paid
    if (payment_method !== undefined) updateData.payment_method = payment_method
    if (payment_date !== undefined) updateData.payment_date = payment_date

    const { data, error } = await supabaseAdmin
      .from("restyle_bookings")
      .update(updateData)
      .eq("id", id)
      .select()

    if (error) {
      console.error('Supabase update error:', error)
      return NextResponse.json({ error: error.message, details: error }, { status: 500 })
    }

    console.log('✅ Booking updated successfully:', data)

    return NextResponse.json({ 
      success: true, 
      booking: data?.[0] || null,
      message: `Booking ${id} updated successfully`
    })

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error"
    console.error('Error updating booking:', errorMessage)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}


