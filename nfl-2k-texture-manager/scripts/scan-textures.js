// Scans a textures root folder and builds/updates the manifest.
//
// Handles these structures:
//   <root>/<Team>/<Category>/<Year-Set>/<Type>/<files>   (e.g. Cardinals/Uniform/2004 Alternate 1/Away/*.png)
//   <root>/<Team>/<Category>/<Type>/<files>              (e.g. Cardinals/Uniform/Away/*.png — no year)
//   <root>/<Team>/<Flat-Folder>/<files>                  (e.g. Cardinals/Coach/*.png)
//
// Usage:
//   node scripts/scan-textures.js [root_path]
//   Defaults to: E:\Emulation\PS2\textures\SLUS-20919\replacements\Team

const fs = require("fs");
const path = require("path");

const IMAGE_EXTS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".bmp",
  ".tga",
  ".dds",
  ".gif",
  ".webp",
]);

const UNIFORM_TYPES = new Set([
  "home",
  "away",
  "shared",
  "alternate",
  "color rush",
  "throwback",
]);

function isImageFile(name) {
  return IMAGE_EXTS.has(path.extname(name).toLowerCase());
}

function inferSlotId(filename) {
  const lower = filename.toLowerCase();
  if (lower.includes("helmet") && lower.includes("preview"))
    return "helmet_preview";
  if (lower.includes("uniform") && lower.includes("preview"))
    return "uniform_preview";
  if (lower.includes("helmet")) return "helmet";
  if (lower.includes("jersey")) return "jersey";
  if (lower.includes("arm") && lower.includes("sleeve")) return "arm_sleeve";
  if (lower.includes("sleeve")) return "sleeve";
  if (lower.includes("pant")) return "pant";
  if (lower.includes("number")) return "number";
  if (lower.includes("sock")) return "sock";
  if (lower.includes("wristband")) return "wristband";
  if (lower.includes("cleat")) return "cleat";
  if (lower.includes("sideline")) return "sideline_uniform";
  if (lower.includes("glove")) return "glove";
  return path.parse(filename).name.replace(/\s+/g, "_").toLowerCase();
}

function teamNameToId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "_");
}

function hasUniformTypeChildren(dir) {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .some((e) => e.isDirectory() && UNIFORM_TYPES.has(e.name.toLowerCase()));
  } catch {
    return false;
  }
}

