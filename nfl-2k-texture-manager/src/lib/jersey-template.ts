import { BlendMode } from "./editor-types";

/**
 * Jersey layer template derived from Figma frame 136:4718 (2KDS v2.0).
 * Canvas size: 2048 x 1024.
 *
 * Layer order matches Figma exactly (bottom → top):
 *   1. Base Uniform Color — solid team color
 *   2. NIKE Logos — shoulder swooshes
 *   3. Jersey Texture — fabric weave overlay (hard-light 75%, 1.5px blur)
 *   4. NFL Chest Logo
 *   5–6. T-Shirt group — bottom hem area with sub-layers and crease
 *   7. Dirt — wear overlay at 70%
 *   8. Inner Pads (Left) — collar/neck hole, 6 sub-layers
 *   9. Inner Pads (Right) — second opening, 6 sub-layers
 *  10. Left Gear — equipment/strap area
 *
 * When editing a jersey, the bottom layer is the existing texture PNG,
 * then these layers are stacked on top in order.
 */

export type TemplateLayerDef = {
  id: string;
  name: string;
  blendMode: BlendMode;
  opacity: number;
  visible: boolean;
  /** If true, this layer is a solid color fill rather than an image */
  isSolidColor?: boolean;
  /** Default fill color for solid-color layers (hex) */
  defaultColor?: string;
  /** CSS blur in pixels (if any) */
  blur?: number;
  /** Position relative to 2048x1024 canvas */
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  /** Static asset path under /template-assets/ (bundled with the app) */
  staticAsset?: string;
  /** Flip vertically */
  flipY?: boolean;
  /** Flip horizontally */
  flipX?: boolean;
  /** Border radius for rounded rectangles */
  borderRadius?: number;
};

export const JERSEY_CANVAS_WIDTH = 2048;
export const JERSEY_CANVAS_HEIGHT = 1024;

