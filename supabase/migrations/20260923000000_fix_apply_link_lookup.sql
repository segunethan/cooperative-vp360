-- The get_tenant_public_info RPC required status = 'ACTIVE', but nothing in
-- the app ever transitions a tenant to that status (create_tenant() leaves it
-- at its default 'PENDING_EMAIL_VERIFICATION') — so every real cooperative's
-- /apply/:slug link was silently 404ing with "Cooperative not found." A
-- tenant existing with a matching slug is sufficient; no status gate needed.
create or replace function get_tenant_public_info(p_slug text)
returns table (id uuid, name text, logo_url text)
language sql
security definer
stable
as $$
  select id, name, logo_url from tenants
  where slug = p_slug;
$$;

-- Belt-and-suspenders: this is the first RPC ever called by a logged-out
-- (anon) visitor rather than an authenticated session, so make sure the
-- anon role explicitly has execute rights on it regardless of default
-- privilege configuration.
grant execute on function get_tenant_public_info(text) to anon, authenticated;
grant insert on member_applications to anon, authenticated;
