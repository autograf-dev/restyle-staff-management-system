import { NextResponse } from "next/server"

export async function GET() {
  // Check which environment variables are loaded (don't expose actual values)
  const envStatus = {
    NEXT_PUBLIC_SUPABASE_URL: {
      exists: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      length: process.env.NEXT_PUBLIC_SUPABASE_URL?.length || 0,
      startsWith: process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('https://') || false
    },
    SUPABASE_SERVICE_ROLE_KEY: {
      exists: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      length: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
      isPlaceholder: process.env.SUPABASE_SERVICE_ROLE_KEY?.includes('placeholder') || false
    },
    GUEST_CONTACT_ID: {
      exists: !!process.env.GUEST_CONTACT_ID,
      length: process.env.GUEST_CONTACT_ID?.length || 0
    }
  }

  console.log('Environment variable status:', envStatus)

  return NextResponse.json({
    message: "Environment variables check",
    envStatus,
    timestamp: new Date().toISOString()
  })
}
