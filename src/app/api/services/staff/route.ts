import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { serviceId, action, staffIds } = body

    if (!serviceId || !action || !staffIds) {
      return NextResponse.json(
        { error: 'Missing required fields: serviceId, action, staffIds' }, 
        { status: 400 }
      )
    }

    // Forward the request to the external Netlify backend
    const response = await fetch('https://restyle-backend.netlify.app/.netlify/functions/manageServiceStaff', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        serviceId,
        action,
        staffIds
      })
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Failed to manage service staff:', response.status, data)
      return NextResponse.json(
        { error: data.error || 'Failed to manage service staff', success: false }, 
        { status: response.status }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in service staff management API:', error)
    return NextResponse.json(
      { error: 'Internal server error', success: false }, 
      { status: 500 }
    )
  }
}
