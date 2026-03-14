// Export color variables from Figma 2KDS file into public/design-colors.json.
// Usage: FIGMA_API_TOKEN=... FIGMA_FILE_KEY=8QUfHuP4FDY0L7kRSSITIo node scripts/figma-colors.js
//
// Fetches local variables, resolves VARIABLE_ALIAS so all colors are included,
// and optionally uses node 5-273 (2KDS selection colors frame) to order colors.
// Requires file_variables:read scope (Enterprise).

const fs = require("fs");
const path = require("path");

const FIGMA_API_BASE = "https://api.figma.com/v1";

function getEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function figmaColorToHex(c) {
  if (!c || typeof c.r === "undefined") return null;
  const r = Math.round((c.r ?? 0) * 255);
  const g = Math.round((c.g ?? 0) * 255);
  const b = Math.round((c.b ?? 0) * 255);
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function isAlias(raw) {
  return raw && typeof raw === "object" && raw.type === "VARIABLE_ALIAS" && raw.id;
}

/** Resolve value for a COLOR variable in default mode; follow aliases. */
function resolveColorValue(varId, variables, collections, visited = new Set()) {
  if (visited.has(varId)) return null;
  visited.add(varId);
  const variable = variables[varId];
  if (!variable || variable.resolvedType !== "COLOR") return null;
  const valuesByMode = variable.valuesByMode || {};
  const collection = variable.variableCollectionId
    ? collections[variable.variableCollectionId]
    : null;
  const defaultModeId = collection?.defaultModeId;
  const modeId =
    defaultModeId && valuesByMode[defaultModeId] !== undefined
      ? defaultModeId
      : Object.keys(valuesByMode)[0];
  const raw = modeId ? valuesByMode[modeId] : null;
  if (!raw || typeof raw !== "object") return null;
  if (isAlias(raw)) {
    return resolveColorValue(raw.id, variables, collections, visited);
  }
  return figmaColorToHex(raw);
}

/** Collect bound variable IDs from a node's fills (recursive). */
function collectFillVariableIds(node, out = new Set()) {
  if (!node) return out;
  if (node.fills && Array.isArray(node.fills)) {
    for (const fill of node.fills) {
      if (fill.boundVariables && fill.boundVariables.color) {
        const id = fill.boundVariables.color.id;
        if (id) out.add(id);
      }
    }
  }
  if (node.children) {
    for (const child of node.children) {
      collectFillVariableIds(child, out);
    }
  }
  return out;
}

/** Find node by id in document (e.g. "5:273" from node-id=5-273). */
function findNodeById(obj, targetId) {
  const norm = (id) => String(id).replace("-", ":");
  const want = norm(targetId);
  if (norm(obj.id) === want) return obj;
  if (obj.children) {
    for (const c of obj.children) {
      const found = findNodeById(c, targetId);
      if (found) return found;
    }
  }
  return null;
}

async function main() {
  const token = getEnv("FIGMA_API_TOKEN");
  const fileKey = process.env.FIGMA_FILE_KEY || "8QUfHuP4FDY0L7kRSSITIo";
  const selectionNodeId = process.env.FIGMA_SELECTION_NODE_ID || "5-273";

  const url = `${FIGMA_API_BASE}/files/${fileKey}/variables/local`;
  const res = await fetch(url, {
    headers: { "X-Figma-Token": token },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Figma API ${res.status}: ${text}`);
  }
  const data = await res.json();
  const meta = data.meta || {};
  const variables = meta.variables || {};
  const collections = meta.variableCollections || {};

  const colorsWithIds = [];
  for (const [varId, variable] of Object.entries(variables)) {
    if (variable.resolvedType !== "COLOR") continue;
    const value = resolveColorValue(varId, variables, collections);
    if (!value) continue;
    colorsWithIds.push({
      variableId: varId,
      id: variable.key || varId,
      name: variable.name || varId,
      value,
    });
  }

  let selectionOrder = [];
  try {
    const fileUrl = `${FIGMA_API_BASE}/files/${fileKey}?depth=4`;
    const fileRes = await fetch(fileUrl, {
      headers: { "X-Figma-Token": token },
    });
    if (fileRes.ok) {
      const fileData = await fileRes.json();
      const doc = fileData.document;
      const node = findNodeById(doc, selectionNodeId);
      if (node) {
        selectionOrder = Array.from(collectFillVariableIds(node));
      }
    }
  } catch (e) {
    // ignore
  }

  const colors = colorsWithIds.map(({ variableId, id, name, value }) => ({
    id,
    name,
    value,
  }));
  if (selectionOrder.length > 0) {
    const byVarId = new Map(
      colorsWithIds.map((c) => [c.variableId, { id: c.id, name: c.name, value: c.value }])
    );
    const ordered = [];
    for (const vid of selectionOrder) {
      const c = byVarId.get(vid);
      if (c) ordered.push(c);
    }
    const orderedIds = new Set(ordered.map((c) => c.id));
    colors.length = 0;
    colors.push(...ordered);
    colorsWithIds.forEach((c) => {
      if (!orderedIds.has(c.id)) colors.push({ id: c.id, name: c.name, value: c.value });
    });
  }

  const outPath = path.join(__dirname, "..", "public", "design-colors.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(colors, null, 2), "utf8");
  console.log(`Wrote ${colors.length} color variables → ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
