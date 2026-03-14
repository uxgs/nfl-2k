// Unified auto-labeler v2: Deep visual analysis for all textures.
// Uses pixel-level features (brightness distribution, color complexity,
// spatial structure, symmetry, edge patterns) rather than relying on
// dimension/suffix lookup tables.
//
// Outputs:
//   data/texture-labels.json   — merged labels (auto + manual overrides)
//   data/auto-labels.json      — purely auto-detected labels
//   data/texture-index.json    — per-prefix metadata for the learning system
//   data/manual-overrides.json — user overrides (never touched)

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const DATA_DIR = path.join(__dirname, "..", "data");
const AUTO_LABELS_PATH = path.join(DATA_DIR, "auto-labels.json");
const MANUAL_OVERRIDES_PATH = path.join(DATA_DIR, "manual-overrides.json");
const MERGED_LABELS_PATH = path.join(DATA_DIR, "texture-labels.json");
const TEXTURE_INDEX_PATH = path.join(DATA_DIR, "texture-index.json");

// ── Helpers ──────────────────────────────────────────────────────────

function bucketSize(w, h) {
  const standards = [
    [2048, 2048], [2048, 1024], [1536, 1536], [1024, 1024], [1024, 512],
    [1030, 518], [828, 414], [720, 720], [576, 288], [512, 590],
    [512, 512], [512, 256], [432, 432], [432, 216], [360, 360],
    [360, 180], [290, 290], [288, 288], [256, 256], [256, 128],
    [216, 216], [128, 128], [128, 64], [72, 72], [64, 64],
    [64, 32], [32, 32], [16, 16],
  ];
  let best = null, bestDist = Infinity;
  for (const [sw, sh] of standards) {
    const dist = Math.abs(w - sw) + Math.abs(h - sh);
    if (dist < bestDist) { bestDist = dist; best = [sw, sh]; }
  }
  if (best && Math.abs(w - best[0]) / best[0] < 0.05 && Math.abs(h - best[1]) / best[1] < 0.05) {
    return best;
  }
  return [w, h];
}

// ── Deep Visual Analysis ─────────────────────────────────────────────

