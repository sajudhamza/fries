-- PDA web: QR-scoped locations and the attendee profiles created from intro videos.

create table if not exists locations (
  id          uuid primary key,
  code        text not null unique,
  name        text not null,
  venue       text not null default '',
  starts_at   timestamptz,
  ends_at     timestamptz not null,
  ended_at    timestamptz,
  created_at  timestamptz not null default now()
);

create table if not exists profiles (
  id             uuid primary key,
  location_id    uuid not null references locations(id) on delete cascade,
  status         text not null check (status in ('awaiting_video', 'processing', 'review', 'live')),
  fields         jsonb not null,
  extracted      jsonb not null default '[]',
  photo          text,
  video_key      text,
  video_seconds  integer,
  consent_at     timestamptz not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists profiles_location_status on profiles (location_id, status);
create index if not exists locations_open_ends_at on locations (ends_at) where ended_at is null;

-- Only the app server (direct Postgres connection) touches these tables. RLS on with no policies
-- means the Supabase anon/authenticated API roles get nothing.
alter table locations enable row level security;
alter table profiles  enable row level security;
