"use client"

import React from "react"
import { Button } from "@/components/ui/button"

export default function PublicBookingPage() {
  const [open, setOpen] = React.useState(false)

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-6">
      <div className="max-w-xl w-full rounded-2xl border border-neutral-200 bg-white p-8 text-center">
        <h1 className="text-2xl font-semibold text-neutral-900 mb-2">Book an Appointment</h1>
        <p className="text-neutral-600 mb-6">Click the button below to open the booking dialog.</p>
        <Button onClick={() => setOpen(true)} className="bg-[#7b1d1d] hover:bg-[#6b1717] text-white rounded-lg">
          Add Appointment
        </Button>
        {/* Render only the booking dialog by using embedOnly=1 */}
        {open && (
          <iframe
            src="/appointments?openBooking=1&embedOnly=1"
            className="fixed inset-0 z-[60] w-[95vw] h-[95vh] mx-auto my-auto border-0 rounded-2xl shadow-2xl"
            style={{ left: '2.5vw', top: '2.5vh' }}
            allow="clipboard-write; fullscreen"
          />
        )}
      </div>
    </div>
  )
}


