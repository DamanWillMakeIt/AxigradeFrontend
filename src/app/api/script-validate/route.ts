import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

const VALIDATOR_URL = "https://scriptvalidator.onrender.com/api/v1/validate";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();

    // Normalize: scenes may arrive nested or flat
    const scenes = body.scenes ?? body.script ?? [];

    if (!Array.isArray(scenes) || scenes.length === 0) {
      console.error("[script-validate] Missing or empty scenes. Body keys:", Object.keys(body));
      return NextResponse.json({ error: "scenes array is required" }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    let res: Response;
    try {
      res = await fetch(VALIDATOR_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes,
          tone: body.tone ?? "professional",
          topic: body.topic ?? "General",
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const data = await res.json();

    if (!res.ok) {
      console.error("[script-validate] Validator error:", res.status, data);
      return NextResponse.json(
        { error: `Validator API error ${res.status}`, detail: data },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json({ error: "Validator timed out. The server may be waking up — try again." }, { status: 504 });
    }
    console.error("[script-validate] Proxy error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Proxy request failed" }, { status: 500 });
  }
}