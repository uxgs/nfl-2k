import { NextRequest, NextResponse } from "next/server";
import { getTexturesRoot } from "@/lib/manifest";
import fs from "fs/promises";
import path from "path";

export async function GET(req: NextRequest) {
  const relativePath = req.nextUrl.searchParams.get("path");
  if (!relativePath) {
    return NextResponse.json({ error: "Missing path param" }, { status: 400 });
  }

  const root = getTexturesRoot();
  const filePath = path.join(root, relativePath);

  // Basic path-traversal guard
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(root))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const stat = await fs.stat(resolved);
    if (!stat.isFile()) {
      return NextResponse.json({ error: "Not a file" }, { status: 404 });
    }

    const buf = await fs.readFile(resolved);
    const ext = path.extname(resolved).toLowerCase();
    const mimeMap: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".bmp": "image/bmp",
      ".tga": "image/x-tga",
      ".dds": "application/octet-stream",
    };
    const contentType = mimeMap[ext] || "application/octet-stream";

    return new NextResponse(buf, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
