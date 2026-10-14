import { cache } from "react";
import { notFound } from "next/navigation";
import { store } from "./store";
import { ensureFresh } from "./lifecycle";
import { attendeeProfileId } from "./session";
import type { Location, Profile } from "./types";

/** Loads a location by its QR code plus the current visitor's own profile in it (if any). */
export const loadAttendee = cache(async (code: string): Promise<{ loc: Location; me: Profile | null }> => {
  const s = await store();
  const found = await s.getLocationByCode(code);
  if (!found) notFound();
  const loc = await ensureFresh(found);
  const pid = attendeeProfileId(code);
  const me = pid ? await s.getProfile(pid) : null;
  return { loc, me: me && me.locationId === loc.id ? me : null };
});

/** Where an attendee belongs given how far they got. */
export function nextStep(code: string, me: Profile | null): string {
  if (!me) return `/l/${code}`;
  switch (me.status) {
    case "awaiting_video":
    case "processing":
      return `/l/${code}/video`;
    case "review":
      return `/l/${code}/me`;
    case "live":
      return `/l/${code}/people`;
  }
}
