/**
 * Postgres backend (Supabase). DATABASE_URL should be the transaction pooler URL (port 6543).
 * The app talks to Postgres only from the server with its own role; the tables have RLS enabled
 * with no public policies, so the Supabase anon key can never read profiles.
 */
import { Pool } from "pg";
import { EMPTY_FIELDS, type Location, type Profile, type ProfileStatus } from "../types";
import type { Store } from "../store";

const g = globalThis as unknown as { __friesPool?: Pool };

function pool(): Pool {
  if (!g.__friesPool) {
    const url = process.env.DATABASE_URL!;
    const local = /localhost|127\.0\.0\.1/.test(url);
    g.__friesPool = new Pool({
      connectionString: url,
      max: Number(process.env.DATABASE_POOL_MAX ?? 3),
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      ssl: local ? undefined : { rejectUnauthorized: false },
    });
  }
  return g.__friesPool;
}

// Additive, idempotent schema changes applied on first use, so a deploy never runs ahead of the
// database. They mirror supabase/migrations; anything destructive belongs there, not here.
const ENSURE_SCHEMA = [
  "alter table profiles add column if not exists transcript text",
  "alter table locations add column if not exists event_type text not null default 'social'",
];
let schemaReady: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  schemaReady ??= (async () => {
    for (const sql of ENSURE_SCHEMA) await pool().query(sql);
  })().catch((e) => {
    schemaReady = null;
    throw e;
  });
  return schemaReady;
}

const q = async (text: string, params: unknown[] = []) => {
  await ensureSchema();
  return pool().query(text, params);
};
const iso = (d: Date | null) => (d ? d.toISOString() : null);

/* eslint-disable @typescript-eslint/no-explicit-any */
function toLocation(r: any): Location {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    venue: r.venue,
    eventType: r.event_type ?? "social",
    startsAt: iso(r.starts_at),
    endsAt: iso(r.ends_at)!,
    endedAt: iso(r.ended_at),
    createdAt: iso(r.created_at)!,
  };
}

function toProfile(r: any): Profile {
  return {
    id: r.id,
    locationId: r.location_id,
    status: r.status,
    fields: { ...EMPTY_FIELDS, ...r.fields },
    extracted: r.extracted,
    photo: r.photo,
    videoKey: r.video_key,
    videoSeconds: r.video_seconds,
    transcript: r.transcript ?? null,
    consentAt: iso(r.consent_at)!,
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!,
  };
}

const LOC_COLS: Record<string, string> = {
  name: "name", venue: "venue", eventType: "event_type", startsAt: "starts_at", endsAt: "ends_at", endedAt: "ended_at", createdAt: "created_at",
};
const PROF_COLS: Record<string, string> = {
  status: "status", fields: "fields", extracted: "extracted", photo: "photo", videoKey: "video_key",
  videoSeconds: "video_seconds", transcript: "transcript", consentAt: "consent_at", createdAt: "created_at", updatedAt: "updated_at",
};
const JSON_COLS = new Set(["fields", "extracted"]);

async function update(table: string, cols: Record<string, string>, id: string, patch: Record<string, unknown>) {
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    const col = cols[k];
    if (!col || v === undefined) continue;
    vals.push(JSON_COLS.has(k) ? JSON.stringify(v) : v);
    sets.push(`${col} = $${vals.length}`);
  }
  if (!sets.length) return;
  vals.push(id);
  await q(`update ${table} set ${sets.join(", ")} where id = $${vals.length}`, vals);
}

export const pgStore: Store = {
  async listLocations() {
    return (await q("select * from locations order by created_at desc")).rows.map(toLocation);
  },
  async getLocation(id) {
    const r = (await q("select * from locations where id = $1", [id])).rows[0];
    return r ? toLocation(r) : null;
  },
  async getLocationByCode(code) {
    const r = (await q("select * from locations where code = $1", [code])).rows[0];
    return r ? toLocation(r) : null;
  },
  async insertLocation(l) {
    await q(
      "insert into locations (id, code, name, venue, event_type, starts_at, ends_at, ended_at, created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [l.id, l.code, l.name, l.venue, l.eventType, l.startsAt, l.endsAt, l.endedAt, l.createdAt],
    );
  },
  async updateLocation(id, patch) {
    await update("locations", LOC_COLS, id, patch);
  },
  async deleteLocation(id) {
    await q("delete from locations where id = $1", [id]); // profiles cascade
  },
  async getProfile(id) {
    const r = (await q("select * from profiles where id = $1", [id])).rows[0];
    return r ? toProfile(r) : null;
  },
  async listProfiles(locationId, status) {
    const r = status
      ? await q("select * from profiles where location_id = $1 and status = $2 order by updated_at desc", [locationId, status])
      : await q("select * from profiles where location_id = $1 order by updated_at desc", [locationId]);
    return r.rows.map(toProfile);
  },
  async countProfiles() {
    const out: Record<string, Record<ProfileStatus, number>> = {};
    for (const r of (await q("select location_id, status, count(*)::int as n from profiles group by 1, 2")).rows) {
      out[r.location_id] ??= { awaiting_video: 0, processing: 0, review: 0, live: 0 };
      out[r.location_id][r.status as ProfileStatus] = r.n;
    }
    return out;
  },
  async insertProfile(p) {
    await q(
      `insert into profiles (id, location_id, status, fields, extracted, photo, video_key, video_seconds, consent_at, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [p.id, p.locationId, p.status, JSON.stringify(p.fields), JSON.stringify(p.extracted), p.photo, p.videoKey,
        p.videoSeconds, p.consentAt, p.createdAt, p.updatedAt],
    );
  },
  async updateProfile(id, patch) {
    await update("profiles", PROF_COLS, id, patch);
  },
  async deleteProfile(id) {
    await q("delete from profiles where id = $1", [id]);
  },
  async deleteProfilesForLocation(locationId) {
    await q("delete from profiles where location_id = $1", [locationId]);
  },
};

/** Used by /api/health to spot migrations that haven't been run yet. */
export async function columnExists(table: string, column: string): Promise<boolean> {
  const r = await q(
    "select 1 from information_schema.columns where table_schema = 'public' and table_name = $1 and column_name = $2",
    [table, column],
  );
  return (r.rowCount ?? 0) > 0;
}
