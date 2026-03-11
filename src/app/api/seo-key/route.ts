import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getMongoDb } from "@/lib/mongo"; // ← singleton, no per-request connect/close

const SEO_BASE = "https://serverless.on-demand.io/apps/generate-seotags";

type LiveKeyData = {
  key: string;
  credits: number;
  callCount: number;
  isActive: boolean;
} | null;

// Uses the shared singleton MongoClient — never opens a new connection per request
async function getLiveKeyDataByEmail(email: string): Promise<LiveKeyData> {
  try {
    const db = await getMongoDb("axigrade");
    const doc = await db
      .collection("api_keys")
      .findOne({ user_id: email.trim() });
    if (!doc) return null;
    return {
      key:       doc.key       as string,
      credits:   doc.credits   as number,
      callCount: (doc.call_count ?? doc.callCount ?? 0) as number,
      isActive:  (doc.is_active  ?? doc.isActive  ?? true) as boolean,
    };
  } catch {
    return null;
  }
}

// ── GET ───────────────────────────────────────────────────────────────────
export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const live = await getLiveKeyDataByEmail(session.email);

  if (live) {
    const seoKey = await prisma.seoApiKey.upsert({
      where: { userId: session.id },
      create: {
        userId:    session.id,
        key:       live.key,
        agent:     "seo-tags",
        credits:   live.credits,
        callCount: live.callCount,
        isActive:  live.isActive,
      },
      update: {
        key:       live.key,
        credits:   live.credits,
        callCount: live.callCount,
        isActive:  live.isActive,
      },
    });
    return NextResponse.json({ seoKey });
  }

  const seoKey = await prisma.seoApiKey.findUnique({
    where: { userId: session.id },
  });
  return NextResponse.json({ seoKey: seoKey ?? null });
}

// ── POST ──────────────────────────────────────────────────────────────────
export async function POST() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const live = await getLiveKeyDataByEmail(session.email);

  if (live) {
    if (live.credits <= 0) {
      await prisma.seoApiKey.upsert({
        where: { userId: session.id },
        create: { userId: session.id, key: live.key, agent: "seo-tags", credits: 0, callCount: live.callCount, isActive: live.isActive },
        update: { key: live.key, credits: 0, callCount: live.callCount, isActive: live.isActive },
      }).catch(() => {});
      return NextResponse.json(
        { error: "Credits exhausted. Please contact support to top up your account.", credits: 0 },
        { status: 402 }
      );
    }

    const seoKey = await prisma.seoApiKey.upsert({
      where: { userId: session.id },
      create: { userId: session.id, key: live.key, agent: "seo-tags", credits: live.credits, callCount: live.callCount, isActive: live.isActive },
      update: { key: live.key, credits: live.credits, callCount: live.callCount, isActive: live.isActive },
    });
    return NextResponse.json({ seoKey, message: "Existing key returned" });
  }

  // No key at all — generate a fresh one
  const keyRes = await fetch(`${SEO_BASE}/seo/generate-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: session.email.trim() }),
  });

  const keyRaw = await keyRes.json().catch(() => ({}));

  if (!keyRes.ok) {
    if (keyRes.status === 409) {
      const recovered = await getLiveKeyDataByEmail(session.email);
      if (recovered) {
        const seoKey = await prisma.seoApiKey.upsert({
          where: { userId: session.id },
          create: { userId: session.id, key: recovered.key, agent: "seo-tags", credits: recovered.credits, callCount: recovered.callCount, isActive: recovered.isActive },
          update: { key: recovered.key, credits: recovered.credits, callCount: recovered.callCount, isActive: recovered.isActive },
        });
        return NextResponse.json({ seoKey, message: "Existing key recovered from API" });
      }
    }
    return NextResponse.json(
      { error: `Key generation failed: ${keyRes.status}`, detail: keyRaw },
      { status: keyRes.status }
    );
  }

  const freshLive = await getLiveKeyDataByEmail(session.email);
  const seoKey = await prisma.seoApiKey.upsert({
    where: { userId: session.id },
    create: {
      userId:    session.id,
      key:       freshLive?.key       ?? keyRaw.key,
      agent:     keyRaw.agent         ?? "seo-tags",
      credits:   freshLive?.credits   ?? keyRaw.credits   ?? 25,
      callCount: freshLive?.callCount ?? keyRaw.call_count ?? 0,
      isActive:  freshLive?.isActive  ?? true,
    },
    update: {
      key:       freshLive?.key       ?? keyRaw.key,
      credits:   freshLive?.credits   ?? keyRaw.credits   ?? 25,
      callCount: freshLive?.callCount ?? keyRaw.call_count ?? 0,
      isActive:  freshLive?.isActive  ?? true,
    },
  });

  return NextResponse.json({ seoKey, message: "Key generated successfully" });
}
