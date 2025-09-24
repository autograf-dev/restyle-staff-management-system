"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { minutesToDisplayTime, timeToMinutes } from "@/lib/timeUtils"
import { RefreshCw, Plus, CalendarIcon, User, Clock } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { format } from "date-fns"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  staff?: Array<Record<string, unknown>>
  editingBlock?: Record<string, unknown> | null
  onSuccess: () => void
}

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]

export function TimeBlockDialog({ open, onOpenChange, staff = [], editingBlock, onSuccess }: Props) {
  const [saving, setSaving] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState("")
  const [name, setName] = useState("Lunch")
  const [recurring, setRecurring] = useState(false)
  const [days, setDays] = useState<string[]>([])
  const [date, setDate] = useState<Date | undefined>(undefined)
  const [start, setStart] = useState("12:00")
  const [end, setEnd] = useState("13:00")

  useEffect(() => {
    if (!open) return
    if (editingBlock) {
      const eb = editingBlock as Record<string, unknown>
      setSelectedStaff(String(eb.ghl_id || ""))
      setName(String(eb["Block/Name"] || ""))
      const isRecurring = String(eb["Block/Recurring"] || "") === "true"
      setRecurring(isRecurring)
      setDays(String(eb["Block/Recurring Day"] || "").split(',').filter(Boolean))
      setDate(isRecurring ? undefined : (eb["Block/Date"] ? new Date(String(eb["Block/Date"])) : undefined))
      // Keep 24h HH:MM for <input type="time"> so PM times are preserved
      const startMin = Number(eb["Block/Start"]) || 0
      const endMin = Number(eb["Block/End"]) || 0
      const toHHMM = (m: number) => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`
      setStart(toHHMM(startMin))
      setEnd(toHHMM(endMin))
    } else {
      setName("Lunch")
      setRecurring(false)
      setDays([])
      setDate(undefined)
      setStart("12:00")
      setEnd("13:00")
    }
  }, [open, editingBlock])

  const toggleDay = (d: string) => {
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  const saveBlock = async () => {
    if (!selectedStaff || !name) {
      toast.error('Please fill in staff and name')
      return
    }
    if (recurring && days.length === 0) {
      toast.error('Select at least one day for recurring block')
      return
    }
    if (!recurring && !date) {
      toast.error('Pick a date for non-recurring block')
      return
    }

    const startMin = timeToMinutes(start)
    const endMin = timeToMinutes(end)
    if (startMin >= endMin) {
      toast.error('Start time must be before end time')
      return
    }

    try {
      setSaving(true)
      const payload = {
        ghl_id: selectedStaff,
        name,
        recurring,
        recurringDays: days,
        startMinutes: startMin,
        endMinutes: endMin,
        date: date ? date.toISOString() : undefined
      }

      const method = editingBlock ? 'PUT' : 'POST'
      const body = editingBlock ? { id: editingBlock['🔒 Row ID'], ...payload } : payload

      const res = await fetch('/api/time-blocks', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const result = await res.json()
      if (result.ok) {
        toast.success(editingBlock ? 'Break updated' : 'Break added')
        onOpenChange(false)
        onSuccess()
      } else {
        toast.error(result.error || 'Failed to save break')
      }
    } catch {
      toast.error('Error saving break')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingBlock ? 'Edit Break' : 'Add Break'}</DialogTitle>
          <DialogDescription>Configure a staff break time block</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <Select value={selectedStaff} onValueChange={setSelectedStaff} disabled={!!editingBlock}>
              <SelectTrigger className="h-12">
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Select staff" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {staff.map((m) => (
                  <SelectItem key={String((m as Record<string, unknown>).ghl_id)} value={String((m as Record<string, unknown>).ghl_id)}>
                    {String((m as Record<string, unknown>)["Barber/Name"] || '')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Break name (e.g., Lunch)" className="h-12" />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Select value={recurring ? 'true' : 'false'} onValueChange={(v) => setRecurring(v === 'true')}>
                <SelectTrigger className="h-12">
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="Recurring?" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">One-time</SelectItem>
                  <SelectItem value="true">Recurring</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!recurring && (
              <div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={`h-12 w-full justify-start text-left font-normal ${!date && 'text-muted-foreground'}`}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, 'PPP') : 'Block date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 border-0 shadow-lg" align="start">
                    <div className="bg-white rounded-lg border shadow-sm">
                      <Calendar mode="single" selected={date} onSelect={setDate} captionLayout="dropdown" className="rounded-lg" initialFocus />
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          {recurring && (
            <div className="grid grid-cols-2 gap-2">
              {DAYS.map(d => (
                <Button key={d} type="button" variant={days.includes(d) ? 'default' : 'outline'} onClick={() => toggleDay(d)} size="sm" className="justify-start">
                  {d}
                </Button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="h-12" />
            <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="h-12" />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button onClick={saveBlock} disabled={saving} className="bg-primary hover:bg-primary/90">
              {saving ? (<><RefreshCw className="h-4 w-4 mr-2 animate-spin"/>Saving...</>) : (<><Plus className="h-4 w-4 mr-2"/>{editingBlock ? 'Update Break' : 'Add Break'}</>)}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}


