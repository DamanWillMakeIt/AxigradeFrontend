import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SCRIPT_API = "https://serverless.on-demand.io/apps/script/api/v1/auth/generate-key";
const SCRIPT_BASE = "https://serverless.on-demand.io/apps/script/api/v1";

async function isKeyValid(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${SCRIPT_BASE}/status/ping`, {
      method: "GET",
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
    });
    return res.status !== 401;
  } catch {
    return true;
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const record = await prisma.architectApiKey.findUnique({
    where: { userId: session.id },
  });

  return NextResponse.json({ api_key: record?.key ?? null });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const force = body?.force === true;

  const existing = await prisma.architectApiKey.findUnique({
    where: { userId: session.id },
  });

  if (existing?.key) {
    if (!force) {
      return NextResponse.json({ api_key: existing.key });
    }

    const valid = await isKeyValid(existing.key);
    if (valid) {
      return NextResponse.json({ api_key: existing.key });
    }

    await prisma.architectApiKey.delete({ where: { userId: session.id } }).catch(() => {});
  }

  try {
    const res = await fetch(SCRIPT_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: session.email.trim() }),
    });

    const data = await res.json();

    if (res.ok || res.status === 409) {
      const apiKey =
        data.api_key ||
        data.key ||
        data.token ||
        data.data?.api_key ||
        data.data?.key;

      if (apiKey) {
        await prisma.architectApiKey.upsert({
          where: { userId: session.id },
          create: { userId: session.id, key: apiKey, isActive: true },
          update: { key: apiKey, isActive: true },
        });
        return NextResponse.json({ api_key: apiKey });
      }

      return NextResponse.json(
        { error: `No key found in response (status ${res.status})` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: `External API returned ${res.status}`, detail: data },
      { status: res.status }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to generate API key";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.architectApiKey.delete({
    where: { userId: session.id },
  }).catch(() => {});

  return NextResponse.json({ success: true });
}