async function analyzeVisuals(filePath, bw, bh) {
  const aspect = bw / bh;
  const W = aspect >= 1.5 ? 128 : 64;
  const H = aspect >= 1.5 ? 64 : 64;

  // Check alpha channel first (before stripping) to detect fully transparent images
  const alphaBuf = await sharp(filePath)
    .resize(W, H, { fit: "fill" }).ensureAlpha().raw().toBuffer();
  let opaquePixels = 0;
  for (let i = 0; i < W * H; i++) {
    if (alphaBuf[i * 4 + 3] > 10) opaquePixels++;
  }
  const opaqueFraction = opaquePixels / (W * H);

  const buf = await sharp(filePath)
    .resize(W, H, { fit: "fill" }).removeAlpha().raw().toBuffer();

  const total = W * H;
  const pixels = [];
  for (let i = 0; i < total; i++) {
    const r = buf[i * 3], g = buf[i * 3 + 1], b = buf[i * 3 + 2];
    pixels.push({ r, g, b, bright: (r + g + b) / 3, sat: Math.max(r, g, b) - Math.min(r, g, b) });
  }

  // ── Brightness distribution ──
  const brights = pixels.map(p => p.bright);
  const sorted = [...brights].sort((a, b) => a - b);
  const avgBright = brights.reduce((s, v) => s + v, 0) / total;

  const BINS = 16;
  const hist = new Array(BINS).fill(0);
  for (const b of brights) hist[Math.min(Math.floor(b / (256 / BINS)), BINS - 1)]++;
  for (let i = 0; i < BINS; i++) hist[i] /= total;

  const lowBins = hist[0] + hist[1]; // fraction in darkest 2 bins (0-31)
  let entropy = 0;
  for (const h of hist) if (h > 0) entropy -= h * Math.log2(h);

  const darkAt20 = pixels.filter(p => p.bright < 20).length / total;
  const darkAt40 = pixels.filter(p => p.bright < 40).length / total;

  // ── Saturation stats (non-dark pixels only) ──
  const nonDark = pixels.filter(p => p.bright >= 20);
  const nonDarkRatio = nonDark.length / total;
  const ndSats = nonDark.map(p => p.sat);
  const ndAvgSat = ndSats.length ? ndSats.reduce((s, v) => s + v, 0) / ndSats.length : 0;
  const highSatPx = pixels.filter(p => p.sat > 50).length / total;

  // ── Hue analysis ──
  function getHue(r, g, b) {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx - mn < 15) return -1;
    let h;
    if (r >= g && r >= b) h = ((g - b) / (mx - mn) * 60 + 360) % 360;
    else if (g >= r && g >= b) h = (b - r) / (mx - mn) * 60 + 120;
    else h = (r - g) / (mx - mn) * 60 + 240;
    return h;
  }
  const satPixels = pixels.filter(p => p.sat > 30 && p.bright > 20);
  const hueBuckets = new Array(12).fill(0);
  for (const p of satPixels) {
    const h = getHue(p.r, p.g, p.b);
    if (h >= 0) hueBuckets[Math.floor(h / 30)]++;
  }
  const activeHues = hueBuckets.filter(c => c > satPixels.length * 0.05).length;
  const dominantHuePct = satPixels.length ? Math.max(...hueBuckets) / satPixels.length : 0;

  // ── Grid-based spatial analysis (8x4 for wide, 4x4 for square) ──
  const gW = aspect >= 1.5 ? 8 : 4;
  const gH = 4;
  const cW = W / gW, cH = H / gH;
  const cells = [];
  for (let gy = 0; gy < gH; gy++) {
    for (let gx = 0; gx < gW; gx++) {
      let rS = 0, gS = 0, bS = 0, n = 0;
      for (let y = Math.floor(gy * cH); y < Math.floor((gy + 1) * cH); y++) {
        for (let x = Math.floor(gx * cW); x < Math.floor((gx + 1) * cW); x++) {
          const idx = y * W + x;
          rS += pixels[idx].r; gS += pixels[idx].g; bS += pixels[idx].b; n++;
        }
      }
      cells.push({ r: rS / n, g: gS / n, b: bS / n, bright: (rS / n + gS / n + bS / n) / 3 });
    }
  }
  const cellBrightStd = Math.sqrt(
    cells.reduce((s, c) => s + (c.bright - avgBright) ** 2, 0) / cells.length
  );
  const ar = cells.reduce((s, c) => s + c.r, 0) / cells.length;
  const ag = cells.reduce((s, c) => s + c.g, 0) / cells.length;
  const ab = cells.reduce((s, c) => s + c.b, 0) / cells.length;
  const cellColorVar = cells.reduce((s, c) =>
    s + Math.sqrt((c.r - ar) ** 2 + (c.g - ag) ** 2 + (c.b - ab) ** 2), 0) / cells.length;

  // ── Coarse spatial analysis (4x2 mega-blocks for structural zones) ──
  const mW = aspect >= 1.5 ? 4 : 2, mH = 2;
  const mcW = W / mW, mcH = H / mH;
  const megaCells = [];
  for (let gy = 0; gy < mH; gy++) {
    for (let gx = 0; gx < mW; gx++) {
      let rS = 0, gS = 0, bS = 0, sS = 0, n = 0;
      for (let y = Math.floor(gy * mcH); y < Math.floor((gy + 1) * mcH); y++) {
        for (let x = Math.floor(gx * mcW); x < Math.floor((gx + 1) * mcW); x++) {
          const idx = y * W + x;
          rS += pixels[idx].r; gS += pixels[idx].g; bS += pixels[idx].b;
          sS += pixels[idx].sat; n++;
        }
      }
      megaCells.push({ r: rS / n, g: gS / n, b: bS / n, sat: sS / n, bright: (rS / n + gS / n + bS / n) / 3 });
    }
  }
  // How many mega-cells are "distinct" from each other?
  let distinctZones = 0;
  for (let i = 0; i < megaCells.length; i++) {
    let isDistinct = true;
    for (let j = 0; j < i; j++) {
      const dist = Math.sqrt(
        (megaCells[i].r - megaCells[j].r) ** 2 +
        (megaCells[i].g - megaCells[j].g) ** 2 +
        (megaCells[i].b - megaCells[j].b) ** 2
      );
      if (dist < 25) { isDistinct = false; break; }
    }
    if (isDistinct) distinctZones++;
  }

  // ── Left-right symmetry (pixel-level) ──
  let symDiff = 0, symN = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < Math.floor(W / 2); x++) {
      const li = y * W + x, ri = y * W + (W - 1 - x);
      symDiff += Math.abs(pixels[li].bright - pixels[ri].bright);
      symN++;
    }
  }
  const lrDiff = symDiff / symN;

  // ── Coarse left-right brightness difference ──
  // Average brightness of entire left half vs right half.
  // Sideline jerseys (pants on left, jersey on right) produce lrHalfDiff > 15.
  // Regular jerseys (front/back of same garment) typically produce lrHalfDiff < 10.
  let leftBrSum = 0, rightBrSum = 0;
  const halfW = Math.floor(W / 2);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < halfW; x++) leftBrSum += pixels[y * W + x].bright;
    for (let x = halfW; x < W; x++) rightBrSum += pixels[y * W + x].bright;
  }
  const leftHalfN = H * halfW, rightHalfN = H * (W - halfW);
  const lrHalfDiff = Math.abs(leftBrSum / leftHalfN - rightBrSum / rightHalfN);

  // ── Bottom-quarter left-right brightness difference ──
  // Sideline textures pack small items (gloves, cleats, socks) at bottom,
  // creating asymmetry there. Regular jerseys have uniform bottom.
  let botLeftBr = 0, botRightBr = 0, bln = 0, brn = 0;
  for (let y = Math.floor(H * 0.75); y < H; y++) {
    for (let x = 0; x < halfW; x++) { botLeftBr += pixels[y * W + x].bright; bln++; }
    for (let x = halfW; x < W; x++) { botRightBr += pixels[y * W + x].bright; brn++; }
  }
  const botLRDiff = Math.abs(botLeftBr / bln - botRightBr / brn);

  // ── Edge density ──
  let edgeCount = 0;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const idx = y * W + x;
      const gx = Math.abs(pixels[idx + 1].bright - pixels[idx - 1].bright);
      const gy = Math.abs(pixels[(y + 1) * W + x].bright - pixels[(y - 1) * W + x].bright);
      if (gx + gy > 25) edgeCount++;
    }
  }
  const edgeDensity = edgeCount / ((W - 2) * (H - 2));

  // ── Fine-vs-coarse texture ratio ──
  // High pixel-level variation but low cell-level variation = uniform texture with noise/fabric
  // Low pixel-level but high cell-level = smooth gradients between distinct zones
  let adjDiff = 0, adjN = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W - 1; x++) {
      const idx = y * W + x;
      adjDiff += Math.abs(pixels[idx].bright - pixels[idx + 1].bright);
      adjN++;
    }
  }
  const busyness = adjDiff / adjN;
  const coarseToFineRatio = busyness > 0.5 ? cellColorVar / busyness : 0;

  // ── Color palette size ──
  const colorBins = new Set();
  for (const p of nonDark) {
    colorBins.add(`${Math.floor(p.r / 32)}-${Math.floor(p.g / 32)}-${Math.floor(p.b / 32)}`);
  }
  const paletteSize = colorBins.size;

  // ── Black edge analysis (for glove detection) ──
  let leftBlack = 0, rightBlack = 0, bottomBlack = 0;
  for (let y = 0; y < H; y++) {
    if (pixels[y * W].bright < 15) leftBlack++;
    if (pixels[y * W + 1].bright < 15) leftBlack++;
    if (pixels[y * W + W - 1].bright < 15) rightBlack++;
    if (pixels[y * W + W - 2].bright < 15) rightBlack++;
  }
  for (let x = 0; x < W; x++) {
    if (pixels[(H - 1) * W + x].bright < 15) bottomBlack++;
    if (pixels[(H - 2) * W + x].bright < 15) bottomBlack++;
  }
  leftBlack /= H * 2; rightBlack /= H * 2; bottomBlack /= W * 2;
  const centerBright = (() => {
    let s = 0, n = 0;
    for (let y = Math.floor(H * 0.3); y < Math.floor(H * 0.7); y++) {
      for (let x = Math.floor(W * 0.15); x < Math.floor(W * 0.85); x++) {
        s += pixels[y * W + x].bright; n++;
      }
    }
    return s / n;
  })();

  // ── Top-bottom brightness difference ──
  // Jerseys have neckline openings at top creating TB asymmetry.
  // Pants are more vertically uniform.
  let topBrightSum = 0, botBrightSum = 0, topN = 0, botN = 0;
  const halfY = Math.floor(H / 2);
  for (let y = 0; y < halfY; y++) {
    for (let x = 0; x < W; x++) {
      topBrightSum += pixels[y * W + x].bright; topN++;
    }
  }
  for (let y = halfY; y < H; y++) {
    for (let x = 0; x < W; x++) {
      botBrightSum += pixels[y * W + x].bright; botN++;
    }
  }
  const tbDiff = Math.abs(topBrightSum / topN - botBrightSum / botN);

  return {
    avgBright, lowBins, entropy, darkAt20, darkAt40,
    nonDarkRatio, ndAvgSat, highSatPx,
    activeHues, dominantHuePct,
    cellBrightStd, cellColorVar,
    distinctZones, lrDiff, lrHalfDiff, botLRDiff, edgeDensity, busyness, coarseToFineRatio,
    paletteSize, tbDiff, opaqueFraction,
    leftBlack, rightBlack, bottomBlack, centerBright,
  };
}

