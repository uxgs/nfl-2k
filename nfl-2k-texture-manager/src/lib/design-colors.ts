/**
 * Design system color variables (2KDS).
 * Default fallback list; run `node scripts/figma-colors.js` with FIGMA_API_TOKEN
 * and FIGMA_FILE_KEY (2KDS file) to pull color variables from Figma into
 * public/design-colors.json (node 5-273 selection colors first). The app loads
 * that file when available.
 */
export type DesignColor = {
  id: string;
  name: string;
  value: string;
};

/** Default palette when Figma colors are not loaded — 2KDS-style variable names. */
export const DEFAULT_DESIGN_COLORS: DesignColor[] = [
  // Primaries / Team
  { id: "colors-primary-500", name: "Colors / Primary / 500", value: "#862633" },
  { id: "colors-primary-600", name: "Colors / Primary / 600", value: "#6B1E29" },
  { id: "colors-primary-400", name: "Colors / Primary / 400", value: "#A32F42" },
  { id: "colors-secondary-500", name: "Colors / Secondary / 500", value: "#B3995D" },
  { id: "colors-secondary-600", name: "Colors / Secondary / 600", value: "#8F7A4A" },
  { id: "colors-secondary-400", name: "Colors / Secondary / 400", value: "#C4AD7A" },
  // Neutrals
  { id: "colors-white", name: "Colors / White", value: "#FFFFFF" },
  { id: "colors-black", name: "Colors / Black", value: "#000000" },
  { id: "colors-neutral-50", name: "Colors / Neutral / 50", value: "#FAFAFA" },
  { id: "colors-neutral-100", name: "Colors / Neutral / 100", value: "#F5F5F5" },
  { id: "colors-neutral-200", name: "Colors / Neutral / 200", value: "#E5E5E5" },
  { id: "colors-neutral-300", name: "Colors / Neutral / 300", value: "#D4D4D4" },
  { id: "colors-neutral-400", name: "Colors / Neutral / 400", value: "#A3A3A3" },
  { id: "colors-neutral-500", name: "Colors / Neutral / 500", value: "#737373" },
  { id: "colors-neutral-600", name: "Colors / Neutral / 600", value: "#525252" },
  { id: "colors-neutral-700", name: "Colors / Neutral / 700", value: "#404040" },
  { id: "colors-neutral-800", name: "Colors / Neutral / 800", value: "#262626" },
  { id: "colors-neutral-900", name: "Colors / Neutral / 900", value: "#171717" },
  { id: "colors-neutral-950", name: "Colors / Neutral / 950", value: "#0A0A0A" },
  // Gray (alternate scale)
  { id: "colors-gray-100", name: "Colors / Gray / 100", value: "#F5F5F5" },
  { id: "colors-gray-200", name: "Colors / Gray / 200", value: "#E5E5E5" },
  { id: "colors-gray-300", name: "Colors / Gray / 300", value: "#A3A3A3" },
  { id: "colors-gray-400", name: "Colors / Gray / 400", value: "#737373" },
  { id: "colors-gray-500", name: "Colors / Gray / 500", value: "#525252" },
  { id: "colors-gray-600", name: "Colors / Gray / 600", value: "#404040" },
  { id: "colors-gray-700", name: "Colors / Gray / 700", value: "#262626" },
  { id: "colors-gray-800", name: "Colors / Gray / 800", value: "#171717" },
  { id: "colors-gray-900", name: "Colors / Gray / 900", value: "#0A0A0A" },
  // Semantic / UI
  { id: "colors-background", name: "Colors / Background", value: "#0A0A0A" },
  { id: "colors-foreground", name: "Colors / Foreground", value: "#FAFAFA" },
  { id: "colors-border", name: "Colors / Border", value: "#262626" },
  { id: "colors-border-muted", name: "Colors / Border / Muted", value: "#404040" },
  { id: "colors-accent", name: "Colors / Accent", value: "#3B82F6" },
  { id: "colors-accent-hover", name: "Colors / Accent / Hover", value: "#2563EB" },
  { id: "colors-destructive", name: "Colors / Destructive", value: "#DC2626" },
  { id: "colors-success", name: "Colors / Success", value: "#16A34A" },
  { id: "colors-warning", name: "Colors / Warning", value: "#CA8A04" },
  // Jersey / uniform specific
  { id: "colors-inner-neutral", name: "Colors / Inner / Neutral", value: "#282828" },
  { id: "colors-inner-neutral-2", name: "Colors / Inner / Neutral 2", value: "#484646" },
  { id: "colors-jersey-base", name: "Colors / Jersey / Base", value: "#862633" },
  { id: "colors-jersey-stripe", name: "Colors / Jersey / Stripe", value: "#B3995D" },
  // Red scale (team primary variants)
  { id: "colors-red-50", name: "Colors / Red / 50", value: "#FEF2F2" },
  { id: "colors-red-100", name: "Colors / Red / 100", value: "#FEE2E2" },
  { id: "colors-red-200", name: "Colors / Red / 200", value: "#FECACA" },
  { id: "colors-red-300", name: "Colors / Red / 300", value: "#FCA5A5" },
  { id: "colors-red-400", name: "Colors / Red / 400", value: "#F87171" },
  { id: "colors-red-500", name: "Colors / Red / 500", value: "#EF4444" },
  { id: "colors-red-600", name: "Colors / Red / 600", value: "#DC2626" },
  { id: "colors-red-700", name: "Colors / Red / 700", value: "#B91C1C" },
  { id: "colors-red-800", name: "Colors / Red / 800", value: "#991B1B" },
  { id: "colors-red-900", name: "Colors / Red / 900", value: "#7F1D1D" },
  { id: "colors-red-950", name: "Colors / Red / 950", value: "#450A0A" },
  // Gold / yellow (secondary)
  { id: "colors-gold-400", name: "Colors / Gold / 400", value: "#FACC15" },
  { id: "colors-gold-500", name: "Colors / Gold / 500", value: "#EAB308" },
  { id: "colors-gold-600", name: "Colors / Gold / 600", value: "#CA8A04" },
  { id: "colors-amber-500", name: "Colors / Amber / 500", value: "#F59E0B" },
  { id: "colors-amber-600", name: "Colors / Amber / 600", value: "#D97706" },
];
