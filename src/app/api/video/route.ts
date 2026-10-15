/** Development only: serves a locally stored intro video to the worker via a signed, expiring link. */
import fs from "node:fs";
import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";
import { localVideoPath } from "@/lib/video-storage";
import { verify } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key") ?? "";
  const exp = Number(req.nextUrl.searchParams.get("exp"));
  const sig = req.nextUrl.searchParams.get("sig") ?? "";
  if (!key || !exp || exp < Date.now() || !verify(`read:${key}:${exp}`, sig)) {
    return NextResponse.json({ error: "invalid or expired link" }, { status: 403 });
  }
  let path: string;
  try {
    path = localVideoPath(key);
    fs.statSync(path);
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const stream = Readable.toWeb(fs.createReadStream(path)) as ReadableStream;
  return new NextResponse(stream, { headers: { "Content-Type": "application/octet-stream" } });
}
