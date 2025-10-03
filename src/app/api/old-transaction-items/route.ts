import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

export async function GET(req: Request) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY on server" },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(req.url)
    const limit = Number(searchParams.get('limit') || 1000)

    console.log('🔍 Fetching old transaction items...')

    const { data, error } = await supabaseAdmin
      .from('old_transaction_items')
      .select('*')
      .eq('paid_check', true) // Only get paid transactions
      .order('idx', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('❌ Supabase error fetching old transaction items:', error)
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    }

    console.log(`✅ Found ${data?.length || 0} old transaction items`)

    // Transform the data to a more usable format
    const rows = (data || []).map((row: Record<string, unknown>) => ({
      idx: row.idx,
      rowId: row.row_id,
      paymentId: row['Payment/ID'],
      staffName: row['Staff/Name'],
      staffTipSplit: row['Staff/Tip Split'] ? Number(row['Staff/Tip Split']) : 0,
      staffTipCollected: row['Staff/Tip Collected'] ? Number(row['Staff/Tip Collected']) : 0,
      serviceId: row['Service/ID'],
      serviceName: row['Service/Name'],
      servicePrice: row['Service/Price'] ? Number(row['Service/Price']) : 0,
      paidCheck: row.paid_check,
      paymentDate: row.payment_date,
      paymentAt: row.payment_at,
    }))

    console.log('📊 Sample transformed data:', rows.slice(0, 2))

    return NextResponse.json({ ok: true, data: rows })
  } catch (e: unknown) {
    console.error('❌ Error fetching old transaction items:', e)
    return NextResponse.json({ ok: false, error: 'Failed to fetch old transaction items' }, { status: 500 })
  }
}