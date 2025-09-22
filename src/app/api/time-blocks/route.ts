import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { format } from 'date-fns'

type TimeBlockPayload = {
  id?: string
  ghl_id: string
  name: string
  recurring: boolean
  recurringDays?: string[]
  startMinutes: number
  endMinutes: number
  date?: string // ISO when non-recurring
}

const toLegacyDateDisplay = (isoString?: string) => {
  if (!isoString) return ''
  try {
    return format(new Date(isoString), 'M/d/yyyy, h:mm:ss a')
  } catch {
    return isoString
  }
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('time_block')
      .select('*')
      .order('"Block/Date"', { ascending: false })

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, data })
  } catch (_error) {
    return NextResponse.json({ ok: false, error: 'Failed to fetch time blocks' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body: TimeBlockPayload = await request.json()

    const rowId = `block_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

    const blockData = {
      '🔒 Row ID': rowId,
      'Block/Name': body.name,
      'Block/Recurring': String(body.recurring),
      'Block/Recurring Day': (body.recurringDays || []).join(','),
      'Block/Start': String(body.startMinutes),
      'Block/End': String(body.endMinutes),
      'ghl_id': body.ghl_id,
      'Block/Date': body.recurring ? '' : toLegacyDateDisplay(body.date)
    }

    const { data, error } = await supabaseAdmin
      .from('time_block')
      .insert([blockData])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, data })
  } catch (_error) {
    return NextResponse.json({ ok: false, error: 'Failed to create time block' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body: TimeBlockPayload = await request.json()
    const { id, ...rest } = body
    if (!id) {
      return NextResponse.json({ ok: false, error: 'Block ID is required' }, { status: 400 })
    }

    const updateData = {
      'Block/Name': rest.name,
      'Block/Recurring': String(rest.recurring),
      'Block/Recurring Day': (rest.recurringDays || []).join(','),
      'Block/Start': String(rest.startMinutes),
      'Block/End': String(rest.endMinutes),
      'ghl_id': rest.ghl_id,
      'Block/Date': rest.recurring ? '' : toLegacyDateDisplay(rest.date)
    }

    const { data, error } = await supabaseAdmin
      .from('time_block')
      .update(updateData)
      .eq('"🔒 Row ID"', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, data })
  } catch (_error) {
    return NextResponse.json({ ok: false, error: 'Failed to update time block' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ ok: false, error: 'Block ID is required' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('time_block')
      .delete()
      .eq('"🔒 Row ID"', id)

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (_error) {
    return NextResponse.json({ ok: false, error: 'Failed to delete time block' }, { status: 500 })
  }
}


