import { NextResponse } from "next/server";
export function middleware(request) {
  const response =
    request.nextUrl.pathname.startsWith("/admin") &&
    !request.cookies.get("ss_admin")
      ? NextResponse.redirect(new URL("/login", request.url))
      : NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "same-origin");
  if (
    request.nextUrl.pathname.startsWith("/api") ||
    request.nextUrl.pathname.startsWith("/admin") ||
    request.nextUrl.pathname.startsWith("/login")
  )
    response.headers.set("Cache-Control", "no-store");
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
