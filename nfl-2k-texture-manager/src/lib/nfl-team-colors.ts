/**
 * NFL color palette from design reference.
 * Utility colors first, then all 32 teams: first = primary, second = secondary, rest = tertiary.
 * Team names appear to the right of their swatches in the reference.
 */

export type TeamColor = {
  id: string;
  name: string;
  value: string;
};

export type NFLTeamPalette = {
  /** Folder-friendly id (e.g. "49ers", "Cardinals") */
  id: string;
  /** Display name */
  name: string;
  primary: TeamColor;
  secondary: TeamColor;
  tertiary: TeamColor[];
};

/** Utility colors (top of palette): Off Black, Texture White, NFL Shield, Grey */
export const UTILITY_COLORS: TeamColor[] = [
  { id: "off-black", name: "Off Black", value: "#000000" },
  { id: "texture-white", name: "Texture White", value: "#FFFFFF" },
  { id: "pure-white", name: "Pure White", value: "#FFFFFF" },
  { id: "nfl-shield-red", name: "NFL Shield Red", value: "#C60C30" },
  { id: "nfl-shield-white", name: "NFL Shield White", value: "#FFFFFF" },
  { id: "nfl-shield-frost", name: "NFL Shield Frost", value: "#A5ACAF" },
  { id: "nfl-shield-blue", name: "NFL Shield Blue", value: "#013369" },
  { id: "grey", name: "Grey", value: "#737373" },
];

