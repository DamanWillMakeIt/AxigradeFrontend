import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET environment variable is not set.");
  }
  return new TextEncoder().encode(secret);
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("session")?.value;
  const path = request.nextUrl.pathname;
  const isAuthPage =
    path.startsWith("/auth/signin") || path.startsWith("/auth/signup");
  const isProtected =
    path.startsWith("/dashboard") ||
    path.startsWith("/tools") ||
    path.startsWith("/admin");

  let hasValidToken = false;
  let role: string | null = null;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, getSecret());
      hasValidToken = true;
      role = (payload as Record<string, unknown>)?.role as string ?? null;
    } catch {
      // Invalid/expired token — clear cookie and redirect if on a protected route
      const redirectUrl = new URL("/auth/signin", request.url);
      const redirectRes = NextResponse.redirect(redirectUrl);
      redirectRes.cookies.delete("session");

      const nextRes = NextResponse.next();
      nextRes.cookies.delete("session");

      if (isProtected) {
        return redirectRes;
      }
      return nextRes;
    }
  }

  if (hasValidToken && path.startsWith("/admin") && role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (hasValidToken && (isAuthPage || path === "/")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isProtected && !hasValidToken) {
    return NextResponse.redirect(new URL("/auth/signin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/auth/signin",
    "/auth/signup",
    "/dashboard",
    "/dashboard/:path*",
    "/tools",
    "/tools/:path*",
    "/admin",
    "/admin/:path*",
  ],
};
