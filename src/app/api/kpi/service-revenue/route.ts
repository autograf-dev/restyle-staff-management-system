import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: 'Missing service role key' }, { status: 500 })
    }

    const { searchParams } = new URL(req.url)
    const filter = searchParams.get('filter') || 'today' // today, last7days, alltime

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    let startDate: Date | null = null
    let endDate: Date | null = null

    switch (filter) {
      case 'today':
        startDate = today
        endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000)
        break
      case 'last7days':
        startDate = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000)
        endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000)
        break
      case 'alltime':
        break
      default:
        startDate = today
        endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000)
    }

    let query = supabaseAdmin
      .from('Transactions')
      .select('"Payment/Date", "Payment/Subtotal"')

    if (filter !== 'alltime' && startDate && endDate) {
      query = query
        .not('"Payment/Date"', 'is', null)
        .gte('"Payment/Date"', startDate.toISOString())
        .lt('"Payment/Date"', endDate.toISOString())
    }

    const { data, error } = await query
    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    }

    const serviceRevenue = data?.reduce((sum, tx) => sum + Number(tx['Payment/Subtotal'] || 0), 0) || 0

    return NextResponse.json({ ok: true, data: { serviceRevenue, filter, count: data?.length || 0 } })
  } catch (e: unknown) {
    console.error('Error fetching service revenue:', e)
    return NextResponse.json({ ok: false, error: 'Failed to fetch service revenue' }, { status: 500 })
  }
}