// ── Structural Blob Detection (for cleat vs arm sleeve) ──────────────
// At 128x128, quantize brightness to 4 levels and flood-fill to count
// distinct connected regions. Cleat textures have many separated pieces
// (10+ blobs), arm sleeves are one continuous piece (1-3 blobs).

async function detectBlobs(filePath) {
  const W = 128, H = 128;
  const buf = await sharp(filePath)
    .resize(W, H, { fit: "fill" }).removeAlpha().raw().toBuffer();

  const px = [];
  for (let i = 0; i < W * H; i++) {
    px.push(Math.floor(((buf[i * 3] + buf[i * 3 + 1] + buf[i * 3 + 2]) / 3) / 64));
  }

  const visited = new Array(W * H).fill(false);
  let blobCount = 0;
  for (let i = 0; i < W * H; i++) {
    if (visited[i]) continue;
    visited[i] = true;
    const queue = [i];
    let size = 0;
    while (queue.length) {
      const idx = queue.pop();
      size++;
      const y = Math.floor(idx / W), x = idx % W;
      for (const [dy, dx] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const ny = y + dy, nx = x + dx;
        if (ny >= 0 && ny < H && nx >= 0 && nx < W) {
          const ni = ny * W + nx;
          if (!visited[ni] && px[ni] === px[idx]) {
            visited[ni] = true;
            queue.push(ni);
          }
        }
      }
    }
    if (size > 50) blobCount++;
  }
  return blobCount;
}