export const JERSEY_TEMPLATE_LAYERS: TemplateLayerDef[] = [

  // ── 1. Base Uniform Color ──────────────────────────────────────────
  {
    id: "base_uniform_color",
    name: "Base Uniform Color",
    blendMode: "normal",
    opacity: 1,
    visible: true,
    isSolidColor: true,
    defaultColor: "#862633",
    x: 0,
    y: 0,
    width: 2048,
    height: 1024,
  },

  // ── 2. NIKE Logos ──────────────────────────────────────────────────
  {
    id: "nike_logos",
    name: "NIKE Logos",
    blendMode: "normal",
    opacity: 1,
    visible: true,
    x: 222,
    y: 21,
    width: 1767,
    height: 86,
    staticAsset: "/template-assets/nike-logos.svg",
  },

  // ── 3. Jersey Texture (fabric weave overlay) ──────────────────────
  {
    id: "jersey_texture",
    name: "Jersey Texture",
    blendMode: "hard-light",
    opacity: 0.75,
    visible: true,
    blur: 1.5,
    x: 0,
    y: 0,
    width: 2048,
    height: 1024,
    staticAsset: "/template-assets/jersey-texture.png",
  },

  // ── 4. NFL Chest Logo ─────────────────────────────────────────────
  {
    id: "nfl_chest_logo",
    name: "NFL Chest Logo",
    blendMode: "normal",
    opacity: 1,
    visible: true,
    x: 626,
    y: 306,
    width: 44,
    height: 67,
    staticAsset: "/template-assets/nfl-chest-logo.png",
  },

  // ── 5. T-Shirt group ─────────────────────────────────────────────
  // 5a. T-Shirt shape (normal, flipped Y)
  {
    id: "tshirt_shape_1",
    name: "T-Shirt Shape (Front)",
    blendMode: "normal",
    opacity: 1,
    visible: true,
    x: 0,
    y: 881,
    width: 2048,
    height: 143,
    flipY: true,
    staticAsset: "/template-assets/tshirt-shape-1.svg",
  },
  // 5b. T-Shirt shape (normal, rotated 180°)
  {
    id: "tshirt_shape_2",
    name: "T-Shirt Shape (Back)",
    blendMode: "normal",
    opacity: 1,
    visible: true,
    x: 0,
    y: 881,
    width: 2048,
    height: 143,
    flipX: true,
    flipY: true,
    staticAsset: "/template-assets/tshirt-shape-2.svg",
  },
  // 5c. T-Shirt texture (hard-light, flipped Y)
  {
    id: "tshirt_tex_1",
    name: "T-Shirt Texture 1",
    blendMode: "hard-light",
    opacity: 1,
    visible: true,
    x: 0,
    y: 881,
    width: 2048,
    height: 143,
    flipY: true,
    staticAsset: "/template-assets/tshirt-texture-1.png",
  },
  // 5d. T-Shirt texture (hard-light, flipped Y, duplicate)
  {
    id: "tshirt_tex_2",
    name: "T-Shirt Texture 2",
    blendMode: "hard-light",
    opacity: 1,
    visible: true,
    x: 0,
    y: 881,
    width: 2048,
    height: 143,
    flipY: true,
    staticAsset: "/template-assets/tshirt-texture-1.png",
  },
  // 5e. T-Shirt texture (hard-light, rotated 180°)
  {
    id: "tshirt_tex_3",
    name: "T-Shirt Texture 3",
    blendMode: "hard-light",
    opacity: 1,
    visible: true,
    x: 0,
    y: 881,
    width: 2048,
    height: 143,
    flipX: true,
    flipY: true,
    staticAsset: "/template-assets/tshirt-texture-2.png",
  },
  // 5f. Crease
  {
    id: "crease",
    name: "Crease",
    blendMode: "normal",
    opacity: 1,
    visible: true,
    x: 0,
    y: 935,
    width: 2049,
    height: 18,
    flipY: true,
    staticAsset: "/template-assets/crease.svg",
  },

  // ── 6. Dirt ────────────────────────────────────────────────────────
  {
    id: "dirt",
    name: "Dirt",
    blendMode: "normal",
    opacity: 0.7,
    visible: true,
    x: 0,
    y: 0,
    width: 2048,
    height: 1024,
    staticAsset: "/template-assets/dirt.png",
  },

  // ── 7. Inner Pads (Left) — collar/neck hole ───────────────────────
  // 7a. Inner Fill (larger)
  {
    id: "inner_pads_left_fill_1",
    name: "Inner Fill (Left, Outer)",
    blendMode: "normal",
    opacity: 1,
    visible: true,
    x: 587,
    y: -3,
    width: 123,
    height: 244,
    staticAsset: "/template-assets/inner-fill-1.svg",
  },
  // 7b. Inner Fill (smaller, inset)
  {
    id: "inner_pads_left_fill_2",
    name: "Inner Fill (Left, Inner)",
    blendMode: "normal",
    opacity: 1,
    visible: true,
    x: 601,
    y: 16,
    width: 91,
    height: 180,
    staticAsset: "/template-assets/inner-fill-2.svg",
  },
  // 7c. Grey Ring
  {
    id: "inner_pads_left_grey_ring",
    name: "Grey Ring (Left)",
    blendMode: "normal",
    opacity: 1,
    visible: true,
    x: 561,
    y: 0,
    width: 171,
    height: 291,
    staticAsset: "/template-assets/grey-ring.svg",
  },
  // 7d. Grey Ring (stroke/outer)
  {
    id: "inner_pads_left_grey_ring_2",
    name: "Grey Ring Stroke (Left)",
    blendMode: "normal",
    opacity: 1,
    visible: true,
    x: 553,
    y: -8,
    width: 187,
    height: 307,
    staticAsset: "/template-assets/grey-ring-stroke.png",
  },
  // 7e. Black Outside
  {
    id: "inner_pads_left_black",
    name: "Black Outside (Left)",
    blendMode: "normal",
    opacity: 1,
    visible: true,
    x: 539,
    y: -9,
    width: 218,
    height: 304,
    staticAsset: "/template-assets/black-outside.png",
  },

  // ── 8. Inner Pads (Right) — second opening ────────────────────────
  // 8a. Neutral Inside (dark fill)
  {
    id: "inner_pads_right_neutral_1",
    name: "Neutral Inside (Dark)",
    blendMode: "normal",
    opacity: 1,
    visible: true,
    isSolidColor: true,
    defaultColor: "#282828",
    x: 1495,
    y: -2,
    width: 142,
    height: 140,
    borderRadius: 8,
  },
  // 8b. Neutral Inside (lighter, blurred)
  {
    id: "inner_pads_right_neutral_2",
    name: "Neutral Inside (Blurred)",
    blendMode: "normal",
    opacity: 1,
    visible: true,
    isSolidColor: true,
    defaultColor: "#484646",
    blur: 17,
    x: 1517,
    y: -2,
    width: 97,
    height: 96,
    borderRadius: 8,
  },
  // 8c. Grey Inner
  {
    id: "inner_pads_right_grey_inner",
    name: "Grey Inner (Right)",
    blendMode: "normal",
    opacity: 1,
    visible: true,
    x: 1474,
    y: -6,
    width: 175,
    height: 178,
    staticAsset: "/template-assets/grey-inner.svg",
  },
  // 8d. Grey Inner (stroke/outer)
  {
    id: "inner_pads_right_grey_inner_2",
    name: "Grey Inner Stroke (Right)",
    blendMode: "normal",
    opacity: 1,
    visible: true,
    x: 1466,
    y: -14,
    width: 191,
    height: 193,
    staticAsset: "/template-assets/grey-inner-stroke.png",
  },
  // 8e. Black Outer
  {
    id: "inner_pads_right_black_outer",
    name: "Black Outer (Right)",
    blendMode: "normal",
    opacity: 1,
    visible: true,
    x: 1465,
    y: -6,
    width: 196,
    height: 180,
    staticAsset: "/template-assets/black-outer-stroke.svg",
  },
  // 8f. Black Outer (larger)
  {
    id: "inner_pads_right_black_outer_2",
    name: "Black Outer Stroke (Right)",
    blendMode: "normal",
    opacity: 1,
    visible: true,
    x: 1452,
    y: -16,
    width: 220,
    height: 195,
    staticAsset: "/template-assets/black-outer.png",
  },

  // ── 9. Left Gear ──────────────────────────────────────────────────
  {
    id: "left_gear",
    name: "Left Gear",
    blendMode: "normal",
    opacity: 1,
    visible: true,
    x: 0,
    y: 0,
    width: 129,
    height: 402,
    staticAsset: "/template-assets/left-gear.svg",
  },
];
