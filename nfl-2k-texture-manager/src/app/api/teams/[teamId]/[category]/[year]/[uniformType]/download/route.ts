import { NextResponse } from "next/server";
import { getUniformSet, getAbsoluteTexturePath } from "@/lib/manifest";
import archiver from "archiver";
import fs from "fs";
import { PassThrough } from "stream";

export async function GET(
  _req: Request,
  {
    params,
  }: {
    params: Promise<{
      teamId: string;
      category: string;
      year: string;
      uniformType: string;
    }>;
  },
) {
  const { teamId, category, year, uniformType } = await params;
  const uniformSet = await getUniformSet(
    teamId,
    decodeURIComponent(category),
    decodeURIComponent(year),
    decodeURIComponent(uniformType),
  );
  if (!uniformSet) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const archive = archiver("zip", { zlib: { level: 5 } });
  const passthrough = new PassThrough();
  archive.pipe(passthrough);

  for (const slot of uniformSet.slots) {
    const absPath = getAbsoluteTexturePath(slot);
    if (fs.existsSync(absPath)) {
      archive.file(absPath, { name: slot.filename });
    }
  }

  archive.finalize();

  const readableStream = new ReadableStream({
    start(controller) {
      passthrough.on("data", (chunk: Buffer) => controller.enqueue(chunk));
      passthrough.on("end", () => controller.close());
      passthrough.on("error", (err) => controller.error(err));
    },
  });

  const zipName = `${teamId}_${category}_${year}_${uniformType}.zip`;

  return new NextResponse(readableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipName}"`,
    },
  });
}
