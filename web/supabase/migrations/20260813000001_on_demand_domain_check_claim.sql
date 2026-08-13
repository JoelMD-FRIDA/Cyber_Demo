-- Allow the active results page to advance its own persisted check when no
-- external scheduler is configured (for example, on Vercel Hobby).
create or replace function public.claim_domain_check(
  p_check_id uuid,
  p_lease_seconds integer default 45
)
returns setof public.domain_checks
security definer
set search_path = public
language plpgsql
as $$
begin
  return query
  with candidate as (
    select id
    from public.domain_checks
    where id = p_check_id
      and (
        status = 'queued'
        or (status = 'running' and lease_until is not null and lease_until < now())
      )
      and (next_poll_at is null or next_poll_at <= now())
    for update skip locked
  )
  update public.domain_checks checks
  set status = 'running',
      attempt_count = checks.attempt_count + 1,
      lease_until = now() + make_interval(secs => greatest(p_lease_seconds, 10)),
      started_at = coalesce(checks.started_at, now()),
      updated_at = now()
  from candidate
  where checks.id = candidate.id
  returning checks.*;
end;
$$;

revoke all on function public.claim_domain_check(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_domain_check(uuid, integer) to service_role;
