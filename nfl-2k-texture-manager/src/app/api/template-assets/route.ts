import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const ASSETS_DIR = path.join(process.cwd(), "data", "template-assets");

async function ensureDir() {
  await fs.mkdir(ASSETS_DIR, { recursive: true });
}

export async function GET() {
  await ensureDir();
  try {
    const entries = await fs.readdir(ASSETS_DIR);
    const assets: Record<string, string> = {};
    for (const entry of entries) {
      if (entry.endsWith(".png") || entry.endsWith(".svg") || entry.endsWith(".jpg")) {
        const key = path.parse(entry).name;
        assets[key] = `/api/template-assets/${entry}`;
      }
    }
    return NextResponse.json(assets);
  } catch {
    return NextResponse.json({});
  }
}

export async function POST(req: NextRequest) {
  await ensureDir();
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const assetKey = formData.get("assetKey") as string | null;

  if (!file || !assetKey) {
    return NextResponse.json(
      { error: "Missing file or assetKey" },
      { status: 400 },
    );
  }

  const ext = path.extname(file.name) || ".png";
  const safeName = assetKey.replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `${safeName}${ext}`;
  const filePath = path.join(ASSETS_DIR, filename);

  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(filePath, buf);

  return NextResponse.json({ ok: true, url: `/api/template-assets/${filename}` });
}