function scanTeamDir(teamDir, teamName, texturesRoot) {
  const uniforms = [];
  const entries = fs.readdirSync(teamDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const categoryPath = path.join(teamDir, entry.name);
    const categoryName = entry.name;
    const categoryChildren = fs.readdirSync(categoryPath, {
      withFileTypes: true,
    });
    const categorySubdirs = categoryChildren.filter((e) => e.isDirectory());

    // Case 1: This folder directly contains Away/Home/Shared type dirs
    //   e.g. Team/Cardinals/Uniform/Away (though unlikely at this level)
    if (UNIFORM_TYPES.has(categoryName.toLowerCase())) {
      const slots = collectSlots(categoryPath, texturesRoot);
      if (slots.length > 0) {
        uniforms.push({
          category: "default",
          year: "default",
          uniformType: categoryName,
          slots,
        });
      }
      continue;
    }

    // Check children of this category folder
    const directlyHasTypes = categorySubdirs.some((e) =>
      UNIFORM_TYPES.has(e.name.toLowerCase()),
    );

    if (directlyHasTypes) {
      // Case 2: Category directly contains type dirs
      //   e.g. Team/Cardinals/SomeCategory/Away|Home|Shared
      //   This means no year-set level; use "default" as year
      for (const subEntry of categorySubdirs) {
        if (UNIFORM_TYPES.has(subEntry.name.toLowerCase())) {
          const typePath = path.join(categoryPath, subEntry.name);
          const slots = collectSlots(typePath, texturesRoot);
          if (slots.length > 0) {
            uniforms.push({
              category: categoryName,
              year: "default",
              uniformType: subEntry.name,
              slots,
            });
          }
        } else {
          // Non-type subfolder — might contain files
          const slots = collectSlots(
            path.join(categoryPath, subEntry.name),
            texturesRoot,
          );
          if (slots.length > 0) {
            uniforms.push({
              category: categoryName,
              year: "default",
              uniformType: subEntry.name,
              slots,
            });
          }
        }
      }
      // Collect files directly under the category folder too
      const catSlots = collectSlots(categoryPath, texturesRoot, false);
      if (catSlots.length > 0) {
        uniforms.push({
          category: categoryName,
          year: "default",
          uniformType: "Shared",
          slots: catSlots,
        });
      }
    } else {
      // Check if children are year-set folders that themselves contain type dirs
      //   e.g. Team/Cardinals/Uniform/Default/Away|Home|Shared
      //        Team/Cardinals/Uniform/2004 Alternate 1/Away|Home|Shared
      const childrenWithTypes = categorySubdirs.filter((sub) =>
        hasUniformTypeChildren(path.join(categoryPath, sub.name)),
      );

      if (childrenWithTypes.length > 0) {
        // Case 3: Category → Year-Set → Type → files (three levels)
        for (const yearEntry of categorySubdirs) {
          const yearPath = path.join(categoryPath, yearEntry.name);
          const yearChildren = fs
            .readdirSync(yearPath, { withFileTypes: true })
            .filter((e) => e.isDirectory());

          const yearHasTypes = yearChildren.some((e) =>
            UNIFORM_TYPES.has(e.name.toLowerCase()),
          );

          if (yearHasTypes) {
            for (const typeEntry of yearChildren) {
              const typePath = path.join(yearPath, typeEntry.name);
              const slots = collectSlots(typePath, texturesRoot);
              if (slots.length > 0) {
                uniforms.push({
                  category: categoryName,
                  year: yearEntry.name,
                  uniformType: typeEntry.name,
                  slots,
                });
              }
            }
            // Also collect files directly in the year-set folder
            const yearSlots = collectSlots(yearPath, texturesRoot, false);
            if (yearSlots.length > 0) {
              uniforms.push({
                category: categoryName,
                year: yearEntry.name,
                uniformType: "Shared",
                slots: yearSlots,
              });
            }
          } else {
            // Year-set folder with no type subdirs — collect all files
            const slots = collectSlots(yearPath, texturesRoot);
            if (slots.length > 0) {
              uniforms.push({
                category: categoryName,
                year: yearEntry.name,
                uniformType: "All",
                slots,
              });
            }
          }
        }
        // Collect files directly under the category folder
        const catSlots = collectSlots(categoryPath, texturesRoot, false);
        if (catSlots.length > 0) {
          uniforms.push({
            category: categoryName,
            year: "default",
            uniformType: "Shared",
            slots: catSlots,
          });
        }
      } else {
        // Case 4: Simple folder with just files (no type/year structure)
        //   e.g. Team/Cardinals/Coach/<files>
        const slots = collectSlots(categoryPath, texturesRoot);
        if (slots.length > 0) {
          uniforms.push({
            category: categoryName,
            year: "default",
            uniformType: "All",
            slots,
          });
        }
      }
    }
  }

  // Also collect files directly under the team folder
  const directSlots = collectSlots(teamDir, texturesRoot, false);
  if (directSlots.length > 0) {
    uniforms.push({
      category: "default",
      year: "default",
      uniformType: "Shared",
      slots: directSlots,
    });
  }

  return uniforms;
}

function collectSlots(dir, texturesRoot, recurse = true) {
  const slots = [];
  if (!fs.existsSync(dir)) return slots;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && isImageFile(entry.name)) {
      const fullPath = path.join(dir, entry.name);
      const relToRoot = path.relative(texturesRoot, fullPath);
      slots.push({
        slotId: inferSlotId(entry.name),
        frameName: path.parse(entry.name).name,
        filename: entry.name,
        relativePath: relToRoot,
      });
    } else if (entry.isDirectory() && recurse) {
      const subSlots = collectSlots(
        path.join(dir, entry.name),
        texturesRoot,
        true,
      );
      slots.push(...subSlots);
    }
  }
  return slots;
}

function main() {
  const rootArg =
    process.argv[2] ||
    "E:\\Emulation\\PS2\\textures\\SLUS-20919\\replacements\\Team";
  const root = path.resolve(rootArg);

  if (!fs.existsSync(root)) {
    console.error(`Root directory does not exist: ${root}`);
    process.exit(1);
  }

  console.log(`Scanning textures root: ${root}`);

  const teamEntries = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory());

  const teams = [];
  for (const entry of teamEntries) {
    const teamDir = path.join(root, entry.name);
    const teamName = entry.name;
    const teamId = teamNameToId(teamName);
    console.log(`  Scanning team: ${teamName} (${teamId})`);

    const uniforms = scanTeamDir(teamDir, teamName, root);
    teams.push({
      id: teamId,
      name: teamName,
      uniforms,
    });
  }

  teams.sort((a, b) => a.name.localeCompare(b.name));

  const manifest = { teams };
  const outPath = path.join(__dirname, "..", "data", "manifest.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2), "utf8");
  console.log(
    `\nWrote manifest with ${teams.length} teams to: ${outPath}`,
  );
}

main();
