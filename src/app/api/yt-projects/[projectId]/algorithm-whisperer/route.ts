import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getMongoDb } from "@/lib/mongo";
import { rateLimit } from "@/lib/rate-limit";

const SEO_BASE = "https://serverless.on-demand.io/apps/generate-seotags";
const MAX_DATA_BYTES = 500 * 1024; // 500 KB

// Matches UUID and hex job_id formats from the upstream API
const JOB_ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;

type RouteParams = { params: { projectId: string } };

// Shape stored inside prisma.algorithmWhisperer.data
// This model has ONE job: cache the final SEO result so page loads are instant.
// It is NOT a job tracker — the `jobs` MongoDB collection owns that.
type AlgoDoc = {
  job_id?: string;   // stored on submit so the GET poller can look up the right job
  title?: string;    // stored so we can detect cache hits on the same title
  status?: "processing" | "done" | "error";
  result?: unknown;  // populated once, never changed again
  completedAt?: string;
  submittedAt?: string; // ISO timestamp written at job submission
};

// ── GET ────────────────────────────────────────────────────────────────────
//
// Two modes:
//   • No ?jobId  → page load, return the cached Prisma doc (instant)
//   • ?jobId=xxx → status poll, read `jobs` collection in MongoDB directly
//
// We read MongoDB's `jobs` collection instead of calling the upstream HTTP
// poll endpoint because the upstream API writes job state there in real-time.
// This means each poll is a 5–10ms local DB read instead of an outbound HTTP
// round-trip, with no dependency on the upstream API's availability or rate limits.
export async function GET(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await prisma.project.findFirst({
    where: { id: params.projectId, userId: session.id },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");

  // ── Page load: return cached Prisma document ───────────────────────────
  if (!jobId) {
    const doc = await prisma.algorithmWhisperer.findUnique({
      where: { projectId: project.id },
    });
    return NextResponse.json({ document: doc ?? null });
  }

  // ── Poll: validate jobId then read `jobs` collection directly ──────────
  if (!JOB_ID_RE.test(jobId)) {
    return NextResponse.json({ error: "Invalid jobId format" }, { status: 400 });
  }

  // Fast-path: result already in Prisma (a previous poll already finished it)
  const prismaDoc = await prisma.algorithmWhisperer.findUnique({
    where: { projectId: project.id },
  });
  const stored = prismaDoc?.data as AlgoDoc | null;
  if (stored?.status === "done" && stored?.result) {
    return NextResponse.json({ status: "done", result: stored.result });
  }

  // Read from the `jobs` collection — the upstream API owns and writes this
  try {
    const db = await getMongoDb("axigrade");
    const jobDoc = await db.collection("jobs").findOne({ job_id: jobId });

    if (!jobDoc) {
      // Not yet visible — still queued
      return NextResponse.json({ status: "processing" });
    }

    const jobStatus: string = jobDoc.status ?? "processing";

    if (jobStatus === "done" && jobDoc.result) {
      // Persist into Prisma once — all future page loads hit Prisma, never jobs collection again
      await prisma.algorithmWhisperer.upsert({
        where: { projectId: project.id },
        create: {
          projectId: project.id,
          data: {
            job_id: jobId,
            title: stored?.title ?? "",
            status: "done",
            result: jobDoc.result,
            completedAt: new Date().toISOString(),
          } satisfies AlgoDoc,
        },
        update: {
          data: {
            job_id: jobId,
            title: stored?.title ?? "",
            status: "done",
            result: jobDoc.result,
            completedAt: new Date().toISOString(),
          } satisfies AlgoDoc,
        },
      }).catch(() => {});

      return NextResponse.json({ status: "done", result: jobDoc.result });
    }

    if (jobStatus === "error" || jobStatus === "failed") {
      const errorMsg = (jobDoc.error as string) ?? "SEO job failed on server";
      await prisma.algorithmWhisperer.upsert({
        where: { projectId: project.id },
        create: {
          projectId: project.id,
          data: { job_id: jobId, title: stored?.title ?? "", status: "error" } satisfies AlgoDoc,
        },
        update: {
          data: { job_id: jobId, title: stored?.title ?? "", status: "error" } satisfies AlgoDoc,
        },
      }).catch(() => {});
      return NextResponse.json({ status: "error", error: errorMsg });
    }

    return NextResponse.json({ status: "processing" });

  } catch (err: unknown) {
    // Non-fatal — client retries in 5s
    console.error("[AlgoWhisperer] jobs collection read error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ status: "processing" });
  }
}

// ── PUT — manual document save (user edits) ────────────────────────────────
export async function PUT(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await prisma.project.findFirst({
    where: { id: params.projectId, userId: session.id },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_DATA_BYTES) {
    return NextResponse.json({ error: "Payload too large (max 500 KB)" }, { status: 413 });
  }

  let body: { data?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const doc = await prisma.algorithmWhisperer.upsert({
    where: { projectId: project.id },
    create: { projectId: project.id, data: (body?.data as object) ?? {} },
    update: { data: (body?.data as object) ?? {} },
  });
  return NextResponse.json({ document: doc });
}

// ── POST — submit SEO job; returns 202 immediately ────────────────────────
//
// Architecture:
//   1. Validate inputs & get API key (from MongoDB api_keys, or generate fresh)
//   2. Check Prisma cache — if same title was already processed, return result instantly
//   3. Submit job to upstream SEO API (fast, ~1–2s)
//   4. Save ONLY { job_id, title, status: "processing" } into Prisma algorithmWhisperer
//      — tiny write, not a job tracker, just enough for the GET poller to find the job
//   5. Return 202 immediately — client polls GET ?jobId=xxx every 5s
//      GET reads `jobs` MongoDB collection directly, no HTTP calls
export async function POST(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed, retryAfterMs } = rateLimit(`algo-whisperer:${session.id}`, 10, 60 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit reached. Please wait before generating again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
    );
  }

  const project = await prisma.project.findFirst({
    where: { id: params.projectId, userId: session.id },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const body = await request.json();
  const { title, script } = body;

  if (!title?.trim()) return NextResponse.json({ error: "title is required" }, { status: 400 });
  if (!script?.trim()) return NextResponse.json({ error: "script is required" }, { status: 400 });
  if (title.length > 300) return NextResponse.json({ error: "title too long (max 300 chars)" }, { status: 400 });
  if (script.length > 50000) return NextResponse.json({ error: "script too long (max 50,000 chars)" }, { status: 400 });

  // ── Step 1: Resolve API key ───────────────────────────────────────────────
  // Primary source: MongoDB api_keys collection (live, always up to date)
  // Fallback: generate a new key from the upstream API
  let apiKey: string | null = null;

  try {
    const db = await getMongoDb("axigrade");
    const liveDoc = await db.collection("api_keys").findOne({
      user_id: session.email.trim(),
      agent: "seo-tags",
    });

    if (liveDoc?.key) {
      apiKey = liveDoc.key as string;
      const credits = (liveDoc.credits ?? 0) as number;
      if (credits <= 0) {
        return NextResponse.json(
          { error: "You have no SEO credits remaining. Please contact support." },
          { status: 403 }
        );
      }
      // Keep Prisma seoApiKey in sync (used by the key display UI)
      await prisma.seoApiKey.upsert({
        where: { userId: session.id },
        create: {
          userId: session.id,
          key: apiKey,
          agent: "seo-tags",
          credits,
          callCount: (liveDoc.call_count ?? 0) as number,
          isActive: true,
        },
        update: { key: apiKey, credits, callCount: (liveDoc.call_count ?? 0) as number, isActive: true },
      }).catch(() => {});
    }
  } catch (e) {
    console.error("[AlgoWhisperer] api_keys lookup failed:", e);
  }

  if (!apiKey) {
    const keyRes = await fetch(`${SEO_BASE}/seo/generate-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: session.email.trim() }),
    });
    const keyData = await keyRes.json().catch(() => ({}));
    if ((!keyRes.ok && keyRes.status !== 409) || !keyData.key) {
      return NextResponse.json({ error: "Failed to generate SEO key. Please try again." }, { status: 500 });
    }
    apiKey = keyData.key as string;
    await prisma.seoApiKey.upsert({
      where: { userId: session.id },
      create: {
        userId: session.id,
        key: apiKey,
        agent: keyData.agent ?? "seo-tags",
        credits: keyData.credits ?? 25,
        callCount: 0,
        isActive: true,
      },
      update: { key: apiKey, credits: keyData.credits ?? 25, isActive: true },
    }).catch(() => {});
  }

  // ── Step 2: Cache hit ─────────────────────────────────────────────────────
  // If we already have a completed result for this exact title, return it instantly
  // and skip the API call entirely (saves a credit too)
  const existingDoc = await prisma.algorithmWhisperer.findUnique({
    where: { projectId: project.id },
  });
  const existingData = existingDoc?.data as AlgoDoc | null;
  if (existingData?.title === title && existingData?.status === "done" && existingData?.result) {
    return NextResponse.json({ status: "done", result: existingData.result, cached: true });
  }

  // ── Step 3: Submit job & return 202 immediately ───────────────────────────
  try {
    const submitRes = await fetch(`${SEO_BASE}/architect/seo`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
      body: JSON.stringify({ title, script }),
    });

    if (!submitRes.ok) {
      const err = await submitRes.json().catch(() => ({}));
      throw new Error(`SEO submission failed: ${submitRes.status} — ${JSON.stringify(err)}`);
    }

    const { job_id: jobId } = await submitRes.json();
    if (!jobId) throw new Error("Upstream API returned no job_id");

    // Increment usage counter for display in UI
    await prisma.seoApiKey.update({
      where: { userId: session.id },
      data: { callCount: { increment: 1 } },
    }).catch(() => {});

    // Save minimal state — just enough for the GET poller to find the job in `jobs` collection
    // NOT a job tracker. The `jobs` MongoDB collection is the source of truth for status.
    await prisma.algorithmWhisperer.upsert({
      where: { projectId: project.id },
      create: {
        projectId: project.id,
        data: { job_id: jobId, title, status: "processing", submittedAt: new Date().toISOString() } satisfies AlgoDoc,
      },
      update: {
        data: { job_id: jobId, title, status: "processing", submittedAt: new Date().toISOString() } satisfies AlgoDoc,
      },
    });

    return NextResponse.json({ status: "processing", job_id: jobId }, { status: 202 });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "SEO generation failed";
    console.error("[AlgoWhisperer] Submission error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
