#!/usr/bin/env node
/**
 * Dev helper: adds a location to the local file store (.data/db.json) without going through /admin.
 *   node scripts/create-location.mjs "Friday Rooftop" "PHD Terrace" 6   # name, venue, hours until end
 */
import fs from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";

const [name = "Test Location", venue = "", hours = "6", eventType = "social"] = process.argv.slice(2);
const file = path.join(process.cwd(), ".data", "db.json");
const db = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : { locations: [], profiles: [] };
const A = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const code = [...randomBytes(10)].map((b) => A[b % A.length]).join("");
const now = new Date();
db.locations.push({
  id: randomUUID(), code, name, venue, eventType, startsAt: now.toISOString(),
  endsAt: new Date(now.getTime() + Number(hours) * 3600_000).toISOString(), endedAt: null, createdAt: now.toISOString(),
});
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, JSON.stringify(db, null, 2));
console.log(`/l/${code}`);