// Blob detection for 2048x1024 (2:1 aspect). Gloves have finger-like structure = 5+ blobs.
async function detectBlobsWide(filePath) {
  const W = 128, H = 64;
  const buf = await sharp(filePath)
    .resize(W, H, { fit: "fill" }).removeAlpha().raw().toBuffer();

  const px = [];
  for (let i = 0; i < W * H; i++) {
    px.push(Math.floor(((buf[i * 3] + buf[i * 3 + 1] + buf[i * 3 + 2]) / 3) / 64));
  }

  const visited = new Array(W * H).fill(false);
  let blobCount = 0;
  for (let i = 0; i < W * H; i++) {
    if (visited[i]) continue;
    visited[i] = true;
    const queue = [i];
    let size = 0;
    while (queue.length) {
      const idx = queue.pop();
      size++;
      const y = Math.floor(idx / W), x = idx % W;
      for (const [dy, dx] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const ny = y + dy, nx = x + dx;
        if (ny >= 0 && ny < H && nx >= 0 && nx < W) {
          const ni = ny * W + nx;
          if (!visited[ni] && px[ni] === px[idx]) {
            visited[ni] = true;
            queue.push(ni);
          }
        }
      }
    }
    if (size > 25) blobCount++;
  }
  return blobCount;
}

// ── Visual Classifier for 2048x1024 ─────────────────────────────────

