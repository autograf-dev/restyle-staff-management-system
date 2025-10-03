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
      .select('"Payment/Date", "Transaction/Total Paid"')

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

    // Calculate average ticket
    const totalRevenue = data?.reduce((sum, transaction) => {
      const amount = Number(transaction['Transaction/Total Paid'] || 0)
      return sum + amount
    }, 0) || 0

    const transactionCount = data?.length || 0
    const averageTicket = transactionCount > 0 ? totalRevenue / transactionCount : 0

    return NextResponse.json({ 
      ok: true, 
      data: { 
        averageTicket,
        totalRevenue,
        transactionCount,
        filter
      } 
    })

  } catch (e: unknown) {
    console.error('Error fetching average ticket:', e)
    return NextResponse.json({ ok: false, error: 'Failed to fetch average ticket' }, { status: 500 })
  }
}
