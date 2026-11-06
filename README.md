# Fries for the Table

> The human connection app. Swipe in person™

Location-scoped social profiles. Every **location** (venue or event) gets its own QR code. Guests scan it,
record a 15 to 60 second intro video, and the video is turned into their profile. Guests can only see other guests
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
| `/l/:code/video` | Record in the browser or upload a 15 to 60 second video (direct upload, progress bar) |
| `/l/:code/me` | Review the details extracted from the video, edit, go live, or delete now |
| `/l/:code/people` | Swipe deck: right to like/connect, left to pass (only once your own profile is live) |
| `/l/:code/matches` | Mutual likes, with unread badges; `/l/:code/matches/:id` is the chat (with "Let's meet" spots) |
| `/api/cron/purge` | `Authorization: Bearer $CRON_SECRET`; ends every event past its end time |

## How the pieces fit

```
src/lib/
  types.ts          Location (the QR bucket) and Profile
  store.ts          file store (.data/db.json) or Postgres when DATABASE_URL is set (db/pg-store.ts)
  video-storage.ts  local disk or private Supabase Storage bucket; browser uploads directly via signed URL
  worker.ts         dispatches videos to the self-hosted profile worker (worker/); results land in processing.ts
  lifecycle.ts      endEvent / purgeExpired: deletes every video + profile in a location
  session.ts        HMAC-signed cookies: admin, and one attendee cookie per location (path-scoped)
  admin-actions.ts  create / edit / end / delete locations
  join-actions.ts   join, upload, finish (extract), save profile, leave
```

**Deletion guarantees.** Each event's end time is enforced three ways: lazily on every public page load,
when the admin console loads, and by `/api/cron/purge` (schedule it every 5 minutes in production). Attendees can
also delete their own profile and video at any time from `/l/:code/me`.

**Swiping, matching, chat.** Every event type uses the same deck; matchmaking says Like/Pass and
"It's a match!", business and social say Connect/Skip. A mutual like creates a match and opens a one-to-one
chat (polled every 2.5s) with a "Let's meet" card for a spot at the venue. Guests can unmatch or block and
report; blocks hide both people from each other everywhere, and reports are flagged to the host, who can remove
a guest from the admin page. Swipes, matches and messages cascade from profiles, so they are deleted with them.

**Bucket isolation.** An attendee's cookie is scoped to one location's path and names one profile. Every
profile read checks `profile.locationId === location.id`; a profile from another location returns 404.

## Video → profile extraction (self-hosted)

Extraction runs on our own worker in [`worker/`](worker/README.md), with open-source models only:
faster-whisper for speech-to-text, rules for age/height/pronouns, and a local Qwen3.5-2B (llama.cpp) for
job, hobbies, bio and what they're looking for, with a check that drops anything the person didn't say.

The worker is an AWS Lambda container function invoked asynchronously after upload; it posts results to
`/api/worker/result` (authenticated with a per-job token) while the guest's phone polls. Fields from the
video are labelled on the review form. With no worker configured, or if it fails or takes over 8 minutes,
the guest fills the form by hand. Transcripts are deleted with the profile.

## Production (Supabase + Amplify)

1. Run `supabase/migrations/*.sql` in the Supabase SQL editor, and set `DATABASE_URL` to the transaction pooler URL.
2. Create a **private** Storage bucket `intro-videos`, and set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
3. Set `NEXT_PUBLIC_APP_URL` to the public domain (it is baked into printed QR codes; don't change it later).
4. Schedule `GET /api/cron/purge` every 5 minutes.

## Dev helper

`node scripts/create-location.mjs "Name" "Venue" 6` adds a location ending in 6 hours to the local file store.

## Brand

Built on the Fries for the Table brand deck: Heritage Green `#1E3A2B` on Cream `#F3EAD7` / Ivory `#FBF6EB`,
with Sand `#CDB28C`, Brass `#A97A3F` and Tomato `#B4432F`, plus the green/cream checkerboard. Type is Caprasimo
(logo/display, Cooper-style), Libre Caslon Text (editorial serif and small caps), DM Sans (UI) and Allison
(the "Swipe in person" script). Tokens live in `tailwind.config.ts` and `src/app/globals.css`; the logo
lockup, wordmark and app icon are components in `src/components/ui.tsx`. To use the official logo artwork
instead of the typeset version, export it from Canva as SVG into `public/brand/` and swap it into `LogoLockup`.
