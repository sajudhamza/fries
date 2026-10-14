/** Local-disk upload target for development (production uploads go straight to Supabase Storage). */
import fs from "node:fs";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { localVideoPath } from "@/lib/video-storage";
import { verify } from "@/lib/session";
import { VIDEO_MAX_BYTES } from "@/lib/types";

export const runtime = "nodejs";

export async function PUT(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key") ?? "";
  const exp = Number(req.nextUrl.searchParams.get("exp"));
  const sig = req.nextUrl.searchParams.get("sig") ?? "";
  if (!key || !exp || exp < Date.now() || !verify(`upload:${key}:${exp}`, sig)) {
    return NextResponse.json({ error: "invalid or expired upload link" }, { status: 403 });
  }
  if (!req.body) return NextResponse.json({ error: "empty body" }, { status: 400 });

  const dest = localVideoPath(key);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.part`;
  const out = fs.createWriteStream(tmp);
  let size = 0;
  try {
    const reader = req.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > VIDEO_MAX_BYTES) throw new Error("too large");
      if (!out.write(value)) await new Promise((r) => out.once("drain", r));
    }
    await new Promise<void>((resolve, reject) => out.end((err?: Error | null) => (err ? reject(err) : resolve())));
    fs.renameSync(tmp, dest);
  } catch (e) {
    out.destroy();
    fs.rmSync(tmp, { force: true });
    const tooLarge = e instanceof Error && e.message === "too large";
    return NextResponse.json({ error: tooLarge ? "file too large" : "upload failed" }, { status: tooLarge ? 413 : 500 });
  }
  return NextResponse.json({ ok: true, size });
}
