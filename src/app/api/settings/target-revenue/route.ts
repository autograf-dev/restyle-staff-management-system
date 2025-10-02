import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

// Table: AppSettings
// Columns:
// - key (text, primary key)
// - value (jsonb)
// - team_id (text, nullable)
// - updated_at (timestamptz, default now())

export async function GET(req: Request) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Server not configured" }, { status: 500 })
    }

    const { searchParams } = new URL(req.url)
    const teamId = searchParams.get("teamId") || "default"

    const { data, error } = await supabaseAdmin
      .from("AppSettings")
      .select("key, value, team_id")
      .eq("key", "target_revenue")
      .eq("team_id", teamId)
      .limit(1)

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    }

    const setting = data && data.length > 0 ? data[0] : null
    const value = setting?.value ?? null

    return NextResponse.json({ ok: true, value })
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: "Unexpected error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Server not configured" }, { status: 500 })
    }

    const body = await req.json()
    const teamId = body?.teamId ?? null
    
    // Handle both old format (value as number) and new format (value as object)
    let amount: number
    let targetPercentage: number = 80
    let weights: any = null
    
    if (typeof body?.value === 'number') {
      // Old format: { value: 15000 }
      amount = Number(body.value)
    } else if (body?.value && typeof body.value === 'object') {
      // New format: { value: { amount: 15000, targetPercentage: 80, weights: {...} } }
      amount = Number(body.value.amount)
      targetPercentage = Number(body.value.targetPercentage) || 80
      weights = body.value.weights
    } else {
      return NextResponse.json({ ok: false, error: "Invalid value format" }, { status: 400 })
    }

    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ ok: false, error: "Invalid amount" }, { status: 400 })
    }

    // Validate target percentage
    if (!Number.isFinite(targetPercentage) || targetPercentage < 1 || targetPercentage > 100) {
      return NextResponse.json({ ok: false, error: "Invalid target percentage" }, { status: 400 })
    }

    // Validate weights if provided
    if (weights) {
      const { revenue } = weights
      if (typeof revenue !== 'number') {
        return NextResponse.json({ ok: false, error: "Invalid weights format" }, { status: 400 })
      }
    }

    const valueToStore = weights ? { amount, targetPercentage, weights } : { amount, targetPercentage }

    const { error } = await supabaseAdmin
      .from("AppSettings")
      .upsert({ 
        key: "target_revenue", 
        value: valueToStore, 
        team_id: teamId || "default" 
      }, { 
        onConflict: "key,team_id" 
      })

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: "Unexpected error" }, { status: 500 })
  }
}