/** All 32 NFL teams: primary, secondary, tertiary. Order matches reference image. */
export const NFL_TEAM_PALETTES: NFLTeamPalette[] = [
  { id: "Cardinals", name: "Arizona Cardinals", primary: { id: "cardinals-primary", name: "Primary", value: "#97233F" }, secondary: { id: "cardinals-secondary", name: "Secondary", value: "#000000" }, tertiary: [{ id: "cardinals-t1", name: "Tertiary", value: "#FFB612" }] },
  { id: "Falcons", name: "Atlanta Falcons", primary: { id: "falcons-primary", name: "Primary", value: "#000000" }, secondary: { id: "falcons-secondary", name: "Secondary", value: "#A71930" }, tertiary: [{ id: "falcons-t1", name: "Tertiary", value: "#FFFFFF" }] },
  { id: "Ravens", name: "Baltimore Ravens", primary: { id: "ravens-primary", name: "Primary", value: "#241773" }, secondary: { id: "ravens-secondary", name: "Secondary", value: "#000000" }, tertiary: [{ id: "ravens-t1", name: "Tertiary", value: "#9E7C0C" }, { id: "ravens-t2", name: "Tertiary", value: "#FFFFFF" }] },
  { id: "Bills", name: "Buffalo Bills", primary: { id: "bills-primary", name: "Primary", value: "#00338D" }, secondary: { id: "bills-secondary", name: "Secondary", value: "#C60C30" }, tertiary: [{ id: "bills-t1", name: "Tertiary", value: "#125740" }, { id: "bills-t2", name: "Tertiary", value: "#FFFFFF" }] },
  { id: "Panthers", name: "Carolina Panthers", primary: { id: "panthers-primary", name: "Primary", value: "#0085CA" }, secondary: { id: "panthers-secondary", name: "Secondary", value: "#101820" }, tertiary: [{ id: "panthers-t1", name: "Tertiary", value: "#FFFFFF" }] },
  { id: "Bears", name: "Chicago Bears", primary: { id: "bears-primary", name: "Primary", value: "#0B162A" }, secondary: { id: "bears-secondary", name: "Secondary", value: "#C83803" }, tertiary: [{ id: "bears-t1", name: "Tertiary", value: "#FFFFFF" }] },
  { id: "Bengals", name: "Cincinnati Bengals", primary: { id: "bengals-primary", name: "Primary", value: "#000000" }, secondary: { id: "bengals-secondary", name: "Secondary", value: "#FB4F14" }, tertiary: [{ id: "bengals-t1", name: "Tertiary", value: "#FFFFFF" }] },
  { id: "Browns", name: "Cleveland Browns", primary: { id: "browns-primary", name: "Primary", value: "#311D00" }, secondary: { id: "browns-secondary", name: "Secondary", value: "#FF3C00" }, tertiary: [{ id: "browns-t1", name: "Tertiary", value: "#FFFFFF" }] },
  { id: "Cowboys", name: "Dallas Cowboys", primary: { id: "cowboys-primary", name: "Primary", value: "#002244" }, secondary: { id: "cowboys-secondary", name: "Secondary", value: "#869397" }, tertiary: [{ id: "cowboys-t1", name: "Tertiary", value: "#FFFFFF" }, { id: "cowboys-t2", name: "Tertiary", value: "#003594" }] },
  { id: "Broncos", name: "Denver Broncos", primary: { id: "broncos-primary", name: "Primary", value: "#002244" }, secondary: { id: "broncos-secondary", name: "Secondary", value: "#FB4F14" }, tertiary: [{ id: "broncos-t1", name: "Tertiary", value: "#0A2342" }, { id: "broncos-t2", name: "Tertiary", value: "#FFFFFF" }] },
  { id: "Lions", name: "Detroit Lions", primary: { id: "lions-primary", name: "Primary", value: "#0076B6" }, secondary: { id: "lions-secondary", name: "Secondary", value: "#B0B7BC" }, tertiary: [{ id: "lions-t1", name: "Tertiary", value: "#FFFFFF" }] },
  { id: "Packers", name: "Green Bay Packers", primary: { id: "packers-primary", name: "Primary", value: "#203731" }, secondary: { id: "packers-secondary", name: "Secondary", value: "#FFB612" }, tertiary: [{ id: "packers-t1", name: "Tertiary", value: "#FFFFFF" }] },
  { id: "Texans", name: "Houston Texans", primary: { id: "texans-primary", name: "Primary", value: "#03202F" }, secondary: { id: "texans-secondary", name: "Secondary", value: "#A71930" }, tertiary: [{ id: "texans-t1", name: "Tertiary", value: "#FFFFFF" }] },
  { id: "Colts", name: "Indianapolis Colts", primary: { id: "colts-primary", name: "Primary", value: "#002C5F" }, secondary: { id: "colts-secondary", name: "Secondary", value: "#FFFFFF" }, tertiary: [{ id: "colts-t1", name: "Tertiary", value: "#A2AAAD" }] },
  { id: "Jaguars", name: "Jacksonville Jaguars", primary: { id: "jaguars-primary", name: "Primary", value: "#000000" }, secondary: { id: "jaguars-secondary", name: "Secondary", value: "#D7A22A" }, tertiary: [{ id: "jaguars-t1", name: "Tertiary", value: "#006778" }] },
  { id: "Chiefs", name: "Kansas City Chiefs", primary: { id: "chiefs-primary", name: "Primary", value: "#E31837" }, secondary: { id: "chiefs-secondary", name: "Secondary", value: "#FFB612" }, tertiary: [{ id: "chiefs-t1", name: "Tertiary", value: "#FFFFFF" }, { id: "chiefs-t2", name: "Tertiary", value: "#000000" }] },
  { id: "Raiders", name: "Las Vegas Raiders", primary: { id: "raiders-primary", name: "Primary", value: "#000000" }, secondary: { id: "raiders-secondary", name: "Secondary", value: "#A5ACAF" }, tertiary: [{ id: "raiders-t1", name: "Tertiary", value: "#FFFFFF" }] },
  { id: "Chargers", name: "Los Angeles Chargers", primary: { id: "chargers-primary", name: "Primary", value: "#0080C6" }, secondary: { id: "chargers-secondary", name: "Secondary", value: "#FFC20E" }, tertiary: [{ id: "chargers-t1", name: "Tertiary", value: "#FFFFFF" }, { id: "chargers-t2", name: "Tertiary", value: "#002A5E" }] },
  { id: "Rams", name: "Los Angeles Rams", primary: { id: "rams-primary", name: "Primary", value: "#003594" }, secondary: { id: "rams-secondary", name: "Secondary", value: "#FFA300" }, tertiary: [{ id: "rams-t1", name: "Tertiary", value: "#FFF2CC" }] },
  { id: "Dolphins", name: "Miami Dolphins", primary: { id: "dolphins-primary", name: "Primary", value: "#008E97" }, secondary: { id: "dolphins-secondary", name: "Secondary", value: "#FC4C02" }, tertiary: [{ id: "dolphins-t1", name: "Tertiary", value: "#FFFFFF" }, { id: "dolphins-t2", name: "Tertiary", value: "#005778" }] },
  { id: "Vikings", name: "Minnesota Vikings", primary: { id: "vikings-primary", name: "Primary", value: "#4F2683" }, secondary: { id: "vikings-secondary", name: "Secondary", value: "#FFC62F" }, tertiary: [{ id: "vikings-t1", name: "Tertiary", value: "#FFFFFF" }, { id: "vikings-t2", name: "Tertiary", value: "#000000" }] },
  { id: "Patriots", name: "New England Patriots", primary: { id: "patriots-primary", name: "Primary", value: "#002244" }, secondary: { id: "patriots-secondary", name: "Secondary", value: "#C60C30" }, tertiary: [{ id: "patriots-t1", name: "Tertiary", value: "#B0B7BC" }, { id: "patriots-t2", name: "Tertiary", value: "#FFFFFF" }] },
  { id: "Saints", name: "New Orleans Saints", primary: { id: "saints-primary", name: "Primary", value: "#D3BC8D" }, secondary: { id: "saints-secondary", name: "Secondary", value: "#000000" }, tertiary: [{ id: "saints-t1", name: "Tertiary", value: "#FFFFFF" }] },
  { id: "Giants", name: "New York Giants", primary: { id: "giants-primary", name: "Primary", value: "#0B2265" }, secondary: { id: "giants-secondary", name: "Secondary", value: "#A71930" }, tertiary: [{ id: "giants-t1", name: "Tertiary", value: "#A5ACAF" }, { id: "giants-t2", name: "Tertiary", value: "#FFFFFF" }] },
  { id: "Jets", name: "New York Jets", primary: { id: "jets-primary", name: "Primary", value: "#125740" }, secondary: { id: "jets-secondary", name: "Secondary", value: "#000000" }, tertiary: [{ id: "jets-t1", name: "Tertiary", value: "#FFFFFF" }, { id: "jets-t2", name: "Tertiary", value: "#A5ACAF" }] },
  { id: "Eagles", name: "Philadelphia Eagles", primary: { id: "eagles-primary", name: "Primary", value: "#004C54" }, secondary: { id: "eagles-secondary", name: "Secondary", value: "#A5ACAF" }, tertiary: [{ id: "eagles-t1", name: "Tertiary", value: "#000000" }, { id: "eagles-t2", name: "Tertiary", value: "#69BE28" }] },
  { id: "Steelers", name: "Pittsburgh Steelers", primary: { id: "steelers-primary", name: "Primary", value: "#000000" }, secondary: { id: "steelers-secondary", name: "Secondary", value: "#FFB612" }, tertiary: [{ id: "steelers-t1", name: "Tertiary", value: "#C60C30" }, { id: "steelers-t2", name: "Tertiary", value: "#003087" }, { id: "steelers-t3", name: "Tertiary", value: "#FFFFFF" }] },
  { id: "49ers", name: "San Francisco 49ers", primary: { id: "49ers-primary", name: "Primary", value: "#AA0000" }, secondary: { id: "49ers-secondary", name: "Secondary", value: "#B3995D" }, tertiary: [{ id: "49ers-t1", name: "Tertiary", value: "#000000" }, { id: "49ers-t2", name: "Tertiary", value: "#FFFFFF" }] },
  { id: "Seahawks", name: "Seattle Seahawks", primary: { id: "seahawks-primary", name: "Primary", value: "#002244" }, secondary: { id: "seahawks-secondary", name: "Secondary", value: "#69BE28" }, tertiary: [{ id: "seahawks-t1", name: "Tertiary", value: "#0076B6" }, { id: "seahawks-t2", name: "Tertiary", value: "#A5ACAF" }, { id: "seahawks-t3", name: "Tertiary", value: "#FFFFFF" }] },
  { id: "Buccaneers", name: "Tampa Bay Buccaneers", primary: { id: "buccaneers-primary", name: "Primary", value: "#D50A0A" }, secondary: { id: "buccaneers-secondary", name: "Secondary", value: "#34302B" }, tertiary: [{ id: "buccaneers-t1", name: "Tertiary", value: "#FF7900" }, { id: "buccaneers-t2", name: "Tertiary", value: "#FFFFFF" }] },
  { id: "Titans", name: "Tennessee Titans", primary: { id: "titans-primary", name: "Primary", value: "#0C2340" }, secondary: { id: "titans-secondary", name: "Secondary", value: "#4B92DB" }, tertiary: [{ id: "titans-t1", name: "Tertiary", value: "#C8102E" }, { id: "titans-t2", name: "Tertiary", value: "#FFFFFF" }] },
  { id: "Commanders", name: "Washington Commanders", primary: { id: "commanders-primary", name: "Primary", value: "#773141" }, secondary: { id: "commanders-secondary", name: "Secondary", value: "#FFB612" }, tertiary: [{ id: "commanders-t1", name: "Tertiary", value: "#FFFFFF" }] },
];

