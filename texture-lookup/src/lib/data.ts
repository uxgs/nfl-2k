import type { TextureData } from "./types";

import textures from "@/data/textures.json";

export function getTextureData(): TextureData {
  return textures as TextureData;
}

