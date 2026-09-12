-- "Demo opened" tracking for BrightSite Studio. Run once in the Supabase
-- SQL editor (same project as businesses_schema.sql). Until it's run, live
-- sites' view counter and Studio's "Demo opened" line quietly do nothing.
--
-- Every live site made with Studio adds one row here when a visitor opens
-- it (our own opens are skipped — see viewBeaconScript in
-- lib/supabase-sync.js). Rows hold only the site's slug and a time.

create table if not exists demo_views (
  id bigint generated always as identity primary key,
  slug text not null,
  viewed_at timestamptz not null default now()
);

create index if not exists demo_views_slug_time on demo_views (slug, viewed_at desc);

alter table demo_views enable row level security;

create policy "anon read views" on demo_views for select using (true);
create policy "anon record view" on demo_views for insert with check (length(slug) <= 100);
