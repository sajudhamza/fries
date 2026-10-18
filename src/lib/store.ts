/**
 * Persistence. Two interchangeable backends behind one interface:
 *  - FileStore: a JSON file in .data/ for local development (no setup).
 *  - PgStore:   Supabase Postgres when DATABASE_URL is set (tables in supabase/migrations).
 */
import fs from "node:fs";
import path from "node:path";
import {
  EMPTY_FIELDS, type Location, type Match, type Message, type Profile, type ProfileStatus, type Swipe, type SwipeDecision,
} from "./types";

export interface Store {
  listLocations(): Promise<Location[]>;
  getLocation(id: string): Promise<Location | null>;
  getLocationByCode(code: string): Promise<Location | null>;
  insertLocation(loc: Location): Promise<void>;
  updateLocation(id: string, patch: Partial<Omit<Location, "id" | "code">>): Promise<void>;
  deleteLocation(id: string): Promise<void>;

  getProfile(id: string): Promise<Profile | null>;
  listProfiles(locationId: string, status?: ProfileStatus): Promise<Profile[]>;
  countProfiles(): Promise<Record<string, Record<ProfileStatus, number>>>;
  insertProfile(p: Profile): Promise<void>;
  updateProfile(id: string, patch: Partial<Omit<Profile, "id" | "locationId">>): Promise<void>;
  deleteProfile(id: string): Promise<void>;
  deleteProfilesForLocation(locationId: string): Promise<void>;

  // Swipes, matches and chat. All of it is deleted with the profiles (on event end or leave).
  listSwipesInvolving(profileId: string): Promise<Swipe[]>;
  getSwipe(fromId: string, toId: string): Promise<Swipe | null>;
  upsertSwipe(s: Swipe): Promise<void>;
  deleteSwipesFrom(fromId: string, decision: SwipeDecision): Promise<void>;

  getMatch(id: string): Promise<Match | null>;
  findMatch(aId: string, bId: string): Promise<Match | null>;
  listMatchesFor(profileId: string): Promise<Match[]>;
  insertMatch(m: Match): Promise<void>;
  updateMatch(id: string, patch: Partial<Pick<Match, "aReadAt" | "bReadAt" | "lastMessageAt">>): Promise<void>;
  deleteMatch(id: string): Promise<void>;

  listMessages(matchId: string, afterIso?: string): Promise<Message[]>;
  lastMessages(matchIds: string[]): Promise<Record<string, Message>>;
  insertMessage(m: Message): Promise<void>;

  socialStats(locationId: string): Promise<{ likes: number; matches: number; messages: number; reported: string[] }>;
}

// ---------------------------------------------------------------------------------------------
// File store (dev)

interface FileDb {
  locations: Location[];
  profiles: Profile[];
  swipes: Swipe[];
  matches: Match[];
  messages: Message[];
}

