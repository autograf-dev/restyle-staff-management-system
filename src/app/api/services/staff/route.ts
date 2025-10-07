import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { serviceId, action, staffIds } = body

    console.log('Service staff management request:', { serviceId, action, staffIds })

    // Validate required fields - staffIds can be an empty array for 'remove' action
    if (!serviceId || !action) {
      console.error('Missing required fields:', { serviceId, action, staffIds })
      return NextResponse.json(
        { error: 'Missing required fields: serviceId, action', success: false }, 
        { status: 400 }
      )
    }

    // staffIds should be an array (can be empty for remove action)
    if (!Array.isArray(staffIds)) {
      console.error('staffIds must be an array:', staffIds)
      return NextResponse.json(
        { error: 'staffIds must be an array', success: false }, 
        { status: 400 }
      )
    }

    // Forward the request to the external Netlify backend
    console.log('Forwarding to Netlify backend:', { serviceId, action, staffIds })
    
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
    console.log('Netlify backend response:', { status: response.status, data })

    if (!response.ok) {
      console.error('Failed to manage service staff:', response.status, data)
      return NextResponse.json(
        { error: data.error || data.message || 'Failed to manage service staff', success: false }, 
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
