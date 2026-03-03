import type { PartKey, SharingIndex, TextureData, TextureId, Usage, UniformBucketKey } from "./types";

function isPartKey(x: string): x is PartKey {
  return (
    x === "jerseyTop" ||
    x === "sleeves" ||
    x === "pants" ||
    x === "socks" ||
    x === "helmet" ||
    x === "numbers" ||
    x === "sidelineJerseys" ||
    x === "teamSelectPlayer" ||
    x === "teamSelectHelmet"
  );
}

const BUCKETS: UniformBucketKey[] = ["shared", "home", "away"];

export function buildSharingIndexForGame(data: TextureData, game: string): SharingIndex {
  const gameEntry = data.games[game];
  const index: SharingIndex = {};
  if (!gameEntry) return index;

  for (const [team, teamEntry] of Object.entries(gameEntry.teams)) {
    for (const [uniformName, uniformEntry] of Object.entries(teamEntry.uniforms)) {
      for (const bucket of BUCKETS) {
        const parts = uniformEntry[bucket];
        if (!parts) continue;

        for (const [partKey, ids] of Object.entries(parts)) {
          if (!isPartKey(partKey)) continue;
          if (!Array.isArray(ids)) continue;

          for (const textureId of ids as TextureId[]) {
            const usage: Usage = { game, team, uniformName, bucket, part: partKey };
            (index[textureId] ??= []).push(usage);
          }
        }
      }
    }
  }

  return index;
}

