"use client"
import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Dialog as ConfirmDialog, DialogContent as ConfirmContent, DialogHeader as ConfirmHeader, DialogTitle as ConfirmTitle } from "@/components/ui/dialog"
import { Loader2, AlertCircle, ArrowLeft, ChevronLeft, ChevronRight, Calendar, Clock, User, Users, Scissors, Crown, Sparkles, Heart, Zap, Flame, Gem, CheckCircle2, Star as StarIcon } from "lucide-react"

type Department = { id?: string; name?: string; label?: string; value?: string; description?: string; icon?: string }
type Service = { id?: string; name?: string; duration?: number; price?: number; label?: string; value?: string; description?: string; staffCount?: number }
type Staff = { id?: string; name?: string; email?: string; label?: string; value?: string; badge?: string; icon?: string }
type DateInfo = { dateString: string; dayName: string; dateDisplay: string; label: string; date: Date }
type TimeSlot = { time: string; isPast: boolean }

export type AppointmentNewProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  // step
  currentStep: number
  goToNextStep: () => void
  goToPrevStep: () => void
  // departments/services
  loadingDepts: boolean
  departments: Department[]
  selectedDepartment: string
  setSelectedDepartment: (id: string) => void
  onDepartmentSelect: (id: string) => void
  loadingServices: boolean
  services: Service[]
  selectedService: string
  onServiceSelect: (id: string) => void
  // staff
  loadingStaff: boolean
  staff: Staff[]
  selectedStaff: string
  onStaffSelect: (id: string) => void
  // dates/slots
  loadingDates: boolean
  dates: DateInfo[]
  selectedDate: string
  onDateSelect: (dateString: string) => void
  loadingSlots: boolean
  slots: TimeSlot[]
  selectedTime: string
  onTimeSelect: (time: string) => void
  workingSlots?: Record<string, string[]> // Available slots by date
  // contact
  contactForm: { firstName: string; lastName: string; phone: string; optIn: boolean }
  setContactForm: React.Dispatch<React.SetStateAction<{ firstName: string; lastName: string; phone: string; optIn: boolean }>>
  submitting: boolean
  onSubmit: () => void
  // formatters
  formatServiceDuration: (durationMinutes?: number) => string
  formatSelectedDate: (dateString: string) => string
}

