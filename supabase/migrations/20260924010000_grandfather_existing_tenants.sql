-- The new KYB gate blocks member invites until tenants.status = 'ACTIVE'.
-- No code path has ever actually set that status though — create_tenant()
-- leaves every cooperative at the column default (PENDING_EMAIL_VERIFICATION)
-- forever — so every cooperative that signed up before the KYB feature
-- shipped would otherwise be locked out of a flow they were already using.
-- Grandfather them in: anything that never went through the new KYB
-- submission flow (kyb_submitted_at is null) is, by definition, a
-- pre-existing cooperative and should keep working as before.
update tenants
set status = 'ACTIVE', updated_at = now()
where kyb_submitted_at is null
  and status not in ('ACTIVE', 'SUSPENDED');
