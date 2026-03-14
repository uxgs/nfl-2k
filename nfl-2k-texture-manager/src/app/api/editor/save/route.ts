import { NextRequest, NextResponse } from "next/server";
import { getTexturesRoot } from "@/lib/manifest";
import fs from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { relativePath, document: doc, flattenedDataUrl } = body;

  if (!relativePath || !doc) {
    return NextResponse.json(
      { error: "Missing relativePath or document" },
      { status: 400 },
    );
  }

  const root = getTexturesRoot();
  const texturePath = path.join(root, relativePath);
  const resolved = path.resolve(texturePath);
  if (!resolved.startsWith(path.resolve(root))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Save the document.json alongside the texture
  const docPath = resolved.replace(/\.[^.]+$/, ".document.json");
  await fs.writeFile(docPath, JSON.stringify(doc, null, 2), "utf8");

  // Save flattened PNG over the original texture file
  if (flattenedDataUrl) {
    const base64 = flattenedDataUrl.split(",")[1];
    if (base64) {
      // Backup original
      try {
        await fs.access(resolved);
        const ext = path.extname(resolved);
        const baseName = resolved.slice(0, -ext.length);
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const backupPath = `${baseName}__backup_${timestamp}${ext}`;
        await fs.copyFile(resolved, backupPath);
      } catch {
        // no original to back up
      }
      await fs.writeFile(resolved, Buffer.from(base64, "base64"));
    }
  }

  return NextResponse.json({ ok: true });
}
