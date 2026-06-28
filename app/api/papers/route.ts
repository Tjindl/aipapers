import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const query = searchParams.get("query") ?? "";
  const source = searchParams.get("source") ?? "";
  const category = searchParams.get("category") ?? "";
  const tag = searchParams.get("tag") ?? "";
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";
  const minCitations = parseInt(searchParams.get("minCitations") ?? "0", 10);
  const sort = searchParams.get("sort") ?? "newest";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));

  // Build where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (query) {
    where.OR = [
      { title: { contains: query } },
      { abstract: { contains: query } },
      { authors: { contains: query } },
    ];
  }

  if (source) {
    where.sources = { some: { source } };
  }

  if (category) {
    where.categories = { contains: category };
  }

  if (tag) {
    where.tags = { contains: tag };
  }

  if (dateFrom || dateTo) {
    where.publishedDate = {};
    if (dateFrom) where.publishedDate.gte = new Date(dateFrom);
    if (dateTo) where.publishedDate.lte = new Date(dateTo);
  }

  if (minCitations > 0) {
    where.citationCount = { gte: minCitations };
  }

  // Sort
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let orderBy: any = { publishedDate: "desc" };
  if (sort === "newest") orderBy = { publishedDate: "desc" };
  else if (sort === "oldest") orderBy = { publishedDate: "asc" };
  else if (sort === "citations") orderBy = { citationCount: "desc" };
  else if (sort === "fetched") orderBy = { fetchedAt: "desc" };

  const [papers, total] = await Promise.all([
    prisma.paper.findMany({
      where,
      include: { sources: true },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.paper.count({ where }),
  ]);

  // Parse JSON fields
  const serialized = papers.map((p) => ({
    ...p,
    authors: JSON.parse(p.authors) as string[],
    categories: JSON.parse(p.categories) as string[],
    tags: JSON.parse(p.tags) as string[],
  }));

  return NextResponse.json({
    papers: serialized,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  });
}
