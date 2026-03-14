// Detects arm sleeve accessory textures at 1024x1024 + 00005dd3.
// Like gloves, arm sleeves come in multiple color variants (4+) per
// prefix. They're plain single-color fabric with wrinkle texture.
// Distinguished from dark number patterns by having brightness > 40.

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

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

  // Group by first hash for 00005dd3 suffix
  const prefixGroups = {};
  for (const f of allFiles) {
    const name = path.basename(f).replace(".png", "");
    const parts = name.split("-");
    if (parts.length !== 3) continue;
    const [first, second, suffix] = parts;
    if (suffix !== "00005dd3") continue;
    if (!prefixGroups[first])
      prefixGroups[first] = { variants: new Set(), paths: [] };
    prefixGroups[first].variants.add(second);
    prefixGroups[first].paths.push(f);
  }

  console.log("Checking 1024x1024 + 00005dd3 prefixes with 4+ variants...\n");

  let reclassified = 0;

  for (const [prefix, info] of Object.entries(prefixGroups)) {
    if (info.variants.size < 4) continue;

    // Check size
    try {
      const meta = await sharp(info.paths[0]).metadata();
      if (!meta.width || !meta.height) continue;
      // ~1024x1024
      if (meta.width < 950 || meta.width > 1100) continue;
      if (meta.height < 950 || meta.height > 1100) continue;
    } catch {
      continue;
    }

    // Skip stadium textures
    const rel = path.relative(root, info.paths[0]);
    if (rel.toLowerCase().includes("stadium")) continue;

    // Analyze MAX brightness across a few variants
    // Arm sleeves have at least one bright variant (white/gray/colored)
    let maxBright = 0;
    const samplePaths = info.paths.slice(
      0,
      Math.min(info.paths.length, info.variants.size),
    );
    // Pick a diverse sample: take paths with different second hashes
    const seen = new Set();
    const diverseSample = [];
    for (const p of info.paths) {
      const second = path.basename(p).replace(".png", "").split("-")[1];
      if (!seen.has(second)) {
        seen.add(second);
        diverseSample.push(p);
      }
      if (diverseSample.length >= 4) break;
    }

    for (const fp of diverseSample) {
      try {
        const buf = await sharp(fp)
          .resize(16, 16, { fit: "fill" })
          .removeAlpha()
          .raw()
          .toBuffer();
        const px = 16 * 16;
        let brightS = 0;
        for (let i = 0; i < px; i++) {
          brightS += (buf[i * 3] + buf[i * 3 + 1] + buf[i * 3 + 2]) / 3;
        }
        const avgBright = brightS / px;
        if (avgBright > maxBright) maxBright = avgBright;
      } catch {
        // skip
      }
    }

    // Arm sleeve: at least one variant with brightness > 40
    if (maxBright > 40) {
      const prevLabel = labels[prefix] || "?";
      labels[prefix] = "Arm Sleeve";
      reclassified++;
      if (reclassified <= 20) {
        console.log(
          `  ARM SLEEVE: ${info.variants.size} vars, maxBright=${maxBright.toFixed(0)} [was: ${prevLabel}]  ${rel.slice(0, 55)}`,
        );
      }
    }
  }

  if (reclassified > 20) console.log(`  ...and ${reclassified - 20} more`);
  console.log(`\nReclassified ${reclassified} as "Arm Sleeve".`);

  fs.writeFileSync(labelsPath, JSON.stringify(labels, null, 2), "utf8");

  const counts = {};
  for (const k in labels) counts[labels[k]] = (counts[labels[k]] || 0) + 1;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  console.log("\nUpdated distribution:");
  for (const [l, c] of sorted) console.log(`  ${String(c).padStart(5)} ${l}`);
}

main().catch(console.error);
