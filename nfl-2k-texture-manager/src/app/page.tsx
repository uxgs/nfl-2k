"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";

const TextureEditor = dynamic(() => import("@/components/TextureEditor"), {
  ssr: false,
});

type TextureFile = {
  filename: string;
  frameName: string;
  relativePath: string;
  hashPrefix: string;
  width: number;
  height: number;
};

type BrowseResult = {
  currentPath: string;
  subdirs: string[];
  files: TextureFile[];
  hasSubdirs: boolean;
  hasFiles: boolean;
};

type Labels = Record<string, string>;
type LabelSources = Record<string, "auto" | "manual">;

function enc(s: string) {
  return encodeURIComponent(s);
}

function dimLabel(w: number, h: number): string {
  if (!w || !h) return "";
  return `${w}x${h}`;
}

export default function Home() {
  const [levels, setLevels] = useState<
    { path: string; options: string[]; selected: string; label: string }[]
  >([]);
  const [files, setFiles] = useState<TextureFile[]>([]);
  const [currentPath, setCurrentPath] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingFile, setEditingFile] = useState<TextureFile | null>(null);
  const [labels, setLabels] = useState<Labels>({});
  const [labelSources, setLabelSources] = useState<LabelSources>({});
  const [labelingFile, setLabelingFile] = useState<TextureFile | null>(null);
  const [labelInput, setLabelInput] = useState("");
  const [similarCount, setSimilarCount] = useState(0);
  const [originalAutoLabel, setOriginalAutoLabel] = useState<string | null>(
    null,
  );
  const [propagateChecked, setPropagateChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load labels on mount
  useEffect(() => {
    fetch("/api/labels")
      .then((r) => r.json())
      .then(
        (data: {
          labels: Labels;
          sources: LabelSources;
          autoLabels: Labels;
        }) => {
          setLabels(data.labels);
          setLabelSources(data.sources);
        },
      );
  }, []);

  // Load root level on mount
  useEffect(() => {
    fetchLevel("");
  }, []);

  async function fetchBrowse(subpath: string): Promise<BrowseResult> {
    const res = await fetch(`/api/browse?path=${enc(subpath)}`);
    return res.json();
  }

  async function fetchLevel(parentPath: string) {
    setLoading(true);
    const data = await fetchBrowse(parentPath);
    setLoading(false);

    const depth = parentPath ? parentPath.split(/[\\/]/).length : 0;
    const levelLabels = ["Team", "Category", "Sub-category", "Set", "Type"];
    const label = levelLabels[depth] || `Level ${depth + 1}`;

    if (data.hasSubdirs) {
      setLevels((prev) => {
        const trimmed = prev.slice(0, depth);
        return [
          ...trimmed,
          { path: parentPath, options: data.subdirs, selected: "", label },
        ];
      });

      if (data.hasFiles) {
        setFiles(data.files);
        setCurrentPath(parentPath);
      } else {
        setFiles([]);
        setCurrentPath(parentPath);
      }
    } else if (data.hasFiles) {
      setFiles(data.files);
      setCurrentPath(parentPath);
      setLevels((prev) => prev.slice(0, depth));
    } else {
      setFiles([]);
      setCurrentPath(parentPath);
    }
  }

  function handleSelect(levelIndex: number, value: string) {
    if (!value) return;

    setLevels((prev) => {
      const updated = prev.slice(0, levelIndex + 1);
      updated[levelIndex] = { ...updated[levelIndex], selected: value };
      return updated;
    });

    const parentPath = levels[levelIndex].path;
    const newPath = parentPath ? `${parentPath}\\${value}` : value;

    setFiles([]);
    fetchLevel(newPath);
  }

  async function openLabelDialog(file: TextureFile) {
    setLabelingFile(file);
    setLabelInput(labels[file.hashPrefix] || "");
    setPropagateChecked(false);
    setSimilarCount(0);
    setOriginalAutoLabel(null);

    try {
      const res = await fetch("/api/labels", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hashPrefix: file.hashPrefix }),
      });
      const info = await res.json();
      setSimilarCount(info.similar || 0);
      setOriginalAutoLabel(info.autoLabel || null);
    } catch {
      /* ignore */
    }
  }

  async function refreshLabels() {
    const r = await fetch("/api/labels");
    const data = await r.json();
    setLabels(data.labels);
    setLabelSources(data.sources);
  }

  async function handleSaveLabel() {
    if (!labelingFile) return;
    setSaving(true);
    const prefix = labelingFile.hashPrefix;

    try {
      await fetch("/api/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hashPrefix: prefix,
          label: labelInput,
          propagate: propagateChecked,
        }),
      });
      await refreshLabels();
    } finally {
      setSaving(false);
      setLabelingFile(null);
      setLabelInput("");
      setPropagateChecked(false);
    }
  }

  const breadcrumb = levels
    .filter((l) => l.selected)
    .map((l) => l.selected)
    .join(" / ");

  const hasFiles = files.length > 0;

  const reloadFiles = useCallback(() => {
    if (currentPath) {
      fetchBrowse(currentPath).then((data) => {
        if (data.hasFiles) setFiles(data.files);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath]);

  // Group files by label (labeled first, then unlabeled)
  const groupedFiles = (() => {
    if (!hasFiles) return [];

    const groups: { label: string; files: TextureFile[] }[] = [];
    const byLabel: Record<string, TextureFile[]> = {};
    const unlabeled: TextureFile[] = [];

    for (const f of files) {
      const lbl = labels[f.hashPrefix];
      if (lbl) {
        if (!byLabel[lbl]) byLabel[lbl] = [];
        byLabel[lbl].push(f);
      } else {
        unlabeled.push(f);
      }
    }

    const sortedLabels = Object.keys(byLabel).sort();
    for (const lbl of sortedLabels) {
      groups.push({ label: lbl, files: byLabel[lbl] });
    }
    if (unlabeled.length > 0) {
      groups.push({ label: "", files: unlabeled });
    }

    return groups;
  })();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">
            NFL 2K Texture Manager
          </h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Dynamic dropdowns */}
        <div className="flex flex-wrap gap-4 mb-8 items-end">
          {levels.map((level, idx) => (
            <div key={idx} className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                {level.label}
              </label>
              <select
                value={level.selected}
                onChange={(e) => handleSelect(idx, e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm min-w-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select...</option>
                {level.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          ))}

          {levels.some((l) => l.selected) && (
            <button
              onClick={() => {
                setFiles([]);
                setCurrentPath("");
                fetchLevel("");
              }}
              className="bg-zinc-700 hover:bg-zinc-600 text-white font-medium rounded-lg px-5 py-2.5 text-sm transition-colors"
            >
              Reset
            </button>
          )}

          {hasFiles && (
            <a
              href={`/api/download-folder?path=${enc(currentPath)}`}
              className="bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg px-5 py-2.5 text-sm transition-colors text-center"
            >
              Download All ({files.length})
            </a>
          )}
        </div>

        {/* Breadcrumb */}
        {breadcrumb && (
          <p className="text-sm text-zinc-500 mb-4">{breadcrumb}</p>
        )}

        {loading && (
          <div className="text-center py-24 text-zinc-500">
            <p className="text-lg">Loading...</p>
          </div>
        )}

        {!loading && levels.length > 0 && !levels[0].selected && (
          <div className="text-center py-24 text-zinc-500">
            <p className="text-lg">Select a team to get started</p>
          </div>
        )}

        {/* Grouped texture grid */}
        {hasFiles && !loading && (
          <div className="space-y-8">
            {groupedFiles.map((group, gi) => (
              <div key={gi}>
                {group.label ? (
                  <h2 className="text-base font-semibold mb-3 text-zinc-200 border-b border-zinc-800 pb-2">
                    {group.label}
                    <span className="text-zinc-500 font-normal ml-2 text-sm">
                      ({group.files.length})
                    </span>
                  </h2>
                ) : (
                  <h2 className="text-base font-semibold mb-3 text-zinc-500 border-b border-zinc-800 pb-2">
                    Unlabeled
                    <span className="font-normal ml-2 text-sm">
                      ({group.files.length})
                    </span>
                  </h2>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {group.files.map((file) => (
                    <TextureCard
                      key={file.relativePath}
                      file={file}
                      label={labels[file.hashPrefix] || ""}
                      onReplace={reloadFiles}
                      onEdit={() => setEditingFile(file)}
                      labelSource={labelSources[file.hashPrefix] || "auto"}
                      onLabel={() => openLabelDialog(file)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Label dialog */}
      {labelingFile && (
        <div className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-[440px] space-y-4">
            <h3 className="text-sm font-semibold text-zinc-200">
              Label Texture
            </h3>

            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded bg-zinc-800 overflow-hidden flex-shrink-0">
                <img
                  src={`/api/texture-image?path=${encodeURIComponent(labelingFile.relativePath)}`}
                  alt=""
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="space-y-1 min-w-0">
                <p className="text-xs text-zinc-400 truncate">
                  <span className="font-mono text-zinc-500">
                    {labelingFile.hashPrefix}
                  </span>
                </p>
                <p className="text-[10px] text-zinc-500">
                  {dimLabel(labelingFile.width, labelingFile.height)}
                </p>
                {originalAutoLabel && (
                  <p className="text-[11px] text-zinc-500">
                    Auto-detected:{" "}
                    <span className="text-zinc-300">{originalAutoLabel}</span>
                  </p>
                )}
                {labelSources[labelingFile.hashPrefix] === "manual" && (
                  <span className="text-[10px] bg-amber-900/60 text-amber-300 rounded px-1.5 py-0.5">
                    manually overridden
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveLabel()}
                placeholder="e.g. Jersey, Numbers, Sleeve..."
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>

            {similarCount > 0 &&
              labelInput.trim() &&
              labelInput.trim() !== originalAutoLabel && (
                <label className="flex items-start gap-2.5 p-3 rounded-lg bg-zinc-800/60 border border-zinc-700/50 cursor-pointer hover:bg-zinc-800">
                  <input
                    type="checkbox"
                    checked={propagateChecked}
                    onChange={(e) => setPropagateChecked(e.target.checked)}
                    className="mt-0.5 accent-blue-500"
                  />
                  <div className="space-y-0.5">
                    <p className="text-xs text-zinc-200">
                      Apply to {similarCount} similar texture
                      {similarCount !== 1 && "s"}
                    </p>
                    <p className="text-[10px] text-zinc-500">
                      Textures with the same dimensions, suffix, and current
                      auto-label &quot;{originalAutoLabel}&quot; will also be
                      relabeled as &quot;{labelInput.trim()}&quot;
                    </p>
                  </div>
                </label>
              )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setLabelingFile(null);
                  setLabelInput("");
                  setPropagateChecked(false);
                }}
                className="text-sm text-zinc-400 hover:text-zinc-200 px-3 py-1.5"
                disabled={saving}
              >
                Cancel
              </button>
              {labels[labelingFile.hashPrefix] &&
                labelSources[labelingFile.hashPrefix] === "manual" && (
                  <button
                    onClick={() => {
                      setLabelInput("");
                      setPropagateChecked(false);
                      handleSaveLabel();
                    }}
                    className="text-sm text-red-400 hover:text-red-300 px-3 py-1.5"
                    disabled={saving}
                  >
                    Revert to Auto
                  </button>
                )}
              <button
                onClick={handleSaveLabel}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
              >
                {saving
                  ? "Saving..."
                  : propagateChecked
                    ? `Save & Apply to ${similarCount + 1}`
                    : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingFile && (
        <TextureEditor
          relativePath={editingFile.relativePath}
          frameName={editingFile.frameName}
          onClose={() => setEditingFile(null)}
          onSaved={reloadFiles}
        />
      )}
    </div>
  );
}

function TextureCard({
  file,
  label,
  labelSource,
  onReplace,
  onEdit,
  onLabel,
}: {
  file: TextureFile;
  label: string;
  labelSource: "auto" | "manual";
  onReplace: () => void;
  onEdit: () => void;
  onLabel: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imgKey, setImgKey] = useState(0);
  const imgSrc = `/api/texture-image?path=${encodeURIComponent(file.relativePath)}&v=${imgKey}`;

  async function handleReplace(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", f);
    fd.append("relativePath", file.relativePath);
    try {
      const res = await fetch("/api/texture-upload", {
        method: "POST",
        body: fd,
      });
      if (res.ok) {
        setImgError(false);
        setImgKey((k) => k + 1);
        onReplace();
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden group hover:border-zinc-600 transition-colors">
      <div className="aspect-square bg-zinc-800 flex items-center justify-center overflow-hidden relative">
        {imgError ? (
          <div className="text-zinc-600 text-xs text-center px-2">
            No preview
          </div>
        ) : (
          <img
            src={imgSrc}
            alt={file.frameName}
            className="w-full h-full object-contain"
            onError={() => setImgError(true)}
          />
        )}
        {uploading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-xs text-zinc-300">Uploading...</span>
          </div>
        )}
      </div>
      <div className="px-3 py-2.5 flex flex-col gap-1">
        {label ? (
          <button
            onClick={onLabel}
            className={`text-xs font-semibold text-left truncate ${
              labelSource === "manual"
                ? "text-amber-400 hover:text-amber-300"
                : "text-blue-400 hover:text-blue-300"
            }`}
            title={`${label} (${labelSource === "manual" ? "manual override" : "auto-detected"}) — click to change`}
          >
            {label}
            {labelSource === "manual" && (
              <span className="ml-1 text-[9px] font-normal text-amber-600">
                *
              </span>
            )}
          </button>
        ) : (
          <button
            onClick={onLabel}
            className="text-[11px] text-zinc-600 hover:text-zinc-400 text-left italic"
          >
            + Add label
          </button>
        )}

        <p className="text-[10px] text-zinc-500">
          {dimLabel(file.width, file.height)}
        </p>

        <p
          className="text-[9px] text-zinc-600 truncate"
          title={file.filename}
        >
          {file.filename}
        </p>

        <div className="flex gap-2 mt-0.5 opacity-0 group-hover:opacity-100">
          <button
            onClick={onEdit}
            className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
          >
            Edit
          </button>
          <label className="cursor-pointer text-[11px] text-zinc-400 hover:text-zinc-300 transition-colors">
            Replace
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleReplace}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
