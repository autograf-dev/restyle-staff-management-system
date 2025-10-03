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
    const startParam = searchParams.get('start')
    const endParam = searchParams.get('end')

    // Calculate date ranges (server fallback)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    let startDate: Date | null = null
    let endDate: Date | null = null

    if (startParam && endParam) {
      // If explicit range provided by client, use it
      startDate = new Date(startParam)
      endDate = new Date(endParam)
    } else {
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
    }

    // Build query
    let query = supabaseAdmin
      .from('Transactions')
      .select('"Payment/Date", "Transaction/Total Paid"')

    // Apply date filter if not all time
    if ((filter !== 'alltime' || (startParam && endParam)) && startDate && endDate) {
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

    console.log(`Total Revenue API - Filter: ${filter}, Records found: ${data?.length || 0}`)
    
    // Calculate total revenue
    const totalRevenue = data?.reduce((sum, transaction) => {
      const amount = Number(transaction['Transaction/Total Paid'] || 0)
      return sum + amount
    }, 0) || 0

    console.log(`Total Revenue calculated: ${totalRevenue}`)

    return NextResponse.json({ 
      ok: true, 
      data: { 
        totalRevenue,
        filter,
        count: data?.length || 0
      } 
    })

  } catch (e: unknown) {
    console.error('Error fetching total revenue:', e)
    return NextResponse.json({ ok: false, error: 'Failed to fetch total revenue' }, { status: 500 })
  }
}
