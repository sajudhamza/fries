-- Speech-to-text of each intro video, used to build the profile. Deleted together with the profile.
alter table profiles add column if not exists transcript text;
