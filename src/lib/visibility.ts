/**
 * Who can see whom inside one location. Business and social events: everyone sees everyone.
 * Matchmaking: you see someone only if their gender is one you're interested in AND yours is one
 * they're interested in (mutual), so nobody is shown to people they didn't opt in to.
 */
import type { Gender, Interest, Location, Profile } from "./types";

function wants(interest: Interest | "", gender: Gender | ""): boolean {
  if (!interest || !gender) return false;
  if (interest === "everyone") return true;
  return (interest === "men" && gender === "man") || (interest === "women" && gender === "woman");
}

export function canSee(loc: Location, viewer: Profile, other: Profile): boolean {
  if (loc.eventType !== "matchmaking") return true;
  const v = viewer.fields;
  const o = other.fields;
  return wants(v.interestedIn, o.gender) && wants(o.interestedIn, v.gender);
}

/** Matchmaking guests must say their gender and who they're interested in before browsing. */
export function needsMatchPrefs(loc: Location, me: Profile): boolean {
  return loc.eventType === "matchmaking" && (!me.fields.gender || !me.fields.interestedIn);
}
