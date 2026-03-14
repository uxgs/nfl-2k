import { NextRequest, NextResponse } from "next/server";
import { getTexturesRoot } from "@/lib/manifest";
import fs from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const relativePath = formData.get("relativePath") as string | null;

  if (!file || !relativePath) {
    return NextResponse.json(
      { error: "Missing file or relativePath" },
      { status: 400 },
    );
  }

  const root = getTexturesRoot();
  const filePath = path.join(root, relativePath);

  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(root))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Save backup of existing file for versioning
  try {
    await fs.access(resolved);
    const ext = path.extname(resolved);
    const base = resolved.slice(0, -ext.length);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = `${base}__backup_${timestamp}${ext}`;
    await fs.copyFile(resolved, backupPath);
  } catch {
    // File didn't exist, no backup needed
  }

  await fs.mkdir(path.dirname(resolved), { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(resolved, buf);

  return NextResponse.json({ ok: true, path: relativePath });
}
