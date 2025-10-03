import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

export async function POST(req: Request) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY on server" },
        { status: 500 }
      )
    }

    const body = await req.json()
    const { transaction, items } = body as {
      transaction: Record<string, unknown>
      items: Record<string, unknown>[]
    }

    if (!transaction || !Array.isArray(items)) {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 })
    }

    // Insert into "Transactions" - Remove concatenated service/staff fields, use only Transaction Items
    const txRow = {
      "🔒 Row ID": transaction.id,
      "Booking/ID": transaction.bookingId ?? null,
      "Booking/Service Lookup": transaction.bookingServiceLookup ?? null,
      "Booking/Booked Rate": transaction.bookingBookedRate ?? null,
      "Booking/Customer Phone": transaction.bookingCustomerPhone ?? null,
      "Booking/Type": transaction.bookingType ?? null,
      "Customer/Phone": transaction.customerPhone ?? null,
      "Customer/Lookup": transaction.customerLookup ?? null,
      "Payment/Date": transaction.paymentDate ?? null,
      "Payment/Method": transaction.method ?? null,
      "Payment/Sort": transaction.paymentSort ?? null,
      "Payment/Staff": transaction.paymentStaff ?? null,
      "Payment/Subtotal": transaction.subtotal ?? null,
      "Payment/Status": transaction.status ?? "Paid",
      "Transaction/Services": transaction.transactionServices ?? transaction.subtotal ?? null,
      "Transaction/Services Total": transaction.transactionServicesTotal ?? transaction.subtotal ?? null,
      "Transaction/Tax": transaction.tax ?? null,
      "Transaction/Total Paid": transaction.totalPaid ?? null,
      "Service/Joined List": transaction.serviceNamesJoined ?? null,
      // Store concatenated service IDs for the transaction (from payload)
      "Service/Acuity IDs": transaction.serviceAcuityIds ?? null,
      "DNU Service/Name": null,
      "DNU Service/Subtotal": null,
      "DNU Service/Total": null,
      "Summary/DD": null,
      "Summary/Year": null,
      "Summary/Month": null,
      "Summary/Week": null,
      "Summary/Date": null,
      "Summary/Range": null,
      "Summary/All": null,
      "Summary/MM": null,
      "Summary/YY": null,
      "Summary/Month ID": null,
      "Summary/Staff List": null,
      "Transaction/Tip": transaction.tip ?? null,
      "DNU Service/Tip Split": null,
      "DNU Add-On/Subtotal": null,
      "DNU Add-On/Total": null,
      "DNU Add-On/Tip Split": null,
      "DNU Add-On/Staff": null,
      "Walk-In/Customer ID": transaction.walkInCustomerId ?? null,
      "Walk-In/Phone": transaction.walkInPhone ?? null,
      "DNU Service/Discount": null,
      "DNU Add-On/Discount": null,
      "Transaction/Product": null,
      "DNU Add-On/IDs": null,
      "DNU Transaction/Tax": null,
      "DNU Transaction/Tip": null,
      "Transaction/Services New": null,
      "Transaction/Paid": transaction.transactionPaid ?? "Yes",
      "Transaction/Reward": null,
    }

    const { error: txError } = await supabaseAdmin
      .from("Transactions")
      .insert([txRow])

    if (txError) {
      return NextResponse.json({ ok: false, error: txError.message }, { status: 400 })
    }

    // Insert into "Transaction Items"
    const itemRows = items.map((it: Record<string, unknown>) => ({
      "🔒 Row ID": it.id,
      "Payment/ID": it.paymentId,
      "VALUES JOINED 2": it.valuesJoined2 ?? null,
      "STATUS JOINED": it.statusJoined ?? null,
      "Staff/Name": it.staffName ?? null,
      "Staff/Tip Split": it.staffTipSplit ?? null,
      "Staff/Tip Collected": it.staffTipCollected ?? null,
      "Service/ID": it.serviceId ?? null,
      "Service/Name": it.serviceName ?? null,
      "Service/Price": it.price ?? null,
    }))

    if (itemRows.length > 0) {
      const { error: itemError } = await supabaseAdmin
        .from("Transaction Items")
        .insert(itemRows)
      if (itemError) {
        return NextResponse.json({ ok: false, error: itemError.message }, { status: 400 })
      }
    }

    return NextResponse.json({ ok: true, id: transaction.id })
  } catch (error: unknown) {
    console.error("/api/transactions error", error)
    return NextResponse.json({ ok: false, error: "Failed to create transaction" }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY on server" },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(req.url)
    const limit = Number(searchParams.get('limit') || 50)
    const offset = Number(searchParams.get('offset') || 0)
    const appointmentId = searchParams.get('appointmentId')

    let query = supabaseAdmin
      .from('Transactions')
      .select('*')
      .range(offset, offset + limit - 1)
      .order('"Payment/Date"', { ascending: false })
    
    // Filter by appointment ID if provided
    if (appointmentId) {
      query = query.eq('"Booking/ID"', appointmentId)
    }

    const { data, error } = await query

    if (appointmentId && data) {
      // Optional: log transaction count for debugging
    }

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    }

    // Get transaction IDs to fetch items
    const transactionIds = (data || []).map((row: Record<string, unknown>) => row['🔒 Row ID'])
    
    // Fetch transaction items for all transactions
    let itemsData: Record<string, unknown>[] = []
    if (transactionIds.length > 0) {
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
        .in('Payment/ID', transactionIds)
      
      if (itemsError) {
        console.error('Error fetching transaction items:', itemsError)
      } else {
        itemsData = items || []
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

    const rows = (data || []).map((row: Record<string, unknown>) => ({
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
      // Add payment status fields without breaking existing structure
      status: row['Payment/Status'],
      paymentStatus: row['Payment/Status'], 
      paid: row['Transaction/Paid'],
      items: itemsByTransaction[String(row['🔒 Row ID'] || '')] || [],
    }))

    return NextResponse.json({ ok: true, data: rows })
  } catch (e: unknown) {
    console.error('Error fetching transactions:', e)
    return NextResponse.json({ ok: false, error: 'Failed to fetch transactions' }, { status: 500 })
  }
}

export const DELETE = async (req: Request): Promise<NextResponse> => {
  console.log('DELETE endpoint called at:', new Date().toISOString())
  
  // Environment validation with detailed logging
  console.log('Environment check:')
  console.log('- NEXT_PUBLIC_SUPABASE_URL exists:', !!process.env.NEXT_PUBLIC_SUPABASE_URL)
  console.log('- SUPABASE_SERVICE_ROLE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing required environment variables')
    return NextResponse.json(
      { ok: false, error: 'Server configuration error' },
      { status: 500 }
    )
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    console.log('Transaction ID to delete:', id)
    console.log('Request URL:', req.url)

    if (!id) {
      console.log('No transaction ID provided')
      return NextResponse.json(
        { ok: false, error: 'Transaction ID is required' },
        { status: 400 }
      )
    }

    // First check if transaction exists
    console.log('Checking if transaction exists...')
    const { data: existingTransaction, error: checkError } = await supabaseAdmin
      .from('Transactions')
      .select('"🔒 Row ID"')
      .eq('"🔒 Row ID"', id)
      .single()

    if (checkError) {
      console.error('Error checking transaction existence:', checkError)
      return NextResponse.json(
        { ok: false, error: `Transaction not found: ${checkError.message}` },
        { status: 404 }
      )
    }

    console.log('Transaction exists:', existingTransaction)

    console.log('Deleting transaction items first...')
    // First delete transaction items - they reference the transaction by "Payment/ID"
    const { data: deletedItems, error: itemsError } = await supabaseAdmin
      .from('Transaction Items')
      .delete()
      .eq('"Payment/ID"', id)
      .select()

    if (itemsError) {
      console.error('Error deleting transaction items:', itemsError)
      return NextResponse.json(
        { ok: false, error: `Failed to delete transaction items: ${itemsError.message}` },
        { status: 500 }
      )
    }

    console.log('Transaction items deleted:', deletedItems)

    console.log('Now deleting main transaction...')
    // Then delete the main transaction
    const { data: deletedTransaction, error: transactionError } = await supabaseAdmin
      .from('Transactions')
      .delete()
      .eq('"🔒 Row ID"', id)
      .select()

    if (transactionError) {
      console.error('Error deleting transaction:', transactionError)
      return NextResponse.json(
        { ok: false, error: `Failed to delete transaction: ${transactionError.message}` },
        { status: 500 }
      )
    }

    console.log('Transaction deleted successfully:', deletedTransaction)
    return NextResponse.json({ 
      ok: true, 
      message: 'Transaction deleted successfully',
      deletedItems: deletedItems?.length || 0,
      deletedTransaction: deletedTransaction?.length || 0
    })

  } catch (error) {
    console.error('Unexpected error in DELETE endpoint:', error)
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}


