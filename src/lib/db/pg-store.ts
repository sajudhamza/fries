/**
 * Postgres backend (Supabase). DATABASE_URL should be the transaction pooler URL (port 6543).
 * The app talks to Postgres only from the server with its own role; the tables have RLS enabled
 * with no public policies, so the Supabase anon key can never read profiles.
 */
import { Pool } from "pg";
import { EMPTY_FIELDS, type Location, type Match, type Message, type Profile, type ProfileStatus, type Swipe } from "../types";
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
  `create table if not exists swipes (
     from_id uuid not null references profiles(id) on delete cascade,
     to_id uuid not null references profiles(id) on delete cascade,
     location_id uuid not null references locations(id) on delete cascade,
     decision text not null check (decision in ('like', 'pass', 'block')),
     reported boolean not null default false,
     reason text,
     created_at timestamptz not null default now(),
     primary key (from_id, to_id))`,
  "create index if not exists swipes_to on swipes (to_id)",
  `create table if not exists matches (
     id uuid primary key,
     location_id uuid not null references locations(id) on delete cascade,
     a_id uuid not null references profiles(id) on delete cascade,
     b_id uuid not null references profiles(id) on delete cascade,
     created_at timestamptz not null default now(),
     a_read_at timestamptz,
     b_read_at timestamptz,
     last_message_at timestamptz,
     unique (a_id, b_id))`,
  "create index if not exists matches_b on matches (b_id)",
  `create table if not exists messages (
     id uuid primary key,
     match_id uuid not null references matches(id) on delete cascade,
     location_id uuid not null references locations(id) on delete cascade,
     from_id uuid not null references profiles(id) on delete cascade,
     kind text not null default 'text' check (kind in ('text', 'meet')),
     body text not null,
     created_at timestamptz not null default now())`,
  "create index if not exists messages_match_created on messages (match_id, created_at)",
  "alter table swipes enable row level security",
  "alter table matches enable row level security",
  "alter table messages enable row level security",
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

function toSwipe(r: any): Swipe {
  return {
    fromId: r.from_id, toId: r.to_id, locationId: r.location_id, decision: r.decision,
    reported: r.reported, reason: r.reason, createdAt: iso(r.created_at)!,
  };
}

function toMatch(r: any): Match {
  return {
    id: r.id, locationId: r.location_id, aId: r.a_id, bId: r.b_id, createdAt: iso(r.created_at)!,
    aReadAt: iso(r.a_read_at), bReadAt: iso(r.b_read_at), lastMessageAt: iso(r.last_message_at),
  };
}

function toMessage(r: any): Message {
  return {
    id: r.id, matchId: r.match_id, locationId: r.location_id, fromId: r.from_id, kind: r.kind, body: r.body,
    createdAt: iso(r.created_at)!,
  };
}

const MATCH_COLS: Record<string, string> = { aReadAt: "a_read_at", bReadAt: "b_read_at", lastMessageAt: "last_message_at" };

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

  async listSwipesInvolving(profileId) {
    return (await q("select * from swipes where from_id = $1 or to_id = $1", [profileId])).rows.map(toSwipe);
  },
  async getSwipe(fromId, toId) {
    const r = (await q("select * from swipes where from_id = $1 and to_id = $2", [fromId, toId])).rows[0];
    return r ? toSwipe(r) : null;
  },
  async upsertSwipe(s) {
    await q(
      `insert into swipes (from_id, to_id, location_id, decision, reported, reason, created_at) values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (from_id, to_id) do update set decision = excluded.decision, reported = excluded.reported,
         reason = excluded.reason, created_at = excluded.created_at`,
      [s.fromId, s.toId, s.locationId, s.decision, s.reported, s.reason, s.createdAt],
    );
  },
  async deleteSwipesFrom(fromId, decision) {
    await q("delete from swipes where from_id = $1 and decision = $2", [fromId, decision]);
  },

  async getMatch(id) {
    const r = (await q("select * from matches where id = $1", [id])).rows[0];
    return r ? toMatch(r) : null;
  },
  async findMatch(aId, bId) {
    const r = (await q("select * from matches where a_id = $1 and b_id = $2", [aId, bId])).rows[0];
    return r ? toMatch(r) : null;
  },
  async listMatchesFor(profileId) {
    const r = await q(
      "select * from matches where a_id = $1 or b_id = $1 order by coalesce(last_message_at, created_at) desc",
      [profileId],
    );
    return r.rows.map(toMatch);
  },
  async insertMatch(m) {
    await q(
      `insert into matches (id, location_id, a_id, b_id, created_at, a_read_at, b_read_at, last_message_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8) on conflict (a_id, b_id) do nothing`,
      [m.id, m.locationId, m.aId, m.bId, m.createdAt, m.aReadAt, m.bReadAt, m.lastMessageAt],
    );
  },
  async updateMatch(id, patch) {
    await update("matches", MATCH_COLS, id, patch);
  },
  async deleteMatch(id) {
    await q("delete from matches where id = $1", [id]); // messages cascade
  },

  async listMessages(matchId, afterIso) {
    const r = afterIso
      ? await q("select * from messages where match_id = $1 and created_at > $2 order by created_at", [matchId, afterIso])
      : await q("select * from messages where match_id = $1 order by created_at", [matchId]);
    return r.rows.map(toMessage);
  },
  async lastMessages(matchIds) {
    if (!matchIds.length) return {};
    const r = await q(
      "select distinct on (match_id) * from messages where match_id = any($1::uuid[]) order by match_id, created_at desc",
      [matchIds],
    );
    return Object.fromEntries(r.rows.map((row) => [row.match_id, toMessage(row)]));
  },
  async insertMessage(m) {
    await q(
      "insert into messages (id, match_id, location_id, from_id, kind, body, created_at) values ($1,$2,$3,$4,$5,$6,$7)",
      [m.id, m.matchId, m.locationId, m.fromId, m.kind, m.body, m.createdAt],
    );
  },

  async socialStats(locationId) {
    const [likes, matches, messages, reported] = await Promise.all([
      q("select count(*)::int as n from swipes where location_id = $1 and decision = 'like'", [locationId]),
      q("select count(*)::int as n from matches where location_id = $1", [locationId]),
      q("select count(*)::int as n from messages where location_id = $1", [locationId]),
      q("select distinct to_id from swipes where location_id = $1 and reported", [locationId]),
    ]);
    return {
      likes: likes.rows[0].n, matches: matches.rows[0].n, messages: messages.rows[0].n,
      reported: reported.rows.map((r) => r.to_id),
    };
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
