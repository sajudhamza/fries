-- Swiping, matching and chat. Everything cascades from profiles, so it is deleted when an event ends.
-- (The app also applies these idempotently on first use; see ENSURE_SCHEMA in src/lib/db/pg-store.ts.)

create table if not exists swipes (
  from_id uuid not null references profiles(id) on delete cascade,
  to_id uuid not null references profiles(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  decision text not null check (decision in ('like', 'pass', 'block')),
  reported boolean not null default false,
  reason text,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id)
);
create index if not exists swipes_to on swipes (to_id);

create table if not exists matches (
  id uuid primary key,
  location_id uuid not null references locations(id) on delete cascade,
  a_id uuid not null references profiles(id) on delete cascade,
  b_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  a_read_at timestamptz,
  b_read_at timestamptz,
  last_message_at timestamptz,
  unique (a_id, b_id)
);
create index if not exists matches_b on matches (b_id);

create table if not exists messages (
  id uuid primary key,
  match_id uuid not null references matches(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  from_id uuid not null references profiles(id) on delete cascade,
  kind text not null default 'text' check (kind in ('text', 'meet')),
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists messages_match_created on messages (match_id, created_at);

alter table swipes enable row level security;
alter table matches enable row level security;
alter table messages enable row level security;
