-- FRIDA DomainCheck clean Supabase baseline.
--
-- DESTRUCTIVE APP-OWNED REPLACEMENT: before applying this migration to an
-- existing project, export and verify a backup and confirm the Supabase
-- credentials. The list below contains only legacy application tables. This
-- migration never drops auth or other Supabase-managed schemas.

drop table if exists
  public.email_connector_oauth_tokens,
  public.oauth_nonces,
  public.master_data_import_export,
  public.background_job_entries,
  public.scheduled_event_entries,
  public.email_template_export_files,
  public.pk12_certificates,
  public.email_template_smtps,
  public.email_template_languages,
  public.forgot_password_configs,
  public.email_headers,
  public.email_connector_logs,
  public.email_message_attachments,
  public.email_messages,
  public.incoming_email_configs,
  public.outgoing_email_configs,
  public.email_accounts,
  public.oauth_providers,
  public.ldap_configurations,
  public.system_languages,
  public.app_settings,
  public.file_documents,
  public.domain_check_results,
  public.email_queue,
  public.email_templates,
  public.forgot_password_requests,
  public.pgp_certificates,
  public.oauth_tokens,
  public.api_credentials,
  public.activation_requests,
  public.domain_checks,
  public.domain_check_categories,
  public.domain_check_providers,
  public.registration_keys,
  public.users
  cascade;

drop type if exists public.certificate_type;
drop type if exists public.email_status;

create extension if not exists pgcrypto;

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
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  username text unique,
  firstname text,
  lastname text,
  company text,
  role public.user_role not null default 'user',
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

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists providers_set_updated_at on public.domain_check_providers;
create trigger providers_set_updated_at
before update on public.domain_check_providers
for each row execute function public.set_updated_at();

drop trigger if exists categories_set_updated_at on public.domain_check_categories;
create trigger categories_set_updated_at
before update on public.domain_check_categories
for each row execute function public.set_updated_at();

drop trigger if exists domain_checks_set_updated_at on public.domain_checks;
create trigger domain_checks_set_updated_at
before update on public.domain_checks
for each row execute function public.set_updated_at();

create or replace function public.handle_auth_user()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  insert into public.profiles (id, email, firstname, lastname, company, username)
  values (
    new.id,
    lower(new.email),
    nullif(new.raw_user_meta_data ->> 'firstname', ''),
    nullif(new.raw_user_meta_data ->> 'lastname', ''),
    nullif(new.raw_user_meta_data ->> 'company', ''),
    nullif(new.raw_user_meta_data ->> 'username', '')
  )
  on conflict (id) do update set
    email = excluded.email,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email on auth.users
for each row execute function public.handle_auth_user();

create or replace function public.reserve_registration_key(p_code text)
returns jsonb
security definer
set search_path = public
language plpgsql
as $$
declare
  key_row public.registration_keys%rowtype;
begin
  select * into key_row
  from public.registration_keys
  where code = p_code
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'REGISTRATION_KEY_NOT_FOUND';
  end if;
  if not key_row.enabled then
    raise exception using errcode = 'P0001', message = 'REGISTRATION_KEY_DISABLED';
  end if;
  if key_row.expires_at is not null and key_row.expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'REGISTRATION_KEY_EXPIRED';
  end if;
  if key_row.used_count >= key_row.total_slots then
    raise exception using errcode = 'P0001', message = 'REGISTRATION_KEY_EXHAUSTED';
  end if;

  update public.registration_keys
  set used_count = used_count + 1
  where id = key_row.id;

  return jsonb_build_object(
    'id', key_row.id,
    'code', key_row.code,
    'company', key_row.company,
    'company_domain', key_row.company_domain,
    'used_count', key_row.used_count + 1,
    'total_slots', key_row.total_slots
  );
end;
$$;

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
security definer
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
  where id = p_user_id
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