/** Mirrors the ON DELETE CASCADE foreign keys of the Postgres schema. */
function cascadeProfiles(db: FileDb) {
  const alive = new Set(db.profiles.map((p) => p.id));
  db.swipes = db.swipes.filter((s) => alive.has(s.fromId) && alive.has(s.toId));
  db.matches = db.matches.filter((m) => alive.has(m.aId) && alive.has(m.bId));
  const matches = new Set(db.matches.map((m) => m.id));
  db.messages = db.messages.filter((m) => matches.has(m.matchId) && alive.has(m.fromId));
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");

function readDb(): FileDb {
  try {
    const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8")) as FileDb;
    db.swipes ??= [];
    db.matches ??= [];
    db.messages ??= [];
    for (const l of db.locations) l.eventType ??= "social";
    for (const p of db.profiles) p.fields = { ...EMPTY_FIELDS, ...p.fields };
    return db;
  } catch {
    return { locations: [], profiles: [], swipes: [], matches: [], messages: [] };
  }
}

function writeDb(db: FileDb) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

function mutate(fn: (db: FileDb) => void) {
  const db = readDb();
  fn(db);
  writeDb(db);
}

const fileStore: Store = {
  async listLocations() {
    return readDb().locations.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async getLocation(id) {
    return readDb().locations.find((l) => l.id === id) ?? null;
  },
  async getLocationByCode(code) {
    return readDb().locations.find((l) => l.code === code) ?? null;
  },
  async insertLocation(loc) {
    mutate((db) => void db.locations.push(loc));
  },
  async updateLocation(id, patch) {
    mutate((db) => {
      const l = db.locations.find((x) => x.id === id);
      if (l) Object.assign(l, patch);
    });
  },
  async deleteLocation(id) {
    mutate((db) => {
      db.locations = db.locations.filter((l) => l.id !== id);
      db.profiles = db.profiles.filter((p) => p.locationId !== id);
      cascadeProfiles(db);
    });
  },
  async getProfile(id) {
    return readDb().profiles.find((p) => p.id === id) ?? null;
  },
  async listProfiles(locationId, status) {
    return readDb()
      .profiles.filter((p) => p.locationId === locationId && (!status || p.status === status))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async countProfiles() {
    const out: Record<string, Record<ProfileStatus, number>> = {};
    for (const p of readDb().profiles) {
      out[p.locationId] ??= { awaiting_video: 0, processing: 0, review: 0, live: 0 };
      out[p.locationId][p.status]++;
    }
    return out;
  },
  async insertProfile(p) {
    mutate((db) => void db.profiles.push(p));
  },
  async updateProfile(id, patch) {
    mutate((db) => {
      const p = db.profiles.find((x) => x.id === id);
      if (p) Object.assign(p, patch);
    });
  },
  async deleteProfile(id) {
    mutate((db) => {
      db.profiles = db.profiles.filter((p) => p.id !== id);
      cascadeProfiles(db);
    });
  },
  async deleteProfilesForLocation(locationId) {
    mutate((db) => {
      db.profiles = db.profiles.filter((p) => p.locationId !== locationId);
      cascadeProfiles(db);
    });
  },

  async listSwipesInvolving(profileId) {
    return readDb().swipes.filter((s) => s.fromId === profileId || s.toId === profileId);
  },
  async getSwipe(fromId, toId) {
    return readDb().swipes.find((s) => s.fromId === fromId && s.toId === toId) ?? null;
  },
  async upsertSwipe(s) {
    mutate((db) => {
      db.swipes = db.swipes.filter((x) => !(x.fromId === s.fromId && x.toId === s.toId));
      db.swipes.push(s);
    });
  },
  async deleteSwipesFrom(fromId, decision) {
    mutate((db) => {
      db.swipes = db.swipes.filter((s) => !(s.fromId === fromId && s.decision === decision));
    });
  },

  async getMatch(id) {
    return readDb().matches.find((m) => m.id === id) ?? null;
  },
  async findMatch(aId, bId) {
    return readDb().matches.find((m) => m.aId === aId && m.bId === bId) ?? null;
  },
  async listMatchesFor(profileId) {
    return readDb()
      .matches.filter((m) => m.aId === profileId || m.bId === profileId)
      .sort((a, b) => (b.lastMessageAt ?? b.createdAt).localeCompare(a.lastMessageAt ?? a.createdAt));
  },
  async insertMatch(m) {
    mutate((db) => {
      if (!db.matches.some((x) => x.aId === m.aId && x.bId === m.bId)) db.matches.push(m);
    });
  },
  async updateMatch(id, patch) {
    mutate((db) => {
      const m = db.matches.find((x) => x.id === id);
      if (m) Object.assign(m, patch);
    });
  },
  async deleteMatch(id) {
    mutate((db) => {
      db.matches = db.matches.filter((m) => m.id !== id);
      db.messages = db.messages.filter((m) => m.matchId !== id);
    });
  },

  async listMessages(matchId, afterIso) {
    return readDb()
      .messages.filter((m) => m.matchId === matchId && (!afterIso || m.createdAt > afterIso))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },
  async lastMessages(matchIds) {
    const out: Record<string, Message> = {};
    for (const m of readDb().messages) {
      if (matchIds.includes(m.matchId) && (!out[m.matchId] || m.createdAt > out[m.matchId].createdAt)) out[m.matchId] = m;
    }
    return out;
  },
  async insertMessage(m) {
    mutate((db) => void db.messages.push(m));
  },

  async socialStats(locationId) {
    const db = readDb();
    const swipes = db.swipes.filter((s) => s.locationId === locationId);
    return {
      likes: swipes.filter((s) => s.decision === "like").length,
      matches: db.matches.filter((m) => m.locationId === locationId).length,
      messages: db.messages.filter((m) => m.locationId === locationId).length,
      reported: Array.from(new Set(swipes.filter((s) => s.reported).map((s) => s.toId))),
    };
  },
};

// ---------------------------------------------------------------------------------------------

let cached: Store | null = null;

export async function store(): Promise<Store> {
  if (cached) return cached;
  if (process.env.DATABASE_URL) {
    const { pgStore } = await import("./db/pg-store");
    cached = pgStore;
  } else {
    if (process.env.NODE_ENV === "production" && !process.env.FRIES_ALLOW_FILE_STORE) {
      throw new Error("DATABASE_URL is not set. The local file store only works in development.");
    }
    cached = fileStore;
  }
  return cached;
}
