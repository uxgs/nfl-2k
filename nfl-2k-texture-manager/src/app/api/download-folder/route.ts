import { NextRequest, NextResponse } from "next/server";
import { getTexturesRoot } from "@/lib/manifest";
import archiver from "archiver";
import fs from "fs";
import path from "path";
import { PassThrough } from "stream";

const IMAGE_EXTS = new Set([
  ".png", ".jpg", ".jpeg", ".bmp", ".tga", ".dds", ".gif", ".webp",
]);

export async function GET(req: NextRequest) {
  const subpath = req.nextUrl.searchParams.get("path") || "";
  const root = getTexturesRoot();
  const targetDir = path.join(root, subpath);

  const resolved = path.resolve(targetDir);
  if (!resolved.startsWith(path.resolve(root))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const archive = archiver("zip", { zlib: { level: 5 } });
  const passthrough = new PassThrough();
  archive.pipe(passthrough);

  function addDir(dir: string, prefix: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isFile() && IMAGE_EXTS.has(path.extname(entry.name).toLowerCase())) {
        archive.file(fullPath, { name: prefix ? `${prefix}/${entry.name}` : entry.name });
      } else if (entry.isDirectory()) {
        addDir(fullPath, prefix ? `${prefix}/${entry.name}` : entry.name);
      }
    }
  }

  addDir(resolved, "");
  archive.finalize();

  const readableStream = new ReadableStream({
    start(controller) {
      passthrough.on("data", (chunk: Buffer) => controller.enqueue(chunk));
      passthrough.on("end", () => controller.close());
      passthrough.on("error", (err) => controller.error(err));
    },
  });

  const folderName = subpath
    ? subpath.replace(/[\\/]/g, "_")
    : "textures";
  const zipName = `${folderName}.zip`;

  return new NextResponse(readableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipName}"`,
    },
  });
}
