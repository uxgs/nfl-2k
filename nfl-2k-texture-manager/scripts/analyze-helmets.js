const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const root = "E:\\Emulation\\PS2\\textures\\SLUS-20919\\replacements\\Team";
const labels = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "data", "texture-labels.json"), "utf8"),
);

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results = [];
  for (const e of entries) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) results.push(...walk(f));
    else if (e.name.endsWith(".png")) results.push(f);
  }
  return results;
}

const files = walk(root);

async function analyze(filePath) {
  const buf = await sharp(filePath)
    .resize(64, 64, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer();
  const px = 64 * 64;
  let rS = 0, gS = 0, bS = 0;
  let darkPx = 0, midPx = 0, lightPx = 0, satSum = 0, colorPx = 0;
  for (let i = 0; i < px; i++) {
    const r = buf[i * 3], g = buf[i * 3 + 1], b = buf[i * 3 + 2];
    rS += r; gS += g; bS += b;
    const bright = (r + g + b) / 3;
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    satSum += sat;
    if (bright < 50) darkPx++;
    else if (bright < 150) midPx++;
    else lightPx++;
    if (sat > 30) colorPx++;
  }
  return {
    avgSat: (satSum / px).toFixed(1),
    darkRatio: (darkPx / px * 100).toFixed(0),
    midRatio: (midPx / px * 100).toFixed(0),
    lightRatio: (lightPx / px * 100).toFixed(0),
    colorRatio: (colorPx / px * 100).toFixed(0),
    avgBright: ((rS + gS + bS) / 3 / px).toFixed(0),
  };
}

async function main() {
  const seen = new Set();
  const gloveCandidates = [];
  const helmetCandidates = [];

  for (const f of files) {
    const name = path.basename(f);
    const prefix = name.split("-")[0];
    if (seen.has(prefix)) continue;
    seen.add(prefix);
    const suffix = name.replace(".png", "").split("-").pop();
    if (suffix !== "00005dd3") continue;

    if (labels[prefix] === "Glove Texture") {
      gloveCandidates.push({ path: f, prefix, rel: path.relative(root, f) });
    }
    if (labels[prefix] === "Helmet Texture") {
      helmetCandidates.push({ path: f, prefix, rel: path.relative(root, f) });
    }
  }

  console.log("Glove Texture candidates:", gloveCandidates.length);
  console.log("Helmet Texture (2048x2048) candidates:", helmetCandidates.length);

  // Analyze known helmets (from user)
  const knownHelmetPrefixes = ["ff61d637d0220b94", "d935266e7441208"];
  console.log("\n=== Known HELMET textures (user-confirmed) ===");
  for (const prefix of knownHelmetPrefixes) {
    const c = gloveCandidates.find((x) => x.prefix === prefix);
    if (c) {
      const s = await analyze(c.path);
      console.log(`  sat:${s.avgSat.padStart(5)} dark:${s.darkRatio.padStart(3)}% mid:${s.midRatio.padStart(3)}% light:${s.lightRatio.padStart(3)}% color:${s.colorRatio.padStart(3)}% bright:${s.avgBright}  ${c.rel}`);
    }
  }

  // Sample "Glove Textures" from various teams
  console.log("\n=== Sampled Glove Texture (1536x1536 + 00005dd3) ===");
  const sample = gloveCandidates.filter((_, i) => i % 8 === 0).slice(0, 30);
  for (const c of sample) {
    const meta = await sharp(c.path).metadata();
    if (meta.width < 1400 || meta.width > 1600) continue;
    const s = await analyze(c.path);
    const mark = knownHelmetPrefixes.includes(c.prefix) ? " *HELMET*" : "";
    console.log(`  sat:${s.avgSat.padStart(5)} dark:${s.darkRatio.padStart(3)}% mid:${s.midRatio.padStart(3)}% light:${s.lightRatio.padStart(3)}% color:${s.colorRatio.padStart(3)}% bright:${s.avgBright}${mark}  ${c.rel.slice(0, 65)}`);
  }

  // Sample actual 2048x2048 Helmet Textures for comparison
  console.log("\n=== Sampled Helmet Texture (2048x2048 + 00005dd3) ===");
  const helmetSample = helmetCandidates.slice(0, 10);
  for (const c of helmetSample) {
    const s = await analyze(c.path);
    console.log(`  sat:${s.avgSat.padStart(5)} dark:${s.darkRatio.padStart(3)}% mid:${s.midRatio.padStart(3)}% light:${s.lightRatio.padStart(3)}% color:${s.colorRatio.padStart(3)}% bright:${s.avgBright}  ${c.rel.slice(0, 65)}`);
  }
}

main().catch(console.error);
