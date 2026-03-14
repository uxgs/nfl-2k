import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const MERGED_LABELS_PATH = path.join(DATA_DIR, "texture-labels.json");
const AUTO_LABELS_PATH = path.join(DATA_DIR, "auto-labels.json");
const MANUAL_OVERRIDES_PATH = path.join(DATA_DIR, "manual-overrides.json");
const TEXTURE_INDEX_PATH = path.join(DATA_DIR, "texture-index.json");

type Labels = Record<string, string>;
type TextureIndex = Record<
  string,
  { suffix: string; width: number; height: number; variants: number }
>;

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath: string, data: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

async function rebuildMergedLabels() {
  const auto = await readJson<Labels>(AUTO_LABELS_PATH, {});
  const overrides = await readJson<Labels>(MANUAL_OVERRIDES_PATH, {});
  const merged = { ...auto, ...overrides };
  await writeJson(MERGED_LABELS_PATH, merged);
  return merged;
}

export async function GET() {
  const merged = await readJson<Labels>(MERGED_LABELS_PATH, {});
  const overrides = await readJson<Labels>(MANUAL_OVERRIDES_PATH, {});
  const auto = await readJson<Labels>(AUTO_LABELS_PATH, {});

  const labelSources: Record<string, "auto" | "manual"> = {};
  for (const k of Object.keys(merged)) {
    labelSources[k] = overrides[k] ? "manual" : "auto";
  }

  return NextResponse.json({ labels: merged, sources: labelSources, autoLabels: auto });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { hashPrefix, label, propagate } = body;

  if (!hashPrefix || typeof label !== "string") {
    return NextResponse.json(
      { error: "Missing hashPrefix or label" },
      { status: 400 },
    );
  }

  const overrides = await readJson<Labels>(MANUAL_OVERRIDES_PATH, {});
  const autoLabels = await readJson<Labels>(AUTO_LABELS_PATH, {});
  const textureIndex = await readJson<TextureIndex>(TEXTURE_INDEX_PATH, {});

  const trimmed = label.trim();

  if (trimmed === "") {
    delete overrides[hashPrefix];
  } else {
    overrides[hashPrefix] = trimmed;
  }

  let propagated = 0;

  if (propagate && trimmed && textureIndex[hashPrefix]) {
    const source = textureIndex[hashPrefix];
    const originalAutoLabel = autoLabels[hashPrefix];

    for (const [otherPrefix, otherMeta] of Object.entries(textureIndex)) {
      if (otherPrefix === hashPrefix) continue;
      if (overrides[otherPrefix]) continue;
      if (
        otherMeta.suffix === source.suffix &&
        otherMeta.width === source.width &&
        otherMeta.height === source.height &&
        autoLabels[otherPrefix] === originalAutoLabel
      ) {
        overrides[otherPrefix] = trimmed;
        propagated++;
      }
    }
  }

  await writeJson(MANUAL_OVERRIDES_PATH, overrides);
  const merged = await rebuildMergedLabels();

  return NextResponse.json({
    ok: true,
    propagated,
    labels: merged,
  });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { hashPrefix } = body;

  if (!hashPrefix) {
    return NextResponse.json(
      { error: "Missing hashPrefix" },
      { status: 400 },
    );
  }

  const textureIndex = await readJson<TextureIndex>(TEXTURE_INDEX_PATH, {});
  const autoLabels = await readJson<Labels>(AUTO_LABELS_PATH, {});
  const overrides = await readJson<Labels>(MANUAL_OVERRIDES_PATH, {});

  if (!textureIndex[hashPrefix]) {
    return NextResponse.json({ similar: 0, autoLabel: null });
  }

  const source = textureIndex[hashPrefix];
  const originalAutoLabel = autoLabels[hashPrefix];

  let similar = 0;
  for (const [otherPrefix, otherMeta] of Object.entries(textureIndex)) {
    if (otherPrefix === hashPrefix) continue;
    if (overrides[otherPrefix]) continue;
    if (
      otherMeta.suffix === source.suffix &&
      otherMeta.width === source.width &&
      otherMeta.height === source.height &&
      autoLabels[otherPrefix] === originalAutoLabel
    ) {
      similar++;
    }
  }

  return NextResponse.json({
    similar,
    autoLabel: originalAutoLabel || null,
    suffix: source.suffix,
    width: source.width,
    height: source.height,
  });
}
