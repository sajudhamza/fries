/**
 * Deployment self-check. Reports which settings the server can see (true/false only, never values)
 * and whether the database and video bucket are reachable, so a misconfigured deploy is obvious.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VARS = [
  "DATABASE_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_VIDEO_BUCKET",
  "NEXT_PUBLIC_APP_URL", "SESSION_SECRET", "ADMIN_PASSWORD", "CRON_SECRET",
] as const;

function short(e: unknown): string {
  const err = e as { code?: string; message?: string };
  // Strip anything that looks like a connection string before echoing the message.
  return `${err.code ? `[${err.code}] ` : ""}${(err.message ?? String(e)).replace(/postgres(ql)?:\/\/\S+/g, "<url>")}`.slice(0, 200);
}

export async function GET() {
  const env = Object.fromEntries(VARS.map((k) => [k, Boolean(process.env[k]?.trim()) && process.env[k] !== "change-me"]));

  let database = "skipped (DATABASE_URL not set)";
  if (process.env.DATABASE_URL) {
    try {
      const { pgStore } = await import("@/lib/db/pg-store");
      const locations = await pgStore.listLocations();
      database = `ok (${locations.length} locations)`;
    } catch (e) {
      database = `error: ${short(e)}`;
    }
  }

  let videoBucket = "skipped (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set)";
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_VIDEO_BUCKET } = process.env;
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const bucket = SUPABASE_VIDEO_BUCKET || "intro-videos";
      const r = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/bucket/${bucket}`, {
        headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, apikey: SUPABASE_SERVICE_ROLE_KEY },
      });
      const body = (await r.json().catch(() => ({}))) as { public?: boolean; message?: string };
      videoBucket = r.ok ? (body.public ? "error: bucket is PUBLIC, make it private" : "ok (private)") : `error: ${r.status} ${body.message ?? ""}`.trim();
    } catch (e) {
      videoBucket = `error: ${short(e)}`;
    }
  }

  return NextResponse.json({ node: process.version, env, database, videoBucket });
}
