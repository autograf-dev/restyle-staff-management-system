import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { serviceId, action, staffIds } = body
    
    console.log('Service staff management request:', { serviceId, action, staffIds })
    
    // Validate
    if (!serviceId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields', success: false },
        { status: 400 }
      )
    }
    
    if (!Array.isArray(staffIds)) {
      return NextResponse.json(
        { error: 'staffIds must be an array', success: false },
        { status: 400 }
      )
    }
    
    // First, get the full service details
    console.log('Fetching service details for:', serviceId)
    const servicesResponse = await fetch('https://restyle-backend.netlify.app/.netlify/functions/getAllServices')
    const servicesResult = await servicesResponse.json()
    
    if (!servicesResult.success) {
      return NextResponse.json(
        { error: 'Failed to fetch service details', success: false },
        { status: 500 }
      )
    }
    
    const service = servicesResult.services.find((s: { id: string }) => s.id === serviceId)
    if (!service) {
      return NextResponse.json(
        { error: 'Service not found', success: false },
        { status: 404 }
      )
    }
    
    console.log('Found service:', service.name)
    console.log('Full service object keys:', Object.keys(service))
    
    // Extract only the exact fields needed - create a completely new object
    // to ensure no extra properties leak through
    const svcId = String(service.id)
    const svcName = String(service.name)
    const svcDescription = String(service.description || '')
    const svcDuration = Number(service.duration) || 60
    const svcDurationUnit = String(service.durationUnit || 'mins')
    const svcPrice = String(service.price || '0.00')
    
    // Prepare payload with only the fields updateFullService expects
    const updatePayload = {
      serviceId: svcId,
      name: svcName,
      description: svcDescription,
      duration: svcDuration,
      durationUnit: svcDurationUnit,
      price: svcPrice,
      selectedStaff: staffIds // Replace staff with new selection
    }
    
    // Update the service with new staff assignment using updateFullService endpoint
    console.log('Updating service with staff IDs:', staffIds)
    console.log('Update payload:', JSON.stringify(updatePayload, null, 2))
    
    const response = await fetch('https://restyle-backend.netlify.app/.netlify/functions/updateFullService', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatePayload)
    })
    
    const data = await response.json()
    console.log('Netlify backend response:', { status: response.status, data })
    
    if (!response.ok) {
      console.error('Failed to update service staff:', response.status, data)
      return NextResponse.json(
        { 
          error: data.error || data.message || 'Failed to update service staff',
          details: data.details,
          debugInfo: data.debugInfo,
          success: false 
        },
        { status: response.status }
      )
    }
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in service staff management:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        success: false 
      },
      { status: 500 }
    )
  }
}