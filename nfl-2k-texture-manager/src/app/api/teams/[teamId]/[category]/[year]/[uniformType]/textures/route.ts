import { NextResponse } from "next/server";
import { getUniformSet } from "@/lib/manifest";

export async function GET(
  _req: Request,
  {
    params,
  }: {
    params: Promise<{
      teamId: string;
      category: string;
      year: string;
      uniformType: string;
    }>;
  },
) {
  const { teamId, category, year, uniformType } = await params;
  const uniformSet = await getUniformSet(
    teamId,
    decodeURIComponent(category),
    decodeURIComponent(year),
    decodeURIComponent(uniformType),
  );
  if (!uniformSet) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(uniformSet);
}
