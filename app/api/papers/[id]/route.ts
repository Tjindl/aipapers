import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const paper = await prisma.paper.findUnique({
    where: { id },
    include: { sources: true },
  });

  if (!paper) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...paper,
    authors: JSON.parse(paper.authors) as string[],
    categories: JSON.parse(paper.categories) as string[],
    tags: JSON.parse(paper.tags) as string[],
  });
}
