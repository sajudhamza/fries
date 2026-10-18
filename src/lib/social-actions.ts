"use server";

import { redirect } from "next/navigation";
import { loadAttendee } from "./attendee";
import { store } from "./store";
import { canInteract, matchesFor, otherId, pair } from "./social";
import { newId, nowIso } from "./util";
import { needsMatchPrefs } from "./visibility";
import { MESSAGE_MAX_LENGTH, type Location, type Match, type Message, type MessageKind, type Profile } from "./types";

/** Signed-in, live attendee of an open location, or bounce them to the right page. */
async function requireLive(code: string): Promise<{ loc: Location; me: Profile }> {
  const { loc, me } = await loadAttendee(code);
  if (loc.endedAt || !me) redirect(`/l/${code}`);
  if (me.status !== "live" || needsMatchPrefs(loc, me)) redirect(`/l/${code}/me`);
  return { loc, me };
}

async function requireMatch(code: string, matchId: string): Promise<{ loc: Location; me: Profile; match: Match; other: Profile }> {
  const { loc, me } = await requireLive(code);
  const s = await store();
  const match = await s.getMatch(matchId);
  if (!match || match.locationId !== loc.id || (match.aId !== me.id && match.bId !== me.id)) redirect(`/l/${code}/matches`);
  const other = await s.getProfile(otherId(match, me.id));
  if (!other || !(await canInteract(loc, me, other))) redirect(`/l/${code}/matches`);
  return { loc, me, match, other };
}

export type SwipeResult =
  | { ok: true; matched: false }
  | { ok: true; matched: true; matchId: string; other: { name: string; photo: string | null } }
  | { ok: false };

export async function swipe(code: string, targetId: string, decision: "like" | "pass"): Promise<SwipeResult> {
  const { loc, me } = await requireLive(code);
  const s = await store();
  const target = await s.getProfile(targetId);
  if (!target || !(await canInteract(loc, me, target))) return { ok: false };

  await s.upsertSwipe({ fromId: me.id, toId: target.id, locationId: loc.id, decision, reported: false, reason: null, createdAt: nowIso() });
  if (decision !== "like") return { ok: true, matched: false };

  const theirs = await s.getSwipe(target.id, me.id);
  if (theirs?.decision !== "like") return { ok: true, matched: false };

  const [aId, bId] = pair(me.id, target.id);
  let match = await s.findMatch(aId, bId);
  if (!match) {
    const now = nowIso();
    // The person who completes the match sees it right away; the other side gets a "new" badge.
    await s.insertMatch({
      id: newId(), locationId: loc.id, aId, bId, createdAt: now,
      aReadAt: aId === me.id ? now : null, bReadAt: bId === me.id ? now : null, lastMessageAt: null,
    });
    match = await s.findMatch(aId, bId);
  }
  return { ok: true, matched: true, matchId: match!.id, other: { name: target.fields.name, photo: target.photo } };
}

/** Puts everyone I passed on back into my deck. */
export async function resetPasses(code: string) {
  const { me } = await requireLive(code);
  await (await store()).deleteSwipesFrom(me.id, "pass");
  redirect(`/l/${code}/people`);
}

async function markRead(match: Match, meId: string) {
  await (await store()).updateMatch(match.id, match.aId === meId ? { aReadAt: nowIso() } : { bReadAt: nowIso() });
}

export async function sendMessage(code: string, matchId: string, kind: MessageKind, body: string): Promise<{ ok: boolean; message?: Message }> {
  const { loc, me, match } = await requireMatch(code, matchId);
  const text = body.trim().slice(0, MESSAGE_MAX_LENGTH);
  if (!text || (kind !== "text" && kind !== "meet")) return { ok: false };
  const message: Message = { id: newId(), matchId: match.id, locationId: loc.id, fromId: me.id, kind, body: text, createdAt: nowIso() };
  const s = await store();
  await s.insertMessage(message);
  await s.updateMatch(match.id, { lastMessageAt: message.createdAt, ...(match.aId === me.id ? { aReadAt: message.createdAt } : { bReadAt: message.createdAt }) });
  return { ok: true, message };
}

/** Polled by the chat screen. Returns messages newer than `afterIso` and marks the chat read. */
export async function fetchMessages(code: string, matchId: string, afterIso: string | null): Promise<Message[]> {
  const { me, match } = await requireMatch(code, matchId);
  const messages = await (await store()).listMessages(match.id, afterIso ?? undefined);
  await markRead(match, me.id);
  return messages;
}

/** Polled by the tab bar for the badge on Matches/Connections. */
export async function inboxCount(code: string): Promise<number> {
  const { loc, me } = await loadAttendee(code);
  if (loc.endedAt || !me || me.status !== "live") return 0;
  return (await matchesFor(loc, me)).filter((m) => m.unread).length;
}

export async function unmatch(code: string, matchId: string) {
  const { loc, me, match, other } = await requireMatch(code, matchId);
  const s = await store();
  await s.deleteMatch(match.id);
  await s.upsertSwipe({ fromId: me.id, toId: other.id, locationId: loc.id, decision: "pass", reported: false, reason: null, createdAt: nowIso() });
  redirect(`/l/${code}/matches`);
}

const REASONS = new Set(["inappropriate", "harassment", "fake", "underage", "other"]);

/** Blocks someone (hides both of you from each other) and optionally reports them to the host. */
export async function blockProfile(code: string, targetId: string, formData: FormData) {
  const { loc, me } = await requireLive(code);
  const s = await store();
  const target = await s.getProfile(targetId);
  if (!target || target.locationId !== loc.id || target.id === me.id) redirect(`/l/${code}/people`);
  const reason = String(formData.get("reason") ?? "");
  const reported = REASONS.has(reason);
  await s.upsertSwipe({
    fromId: me.id, toId: target.id, locationId: loc.id, decision: "block", reported, reason: reported ? reason : null, createdAt: nowIso(),
  });
  const [aId, bId] = pair(me.id, target.id);
  const match = await s.findMatch(aId, bId);
  if (match) await s.deleteMatch(match.id);
  redirect(`/l/${code}/matches?blocked=1`);
}
