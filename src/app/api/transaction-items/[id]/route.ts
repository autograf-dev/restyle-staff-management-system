import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    if (!id) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 })

    const update: Record<string, unknown> = {}
    if (body.serviceName !== undefined) update['Service/Name'] = body.serviceName
    if (body.price !== undefined) update['Service/Price'] = body.price
    if (body.staffName !== undefined) update['Staff/Name'] = body.staffName
    if (body.staffTipCollected !== undefined) update['Staff/Tip Collected'] = body.staffTipCollected

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ ok: false, error: 'No fields to update' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('Transaction Items')
      .update(update)
      .eq('"🔒 Row ID"', id)

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    console.error('Error updating transaction item:', e)
    return NextResponse.json({ ok: false, error: 'Failed to update transaction item' }, { status: 500 })
  }
}
