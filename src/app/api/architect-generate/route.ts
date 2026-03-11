import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

const BASE = "https://serverless.on-demand.io/apps/script/api/v1";

// MongoDB ObjectId format — 24 hex chars. Rejects path-traversal / SSRF attempts.
const JOB_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit: 20 generations per user per hour
  const { allowed, retryAfterMs } = rateLimit(`architect-gen:${session.id}`, 20, 60 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit reached. Please wait before generating again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
    );
  }

  // Fetch apiKey server-side from DB — never trust client-supplied key (#5)
  const keyRecord = await prisma.architectApiKey.findUnique({ where: { userId: session.id } });
  if (!keyRecord?.key) {
    return NextResponse.json({ error: "No API key found. Generate one first." }, { status: 400 });
  }
  const apiKey = keyRecord.key;

  const body = await request.json();
  // Strip any client-supplied apiKey from payload for safety
  const { apiKey: _ignored, ...payload } = body as { apiKey?: string; [k: string]: unknown };

  try {
    const res = await fetch(`${BASE}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) {
        // Key is revoked — clear from DB so next request forces a regenerate
        await prisma.architectApiKey.delete({ where: { userId: session.id } }).catch(() => {});
      }
      return NextResponse.json({ error: `Generate API error ${res.status}`, detail: data }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch apiKey server-side — jobId comes from client, apiKey from DB (#5)
  const keyRecord = await prisma.architectApiKey.findUnique({ where: { userId: session.id } });
  if (!keyRecord?.key) {
    return NextResponse.json({ error: "No API key found." }, { status: 400 });
  }
  const apiKey = keyRecord.key;

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "Missing jobId" }, { status: 400 });

  // Validate jobId format — prevents path-traversal (e.g. "../../admin") being
  // interpolated into the upstream URL and used as an SSRF vector
  if (!JOB_ID_RE.test(jobId)) {
    return NextResponse.json({ error: "Invalid jobId format" }, { status: 400 });
  }

  try {
    const res = await fetch(`${BASE}/status/${jobId}`, {
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Status check failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
