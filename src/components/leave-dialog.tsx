"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { RefreshCw, Plus, CalendarIcon, User } from "lucide-react"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { format, parseISO, isAfter, isValid, parse } from "date-fns"

type Leave = {
  "🔒 Row ID": string
  "ghl_id": string
  "Event/Name": string
  "Event/Start": string
  "Event/End": string
}

type Staff = {
  "🔒 Row ID"?: string
  "ð Row ID"?: string
  "Barber/Name": string
  "ghl_id": string
  "Barber/Email": string
}

interface LeaveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  staff?: Staff[]
  preSelectedStaffId?: string
  editingLeave?: Leave | null
  onSuccess: () => void
}

// Helper function to safely parse dates from various formats
const safeParseDateString = (dateString: string): Date | null => {
  if (!dateString) return null
  
  try {
    // First try ISO parsing
    let date = parseISO(dateString)
    if (isValid(date)) return date
    
    // Try parsing common formats like "9/19/2025, 12:00:00 AM"
    date = parse(dateString, 'M/d/yyyy, h:mm:ss a', new Date())
    if (isValid(date)) return date
    
    // Try parsing without time
    date = parse(dateString, 'M/d/yyyy', new Date())
    if (isValid(date)) return date
    
    // Try standard date parsing
    date = new Date(dateString)
    if (isValid(date)) return date
    
    return null
  } catch (error) {
    console.error('Error parsing date:', dateString, error)
    return null
  }
}

export function LeaveDialog({ 
  open, 
  onOpenChange, 
  staff = [], 
  preSelectedStaffId,
  editingLeave,
  onSuccess 
}: LeaveDialogProps) {
  const [saving, setSaving] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState("")
  const [leaveReason, setLeaveReason] = useState("")
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)

  // Reset form
  const resetForm = () => {
    setSelectedStaff(preSelectedStaffId || "")
    setLeaveReason("")
    setStartDate(undefined)
    setEndDate(undefined)
  }

  // Initialize form when dialog opens
  useEffect(() => {
    if (open) {
      if (editingLeave) {
        setSelectedStaff(editingLeave.ghl_id)
        setLeaveReason(editingLeave["Event/Name"])
        
        const parsedStartDate = safeParseDateString(editingLeave["Event/Start"])
        const parsedEndDate = safeParseDateString(editingLeave["Event/End"])
        
        setStartDate(parsedStartDate || undefined)
        setEndDate(parsedEndDate || undefined)
      } else {
        resetForm()
      }
    }
  }, [open, editingLeave, preSelectedStaffId])

  // Save leave (create or update)
  const saveLeave = async () => {
    if (!selectedStaff || !leaveReason || !startDate || !endDate) {
      toast.error('Please fill in all fields')
      return
    }

    if (isAfter(startDate, endDate)) {
      toast.error('Start date cannot be after end date')
      return
    }

    try {
      setSaving(true)
      
      const leaveData = {
        ghl_id: selectedStaff,
        reason: leaveReason,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      }

      const url = '/api/leaves'
      const method = editingLeave ? 'PUT' : 'POST'
      const body = editingLeave 
        ? { id: editingLeave["🔒 Row ID"], ...leaveData }
        : leaveData

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const result = await response.json()

      if (result.ok) {
        toast.success(editingLeave ? 'Leave updated successfully' : 'Leave added successfully')
        onOpenChange(false)
        onSuccess()
      } else {
        toast.error(`Failed to ${editingLeave ? 'update' : 'add'} leave: ${result.error}`)
      }
    } catch (error) {
      toast.error(`Error ${editingLeave ? 'updating' : 'adding'} leave`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editingLeave ? 'Edit Leave' : 'Add New Leave'}
          </DialogTitle>
          <DialogDescription>
            {editingLeave 
              ? 'Update leave details' 
              : preSelectedStaffId 
                ? 'Create a new leave request for the selected staff member'
                : 'Create a new leave request for a staff member'
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          <div>
            <Select 
              value={selectedStaff} 
              onValueChange={setSelectedStaff}
              disabled={!!preSelectedStaffId || !!editingLeave}
            >
              <SelectTrigger className="h-12">
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Select staff member" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {staff.map((member) => (
                  <SelectItem key={member.ghl_id} value={member.ghl_id}>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-medium text-primary">
                          {member["Barber/Name"].split(' ').map(n => n[0]).join('').toUpperCase()}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium">{member["Barber/Name"]}</span>
                        <span className="text-sm text-muted-foreground">{member["Barber/Email"]}</span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Input
              value={leaveReason}
              onChange={(e) => setLeaveReason(e.target.value)}
              placeholder="Enter leave reason (e.g., vacation, sick leave, personal)"
              className="h-12"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`h-12 w-full justify-start text-left font-normal ${
                      !startDate && "text-muted-foreground"
                    }`}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border-0 shadow-lg" align="start">
                  <div className="bg-white rounded-lg border shadow-sm">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      disabled={(date) =>
                        date < new Date(new Date().setHours(0, 0, 0, 0))
                      }
                      captionLayout="dropdown"
                      className="rounded-lg"
                      initialFocus
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`h-12 w-full justify-start text-left font-normal ${
                      !endDate && "text-muted-foreground"
                    }`}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "End date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border-0 shadow-lg" align="start">
                  <div className="bg-white rounded-lg border shadow-sm">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      disabled={(date) =>
                        date < (startDate || new Date(new Date().setHours(0, 0, 0, 0)))
                      }
                      captionLayout="dropdown"
                      className="rounded-lg"
                      initialFocus
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button 
              onClick={saveLeave}
              disabled={saving}
              className="bg-primary hover:bg-primary/90"
            >
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  {editingLeave ? 'Update Leave' : 'Add Leave'}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
