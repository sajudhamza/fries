/**
 * Event lifecycle. When a location's event ends, every intro video and every profile in that bucket
 * is permanently deleted. The location row stays (marked ended) so the venue can be reopened later.
 */
import { store } from "./store";
import { videoStorage } from "./video-storage";
import { isEnded, nowIso } from "./util";
import type { Location } from "./types";

export async function endEvent(locationId: string): Promise<{ profiles: number; videos: number }> {
  const s = await store();
  const profiles = await s.listProfiles(locationId);
  const keys = profiles.map((p) => p.videoKey).filter((k): k is string => !!k);
  await videoStorage().remove(keys);
  await s.deleteProfilesForLocation(locationId);
  await s.updateLocation(locationId, { endedAt: nowIso() });
  return { profiles: profiles.length, videos: keys.length };
}

/** Ends every open location whose end time has passed. Safe to call often. */
export async function purgeExpired(): Promise<{ ended: string[] }> {
  const s = await store();
  const ended: string[] = [];
  for (const loc of await s.listLocations()) {
    if (loc.endedAt === null && isEnded(loc)) {
      await endEvent(loc.id);
      ended.push(loc.id);
    }
  }
  return { ended };
}

/** Lazily enforces the end time for one location (used on every public page load). */
export async function ensureFresh(loc: Location): Promise<Location> {
  if (loc.endedAt === null && isEnded(loc)) {
    await endEvent(loc.id);
    return { ...loc, endedAt: nowIso() };
  }
  return loc;
}
