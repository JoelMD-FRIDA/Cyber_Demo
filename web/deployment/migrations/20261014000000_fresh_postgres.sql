-- Fresh empty PostgreSQL only. Invoked solely by the locked migration runner.
do $$
begin
  create type public.user_role as enum ('admin', 'user');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.domain_check_status as enum ('queued', 'running', 'completed', 'partial', 'failed');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  username text unique,
  firstname text,
  lastname text,
  company text,
  role public.user_role not null default 'user',
  enabled boolean not null default true,
  performed_domain_checks integer not null default 0 check (performed_domain_checks >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.registration_keys (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  company_domain text,
  total_slots integer not null check (total_slots > 0),
  company text,
  used_count integer not null default 0 check (used_count >= 0),
  enabled boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint registration_keys_used_count_lte_slots check (used_count <= total_slots)
);

create table if not exists public.domain_check_providers (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null unique,
  name text not null,
  is_active boolean not null default true,
  website_url text,
  description text,
  short_description text,
  long_description text,
  asset_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.domain_check_categories (
  id uuid primary key default gen_random_uuid(),
  category_key text not null unique,
  name text not null,
  description text,
  asset_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.domain_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider_id uuid not null references public.domain_check_providers(id) on delete restrict,
  category_id uuid not null references public.domain_check_categories(id) on delete restrict,
  url text not null,
  status public.domain_check_status not null default 'queued',
  raw_result jsonb,
  structured_result jsonb,
  external_job_id text,
  external_report_id text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_poll_at timestamptz,
  lease_until timestamptz,
  claim_token uuid,
  submission_started boolean not null default false,
  last_error_code text,
  last_error_message text,
  has_accepted_disclaimer boolean not null default false,
  disclaimer_accepted_at timestamptz,
  disclaimer_version text,
  remaining_domain_checks integer not null default 0,
  max_checks integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists domain_checks_user_created_idx
  on public.domain_checks (user_id, created_at desc);
create index if not exists domain_checks_processing_idx
  on public.domain_checks (status, next_poll_at, lease_until);
create index if not exists domain_checks_provider_category_idx
  on public.domain_checks (provider_id, category_id);


create table public.oidc_identities (
 issuer text not null, subject text not null, profile_id uuid not null references public.profiles(id),
 primary key (issuer,subject), unique (profile_id)
);
create table public.app_sessions (
 id_hash text primary key, profile_id uuid not null references public.profiles(id),
 csrf_hash text not null, expires_at timestamptz not null
);
create table public.oidc_transactions (
 id_hash text primary key, state_hash text not null unique, encrypted text not null,
 return_path text not null, expires_at timestamptz not null
);
create table public.app_maintenance (id boolean primary key default true check (id), active boolean not null default false);
insert into public.app_maintenance (id,active) values(true,false);
insert into public.domain_check_providers(provider_key,name,is_active,description) values
 ('cysmo','Cysmo',true,'Domain security analysis'),('panta','PANTA',true,'Contact breach query');
insert into public.domain_check_categories(category_key,name,description) values
 ('default','Domain Security Check','Domain security check');
create or replace function public.create_queued_domain_check(
  p_user_id uuid,
  p_provider_id uuid,
  p_category_id uuid,
  p_url text,
  p_has_accepted_disclaimer boolean,
  p_disclaimer_version text,
  p_limit integer
)
returns setof public.domain_checks
set search_path = public
language plpgsql
as $$
declare
  profile_row public.profiles%rowtype;
  provider_row public.domain_check_providers%rowtype;
  category_row public.domain_check_categories%rowtype;
  inserted_row public.domain_checks%rowtype;
begin
  if p_limit < 1 then
    raise exception using errcode = 'P0001', message = 'INVALID_QUOTA_LIMIT';
  end if;

  select * into profile_row
  from public.profiles
  where id = p_user_id and enabled
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'PROFILE_NOT_FOUND';
  end if;
  if profile_row.performed_domain_checks >= p_limit then
    raise exception using errcode = 'P0001', message = 'CHECK_LIMIT_EXCEEDED';
  end if;
  if not p_has_accepted_disclaimer then
    raise exception using errcode = 'P0001', message = 'DISCLAIMER_REQUIRED';
  end if;

  select * into provider_row
  from public.domain_check_providers
  where id = p_provider_id and is_active = true;
  if not found then
    raise exception using errcode = 'P0001', message = 'PROVIDER_NOT_FOUND';
  end if;

  select * into category_row
  from public.domain_check_categories
  where id = p_category_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'CATEGORY_NOT_FOUND';
  end if;

  update public.profiles
  set performed_domain_checks = performed_domain_checks + 1
  where id = p_user_id;

  insert into public.domain_checks (
    user_id, provider_id, category_id, url, status,
    has_accepted_disclaimer, disclaimer_accepted_at, disclaimer_version,
    remaining_domain_checks, max_checks
  ) values (
    p_user_id, p_provider_id, p_category_id, p_url, 'queued',
    p_has_accepted_disclaimer,
    case when p_has_accepted_disclaimer then now() else null end,
    p_disclaimer_version,
    greatest(p_limit - profile_row.performed_domain_checks - 1, 0),
    p_limit
  )
  returning * into inserted_row;

  return next inserted_row;
end;
$$;


create function public.claim_domain_check(p_check_id uuid default null, p_lease_seconds integer default 120)
returns setof public.domain_checks language plpgsql as $$
begin
 -- A timed-out submission without a recorded job ID is ambiguous. Never submit it twice.
 update public.domain_checks set status='failed',last_error_code='PROVIDER_SUBMISSION_UNKNOWN',
   last_error_message='The provider submission needs review.',completed_at=now(),lease_until=null,claim_token=null
 where status='running' and lease_until<now() and submission_started and external_job_id is null;
 return query with candidate as (
  select id from public.domain_checks
  where (p_check_id is null or id=p_check_id)
   and (status='queued' or (status='running' and lease_until<now() and (not submission_started or external_job_id is not null)))
   and (next_poll_at is null or next_poll_at<=now())
  order by created_at for update skip locked limit 1
 ) update public.domain_checks c set status='running',attempt_count=c.attempt_count+1,
   lease_until=now()+make_interval(secs=>120),claim_token=gen_random_uuid(),
   started_at=coalesce(c.started_at,now()),updated_at=now()
 from candidate where c.id=candidate.id returning c.*;
end $$;
revoke all on schema public from public;
revoke all on all tables in schema public from public;
revoke all on all functions in schema public from public;
