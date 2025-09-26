import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const groupId = searchParams.get('groupId')

    if (!groupId) {
      return NextResponse.json({ error: 'Group ID is required' }, { status: 400 })
    }

    // Fetch services from the external API
    const response = await fetch(`https://restyle-backend.netlify.app/.netlify/functions/Services?id=${groupId}`)
    
    if (!response.ok) {
      console.error(`Failed to fetch services for group ${groupId}:`, response.status)
      return NextResponse.json({ error: 'Failed to fetch services' }, { status: response.status })
    }

    const data = await response.json()
    
    return NextResponse.json({ 
      groupId,
      services: data.calendars || [],
      traceId: data.traceId 
    })
  } catch (error) {
    console.error('Error in services API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
