-- Register the PANTA CYBER breach-query provider.
-- The API key remains a server-only environment variable and is never stored here.
insert into public.domain_check_providers (provider_key, name, is_active, description)
values ('panta', 'PANTA CYBER', true, 'PANTA CYBER data-breach query provider')
on conflict (provider_key) do nothing;
