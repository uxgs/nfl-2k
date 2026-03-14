import { NextResponse } from "next/server";
import { listCategoriesForTeam } from "@/lib/manifest";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const { teamId } = await params;
  const categories = await listCategoriesForTeam(teamId);
  return NextResponse.json(categories);
}
