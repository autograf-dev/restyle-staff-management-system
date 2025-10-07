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

    interface SplitPayment { method: string; amount: number; percentage?: number }
    interface ServiceSplit { serviceId: string; paymentMethod: string }
    interface TransactionPayload {
      id: string
      paymentDate?: string
      method?: string
      bookingId?: string | null
      bookingServiceLookup?: string | null
      bookingBookedRate?: number | null
      bookingCustomerPhone?: string | null
      bookingType?: string | null
      customerPhone?: string | null
      customerLookup?: string | null
      paymentSort?: number | null
      paymentStaff?: string | null
      status?: string | null
      transactionServices?: number | null
      transactionServicesTotal?: number | null
      tax?: number
      subtotal?: number
      tip?: number
      totalPaid?: number
      serviceNamesJoined?: string | null
      serviceAcuityIds?: string | null
      walkInCustomerId?: string | null
      walkInPhone?: string | null
      transactionPaid?: string | null
      // Guest checkout fields
      guestCustomerName?: string | null
      guestCustomerPhone?: string | null
      isGuestCheckout?: boolean
      // split fields
      isSplitPayment?: boolean
      isServiceSplit?: boolean
      splitPayments?: SplitPayment[]
      serviceSplits?: ServiceSplit[]
    }

    interface ItemPayload {
      id: string
      paymentId?: string
      valuesJoined2?: string | null
      statusJoined?: string | null
      staffName?: string | null
      staffTipSplit?: number | null
      staffTipCollected?: number | null
      serviceId?: string | null
      serviceName?: string | null
      price?: number | null
    }

    const body = await req.json() as { transaction: TransactionPayload; items: ItemPayload[] }
    const { transaction, items } = body

    if (!transaction || !Array.isArray(items)) {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 })
    }

    // Helper: safe number and rounding
    const toNumber = (v: unknown, d = 0) => {
      const n = Number(v)
      return Number.isFinite(n) ? n : d
    }
    const round2 = (n: number) => Math.round(n * 100) / 100

    // Extract split flags from transaction payload (UI embeds these inside transaction)
    const isSplitPayment: boolean = Boolean(transaction.isSplitPayment)
    const isServiceSplit: boolean = Boolean(transaction.isServiceSplit)
    const splitPayments: SplitPayment[] = Array.isArray(transaction.splitPayments)
      ? transaction.splitPayments.map((p) => ({
          method: String(p.method || '').toLowerCase(),
          amount: toNumber(p.amount, 0),
          percentage: toNumber(p.percentage, 0)
        }))
      : []
    const serviceSplits: ServiceSplit[] = Array.isArray(transaction.serviceSplits)
      ? transaction.serviceSplits.map((s) => ({
          serviceId: String(s.serviceId || ''),
          paymentMethod: String(s.paymentMethod || '').toLowerCase()
        }))
      : []

    const originalId: string = String(transaction.id)
    const paymentDate = transaction.paymentDate ?? new Date().toISOString()
    const subtotal = toNumber(transaction.subtotal)
    const tax = toNumber(transaction.tax)
    const tip = toNumber(transaction.tip)
    const totalPaid = toNumber(transaction.totalPaid)

    // Function to map a transaction payload to Supabase row
    const buildTxRow = (id: string, method: string, alloc: { subtotal: number; tax: number; tip: number; totalPaid: number }, sortIndex: number) => ({
      "🔒 Row ID": id,
      "Booking/ID": transaction.bookingId ?? null,
      "Booking/Service Lookup": transaction.bookingServiceLookup ?? null,
      "Booking/Booked Rate": transaction.bookingBookedRate ?? null,
      "Booking/Customer Phone": transaction.bookingCustomerPhone ?? null,
      "Booking/Type": transaction.bookingType ?? null,
      "Customer/Phone": transaction.customerPhone ?? null,
      "Customer/Lookup": transaction.customerLookup ?? null,
      "Payment/Date": paymentDate,
      "Payment/Method": method || null,
      "Payment/Sort": sortIndex || null,
      "Payment/Staff": transaction.paymentStaff ?? null,
      "Payment/Subtotal": alloc.subtotal,
      "Payment/Status": transaction.status ?? "Paid",
      "Transaction/Services": transaction.transactionServices ?? transaction.subtotal ?? null,
      "Transaction/Services Total": transaction.transactionServicesTotal ?? transaction.subtotal ?? null,
      "Transaction/Tax": alloc.tax,
      "Transaction/Total Paid": alloc.totalPaid,
      "Service/Joined List": transaction.serviceNamesJoined ?? null,
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
      "Transaction/Tip": alloc.tip,
      "DNU Service/Tip Split": null,
      "DNU Add-On/Subtotal": null,
      "DNU Add-On/Total": null,
      "DNU Add-On/Tip Split": null,
      "DNU Add-On/Staff": null,
      "Walk-In/Customer ID": transaction.isGuestCheckout ? transaction.guestCustomerName : transaction.walkInCustomerId ?? null,
      "Walk-In/Phone": transaction.isGuestCheckout ? transaction.guestCustomerPhone : transaction.walkInPhone ?? null,
      "DNU Service/Discount": null,
      "DNU Add-On/Discount": null,
      "Transaction/Product": null,
      "DNU Add-On/IDs": null,
      "DNU Transaction/Tax": null,
      "DNU Transaction/Tip": null,
      "Transaction/Services New": null,
      "Transaction/Paid": transaction.transactionPaid ?? "Yes",
      "Transaction/Reward": null,
    })

    // Helper to insert items
    type TransactionItemRow = {
      "🔒 Row ID": string | null
      "Payment/ID": string | null
      "VALUES JOINED 2": string | null
      "STATUS JOINED": string | null
      "Staff/Name": string | null
      "Staff/Tip Split": number | null
      "Staff/Tip Collected": number | null
      "Service/ID": string | null
      "Service/Name": string | null
      "Service/Price": number | null
    }
    const insertItems = async (rows: TransactionItemRow[]) => {
      if (rows.length === 0) return null
      const { error } = await supabaseAdmin
        .from("Transaction Items")
        .insert(rows)
      return error
    }

    // Branch 1: Split by payment amounts (same items; multiple transactions)
    if (isSplitPayment && splitPayments.length >= 2 && totalPaid > 0) {
      const sumSplit = round2(splitPayments.reduce((s, p) => s + toNumber(p.amount, 0), 0))
      if (Math.abs(sumSplit - round2(totalPaid)) > 0.05) {
        return NextResponse.json({ ok: false, error: "Split amounts do not equal total" }, { status: 400 })
      }

      // Compute proportional allocations and fix rounding on the last entry
      const remaining = { subtotal, tax, tip, totalPaid }
      const txRows: ReturnType<typeof buildTxRow>[] = []
      const childIds: string[] = []
      splitPayments.forEach((sp, idx) => {
        const id = idx === 0 ? originalId : `${originalId}-${idx + 1}`
        childIds.push(id)
        const isLast = idx === splitPayments.length - 1
        if (!isLast) {
          const ratio = sp.amount / totalPaid
          const alloc = {
            subtotal: round2(subtotal * ratio),
            tax: round2(tax * ratio),
            tip: round2(tip * ratio),
            totalPaid: round2(sp.amount)
          }
          remaining.subtotal = round2(remaining.subtotal - alloc.subtotal)
          remaining.tax = round2(remaining.tax - alloc.tax)
          remaining.tip = round2(remaining.tip - alloc.tip)
          remaining.totalPaid = round2(remaining.totalPaid - alloc.totalPaid)
          txRows.push(buildTxRow(id, sp.method, alloc, idx + 1))
        } else {
          // Assign all remainder to last split to ensure sums match exactly
          const alloc = { ...remaining }
          txRows.push(buildTxRow(id, sp.method, alloc, idx + 1))
        }
      })

      const { error: splitTxError } = await supabaseAdmin
        .from("Transactions")
        .insert(txRows)
      if (splitTxError) {
        return NextResponse.json({ ok: false, error: splitTxError.message }, { status: 400 })
      }

      // Attach items ONLY to the first transaction to avoid double counting
      const firstId = childIds[0]
      const itemRows: TransactionItemRow[] = items.map((it) => ({
        "🔒 Row ID": it.id || null,
        "Payment/ID": firstId || null,
        "VALUES JOINED 2": it.valuesJoined2 ?? null,
        "STATUS JOINED": it.statusJoined ?? null,
        "Staff/Name": it.staffName ?? null,
        "Staff/Tip Split": (it.staffTipSplit as number | null) ?? null,
        "Staff/Tip Collected": (it.staffTipCollected as number | null) ?? null,
        "Service/ID": (it.serviceId as string | null) ?? null,
        "Service/Name": it.serviceName ?? null,
        "Service/Price": (it.price as number | null) ?? null,
      }))
      const itemErr = await insertItems(itemRows)
      if (itemErr) {
        return NextResponse.json({ ok: false, error: itemErr.message }, { status: 400 })
      }

      return NextResponse.json({ ok: true, id: firstId, splits: childIds })
    }

    // Branch 2: Service-based split (items partitioned by payment method)
    if (isServiceSplit && serviceSplits.length > 0) {
      const serviceToMethod = new Map<string, string>()
      serviceSplits.forEach(s => {
        if (s.serviceId) serviceToMethod.set(String(s.serviceId), s.paymentMethod)
      })

      // Group items by method via serviceId mapping
      const methodToItems = new Map<string, ItemPayload[]>()
      items.forEach((it) => {
        const method = serviceToMethod.get(String(it.serviceId || '')) || String(transaction.method || '').toLowerCase()
        if (!methodToItems.has(method)) methodToItems.set(method, [])
        methodToItems.get(method)!.push(it)
      })

      const methods = Array.from(methodToItems.keys())
      if (methods.length === 0) {
        // Fallback to single insert
        methods.push(String(transaction.method || 'other'))
        methodToItems.set(methods[0], items)
      }

      // Allocate totals proportionally by items price sum per method
      const priceTotals = methods.map(m => methodToItems.get(m)!.reduce((s, it) => s + toNumber(it.price, 0), 0))
      const totalPrice = priceTotals.reduce((a, b) => a + b, 0) || 1

      const remaining = { subtotal, tax, tip, totalPaid }
      const txRows: ReturnType<typeof buildTxRow>[] = []
      const childIds: string[] = []

      methods.forEach((m, idx) => {
        const id = idx === 0 ? originalId : `${originalId}-${idx + 1}`
        childIds.push(id)
        const isLast = idx === methods.length - 1
        if (!isLast) {
          const ratio = priceTotals[idx] / totalPrice
          const alloc = {
            subtotal: round2(subtotal * ratio),
            tax: round2(tax * ratio),
            tip: round2(tip * ratio),
            totalPaid: round2(totalPaid * ratio)
          }
          remaining.subtotal = round2(remaining.subtotal - alloc.subtotal)
          remaining.tax = round2(remaining.tax - alloc.tax)
          remaining.tip = round2(remaining.tip - alloc.tip)
          remaining.totalPaid = round2(remaining.totalPaid - alloc.totalPaid)
          txRows.push(buildTxRow(id, m, alloc, idx + 1))
        } else {
          const alloc = { ...remaining }
          txRows.push(buildTxRow(id, m, alloc, idx + 1))
        }
      })

      const { error: splitTxError } = await supabaseAdmin
        .from("Transactions")
        .insert(txRows)
      if (splitTxError) {
        return NextResponse.json({ ok: false, error: splitTxError.message }, { status: 400 })
      }

      // Insert items for their respective transaction ids
      const itemRows: TransactionItemRow[] = []
      methods.forEach((m, idx) => {
        const id = idx === 0 ? originalId : `${originalId}-${idx + 1}`
        methodToItems.get(m)!.forEach((it) => {
          itemRows.push({
            "🔒 Row ID": it.id || null,
            "Payment/ID": id || null,
            "VALUES JOINED 2": it.valuesJoined2 ?? null,
            "STATUS JOINED": it.statusJoined ?? null,
            "Staff/Name": it.staffName ?? null,
            "Staff/Tip Split": (it.staffTipSplit as number | null) ?? null,
            "Staff/Tip Collected": (it.staffTipCollected as number | null) ?? null,
            "Service/ID": (it.serviceId as string | null) ?? null,
            "Service/Name": it.serviceName ?? null,
            "Service/Price": (it.price as number | null) ?? null,
          })
        })
      })
      const itemErr = await insertItems(itemRows)
      if (itemErr) {
        return NextResponse.json({ ok: false, error: itemErr.message }, { status: 400 })
      }

      return NextResponse.json({ ok: true, id: originalId, splits: childIds })
    }

    // Default: single transaction
    const singleRow = buildTxRow(originalId, String(transaction.method || '').toLowerCase(), {
      subtotal,
      tax,
      tip,
      totalPaid
    }, 1)

    const { error: txError } = await supabaseAdmin
      .from("Transactions")
      .insert([singleRow])

    if (txError) {
      return NextResponse.json({ ok: false, error: txError.message }, { status: 400 })
    }

    // Insert items for single transaction
    const itemRows: TransactionItemRow[] = items.map((it) => ({
      "🔒 Row ID": it.id || null,
      "Payment/ID": originalId || null,
      "VALUES JOINED 2": it.valuesJoined2 ?? null,
      "STATUS JOINED": it.statusJoined ?? null,
      "Staff/Name": it.staffName ?? null,
      "Staff/Tip Split": (it.staffTipSplit as number | null) ?? null,
      "Staff/Tip Collected": (it.staffTipCollected as number | null) ?? null,
      "Service/ID": (it.serviceId as string | null) ?? null,
      "Service/Name": it.serviceName ?? null,
      "Service/Price": (it.price as number | null) ?? null,
    }))

    if (itemRows.length > 0) {
      const { error: itemError } = await supabaseAdmin
        .from("Transaction Items")
        .insert(itemRows)
      if (itemError) {
        return NextResponse.json({ ok: false, error: itemError.message }, { status: 400 })
      }
    }

    return NextResponse.json({ ok: true, id: originalId })
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

    // First get the total count
    let countQuery = supabaseAdmin
      .from('Transactions')
      .select('*', { count: 'exact', head: true })
    
    if (appointmentId) {
      countQuery = countQuery.eq('"Booking/ID"', appointmentId)
    }

    const { count, error: countError } = await countQuery

    if (countError) {
      console.error('Supabase count error:', countError)
      return NextResponse.json({ ok: false, error: countError.message }, { status: 400 })
    }

    // Then get the actual data
    let query = supabaseAdmin
      .from('Transactions')
      .select('*')
      .range(offset, offset + limit - 1)
      .order('"Payment/Date"', { ascending: false, nullsFirst: false })
      .order('"🔒 Row ID"', { ascending: false })
    
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
    
    // Fetch transaction items for all transactions (chunk to avoid oversized filters)
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
      // Walk-in guest fields
      walkInCustomerId: row['Walk-In/Customer ID'],
      walkInPhone: row['Walk-In/Phone'],
      // Add payment status fields without breaking existing structure
      status: row['Payment/Status'],
      paymentStatus: row['Payment/Status'], 
      paid: row['Transaction/Paid'],
      items: itemsByTransaction[String(row['🔒 Row ID'] || '')] || [],
    }))

    return NextResponse.json({ ok: true, data: rows, total: count || 0 })
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

    // First check if transaction exists and get booking details for matching
    console.log('Checking if transaction exists and fetching transaction details...')
    const { data: existingTransaction, error: checkError } = await supabaseAdmin
      .from('Transactions')
      .select('"🔒 Row ID", "Booking/ID", "Customer/Phone", "Payment/Date"')
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
    const ghlAppointmentId = existingTransaction['Booking/ID']
    const customerPhone = existingTransaction['Customer/Phone']
    const paymentDate = existingTransaction['Payment/Date']
    console.log('Transaction details:', { ghlAppointmentId, customerPhone, paymentDate })

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

    // Clear payment status for the booking linked to this transaction
    // Transactions["Booking/ID"] = restyle_bookings.id
    if (ghlAppointmentId) {
      console.log('🔍 Looking for booking with id:', ghlAppointmentId)
      
      const { data: matchedBooking, error: bookingError } = await supabaseAdmin
        .from('restyle_bookings')
        .select('id, payment_status')
        .eq('id', ghlAppointmentId)
        .single()
      
      if (bookingError) {
        console.error('❌ Error finding booking:', bookingError)
      } else if (matchedBooking) {
        console.log('📋 Found booking:', matchedBooking)
        
        // Only update if it's marked as paid
        if (matchedBooking.payment_status === 'paid') {
          const { error: updateError } = await supabaseAdmin
            .from('restyle_bookings')
            .update({ 
              payment_status: null,
              payment_method: null,
              payment_date: null,
              total_paid: null
            })
            .eq('id', ghlAppointmentId)
          
          if (updateError) {
            console.error('❌ Error clearing payment status:', updateError)
          } else {
            console.log('✅ Cleared payment status for booking:', ghlAppointmentId)
          }
        } else {
          console.log('ℹ️ Booking not marked as paid, skipping update. Status:', matchedBooking.payment_status)
        }
      } else {
        console.log('⚠️ No booking found with id:', ghlAppointmentId)
      }
    } else {
      console.log('⚠️ No Booking/ID in transaction, skipping booking update')
    }

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


