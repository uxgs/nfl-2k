import { NextRequest, NextResponse } from "next/server";
import { getTexturesRoot } from "@/lib/manifest";
import fs from "fs/promises";
import path from "path";

export async function GET(req: NextRequest) {
  const relativePath = req.nextUrl.searchParams.get("path");
  if (!relativePath) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  const root = getTexturesRoot();
  const texturePath = path.join(root, relativePath);
  const resolved = path.resolve(texturePath);
  if (!resolved.startsWith(path.resolve(root))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check for a saved document.json next to the texture
  const docPath = resolved.replace(/\.[^.]+$/, ".document.json");

  try {
    const docRaw = await fs.readFile(docPath, "utf8");
    return NextResponse.json({ document: JSON.parse(docRaw), hasDoc: true });
  } catch {
    // No saved document, return null so the client creates a fresh one from the image
    return NextResponse.json({ document: null, hasDoc: false });
  }
}
