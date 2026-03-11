import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

// RFC 5322-simplified email regex — catches obvious non-emails
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  // Rate limit: 5 registrations per IP per hour
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const { allowed, retryAfterMs } = rateLimit(`register:${ip}`, 5, 60 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many registration attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
    );
  }

  try {
    const body = await request.json();
    const { name, email, password } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email and password are required" },
        { status: 400 }
      );
    }

    // Input length limits
    if (name.length > 100) return NextResponse.json({ error: "Name too long (max 100 chars)" }, { status: 400 });
    if (email.length > 254) return NextResponse.json({ error: "Email too long" }, { status: 400 });
    if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    if (password.length > 128) return NextResponse.json({ error: "Password too long (max 128 chars)" }, { status: 400 });

    // Email format validation — prevents garbage like "notanemail" or "a@b"
    if (!EMAIL_RE.test(email.trim())) {
      return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (existingUser) {
      // Do NOT return 409 — that leaks whether an email is registered (user enumeration)
      // Return 200 with a generic message so the response is indistinguishable from success
      return NextResponse.json(
        { message: "If this email is new, your account has been created. Please sign in." },
        { status: 200 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role: "user",
      },
    });

    return NextResponse.json(
      { message: "Account created. Please sign in." },
      { status: 201 }
    );
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
