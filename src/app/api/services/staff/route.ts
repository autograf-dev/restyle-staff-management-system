import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Get valid GHL access token
async function getValidAccessToken() {
  const { data, error } = await supabaseAdmin
    .from('ghl_tokens')
    .select('access_token')
    .single()
  
  if (error || !data) {
    throw new Error('Failed to get access token')
  }
  
  return data.access_token
}

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
    
    // Get GHL access token
    const accessToken = await getValidAccessToken()
    
    // Build team members array from staff IDs
    const teamMembers = staffIds.map((userId: string) => ({
      priority: 0.5,
      selected: true,
      userId: userId,
      isZoomAdded: "false",
      zoomOauthId: "",
      locationConfigurations: [
        {
          location: "",
          position: 0,
          kind: "custom",
          zoomOauthId: "",
          meetingId: "custom_0"
        }
      ]
    }))
    
    // Build the update payload with ONLY the fields GHL accepts
    const updatePayload = {
      name: service.name,
      description: service.description || '',
      teamMembers: teamMembers,
      eventTitle: service.eventTitle || `{{contact.name}} ${service.name} with {{appointment.user.name}}`,
      eventColor: service.eventColor || '#039BE5',
      slotDuration: service.slotDuration,
      slotDurationUnit: service.slotDurationUnit,
      slotInterval: service.slotInterval,
      slotBuffer: service.preBuffer || 0,
      preBuffer: service.preBuffer || 0,
      autoConfirm: service.autoConfirm !== undefined ? service.autoConfirm : true,
      allowReschedule: service.allowReschedule !== undefined ? service.allowReschedule : true,
      allowCancellation: service.allowCancellation !== undefined ? service.allowCancellation : true,
      notes: service.notes || ''
    }
    
    console.log('Updating service with staff IDs:', staffIds)
    console.log('Calling GHL API directly with team members:', teamMembers.length)
    
    // Call GHL API directly
    const response = await fetch(`https://services.leadconnectorhq.com/calendars/${serviceId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Version': '2021-04-15',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updatePayload)
    })
    
    const data = await response.json()
    console.log('GHL API response:', { status: response.status, success: response.ok })
    
    if (!response.ok) {
      console.error('Failed to update service staff:', response.status, data)
      return NextResponse.json(
        { 
          error: data.error || data.message || 'Failed to update service staff',
          details: data,
          success: false 
        },
        { status: response.status }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: 'Service staff updated successfully',
      service: data,
      updatedStaffCount: staffIds.length
    })
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