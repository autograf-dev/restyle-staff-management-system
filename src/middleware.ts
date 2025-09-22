import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if user is authenticated
  const hasCookie = request.cookies.get("lv_auth")?.value === "1";
  
  // Protected routes that require authentication
  const protectedRoutes = [
    "/dashboard",
    "/contacts", 
    "/opportunities",
    "/lab",
    "/legal",
    "/profile"
  ];

  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  if (isProtectedRoute && !hasCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/contacts/:path*", 
    "/opportunities/:path*",
    "/lab/:path*",
    "/legal/:path*",
    "/profile/:path*"
  ],
};


