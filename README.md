# Fries

Location-scoped social profiles. Every **location** (venue or event) gets its own QR code. Guests scan it,
record a 1 to 5 minute intro video, and the video is turned into their profile. Guests can only see other guests
who joined through **the same QR code**, and every profile and video in a location is deleted when its event ends.

## Quick start

```bash
npm install
cp .env.example .env.local   # set SESSION_SECRET, ADMIN_PASSWORD, CRON_SECRET
npm run dev                  # http://localhost:3000/admin
```

To scan the QR from your phone during development, set `NEXT_PUBLIC_APP_URL=http://<your-LAN-IP>:3000`.
Camera recording needs HTTPS on phones (localhost is exempt); the upload-a-file option works over plain HTTP.

## Routes

| URL | What |
| --- | --- |
| `/admin` | Central console: add a location, see its status and live profile count |
| `/admin/locations/:id` | QR code (PNG/SVG download, printable poster), attendees, edit end time, end event now, delete |
| `/l/:code` | What the QR opens: event intro + consent (18+, processing, deletion at event end) |
| `/l/:code/video` | Record in the browser or upload a 1 to 5 min video (direct upload, progress bar) |
| `/l/:code/me` | Review the details extracted from the video, edit, go live, or delete now |
| `/l/:code/people` | Everyone live at this location (only visible once your own profile is live) |
| `/api/cron/purge` | `Authorization: Bearer $CRON_SECRET`; ends every event past its end time |

## How the pieces fit

```
src/lib/
  types.ts          Location (the QR bucket) and Profile
  store.ts          file store (.data/db.json) or Postgres when DATABASE_URL is set (db/pg-store.ts)
  video-storage.ts  local disk or private Supabase Storage bucket; browser uploads directly via signed URL
  extract.ts        VIDEO -> PROFILE seam (manual for now; plug transcription + LLM extraction in here)
  lifecycle.ts      endEvent / purgeExpired: deletes every video + profile in a location
  session.ts        HMAC-signed cookies: admin, and one attendee cookie per location (path-scoped)
  admin-actions.ts  create / edit / end / delete locations
  join-actions.ts   join, upload, finish (extract), save profile, leave
```

**Deletion guarantees.** Each event's end time is enforced three ways: lazily on every public page load,
when the admin console loads, and by `/api/cron/purge` (schedule it every 5 minutes in production). Attendees can
also delete their own profile and video at any time from `/l/:code/me`.

**Bucket isolation.** An attendee's cookie is scoped to one location's path and names one profile. Every
profile read checks `profile.locationId === location.id`; a profile from another location returns 404.

## Production (Supabase + Amplify)

1. Run `supabase/migrations/*.sql` in the Supabase SQL editor, and set `DATABASE_URL` to the transaction pooler URL.
2. Create a **private** Storage bucket `intro-videos`, and set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
3. Set `NEXT_PUBLIC_APP_URL` to the public domain (it is baked into printed QR codes; don't change it later).
4. Schedule `GET /api/cron/purge` every 5 minutes.

## Dev helper

`node scripts/create-location.mjs "Name" "Venue" 6` adds a location ending in 6 hours to the local file store.
