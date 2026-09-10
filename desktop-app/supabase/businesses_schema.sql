-- Optional: run this once in your Supabase project's SQL editor to enable
-- cross-device sync for BrightSite Studio (see lib/supabase-sync.js).
-- Not required — the app works entirely on local files without it.
-- Safe to run against the same project as the old wellnessweb-tracker;
-- this creates a new table and does not touch salon_tracker.

create table if not exists businesses (
  id text primary key,        -- project slug
  name text,
  data jsonb not null,        -- the full project record (same shape as data.json)
  updated_at timestamptz not null default now()
);

alter table businesses enable row level security;

-- Matches the tracker's existing pattern: the publishable anon key can
-- read/write freely. Fine for a personal single-user tool; tighten this
-- if the key is ever shared beyond your own devices.
create policy "anon read" on businesses for select using (true);
create policy "anon write" on businesses for insert with check (true);
create policy "anon update" on businesses for update using (true);

-- To enable, set these two environment variables before `npm start` /
-- `npm run server` (e.g. in a local .env you don't commit):
--   SUPABASE_URL=https://<your-project>.supabase.co
--   SUPABASE_ANON_KEY=<your publishable anon key>
