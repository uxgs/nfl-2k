/**
 * Build image URL for a texture file.
 * Path mirrors disk: Team/[teamFolder]/Uniform/[uniformFolder]/[Shared|Home|Away]/[id].png
 * Set NEXT_PUBLIC_TEXTURES_BASE_URL (e.g. from a static server on your texture root) to enable.
 */

const TEAM_TO_FOLDER: Record<string, string> = {
  Buccaneers: "Bucs"
  // others use the same name (49ers, Bears, etc.)
};

const BUCKET_LABEL: Record<string, string> = {
  shared: "Shared",
  home: "Home",
  away: "Away"
};

/** Teams that have texture folders on disk (only show images for these). */
export const TEXTURE_IMAGE_TEAMS = new Set([
  "49ers",
  "Bears",
  "Bengals",
  "Bills",
  "Broncos",
  "Browns",
  "Buccaneers",
  "Cardinals",
  "Chargers",
  "Chiefs"
]);

export function teamToFolder(team: string): string {
  return TEAM_TO_FOLDER[team] ?? team;
}

export function bucketToLabel(bucket: string): string {
  return BUCKET_LABEL[bucket] ?? bucket;
}

export function getTextureImageUrl(params: {
  basePath: string;
  team: string;
  uniformName: string;
  bucket: string;
  id: string;
}): string {
  const { basePath, team, uniformName, bucket, id } = params;
  const base = basePath.replace(/\/$/, "");
  const teamFolder = encodeURIComponent(teamToFolder(team));
  const uniformFolder = encodeURIComponent(uniformName);
  const bucketLabel = bucketToLabel(bucket);
  return `${base}/Team/${teamFolder}/Uniform/${uniformFolder}/${bucketLabel}/${id}.png`;
}

export function getTexturesBaseUrl(): string {
  if (typeof window !== "undefined") {
    return (process.env.NEXT_PUBLIC_TEXTURES_BASE_URL ?? "").trim();
  }
  return (process.env.NEXT_PUBLIC_TEXTURES_BASE_URL ?? "").trim();
}

export function canShowTextureImage(baseUrl: string, team: string): boolean {
  return baseUrl.length > 0 && TEXTURE_IMAGE_TEAMS.has(team);
}
