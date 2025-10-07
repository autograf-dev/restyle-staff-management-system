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
    
    // Use the new updateServiceClean endpoint which only sends allowed fields
    // This avoids the validation errors from the old updateFullService endpoint
    const updatePayload = {
      serviceId: serviceId,
      selectedStaff: staffIds,
      name: service.name,
      description: service.description || '',
      duration: service.slotDuration,
      durationUnit: service.slotDurationUnit,
      slotInterval: service.slotInterval,
      slotBufferBefore: service.preBuffer || 0,
      autoConfirm: service.autoConfirm !== undefined ? service.autoConfirm : true,
      allowReschedule: service.allowReschedule !== undefined ? service.allowReschedule : true,
      allowCancellation: service.allowCancellation !== undefined ? service.allowCancellation : true,
      eventColor: service.eventColor || '#039BE5',
      notes: service.notes || ''
    }
    
    console.log('Updating service with staff IDs:', staffIds)
    console.log('Calling Netlify updateServiceClean endpoint')
    
    // Call the new clean update endpoint
    const response = await fetch('https://restyle-backend.netlify.app/.netlify/functions/updateServiceClean', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updatePayload)
    })
    
    const data = await response.json()
    console.log('updateServiceClean response:', { status: response.status, success: response.ok })
    
    if (!response.ok) {
      console.error('Failed to update service staff:', response.status, data)
      return NextResponse.json(
        { 
          error: data.error || data.message || 'Failed to update service staff',
          details: data.details || data,
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