/** Callback from the profile worker. Authenticated by the per-job token the app issued on dispatch. */
import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { completeProcessing, sanitizeFields } from "@/lib/processing";
import { store } from "@/lib/store";
import { jobToken } from "@/lib/worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    profileId?: string; token?: string; ok?: boolean; transcript?: string; fields?: unknown; error?: string; timings?: unknown;
  } | null;
  if (!body?.profileId || !body.token) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const me = await (await store()).getProfile(body.profileId);
  if (!me?.videoKey) return NextResponse.json({ error: "unknown job" }, { status: 404 });
  const expected = Buffer.from(jobToken(me.id, me.videoKey));
  const given = Buffer.from(body.token);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return NextResponse.json({ error: "invalid token" }, { status: 403 });
  }
  // Late or duplicate result (guest already moved on, re-uploaded, or Lambda retried): ignore.
  if (me.status !== "processing") return NextResponse.json({ ok: true, ignored: true });

  console.log(`[worker] result for ${me.id}: ok=${body.ok} timings=${JSON.stringify(body.timings ?? {})}${body.error ? ` error=${body.error}` : ""}`);
  const transcript = typeof body.transcript === "string" ? body.transcript.slice(0, 20_000) : null;
  const found = body.ok ? sanitizeFields(body.fields) : {};
  // Gender and interest only mean something at matchmaking events; never store them otherwise.
  const loc = await (await store()).getLocation(me.locationId);
  if (loc?.eventType !== "matchmaking") {
    delete found.gender;
    delete found.interestedIn;
  }
  await completeProcessing(me, found, transcript);
  return NextResponse.json({ ok: true });
}
