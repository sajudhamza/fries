"use server";

import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { store } from "./store";
import { endEvent } from "./lifecycle";
import { clearAdminSession, isAdmin, setAdminSession } from "./session";
import { newId, nowIso, randomCode } from "./util";
import { EVENT_TYPES, type EventType } from "./types";

function requireAdmin() {
  if (!isAdmin()) redirect("/admin/login");
}

export async function login(formData: FormData) {
  // Trim both sides: values pasted into a hosting console or the form often pick up stray spaces/newlines.
  const given = Buffer.from(String(formData.get("password") ?? "").trim());
  const expected = Buffer.from((process.env.ADMIN_PASSWORD ?? "").trim());
  if (!expected.length || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    redirect("/admin/login?error=1");
  }
  setAdminSession();
  redirect("/admin");
}

export async function logout() {
  clearAdminSession();
  redirect("/admin/login");
}

function readEventType(formData: FormData): EventType | null {
  const v = String(formData.get("eventType") ?? "");
  return v in EVENT_TYPES ? (v as EventType) : null;
}

function readIso(formData: FormData, key: string): string | null {
  const v = String(formData.get(key) ?? "").trim();
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function createLocation(formData: FormData) {
  requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const venue = String(formData.get("venue") ?? "").trim();
  const startsAt = readIso(formData, "startsAt");
  const endsAt = readIso(formData, "endsAt");
  const eventType = readEventType(formData);
  if (!name || !endsAt || !eventType) redirect("/admin?error=missing");
  if (new Date(endsAt).getTime() <= Date.now()) redirect("/admin?error=past");

  const s = await store();
  const id = newId();
  let code = randomCode();
  while (await s.getLocationByCode(code)) code = randomCode();
  await s.insertLocation({ id, code, name, venue, eventType, startsAt, endsAt, endedAt: null, createdAt: nowIso() });
  redirect(`/admin/locations/${id}`);
}

export async function updateLocation(id: string, formData: FormData) {
  requireAdmin();
  const s = await store();
  const loc = await s.getLocation(id);
  if (!loc) redirect("/admin");
  const name = String(formData.get("name") ?? "").trim() || loc.name;
  const venue = String(formData.get("venue") ?? "").trim();
  const startsAt = readIso(formData, "startsAt");
  const endsAt = readIso(formData, "endsAt") ?? loc.endsAt;
  const eventType = readEventType(formData) ?? loc.eventType;
  const reopen = loc.endedAt !== null && new Date(endsAt).getTime() > Date.now();
  await s.updateLocation(id, { name, venue, eventType, startsAt, endsAt, ...(reopen ? { endedAt: null } : {}) });
  revalidatePath(`/admin/locations/${id}`);
  redirect(`/admin/locations/${id}?saved=1`);
}

export async function endEventNow(id: string) {
  requireAdmin();
  const { profiles, videos } = await endEvent(id);
  redirect(`/admin/locations/${id}?purged=${profiles}-${videos}`);
}

export async function deleteLocation(id: string) {
  requireAdmin();
  await endEvent(id);
  await (await store()).deleteLocation(id);
  redirect("/admin");
}
