"use client";

import { useState, useEffect, useRef, useCallback, useMemo, DragEvent } from "react";
import {
  TextureDocument,
  EditorLayer,
  BlendMode,
  BLEND_MODES,
  createLayer,
} from "@/lib/editor-types";
const UNDO_MAX = 50;
import {
  JERSEY_TEMPLATE_LAYERS,
  JERSEY_CANVAS_WIDTH,
  JERSEY_CANVAS_HEIGHT,
  TemplateLayerDef,
} from "@/lib/jersey-template";
import {
  getTeamIdFromRelativePath,
  getFillColorOptions,
  getAllColorsForLabel,
  NFL_TEAM_PALETTES,
} from "@/lib/nfl-team-colors";

type Props = {
  relativePath: string;
  frameName: string;
  onClose: () => void;
  onSaved: () => void;
};

const BLEND_MODE_TO_CANVAS: Record<BlendMode, GlobalCompositeOperation> = {
  normal: "source-over",
  multiply: "multiply",
  screen: "screen",
  overlay: "overlay",
  "hard-light": "hard-light",
  "soft-light": "soft-light",
  "color-dodge": "color-dodge",
  "color-burn": "color-burn",
};

function templateLayerToEditorLayer(def: TemplateLayerDef): EditorLayer {
  return {
    id: def.id,
    name: def.name,
    visible: def.visible,
    opacity: def.opacity,
    blendMode: def.blendMode,
    imageDataUrl: null,
    assetUrl: def.staticAsset || null,
    isSolidColor: def.isSolidColor || false,
    solidColor: def.defaultColor || "#000000",
    blur: def.blur || 0,
    offsetX: def.x ?? 0,
    offsetY: def.y ?? 0,
    scaleX: 1,
    scaleY: 1,
    width: def.width,
    height: def.height,
    flipX: def.flipX || false,
    flipY: def.flipY || false,
    borderRadius: def.borderRadius || 0,
    isTemplateLocked: true,
  };
}

