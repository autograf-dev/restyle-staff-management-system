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
      .select('"Payment/Date", "Payment/Method", "Transaction/Total Paid"')

    // Apply date filter if not all time
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

    console.log(`Revenue by Payment Method API - Filter: ${filter}, Records found: ${data?.length || 0}`)

    // Group by payment method and calculate totals
    const paymentMethodTotals: Record<string, { total: number; count: number }> = {}
    
    data?.forEach(transaction => {
      const method = transaction['Payment/Method'] || 'Unknown'
      const amount = Number(transaction['Transaction/Total Paid'] || 0)
      
      if (!paymentMethodTotals[method]) {
        paymentMethodTotals[method] = { total: 0, count: 0 }
      }
      
      paymentMethodTotals[method].total += amount
      paymentMethodTotals[method].count += 1
    })

    // Convert to array and sort by total revenue
    const paymentMethods = Object.entries(paymentMethodTotals)
      .map(([method, data]) => ({
        method,
        totalRevenue: data.total,
        transactionCount: data.count
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)

    console.log(`Payment methods breakdown:`, paymentMethods)

    return NextResponse.json({ 
      ok: true, 
      data: { 
        paymentMethods,
        filter,
        totalRecords: data?.length || 0
      } 
    })

  } catch (e: unknown) {
    console.error('Error fetching revenue by payment method:', e)
    return NextResponse.json({ ok: false, error: 'Failed to fetch revenue by payment method' }, { status: 500 })
  }
}
