import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

type RawContact = {
  id?: string | number
  contactName?: string
  firstName?: string
  lastName?: string
  phone?: string | null
  dateAdded?: string
}

type SupaContactRow = {
  id: string | number
  first_name: string | null
  last_name: string | null
  phone: string | null
  date_added: string | null
}

const NETLIFY_BASE = "https://restyle-backend.netlify.app/.netlify/functions"

const getPhoneLast4 = (phone?: string | null) => {
  const digits = (phone || "").replace(/\D/g, "")
  return digits.slice(-4)
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const digits = (searchParams.get("digits") || "").replace(/\D/g, "")
  const maxPages = Math.max(1, Math.min(20, Number(searchParams.get("pages") || 10)))

    if (!/^\d{4}$/.test(digits)) {
      return NextResponse.json({ ok: false, error: "Invalid digits. Provide exactly 4 digits." }, { status: 400 })
    }

    // 1) Try Supabase first (restyle_contacts)
    const all: RawContact[] = []
    const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
    if (hasSupabase) {
      const { data: rows, error } = await supabaseAdmin
        .from('restyle_contacts')
        .select('id, first_name, last_name, phone, date_added')
        .ilike('phone', `%${digits}`)
        .limit(50)

      if (!error && Array.isArray(rows)) {
        const typed = rows as Array<Partial<SupaContactRow>>
        all.push(
          ...typed.map((r) => ({
            id: (r.id as (string | number)) ?? '',
            firstName: (r.first_name as (string | null | undefined)) || undefined,
            lastName: (r.last_name as (string | null | undefined)) || undefined,
            phone: (r.phone as (string | null | undefined)) ?? null,
            dateAdded: (r.date_added as (string | null | undefined)) || undefined,
          }))
        )
      }
    }

    // If Supabase yields zero or we still want to broaden, also scan Netlify contacts
    // This ensures we don't miss contacts that only exist in the CRM API
    for (let page = 1; page <= maxPages; page++) {
      const url = `${NETLIFY_BASE}/getcontacts?page=${page}`
      const res = await fetch(url, { next: { revalidate: 0 } })
      if (!res.ok) {
        // Stop on errors but return what we have so far
        break
      }
      const json: unknown = await res.json().catch(() => ({}))
      // Narrow the unknown json shape safely
      const contactsRoot = (json as { contacts?: unknown })?.contacts
      const arr: RawContact[] = Array.isArray(contactsRoot)
        ? (contactsRoot as RawContact[])
        : Array.isArray((contactsRoot as { contacts?: unknown })?.contacts)
          ? (((contactsRoot as { contacts: RawContact[] }).contacts))
          : []
      if (!arr.length) {
        break
      }
      all.push(...arr)
    }

  const matches = all.filter(c => getPhoneLast4(c.phone) === digits)
    // De-dupe by id in case contacts span pages
    const byId = new Map<string, RawContact>()
    for (const c of matches) {
      const id = String(c.id ?? "")
      if (!byId.has(id)) byId.set(id, c)
    }

    const results = Array.from(byId.values()).map((c) => ({
      id: String(c.id ?? ""),
      contactName: c.contactName || `${c.firstName || ""} ${c.lastName || ""}`.trim(),
      firstName: c.firstName || "",
      lastName: c.lastName || "",
      phone: c.phone ?? null,
      dateAdded: c.dateAdded || new Date().toISOString(),
    }))

    return NextResponse.json({ ok: true, results })
  } catch (error) {
    console.error("search-last4 API error:", error)
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 })
  }
}
