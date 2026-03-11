import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const MAX_DATA_BYTES = 500 * 1024; // 500 KB

type RouteParams = {
  params: {
    projectId: string;
  };
};

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const project = await prisma.project.findFirst({
    where: { id: params.projectId, userId: session.id },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const doc = await prisma.clickEngineer.findUnique({
    where: { projectId: project.id },
  });

  return NextResponse.json({ document: doc ?? null });
}

export async function PUT(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const project = await prisma.project.findFirst({
    where: { id: params.projectId, userId: session.id },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Guard against oversized payloads being written to DB
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

  const doc = await prisma.clickEngineer.upsert({
    where: { projectId: project.id },
    create: {
      projectId: project.id,
      data: (body?.data as object) ?? {},
    },
    update: {
      data: (body?.data as object) ?? {},
    },
  });

  return NextResponse.json({ document: doc });
}