async function classify2048x1024(f, suffix, variants, filePath) {
  // ─── PLACEHOLDERS ───
  if (f.avgBright < 1 && f.opaqueFraction > 0.5) return "Placeholder";

  // ─── FULLY TRANSPARENT ───
  if (f.opaqueFraction < 0.01) return "Numbers";

  // ─── GLOVE ───
  // Black edges (hand-shaped cutout on black bg), brighter center.
  if (variants >= 4 && f.leftBlack > 0.5 && f.rightBlack > 0.5 && f.bottomBlack > 0.4) {
    if (f.centerBright > 30) return "Glove";
  }
  if (f.leftBlack > 0.6 && f.rightBlack > 0.6 && f.bottomBlack > 0.5 && f.centerBright > 50 && variants >= 3) {
    return "Glove";
  }
  // Gloves have finger-like structure = 5+ blobs AND spatial asymmetry (lrHalf
  // or botLR > 5). Numbers have digits evenly spread so lrHalf/botLR stay < 5.
  // Catches gloves on colored backgrounds that lack black edges.
  if (filePath && (f.lrHalfDiff > 5 || f.botLRDiff > 5) && f.avgBright < 120 && f.centerBright > 15) {
    try {
      const blobs = await detectBlobsWide(filePath);
      if (blobs >= 5) return "Glove";
    } catch { /* fall through */ }
  }

  // ─── NUMBERS (checked FIRST — 0-9 digits = always Numbers) ───
  // Dark background with visible digit shapes (0-9), evenly distributed.
  // Must run before sideline detection so digit textures are never misclassified.
  if (f.lowBins >= 0.50 && f.avgBright < 85) {
    // Extremely dark with almost no content = just dark fabric, not numbers
    if (f.nonDarkRatio < 0.10 && f.edgeDensity < 0.10) {
      // Almost entirely black with no edge structure = dark pants/fabric
      // Fall through
    }
    // Dark with strong top-bottom asymmetry = jersey neckline, not numbers
    else if (f.tbDiff > 10) {
      // Fall through
    }
    // Very dark and uniform: low edge density + low brightness variance = dark fabric
    else if (f.lowBins >= 0.70 && f.edgeDensity < 0.12 && f.cellBrightStd < 8) {
      // Uniformly dark with no edge structure = dark pants
      // Fall through
    }
    // Has visible edge structure within the dark = digit shapes = Numbers
    else if (f.edgeDensity > 0.08 || f.cellBrightStd > 5) {
      if (f.nonDarkRatio < 0.65 && f.cellBrightStd < 40) {
        return "Numbers";
      }
      if (f.lowBins >= 0.60 && f.avgBright < 60) {
        return "Numbers";
      }
      if (f.entropy < 2.3 && f.lowBins >= 0.55 && f.edgeDensity > 0.10) {
        return "Numbers";
      }
    }
  }

  // ─── SIDELINE JERSEY ───
  // Composite UV map: pants on left, jersey on right, gloves/cleats/socks
  // packed at bottom. Nearly every Home/Away uniform has one.
  // Two independent signals (either is sufficient):
  //   lrHalfDiff > 15  — coarse LR half-brightness diff (pants ≠ jersey)
  //   botLRDiff  > 20  — bottom-quarter LR asymmetry (small items at bottom)
  // Regular jerseys never exceed either threshold (max lrHalf ~12, max botLR ~3).
  if (f.lrHalfDiff > 15 || f.botLRDiff > 20) return "Sideline Jersey";

  // ─── PANTS vs JERSEY ───
  // Multi-signal scoring based on visual structure differences:
  // - Pants: simple, uniform color, high LR symmetry, low spatial complexity
  // - Jerseys: complex patterns, multiple color zones, can be asymmetric
  let pantsScore = 0;
  let jerseyScore = 0;

  // Signal 1: Saturation - jerseys have rich team colors, pants are plainer
  if (f.ndAvgSat > 50) jerseyScore += 3;
  else if (f.ndAvgSat > 35) jerseyScore += 2;
  else if (f.ndAvgSat > 20) jerseyScore += 1;
  else if (f.ndAvgSat < 10) pantsScore += 2;
  else pantsScore += 1;

  // Signal 2: High-sat pixel fraction
  if (f.highSatPx > 0.30) jerseyScore += 2;
  else if (f.highSatPx > 0.15) jerseyScore += 1;
  else if (f.highSatPx < 0.05) pantsScore += 2;
  else if (f.highSatPx < 0.10) pantsScore += 1;

  // Signal 3: Left-right asymmetry - jerseys can be asymmetric, pants never are
  if (f.lrDiff > 20) jerseyScore += 2;
  else if (f.lrDiff > 10) jerseyScore += 1;
  else if (f.lrDiff < 5) pantsScore += 1;

  // Signal 4: Spatial color complexity - jerseys have distinct zones
  if (f.cellColorVar > 40) jerseyScore += 2;
  else if (f.cellColorVar > 30) jerseyScore += 1;
  else if (f.cellColorVar < 18) pantsScore += 2;
  else if (f.cellColorVar < 22) pantsScore += 1;

  // Signal 5: Distinct mega-zones - jerseys have shoulder/body/side zones
  if (f.distinctZones >= 4) jerseyScore += 2;
  else if (f.distinctZones >= 3) jerseyScore += 1;
  else if (f.distinctZones <= 1) pantsScore += 2;
  else if (f.distinctZones <= 2) pantsScore += 1;

  // Signal 6: Coarse-to-fine ratio - high = structured zones (jersey), low = uniform fabric (pants)
  if (f.coarseToFineRatio > 4) jerseyScore += 2;
  else if (f.coarseToFineRatio > 3) jerseyScore += 1;
  else if (f.coarseToFineRatio < 2) pantsScore += 1;

  // Signal 7: Color palette size
  if (f.paletteSize > 50) jerseyScore += 1;
  else if (f.paletteSize < 25) pantsScore += 1;

  // Signal 8: Entropy - higher entropy = more visual information
  if (f.entropy > 3.0) jerseyScore += 1;
  else if (f.entropy < 2.0) pantsScore += 1;

  // Signal 9: Edge density - jerseys have detailed fabric wrinkles/mesh
  // producing very high edge density; pants are smoother/more geometric
  if (f.edgeDensity > 0.3) jerseyScore += 3;
  else if (f.edgeDensity > 0.1) jerseyScore += 2;

  // Signal 10: Top-bottom brightness asymmetry - jersey UV maps have
  // neckline openings and shoulder areas at top, body/hem at bottom,
  // creating notable TB brightness differences. Pants are more uniform.
  if (f.tbDiff > 15) jerseyScore += 2;
  else if (f.tbDiff > 10) jerseyScore += 1;

  if (pantsScore > jerseyScore && pantsScore >= 3) return "Pants";
  return "Jersey";
}

