import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    console.log('Fetching transaction with ID:', id)
    if (!id) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 })

    const { data: tx, error: txErr } = await supabaseAdmin
      .from('Transactions')
      .select(`
        "🔒 Row ID",
        "Payment/Date",
        "Payment/Method",
        "Payment/Subtotal",
        "Payment/Status",
        "Transaction/Tax",
        "Transaction/Tip",
        "Transaction/Total Paid",
        "Transaction/Paid",
        "Booking/ID",
        "Customer/Phone",
        "Customer/Lookup"
      `)
      .eq('"🔒 Row ID"', id)
      .maybeSingle()

    if (txErr) {
      console.error('Supabase error:', txErr)
      return NextResponse.json({ ok: false, error: txErr.message }, { status: 400 })
    }
    if (!tx) {
      console.log('Transaction not found for ID:', id)
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })
    }
    console.log('Found transaction:', tx['🔒 Row ID'])

    const { data: items, error: itemErr } = await supabaseAdmin
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
      .eq('"Payment/ID"', id)

    if (itemErr) return NextResponse.json({ ok: false, error: itemErr.message }, { status: 400 })

    return NextResponse.json({ ok: true, data: {
      id: tx['🔒 Row ID'],
      paymentDate: tx['Payment/Date'],
      method: tx['Payment/Method'],
      subtotal: tx['Payment/Subtotal'],
      tax: tx['Transaction/Tax'],
      tip: tx['Transaction/Tip'],
      totalPaid: tx['Transaction/Total Paid'],
      // Add payment status fields
      status: tx['Payment/Status'],
      paymentStatus: tx['Payment/Status'],
      paid: tx['Transaction/Paid'],
      bookingId: tx['Booking/ID'],
      customerPhone: tx['Customer/Phone'],
      customerLookup: tx['Customer/Lookup'],
      // Services and staff info comes from items array - no more concatenated fields
      items: (items || []).map((r: Record<string, unknown>) => ({
        id: r['🔒 Row ID'],
        paymentId: r['Payment/ID'],
        serviceId: r['Service/ID'],
        serviceName: r['Service/Name'],
        price: r['Service/Price'],
        staffName: r['Staff/Name'],
        staffTipSplit: r['Staff/Tip Split'],
        staffTipCollected: r['Staff/Tip Collected'],
      }))
    } })
  } catch (e: unknown) {
    console.error('Error fetching transaction:', e)
    return NextResponse.json({ ok: false, error: 'Failed to fetch transaction' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    if (!id) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 })

    const update: Record<string, unknown> = {}
    if (body.method !== undefined) update['Payment/Method'] = body.method
    // Remove staff field - use Transaction Items for individual staff assignments
    if (body.totalPaid !== undefined) update['Transaction/Total Paid'] = body.totalPaid
    if (body.subtotal !== undefined) update['Payment/Subtotal'] = body.subtotal
    if (body.tax !== undefined) update['Transaction/Tax'] = body.tax
    if (body.tip !== undefined) update['Transaction/Tip'] = body.tip
    // Remove services field - use Transaction Items for individual service updates

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ ok: false, error: 'No fields to update' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('Transactions')
      .update(update)
      .eq('"🔒 Row ID"', id)

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    console.error('Error updating transaction:', e)
    return NextResponse.json({ ok: false, error: 'Failed to update transaction' }, { status: 500 })
  }
}


