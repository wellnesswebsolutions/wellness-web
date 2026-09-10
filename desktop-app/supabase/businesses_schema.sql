-- Shared, no-sign-in sync for BrightSite Studio (see lib/supabase-sync.js).
-- Run this once in your Supabase project's SQL editor, BEFORE you fill in
-- lib/shared-config.js and distribute the packaged app. Optional — the app
-- works entirely on local files without any of this.
--
-- Safe to run against the same project as the old wellnessweb-tracker;
-- this creates a new table + bucket and does not touch salon_tracker.
--
-- IMPORTANT — deliberately open access, by design:
-- This project is meant to be shared across a small team (a college) with
-- NO per-user sign-in. The policies below give the app's bundled anon key
-- unrestricted read/write on this table and this storage bucket. That
-- means anyone who has a copy of the packaged app — or who obtains this
-- anon key some other way — can read and alter every row and every file
-- here. That's the accepted tradeoff for zero-setup shared access; do NOT
-- reuse this anon key for anything that needs real access control, and
-- don't put data here you wouldn't want visible to everyone with the app.

-- ---------------- project data ----------------
create table if not exists businesses (
  id text primary key,        -- project slug
  name text,
  data jsonb not null,        -- the full project record (same shape as data.json)
  updated_at timestamptz not null default now()
);

alter table businesses enable row level security;

create policy "anon read" on businesses for select using (true);
create policy "anon write" on businesses for insert with check (true);
create policy "anon update" on businesses for update using (true);

-- ---------------- project media (logo / hero / gallery) ----------------
insert into storage.buckets (id, name, public)
values ('business-media', 'business-media', true)
on conflict (id) do nothing;

create policy "anon read media" on storage.objects for select
  using (bucket_id = 'business-media');
create policy "anon upload media" on storage.objects for insert
  with check (bucket_id = 'business-media');
create policy "anon update media" on storage.objects for update
  using (bucket_id = 'business-media');

-- ---------------- after running this ----------------
-- 1. Project Settings → API in your Supabase dashboard → copy the Project
--    URL and the "anon" / "publishable" key.
-- 2. Paste them into desktop-app/lib/shared-config.js (SUPABASE_URL,
--    SUPABASE_ANON_KEY).
-- 3. `npm run build` and distribute the packaged app as usual — recipients
--    need to do nothing; every copy talks to this same project already.
--
-- SUPABASE_URL / SUPABASE_ANON_KEY environment variables still override
-- shared-config.js if set, for local development without editing that file.
