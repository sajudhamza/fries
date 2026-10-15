/**
 * Persistence. Two interchangeable backends behind one interface:
 *  - FileStore: a JSON file in .data/ for local development (no setup).
 *  - PgStore:   Supabase Postgres when DATABASE_URL is set (tables in supabase/migrations).
 */
import fs from "node:fs";
import path from "node:path";
import { EMPTY_FIELDS, type Location, type Profile, type ProfileStatus } from "./types";

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
}

// ---------------------------------------------------------------------------------------------
// File store (dev)

interface FileDb {
  locations: Location[];
  profiles: Profile[];
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");

function readDb(): FileDb {
  try {
    const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8")) as FileDb;
    for (const l of db.locations) l.eventType ??= "social";
    for (const p of db.profiles) p.fields = { ...EMPTY_FIELDS, ...p.fields };
    return db;
  } catch {
    return { locations: [], profiles: [] };
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
    });
  },
  async deleteProfilesForLocation(locationId) {
    mutate((db) => {
      db.profiles = db.profiles.filter((p) => p.locationId !== locationId);
    });
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
