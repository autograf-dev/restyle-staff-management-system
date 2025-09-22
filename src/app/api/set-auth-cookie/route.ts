import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("lv_auth", "1", {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
  });
  return res;
}


