import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { format } from 'date-fns'

export async function GET() {
  try {
    console.log('Fetching leaves data...')

    const { data, error } = await supabaseAdmin
      .from('time_off')
      .select('*')
      .order('"Event/Start"', { ascending: false })

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      )
    }

    console.log('Leaves data fetched successfully:', data?.length, 'records')
    return NextResponse.json({ ok: true, data })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { ok: false, error: "Failed to fetch leaves" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    console.log('Creating new leave:', body)

    // Generate a unique ID
    const rowId = `leave_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Store dates in the same human-readable format as legacy rows
    const toLegacyDisplay = (isoString: string) => {
      try {
        return format(new Date(isoString), 'M/d/yyyy, h:mm:ss a')
      } catch {
        return isoString
      }
    }

    const leaveData = {
      "🔒 Row ID": rowId,
      "ghl_id": body.ghl_id,
      "Event/Name": body.reason,
      "Event/Start": toLegacyDisplay(body.startDate),
      "Event/End": toLegacyDisplay(body.endDate)
    }

    const { data, error } = await supabaseAdmin
      .from('time_off')
      .insert([leaveData])
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      )
    }

    console.log('Leave created successfully:', data)
    return NextResponse.json({ ok: true, data })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { ok: false, error: "Failed to create leave" },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, ...updateData } = body
    console.log('Updating leave:', { id, updateData })

    const toLegacyDisplay = (isoString: string) => {
      try {
        return format(new Date(isoString), 'M/d/yyyy, h:mm:ss a')
      } catch {
        return isoString
      }
    }

    const processedData = {
      "Event/Name": updateData.reason,
      "Event/Start": toLegacyDisplay(updateData.startDate),
      "Event/End": toLegacyDisplay(updateData.endDate)
    }

    const { data, error } = await supabaseAdmin
      .from('time_off')
      .update(processedData)
      .eq('"🔒 Row ID"', id)
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      )
    }

    console.log('Leave updated successfully:', data)
    return NextResponse.json({ ok: true, data })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { ok: false, error: "Failed to update leave" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Leave ID is required" },
        { status: 400 }
      )
    }

    console.log('Deleting leave:', id)

    const { error } = await supabaseAdmin
      .from('time_off')
      .delete()
      .eq('"🔒 Row ID"', id)

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      )
    }

    console.log('Leave deleted successfully')
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { ok: false, error: "Failed to delete leave" },
      { status: 500 }
    )
  }
}
