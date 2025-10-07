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

interface Prefill {
  ghl_id: string
  name?: string
  startMinutes: number
  endMinutes: number
  date?: string // ISO
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  staff?: Array<Record<string, unknown>>
  editingBlock?: Record<string, unknown> | null
  onSuccess: () => void
  prefill?: Prefill
}

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]

export function TimeBlockDialog({ open, onOpenChange, staff = [], editingBlock, onSuccess, prefill }: Props) {
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
    } else if (prefill) {
      setSelectedStaff(prefill.ghl_id)
      setName(prefill.name || "Break")
      setRecurring(false)
      setDays([])
      setDate(prefill.date ? new Date(prefill.date) : new Date())
      const toHHMM = (m: number) => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`
      setStart(toHHMM(prefill.startMinutes))
      setEnd(toHHMM(prefill.endMinutes))
    } else {
      setName("Lunch")
      setRecurring(false)
      setDays([])
      setDate(undefined)
      setStart("12:00")
      setEnd("13:00")
    }
  }, [open, editingBlock, prefill])

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

    // Enforce salon working hours bounds
    try {
      const res = await fetch('/api/business-hours')
      const json = await res.json().catch(() => ({ ok: false }))
      if (json?.ok) {
        const dow = date ? new Date(date).getDay() : new Date().getDay()
        const day = (json.data || []).find((d: { day_of_week: number }) => d.day_of_week === dow)
        if (!day || day.is_open === false) {
          toast.error('Salon is closed on the selected day')
          return
        }
        if (day && day.is_open) {
          const minStart = Number(day.open_time ?? 0)
          const maxEnd = Number(day.close_time ?? 24*60)
          if (startMin < minStart || endMin > maxEnd) {
            toast.error('Break must be within salon working hours')
            return
          }
        }
      }
    } catch {}

    // Enforce staff working hours / off-day bounds
    try {
      const res = await fetch('/api/barber-hours')
      const json = await res.json().catch(() => ({ ok: false }))
      if (json?.ok) {
        const staffRow = (json.data || []).find((s: Record<string, unknown>) => String(s.ghl_id || '') === selectedStaff)
        if (staffRow) {
          const checkDay = (dayName: string) => {
            const startVal = Number(staffRow[`${dayName}/Start Value` as keyof typeof staffRow] as number | string | undefined || 0)
            const endVal = Number(staffRow[`${dayName}/End Value` as keyof typeof staffRow] as number | string | undefined || 0)
            if (startVal === 0 && endVal === 0) return { ok: false, reason: 'Staff is off that day' }
            if (startMin < startVal || endMin > endVal) return { ok: false, reason: 'Break must be within staff working hours' }
            return { ok: true }
          }

          const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
          if (recurring) {
            for (const d of days) {
              const resCheck = checkDay(d)
              if (!resCheck.ok) { toast.error(resCheck.reason); return }
            }
          } else {
            const dow = (date ? date.getDay() : new Date().getDay())
            const resCheck = checkDay(dayNames[dow])
            if (!resCheck.ok) { toast.error(resCheck.reason); return }
          }
        }
      }
    } catch {}
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


