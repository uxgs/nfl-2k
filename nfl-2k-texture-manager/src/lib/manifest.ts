import fs from "fs/promises";
import path from "path";

export type TextureSlotId = string;

export type TextureSlot = {
  slotId: TextureSlotId;
  frameName: string;
  filename: string;
  relativePath: string;
};

export type UniformSet = {
  category: string;
  year: string;
  uniformType: string;
  slots: TextureSlot[];
};

export type TeamId = string;

export type TeamManifest = {
  id: TeamId;
  name: string;
  uniforms: UniformSet[];
};

export type Manifest = {
  teams: TeamManifest[];
};

const DEFAULT_TEXTURES_ROOT =
  "E:\\Emulation\\PS2\\textures\\SLUS-20919\\replacements\\Team";

export function getTexturesRoot(): string {
  return process.env.TEXTURES_ROOT || DEFAULT_TEXTURES_ROOT;
}

export function getManifestPath(): string {
  return path.join(process.cwd(), "data", "manifest.json");
}

export async function readManifest(): Promise<Manifest> {
  const manifestPath = getManifestPath();
  const raw = await fs.readFile(manifestPath, "utf8");
  return JSON.parse(raw) as Manifest;
}

export function getAbsoluteTexturePath(slot: TextureSlot): string {
  const root = getTexturesRoot();
  return path.isAbsolute(slot.relativePath)
    ? slot.relativePath
    : path.join(root, slot.relativePath);
}

export async function listTeams() {
  const manifest = await readManifest();
  return manifest.teams.slice().sort((a, b) => a.name.localeCompare(b.name));
}

export async function getTeam(teamId: TeamId): Promise<TeamManifest | null> {
  const manifest = await readManifest();
  return manifest.teams.find((t) => t.id === teamId) ?? null;
}

export async function listCategoriesForTeam(
  teamId: TeamId,
): Promise<string[]> {
  const team = await getTeam(teamId);
  if (!team) return [];
  const cats = new Set<string>();
  for (const u of team.uniforms) cats.add(u.category);
  return Array.from(cats).sort();
}

export async function listYearsForTeamCategory(
  teamId: TeamId,
  category: string,
): Promise<string[]> {
  const team = await getTeam(teamId);
  if (!team) return [];
  const years = new Set<string>();
  for (const u of team.uniforms) {
    if (u.category === category) years.add(u.year);
  }
  return Array.from(years).sort();
}

export async function listTypesForTeamCategoryYear(
  teamId: TeamId,
  category: string,
  year: string,
): Promise<string[]> {
  const team = await getTeam(teamId);
  if (!team) return [];
  const types = new Set<string>();
  for (const u of team.uniforms) {
    if (u.category === category && u.year === year) types.add(u.uniformType);
  }
  return Array.from(types).sort();
}

export async function getUniformSet(
  teamId: TeamId,
  category: string,
  year: string,
  uniformType: string,
): Promise<UniformSet | null> {
  const team = await getTeam(teamId);
  if (!team) return null;
  return (
    team.uniforms.find(
      (u) =>
        u.category === category &&
        u.year === year &&
        u.uniformType === uniformType,
    ) ?? null
  );
}

export async function getUniformSetsForCategoryYear(
  teamId: TeamId,
  category: string,
  year: string,
): Promise<UniformSet[]> {
  const team = await getTeam(teamId);
  if (!team) return [];
  return team.uniforms.filter(
    (u) => u.category === category && u.year === year,
  );
}
