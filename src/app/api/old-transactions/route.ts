import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

export async function GET(req: Request) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY on server" },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(req.url)
    const limit = Number(searchParams.get('limit') || 100)

    const { data, error } = await supabaseAdmin
      .from('old_transactions')
      .select('*')
      .limit(limit)
      .order('idx', { ascending: false })

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    }

    // Transform the data to a more usable format
    const rows = (data || []).map((row: Record<string, unknown>) => ({
      idx: row.idx,
      rowId: row.row_id,
      bookingId: row['Booking/ID'],
      bookingServiceLookup: row['Booking/Service Lookup'],
      bookingBookedRate: row['Booking/Booked Rate'],
      bookingCustomerPhone: row['Booking/Customer Phone'],
      bookingType: row['Booking/Type'],
      customerPhone: row['Customer/Phone'],
      customerLookup: row['Customer/Lookup'],
      paymentDate: row['Payment/Date'],
      paymentMethod: row['Payment/Method'],
      paymentSort: row['Payment/Sort'],
      paymentStaff: row['Payment/Staff'],
      paymentStatus: row['Payment/Status'],
      transactionServices: row['Transaction/Services'],
      transactionServicesTotal: row['Transaction/Services Total'],
      transactionTax: row['Transaction/Tax'],
      transactionTotalPaid: row['Transaction/Total Paid'],
      serviceJoinedList: row['Service/Joined List'],
      summaryDD: row['Summary/DD'],
      summaryYear: row['Summary/Year'],
      summaryMonth: row['Summary/Month'],
      summaryWeek: row['Summary/Week'],
      summaryDate: row['Summary/Date'],
      summaryRange: row['Summary/Range'],
      summaryAll: row['Summary/All'],
      summaryMM: row['Summary/MM'],
      summaryYY: row['Summary/YY'],
      summaryMonthID: row['Summary/Month ID'],
      summaryStaffList: row['Summary/Staff List'],
      paymentSubtotal: row['Payment/Subtotal'],
      transactionTip: row['Transaction/Tip'],
      walkInCustomerId: row['Walk-In/Customer ID'],
      walkInPhone: row['Walk-In/Phone'],
      transactionServicesNew: row['Transaction/Services New'],
      transactionPaid: row['Transaction/Paid'],
      transactionReward: row['Transaction/Reward'],
      joinedStaffList: row['joined_staff_list'],
      serviceAcuityIds: row['Service/Acuity IDs'],
    }))

    return NextResponse.json({ ok: true, data: rows })
  } catch (e: unknown) {
    console.error('Error fetching old transactions:', e)
    return NextResponse.json({ ok: false, error: 'Failed to fetch old transactions' }, { status: 500 })
  }
}