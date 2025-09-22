# Restyle Staff Management System

### App URL
- `https://app-restyle.netlify.app`

### Credits
- **Developer**: Tarun Kumar
- **IDE**: Cursor (editor only)
- **Hosting**: Netlify

### Tech Stack
- Next.js 15 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui components
- date-fns for date handling/formatting
- Supabase (Auth + Database)

### Main Features
- **KPI Dashboard** (`/dashboard`)
  - Total staff, working today, active leaves, upcoming 7‑day leaves
  - Recurring breaks count, today’s one‑time breaks
  - Data pulled from staff hours, leaves, and time blocks APIs

- **Teams** (`/teams` for admins)
  - Team-aware routing via `useTeam` prefixing

- **Settings**
  - `Salon Hours` (`/settings/salon-hours`): Business hours by day
  - `Salon Staff` (`/settings/salon-staff`): Staff directory
  - `Staff Hours` (`/settings/staff-hours`, `/settings/staff-hours/[ghl_id]`):
    - Per-day start/end in minutes
    - “Add Leave” button opens the leave dialog for the selected staff
  - `Leaves` (`/settings/leaves`):
    - Create/update/delete leaves with reason, start, and end
    - Dates saved as human‑readable strings (e.g., `M/d/yyyy, h:mm:ss a`)
  - `Breaks` (`/settings/breaks`):
    - Time Blocks (e.g., Lunch) with `recurring` true/false
    - Multiple days stored as comma‑separated names (e.g., `Monday,Tuesday`)
    - Start/End stored as minutes (strings) to align with staff hours
    - Non‑recurring blocks store a formatted `Block/Date`

### Supabase Integration
- Admin client in `src/lib/supabaseAdmin.ts` used by API routes
- API routes → tables mapping:
  - `GET/POST/PUT/DELETE /api/leaves` → `time_off`
    - Columns: `🔒 Row ID`, `ghl_id`, `Event/Name`, `Event/Start`, `Event/End`
    - `Event/Start`/`Event/End` saved as formatted strings (`M/d/yyyy, h:mm:ss a`)
  - `GET/POST/PUT/DELETE /api/time-blocks` → `time_block`
    - Columns: `🔒 Row ID`, `ghl_id`, `Block/Name`, `Block/Recurring` (`"true"/"false"`),
      `Block/Recurring Day` (CSV), `Block/Start`, `Block/End` (minutes as strings), `Block/Date`
  - `GET/PUT /api/barber-hours` → Staff working hours table (per‑day start/end minutes)

### Code Locations
- Dashboard KPIs: `src/app/dashboard/page.tsx`
- Leaves UI and dialog: `src/app/settings/leaves/page.tsx`, `src/components/leave-dialog.tsx`
- Breaks UI and dialog: `src/app/settings/breaks/page.tsx`, `src/components/time-block-dialog.tsx`
- APIs: `src/app/api/leaves/route.ts`, `src/app/api/time-blocks/route.ts`, `src/app/api/barber-hours/route.ts`

### Notes
- All times stored for hours/breaks are minutes‑since‑midnight (string) for consistency.
- Dates stored for leaves and non‑recurring blocks are formatted strings for readability and parity with legacy rows.
