create table if not exists public.google_lookup_quota (
  period_type text not null check (period_type in ('day', 'month')),
  period_start date not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (period_type, period_start)
);

create table if not exists public.business_lookup_cache (
  lookup_key text primary key,
  payload jsonb not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.google_lookup_quota enable row level security;
alter table public.business_lookup_cache enable row level security;
revoke all on public.google_lookup_quota from anon, authenticated;
revoke all on public.business_lookup_cache from anon, authenticated;

drop function if exists public.claim_google_lookup(integer, integer);

create or replace function public.claim_google_lookup() returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  today_count integer;
  month_count integer;
  today_start date := current_date;
  month_start date := date_trunc('month', current_date)::date;
begin
  insert into google_lookup_quota(period_type, period_start, request_count)
    values ('day', today_start, 0), ('month', month_start, 0)
    on conflict do nothing;

  select request_count into today_count from google_lookup_quota
    where period_type = 'day' and period_start = today_start for update;
  select request_count into month_count from google_lookup_quota
    where period_type = 'month' and period_start = month_start for update;

  if today_count >= 25 or month_count >= 850 then
    return false;
  end if;

  update google_lookup_quota set request_count = request_count + 1
    where (period_type = 'day' and period_start = today_start)
       or (period_type = 'month' and period_start = month_start);
  return true;
end;
$$;

create or replace function public.get_business_lookup_cache(requested_key text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select payload from business_lookup_cache
  where lookup_key = left(requested_key, 240) and expires_at > now()
  limit 1;
$$;

create or replace function public.store_business_lookup_cache(requested_key text, requested_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if length(requested_key) > 240 or pg_column_size(requested_payload) > 65536 then
    raise exception 'Invalid cache payload';
  end if;
  insert into business_lookup_cache(lookup_key, payload, expires_at, updated_at)
    values (requested_key, requested_payload, now() + interval '29 days', now())
  on conflict (lookup_key) do update
    set payload = excluded.payload, expires_at = excluded.expires_at, updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.claim_google_lookup() from public, authenticated;
revoke all on function public.get_business_lookup_cache(text) from public, authenticated;
revoke all on function public.store_business_lookup_cache(text, jsonb) from public, authenticated;
grant execute on function public.claim_google_lookup() to anon, service_role;
grant execute on function public.get_business_lookup_cache(text) to anon, service_role;
grant execute on function public.store_business_lookup_cache(text, jsonb) to anon, service_role;
