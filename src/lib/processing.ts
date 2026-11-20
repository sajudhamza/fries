import { store } from "./store";
import { nowIso } from "./util";
import { GENDERS, INTERESTS, type Caption, type Gender, type Interest, type Profile, type ProfileFields } from "./types";

/** Merges extracted fields into a profile and moves it to review. Empty values are ignored. */
export async function completeProcessing(
  me: Profile, found: Partial<ProfileFields>, transcript: string | null, captions: Caption[] | null = null,
) {
  const extracted = (Object.keys(found) as (keyof ProfileFields)[]).filter((k) => {
    const v = found[k];
    return Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && v !== "";
  });
  const fields = { ...me.fields };
  for (const k of extracted) (fields as Record<string, unknown>)[k] = found[k];
  await (await store()).updateProfile(me.id, { status: "review", fields, extracted, transcript, captions, updatedAt: nowIso() });
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Validates whatever the worker sent back; never trust its shape. */
export function sanitizeFields(raw: unknown): Partial<ProfileFields> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const age = typeof r.age === "number" && Number.isInteger(r.age) && r.age >= 18 && r.age < 120 ? r.age : null;
  return {
    name: str(r.name, 60),
    age,
    height: str(r.height, 20),
    pronouns: str(r.pronouns, 30),
    occupation: str(r.occupation, 80),
    bio: str(r.bio, 600),
    hobbies: Array.isArray(r.hobbies) ? r.hobbies.map((h) => str(h, 40)).filter(Boolean).slice(0, 8) : [],
    lookingFor: str(r.lookingFor, 300),
    gender: typeof r.gender === "string" && r.gender in GENDERS ? (r.gender as Gender) : "",
    interestedIn: typeof r.interestedIn === "string" && r.interestedIn in INTERESTS ? (r.interestedIn as Interest) : "",
  };
}

/** Validates caption cues from the worker: ordered, finite, short, within a 60-second-ish video. */
export function sanitizeCaptions(raw: unknown): Caption[] | null {
  if (!Array.isArray(raw)) return null;
  const out: Caption[] = [];
  for (const c of raw.slice(0, 200)) {
    if (!c || typeof c !== "object") continue;
    const { start, end, text } = c as Record<string, unknown>;
    if (typeof start !== "number" || typeof end !== "number" || !Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (start < 0 || end <= start || end > 600) continue;
    const t = typeof text === "string" ? text.replace(/\s+/g, " ").trim().slice(0, 200) : "";
    if (t) out.push({ start: Math.round(start * 100) / 100, end: Math.round(end * 100) / 100, text: t });
  }
  out.sort((a, b) => a.start - b.start);
  return out.length ? out : null;
}
