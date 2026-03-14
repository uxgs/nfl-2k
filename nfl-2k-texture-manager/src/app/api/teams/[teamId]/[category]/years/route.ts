import { NextResponse } from "next/server";
import { listYearsForTeamCategory } from "@/lib/manifest";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ teamId: string; category: string }> },
) {
  const { teamId, category } = await params;
  const years = await listYearsForTeamCategory(teamId, decodeURIComponent(category));
  return NextResponse.json(years);
}