export default function TextureEditor({
  relativePath,
  frameName,
  onClose,
  onSaved,
}: Props) {
  const [doc, setDoc] = useState<TextureDocument | null>(null);
  const [layers, setLayers] = useState<EditorLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [undoStack, setUndoStack] = useState<TextureDocument[]>([]);
  const [redoStack, setRedoStack] = useState<TextureDocument[]>([]);
  const isRestoringHistory = useRef(false);
  const [fillColorDropdownOpen, setFillColorDropdownOpen] = useState(false);
  const [fillColorViewTeam, setFillColorViewTeam] = useState<string | "__current__">("__current__");
  const [isDraggingOnCanvas, setIsDraggingOnCanvas] = useState(false);
  const [hoveredLayerIdOnCanvas, setHoveredLayerIdOnCanvas] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const fillColorDropdownRef = useRef<HTMLDivElement>(null);
  const canvasDragRef = useRef<{
    layerId: string;
    startOffsetX: number;
    startOffsetY: number;
    startCanvasX: number;
    startCanvasY: number;
  } | null>(null);

  const currentTeam = useMemo(
    () => getTeamIdFromRelativePath(relativePath),
    [relativePath]
  );

  useEffect(() => {
    setFillColorViewTeam("__current__");
  }, [relativePath]);

  const fillColorDisplayTeam =
    fillColorViewTeam === "__current__" ? currentTeam : fillColorViewTeam;
  const fillColorOptions = useMemo(
    () => getFillColorOptions(fillColorDisplayTeam),
    [fillColorDisplayTeam]
  );
  const allColorsForLabel = useMemo(() => getAllColorsForLabel(), []);

  // Close fill color dropdown when clicking outside
  useEffect(() => {
    if (!fillColorDropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        fillColorDropdownRef.current &&
        !fillColorDropdownRef.current.contains(e.target as Node)
      ) {
        setFillColorDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [fillColorDropdownOpen]);

  // Initialize layers from saved doc or just the base texture
  useEffect(() => {
    async function init() {
      // Try to load saved document
      const docRes = await fetch(
        `/api/editor/load?path=${encodeURIComponent(relativePath)}`,
      );
      const docData = await docRes.json();

      if (docData.hasDoc && docData.document) {
        const savedDoc = docData.document as TextureDocument;
        setDoc(savedDoc);
        setLayers(savedDoc.layers as EditorLayer[]);
        setUndoStack([]);
        setRedoStack([]);
        if (savedDoc.layers.length > 0) {
          setSelectedLayerId(savedDoc.layers[0].id);
        }
        return;
      }

      // No saved doc — start with just the base texture (no template)
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = `/api/texture-image?path=${encodeURIComponent(relativePath)}`;

      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL("image/png");

        const baseLayer: EditorLayer = {
          id: "existing_texture",
          name: "Current Texture",
          visible: true,
          opacity: 1,
          blendMode: "normal",
          imageDataUrl: dataUrl,
          offsetX: 0,
          offsetY: 0,
          scaleX: 1,
          scaleY: 1,
          isTemplateLocked: false,
        };

        const allLayers = [baseLayer];

        const newDoc: TextureDocument = {
          width: img.width,
          height: img.height,
          layers: allLayers,
        };

        setDoc(newDoc);
        setLayers(allLayers);
        setUndoStack([]);
        setRedoStack([]);
        setSelectedLayerId("existing_texture");
      };
    }

    init();
  }, [relativePath]);

  const loadImage = useCallback(
    (src: string): Promise<HTMLImageElement> => {
      const cached = imageCache.current.get(src);
      if (cached && cached.complete) return Promise.resolve(cached);

      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          imageCache.current.set(src, img);
          resolve(img);
        };
        img.onerror = reject;
        img.src = src;
      });
    },
    [],
  );

  // Render composite
  const renderCanvas = useCallback(async () => {
    if (!doc || !canvasRef.current || layers.length === 0) return;
    const canvas = canvasRef.current;
    canvas.width = doc.width;
    canvas.height = doc.height;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, doc.width, doc.height);

    // Checkerboard
    const sz = 16;
    for (let y = 0; y < doc.height; y += sz) {
      for (let x = 0; x < doc.width; x += sz) {
        ctx.fillStyle =
          (x / sz + y / sz) % 2 === 0 ? "#2a2a2a" : "#1a1a1a";
        ctx.fillRect(x, y, sz, sz);
      }
    }

    for (const layer of layers) {
      if (!layer.visible) continue;

      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation =
        BLEND_MODE_TO_CANVAS[layer.blendMode] || "source-over";

      const lw = layer.width ?? doc.width;
      const lh = layer.height ?? doc.height;

      if (layer.isSolidColor && layer.solidColor) {
        if (layer.blur && layer.blur > 0) {
          ctx.filter = `blur(${layer.blur}px)`;
        }
        ctx.fillStyle = layer.solidColor;
        if (layer.borderRadius && layer.borderRadius > 0) {
          ctx.beginPath();
          ctx.roundRect(layer.offsetX, layer.offsetY, lw, lh, layer.borderRadius);
          ctx.fill();
        } else {
          ctx.fillRect(layer.offsetX, layer.offsetY, lw, lh);
        }
      } else {
        const imgSrc =
          layer.imageDataUrl || layer.assetUrl || null;
        if (!imgSrc) {
          ctx.restore();
          continue;
        }

        try {
          const img = await loadImage(imgSrc);

          if (layer.blur && layer.blur > 0) {
            ctx.filter = `blur(${layer.blur}px)`;
          }

          const sx = (layer.flipX ? -1 : 1) * layer.scaleX;
          const sy = (layer.flipY ? -1 : 1) * layer.scaleY;
          const tx = layer.offsetX + (layer.flipX ? lw : 0);
          const ty = layer.offsetY + (layer.flipY ? lh : 0);

          ctx.translate(tx, ty);
          ctx.scale(sx, sy);

          ctx.drawImage(img, 0, 0, lw, lh);
        } catch {
          // Image failed to load
        }
      }
      ctx.restore();
    }
  }, [doc, layers, loadImage]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  function pushUndo() {
    if (isRestoringHistory.current || !doc) return;
    const snapshot: TextureDocument = {
      width: doc.width,
      height: doc.height,
      layers: JSON.parse(JSON.stringify(layers)),
    };
    setUndoStack((prev) => [...prev.slice(-(UNDO_MAX - 1)), snapshot]);
    setRedoStack([]);
  }

  const undo = useCallback(() => {
    if (undoStack.length === 0 || !doc) return;
    isRestoringHistory.current = true;
    const snapshot = undoStack[undoStack.length - 1];
    const currentSnapshot: TextureDocument = {
      width: doc.width,
      height: doc.height,
      layers: JSON.parse(JSON.stringify(layers)),
    };
    setRedoStack((prev) => [...prev, currentSnapshot]);
    setUndoStack((prev) => prev.slice(0, -1));
    setDoc({ ...snapshot });
    setLayers(snapshot.layers);
    const keepSelection =
      selectedLayerId && snapshot.layers.some((l) => l.id === selectedLayerId);
    if (!keepSelection && snapshot.layers.length > 0) {
      setSelectedLayerId(snapshot.layers[0].id);
    } else if (!keepSelection) {
      setSelectedLayerId(null);
    }
    queueMicrotask(() => {
      isRestoringHistory.current = false;
    });
  }, [undoStack, redoStack, doc, layers, selectedLayerId]);

  const redo = useCallback(() => {
    if (redoStack.length === 0 || !doc) return;
    isRestoringHistory.current = true;
    const snapshot = redoStack[redoStack.length - 1];
    const currentSnapshot: TextureDocument = {
      width: doc.width,
      height: doc.height,
      layers: JSON.parse(JSON.stringify(layers)),
    };
    setUndoStack((prev) => [...prev, currentSnapshot]);
    setRedoStack((prev) => prev.slice(0, -1));
    setDoc({ ...snapshot });
    setLayers(snapshot.layers);
    const keepSelection =
      selectedLayerId && snapshot.layers.some((l) => l.id === selectedLayerId);
    if (!keepSelection && snapshot.layers.length > 0) {
      setSelectedLayerId(snapshot.layers[0].id);
    } else if (!keepSelection) {
      setSelectedLayerId(null);
    }
    queueMicrotask(() => {
      isRestoringHistory.current = false;
    });
  }, [undoStack, redoStack, doc, layers, selectedLayerId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z") {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
        } else if (e.key === "y") {
          e.preventDefault();
          redo();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  function updateLayer(layerId: string, updates: Partial<EditorLayer>) {
    if (!canvasDragRef.current) pushUndo();
    setLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, ...updates } : l)),
    );
  }

  /** Convert client mouse position to canvas-space coordinates. */
  function getCanvasPoint(e: { clientX: number; clientY: number }): { x: number; y: number } | null {
    const canvas = canvasRef.current;
    if (!canvas || !doc) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  /** Return the topmost visible layer at (canvasX, canvasY), or null. */
  function hitTestLayer(canvasX: number, canvasY: number): EditorLayer | null {
    if (!doc) return null;
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i];
      if (!layer.visible) continue;
      const lw = layer.width ?? doc.width;
      const lh = layer.height ?? doc.height;
      if (
        canvasX >= layer.offsetX &&
        canvasX < layer.offsetX + lw &&
        canvasY >= layer.offsetY &&
        canvasY < layer.offsetY + lh
      ) {
        return layer;
      }
    }
    return null;
  }

  function handleCanvasMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const pt = getCanvasPoint(e);
    if (!pt || e.button !== 0) return;
    const layer = hitTestLayer(pt.x, pt.y);
    if (!layer) return;
    pushUndo();
    setSelectedLayerId(layer.id);
    canvasDragRef.current = {
      layerId: layer.id,
      startOffsetX: layer.offsetX,
      startOffsetY: layer.offsetY,
      startCanvasX: pt.x,
      startCanvasY: pt.y,
    };
    setIsDraggingOnCanvas(true);
  }

  function handleCanvasMouseUp() {
    canvasDragRef.current = null;
    setIsDraggingOnCanvas(false);
  }

  function handleCanvasMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (canvasDragRef.current) return;
    const pt = getCanvasPoint(e);
    if (!pt) return;
    const layer = hitTestLayer(pt.x, pt.y);
    setHoveredLayerIdOnCanvas(layer?.id ?? null);
  }

  function handleCanvasMouseLeave() {
    setHoveredLayerIdOnCanvas(null);
  }

  // Window-level move/up so dragging works when cursor leaves the canvas
  useEffect(() => {
    if (!isDraggingOnCanvas) return;
    const canvas = canvasRef.current;
    const onMove = (e: MouseEvent) => {
      const drag = canvasDragRef.current;
      if (!drag || !canvas || !doc) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      const deltaX = x - drag.startCanvasX;
      const deltaY = y - drag.startCanvasY;
      updateLayer(drag.layerId, {
        offsetX: Math.round(drag.startOffsetX + deltaX),
        offsetY: Math.round(drag.startOffsetY + deltaY),
      });
    };
    const onUp = () => handleCanvasMouseUp();
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDraggingOnCanvas, doc]);

  function addLayer() {
    pushUndo();
    const newLayer: EditorLayer = {
      ...createLayer(),
      isTemplateLocked: false,
    };
    setLayers((prev) => [...prev, newLayer]);
    setSelectedLayerId(newLayer.id);
  }

  function applyJerseyTemplate() {
    pushUndo();
    const templateLayers = JERSEY_TEMPLATE_LAYERS.map((def) =>
      templateLayerToEditorLayer(def),
    );
    setLayers((prev) => [...prev, ...templateLayers]);
    if (doc) {
      setDoc({
        ...doc,
        width: JERSEY_CANVAS_WIDTH,
        height: JERSEY_CANVAS_HEIGHT,
      });
    }
  }

  function removeLayer(layerId: string) {
    pushUndo();
    setLayers((prev) => {
      const filtered = prev.filter((l) => l.id !== layerId);
      if (selectedLayerId === layerId) {
        setSelectedLayerId(filtered.length > 0 ? filtered[0].id : null);
      }
      return filtered;
    });
  }

  function moveLayer(layerId: string, direction: "up" | "down") {
    pushUndo();
    setLayers((prev) => {
      const idx = prev.findIndex((l) => l.id === layerId);
      if (idx === -1) return prev;
      const newIdx = direction === "up" ? idx + 1 : idx - 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
  }

  const dragItem = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverSide, setDragOverSide] = useState<"above" | "below" | null>(null);

  function handleDragStart(e: DragEvent, layerId: string) {
    dragItem.current = layerId;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", layerId);
    (e.currentTarget as HTMLElement).style.opacity = "0.4";
  }

  function handleDragEnd(e: DragEvent) {
    (e.currentTarget as HTMLElement).style.opacity = "1";
    dragItem.current = null;
    setDragOverId(null);
    setDragOverSide(null);
  }

  function handleDragOver(e: DragEvent, layerId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (layerId === dragItem.current) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    setDragOverId(layerId);
    setDragOverSide(e.clientY < midY ? "above" : "below");
  }

  function handleDrop(e: DragEvent, targetLayerId: string) {
    e.preventDefault();
    const srcId = dragItem.current;
    if (!srcId || srcId === targetLayerId) return;
    pushUndo();
    setLayers((prev) => {
      const srcIdx = prev.findIndex((l) => l.id === srcId);
      if (srcIdx === -1) return prev;
      const arr = [...prev];
      const [moved] = arr.splice(srcIdx, 1);

      // The layer list is displayed reversed (topmost layer first in UI).
      // In the internal array, higher index = renders on top.
      // "above" in the reversed UI means the dragged layer should render
      // AFTER the target (higher index), "below" means BEFORE (lower index).
      let targetIdx = arr.findIndex((l) => l.id === targetLayerId);
      if (targetIdx === -1) return prev;

      if (dragOverSide === "above") {
        arr.splice(targetIdx + 1, 0, moved);
      } else {
        arr.splice(targetIdx, 0, moved);
      }
      return arr;
    });

    dragItem.current = null;
    setDragOverId(null);
    setDragOverSide(null);
  }

  async function handleLayerImage(
    layerId: string,
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    pushUndo();
    const reader = new FileReader();
    reader.onload = () => {
      setLayers((prev) =>
        prev.map((l) =>
          l.id === layerId
            ? {
                ...l,
                imageDataUrl: reader.result as string,
                assetUrl: null,
              }
            : l,
        ),
      );
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!doc || !canvasRef.current) return;
    setSaving(true);

    // Render clean composite
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = doc.width;
    exportCanvas.height = doc.height;
    const ctx = exportCanvas.getContext("2d")!;
    ctx.clearRect(0, 0, doc.width, doc.height);

    for (const layer of layers) {
      if (!layer.visible) continue;
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation =
        BLEND_MODE_TO_CANVAS[layer.blendMode] || "source-over";

      const lw = layer.width ?? doc.width;
      const lh = layer.height ?? doc.height;

      if (layer.isSolidColor && layer.solidColor) {
        if (layer.blur && layer.blur > 0) {
          ctx.filter = `blur(${layer.blur}px)`;
        }
        ctx.fillStyle = layer.solidColor;
        if (layer.borderRadius && layer.borderRadius > 0) {
          ctx.beginPath();
          ctx.roundRect(layer.offsetX, layer.offsetY, lw, lh, layer.borderRadius);
          ctx.fill();
        } else {
          ctx.fillRect(layer.offsetX, layer.offsetY, lw, lh);
        }
      } else {
        const imgSrc = layer.imageDataUrl || layer.assetUrl || null;
        if (!imgSrc) {
          ctx.restore();
          continue;
        }
        try {
          const img = await loadImage(imgSrc);
          if (layer.blur && layer.blur > 0) {
            ctx.filter = `blur(${layer.blur}px)`;
          }
          const sx = (layer.flipX ? -1 : 1) * layer.scaleX;
          const sy = (layer.flipY ? -1 : 1) * layer.scaleY;
          const tx = layer.offsetX + (layer.flipX ? lw : 0);
          const ty = layer.offsetY + (layer.flipY ? lh : 0);
          ctx.translate(tx, ty);
          ctx.scale(sx, sy);
          ctx.drawImage(img, 0, 0, lw, lh);
        } catch {
          // skip
        }
      }
      ctx.restore();
    }

    const flattenedDataUrl = exportCanvas.toDataURL("image/png");

    // Save document (layers) + flattened PNG
    const saveDoc: TextureDocument = {
      width: doc.width,
      height: doc.height,
      layers: layers,
    };

    await fetch("/api/editor/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        relativePath,
        document: saveDoc,
        flattenedDataUrl,
      }),
    });

    setSaving(false);
    onSaved();
  }

  const selectedLayer = layers.find((l) => l.id === selectedLayerId);

  if (!doc) {
    return (
      <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
        <p className="text-zinc-400">Loading editor...</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 text-sm"
          >
            Back
          </button>
          <h2 className="text-sm font-semibold text-zinc-200">{frameName}</h2>
          <span className="text-xs text-zinc-500">
            {doc.width} x {doc.height}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={undo}
            disabled={undoStack.length === 0}
            title="Undo (Ctrl+Z)"
            className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-200 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            Undo
          </button>
          <button
            onClick={redo}
            disabled={redoStack.length === 0}
            title="Redo (Ctrl+Y)"
            className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-200 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            Redo
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Canvas area */}
        <div className="flex-1 overflow-auto flex items-center justify-center bg-zinc-950 p-4">
          <canvas
            ref={canvasRef}
            className="max-w-full max-h-full"
            style={{
              imageRendering: "auto",
              cursor: isDraggingOnCanvas
                ? "grabbing"
                : hoveredLayerIdOnCanvas
                  ? "grab"
                  : "default",
            }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseLeave}
            title="Click a layer and drag to move it"
          />
        </div>

        {/* Layers panel */}
        <div className="w-80 bg-zinc-900 border-l border-zinc-800 flex flex-col shrink-0">
          <div className="px-4 py-3 border-b border-zinc-800 flex flex-col gap-2 shrink-0">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-300">Layers</h3>
              <button
                onClick={addLayer}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                + Add Layer
              </button>
            </div>
            {layers.length <= 1 && !layers.some((l) => l.isTemplateLocked) && (
              <button
                onClick={applyJerseyTemplate}
                className="text-xs text-emerald-400 hover:text-emerald-300 bg-zinc-800 rounded px-2 py-1 w-full text-left"
              >
                Apply Jersey Template Layers
              </button>
            )}
          </div>

          {/* Layer list (reversed so topmost layer is at top of list) */}
          <div className="flex-1 overflow-auto">
            {[...layers].reverse().map((layer) => (
              <div
                key={layer.id}
                draggable
                onDragStart={(e) => handleDragStart(e, layer.id)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, layer.id)}
                onDragLeave={() => { setDragOverId(null); setDragOverSide(null); }}
                onDrop={(e) => handleDrop(e, layer.id)}
                onClick={() => setSelectedLayerId(layer.id)}
                className={`relative px-4 py-2 border-b border-zinc-800 cursor-grab active:cursor-grabbing transition-colors ${
                  selectedLayerId === layer.id
                    ? "bg-zinc-800"
                    : "hover:bg-zinc-800/50"
                }`}
              >
                {dragOverId === layer.id && dragOverSide === "above" && (
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 z-10" />
                )}
                {dragOverId === layer.id && dragOverSide === "below" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 z-10" />
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-zinc-600 text-[10px] cursor-grab shrink-0 select-none" title="Drag to reorder">&#x2630;</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateLayer(layer.id, { visible: !layer.visible });
                      }}
                      className={`shrink-0 w-5 h-5 flex items-center justify-center ${layer.visible ? "text-blue-400" : "text-zinc-600"}`}
                      title={layer.visible ? "Hide layer" : "Show layer"}
                    >
                      {layer.visible ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      )}
                    </button>
                    <span className="text-xs text-zinc-300 truncate">
                      {layer.name}
                    </span>
                    {layer.isTemplateLocked && (
                      <span className="text-[9px] text-zinc-600 shrink-0">
                        TPL
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveLayer(layer.id, "up");
                      }}
                      className="text-[11px] text-zinc-500 hover:text-zinc-300 px-1 leading-none"
                      title="Move layer up"
                    >
                      &#x25B2;
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveLayer(layer.id, "down");
                      }}
                      className="text-[11px] text-zinc-500 hover:text-zinc-300 px-1 leading-none"
                      title="Move layer down"
                    >
                      &#x25BC;
                    </button>
                    {!layer.isTemplateLocked && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeLayer(layer.id);
                        }}
                        className="text-[10px] text-red-500 hover:text-red-400 px-1 ml-1"
                        title="Delete layer"
                      >
                        &#x2715;
                      </button>
                    )}
                  </div>
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5 pl-5">
                  {layer.blendMode} &middot;{" "}
                  {Math.round(layer.opacity * 100)}%
                  {layer.isSolidColor
                    ? ` (${layer.solidColor})`
                    : !layer.imageDataUrl && !layer.assetUrl
                      ? " (empty)"
                      : ""}
                </div>
              </div>
            ))}
          </div>

          {/* Selected layer properties */}
          {selectedLayer && (
            <div className="border-t border-zinc-800 px-4 py-3 space-y-3 overflow-auto max-h-[50%] shrink-0">
              <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Layer Properties
              </h4>

              {selectedLayer.isTemplateLocked && (
                <p className="text-[10px] text-zinc-500 italic">
                  Template layer from Figma jersey structure
                </p>
              )}

              {/* Name */}
              <div>
                <label className="text-[10px] text-zinc-500 block mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={selectedLayer.name}
                  onChange={(e) =>
                    updateLayer(selectedLayer.id, { name: e.target.value })
                  }
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200"
                />
              </div>

              {/* Blend Mode */}
              <div>
                <label className="text-[10px] text-zinc-500 block mb-1">
                  Blend Mode
                </label>
                <select
                  value={selectedLayer.blendMode}
                  onChange={(e) =>
                    updateLayer(selectedLayer.id, {
                      blendMode: e.target.value as BlendMode,
                    })
                  }
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200"
                >
                  {BLEND_MODES.map((bm) => (
                    <option key={bm} value={bm}>
                      {bm}
                    </option>
                  ))}
                </select>
              </div>

              {/* Opacity */}
              <div>
                <label className="text-[10px] text-zinc-500 block mb-1">
                  Opacity: {Math.round(selectedLayer.opacity * 100)}%
                </label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={selectedLayer.opacity}
                  onChange={(e) =>
                    updateLayer(selectedLayer.id, {
                      opacity: parseFloat(e.target.value),
                    })
                  }
                  className="w-full"
                />
              </div>

              {/* Blur */}
              <div>
                <label className="text-[10px] text-zinc-500 block mb-1">
                  Blur: {selectedLayer.blur ?? 0}px
                </label>
                <input
                  type="range"
                  min={0}
                  max={20}
                  step={0.5}
                  value={selectedLayer.blur ?? 0}
                  onChange={(e) =>
                    updateLayer(selectedLayer.id, {
                      blur: parseFloat(e.target.value),
                    })
                  }
                  className="w-full"
                />
              </div>

              {/* Solid color — team-aware dropdown (utility + current team by default) */}
              {selectedLayer.isSolidColor && (
                <div ref={fillColorDropdownRef} className="relative">
                  <label className="text-[10px] text-zinc-500 block mb-1">
                    Fill Color
                  </label>
                  {(() => {
                    const current = selectedLayer.solidColor || "#000000";
                    const toHex6 = (s: string) => {
                      if (!s.startsWith("#")) return "#000000";
                      if (s.length === 7) return s.toUpperCase();
                      if (s.length === 4)
                        return "#" + s.slice(1).split("").map((x) => x + x).join("").toUpperCase();
                      return s.toUpperCase();
                    };
                    const normalized = toHex6(current);
                    const matched = allColorsForLabel.find(
                      (c) => toHex6(c.value) === normalized
                    );
                    const label = matched ? matched.name : `Custom (${normalized})`;
                    return (
                      <>
                        <button
                          type="button"
                          onClick={() => setFillColorDropdownOpen((o) => !o)}
                          className="w-full flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-left text-xs text-zinc-200 hover:bg-zinc-700"
                        >
                          <span
                            className="w-5 h-5 rounded border border-zinc-600 shrink-0"
                            style={{ backgroundColor: current }}
                          />
                          <span className="truncate flex-1">{label}</span>
                          <svg
                            className={`w-3.5 h-3.5 shrink-0 text-zinc-500 transition-transform ${fillColorDropdownOpen ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {fillColorDropdownOpen && (
                          <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl max-h-80 flex flex-col">
                            <div className="p-2 border-b border-zinc-700 shrink-0">
                              <p className="text-[10px] text-zinc-500 mb-1">Team colors</p>
                              <select
                                value={fillColorViewTeam}
                                onChange={(e) =>
                                  setFillColorViewTeam(
                                    e.target.value as string | "__current__"
                                  )
                                }
                                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200"
                              >
                                <option value="__current__">
                                  {currentTeam
                                    ? `${NFL_TEAM_PALETTES.find((t) => t.id === currentTeam)?.name ?? currentTeam} (current)`
                                    : "—"}
                                </option>
                                {NFL_TEAM_PALETTES.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="overflow-auto flex-1 min-h-0 p-1">
                              {fillColorOptions.map((c) => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => {
                                    updateLayer(selectedLayer.id, {
                                      solidColor: c.value,
                                    });
                                    setFillColorDropdownOpen(false);
                                  }}
                                  className={`w-full flex items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ${
                                    toHex6(selectedLayer.solidColor || "#000000") ===
                                    toHex6(c.value)
                                      ? "bg-blue-900/40 text-blue-200"
                                      : "text-zinc-200 hover:bg-zinc-800"
                                  }`}
                                >
                                  <span
                                    className="w-4 h-4 rounded border border-zinc-600 shrink-0"
                                    style={{ backgroundColor: c.value }}
                                  />
                                  <span className="truncate">{c.name}</span>
                                </button>
                              ))}
                            </div>
                            <div className="border-t border-zinc-700 p-2 shrink-0">
                              <p className="text-[10px] text-zinc-500 mb-1.5">Custom</p>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={selectedLayer.solidColor || "#000000"}
                                  onChange={(e) =>
                                    updateLayer(selectedLayer.id, {
                                      solidColor: e.target.value,
                                    })
                                  }
                                  className="w-8 h-7 rounded border border-zinc-600 cursor-pointer shrink-0"
                                />
                                <input
                                  type="text"
                                  value={selectedLayer.solidColor || "#000000"}
                                  onChange={(e) => {
                                    const v = e.target.value.trim();
                                    if (
                                      /^#[0-9A-Fa-f]{6}$/.test(v) ||
                                      /^#[0-9A-Fa-f]{3}$/.test(v)
                                    ) {
                                      updateLayer(selectedLayer.id, {
                                        solidColor: v,
                                      });
                                    }
                                  }}
                                  className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs font-mono text-zinc-200"
                                  placeholder="#000000"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Image / asset upload */}
              {!selectedLayer.isSolidColor && (
                <div>
                  <label className="text-[10px] text-zinc-500 block mb-1">
                    Image
                  </label>

                  {/* Show current source */}
                  {selectedLayer.assetUrl && (
                    <p className="text-[10px] text-green-500 mb-1">
                      Using saved template asset
                    </p>
                  )}
                  {selectedLayer.imageDataUrl &&
                    !selectedLayer.assetUrl && (
                      <p className="text-[10px] text-blue-500 mb-1">
                        Using uploaded image
                      </p>
                    )}
                  {!selectedLayer.imageDataUrl &&
                    !selectedLayer.assetUrl && (
                      <p className="text-[10px] text-zinc-600 mb-1">
                        No image loaded
                      </p>
                    )}

                  <div className="flex flex-col gap-1">
                    <label className="cursor-pointer text-xs text-blue-400 hover:text-blue-300">
                      {selectedLayer.imageDataUrl || selectedLayer.assetUrl
                        ? "Replace image..."
                        : "Load image..."}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) =>
                          handleLayerImage(selectedLayer.id, e)
                        }
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Position & Scale */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-zinc-500 block mb-1">
                    X
                  </label>
                  <input
                    type="number"
                    value={selectedLayer.offsetX}
                    onChange={(e) =>
                      updateLayer(selectedLayer.id, {
                        offsetX: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 block mb-1">
                    Y
                  </label>
                  <input
                    type="number"
                    value={selectedLayer.offsetY}
                    onChange={(e) =>
                      updateLayer(selectedLayer.id, {
                        offsetY: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 block mb-1">
                    Scale X
                  </label>
                  <input
                    type="number"
                    step={0.1}
                    value={selectedLayer.scaleX}
                    onChange={(e) =>
                      updateLayer(selectedLayer.id, {
                        scaleX: parseFloat(e.target.value) || 1,
                      })
                    }
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 block mb-1">
                    Scale Y
                  </label>
                  <input
                    type="number"
                    step={0.1}
                    value={selectedLayer.scaleY}
                    onChange={(e) =>
                      updateLayer(selectedLayer.id, {
                        scaleY: parseFloat(e.target.value) || 1,
                      })
                    }
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
