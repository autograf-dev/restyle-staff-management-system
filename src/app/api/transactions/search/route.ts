import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

export async function GET(request: NextRequest) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY on server" },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q") || ""
    const staff = searchParams.get("staff") || ""
    const method = searchParams.get("method") || ""
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")

    if (!query.trim() && !staff.trim() && !method.trim()) {
      return NextResponse.json({
        ok: false,
        error: "At least one filter (query, staff, or method) is required"
      }, { status: 400 })
    }

    // Build search query - support both service search and staff filter
    let searchQuery = supabaseAdmin
      .from('Transactions')
      .select('*', { count: 'exact' })

    // Add filters based on what's provided (combine with AND)
    if (query.trim()) {
      searchQuery = searchQuery.ilike('"Service/Joined List"', `%${query}%`)
    }
    if (staff.trim()) {
      searchQuery = searchQuery.ilike('"Payment/Staff"', `%${staff}%`)
    }
    if (method.trim()) {
      searchQuery = searchQuery.ilike('"Payment/Method"', `%${method}%`)
    }

    searchQuery = searchQuery
      .range(offset, offset + limit - 1)
      .order('"Payment/Date"', { ascending: false, nullsFirst: false })
      .order('"🔒 Row ID"', { ascending: false })

    const { data, error, count } = await searchQuery

    if (error) {
      console.error('Supabase search error:', error)
      console.error('Search query:', query)
      console.error('Error details:', JSON.stringify(error, null, 2))
      return NextResponse.json({ ok: false, error: `Search failed: ${error.message}` }, { status: 400 })
    }

    // Get transaction IDs to fetch items
    const transactionIds = (data || []).map((row: Record<string, unknown>) => row['🔒 Row ID'])
    
    // Fetch transaction items for all transactions
    let itemsData: Record<string, unknown>[] = []
    if (transactionIds.length > 0) {
      const chunkSize = 400
      for (let i = 0; i < transactionIds.length; i += chunkSize) {
        const chunk = transactionIds.slice(i, i + chunkSize)
        const { data: items, error: itemsError } = await supabaseAdmin
          .from('Transaction Items')
          .select(`
            "🔒 Row ID",
            "Payment/ID",
            "Service/ID",
            "Service/Name",
            "Service/Price",
            "Staff/Name",
            "Staff/Tip Split",
            "Staff/Tip Collected"
          `)
          .in('"Payment/ID"', chunk)
          .order('"Payment/ID"', { ascending: true })
        if (itemsError) {
          console.error('Error fetching transaction items:', itemsError)
          break
        }
        if (items && items.length > 0) {
          itemsData = itemsData.concat(items)
        }
      }
    }

    // Group items by transaction ID
    const itemsByTransaction = itemsData.reduce((acc: Record<string, unknown[]>, item: Record<string, unknown>) => {
      const paymentId = String(item['Payment/ID'] || '')
      if (!acc[paymentId]) acc[paymentId] = []
      acc[paymentId].push({
        id: item['🔒 Row ID'],
        paymentId: item['Payment/ID'],
        serviceId: item['Service/ID'],
        serviceName: item['Service/Name'],
        price: item['Service/Price'],
        staffName: item['Staff/Name'],
        staffTipSplit: item['Staff/Tip Split'],
        staffTipCollected: item['Staff/Tip Collected'],
      })
      return acc
    }, {})

    // Transform the data to match the expected format (same as your main route)
    const transformedTransactions = (data || []).map((row: Record<string, unknown>) => ({
      id: row['🔒 Row ID'],
      paymentDate: row['Payment/Date'],
      method: row['Payment/Method'],
      subtotal: row['Payment/Subtotal'],
      tax: row['Transaction/Tax'],
      tip: row['Transaction/Tip'],
      totalPaid: row['Transaction/Total Paid'],
      services: row['Service/Joined List'],
      serviceIds: row['Service/Acuity IDs'],
      bookingId: row['Booking/ID'],
      staff: row['Payment/Staff'],
      customerPhone: row['Customer/Phone'],
      customerLookup: row['Customer/Lookup'],
      walkInCustomerId: row['Walk-In/Customer ID'],
      walkInPhone: row['Walk-In/Phone'],
      status: row['Payment/Status'],
      paymentStatus: row['Payment/Status'], 
      paid: row['Transaction/Paid'],
      items: itemsByTransaction[String(row['🔒 Row ID'] || '')] || [],
    }))

    return NextResponse.json({
      ok: true,
      data: transformedTransactions,
      total: count || 0,
      query: query
    })

  } catch (error) {
    console.error("Search API error:", error)
    return NextResponse.json({
      ok: false,
      error: "Internal server error"
    }, { status: 500 })
  }
}
