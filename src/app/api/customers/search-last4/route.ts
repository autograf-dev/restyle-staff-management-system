import { NextRequest, NextResponse } from "next/server"

type RawContact = {
  id?: string | number
  contactName?: string
  firstName?: string
  lastName?: string
  phone?: string | null
  dateAdded?: string
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
    const maxPages = Math.max(1, Math.min(10, Number(searchParams.get("pages") || 5)))

    if (!/^\d{4}$/.test(digits)) {
      return NextResponse.json({ ok: false, error: "Invalid digits. Provide exactly 4 digits." }, { status: 400 })
    }

    const all: RawContact[] = []
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
