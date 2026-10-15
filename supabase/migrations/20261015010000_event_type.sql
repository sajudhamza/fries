-- Event type decides who sees whom: business and social = everyone, matchmaking = by stated interest.
-- (Profile gender / interestedIn live in profiles.fields jsonb, so no profile column is needed.)
alter table locations add column if not exists event_type text not null default 'social'
  check (event_type in ('business', 'matchmaking', 'social'));
