import { randomBytes } from "node:crypto";

// Crockford-style alphabet: no 0/O/1/I/L, so codes survive being read aloud or typed from a poster.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function randomCode(len = 10): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function isEnded(loc: { endsAt: string; endedAt: string | null }, now = Date.now()): boolean {
  return loc.endedAt !== null || new Date(loc.endsAt).getTime() <= now;
}

export function locationState(l: { startsAt: string | null; endsAt: string; endedAt: string | null }): "live" | "scheduled" | "ended" {
  if (isEnded(l)) return "ended";
  if (l.startsAt && new Date(l.startsAt).getTime() > Date.now()) return "scheduled";
  return "live";
}
