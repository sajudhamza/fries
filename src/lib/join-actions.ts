"use server";

import { redirect } from "next/navigation";
import { store } from "./store";
import { loadAttendee, nextStep } from "./attendee";
import { completeProcessing } from "./processing";
import { dispatchProfileJob, WORKER_TIMEOUT_MS } from "./worker";
import { videoStorage, type UploadTarget } from "./video-storage";
import { clearAttendeeSession, setAttendeeSession } from "./session";
import { newId, nowIso } from "./util";
import {
  EMPTY_FIELDS, GENDERS, INTERESTS, VIDEO_MAX_BYTES, VIDEO_MAX_SECONDS, VIDEO_MIN_SECONDS,
  type Gender, type Interest, type Location, type Profile, type ProfileFields,
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
    transcript: null,
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
  if (meta.size > VIDEO_MAX_BYTES) return { ok: false, error: "That video file is too large. Try a shorter clip." };
  if (meta.seconds < VIDEO_MIN_SECONDS - 1 || meta.seconds > VIDEO_MAX_SECONDS + 3) {
    return { ok: false, error: `Your intro needs to be between ${VIDEO_MIN_SECONDS} and ${VIDEO_MAX_SECONDS} seconds long.` };
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
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { loc, me } = await requireMe(code);
  if (!me.videoKey || !(await videoStorage().exists(me.videoKey))) {
    return { ok: false, error: "We didn't receive your video. Please try again." };
  }
  const photo = meta.photo && meta.photo.startsWith("data:image/jpeg;base64,") && meta.photo.length < 400_000 ? meta.photo : null;
  const s = await store();
  await s.updateProfile(me.id, { status: "processing", photo, transcript: null, updatedAt: nowIso() });

  const updated = { ...me, status: "processing" as const, photo, transcript: null };
  let dispatched = false;
  try {
    dispatched = await dispatchProfileJob(updated, loc);
  } catch (e) {
    console.error(`[finishUpload] could not start the profile worker for ${me.id}:`, e);
  }
  // No worker configured or it couldn't be reached: go straight to the form, filled by hand.
  if (!dispatched) await completeProcessing(updated, {}, null);
  return { ok: true };
}

/**
 * Polled by the browser while the worker builds the profile. Once the worker reports back the
 * profile is in "review". If it never does, the guest is moved on to fill the form by hand.
 */
export async function checkProcessing(code: string): Promise<{ done: false } | { done: true; next: string }> {
  const { me } = await requireMe(code);
  if (me.status !== "processing") return { done: true, next: nextStep(code, me) };
  if (Date.now() - new Date(me.updatedAt).getTime() > WORKER_TIMEOUT_MS) {
    console.warn(`[checkProcessing] worker timed out for ${me.id}; falling back to manual form`);
    await completeProcessing(me, {}, null);
    return { done: true, next: `/l/${code}/me` };
  }
  return { done: false };
}

function clip(v: FormDataEntryValue | null, max: number): string {
  return String(v ?? "").trim().slice(0, max);
}

export async function saveProfile(code: string, formData: FormData) {
  const { loc, me } = await requireMe(code);
  if (me.status === "awaiting_video" || me.status === "processing") redirect(`/l/${code}/video`);
  const gender = String(formData.get("gender") ?? "");
  const interestedIn = String(formData.get("interestedIn") ?? "");
  const matchmaking = loc.eventType === "matchmaking";
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
    // Only stored for matchmaking events; other event types never ask.
    gender: matchmaking && gender in GENDERS ? (gender as Gender) : "",
    interestedIn: matchmaking && interestedIn in INTERESTS ? (interestedIn as Interest) : "",
  };
  if (!fields.name) redirect(`/l/${code}/me?error=name`);
  if (matchmaking && (!fields.gender || !fields.interestedIn)) redirect(`/l/${code}/me?error=prefs`);
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
