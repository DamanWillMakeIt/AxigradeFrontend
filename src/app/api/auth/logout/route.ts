import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  // Delete server-side (Next.js cookies API)
  const cookieStore = await cookies();
  cookieStore.delete("session");

  // Also instruct the browser to expire the cookie immediately via Set-Cookie header.
  // Without this, some HTTP clients (e.g. mobile apps, certain browsers) may keep
  // serving the old cookie from their local jar until the 7-day maxAge expires.
  const response = NextResponse.json({ ok: true });
  response.cookies.set("session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });
  return response;
}
