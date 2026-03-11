import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [totalUsers, totalProjects, recentUsers, seoKeyCount, architectKeyCount] = await Promise.all([
    prisma.user.count(),
    prisma.project.count(),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    }),
    prisma.seoApiKey.count(),
    prisma.architectApiKey.count(),
  ]);

  return NextResponse.json({ totalUsers, totalProjects, seoKeyCount, architectKeyCount, recentUsers });
}
