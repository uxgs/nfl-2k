import type { LookupResult, PartsMap, SetChoice, TextureData, UniformEntry } from "./types";
import { buildSharingIndexForGame } from "./sharing";

function mergeParts(into: PartsMap, from?: PartsMap): PartsMap {
  if (!from) return into;
  for (const [k, v] of Object.entries(from)) {
    const ids = v ?? [];
    if (!Array.isArray(ids) || ids.length === 0) continue;
    // @ts-expect-error keys are validated by schema discipline
    into[k] = ids;
  }
  return into;
}

function getBucket(uniform: UniformEntry | undefined, bucket: "shared" | "home" | "away"): PartsMap | undefined {
  return uniform?.[bucket];
}

export function lookupUniformTextures(args: {
  data: TextureData;
  game: string;
  team: string;
  uniformName: string;
  setChoice: SetChoice;
}): LookupResult {
  const { data, game, team, uniformName, setChoice } = args;
  const uniform = data.games?.[game]?.teams?.[team]?.uniforms?.[uniformName];

  const sharingIndex = buildSharingIndexForGame(data, game);

  const shared = getBucket(uniform, "shared");
  const home = getBucket(uniform, "home");
  const away = getBucket(uniform, "away");

  const sections: LookupResult["sections"] = [];

  if (setChoice === "home") {
    sections.push({ title: "Shared", bucket: "shared", parts: shared ?? {} });
    sections.push({ title: "Home", bucket: "home", parts: home ?? {} });
  } else if (setChoice === "away") {
    sections.push({ title: "Shared", bucket: "shared", parts: shared ?? {} });
    sections.push({ title: "Away", bucket: "away", parts: away ?? {} });
  } else {
    sections.push({ title: "Shared (Home+Away)", bucket: "shared", parts: shared ?? {} });
    sections.push({ title: "Home-only", bucket: "home", parts: home ?? {} });
    sections.push({ title: "Away-only", bucket: "away", parts: away ?? {} });
  }

  const allParts: PartsMap = {};
  for (const s of sections) mergeParts(allParts, s.parts);

  const allTextureIds = new Set<string>();
  for (const ids of Object.values(allParts)) for (const id of ids ?? []) allTextureIds.add(String(id));

  const sharedTextureIds = [...allTextureIds].filter((id) => (sharingIndex[id]?.length ?? 0) > 1);

  return { sections, sharedTextureIds, sharingIndex };
}

