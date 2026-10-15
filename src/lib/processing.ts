import { store } from "./store";
import { nowIso } from "./util";
import type { Profile, ProfileFields } from "./types";

/** Merges extracted fields into a profile and moves it to review. Empty values are ignored. */
export async function completeProcessing(me: Profile, found: Partial<ProfileFields>, transcript: string | null) {
  const extracted = (Object.keys(found) as (keyof ProfileFields)[]).filter((k) => {
    const v = found[k];
    return Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && v !== "";
  });
  const fields = { ...me.fields };
  for (const k of extracted) (fields as Record<string, unknown>)[k] = found[k];
  await (await store()).updateProfile(me.id, { status: "review", fields, extracted, transcript, updatedAt: nowIso() });
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
  };
}
