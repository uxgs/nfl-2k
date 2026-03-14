// Detects glove textures by combining two signals:
// 1. Multiple variants per prefix (gloves come in 4+ brand variants:
//    Nike, Adidas, Under Armour, Reebok, team-branded, etc.)
// 2. Black edge pattern (hand shapes on black background)
// 3. At least one bright variant (distinguishes from numbers which are
//    ALL dark-on-black, vs gloves where some variants are white/colored)

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

async function analyzeEdges(filePath) {
  const buf = await sharp(filePath)
    .resize(64, 32, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer();
  const w = 64, h = 32;

  function pxBright(x, y) {
    const i = (y * w + x) * 3;
    return (buf[i] + buf[i + 1] + buf[i + 2]) / 3;
  }

  let leftBlack = 0, rightBlack = 0, bottomBlack = 0;
  for (let y = 0; y < h; y++) {
    if (pxBright(0, y) < 15) leftBlack++;
    if (pxBright(1, y) < 15) leftBlack++;
    if (pxBright(w - 1, y) < 15) rightBlack++;
    if (pxBright(w - 2, y) < 15) rightBlack++;
  }
  for (let x = 0; x < w; x++) {
    if (pxBright(x, h - 1) < 15) bottomBlack++;
    if (pxBright(x, h - 2) < 15) bottomBlack++;
  }
  leftBlack /= h * 2;
  rightBlack /= h * 2;
  bottomBlack /= w * 2;

  // Center brightness (hand/content area)
  let centerBright = 0, cn = 0;
  for (let y = Math.floor(h * 0.3); y < Math.floor(h * 0.7); y++) {
    for (let x = Math.floor(w * 0.15); x < Math.floor(w * 0.85); x++) {
      centerBright += pxBright(x, y);
      cn++;
    }
  }
  centerBright /= cn;

  return { leftBlack, rightBlack, bottomBlack, centerBright };
}

async function main() {
  const root =
    process.argv[2] ||
    "E:\\Emulation\\PS2\\textures\\SLUS-20919\\replacements\\Team";
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

  // Step 1: Revert previously mislabeled gloves back to what auto-label.js would give them
  // (We'll re-detect properly below)
  let reverted = 0;
  for (const prefix in labels) {
    if (labels[prefix] === "Glove") {
      // These were all 00005e13 which auto-label would have called "Jersey" or "Numbers"
      // We'll re-detect them properly, so remove the Glove label for now
      // and let the auto-labeler's original logic decide
      labels[prefix] = "__pending__";
      reverted++;
    }
  }
  console.log(`Reverted ${reverted} previous "Glove" labels for re-detection.\n`);

  // Step 2: Group files by first hash (prefix) for 00005e13 suffix
  const prefixGroups = {};
  for (const f of allFiles) {
    const name = path.basename(f).replace(".png", "");
    const parts = name.split("-");
    if (parts.length !== 3) continue;
    const [first, second, suffix] = parts;
    if (suffix !== "00005e13") continue;
    if (!prefixGroups[first]) prefixGroups[first] = { variants: new Set(), paths: [] };
    prefixGroups[first].variants.add(second);
    prefixGroups[first].paths.push(f);
  }

  // Step 3: For prefixes with 4+ variants, analyze all variants
  console.log("Analyzing high-variant prefixes (4+ variants)...\n");
  let detected = 0;

  for (const [prefix, info] of Object.entries(prefixGroups)) {
    if (info.variants.size < 4) continue;

    // Check dimensions of first file
    try {
      const meta = await sharp(info.paths[0]).metadata();
      if (!meta.width || !meta.height) continue;
      const ratio = meta.width / meta.height;
      if (ratio < 1.8 || ratio > 2.2) continue;
    } catch {
      continue;
    }

    // Analyze a sample of variants (up to 4) for edge pattern + brightness
    const sample = info.paths.slice(0, Math.min(info.paths.length, 4));
    let hasBlackEdges = false;
    let maxCenterBright = 0;
    let anyEdgeAnalyzed = false;

    for (const fp of sample) {
      try {
        const s = await analyzeEdges(fp);
        anyEdgeAnalyzed = true;
        if (s.leftBlack > 0.5 && s.rightBlack > 0.5 && s.bottomBlack > 0.4) {
          hasBlackEdges = true;
        }
        if (s.centerBright > maxCenterBright) {
          maxCenterBright = s.centerBright;
        }
      } catch {
        // skip
      }
    }

    if (!anyEdgeAnalyzed) continue;

    // Glove criteria:
    // - Has black edges (hand shapes on black background)
    // - At least one variant has center brightness > 50
    //   (distinguishes from numbers where ALL variants are dark on black)
    if (hasBlackEdges && maxCenterBright > 50) {
      const prevLabel = labels[prefix] || "?";
      labels[prefix] = "Glove";
      detected++;
      if (detected <= 20) {
        const rel = path.relative(root, info.paths[0]).slice(0, 60);
        console.log(
          `  GLOVE: ${info.variants.size} variants, maxBright=${maxCenterBright.toFixed(0)} [was: ${prevLabel}]  ${rel}`,
        );
      }
    }
  }

  if (detected > 20) console.log(`  ...and ${detected - 20} more`);
  console.log(`\nDetected ${detected} glove prefixes.`);

  // Step 4: Fix the __pending__ labels back to their proper type
  // Re-run the basic classification for any remaining __pending__
  for (const f of allFiles) {
    const name = path.basename(f);
    const prefix = name.split("-")[0];
    if (labels[prefix] !== "__pending__") continue;

    const suffix = name.replace(".png", "").split("-").pop();
    if (suffix !== "00005e13") continue;

    try {
      const meta = await sharp(f).metadata();
      if (!meta.width || !meta.height) continue;
      const ratio = meta.width / meta.height;
      if (ratio < 1.8 || ratio > 2.2) {
        labels[prefix] = "Texture";
        continue;
      }

      // Quick dark analysis for numbers vs jersey
      const small = await sharp(f)
        .resize(32, 16, { fit: "fill" })
        .removeAlpha()
        .raw()
        .toBuffer();
      const px = 32 * 16;
      let darkPx = 0;
      for (let i = 0; i < px; i++) {
        if ((small[i * 3] + small[i * 3 + 1] + small[i * 3 + 2]) / 3 < 30)
          darkPx++;
      }
      const darkRatio = darkPx / px;
      labels[prefix] = darkRatio > 0.5 ? "Numbers" : "Jersey";
    } catch {
      labels[prefix] = "Texture";
    }
  }

  // Clean up any remaining __pending__
  for (const k in labels) {
    if (labels[k] === "__pending__") labels[k] = "Texture";
  }

  fs.writeFileSync(labelsPath, JSON.stringify(labels, null, 2), "utf8");

  const counts = {};
  for (const k in labels) counts[labels[k]] = (counts[labels[k]] || 0) + 1;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  console.log("\nFinal distribution:");
  for (const [l, c] of sorted) console.log(`  ${String(c).padStart(5)} ${l}`);
}

main().catch(console.error);
