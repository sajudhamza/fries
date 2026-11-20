-- Timed caption cues for each intro video ([{start, end, text}]), shown over the video on profiles.
-- Deleted together with the profile when the event ends.
alter table profiles add column if not exists captions jsonb;
