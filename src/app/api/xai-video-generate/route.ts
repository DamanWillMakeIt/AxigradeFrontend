import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createHash } from "crypto";
import { rateLimit } from "@/lib/rate-limit";

const XAI_VIDEO_BASE = "https://serverless.on-demand.io/apps/xai-video";

const CLOUDINARY_CLOUD  = process.env.CLOUDINARY_CLOUD_NAME!;
const CLOUDINARY_API_KEY    = process.env.CLOUDINARY_API_KEY!;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET!;

async function uploadToCloudinary(
  base64Data: string,
  mimeType: string,
  userId: string  // per-user folder isolation
): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder    = `xai_video_refs/${userId}`;  // isolated per user

  const signaturePayload = `folder=${folder}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
  const signature = createHash("sha1").update(signaturePayload).digest("hex");

  const formData = new FormData();
  formData.append("file",      `data:${mimeType};base64,${base64Data}`);
  formData.append("api_key",   CLOUDINARY_API_KEY);
  formData.append("timestamp", timestamp);
  formData.append("folder",    folder);
  formData.append("signature", signature);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
    { method: "POST", body: formData }
  );

  if (!res.ok) {
    // Don't log res.text() — could contain API key echoes
    throw new Error(`Cloudinary upload failed (status ${res.status})`);
  }

  const data = await res.json();
  return data.secure_url as string;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit: 10 video generations per user per hour
  const { allowed, retryAfterMs } = rateLimit(`xai-video:${session.id}`, 10, 60 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit reached. Please wait before generating another video." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
    );
  }

  const body = await request.json();

  // Extract xaiApiKey first so it never appears in logged variables
  const xaiApiKey: string | undefined = body?.xaiApiKey;
  const { prompt, duration = 15, images = [] } = body as {
    prompt: string;
    duration?: number;
    images?: { base64: string; mimeType: string }[];
  };

  if (!xaiApiKey) return NextResponse.json({ error: "Missing xaiApiKey — please enter your xAI API key." }, { status: 400 });
  if (!prompt)    return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
  if (prompt.length > 2000) return NextResponse.json({ error: "Prompt too long (max 2000 chars)" }, { status: 400 });

  // Validate duration — prevent out-of-range values being forwarded to the API
  if (typeof duration !== "number" || duration < 1 || duration > 60 || !Number.isFinite(duration)) {
    return NextResponse.json({ error: "duration must be a number between 1 and 60" }, { status: 400 });
  }

  // Validate images array — cap count, enforce allowed MIME types, enforce base64 size
  const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  const MAX_IMAGE_BASE64_CHARS = 10 * 1024 * 1024; // ~7.5 MB raw (base64 overhead ~33%)
  if (!Array.isArray(images)) {
    return NextResponse.json({ error: "images must be an array" }, { status: 400 });
  }
  if (images.length > 1) {
    return NextResponse.json({ error: "Only one reference image is supported" }, { status: 400 });
  }
  if (images.length === 1) {
    const img = images[0];
    if (!img?.base64 || !img?.mimeType) {
      return NextResponse.json({ error: "Each image must have base64 and mimeType fields" }, { status: 400 });
    }
    if (!ALLOWED_MIME_TYPES.has(img.mimeType)) {
      return NextResponse.json({ error: "Unsupported image type. Allowed: jpeg, png, webp, gif" }, { status: 400 });
    }
    if (img.base64.length > MAX_IMAGE_BASE64_CHARS) {
      return NextResponse.json({ error: "Image too large (max ~7.5 MB)" }, { status: 413 });
    }
  }

  try {
    let imageUrl: string | undefined;
    if (images.length > 0) {
      imageUrl = await uploadToCloudinary(images[0].base64, images[0].mimeType, session.id);
    }

    const payload: Record<string, unknown> = { prompt, duration };
    if (imageUrl) payload.image_url = imageUrl;

    const res = await fetch(`${XAI_VIDEO_BASE}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": xaiApiKey },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: `xAI Video API error ${res.status}`, detail: data },
        { status: res.status }
      );
    }

    return NextResponse.json({ ...data, cloudinary_url: imageUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Video generation failed";
    console.error("xai-video-generate error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