// ── Visual Classifier for 2048x2048 ─────────────────────────────────

function classify2048x2048(f, suffix) {
  return "Team Select Helmet";
}

// ── Visual Classifier for 1536x1536 ─────────────────────────────────

function classify1536x1536(f, suffix) {
  return "Helmets";
}

// ── Visual Classifier for 1024x1024 ─────────────────────────────────

async function classify1024x1024(f, suffix, variants, filePath) {
  if (suffix === "00006213") return "Team Select Jersey Preview";
  if (suffix === "00005993") return "Sock";

  if (suffix === "00005dd3") {
    // Cleats have many separated UV pieces (sole, upper, etc.); arm sleeves have fewer.
    // Numbers are never 1024x1024 — only 2048x1024 digit textures.
    try {
      const blobs = await detectBlobs(filePath);
      if (blobs >= 5) return "Cleats";
      if (variants >= 4 && f.avgBright > 15) return "Arm Sleeves";
    } catch { /* fall through */ }
    return "Cleats";
  }
  if (suffix === "00006253") return "Jersey Detail";
  return "Accessory Texture";
}

// ── Visual Classifier for 1024x512 ──────────────────────────────────

function classify1024x512(f, suffix) {
  if (suffix === "000059d3") return "Wristbands";
  if (suffix === "00005dd3") return "Sock";
  if (suffix === "00006253") return "Arm Sleeves";

  if (suffix === "00005e13") {
    if (f.darkAt20 > 0.4) return "Numbers";
    return "Arm Sleeves";
  }
  return "Arm Sleeves";
}

// ── Visual Classifier for 512x512 ───────────────────────────────────

function classify512x512(f, suffix) {
  if (suffix === "00005993") return "Sock";
  if (suffix === "00005dd3") return "Sleeve";
  if (suffix === "00006213") return "Small Preview";
  if (suffix === "00005553") return "Shoes";
  return "Small Texture";
}

