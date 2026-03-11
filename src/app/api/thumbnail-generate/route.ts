import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 10 thumbnail generations per user per hour
  const { allowed, retryAfterMs } = rateLimit(`thumbnail:${session.id}`, 10, 60 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit reached. Please wait before generating another thumbnail." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
    );
  }

  try {
    const formData = await req.formData();

    const image     = formData.get("image")      as File | null;
    const videoTitle = formData.get("videoTitle") as string | null;
    const summary   = formData.get("summary")    as string | null;
    const prompt    = formData.get("prompt")     as string | null;
    // Extract key immediately and never let it appear in logs or error messages
    const xaiApiKey = formData.get("xaiApiKey")  as string | null;

    if (!image)      return NextResponse.json({ error: "Reference image is required" }, { status: 400 });
    if (!videoTitle) return NextResponse.json({ error: "Video title is required" }, { status: 400 });
    if (!prompt)     return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    if (!xaiApiKey)  return NextResponse.json({ error: "xAI API key is required" }, { status: 400 });

    // Input length limits
    if (videoTitle.length > 200) return NextResponse.json({ error: "Video title too long (max 200 chars)" }, { status: 400 });
    if (prompt.length > 1000)    return NextResponse.json({ error: "Prompt too long (max 1000 chars)" }, { status: 400 });

    // Per-user Cloudinary folder — isolates user uploads
    const userFolder = `axigrade-thumbnails/${session.id}`;

    const bytes = await image.arrayBuffer();

    // Reject images over 10 MB before uploading to Cloudinary
    const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Image too large (max 10 MB)" }, { status: 413 });
    }

    const base64Image = Buffer.from(bytes).toString("base64");

    const uploadResult = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader.upload(
        `data:${image.type};base64,${base64Image}`,
        { folder: userFolder, resource_type: "image" },
        (error, result) => {
          if (error || !result) reject(error ?? new Error("Upload returned no result"));
          else resolve(result as { secure_url: string });
        }
      );
    });

    const cloudinaryUrl = uploadResult.secure_url;

    const aiPrompt = [
      `Video Title: "${videoTitle}"`,
      summary ? `Summary: ${summary}` : "",
      `Reference Image URL: ${cloudinaryUrl}`,
      `Task: ${prompt}`,
      "Generate a YouTube thumbnail concept based on the above. The thumbnail should be eye-catching, clickable, and optimised for YouTube.",
    ].filter(Boolean).join("\n\n");

    // xAI key used here only — never included in any log or error response
    const xaiResponse = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${xaiApiKey}`,
      },
      body: JSON.stringify({
        model: "grok-beta",
        messages: [
          { role: "system", content: "You are an expert YouTube thumbnail designer. Analyse the reference image and create compelling thumbnail concepts." },
          { role: "user", content: aiPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!xaiResponse.ok) {
      // Do NOT include the response body verbatim — it might echo auth details
      return NextResponse.json(
        { error: `xAI API returned status ${xaiResponse.status}` },
        { status: xaiResponse.status }
      );
    }

    const xaiData = await xaiResponse.json();
    const thumbnailConcept = xaiData.choices?.[0]?.message?.content ?? "No concept generated";

    return NextResponse.json({
      success: true,
      cloudinaryUrl,
      thumbnailConcept,
      videoTitle,
      summary,
    });
  } catch (error: unknown) {
    // Never log the full error object — it might contain the API key in a stack trace
    const message = error instanceof Error ? error.message : "Failed to generate thumbnail";
    console.error("Thumbnail generation error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
