// One-time Figma export script
// Usage (example):
//   FIGMA_API_TOKEN=... FIGMA_FILE_KEY=... TEAM_NAME="49ers" YEAR="2024" UNIFORM_TYPE="Home" NODE_IDS="94-22501,94-18887" node scripts/figma-export.js
//
// This will:
// - Fetch node metadata (names) and export-image URLs from Figma
// - Download PNGs for the specified node IDs
// - Save them under: data/raw/<TeamName>/<Year>/<UniformType>/<frameName>.png
// - Emit a simple manifest JSON alongside the images

const fs = require("fs/promises");
const path = require("path");

const FIGMA_API_BASE = "https://api.figma.com/v1";

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

function getEnvRequired(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function parseNodeIds(value) {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function sanitizeFilename(name) {
  return name.replace(/[<>:\"/\\|?*\x00-\x1F]/g, "_").replace(/\s+/g, "_");
}

async function fetchJson(url, token) {
  const res = await fetch(url, {
    headers: {
      "X-Figma-Token": token,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Figma API error ${res.status}: ${text}`);
  }
  return res.json();
}

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Image download error ${res.status}: ${text}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const token = getEnvRequired("FIGMA_API_TOKEN");
  const fileKey = getEnvRequired("FIGMA_FILE_KEY");
  const teamName = getEnvRequired("TEAM_NAME");
  const year = getEnvRequired("YEAR");
  const uniformType = process.env.UNIFORM_TYPE || "Shared";
  const nodeIdsRaw = getEnvRequired("NODE_IDS");
  const nodeIds = parseNodeIds(nodeIdsRaw);

  if (nodeIds.length === 0) {
    throw new Error("NODE_IDS is empty after parsing");
  }

  console.log("Exporting from Figma...");
  console.log(`  File: ${fileKey}`);
  console.log(`  Team: ${teamName}`);
  console.log(`  Year: ${year}`);
  console.log(`  Uniform type: ${uniformType}`);
  console.log(`  Node IDs: ${nodeIds.join(", ")}`);

  // 1) Fetch node metadata to get frame names
  const nodesUrl =
    `${FIGMA_API_BASE}/files/${fileKey}/nodes?ids=` +
    encodeURIComponent(nodeIds.join(","));
  const nodesJson = await fetchJson(nodesUrl, token);

  const nodeNameById = {};
  if (nodesJson.nodes) {
    for (const [id, nodeWrapper] of Object.entries(nodesJson.nodes)) {
      if (nodeWrapper && nodeWrapper.document && nodeWrapper.document.name) {
        nodeNameById[id] = nodeWrapper.document.name;
      }
    }
  }

  // 2) Request export image URLs
  const imagesUrl =
    `${FIGMA_API_BASE}/images/${fileKey}?format=png&scale=1&ids=` +
    encodeURIComponent(nodeIds.join(","));
  const imagesJson = await fetchJson(imagesUrl, token);

  const imagesMap = imagesJson.images || {};

  // 3) Prepare output paths
  const baseDir = path.join(
    __dirname,
    "..",
    "data",
    "raw",
    teamName,
    year,
    uniformType
  );
  await ensureDir(baseDir);

  const manifest = {
    teamName,
    year,
    uniformType,
    fileKey,
    nodes: [],
  };

  // 4) Download each image
  for (const nodeId of nodeIds) {
    const imageUrl = imagesMap[nodeId];
    if (!imageUrl) {
      console.warn(`No image URL returned for node ${nodeId}`);
      continue;
    }

    const frameName = nodeNameById[nodeId] || nodeId;
    const filename = `${sanitizeFilename(frameName)}.png`;
    const outPath = path.join(baseDir, filename);

    console.log(`Downloading ${frameName} (${nodeId}) -> ${outPath}`);
    const buf = await fetchBuffer(imageUrl);
    await fs.writeFile(outPath, buf);

    manifest.nodes.push({
      nodeId,
      frameName,
      filename,
      relativePath: path.relative(
        path.join(__dirname, "..", "data"),
        outPath
      ),
    });
  }

  // 5) Write manifest alongside images
  const manifestPath = path.join(baseDir, "manifest.json");
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  console.log(`Wrote manifest: ${manifestPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

