import { redirect } from 'next/navigation'

export default function AdminCalendarPage() {
  // For now, redirect to the main calendar with a note that this is coming soon
  redirect('/calendar?admin=true')
}
