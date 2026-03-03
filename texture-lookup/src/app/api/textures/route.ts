import { NextRequest, NextResponse } from "next/server";
import { readdirSync } from "fs";
import { join } from "path";
import { teamToFolder, bucketToLabel } from "@/lib/textureUrl";

export const dynamic = "force-dynamic";

/**
 * GET /api/textures?team=Bengals&uniformName=Default&bucket=shared
 * Returns list of texture IDs (filename without .png) in that folder.
 * Requires TEXTURES_FOLDER_PATH env var pointing at the replacements folder on disk.
 */
export async function GET(request: NextRequest) {
  const basePath = process.env.TEXTURES_FOLDER_PATH?.trim();
  if (!basePath) {
    return NextResponse.json(
      { error: "TEXTURES_FOLDER_PATH not configured" },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const team = searchParams.get("team");
  const uniformName = searchParams.get("uniformName");
  const bucket = searchParams.get("bucket");

  if (!team || !uniformName || !bucket) {
    return NextResponse.json(
      { error: "Missing team, uniformName, or bucket" },
      { status: 400 }
    );
  }

  const teamFolder = teamToFolder(team);
  const bucketLabel = bucketToLabel(bucket);
  const dir = join(basePath, "Team", teamFolder, "Uniform", uniformName, bucketLabel);

  try {
    const files = readdirSync(dir, { withFileTypes: true });
    const ids = files
      .filter((f) => f.isFile() && f.name.toLowerCase().endsWith(".png"))
      .map((f) => f.name.replace(/\.png$/i, ""));
    return NextResponse.json({ ids });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("ENOENT")) {
      return NextResponse.json({ ids: [] });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
