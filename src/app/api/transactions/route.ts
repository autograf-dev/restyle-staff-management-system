import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

export async function POST(req: Request) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY on server" },
        { status: 500 }
      )
    }

    const body = await req.json()
    const { transaction, items } = body as {
      transaction: any
      items: any[]
    }

    if (!transaction || !Array.isArray(items)) {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 })
    }

    // Insert into "Transactions"
    const txRow = {
      "🔒 Row ID": transaction.id,
      "Booking/ID": transaction.bookingId ?? null,
      "Booking/Service Lookup": transaction.bookingServiceLookup ?? null,
      "Booking/Booked Rate": transaction.bookingBookedRate ?? null,
      "Booking/Customer Phone": transaction.bookingCustomerPhone ?? null,
      "Booking/Type": transaction.bookingType ?? null,
      "Customer/Phone": transaction.customerPhone ?? null,
      "Customer/Lookup": transaction.customerLookup ?? null,
      "Payment/Date": transaction.paymentDate ?? null,
      "Payment/Method": transaction.method ?? null,
      "Payment/Sort": transaction.paymentSort ?? null,
      "Payment/Staff": transaction.paymentStaff ?? null,
      "Payment/Subtotal": transaction.subtotal ?? null,
      "Payment/Status": transaction.status ?? "Paid",
      "Transaction/Services": transaction.transactionServices ?? transaction.subtotal ?? null,
      "Transaction/Services Total": transaction.transactionServicesTotal ?? transaction.subtotal ?? null,
      "Transaction/Tax": transaction.tax ?? null,
      "Transaction/Total Paid": transaction.totalPaid ?? null,
      "Service/Joined List": transaction.serviceNamesJoined ?? null,
      // Store concatenated service IDs for the transaction (from payload)
      "Service/Acuity IDs": transaction.serviceAcuityIds ?? null,
      "DNU Service/Name": null,
      "DNU Service/Subtotal": null,
      "DNU Service/Total": null,
      "Summary/DD": null,
      "Summary/Year": null,
      "Summary/Month": null,
      "Summary/Week": null,
      "Summary/Date": null,
      "Summary/Range": null,
      "Summary/All": null,
      "Summary/MM": null,
      "Summary/YY": null,
      "Summary/Month ID": null,
      "Summary/Staff List": null,
      "Transaction/Tip": transaction.tip ?? null,
      "DNU Service/Tip Split": null,
      "DNU Add-On/Subtotal": null,
      "DNU Add-On/Total": null,
      "DNU Add-On/Tip Split": null,
      "DNU Add-On/Staff": null,
      "Walk-In/Customer ID": transaction.walkInCustomerId ?? null,
      "Walk-In/Phone": transaction.walkInPhone ?? null,
      "DNU Service/Discount": null,
      "DNU Add-On/Discount": null,
      "Transaction/Product": null,
      "Service/Acuity IDs": transaction.serviceAcuityIds ?? null,
      "DNU Add-On/IDs": null,
      "DNU Transaction/Tax": null,
      "DNU Transaction/Tip": null,
      "Transaction/Services New": null,
      "Transaction/Paid": "Yes",
      "Transaction/Reward": null,
    }

    const { error: txError } = await supabaseAdmin
      .from("Transactions")
      .insert([txRow])

    if (txError) {
      return NextResponse.json({ ok: false, error: txError.message }, { status: 400 })
    }

    // Insert into "Transaction Items"
    const itemRows = items.map((it) => ({
      "🔒 Row ID": it.id,
      "Payment/ID": it.paymentId,
      "VALUES JOINED 2": it.valuesJoined2 ?? null,
      "STATUS JOINED": it.statusJoined ?? null,
      "Staff/Name": it.staffName ?? null,
      "Staff/Tip Split": it.staffTipSplit ?? null,
      "Staff/Tip Collected": it.staffTipCollected ?? null,
      "Service/ID": it.serviceId ?? null,
      "Service/Name": it.serviceName ?? null,
      "Service/Price": it.price ?? null,
    }))

    if (itemRows.length > 0) {
      const { error: itemError } = await supabaseAdmin
        .from("Transaction Items")
        .insert(itemRows)
      if (itemError) {
        return NextResponse.json({ ok: false, error: itemError.message }, { status: 400 })
      }
    }

    return NextResponse.json({ ok: true, id: transaction.id })
  } catch (error: any) {
    console.error("/api/transactions error", error)
    return NextResponse.json({ ok: false, error: "Failed to create transaction" }, { status: 500 })
  }
}


