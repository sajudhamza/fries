/**
 * Deletes profiles + videos for every event whose end time has passed. Point a scheduler at it
 * (Supabase pg_cron + pg_net, an EventBridge rule, GitHub Actions…) every 5 minutes:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/purge
 * Public pages also enforce the end time lazily, so nothing is ever shown after an event ends.
 */
import { NextResponse, type NextRequest } from "next/server";
import { purgeExpired } from "@/lib/lifecycle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await purgeExpired());
}
