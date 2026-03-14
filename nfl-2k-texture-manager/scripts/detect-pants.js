// Detects pants textures among 2048x1024 images with suffix 00005e13
// currently labeled "Jersey". Uses saturation + left-right symmetry analysis.
//
// Pants UV maps are distinctive:
//   - Very low average saturation (mostly gray/white or muted team color)
//   - High left-right symmetry (both legs are mirrored)
// White jerseys are also low-saturation but have higher LR asymmetry
// (neckline, shoulder pads create imbalance).

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

async function gridStats(filePath) {
  const buf = await sharp(filePath)
    .resize(32, 16, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer();

  const cols = 8, rows = 4, cw = 4, ch = 4;
  const cells = [];
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      let rS = 0, gS = 0, bS = 0, n = 0;
      for (let y = gy * ch; y < (gy + 1) * ch; y++) {
        for (let x = gx * cw; x < (gx + 1) * cw; x++) {
          const i = (y * 32 + x) * 3;
          rS += buf[i]; gS += buf[i + 1]; bS += buf[i + 2]; n++;
        }
      }
      cells.push({
        sat: Math.max(rS / n, gS / n, bS / n) - Math.min(rS / n, gS / n, bS / n),
        bright: (rS / n + gS / n + bS / n) / 3,
      });
    }
  }

  function colAvg(colIds) {
    let sS = 0, bS = 0, n = 0;
    for (let r = 0; r < rows; r++) {
      for (const c of colIds) {
        sS += cells[r * cols + c].sat;
        bS += cells[r * cols + c].bright;
        n++;
      }
    }
    return { sat: sS / n, bright: bS / n };
  }

  const le = colAvg([0, 1]);
  const ri = colAvg([6, 7]);
  const lrSym = Math.abs(le.bright - ri.bright);
  const allSat = cells.reduce((s, c) => s + c.sat, 0) / cells.length;
  const allBright = cells.reduce((s, c) => s + c.bright, 0) / cells.length;

  return { allSat, allBright, lrSym };
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
  const seen = new Set();
  const candidates = [];

  for (const f of allFiles) {
    const name = path.basename(f);
    const prefix = name.split("-")[0];
    if (seen.has(prefix)) continue;
    seen.add(prefix);
    const suffix = name.replace(".png", "").split("-").pop();
    if (suffix !== "00005e13") continue;
    if (labels[prefix] !== "Jersey") continue;
    candidates.push({ path: f, prefix, name });
  }

  console.log(
    `Checking ${candidates.length} "Jersey" textures (suffix 00005e13) for pants pattern...\n`,
  );

  let reclassified = 0;

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    try {
      const meta = await sharp(c.path).metadata();
      if (!meta.width || !meta.height) continue;
      const ratio = meta.width / meta.height;
      if (ratio < 1.8 || ratio > 2.2) continue;

      const s = await gridStats(c.path);

      // Skip empty/black placeholder images
      if (s.allBright < 5) continue;

      // Pants criteria: low saturation + high left-right symmetry
      const isPants = s.allSat < 25 && s.lrSym < 8;

      if (isPants) {
        labels[c.prefix] = "Pants";
        reclassified++;
      }
    } catch {
      // skip
    }

    if ((i + 1) % 100 === 0) {
      process.stderr.write(`  ${i + 1}/${candidates.length}\n`);
    }
  }

  console.log(`Reclassified ${reclassified} textures from "Jersey" to "Pants".`);

  fs.writeFileSync(labelsPath, JSON.stringify(labels, null, 2), "utf8");
  console.log("Updated labels saved.");

  // Print final counts for relevant categories
  const counts = {};
  for (const k in labels) {
    counts[labels[k]] = (counts[labels[k]] || 0) + 1;
  }
  console.log("\nUpdated label counts:");
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  for (const [label, count] of sorted) {
    console.log(`  ${String(count).padStart(5)}  ${label}`);
  }
}

main().catch(console.error);