export function AppointmentNew(props: AppointmentNewProps) {
  const {
    open,
    onOpenChange,
    currentStep,
    goToNextStep,
    goToPrevStep,
    loadingDepts,
    departments,
    selectedDepartment,
    setSelectedDepartment,
    onDepartmentSelect,
    loadingServices,
    services,
    selectedService,
    onServiceSelect,
    loadingStaff,
    staff,
    selectedStaff,
    onStaffSelect,
    loadingDates,
    dates,
    selectedDate,
    onDateSelect,
    loadingSlots,
    slots,
    selectedTime,
    onTimeSelect,
    workingSlots,
    contactForm,
    setContactForm,
    submitting,
    onSubmit,
    formatServiceDuration,
    formatSelectedDate,
  } = props

  return (
    <ConfirmDialog open={open} onOpenChange={onOpenChange}>
      <ConfirmContent className="sm:max-w-6xl max-h-[90vh] overflow-y-auto">
        <ConfirmHeader className="pb-6">
          <ConfirmTitle className="text-2xl font-semibold">Create New Appointment</ConfirmTitle>
          <p className="text-base text-gray-600 mt-2">
            Book a new appointment by selecting a service category, service, staff member, and time slot.
          </p>
        </ConfirmHeader>

        <div className="space-y-6">
          {currentStep === 1 && (
            <div className="w-full">
              {loadingDepts ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin mr-3" />
                  <span className="text-lg">Loading service categories...</span>
                </div>
              ) : departments.length > 0 ? (
                <Tabs value={selectedDepartment} onValueChange={(value) => {
                  setSelectedDepartment(value)
                  onDepartmentSelect(value)
                }} className="w-full">
                  <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
                    {departments.map((dept) => {
                      const isSelected = selectedDepartment === (dept.value || dept.id)
                      const name = String(dept.label || dept.name || '').toLowerCase()
                      const GroupIcon = name.includes('bridal') ? Crown
                        : name.includes('facial') ? Sparkles
                        : name.includes('gents') ? User
                        : name.includes('ladies') ? Heart
                        : name.includes('laser') ? Zap
                        : name.includes('threading') ? Scissors
                        : name.includes('waxing') ? Flame
                        : StarIcon
                      return (
                        <button
                          key={dept.value || dept.id}
                          onClick={() => {
                            const deptId = dept.value || dept.id || ''
                            setSelectedDepartment(deptId)
                            onDepartmentSelect(deptId)
                          }}
                          className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all hover:border-[#7b1d1d]/30 flex-shrink-0 ${
                            isSelected ? 'border-[#7b1d1d] bg-[#7b1d1d]' : 'border-neutral-200 bg-white hover:bg-neutral-50'
                          }`}
                        >
                          <GroupIcon className={`h-5 w-5 ${isSelected ? 'text-white' : 'text-neutral-600'}`} />
                          <span className={`text-sm font-medium whitespace-nowrap ${isSelected ? 'text-white' : 'text-neutral-900'}`}>{dept.label || dept.name}</span>
                        </button>
                      )
                    })}
                  </div>

                  {departments.map((dept) => (
                    <TabsContent key={dept.value || dept.id} value={dept.value || dept.id || ''} className="mt-0">
                      <div className="max-h-[60vh] overflow-y-auto">
                        {loadingServices ? (
                          <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin mr-3" />
                            <span className="text-lg">Loading services...</span>
                          </div>
                        ) : services.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {services.map((service) => {
                              const serviceName = service.label || service.name || 'Service'
                              const serviceDuration = service.duration || 0
                              const sName = serviceName.toLowerCase()
                              const ServiceIcon = sName.includes('makeup') ? Sparkles
                                : sName.includes('hair') ? Scissors
                                : sName.includes('facial') ? Heart
                                : sName.includes('massage') ? Gem
                                : sName.includes('nail') ? StarIcon
                                : Crown

                              return (
                                <div
                                  key={service.value || service.id}
                                  onClick={() => onServiceSelect(service.value || service.id || '')}
                                  className="group p-6 border-2 border-neutral-200 rounded-2xl hover:border-[#7b1d1d]/30 hover:bg-[#7b1d1d]/5 cursor-pointer transition-all"
                                >
                                  <div className="flex items-start gap-4">
                                    <div className="p-3 rounded-xl bg-[#7b1d1d]/10">
                                      <ServiceIcon className="h-6 w-6 text-[#7b1d1d]" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-semibold text-base text-neutral-900 group-hover:text-[#7b1d1d] transition-colors">
                                        {serviceName}
                                      </h4>
                                      <div className="flex items-center gap-2 mt-2">
                                        <Clock className="h-4 w-4 text-neutral-500" />
                                        <span className="text-sm text-neutral-600">
                                          {formatServiceDuration(serviceDuration)}
                                        </span>
                                        <span className="text-neutral-300">•</span>
                                        <span className="text-sm font-semibold text-[#7b1d1d]">
                                          {typeof service.price === 'number' && service.price > 0 ? `CA$${service.price.toFixed(2)}` : ''}
                                        </span>
                                      </div>
                                      {typeof service.staffCount === 'number' && (
                                        <div className="flex items-center gap-1 mt-1">
                                          <Users className="h-3 w-3 text-neutral-400" />
                                          <span className="text-xs text-neutral-500">
                                            {service.staffCount} staff available
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-12">
                            <div className="p-4 rounded-full bg-neutral-100 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                              <AlertCircle className="h-8 w-8 text-neutral-400" />
                            </div>
                            <p className="text-lg text-neutral-600">No services available in this category</p>
                            <p className="text-sm text-neutral-500 mt-1">Try selecting a different category</p>
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              ) : (
                <div className="text-center py-12">
                  <div className="p-4 rounded-full bg-neutral-100 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <AlertCircle className="h-8 w-8 text-neutral-400" />
                  </div>
                  <p className="text-lg text-neutral-600">No service categories available</p>
                  <p className="text-sm text-neutral-500 mt-1">Please try again later</p>
                </div>
              )}
            </div>
          )}

          {currentStep === 2 && (
            <div className="w-full">
              <div className="flex items-center gap-3 mb-6">
                <button onClick={goToPrevStep} className="p-2 rounded-lg hover:bg-neutral-100 transition-colors">
                  <ArrowLeft className="h-5 w-5 text-neutral-600" />
                </button>
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900">Choose Staff</h3>
                  <p className="text-sm text-neutral-600">Select a staff member for {services.find(s => s.value === selectedService)?.label || 'your service'}</p>
                </div>
              </div>

              {loadingStaff ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin mr-3" />
                  <span className="text-lg">Loading staff data...</span>
                </div>
              ) : staff.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
                    {staff.map((person) => {
                      const isSelected = selectedStaff === (person.value || person.id)
                      const staffName = person.label || person.name || person.email || 'Staff'
                      const initials = staffName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                      return (
                        <button
                          key={person.value || person.id || person.email || Math.random().toString(36)}
                          onClick={() => onStaffSelect(person.value || person.id || '')}
                          className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all relative ${
                            isSelected ? 'border-[#7b1d1d] bg-[#7b1d1d]/5' : 'border-neutral-200 bg-white hover:border-[#7b1d1d]/30 hover:bg-neutral-50'
                          }`}
                        >
                          {isSelected && (
                            <div className="absolute -top-2 -right-2 w-6 h-6 bg-[#7b1d1d] rounded-full flex items-center justify-center">
                              <CheckCircle2 className="h-4 w-4 text-white" />
                            </div>
                          )}
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg ${
                            isSelected ? 'bg-[#7b1d1d]' : 'bg-neutral-400'
                          }`}>
                            {initials}
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-medium text-neutral-900 line-clamp-2">{staffName}</p>
                            {person.badge && (
                              <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">{person.badge}</span>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={goToPrevStep} className="flex-1 rounded-xl">Back</Button>
                    <Button onClick={() => { if (selectedStaff) { goToNextStep() } }} disabled={!selectedStaff} className="flex-1 rounded-xl bg-[#7b1d1d] hover:bg-[#6b1717] text-white">Continue</Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <div className="p-4 rounded-full bg-neutral-100 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <AlertCircle className="h-8 w-8 text-neutral-400" />
                  </div>
                  <p className="text-lg text-neutral-600">No staff available</p>
                  <p className="text-sm text-neutral-500 mt-1">Please try again later</p>
                </div>
              )}
            </div>
          )}

          {currentStep === 3 && (
            <div className="w-full">
              <div className="flex items-center gap-3 mb-6">
                <button onClick={goToPrevStep} className="p-2 rounded-lg hover:bg-neutral-100 transition-colors">
                  <ArrowLeft className="h-5 w-5 text-neutral-600" />
                </button>
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900">Select Date & Time</h3>
                  <p className="text-sm text-neutral-600">Choose your preferred appointment slot</p>
                </div>
              </div>

              <div className="text-center mb-6">
                <div className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                  TIME ZONE: MOUNTAIN TIME - EDMONTON (GMT-06:00)
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  {loadingDates ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin mr-3" />
                      <span className="text-lg">Loading available dates...</span>
                    </div>
                  ) : dates.length > 0 ? (
                    <>
                      {/* Calendar Widget Button */}
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-medium text-gray-700">Select Date</h4>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const calendarPopup = document.getElementById('calendar-widget-popup')
                            if (calendarPopup) {
                              calendarPopup.classList.toggle('hidden')
                            }
                          }}
                          className="text-xs"
                        >
                          <Calendar className="h-3 w-3 mr-1" />
                          Jump to Date
                        </Button>
                      </div>

                      {/* Calendar Widget Popup - Compact Version */}
                      <div id="calendar-widget-popup" className="hidden mb-4 p-3 border-2 border-[#7b1d1d] rounded-lg bg-white shadow-lg max-w-xs mx-auto">
                        {(() => {
                          const [viewMonth, setViewMonth] = React.useState(() => {
                            const selected = dates.find(d => d.dateString === selectedDate)
                            return selected?.date || new Date()
                          })
                          
                          const monthStart = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1)
                          const startDate = new Date(monthStart)
                          startDate.setDate(startDate.getDate() - startDate.getDay())
                          
                          const calendarDays = []
                          const currentDate = new Date(startDate)
                          for (let i = 0; i < 42; i++) {
                            calendarDays.push(new Date(currentDate))
                            currentDate.setDate(currentDate.getDate() + 1)
                          }
                          
                          return (
                            <>
                              {/* Month Navigation */}
                              <div className="flex items-center justify-between mb-2">
                                <button
                                  onClick={() => {
                                    const newMonth = new Date(viewMonth)
                                    newMonth.setMonth(newMonth.getMonth() - 1)
                                    setViewMonth(newMonth)
                                  }}
                                  className="p-1 rounded hover:bg-neutral-100 transition-colors"
                                >
                                  <ChevronLeft className="h-4 w-4 text-neutral-600" />
                                </button>
                                <h3 className="text-xs font-semibold text-neutral-900">
                                  {viewMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                                </h3>
                                <button
                                  onClick={() => {
                                    const newMonth = new Date(viewMonth)
                                    newMonth.setMonth(newMonth.getMonth() + 1)
                                    setViewMonth(newMonth)
                                  }}
                                  className="p-1 rounded hover:bg-neutral-100 transition-colors"
                                >
                                  <ChevronRight className="h-4 w-4 text-neutral-600" />
                                </button>
                              </div>
                              
                              {/* Weekday Headers */}
                              <div className="grid grid-cols-7 gap-0.5 mb-1">
                                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                                  <div key={i} className="text-center text-[10px] font-medium text-gray-500 py-0.5">
                                    {day}
                                  </div>
                                ))}
                              </div>
                              
                              {/* Calendar Grid */}
                              <div className="grid grid-cols-7 gap-0.5">
                                {calendarDays.map((day, idx) => {
                                  const dateString = day.toISOString().split('T')[0]
                                  const isSelected = dateString === selectedDate
                                  const isCurrentMonth = day.getMonth() === viewMonth.getMonth()
                                  const isToday = dateString === new Date().toISOString().split('T')[0]
                                  const isPast = day < new Date(new Date().setHours(0,0,0,0))
                                  const hasSlots = (workingSlots && workingSlots[dateString]?.length > 0) || false
                                  const isUnavailable = !isPast && !hasSlots
                                  
                                  return (
                                    <button
                                      key={idx}
                                      onClick={() => {
                                        if (!isPast && hasSlots) {
                                          onDateSelect(dateString)
                                          document.getElementById('calendar-widget-popup')?.classList.add('hidden')
                                        }
                                      }}
                                      disabled={isPast || isUnavailable}
                                      className={`
                                        aspect-square p-0.5 rounded text-[11px] transition-all
                                        ${!isCurrentMonth ? 'text-gray-300' : ''}
                                        ${isPast ? 'opacity-30 cursor-not-allowed' : ''}
                                        ${isUnavailable ? 'opacity-40 cursor-not-allowed text-gray-400 line-through' : ''}
                                        ${!isPast && !isUnavailable ? 'hover:bg-[#7b1d1d]/10 cursor-pointer' : ''}
                                        ${isSelected ? 'bg-[#7b1d1d] text-white font-bold' : ''}
                                        ${isToday && !isSelected ? 'border border-[#7b1d1d] font-semibold' : ''}
                                        ${!isSelected && !isPast && !isUnavailable && isCurrentMonth ? 'text-gray-900' : ''}
                                      `}
                                    >
                                      {day.getDate()}
                                    </button>
                                  )
                                })}
                              </div>
                            </>
                          )
                        })()}
                      </div>

                      {/* Original Linear Date Selector */}
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => {
                            const currentIndex = dates.findIndex(d => d.dateString === selectedDate)
                            if (currentIndex > 0) {
                              const prevDate = dates[Math.max(0, currentIndex - 1)]
                              onDateSelect(prevDate.dateString)
                            }
                          }}
                          disabled={!selectedDate || dates.findIndex(d => d.dateString === selectedDate) === 0}
                          className="p-2 rounded-lg hover:bg-neutral-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="h-5 w-5 text-neutral-600" />
                        </button>

                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:mx-4">
                          {(() => {
                            const currentIndex = dates.findIndex(d => d.dateString === selectedDate)
                            const startIndex = currentIndex > 0 ? Math.max(0, currentIndex - 1) : 0
                            const datesToShow = dates.slice(startIndex, startIndex + 3)
                            if (currentIndex === -1 && dates.length > 0) {
                              return dates.slice(0, 3).map((dateInfo) => (
                                <div
                                  key={dateInfo.dateString}
                                  onClick={() => onDateSelect(dateInfo.dateString)}
                                  className={`p-4 rounded-lg border-2 transition-all duration-200 text-center cursor-pointer hover:shadow-md ${
                                    selectedDate === dateInfo.dateString ? 'border-[#7b1d1d] bg-[#7b1d1d]/10' : 'border-neutral-200 bg-neutral-50 hover:border-[#7b1d1d]/30'
                                  }`}
                                >
                                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{dateInfo.label}</div>
                                  <div className="font-bold text-lg text-black">{dateInfo.dayName}</div>
                                  <div className="text-sm text-gray-600">{dateInfo.dateDisplay}</div>
                                </div>
                              ))
                            }
                            return datesToShow.map((dateInfo) => (
                              <div
                                key={dateInfo.dateString}
                                onClick={() => onDateSelect(dateInfo.dateString)}
                                className={`p-4 rounded-lg border-2 transition-all duration-200 text-center cursor-pointer hover:shadow-md ${
                                  selectedDate === dateInfo.dateString ? 'border-[#7b1d1d] bg-[#7b1d1d]/10' : 'border-neutral-200 bg-neutral-50 hover:border-[#7b1d1d]/30'
                                }`}
                              >
                                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{dateInfo.label}</div>
                                <div className="font-bold text-lg text-black">{dateInfo.dayName}</div>
                                <div className="text-sm text-gray-600">{dateInfo.dateDisplay}</div>
                              </div>
                            ))
                          })()}
                        </div>

                        <button
                          onClick={() => {
                            const currentIndex = dates.findIndex(d => d.dateString === selectedDate)
                            if (currentIndex < dates.length - 1) {
                              const nextDate = dates[currentIndex + 1]
                              onDateSelect(nextDate.dateString)
                            }
                          }}
                          disabled={!selectedDate || dates.findIndex(d => d.dateString === selectedDate) === dates.length - 1}
                          className="p-2 rounded-lg hover:bg-neutral-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="h-5 w-5 text-neutral-600" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-12">
                      <div className="p-4 rounded-full bg-neutral-100 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                        <AlertCircle className="h-8 w-8 text-neutral-400" />
                      </div>
                      <p className="text-lg text-neutral-600">No available dates</p>
                      <p className="text-sm text-neutral-500 mt-1">Please try again later</p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm min-h-[400px]">
                    {!selectedDate ? (
                      <div className="text-center py-12">
                        <div className="p-4 rounded-full bg-neutral-100 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                          <Calendar className="h-8 w-8 text-neutral-400" />
                        </div>
                        <div className="text-gray-500 text-lg">Select a date to view available time slots</div>
                        <div className="text-sm text-gray-400 mt-2">Choose from the available dates above</div>
                      </div>
                    ) : loadingSlots ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin mr-3" />
                        <span className="text-lg">Loading available time slots...</span>
                      </div>
                    ) : slots.length > 0 ? (
                      <div className="space-y-4">
                        <div className="text-sm text-gray-600 mb-3">
                          Available slots for {formatSelectedDate(selectedDate)}:
                        </div>
                        <div className="grid sm:grid-cols-4 sm:gap-4 grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-2">
                          {slots.map((slot) => (
                            <Button
                              key={slot.time}
                              variant="outline"
                              size="sm"
                              className={`py-3 transition-all duration-200 text-black border border-gray-300 rounded-lg justify-center hover:shadow-sm ${
                                selectedTime === slot.time ? 'bg-red-700 hover:bg-red-700 text-white border-red-700 shadow-sm' : 'hover:border-red-300'
                              }`}
                              onClick={() => onTimeSelect(slot.time)}
                            >
                              {slot.time}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="text-gray-500 text-lg">No available slots for this date</div>
                        <div className="text-sm text-gray-400 mt-2">Please select another date</div>
                      </div>
                    )}
                  </div>

                  {selectedTime && (
                    <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                      <div className="text-center">
                        <div className="font-bold text-black text-lg">Selected Time</div>
                        <div className="text-red-700 font-semibold">{selectedTime} MST</div>
                        <div className="text-sm text-gray-600 mt-1">{formatSelectedDate(selectedDate)}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="w-full">
              <div className="flex items-center gap-3 mb-6">
                <button onClick={goToPrevStep} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                  <ChevronLeft className="h-5 w-5 text-gray-600" />
                </button>
                <div>
                  <h2 className="text-2xl font-bold text-black mb-2">Contact Information</h2>
                  <p className="text-gray-700">Please provide your details to complete the booking</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="newapp-firstname" className="block text-sm font-medium text-gray-700 text-black">First Name *</Label>
                        <Input
                          id="newapp-firstname"
                          value={contactForm.firstName}
                          onChange={(e) => setContactForm(prev => ({ ...prev, firstName: e.target.value }))}
                          placeholder="First Name"
                          className="mt-1.5 h-11 border-[#751A29] focus:border-[#751A29] focus:ring-[#751A29]"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="newapp-lastname" className="block text-sm font-medium text-gray-700 text-black">Last Name *</Label>
                        <Input
                          id="newapp-lastname"
                          value={contactForm.lastName}
                          onChange={(e) => setContactForm(prev => ({ ...prev, lastName: e.target.value }))}
                          placeholder="Last Name"
                          className="mt-1.5 h-11 border-[#751A29] focus:border-[#751A29] focus:ring-[#751A29]"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="newapp-phone" className="block text-sm font-medium text-gray-700 text-black">Phone Number *</Label>
                      <div className="flex items-center">
                        <Input
                          id="newapp-phone"
                          value={contactForm.phone}
                          onChange={(e) => setContactForm(prev => ({ ...prev, phone: e.target.value }))}
                          placeholder="+1 (555) 123-4567"
                          className="flex-1 h-11 border-[#751A29] focus:border-[#751A29] focus:ring-[#751A29]"
                          required
                        />
                      </div>
                      <div className="text-xs text-gray-500">Enter your 10-digit US phone number</div>
                    </div>
                  </form>
                </div>

                <div className="space-y-4">
                  <h3 className="font-bold text-xl text-black mb-4">Appointment Summary</h3>
                  <div className="space-y-4">
                    <div className="p-6 rounded-xl border-2 border-gray-200 bg-white hover:border-[#7b1d1d]/30 transition-colors">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Calendar className="text-xl text-red-700" />
                            <div>
                              <div className="text-xs text-gray-500 uppercase">Date</div>
                              <Input
                                type="date"
                                value={selectedDate || ''}
                                onChange={(e) => {
                                  if (e.target.value) {
                                    onDateSelect(e.target.value)
                                  }
                                }}
                                min={new Date().toISOString().split('T')[0]}
                                className="w-40 h-8 text-sm font-semibold border-gray-300 focus:border-[#7b1d1d] focus:ring-[#7b1d1d]"
                              />
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => goToPrevStep()}
                            className="text-xs hover:bg-[#7b1d1d]/10"
                          >
                            More Options
                          </Button>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Clock className="text-xl text-red-700" />
                            <div>
                              <div className="text-xs text-gray-500 uppercase">Time</div>
                              <Input
                                type="time"
                                value={(() => {
                                  if (!selectedTime) return ''
                                  // Convert "3:00 PM" to "15:00"
                                  const match = selectedTime.match(/(\d+):(\d+)\s*(AM|PM)/i)
                                  if (!match) return ''
                                  let hour = parseInt(match[1])
                                  const minute = match[2]
                                  const ampm = match[3].toUpperCase()
                                  if (ampm === 'PM' && hour !== 12) hour += 12
                                  if (ampm === 'AM' && hour === 12) hour = 0
                                  return `${String(hour).padStart(2, '0')}:${minute}`
                                })()}
                                onChange={(e) => {
                                  if (e.target.value) {
                                    const [hours, minutes] = e.target.value.split(':')
                                    const hour = parseInt(hours)
                                    const ampm = hour >= 12 ? 'PM' : 'AM'
                                    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
                                    const formattedTime = `${displayHour}:${minutes} ${ampm}`
                                    onTimeSelect(formattedTime)
                                  }
                                }}
                                className="w-32 h-8 text-sm font-semibold border-gray-300 focus:border-[#7b1d1d] focus:ring-[#7b1d1d]"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="pt-2 border-t border-gray-100">
                          <div className="flex items-center gap-3">
                            <User className="text-xl text-red-700" />
                            <div>
                              <div className="text-xs text-gray-500 uppercase">Staff Member</div>
                              <div className="font-medium text-gray-900">{staff.find(s => s.value === selectedStaff)?.label || 'Select Staff'}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="p-6 rounded-xl border border-gray-200 bg-white">
                      <div className="space-y-3">
                        <div className="font-bold text-lg text-black">{services.find(s => s.value === selectedService)?.label || 'Select Service'}</div>
                        <div className="flex items-center gap-3">
                          <User className="text-xl text-red-700" />
                          <span className="text-gray-700">with {staff.find(s => s.value === selectedStaff)?.label || 'Select Staff'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-6">
                <Button variant="outline" onClick={goToPrevStep} className="flex-1 h-11 border-gray-300 hover:bg-gray-50">
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>
                <Button onClick={onSubmit} disabled={!contactForm.firstName || !contactForm.lastName || !contactForm.phone || submitting} className="flex-1 h-11 bg-red-700 hover:bg-red-700 text-white font-bold">
                  {submitting ? (<>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Booking Your Appointment...
                  </>) : (<>
                    <Calendar className="h-4 w-4 mr-2" />
                    Book Appointment
                  </>)}
                </Button>
              </div>
            </div>
          )}
        </div>
      </ConfirmContent>
    </ConfirmDialog>
  )
}


