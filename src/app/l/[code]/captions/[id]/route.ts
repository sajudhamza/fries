/**
 * Captions for a guest's intro video, as WebVTT for the <track> on the video player. Same access rules
 * as the video itself: your own, or someone you're allowed to see who chose to show their intro.
 */
import { NextResponse } from "next/server";
import { ensureFresh } from "@/lib/lifecycle";
import { attendeeProfileId } from "@/lib/session";
import { canInteract } from "@/lib/social";
import { store } from "@/lib/store";
import { toVtt } from "@/lib/captions";
import { needsMatchPrefs } from "@/lib/visibility";

export const dynamic = "force-dynamic";

const notFound = () => new NextResponse("Not found", { status: 404 });

export async function GET(_req: Request, { params }: { params: { code: string; id: string } }) {
  const s = await store();
  const found = await s.getLocationByCode(params.code);
  if (!found) return notFound();
  const loc = await ensureFresh(found);
  const pid = attendeeProfileId(params.code);
  const me = pid ? await s.getProfile(pid) : null;
  if (loc.endedAt || !me || me.locationId !== loc.id) return notFound();

  const target = params.id === me.id ? me : await s.getProfile(params.id);
  if (!target?.captions?.length) return notFound();
  if (target.id !== me.id) {
    if (me.status !== "live" || needsMatchPrefs(loc, me) || !target.fields.showVideo || !(await canInteract(loc, me, target))) return notFound();
  }
  return new NextResponse(toVtt(target.captions), {
    headers: { "Content-Type": "text/vtt; charset=utf-8", "Cache-Control": "private, no-store" },
  });
}
