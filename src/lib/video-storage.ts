/**
 * Where intro videos live. The browser always uploads directly to the storage target (never through
 * a server action), because a 5-minute video is far larger than serverless request limits.
 *  - Local disk (.data/videos) in development: upload goes to PUT /api/upload with a signed key.
 *  - Supabase Storage (private bucket) when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set:
 *    upload goes straight to a one-off signed upload URL.
 */
import fs from "node:fs";
import path from "node:path";
import { sign } from "./session";

export interface UploadTarget {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
}

export type VideoSource = { url: string } | { path: string; contentType: string };

const CONTENT_TYPES: Record<string, string> = { mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" };

export interface VideoStorage {
  uploadTarget(key: string, contentType: string): Promise<UploadTarget>;
  exists(key: string): Promise<boolean>;
  /** Where a transcription service can read the video: a short-lived signed URL, or a local file. */
  source(key: string): Promise<VideoSource>;
  remove(keys: string[]): Promise<void>;
}

// --- local disk -------------------------------------------------------------------------------

export const VIDEO_DIR = path.join(process.cwd(), ".data", "videos");

export function localVideoPath(key: string): string {
  const p = path.resolve(VIDEO_DIR, key);
  if (!p.startsWith(VIDEO_DIR + path.sep)) throw new Error("bad key");
  return p;
}

export function uploadSignature(key: string, exp: number): string {
  return sign(`upload:${key}:${exp}`);
}

const diskStorage: VideoStorage = {
  async uploadTarget(key, contentType) {
    const exp = Date.now() + 30 * 60_000;
    const qs = new URLSearchParams({ key, exp: String(exp), sig: uploadSignature(key, exp) });
    return { url: `/api/upload?${qs}`, method: "PUT", headers: { "Content-Type": contentType } };
  },
  async exists(key) {
    try {
      return fs.statSync(localVideoPath(key)).size > 0;
    } catch {
      return false;
    }
  },
  async source(key) {
    return { path: localVideoPath(key), contentType: CONTENT_TYPES[key.split(".").pop() ?? ""] ?? "application/octet-stream" };
  },
  async remove(keys) {
    for (const k of keys) fs.rmSync(localVideoPath(k), { force: true });
  },
};

// --- Supabase Storage ---------------------------------------------------------------------------

function supabaseStorage(base: string, serviceKey: string, bucket: string): VideoStorage {
  const api = `${base.replace(/\/$/, "")}/storage/v1`;
  const auth = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey };
  return {
    async uploadTarget(key, contentType) {
      const r = await fetch(`${api}/object/upload/sign/${bucket}/${key}`, { method: "POST", headers: auth });
      if (!r.ok) throw new Error(`Could not create upload URL (${r.status})`);
      const { url } = (await r.json()) as { url: string };
      return { url: `${api}${url}`, method: "PUT", headers: { "Content-Type": contentType, "x-upsert": "true" } };
    },
    async exists(key) {
      const dir = path.posix.dirname(key);
      const name = path.posix.basename(key);
      const r = await fetch(`${api}/object/list/${bucket}`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ prefix: dir, search: name, limit: 1 }),
      });
      if (!r.ok) return false;
      const items = (await r.json()) as { name: string }[];
      return items.some((i) => i.name === name);
    },
    async source(key) {
      // Private bucket: hand the transcription service a link that expires in 15 minutes.
      const r = await fetch(`${api}/object/sign/${bucket}/${key}`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ expiresIn: 900 }),
      });
      if (!r.ok) throw new Error(`Could not sign video URL (${r.status})`);
      const { signedURL } = (await r.json()) as { signedURL: string };
      return { url: `${api}${signedURL}` };
    },
    async remove(keys) {
      if (!keys.length) return;
      await fetch(`${api}/object/${bucket}`, {
        method: "DELETE",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: keys }),
      });
    },
  };
}

export function videoStorage(): VideoStorage {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_VIDEO_BUCKET } = process.env;
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    return supabaseStorage(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_VIDEO_BUCKET || "intro-videos");
  }
  if (process.env.NODE_ENV === "production" && !process.env.FRIES_ALLOW_FILE_STORE) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set. Local video storage only works in development.");
  }
  return diskStorage;
}
