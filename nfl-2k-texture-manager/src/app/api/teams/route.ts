import { NextResponse } from "next/server";
import { listTeams } from "@/lib/manifest";

export async function GET() {
  const teams = await listTeams();
  return NextResponse.json(teams);
}
