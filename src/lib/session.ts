/**
 * HMAC-signed cookies. No user accounts: an attendee's identity is the signed cookie their phone got
 * when they joined a location, and it is scoped to that one location.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s === "change-me") {
    if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set");
    return "dev-only-secret";
  }
  return s;
}

export function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function verify(value: string, sig: string): boolean {
  const a = Buffer.from(sign(value));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

function seal(payload: object): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function unseal<T>(token: string | undefined): T | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig || !verify(body, sig)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString()) as T & { exp: number };
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

const secure = process.env.NODE_ENV === "production";

// --- admin ------------------------------------------------------------------------------------

const ADMIN_COOKIE = "pda_admin";

export function setAdminSession() {
  const exp = Date.now() + 12 * 3600_000;
  cookies().set(ADMIN_COOKIE, seal({ admin: true, exp }), {
    httpOnly: true, sameSite: "lax", secure, path: "/", expires: new Date(exp),
  });
}

export function clearAdminSession() {
  cookies().delete(ADMIN_COOKIE);
}

export function isAdmin(): boolean {
  return unseal<{ admin: boolean }>(cookies().get(ADMIN_COOKIE)?.value)?.admin === true;
}

// --- attendee (one cookie per location) ---------------------------------------------------------

const attendeeCookie = (code: string) => `pda_l_${code}`;

export function setAttendeeSession(code: string, profileId: string, endsAt: string) {
  // Never outlive the event (plus a small grace so the "event ended" page still recognises them).
  const exp = Math.max(Date.now() + 60_000, new Date(endsAt).getTime() + 3600_000);
  cookies().set(attendeeCookie(code), seal({ pid: profileId, exp }), {
    httpOnly: true, sameSite: "lax", secure, path: `/l/${code}`, expires: new Date(exp),
  });
}

export function attendeeProfileId(code: string): string | null {
  return unseal<{ pid: string }>(cookies().get(attendeeCookie(code))?.value)?.pid ?? null;
}

export function clearAttendeeSession(code: string) {
  cookies().set(attendeeCookie(code), "", { path: `/l/${code}`, maxAge: 0 });
}
