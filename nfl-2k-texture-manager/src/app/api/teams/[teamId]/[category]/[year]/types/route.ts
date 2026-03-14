import { NextResponse } from "next/server";
import { listTypesForTeamCategoryYear } from "@/lib/manifest";

export async function GET(
  _req: Request,
  {
    params,
  }: { params: Promise<{ teamId: string; category: string; year: string }> },
) {
  const { teamId, category, year } = await params;
  const types = await listTypesForTeamCategoryYear(
    teamId,
    decodeURIComponent(category),
    decodeURIComponent(year),
  );
  return NextResponse.json(types);
}
