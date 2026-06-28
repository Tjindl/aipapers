import { NextResponse } from "next/server";
import { adapters } from "@/lib/adapters";

export async function GET() {
  return NextResponse.json(
    adapters.map((a) => ({ name: a.name, label: a.label, enabled: a.enabled }))
  );
}
