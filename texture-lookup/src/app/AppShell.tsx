"use client";

import { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";

import { getTextureData } from "@/lib/data";
import { lookupUniformTextures } from "@/lib/lookup";
import { matchKeyFromText, parseSetChoice } from "@/lib/search";
import { buildSharingIndexForGame } from "@/lib/sharing";
import {
  canShowTextureImage,
  getTextureImageUrl,
  getTexturesBaseUrl
} from "@/lib/textureUrl";
import type { LookupResult, PartKey, SetChoice, TextureId } from "@/lib/types";

const partOrder: PartKey[] = [
  "jerseyTop",
  "sleeves",
  "pants",
  "socks",
  "helmet",
  "numbers",
  "sidelineJerseys",
  "teamSelectPlayer",
  "teamSelectHelmet"
];

const partLabels: Record<PartKey, string> = {
  jerseyTop: "Jersey top",
  sleeves: "Jersey sleeves",
  pants: "Pants",
  socks: "Socks",
  helmet: "Helmet",
  numbers: "Numbers",
  sidelineJerseys: "Sideline jersey",
  teamSelectPlayer: "Team select player",
  teamSelectHelmet: "Team select helmet"
};

type Mode = "prompt" | "browse";
type Message = { role: "user" | "app"; text: string };

function filenameFor(textureId: TextureId): string {
  return `${textureId}.png`;
}

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function PillButton(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  const { active, className, ...rest } = props;
  return (
    <button
      {...rest}
      className={classNames(
        "rounded-lg px-3 py-1.5 text-sm font-medium transition",
        active ? "bg-white/10 text-white" : "text-slate-200/90 hover:bg-white/5",
        className
      )}
    />
  );
}

function SharedWarning({ result }: { result: LookupResult }) {
  const [open, setOpen] = useState(false);
  if (result.sharedTextureIds.length === 0) return null;

  const totalImpacts = result.sharedTextureIds.reduce((acc, id) => acc + (result.sharingIndex[id]?.length ?? 0), 0);

  return (
    <div className="rounded-xl bg-amber-500/10 p-4 ring-1 ring-amber-400/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-amber-200">Shared texture warning</div>
          <div className="mt-1 text-sm text-amber-100/80">
            {result.sharedTextureIds.length} textureId(s) in these results are shared elsewhere in this game. Editing{" "}
            <span className="font-mono">textureId.png</span> may affect multiple uniforms. ({totalImpacts} total usages)
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg bg-black/20 px-3 py-1.5 text-xs font-medium text-amber-100/90 ring-1 ring-amber-200/20 hover:bg-black/30"
        >
          {open ? "Hide details" : "Show details"}
        </button>
      </div>

      {open ? (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {result.sharedTextureIds.map((id) => {
            const usages = result.sharingIndex[id] ?? [];
            return (
              <div key={id} className="rounded-lg bg-black/20 p-3 ring-1 ring-amber-200/20">
                <div className="text-xs font-semibold text-amber-100">
                  <span className="font-mono">{filenameFor(id)}</span> ({usages.length} usages)
                </div>
                <ul className="mt-2 space-y-1 text-xs text-amber-50/70">
                  {usages.slice(0, 8).map((u, idx) => (
                    <li key={`${u.team}-${u.uniformName}-${u.bucket}-${u.part}-${idx}`}>
                      {u.team} • {u.uniformName} • {u.bucket} • {partLabels[u.part]}
                    </li>
                  ))}
                  {usages.length > 8 ? <li>…and {usages.length - 8} more</li> : null}
                </ul>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

async function downloadImageAtFullRes(url: string, filename: string) {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function ResultsView({
  result,
  game,
  team,
  uniformName
}: {
  result: LookupResult;
  game?: string;
  team?: string;
  uniformName?: string;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [downloadingPart, setDownloadingPart] = useState<string | null>(null);
  const baseUrl = getTexturesBaseUrl();
  const showImages =
    baseUrl &&
    game &&
    team &&
    uniformName &&
    canShowTextureImage(baseUrl, team);

  function toggleSection(title: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }

  async function copy(id: string) {
    const text = filenameFor(id);
    await navigator.clipboard.writeText(text);
    setCopied(text);
    window.setTimeout(() => setCopied((v) => (v === text ? null : v)), 1000);
  }

  async function downloadPartAsZip(
    sectionTitle: string,
    partKey: PartKey,
    bucket: string,
    ids: string[]
  ) {
    if (!baseUrl || !team || !uniformName) return;
    const key = `${sectionTitle}-${partKey}`;
    setDownloadingPart(key);
    try {
      const zip = new JSZip();
      for (const id of ids) {
        const url = getTextureImageUrl({
          basePath: baseUrl,
          team,
          uniformName,
          bucket,
          id
        });
        const res = await fetch(url, { mode: "cors" });
        if (!res.ok) continue;
        const blob = await res.blob();
        zip.file(filenameFor(id), blob);
      }
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const safe = (s: string) => s.replace(/[^a-zA-Z0-9-_]/g, "_");
      const zipName = `${safe(team)}-${safe(uniformName)}-${safe(bucket)}-${partKey}.zip`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(zipBlob);
      a.download = zipName;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setDownloadingPart((v) => (v === key ? null : v));
    }
  }

  return (
    <div className="grid gap-4">
      <SharedWarning result={result} />

      {result.sections.map((section) => {
        const isExpanded = expandedSections.has(section.title);
        return (
          <div key={section.title} className="rounded-2xl bg-white/5 ring-1 ring-white/10">
            <button
              type="button"
              onClick={() => toggleSection(section.title)}
              className="flex w-full items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-left hover:bg-white/5"
            >
              <div className="flex items-center gap-2">
                <span
                  className={classNames(
                    "text-sm transition-transform",
                    isExpanded ? "rotate-90" : ""
                  )}
                >
                  ▶
                </span>
                <div className="text-sm font-semibold">{section.title}</div>
              </div>
              <div className="text-xs text-slate-300/80">
                Output filenames look like <span className="font-mono">1234.png</span>
              </div>
            </button>

            {isExpanded ? (
              <div className="grid gap-4 p-4 md:grid-cols-2">
                {partOrder
                  .map((k) => ({ k, ids: section.parts[k] }))
                  .filter((x) => (x.ids?.length ?? 0) > 0)
                  .map(({ k, ids }) => {
                    const imageUrlBase =
                      showImages &&
                      baseUrl &&
                      team &&
                      uniformName;
                    const canDownloadAll =
                      imageUrlBase && canShowTextureImage(baseUrl, team);
                    const partKey = `${section.title}-${k}`;
                    const isDownloading = downloadingPart === partKey;
                    return (
                      <div key={k} className="rounded-xl bg-black/20 p-4 ring-1 ring-white/10">
                        <div className="flex flex-wrap items-baseline justify-between gap-3">
                          <div className="text-sm font-semibold">{partLabels[k]}</div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-300/80">
                              {ids!.length} texture(s)
                            </span>
                            {canDownloadAll && ids!.length > 0 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  downloadPartAsZip(
                                    section.title,
                                    k,
                                    section.bucket,
                                    ids!
                                  )
                                }
                                disabled={isDownloading}
                                className="rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-medium text-slate-100 ring-1 ring-white/10 hover:bg-white/15 disabled:opacity-50"
                              >
                                {isDownloading ? "Preparing…" : `Download ${partLabels[k]}`}
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {ids!.map((id) => {
                            const out = filenameFor(id);
                            const imageUrl =
                              imageUrlBase &&
                              getTextureImageUrl({
                                basePath: baseUrl,
                                team,
                                uniformName,
                                bucket: section.bucket,
                                id
                              });
                            return (
                              <div key={id} className="inline-flex flex-col items-start gap-1.5">
                                {imageUrl ? (
                                  <TextureImage
                                    src={imageUrl}
                                    alt={partLabels[k]}
                                    className="max-h-24 w-auto cursor-pointer rounded border border-white/10 object-contain hover:ring-2 hover:ring-white/30"
                                    downloadFilename={out}
                                    onDownloadClick={() =>
                                      downloadImageAtFullRes(imageUrl, out)
                                    }
                                  />
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => copy(id)}
                                  className="group inline-flex items-center gap-2 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-100 ring-1 ring-white/10 hover:bg-white/10"
                                  title="Click to copy filename"
                                >
                                  <span className="font-mono">{out}</span>
                                  <span className="text-[10px] text-slate-300/70 group-hover:text-slate-200/80">
                                    {copied === out ? "copied" : "copy"}
                                  </span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function TextureImage({
  src,
  alt,
  className,
  downloadFilename,
  onDownloadClick
}: {
  src: string;
  alt: string;
  className?: string;
  downloadFilename?: string;
  onDownloadClick?: () => void;
}) {
  const [error, setError] = useState(false);
  if (error) return null;
  const clickable = Boolean(downloadFilename && onDownloadClick);
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      title={clickable ? `Click to download ${downloadFilename} (full resolution)` : undefined}
      onError={() => setError(true)}
      onClick={clickable ? onDownloadClick : undefined}
      role={clickable ? "button" : undefined}
    />
  );
}

const FOLDER_BUCKETS = [
  { key: "shared" as const, title: "Shared" },
  { key: "home" as const, title: "Home" },
  { key: "away" as const, title: "Away" }
];

function FolderView({ team, uniformName }: { team: string; uniformName: string }) {
  const baseUrl = getTexturesBaseUrl();
  const [bucketIds, setBucketIds] = useState<Record<string, string[]> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [downloadingBucket, setDownloadingBucket] = useState<string | null>(null);
  const showImages = baseUrl && canShowTextureImage(baseUrl, team);

  useEffect(() => {
    if (!team || !uniformName) {
      setBucketIds(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all(
      FOLDER_BUCKETS.map(({ key }) =>
        fetch(
          `/api/textures?team=${encodeURIComponent(team)}&uniformName=${encodeURIComponent(uniformName)}&bucket=${key}`
        ).then((r) => (r.ok ? r.json() : r.status === 503 ? null : { ids: [] }))
      )
    )
      .then(([shared, home, away]) => {
        if (shared === null || home === null || away === null) {
          setError("Folder view not available. Set TEXTURES_FOLDER_PATH in .env.local.");
          setBucketIds(null);
          return;
        }
        setBucketIds({
          shared: shared.ids ?? [],
          home: home.ids ?? [],
          away: away.ids ?? []
        });
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load folder");
        setBucketIds(null);
      })
      .finally(() => setLoading(false));
  }, [team, uniformName]);

  function toggleBucket(title: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }

  async function downloadBucketAsZip(bucketKey: string, ids: string[]) {
    if (!baseUrl || !team || !uniformName || ids.length === 0) return;
    setDownloadingBucket(bucketKey);
    try {
      const zip = new JSZip();
      for (const id of ids) {
        const url = getTextureImageUrl({
          basePath: baseUrl,
          team,
          uniformName,
          bucket: bucketKey,
          id
        });
        const res = await fetch(url, { mode: "cors" });
        if (!res.ok) continue;
        const blob = await res.blob();
        zip.file(filenameFor(id), blob);
      }
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const safe = (s: string) => s.replace(/[^a-zA-Z0-9-_]/g, "_");
      const zipName = `${safe(team)}-${safe(uniformName)}-${bucketKey}.zip`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(zipBlob);
      a.download = zipName;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setDownloadingBucket(null);
    }
  }

  if (!showImages) return null;
  if (loading) {
    return (
      <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
        <div className="text-sm text-slate-300/90">Loading folder view…</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
        <div className="text-sm text-amber-200/90">{error}</div>
      </div>
    );
  }
  if (!bucketIds) return null;

  const total = Object.values(bucketIds).reduce((s, arr) => s + arr.length, 0);
  if (total === 0) {
    return (
      <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
        <div className="text-sm text-slate-300/90">No texture files found in folder for this team/uniform.</div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl bg-white/5 ring-1 ring-white/10">
        <div className="border-b border-white/10 px-4 py-3">
          <div className="text-sm font-semibold">Folder view — all textures on disk</div>
          <div className="mt-1 text-xs text-slate-300/80">
            No part labels; just every .png in each set. Click thumbnail to download (full res).
          </div>
        </div>
        <div className="divide-y divide-white/10">
          {FOLDER_BUCKETS.map(({ key, title }) => {
            const ids = bucketIds[key] ?? [];
            const isExpanded = expanded.has(title);
            const isDownloading = downloadingBucket === key;
            return (
              <div key={key}>
                <div className="flex w-full items-center justify-between gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleBucket(title)}
                    className="flex flex-1 items-center gap-2 text-left hover:bg-white/5 rounded-lg -mx-2 px-2 py-1"
                  >
                    <span className={classNames("text-sm transition-transform", isExpanded ? "rotate-90" : "")}>▶</span>
                    <span className="text-sm font-medium">{title}</span>
                    <span className="text-xs text-slate-400">({ids.length} file{ids.length !== 1 ? "s" : ""})</span>
                  </button>
                  {ids.length > 0 && (
                    <button
                      type="button"
                      onClick={() => downloadBucketAsZip(key, ids)}
                      disabled={isDownloading}
                      className="rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-medium hover:bg-white/15 disabled:opacity-50 shrink-0"
                    >
                      {isDownloading ? "Preparing…" : "Download all"}
                    </button>
                  )}
                </div>
                {isExpanded && (
                  <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:grid-cols-4">
                    {ids.map((id) => {
                      const url = getTextureImageUrl({
                        basePath: baseUrl,
                        team,
                        uniformName,
                        bucket: key,
                        id
                      });
                      const out = filenameFor(id);
                      return (
                        <div key={id} className="flex flex-col items-start gap-1.5">
                          <TextureImage
                            src={url}
                            alt={id}
                            className="max-h-24 w-auto cursor-pointer rounded border border-white/10 object-contain hover:ring-2 hover:ring-white/30"
                            downloadFilename={out}
                            onDownloadClick={() => downloadImageAtFullRes(url, out)}
                          />
                          <span className="truncate font-mono text-xs text-slate-400" title={out}>
                            {out}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BrowsePane({ game }: { game: string }) {
  const data = useMemo(() => getTextureData(), []);
  const teams = useMemo(() => Object.keys(data.games[game]?.teams ?? {}).sort(), [data, game]);

  const [team, setTeam] = useState<string>(teams[0] ?? "");
  const uniforms = useMemo(() => Object.keys(data.games[game]?.teams?.[team]?.uniforms ?? {}).sort(), [data, game, team]);
  const [uniformName, setUniformName] = useState<string>(uniforms[0] ?? "");
  const [setChoice, setSetChoice] = useState<SetChoice>("both");

  const [mode, setMode] = useState<"drilldown" | "table">("drilldown");
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!teams.includes(team)) setTeam(teams[0] ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams]);

  useEffect(() => {
    if (!uniforms.includes(uniformName)) setUniformName(uniforms[0] ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uniforms]);

  async function copyFilename(filename: string) {
    await navigator.clipboard.writeText(filename);
    setCopied(filename);
    window.setTimeout(() => setCopied((v) => (v === filename ? null : v)), 1000);
  }

  const result = useMemo(() => {
    if (!team || !uniformName) return null;
    return lookupUniformTextures({ data, game, team, uniformName, setChoice });
  }, [data, game, team, uniformName, setChoice]);

  const sharingIndex = useMemo(() => buildSharingIndexForGame(data, game), [data, game]);
  const usageRows = useMemo(() => {
    const rows: Array<{
      textureId: string;
      filename: string;
      sharedCount: number;
      team: string;
      uniformName: string;
      bucket: string;
      part: string;
    }> = [];

    for (const [textureId, usages] of Object.entries(sharingIndex)) {
      const sharedCount = usages.length;
      for (const u of usages) {
        rows.push({
          textureId,
          filename: filenameFor(textureId),
          sharedCount,
          team: u.team,
          uniformName: u.uniformName,
          bucket: u.bucket,
          part: partLabels[u.part]
        });
      }
    }

    rows.sort((a, b) => b.sharedCount - a.sharedCount || a.team.localeCompare(b.team));
    return rows;
  }, [sharingIndex]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return usageRows;
    return usageRows.filter((r) => {
      const hay = `${r.textureId} ${r.team} ${r.uniformName} ${r.bucket} ${r.part}`.toLowerCase();
      return hay.includes(q);
    });
  }, [usageRows, query]);

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl bg-white/5 ring-1 ring-white/10">
        <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm font-semibold">Browse</div>
          <div className="inline-flex rounded-xl bg-black/20 p-1 ring-1 ring-white/10">
            <PillButton active={mode === "drilldown"} onClick={() => setMode("drilldown")}>
              Drill-down
            </PillButton>
            <PillButton active={mode === "table"} onClick={() => setMode("table")}>
              Power table
            </PillButton>
          </div>
        </div>

        {mode === "drilldown" ? (
          <div className="grid gap-3 p-4 md:grid-cols-4">
            <label className="grid gap-1">
              <span className="text-xs font-medium text-slate-300/80">Team</span>
              <select
                value={team}
                onChange={(e) => {
                  const nextTeam = e.target.value;
                  setTeam(nextTeam);
                  const nextUniforms = Object.keys(data.games[game]?.teams?.[nextTeam]?.uniforms ?? {}).sort();
                  setUniformName(nextUniforms[0] ?? "");
                }}
                className="h-10 rounded-xl bg-black/20 px-3 text-sm text-slate-100 ring-1 ring-white/10 outline-none focus:ring-white/20"
              >
                {teams.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 md:col-span-2">
              <span className="text-xs font-medium text-slate-300/80">Uniform name (in-game)</span>
              <select
                value={uniformName}
                onChange={(e) => setUniformName(e.target.value)}
                className="h-10 rounded-xl bg-black/20 px-3 text-sm text-slate-100 ring-1 ring-white/10 outline-none focus:ring-white/20"
              >
                {uniforms.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1">
              <span className="text-xs font-medium text-slate-300/80">Set</span>
              <select
                value={setChoice}
                onChange={(e) => setSetChoice(e.target.value as SetChoice)}
                className="h-10 rounded-xl bg-black/20 px-3 text-sm text-slate-100 ring-1 ring-white/10 outline-none focus:ring-white/20"
              >
                <option value="home">Home</option>
                <option value="away">Away</option>
                <option value="both">Both</option>
              </select>
            </label>
          </div>
        ) : (
          <div className="grid gap-3 p-4 md:grid-cols-2">
            <div className="text-sm text-slate-300/90">
              Search across this game’s whole dataset. Great for tracking shared textures and finding everywhere a{" "}
              <span className="font-mono">textureId.png</span> is used.
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Search… (e.g. "Giants" or "sleeves" or "2101")'
              className="h-11 rounded-xl bg-black/20 px-4 text-sm text-slate-100 ring-1 ring-white/10 outline-none placeholder:text-slate-400/70 focus:ring-white/20"
            />
          </div>
        )}
      </div>

      {mode === "drilldown" ? (
        <>
          {result ? (
            <ResultsView
              result={result}
              game={game}
              team={team}
              uniformName={uniformName}
            />
          ) : (
            <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
              <div className="text-sm text-slate-300/90">Pick a team and uniform to see textures.</div>
            </div>
          )}
          {team && uniformName ? (
            <FolderView team={team} uniformName={uniformName} />
          ) : null}
        </>
      ) : (
        <div className="rounded-2xl bg-white/5 ring-1 ring-white/10">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div className="text-sm font-semibold">Power table</div>
            <div className="text-xs text-slate-300/80">{filteredRows.length} row(s)</div>
          </div>

          <div className="overflow-auto">
            <table className="w-full min-w-[980px] border-separate border-spacing-0">
              <thead className="sticky top-0 bg-[#070a12]/90 backdrop-blur">
                <tr className="text-left text-xs text-slate-300/80">
                  <th className="border-b border-white/10 px-4 py-3 w-16">Preview</th>
                  <th className="border-b border-white/10 px-4 py-3">textureId.png</th>
                  <th className="border-b border-white/10 px-4 py-3">Shared count</th>
                  <th className="border-b border-white/10 px-4 py-3">Team</th>
                  <th className="border-b border-white/10 px-4 py-3">Uniform</th>
                  <th className="border-b border-white/10 px-4 py-3">Bucket</th>
                  <th className="border-b border-white/10 px-4 py-3">Part</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {filteredRows.slice(0, 500).map((r, idx) => {
                  const tableBaseUrl = getTexturesBaseUrl();
                  const showTableImage =
                    tableBaseUrl && canShowTextureImage(tableBaseUrl, r.team);
                  const tableImageUrl =
                    showTableImage &&
                    getTextureImageUrl({
                      basePath: tableBaseUrl,
                      team: r.team,
                      uniformName: r.uniformName,
                      bucket: r.bucket,
                      id: r.textureId
                    });
                  return (
                  <tr key={`${r.textureId}-${r.team}-${r.uniformName}-${r.bucket}-${r.part}-${idx}`} className="hover:bg-white/5">
                    <td className="border-b border-white/5 px-2 py-2.5 align-middle">
                      {tableImageUrl ? (
                        <TextureImage
                          src={tableImageUrl}
                          alt={r.part}
                          className="max-h-12 w-auto rounded border border-white/10 object-contain"
                        />
                      ) : (
                        <span className="text-slate-500/60">—</span>
                      )}
                    </td>
                    <td className="border-b border-white/5 px-4 py-2.5 font-mono text-xs text-slate-100">
                      <button
                        type="button"
                        onClick={() => copyFilename(r.filename)}
                        className="inline-flex items-center gap-2 rounded-md px-2 py-1 hover:bg-white/5"
                        title="Click to copy filename"
                      >
                        <span>{r.filename}</span>
                        <span className="text-[10px] text-slate-300/70">{copied === r.filename ? "copied" : "copy"}</span>
                      </button>
                    </td>
                    <td className="border-b border-white/5 px-4 py-2.5 text-xs text-slate-200/90">
                      <span
                        className={classNames(
                          "inline-flex items-center rounded-md px-2 py-1 font-medium ring-1",
                          r.sharedCount > 1
                            ? "bg-amber-500/10 text-amber-200 ring-amber-300/20"
                            : "bg-white/5 text-slate-200/90 ring-white/10"
                        )}
                      >
                        {r.sharedCount}
                      </span>
                    </td>
                    <td className="border-b border-white/5 px-4 py-2.5 text-xs text-slate-200/90">{r.team}</td>
                    <td className="border-b border-white/5 px-4 py-2.5 text-xs text-slate-200/90">{r.uniformName}</td>
                    <td className="border-b border-white/5 px-4 py-2.5 text-xs text-slate-200/90">{r.bucket}</td>
                    <td className="border-b border-white/5 px-4 py-2.5 text-xs text-slate-200/90">{r.part}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredRows.length > 500 ? (
            <div className="px-4 py-3 text-xs text-slate-300/80">
              Showing first 500 rows. Refine search to narrow further.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function PromptingPane({ game }: { game: string }) {
  const data = useMemo(() => getTextureData(), []);
  const teams = useMemo(() => Object.keys(data.games[game]?.teams ?? {}).sort(), [data, game]);

  const [advanced, setAdvanced] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "app",
      text: "Tell me which team you’re modding (or say “I want to make a uniform for …”)."
    }
  ]);

  const [step, setStep] = useState<"team" | "uniform" | "set" | "done">("team");
  const [team, setTeam] = useState<string | null>(null);
  const [uniformName, setUniformName] = useState<string | null>(null);
  const [result, setResult] = useState<LookupResult | null>(null);

  const [input, setInput] = useState("");
  const [advInput, setAdvInput] = useState("");

  const uniformsForTeam = useMemo(() => {
    if (!team) return [];
    return Object.keys(data.games[game]?.teams?.[team]?.uniforms ?? {}).sort();
  }, [data, game, team]);

  function push(role: Message["role"], text: string) {
    setMessages((m) => [...m, { role, text }]);
  }

  function startOver() {
    setMessages([
      {
        role: "app",
        text: "Tell me which team you’re modding (or say “I want to make a uniform for …”)."
      }
    ]);
    setStep("team");
    setTeam(null);
    setUniformName(null);
    setResult(null);
    setInput("");
  }

  function handleSubmit() {
    const text = input.trim();
    if (!text) return;
    push("user", text);
    setInput("");

    if (step === "team") {
      const match = matchKeyFromText(text, teams);
      if (!match) {
        push("app", `I didn’t catch the team. Try one of these: ${teams.slice(0, 12).join(", ")}…`);
        return;
      }
      setTeam(match);
      setStep("uniform");
      push("app", "Okay cool – what is the name of the uniform in the game? Example could be 1991-1994.");
      return;
    }

    if (step === "uniform") {
      const match = matchKeyFromText(text, uniformsForTeam);
      if (!match) {
        const hint =
          uniformsForTeam.length > 0
            ? `I couldn’t find that uniform name. Available: ${uniformsForTeam.slice(0, 10).join(", ")}…`
            : "I don’t have any uniforms for that team yet in the data.";
        push("app", hint);
        return;
      }
      setUniformName(match);
      setStep("set");
      push("app", "Great – do you want textures for the Home, Away, or both sets?");
      return;
    }

    if (step === "set" && team && uniformName) {
      const choice = parseSetChoice(text);
      if (!choice) {
        push("app", 'Say "Home", "Away", or "Both".');
        return;
      }
      const res = lookupUniformTextures({ data, game, team, uniformName, setChoice: choice });
      setResult(res);
      setStep("done");
      push("app", "Sweet – here you go.");
      return;
    }
  }

  function chooseSet(choice: SetChoice) {
    if (step !== "set" || !team || !uniformName) return;
    push("user", choice === "both" ? "Both!" : choice === "home" ? "Home" : "Away");
    const res = lookupUniformTextures({ data, game, team, uniformName, setChoice: choice });
    setResult(res);
    setStep("done");
    push("app", "Sweet – here you go.");
  }

  function runAdvanced() {
    const text = advInput.trim();
    if (!text) return;

    const t = matchKeyFromText(text, teams);
    if (!t) {
      push("app", "Advanced prompt: couldn’t find a team in that text.");
      return;
    }

    const uniforms = Object.keys(data.games[game]?.teams?.[t]?.uniforms ?? {});
    const u = matchKeyFromText(text, uniforms);
    if (!u) {
      push("app", "Advanced prompt: couldn’t find a uniform name in that text.");
      return;
    }

    const setChoice = parseSetChoice(text) ?? "both";
    const res = lookupUniformTextures({ data, game, team: t, uniformName: u, setChoice });
    setTeam(t);
    setUniformName(u);
    setResult(res);
    setStep("done");
    setMessages([
      { role: "app", text: "Okay cool – I’ll parse that in one shot." },
      { role: "user", text },
      { role: "app", text: "Sweet – here you go." }
    ]);
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl bg-white/5 ring-1 ring-white/10">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3">
          <div className="text-sm font-semibold">Prompting</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAdvanced((v) => !v)}
              className="rounded-lg bg-black/20 px-3 py-1.5 text-xs font-medium text-slate-200/90 ring-1 ring-white/10 hover:bg-black/30"
            >
              {advanced ? "Hide advanced" : "Advanced prompt"}
            </button>
            <button
              type="button"
              onClick={startOver}
              className="rounded-lg bg-black/20 px-3 py-1.5 text-xs font-medium text-slate-200/90 ring-1 ring-white/10 hover:bg-black/30"
            >
              Start over
            </button>
          </div>
        </div>

        {advanced ? (
          <div className="grid gap-3 p-4">
            <div className="text-sm text-slate-300/90">
              Type one message that includes team + uniform name + (optional) Home/Away/Both. If set isn’t specified, it
              defaults to Both.
            </div>
            <div className="flex flex-col gap-2 md:flex-row">
              <input
                value={advInput}
                onChange={(e) => setAdvInput(e.target.value)}
                placeholder='e.g. "Colts Default both"'
                className="h-11 w-full rounded-xl bg-black/20 px-4 text-sm text-slate-100 ring-1 ring-white/10 outline-none placeholder:text-slate-400/70 focus:ring-white/20"
              />
              <button
                type="button"
                onClick={runAdvanced}
                className="h-11 rounded-xl bg-gradient-to-br from-blue-500/70 to-fuchsia-500/60 px-4 text-sm font-semibold text-white ring-1 ring-white/10 hover:from-blue-500/80 hover:to-fuchsia-500/70"
              >
                Go
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4">
            <div className="grid gap-3">
              <div className="max-h-[320px] overflow-auto rounded-xl bg-black/20 p-3 ring-1 ring-white/10">
                <div className="grid gap-2">
                  {messages.map((m, idx) => (
                    <div
                      key={idx}
                      className={classNames(
                        "rounded-xl px-3 py-2 text-sm",
                        m.role === "user"
                          ? "ml-auto max-w-[85%] bg-white/10 text-slate-100 ring-1 ring-white/10"
                          : "mr-auto max-w-[85%] bg-black/20 text-slate-200/90 ring-1 ring-white/10"
                      )}
                    >
                      {m.text}
                    </div>
                  ))}
                </div>
              </div>

              {step === "set" ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => chooseSet("home")}
                    className="rounded-xl bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 ring-1 ring-white/10 hover:bg-white/10"
                  >
                    Home
                  </button>
                  <button
                    type="button"
                    onClick={() => chooseSet("away")}
                    className="rounded-xl bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 ring-1 ring-white/10 hover:bg-white/10"
                  >
                    Away
                  </button>
                  <button
                    type="button"
                    onClick={() => chooseSet("both")}
                    className="rounded-xl bg-gradient-to-br from-blue-500/70 to-fuchsia-500/60 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/10 hover:from-blue-500/80 hover:to-fuchsia-500/70"
                  >
                    Both
                  </button>
                </div>
              ) : null}

              {step !== "done" ? (
                <div className="flex flex-col gap-2 md:flex-row">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSubmit();
                    }}
                    placeholder={
                      step === "team"
                        ? 'e.g. "I want to make a uniform for the Colts"'
                        : step === "uniform"
                          ? 'e.g. "Default"'
                          : 'e.g. "Both"'
                    }
                    className="h-11 w-full rounded-xl bg-black/20 px-4 text-sm text-slate-100 ring-1 ring-white/10 outline-none placeholder:text-slate-400/70 focus:ring-white/20"
                  />
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="h-11 rounded-xl bg-white/10 px-4 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/15"
                  >
                    Send
                  </button>
                </div>
              ) : null}

              {team && uniformName ? (
                <div className="text-xs text-slate-300/80">
                  Current: <span className="font-semibold">{team}</span> •{" "}
                  <span className="font-semibold">{uniformName}</span>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {result ? (
        <ResultsView
          result={result}
          game={game}
          team={team ?? undefined}
          uniformName={uniformName ?? undefined}
        />
      ) : null}
    </div>
  );
}

export default function AppShell() {
  const data = useMemo(() => getTextureData(), []);
  const games = useMemo(() => Object.keys(data.games ?? {}).sort(), [data]);

  const [mode, setMode] = useState<Mode>("prompt");
  const [game, setGame] = useState<string>(games[0] ?? "Example Game");

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="flex flex-col gap-4">
        <div className="inline-flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500/40 to-fuchsia-500/30 ring-1 ring-white/10" />
          <div className="flex flex-col">
            <h1 className="text-xl font-semibold tracking-tight">PS2 Texture Lookup</h1>
            <p className="text-sm text-slate-300/90">
              Fast lookup for uniform texture IDs (outputs <span className="font-mono">textureId.png</span>).
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="inline-flex rounded-xl bg-black/20 p-1 ring-1 ring-white/10">
            <PillButton active={mode === "prompt"} onClick={() => setMode("prompt")}>
              Prompting
            </PillButton>
            <PillButton active={mode === "browse"} onClick={() => setMode("browse")}>
              Browse
            </PillButton>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-xs text-slate-300/80">Game</div>
            <select
              value={game}
              onChange={(e) => setGame(e.target.value)}
              className="h-10 rounded-xl bg-black/20 px-3 text-sm text-slate-100 ring-1 ring-white/10 outline-none focus:ring-white/20"
            >
              {games.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <section className="mt-8">
        {mode === "prompt" ? <PromptingPane game={game} /> : <BrowsePane game={game} />}
      </section>
    </main>
  );
}

