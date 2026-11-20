/**
 * Development only: serves a locally stored intro video through a signed, expiring link, to the
 * worker and to guests' video players. Supports Range requests, which Safari needs to play video.
 */
import fs from "node:fs";
import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";
import { localVideoPath } from "@/lib/video-storage";
import { verify } from "@/lib/session";

export const runtime = "nodejs";

const TYPES: Record<string, string> = { mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" };

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key") ?? "";
  const exp = Number(req.nextUrl.searchParams.get("exp"));
  const sig = req.nextUrl.searchParams.get("sig") ?? "";
  if (!key || !exp || exp < Date.now() || !verify(`read:${key}:${exp}`, sig)) {
    return NextResponse.json({ error: "invalid or expired link" }, { status: 403 });
  }
  let path: string;
  let size: number;
  try {
    path = localVideoPath(key);
    size = fs.statSync(path).size;
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const type = TYPES[key.split(".").pop() ?? ""] ?? "application/octet-stream";
  const base = { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": "private, no-store" };

  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) {
      return new NextResponse(null, { status: 416, headers: { ...base, "Content-Range": `bytes */${size}` } });
    }
    const stream = Readable.toWeb(fs.createReadStream(path, { start, end })) as ReadableStream;
    return new NextResponse(stream, {
      status: 206,
      headers: { ...base, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }
  const stream = Readable.toWeb(fs.createReadStream(path)) as ReadableStream;
  return new NextResponse(stream, { headers: { ...base, "Content-Length": String(size) } });
}
