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

create or replace function public.claim_google_lookup(
  daily_limit integer default 25,
  monthly_limit integer default 850
) returns boolean
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

  if today_count >= daily_limit or month_count >= monthly_limit then
    return false;
  end if;

  update google_lookup_quota set request_count = request_count + 1
    where (period_type = 'day' and period_start = today_start)
       or (period_type = 'month' and period_start = month_start);
  return true;
end;
$$;

revoke all on function public.claim_google_lookup(integer, integer) from public, anon, authenticated;
grant execute on function public.claim_google_lookup(integer, integer) to service_role;