/** Normalize path segment to team id: "49ers", "San Francisco 49ers" folder -> "49ers" */
export function getTeamIdFromRelativePath(relativePath: string): string | null {
  const segment = relativePath.split(/[/\\]/)[0]?.trim();
  if (!segment) return null;
  const segLower = segment.toLowerCase();
  const segNoSpaces = segLower.replace(/\s+/g, "");
  const match = NFL_TEAM_PALETTES.find(
    (t) =>
      t.id === segment ||
      t.id.toLowerCase() === segLower ||
      t.name.toLowerCase().replace(/\s+/g, "") === segNoSpaces ||
      (t.id === "49ers" && (segLower.includes("49ers") || segNoSpaces.includes("49ers")))
  );
  return match ? match.id : null;
}

/** All team colors for a given team (primary, secondary, tertiary) with labels. */
export function getTeamColors(teamId: string | null): TeamColor[] {
  if (!teamId) return [];
  const team = NFL_TEAM_PALETTES.find((t) => t.id === teamId);
  if (!team) return [];
  const list: TeamColor[] = [
    { ...team.primary, name: `${team.name} — Primary` },
    { ...team.secondary, name: `${team.name} — Secondary` },
  ];
  team.tertiary.forEach((t, i) => {
    list.push({ ...t, name: `${team.name} — Tertiary ${i + 1}` });
  });
  return list;
}

/** Flat list of all colors for the picker: utility + one team's colors. */
export function getFillColorOptions(teamId: string | null): TeamColor[] {
  const teamColors = getTeamColors(teamId);
  return [...UTILITY_COLORS, ...teamColors];
}

/** Every color (utility + all teams) for resolving a hex to a display name. */
export function getAllColorsForLabel(): TeamColor[] {
  const out: TeamColor[] = [...UTILITY_COLORS];
  for (const team of NFL_TEAM_PALETTES) {
    out.push(
      { ...team.primary, name: `${team.name} — Primary` },
      { ...team.secondary, name: `${team.name} — Secondary` }
    );
    team.tertiary.forEach((t, i) => {
      out.push({ ...t, name: `${team.name} — Tertiary ${i + 1}` });
    });
  }
  return out;
}
