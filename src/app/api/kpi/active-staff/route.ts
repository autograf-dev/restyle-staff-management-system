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

    // Calculate date ranges
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    let startDate: Date | null = null
    let endDate: Date | null = null

    switch (filter) {
      case 'today':
        startDate = today
        endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000) // End of today
        break
      case 'last7days':
        startDate = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000) // 7 days ago
        endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000) // End of today
        break
      case 'alltime':
        // No date filter for all time
        break
      default:
        startDate = today
        endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000)
    }

    // Build query
    let query = supabaseAdmin
      .from('Transactions')
      .select('"Payment/Date", "Payment/Staff"')

    // Apply date filter if not all time
    if (filter !== 'alltime' && startDate && endDate) {
      query = query
        .not('"Payment/Date"', 'is', null)
        .gte('"Payment/Date"', startDate.toISOString())
        .lt('"Payment/Date"', endDate.toISOString())
    }
    // For all time, we don't filter by date at all - include all transactions

    const { data, error } = await query

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    }

    // Calculate unique staff count
    const uniqueStaff = new Set(
      data
        ?.map(transaction => transaction['Payment/Staff'])
        .filter(Boolean)
        .flatMap((staff: string) => staff!.split(',').map((name: string) => name.trim()))
        .filter((name: string) => name.length > 0) || []
    ).size

    return NextResponse.json({ 
      ok: true, 
      data: { 
        activeStaff: uniqueStaff,
        filter,
        count: data?.length || 0
      } 
    })

  } catch (e: unknown) {
    console.error('Error fetching active staff:', e)
    return NextResponse.json({ ok: false, error: 'Failed to fetch active staff' }, { status: 500 })
  }
}
