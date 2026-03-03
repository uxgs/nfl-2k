# Texture image previews

The app can show actual texture images next to texture IDs when your files are available at a URL that matches the expected folder structure.

## Enabling image previews

1. Set **`NEXT_PUBLIC_TEXTURES_BASE_URL`** to the base URL where your texture files are served.
   - Example: if you run `npx serve E:\Emulation\PS2\textures\SLUS-20919\replacements` on port 3001, use `http://localhost:3001` (no trailing slash).
   - Add to `.env.local`: `NEXT_PUBLIC_TEXTURES_BASE_URL=http://localhost:3001`
2. Restart the dev server so the env var is picked up.

Images are only shown for teams that have texture folders on disk (see `src/lib/textureUrl.ts` — currently 49ers, Bears, Bengals, Bills, Broncos, Browns, Bucs, Cardinals, Chargers, Chiefs). Other teams still show IDs and copy as before.

## Expected folder structure

Path to a texture file:

```
[base]/Team/[TeamFolder]/Uniform/[UniformName]/[Shared|Home|Away]/[textureId].png
```

- **TeamFolder**: e.g. `Bears`, `49ers`, `Bucs` (Buccaneers use folder name `Bucs`).
- **UniformName**: must match the app’s uniform name (e.g. `Default`, `2004 Alternate 1`).
- **Shared | Home | Away**: capitalized; no part subfolders — all textures for that set live in that folder.
- **textureId**: same as in the JSON (e.g. `8995aadcfcf1a1a2-f64971d5eaf8c7fc-00006213.png`).

If an image fails to load (missing file, wrong path), the preview is hidden and the ID + copy button still work.

## Folder view

When browsing by team and uniform, a **Folder view** section lists every `.png` in that team’s uniform folder (Shared, Home, Away) without requiring part labels in the JSON. You can expand each bucket, see thumbnails, and download individual files or “Download all” as a zip.

- Requires **`TEXTURES_FOLDER_PATH`** in `.env.local` (server-side) set to the full path of your `replacements` folder (e.g. `E:\Emulation\PS2\textures\SLUS-20919\replacements`). The Next app must run on a machine that can read this path.
- Restart the dev server after adding or changing `TEXTURES_FOLDER_PATH`.
