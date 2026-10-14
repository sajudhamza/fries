"use server";

import { redirect } from "next/navigation";
import { store } from "./store";
import { loadAttendee, nextStep } from "./attendee";
import { extractor } from "./extract";
import { videoStorage, type UploadTarget } from "./video-storage";
import { clearAttendeeSession, setAttendeeSession } from "./session";
import { newId, nowIso } from "./util";
import {
  EMPTY_FIELDS, VIDEO_MAX_BYTES, VIDEO_MAX_SECONDS, VIDEO_MIN_SECONDS,
  type Location, type Profile, type ProfileFields,
} from "./types";

function assertOpen(loc: Location) {
  if (loc.endedAt) redirect(`/l/${loc.code}`);
}

async function requireMe(code: string): Promise<{ loc: Location; me: Profile }> {
  const { loc, me } = await loadAttendee(code);
  assertOpen(loc);
  if (!me) redirect(`/l/${code}`);
  return { loc, me };
}

export async function joinLocation(code: string, formData: FormData) {
  const { loc, me } = await loadAttendee(code);
  assertOpen(loc);
  if (me) redirect(nextStep(code, me));
  if (formData.get("consent") !== "on" || formData.get("adult") !== "on") redirect(`/l/${code}?error=consent`);

  const now = nowIso();
  const profile: Profile = {
    id: newId(),
    locationId: loc.id,
    status: "awaiting_video",
    fields: { ...EMPTY_FIELDS },
    extracted: [],
    photo: null,
    videoKey: null,
    videoSeconds: null,
    consentAt: now,
    createdAt: now,
    updatedAt: now,
  };
  await (await store()).insertProfile(profile);
  setAttendeeSession(code, profile.id, loc.endsAt);
  redirect(`/l/${code}/video`);
}

const EXT: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };

export async function requestUpload(
  code: string,
  meta: { contentType: string; size: number; seconds: number },
): Promise<{ ok: true; target: UploadTarget } | { ok: false; error: string }> {
  const { loc, me } = await requireMe(code);
  const type = meta.contentType.split(";")[0].trim().toLowerCase();
  if (!type.startsWith("video/")) return { ok: false, error: "That file isn't a video." };
  if (meta.size > VIDEO_MAX_BYTES) return { ok: false, error: "That video is too large (max 300 MB)." };
  if (meta.seconds < VIDEO_MIN_SECONDS - 2 || meta.seconds > VIDEO_MAX_SECONDS + 5) {
    return { ok: false, error: "Your intro needs to be between 1 and 5 minutes long." };
  }
  const key = `${loc.id}/${me.id}.${EXT[type] ?? "bin"}`;
  const s = await store();
  if (me.videoKey && me.videoKey !== key) await videoStorage().remove([me.videoKey]);
  await s.updateProfile(me.id, { videoKey: key, videoSeconds: Math.round(meta.seconds), status: "awaiting_video", updatedAt: nowIso() });
  return { ok: true, target: await videoStorage().uploadTarget(key, type) };
}

export async function finishUpload(
  code: string,
  meta: { photo: string | null },
): Promise<{ ok: true; next: string } | { ok: false; error: string }> {
  const { me } = await requireMe(code);
  if (!me.videoKey || !(await videoStorage().exists(me.videoKey))) {
    return { ok: false, error: "We didn't receive your video. Please try again." };
  }
  const photo = meta.photo && meta.photo.startsWith("data:image/jpeg;base64,") && meta.photo.length < 400_000 ? meta.photo : null;
  const s = await store();
  await s.updateProfile(me.id, { status: "processing", photo, updatedAt: nowIso() });

  const found = await extractor().extract({
    videoKey: me.videoKey,
    source: await videoStorage().locate(me.videoKey),
    seconds: me.videoSeconds,
  });
  const extracted = (Object.keys(found) as (keyof ProfileFields)[]).filter((k) => {
    const v = found[k];
    return Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && v !== "";
  });
  await s.updateProfile(me.id, {
    status: "review",
    fields: { ...me.fields, ...found },
    extracted,
    updatedAt: nowIso(),
  });
  return { ok: true, next: `/l/${code}/me` };
}

function clip(v: FormDataEntryValue | null, max: number): string {
  return String(v ?? "").trim().slice(0, max);
}

export async function saveProfile(code: string, formData: FormData) {
  const { me } = await requireMe(code);
  if (me.status === "awaiting_video" || me.status === "processing") redirect(`/l/${code}/video`);
  const ageRaw = Number(clip(formData.get("age"), 3));
  const fields: ProfileFields = {
    name: clip(formData.get("name"), 60),
    age: Number.isInteger(ageRaw) && ageRaw >= 18 && ageRaw < 120 ? ageRaw : null,
    height: clip(formData.get("height"), 20),
    pronouns: clip(formData.get("pronouns"), 30),
    occupation: clip(formData.get("occupation"), 80),
    bio: clip(formData.get("bio"), 600),
    hobbies: clip(formData.get("hobbies"), 400).split(",").map((h) => h.trim()).filter(Boolean).slice(0, 12),
    lookingFor: clip(formData.get("lookingFor"), 300),
  };
  if (!fields.name) redirect(`/l/${code}/me?error=name`);
  const removePhoto = formData.get("removePhoto") === "on";
  await (await store()).updateProfile(me.id, {
    fields,
    status: "live",
    ...(removePhoto ? { photo: null } : {}),
    updatedAt: nowIso(),
  });
  redirect(`/l/${code}/people`);
}

/** Lets an attendee delete their own profile and video immediately, before the event ends. */
export async function leaveLocation(code: string) {
  const { me } = await loadAttendee(code);
  if (me) {
    if (me.videoKey) await videoStorage().remove([me.videoKey]);
    await (await store()).deleteProfile(me.id);
  }
  clearAttendeeSession(code);
  redirect(`/l/${code}?left=1`);
}