create or replace function public.claim_domain_checks(p_limit integer, p_lease_seconds integer default 45)
returns setof public.domain_checks
security definer
set search_path = public
language plpgsql
as $$
begin
  return query
  with candidates as (
    select id
    from public.domain_checks
    where (
      status = 'queued'
      or (status = 'running' and lease_until is not null and lease_until < now())
    )
    and (next_poll_at is null or next_poll_at <= now())
    order by created_at
    for update skip locked
    limit greatest(p_limit, 1)
  )
  update public.domain_checks checks
  set status = 'running',
      attempt_count = checks.attempt_count + 1,
      lease_until = now() + make_interval(secs => greatest(p_lease_seconds, 10)),
      started_at = coalesce(checks.started_at, now()),
      updated_at = now()
  from candidates
  where checks.id = candidates.id
  returning checks.*;
end;
$$;

alter table public.profiles enable row level security;
alter table public.registration_keys enable row level security;
alter table public.domain_check_providers enable row level security;
alter table public.domain_check_categories enable row level security;

grant select on table public.profiles to authenticated;
grant select on table public.domain_check_providers to authenticated;
grant select on table public.domain_check_categories to authenticated;
grant select on table public.domain_checks to authenticated;
alter table public.domain_checks enable row level security;

create or replace function public.is_admin()
returns boolean
stable
security definer
set search_path = public
language sql
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin on public.profiles
for select using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
for update using (id = auth.uid()) with check (id = auth.uid());

-- A signed-in user can edit profile details, but cannot elevate their role or
-- change quota counters through the public Supabase client. Service-role
-- admin routes retain full access for controlled role changes.
revoke update on table public.profiles from authenticated;
grant update (username, firstname, lastname, company) on table public.profiles to authenticated;

drop policy if exists registration_keys_admin_all on public.registration_keys;
create policy registration_keys_admin_all on public.registration_keys
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists providers_read_authenticated on public.domain_check_providers;
create policy providers_read_authenticated on public.domain_check_providers
for select using (auth.uid() is not null and (is_active or public.is_admin()));

drop policy if exists providers_admin_all on public.domain_check_providers;
create policy providers_admin_all on public.domain_check_providers
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists categories_read_authenticated on public.domain_check_categories;
create policy categories_read_authenticated on public.domain_check_categories
for select using (auth.uid() is not null);

drop policy if exists categories_admin_all on public.domain_check_categories;
create policy categories_admin_all on public.domain_check_categories
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists domain_checks_select_own_or_admin on public.domain_checks;
create policy domain_checks_select_own_or_admin on public.domain_checks
for select using (user_id = auth.uid() or public.is_admin());

insert into public.domain_check_providers (provider_key, name, is_active, description)
values ('cysmo', 'Cysmo', true, 'Cysmo domain security analysis provider')
on conflict (provider_key) do nothing;

insert into public.domain_check_categories (category_key, name, description)
values ('default', 'Domain Security Check', 'Default FRIDA domain security check')
on conflict (category_key) do nothing;

insert into storage.buckets (id, name, public)
values ('catalog-assets', 'catalog-assets', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists catalog_assets_public_read on storage.objects;
create policy catalog_assets_public_read on storage.objects
for select using (bucket_id = 'catalog-assets');

drop policy if exists catalog_assets_admin_insert on storage.objects;
create policy catalog_assets_admin_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'catalog-assets' and public.is_admin());

drop policy if exists catalog_assets_admin_update on storage.objects;
create policy catalog_assets_admin_update on storage.objects
for update to authenticated
using (bucket_id = 'catalog-assets' and public.is_admin())
with check (bucket_id = 'catalog-assets' and public.is_admin());

drop policy if exists catalog_assets_admin_delete on storage.objects;
create policy catalog_assets_admin_delete on storage.objects
for delete to authenticated
using (bucket_id = 'catalog-assets' and public.is_admin());

revoke all on function public.reserve_registration_key(text) from public, anon, authenticated;
grant execute on function public.reserve_registration_key(text) to service_role;
revoke all on function public.create_queued_domain_check(uuid, uuid, uuid, text, boolean, text, integer) from public, anon, authenticated;
grant execute on function public.create_queued_domain_check(uuid, uuid, uuid, text, boolean, text, integer) to service_role;
revoke all on function public.claim_domain_checks(integer, integer) from public, anon, authenticated;
grant execute on function public.claim_domain_checks(integer, integer) to service_role;
