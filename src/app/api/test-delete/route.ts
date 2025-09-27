import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

export async function GET() {
  try {
    console.log('Testing database connection...')
    
    // Test database connection
    const { data: transactions, error } = await supabaseAdmin
      .from('Transactions')
      .select('"🔒 Row ID", "Transaction/Total Paid", "Payment/Date"')
      .limit(5)

    if (error) {
      console.error('Database connection error:', error)
      return NextResponse.json({ 
        ok: false, 
        error: error.message,
        details: 'Failed to connect to database'
      })
    }

    console.log('Found transactions:', transactions?.length)
    
    return NextResponse.json({ 
      ok: true, 
      message: 'Database connection successful',
      transactionCount: transactions?.length || 0,
      sampleTransactions: transactions
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ 
      ok: false, 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export async function POST(request: Request) {
  try {
    const { transactionId } = await request.json()
    
    if (!transactionId) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Transaction ID required'
      })
    }

    console.log('Testing delete operation for transaction:', transactionId)

    // First check if transaction exists
    const { data: existingTransaction, error: checkError } = await supabaseAdmin
      .from('Transactions')
      .select('"🔒 Row ID"')
      .eq('"🔒 Row ID"', transactionId)
      .single()

    if (checkError || !existingTransaction) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Transaction not found',
        details: checkError?.message
      })
    }

    // Check transaction items
    const { data: items, error: itemsError } = await supabaseAdmin
      .from('Transaction Items')
      .select('"🔒 Row ID"')
      .eq('"Payment/ID"', transactionId)

    if (itemsError) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Failed to check transaction items',
        details: itemsError.message
      })
    }

    console.log('Found', items?.length || 0, 'transaction items')

    return NextResponse.json({ 
      ok: true, 
      message: 'Transaction exists and ready for deletion',
      transactionId,
      itemCount: items?.length || 0
    })

  } catch (error) {
    console.error('Test delete error:', error)
    return NextResponse.json({ 
      ok: false, 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}