// ── Classify smaller sizes by suffix/dimensions ─────────────────────

function classifyBySize(bw, bh, suffix, f) {
  if (bw === 512 && bh === 256) return suffix === "000059d3" ? "Cleats" : "Cleats";
  if (bw === 256 && bh === 128) {
    if (suffix === "00005e13") return "Cleats";
    if (suffix === "000059d3") return "Shoes";
    if (suffix === "00006213") return "Cleats";
    return "Cleats";
  }
  if (bw === 256 && bh === 256) {
    if (suffix === "00005dd3") return "Numbers";
    if (suffix === "00005993") return "Small Accessory";
    if (suffix === "00006213") return "Small Icon";
    return "Small Texture";
  }
  if (bw === 128 && bh === 128) return "Texture Tile";
  if (bw === 64 && bh === 64) return "In-Game Logos";
  if (bw === 32 && bh === 32) return "In-Game Logos";
  if (bw === 16 && bh === 16) return "In-Game Logos";
  if (bw === 576 && bh === 288) return "Visor";
  if (bw === 828 && bh === 414) return "Sideline Detail";
  if (bw === 1030 && bh === 518) return suffix === "000059d3" ? "Wristbands" : "Shoes";
  if (bw === 360 && bh === 360) return "Badge";
  if (bw === 360 && bh === 180) return "Visor Stripe";
  if (bw === 432 && bh === 216) return "Visor";
  if (bw === 432 && bh === 432) return "Badge";
  if (bw === 216 && bh === 216) return "Patch";
  if (bw === 290 && bh === 290) return "Emblem";
  if (bw === 288 && bh === 288) return "Emblem";
  if (bw === 128 && bh === 64) return "Shoes";
  if (bw === 64 && bh === 32) return "Lace";
  if (bw === 72 && bh === 72) return "In-Game Logos";
  if (bw === 720 && bh === 720) return "Preview";
  return "Texture";
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  const root = process.argv[2] || "E:\\Emulation\\PS2\\textures\\SLUS-20919\\replacements\\Team";
  if (!fs.existsSync(root)) { console.error("Root not found:", root); process.exit(1); }

  fs.mkdirSync(DATA_DIR, { recursive: true });

  let manualOverrides = {};
  try { manualOverrides = JSON.parse(fs.readFileSync(MANUAL_OVERRIDES_PATH, "utf8")); } catch {}
  console.log(`Loaded ${Object.keys(manualOverrides).length} manual overrides.\n`);

  console.log("Scanning:", root);
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
  const allFiles = walk(root);
  console.log(`Found ${allFiles.length} PNG files.\n`);

  // Build prefix -> info, tracking the folder category (e.g. "Uniform", "Gear", etc.)
  const prefixInfo = {};
  for (const f of allFiles) {
    const name = path.basename(f).replace(".png", "");
    const parts = name.split("-");
    if (parts.length !== 3) continue;
    const [first, second, suffix] = parts;
    const relParts = path.relative(root, f).split(path.sep);
    const category = relParts.length >= 3 ? relParts[1] : null;
    if (!prefixInfo[first]) {
      prefixInfo[first] = { path: f, name: path.basename(f), suffix, variants: new Set(), allPaths: [], category };
    }
    prefixInfo[first].variants.add(second);
    prefixInfo[first].allPaths.push(f);
  }
  const prefixes = Object.keys(prefixInfo);
  const uniformCount = prefixes.filter(p => prefixInfo[p].category === "Uniform").length;
  console.log(`${prefixes.length} unique prefixes (${uniformCount} Uniform, ${prefixes.length - uniformCount} other).\n`);

  // ── Classify all textures ──
  console.log("Classifying with deep visual analysis...");
  const autoLabels = {};
  const textureIndex = {};
  let done = 0;
  let visualAnalyzed = 0;

  for (const prefix of prefixes) {
    const info = prefixInfo[prefix];
    const suffix = info.suffix;

    let meta;
    try { meta = await sharp(info.path).metadata(); } catch { continue; }
    if (!meta.width || !meta.height) continue;
    const [bw, bh] = bucketSize(meta.width, meta.height);
    info.bw = bw;
    info.bh = bh;

    textureIndex[prefix] = {
      suffix, width: bw, height: bh, variants: info.variants.size,
    };

    // Only classify Uniform textures with visual analysis;
    // all other categories get their folder name as the label.
    if (info.category !== "Uniform") {
      autoLabels[prefix] = info.category || "Unknown";
      done++;
      if (done % 500 === 0) process.stderr.write(`  ${done}/${prefixes.length}\n`);
      continue;
    }

    // Sizes that get deep visual analysis
    const needsVisual = (
      (bw === 2048 && bh === 1024) ||
      (bw === 2048 && bh === 2048) ||
      (bw === 1536 && bh === 1536) ||
      (bw === 1024 && bh === 1024) ||
      (bw === 1024 && bh === 512) ||
      (bw === 512 && bh === 512)
    );

    if (needsVisual) {
      try {
        const features = await analyzeVisuals(info.path, bw, bh);
        const variants = info.variants.size;

        if (bw === 2048 && bh === 1024) {
          autoLabels[prefix] = await classify2048x1024(features, suffix, variants, info.path);
        } else if (bw === 2048 && bh === 2048) {
          autoLabels[prefix] = classify2048x2048(features, suffix);
        } else if (bw === 1536 && bh === 1536) {
          autoLabels[prefix] = classify1536x1536(features, suffix);
        } else if (bw === 1024 && bh === 1024) {
          autoLabels[prefix] = await classify1024x1024(features, suffix, variants, info.path);
        } else if (bw === 1024 && bh === 512) {
          autoLabels[prefix] = classify1024x512(features, suffix);
        } else if (bw === 512 && bh === 512) {
          autoLabels[prefix] = classify512x512(features, suffix);
        }
        visualAnalyzed++;
      } catch {
        autoLabels[prefix] = classifyBySize(bw, bh, suffix, null);
      }
    } else {
      autoLabels[prefix] = classifyBySize(bw, bh, suffix, null);
    }

    done++;
    if (done % 500 === 0) process.stderr.write(`  ${done}/${prefixes.length}\n`);
  }

  console.log(`\nClassified ${Object.keys(autoLabels).length} prefixes (${visualAnalyzed} with deep visual analysis).\n`);

  // ── Save ──
  fs.writeFileSync(TEXTURE_INDEX_PATH, JSON.stringify(textureIndex, null, 2), "utf8");
  console.log(`Wrote texture index → ${TEXTURE_INDEX_PATH}`);

  fs.writeFileSync(AUTO_LABELS_PATH, JSON.stringify(autoLabels, null, 2), "utf8");
  console.log(`Wrote ${Object.keys(autoLabels).length} auto-labels → ${AUTO_LABELS_PATH}`);

  const merged = { ...autoLabels };
  let overrideCount = 0;
  for (const [prefix, label] of Object.entries(manualOverrides)) {
    if (label && typeof label === "string") {
      merged[prefix] = label;
      overrideCount++;
    }
  }
  fs.writeFileSync(MERGED_LABELS_PATH, JSON.stringify(merged, null, 2), "utf8");
  console.log(`Merged with ${overrideCount} manual overrides → ${MERGED_LABELS_PATH}`);

  // ── Summary ──
  const counts = {};
  for (const k in merged) counts[merged[k]] = (counts[merged[k]] || 0) + 1;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  console.log("\nFinal distribution:");
  for (const [l, c] of sorted) console.log(`  ${String(c).padStart(5)} ${l}`);

  // Show changes from old labels if they exist
  let oldLabels = {};
  try { oldLabels = JSON.parse(fs.readFileSync(AUTO_LABELS_PATH + ".bak", "utf8")); } catch {}
  if (Object.keys(oldLabels).length > 0) {
    const changes = {};
    for (const k in autoLabels) {
      if (oldLabels[k] && oldLabels[k] !== autoLabels[k]) {
        const key = `${oldLabels[k]} → ${autoLabels[k]}`;
        changes[key] = (changes[key] || 0) + 1;
      }
    }
    if (Object.keys(changes).length > 0) {
      console.log("\nChanges from previous run:");
      for (const [change, count] of Object.entries(changes).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${String(count).padStart(5)} ${change}`);
      }
    }
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
