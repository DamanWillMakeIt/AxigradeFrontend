import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;

// Input length limits — prevents prompt injection bloat and excessive Gemini token usage
const MAX_INSTRUCTION_LEN    = 500;
const MAX_DIALOGUE_LEN       = 10000;
const MAX_VEO_PROMPT_LEN     = 2000;
const MAX_SHOOT_INSTR_LEN    = 2000;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit: 30 scene modifications per user per hour
  const { allowed, retryAfterMs } = rateLimit(`scene-modify:${session.id}`, 30, 60 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many modifications. Please wait before trying again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
    );
  }

  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured on server" }, { status: 500 });
  }

  const body = await request.json();
  const {
    instruction,
    currentDialogue,
    currentVeoPrompt,
    shootInstructions,
    sceneNumber,
  } = body as {
    instruction: string;
    currentDialogue: string;
    currentVeoPrompt: string;
    shootInstructions: string;
    sceneNumber: number;
  };

  // Input presence checks
  if (!instruction?.trim()) return NextResponse.json({ error: "Missing instruction" }, { status: 400 });

  // Input length limits — prevents prompt injection and runaway API costs
  if (instruction.length > MAX_INSTRUCTION_LEN)
    return NextResponse.json({ error: `Instruction too long (max ${MAX_INSTRUCTION_LEN} chars)` }, { status: 400 });
  if (currentDialogue && currentDialogue.length > MAX_DIALOGUE_LEN)
    return NextResponse.json({ error: `Dialogue too long (max ${MAX_DIALOGUE_LEN} chars)` }, { status: 400 });
  if (currentVeoPrompt && currentVeoPrompt.length > MAX_VEO_PROMPT_LEN)
    return NextResponse.json({ error: `VEO prompt too long (max ${MAX_VEO_PROMPT_LEN} chars)` }, { status: 400 });
  if (shootInstructions && shootInstructions.length > MAX_SHOOT_INSTR_LEN)
    return NextResponse.json({ error: `Shoot instructions too long (max ${MAX_SHOOT_INSTR_LEN} chars)` }, { status: 400 });

  const systemPrompt = `You are a professional video script writer and cinematographer. 
You will be given a scene's script dialogue, VEO video generation prompt, and shoot instructions.
Apply the user's requested changes and return ONLY a JSON object with this exact shape:
{
  "dialogue": "<updated script dialogue>",
  "veo_prompt": "<updated veo generation prompt>"
}
Do not include any explanation, markdown, or extra text. Only raw JSON.`;

  const userMessage = `Scene ${sceneNumber} — Apply this change: "${instruction}"

Current Script Dialogue:
${currentDialogue}

Current VEO Generation Prompt:
${currentVeoPrompt}

Shoot Instructions (for context only, do not modify):
${shootInstructions}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userMessage }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: `Gemini API error ${res.status}`, detail: data },
        { status: res.status }
      );
    }

    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const clean = rawText.replace(/```json|```/g, "").trim();

    let parsed: { dialogue: string; veo_prompt: string };
    try {
      parsed = JSON.parse(clean);
    } catch {
      return NextResponse.json(
        { error: "Gemini returned non-JSON response", raw: rawText },
        { status: 500 }
      );
    }

    if (!parsed.dialogue || !parsed.veo_prompt) {
      return NextResponse.json(
        { error: "Gemini response missing fields", raw: rawText },
        { status: 500 }
      );
    }

    return NextResponse.json({ dialogue: parsed.dialogue, veo_prompt: parsed.veo_prompt });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Scene modification failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
