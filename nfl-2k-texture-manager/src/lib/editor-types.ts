export type BlendMode =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "hard-light"
  | "soft-light"
  | "color-dodge"
  | "color-burn";

export const BLEND_MODES: BlendMode[] = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "hard-light",
  "soft-light",
  "color-dodge",
  "color-burn",
];

export type EditorLayer = {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  blendMode: BlendMode;
  imageDataUrl: string | null;
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  assetUrl?: string | null;
  isSolidColor?: boolean;
  solidColor?: string;
  blur?: number;
  width?: number;
  height?: number;
  flipX?: boolean;
  flipY?: boolean;
  borderRadius?: number;
  isTemplateLocked?: boolean;
};

export type TextureDocument = {
  width: number;
  height: number;
  layers: EditorLayer[];
};

let _nextId = 1;
export function createLayer(name?: string): EditorLayer {
  const id = `layer_${Date.now()}_${_nextId++}`;
  return {
    id,
    name: name || `Layer ${_nextId}`,
    visible: true,
    opacity: 1,
    blendMode: "normal",
    imageDataUrl: null,
    offsetX: 0,
    offsetY: 0,
    scaleX: 1,
    scaleY: 1,
  };
}
