"use client"

import * as React from "react"
import { Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { minutesToDisplayTime } from "@/lib/timeUtils"

interface TimePickerProps {
  value?: number // minutes since midnight
  onChange?: (minutes: number) => void
  label?: string
  disabled?: boolean
  placeholder?: string
}

export function TimePicker({ 
  value, 
  onChange, 
  label, 
  disabled = false,
  placeholder = "Select time"
}: TimePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [hours, setHours] = React.useState(value ? Math.floor(value / 60) : 9)
  const [minutes, setMinutes] = React.useState(value ? value % 60 : 0)

  // Update internal state when value prop changes
  React.useEffect(() => {
    if (value !== undefined) {
      setHours(Math.floor(value / 60))
      setMinutes(value % 60)
    }
  }, [value])

  const handleTimeChange = (newHours: number, newMinutes: number) => {
    const totalMinutes = newHours * 60 + newMinutes
    onChange?.(totalMinutes)
  }

  const displayTime = value !== undefined ? minutesToDisplayTime(value) : placeholder

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !value && "text-muted-foreground"
            )}
            disabled={disabled}
          >
            <Clock className="mr-2 h-4 w-4" />
            {displayTime}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-4" align="start">
          <div className="space-y-4">
            <div className="text-sm font-medium">Select Time</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hours">Hours</Label>
                <Input
                  id="hours"
                  type="number"
                  min="0"
                  max="23"
                  value={hours}
                  onChange={(e) => {
                    const newHours = Math.max(0, Math.min(23, parseInt(e.target.value) || 0))
                    setHours(newHours)
                    handleTimeChange(newHours, minutes)
                  }}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minutes">Minutes</Label>
                <Input
                  id="minutes"
                  type="number"
                  min="0"
                  max="59"
                  step="15"
                  value={minutes}
                  onChange={(e) => {
                    const newMinutes = Math.max(0, Math.min(59, parseInt(e.target.value) || 0))
                    setMinutes(newMinutes)
                    handleTimeChange(hours, newMinutes)
                  }}
                  className="w-full"
                />
              </div>
            </div>
            <div className="text-xs text-muted-foreground text-center">
              {minutesToDisplayTime(hours * 60 + minutes)}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setHours(9)
                  setMinutes(0)
                  handleTimeChange(9, 0)
                }}
                className="flex-1"
              >
                9:00 AM
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setHours(17)
                  setMinutes(0)
                  handleTimeChange(17, 0)
                }}
                className="flex-1"
              >
                5:00 PM
              </Button>
            </div>
            <Button 
              size="sm" 
              className="w-full" 
              onClick={() => setIsOpen(false)}
            >
              Done
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
