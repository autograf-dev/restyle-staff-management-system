import React from 'react'

// Staff Calendar Component
// This would be added to the main calendar page

const StaffCalendarView = ({ appointments, user }) => {
  const [staff, setStaff] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [selectedDate] = React.useState(new Date())

  // Fetch staff members from the API
  React.useEffect(() => {
    const fetchStaff = async () => {
      try {
        // Fetch staff from local API
        const staffRes = await fetch('/api/getUsers')
        const staffJson = await staffRes.json()
        
        if (staffJson.ok) {
          const users = staffJson.users || []
          const staffMembers = users
            .filter(user => user.user_metadata?.role === 'barber' && user.user_metadata?.ghl_id)
            .map(user => ({
              id: user.id,
              ghl_id: user.user_metadata.ghl_id,
              name: `${user.user_metadata.firstName || ''} ${user.user_metadata.lastName || ''}`.trim() || user.email,
              email: user.email,
              role: user.user_metadata.role
            }))
          
          setStaff(staffMembers)
        }
      } catch (error) {
        console.error('Failed to fetch staff:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStaff()
  }, [])

  // Group appointments by staff for the selected date
  const appointmentsByStaff = React.useMemo(() => {
    const dateStr = selectedDate.toDateString()
    const dayAppointments = appointments.filter(apt => 
      apt.startTime && new Date(apt.startTime).toDateString() === dateStr
    )

    return staff.map(staffMember => ({
      ...staffMember,
      appointments: dayAppointments
        .filter(apt => apt.assigned_user_id === staffMember.ghl_id)
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    }))
  }, [staff, appointments, selectedDate])

  // Time slots (7 AM to 10 PM in 1-hour increments for simplicity)
  const timeSlots = []
  for (let hour = 7; hour <= 22; hour++) {
    timeSlots.push({
      hour,
      label: new Date(2000, 0, 1, hour, 0).toLocaleTimeString('en-US', {
        hour: 'numeric',
        hour12: true
      })
    })
  }

  if (loading) {
    return <div>Loading staff calendar...</div>
  }

  return (
    <div className="staff-calendar-view">
      <div className="flex border rounded-lg overflow-hidden">
        {/* Time Column */}
        <div className="w-20 bg-gray-50 border-r">
          <div className="h-16 border-b flex items-center justify-center font-medium text-sm">
            Time
          </div>
          {timeSlots.map(slot => (
            <div key={slot.hour} className="h-20 border-b border-gray-200 flex items-start justify-center pt-2">
              <span className="text-xs text-gray-600">{slot.label}</span>
            </div>
          ))}
        </div>

        {/* Staff Columns */}
        <div className="flex-1 overflow-x-auto">
          <div className="flex min-w-max">
            {appointmentsByStaff.map(staffMember => (
              <div key={staffMember.ghl_id} className="min-w-[250px] border-r">
                {/* Staff Header */}
                <div className="h-16 border-b bg-gray-50 p-3 flex flex-col justify-center">
                  <div className="font-medium text-sm">{staffMember.name}</div>
                  <div className="text-xs text-gray-500">
                    {staffMember.appointments.length} appointments
                  </div>
                </div>

                {/* Appointments Grid */}
                <div className="relative">
                  {/* Time Grid Background */}
                  {timeSlots.map(slot => (
                    <div key={slot.hour} className="h-20 border-b border-gray-100" />
                  ))}

                  {/* Appointments */}
                  {staffMember.appointments.map(appointment => {
                    const start = new Date(appointment.startTime)
                    const hour = start.getHours()
                    const minute = start.getMinutes()
                    
                    // Calculate position
                    const top = ((hour - 7) * 80) + (minute * 80 / 60)
                    const duration = appointment.endTime 
                      ? (new Date(appointment.endTime) - new Date(appointment.startTime)) / (1000 * 60) 
                      : 60
                    const height = Math.max((duration * 80 / 60), 30)

                    return (
                      <div
                        key={appointment.id}
                        className="absolute left-1 right-1 bg-blue-100 border-l-4 border-blue-500 rounded p-2 text-xs cursor-pointer hover:bg-blue-200"
                        style={{ top: `${top}px`, height: `${height}px` }}
                        onClick={() => {
                          // Navigate to appointment details
                          window.location.href = `/appointments?view=details&id=${appointment.id}`
                        }}
                      >
                        <div className="font-medium truncate">{appointment.serviceName}</div>
                        <div className="truncate text-gray-600">{appointment.contactName}</div>
                        <div className="text-gray-500">
                          {start.toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </div>
                        <div className="mt-1">
                          <span className={`inline-block px-1 py-0.5 rounded text-xs ${
                            appointment.appointment_status === 'confirmed' ? 'bg-green-200 text-green-800' :
                            appointment.appointment_status === 'cancelled' ? 'bg-red-200 text-red-800' :
                            'bg-gray-200 text-gray-800'
                          }`}>
                            {appointment.appointment_status}
                          </span>
                        </div>
                      </div>
                    )
                  })}

                  {/* Empty State */}
                  {staffMember.appointments.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                      <div className="text-center">
                        <div className="text-sm">No appointments</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="mt-6 grid grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold">{appointmentsByStaff.length}</div>
          <div className="text-sm text-gray-600">Active Staff</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-blue-600">
            {appointmentsByStaff.reduce((sum, s) => sum + s.appointments.length, 0)}
          </div>
          <div className="text-sm text-gray-600">Total Appointments</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-green-600">
            {appointmentsByStaff.reduce((sum, s) => 
              sum + s.appointments.filter(a => a.appointment_status === 'confirmed').length, 0
            )}
          </div>
          <div className="text-sm text-gray-600">Confirmed</div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-2xl font-bold text-red-600">
            {appointmentsByStaff.reduce((sum, s) => 
              sum + s.appointments.filter(a => a.appointment_status === 'cancelled').length, 0
            )}
          </div>
          <div className="text-sm text-gray-600">Cancelled</div>
        </div>
      </div>
    </div>
  )
}

export { StaffCalendarView }
