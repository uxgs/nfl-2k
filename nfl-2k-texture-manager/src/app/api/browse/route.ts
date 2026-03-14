import { NextRequest, NextResponse } from "next/server";
import { getTexturesRoot } from "@/lib/manifest";
import fs from "fs/promises";
import path from "path";

const IMAGE_EXTS = new Set([
  ".png", ".jpg", ".jpeg", ".bmp", ".tga", ".dds", ".gif", ".webp",
]);

function isImageFile(name: string) {
  return IMAGE_EXTS.has(path.extname(name).toLowerCase());
}

function extractHashPrefix(filename: string): string {
  const name = path.parse(filename).name;
  const parts = name.split("-");
  return parts[0] || name;
}

async function getPngDimensions(
  filePath: string,
): Promise<{ w: number; h: number } | null> {
  try {
    const fd = await fs.open(filePath, "r");
    const buf = Buffer.alloc(24);
    await fd.read(buf, 0, 24, 0);
    await fd.close();
    if (buf[0] === 0x89 && buf[1] === 0x50) {
      return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    }
  } catch {
    // ignore
  }
  return null;
}

export async function GET(req: NextRequest) {
  const subpath = req.nextUrl.searchParams.get("path") || "";
  const root = getTexturesRoot();
  const targetDir = path.join(root, subpath);

  const resolved = path.resolve(targetDir);
  if (!resolved.startsWith(path.resolve(root))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const entries = await fs.readdir(resolved, { withFileTypes: true });

    const subdirs = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b));

    const fileEntries = entries.filter(
      (e) => e.isFile() && isImageFile(e.name),
    );

    const files = await Promise.all(
      fileEntries.map(async (e) => {
        const relPath = path.join(subpath, e.name);
        const fullPath = path.join(resolved, e.name);
        const dims = await getPngDimensions(fullPath);
        return {
          filename: e.name,
          frameName: path.parse(e.name).name,
          relativePath: relPath,
          hashPrefix: extractHashPrefix(e.name),
          width: dims?.w ?? 0,
          height: dims?.h ?? 0,
        };
      }),
    );

    files.sort((a, b) => a.filename.localeCompare(b.filename));

    return NextResponse.json({
      currentPath: subpath,
      subdirs,
      files,
      hasSubdirs: subdirs.length > 0,
      hasFiles: files.length > 0,
    });
  } catch {
    return NextResponse.json({ error: "Directory not found" }, { status: 404 });
  }
}
