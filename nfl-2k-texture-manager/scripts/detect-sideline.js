// Detects "Sideline Uniform" textures among 2048x1024 / 00005e13 images
// that were previously labeled as "Jersey".
//
// Sideline textures pack multiple garments (jersey, pants, jacket, shoes,
// gloves, socks) into a single UV sheet, causing high spatial color diversity.
// Regular jerseys are mostly one or two uniform colors across the image.
//
// Strategy: divide image into an 8x4 grid, compute average color per cell,
// then measure how many distinct color "clusters" exist. Sideline textures
// will have 5+ distinct zones; regular jerseys will have 1-3.

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const GRID_COLS = 8;
const GRID_ROWS = 4;

function colorDistance(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

// Simple clustering: greedily merge cells that are within threshold
function countClusters(cells, threshold = 45) {
  const assigned = new Array(cells.length).fill(-1);
  let clusterId = 0;

  for (let i = 0; i < cells.length; i++) {
    if (assigned[i] >= 0) continue;
    assigned[i] = clusterId;
    for (let j = i + 1; j < cells.length; j++) {
      if (assigned[j] >= 0) continue;
      if (colorDistance(cells[i], cells[j]) < threshold) {
        assigned[j] = clusterId;
      }
    }
    clusterId++;
  }
  return clusterId;
}

async function analyzeGrid(filePath) {
  // Resize to grid resolution so each pixel = one cell
  const buf = await sharp(filePath)
    .resize(GRID_COLS, GRID_ROWS, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer();

  const cells = [];
  for (let i = 0; i < GRID_COLS * GRID_ROWS; i++) {
    cells.push([buf[i * 3], buf[i * 3 + 1], buf[i * 3 + 2]]);
  }

  // Overall brightness range across cells
  const brightnesses = cells.map(c => (c[0] + c[1] + c[2]) / 3);
  const minBright = Math.min(...brightnesses);
  const maxBright = Math.max(...brightnesses);
  const brightnessRange = maxBright - minBright;

  // Count distinct color clusters
  const clusters = countClusters(cells, 40);

  // Also check hue diversity: count how many cells have fundamentally different hues
  function getHue(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max - min < 20) return -1; // gray/neutral
    if (r >= g && r >= b) return ((g - b) / (max - min) * 60 + 360) % 360;
    if (g >= r && g >= b) return (b - r) / (max - min) * 60 + 120;
    return (r - g) / (max - min) * 60 + 240;
  }

  const hues = cells.map(c => getHue(c[0], c[1], c[2]));
  const hueSet = new Set();
  for (const h of hues) {
    if (h < 0) { hueSet.add("gray"); continue; }
    // Bucket hues into 60-degree segments
    hueSet.add(String(Math.floor(h / 60)));
  }

  return { clusters, brightnessRange, hueCount: hueSet.size, cells };
}

async function main() {
  const root = process.argv[2] || "E:\\Emulation\\PS2\\textures\\SLUS-20919\\replacements\\Team";
  const labelsPath = path.join(__dirname, "..", "data", "texture-labels.json");
  const labels = JSON.parse(fs.readFileSync(labelsPath, "utf8"));

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const results = [];
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) results.push(...walk(full));
      else if (e.name.endsWith(".png")) results.push(full);
    }
    return results;
  }

  const allFiles = walk(root);

  // Find candidates: 2048x1024-ish, suffix 00005e13, currently labeled Jersey
  const candidates = [];
  const seen = new Set();
  for (const f of allFiles) {
    const name = path.basename(f);
    const prefix = name.split("-")[0];
    const suffix = name.replace(".png", "").split("-").pop();
    if (seen.has(prefix)) continue;
    seen.add(prefix);
    if (suffix !== "00005e13") continue;
    if (labels[prefix] !== "Jersey") continue;
    candidates.push({ filePath: f, prefix, name });
  }

  console.log(`Checking ${candidates.length} "Jersey" textures with suffix 00005e13...\n`);

  let reclassified = 0;

  for (let i = 0; i < candidates.length; i++) {
    const { filePath, prefix } = candidates[i];
    try {
      const meta = await sharp(filePath).metadata();
      // Only check 2:1 ratio images
      if (!meta.width || !meta.height) continue;
      const ratio = meta.width / meta.height;
      if (ratio < 1.8 || ratio > 2.2) continue;

      const result = await analyzeGrid(filePath);

      // Sideline textures: high cluster count AND high brightness range AND multiple hues
      const isSideline = result.clusters >= 6 && result.brightnessRange > 80 && result.hueCount >= 3;

      if (isSideline) {
        reclassified++;
        labels[prefix] = "Sideline Uniform";
        const rel = path.relative(root, filePath);
        console.log(
          `  SIDELINE: clusters=${result.clusters} bright_range=${result.brightnessRange.toFixed(0)} hues=${result.hueCount}  ${rel}`,
        );
      }
    } catch {
      // skip
    }

    if ((i + 1) % 100 === 0) {
      process.stderr.write(`  ${i + 1}/${candidates.length}\n`);
    }
  }

  console.log(`\nReclassified ${reclassified} textures as "Sideline Uniform".`);

  fs.writeFileSync(labelsPath, JSON.stringify(labels, null, 2), "utf8");
  console.log(`Updated labels saved.`);
}

main().catch(console.error);
