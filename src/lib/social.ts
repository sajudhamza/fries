/**
 * Swiping, matching and chat rules. Everything is scoped to one location, and blocks hide two
 * people from each other completely (deck, profile pages and chat).
 */
import { store } from "./store";
import { canSee } from "./visibility";
import type { Location, Match, Message, Profile, Swipe } from "./types";

/** Matches store the pair in a fixed order so each pair has exactly one row. */
export function pair(x: string, y: string): [string, string] {
  return x < y ? [x, y] : [y, x];
}

export function otherId(m: Match, meId: string): string {
  return m.aId === meId ? m.bId : m.aId;
}

export function myReadAt(m: Match, meId: string): string | null {
  return m.aId === meId ? m.aReadAt : m.bReadAt;
}

/** People I blocked or who blocked me. */
export function blockedIds(meId: string, swipes: Swipe[]): Set<string> {
  const out = new Set<string>();
  for (const s of swipes) {
    if (s.decision !== "block") continue;
    if (s.fromId === meId) out.add(s.toId);
    if (s.toId === meId) out.add(s.fromId);
  }
  return out;
}

/** Whether `me` may look at `other` at all (deck, profile page, chat). */
export async function canInteract(loc: Location, me: Profile, other: Profile | null): Promise<boolean> {
  if (!other || other.id === me.id || other.locationId !== loc.id || other.status !== "live") return false;
  if (!canSee(loc, me, other)) return false;
  const swipes = await (await store()).listSwipesInvolving(me.id);
  return !blockedIds(me.id, swipes).has(other.id);
}

/** Profiles I haven't decided on yet, oldest first. */
export async function deckFor(loc: Location, me: Profile): Promise<Profile[]> {
  const s = await store();
  const [profiles, swipes] = await Promise.all([s.listProfiles(loc.id, "live"), s.listSwipesInvolving(me.id)]);
  const decided = new Set(swipes.filter((x) => x.fromId === me.id).map((x) => x.toId));
  const blocked = blockedIds(me.id, swipes);
  return profiles
    .filter((p) => p.id !== me.id && !decided.has(p.id) && !blocked.has(p.id) && canSee(loc, me, p))
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
}

export interface MatchSummary {
  match: Match;
  other: Profile;
  last: Message | null;
  unread: boolean;
}

/** My matches with the other person, latest message and whether there's something new for me. */
export async function matchesFor(loc: Location, me: Profile): Promise<MatchSummary[]> {
  const s = await store();
  const [matches, swipes] = await Promise.all([s.listMatchesFor(me.id), s.listSwipesInvolving(me.id)]);
  const blocked = blockedIds(me.id, swipes);
  const live = matches.filter((m) => m.locationId === loc.id && !blocked.has(otherId(m, me.id)));
  const last = await s.lastMessages(live.map((m) => m.id));
  const out: MatchSummary[] = [];
  for (const m of live) {
    const other = await s.getProfile(otherId(m, me.id));
    if (!other || other.status !== "live") continue;
    const read = myReadAt(m, me.id);
    const l = last[m.id] ?? null;
    const unread = read === null || (l !== null && l.fromId !== me.id && l.createdAt > read);
    out.push({ match: m, other, last: l, unread });
  }
  return out;
}
