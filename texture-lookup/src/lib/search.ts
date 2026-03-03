function normalize(s: string): string {
  return s.trim().toLowerCase();
}

export function matchKeyFromText(text: string, keys: string[]): string | null {
  const hay = normalize(text);
  if (!hay) return null;

  const normalizedKeys = keys
    .map((k) => ({ k, n: normalize(k) }))
    .filter((x) => x.n.length > 0);

  // Prefer exact match first
  for (const { k, n } of normalizedKeys) {
    if (hay === n) return k;
  }

  // Then substring match, preferring the longest key
  let best: { k: string; len: number } | null = null;
  for (const { k, n } of normalizedKeys) {
    if (hay.includes(n)) {
      const len = n.length;
      if (!best || len > best.len) best = { k, len };
    }
  }

  return best?.k ?? null;
}

export function parseSetChoice(text: string): "home" | "away" | "both" | null {
  const t = normalize(text);
  if (!t) return null;
  if (t.includes("both")) return "both";
  if (t.includes("home")) return "home";
  if (t.includes("away")) return "away";
  return null;
}

