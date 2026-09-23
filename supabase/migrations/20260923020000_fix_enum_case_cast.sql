-- Postgres resolves `CASE WHEN x THEN 'A' ELSE 'B' END` (all-literal branches)
-- to type `text`, not to the target enum type, unless one branch already has
-- a definite type. Assigning that straight into an enum column then fails
-- with "column is of type X but expression is of type text" (42804). Fixes
-- the two RPCs written this session with this exact pattern by casting the
-- CASE result to the correct enum type explicitly.

create or replace function review_kyc_submission(
  p_submission_id uuid, p_approve boolean, p_reviewer uuid, p_rejection_reason text
)
returns void
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := get_tenant_id();
  v_member_id uuid;
begin
  if v_tenant_id is null then
    raise exception 'not authorized';
  end if;

  select member_id into v_member_id from member_kyc_submissions
  where id = p_submission_id and tenant_id = v_tenant_id
  for update;

  if not found then
    raise exception 'submission not found';
  end if;

  update member_kyc_submissions
  set status = (case when p_approve then 'APPROVED' else 'REJECTED' end)::kyc_status,
      rejection_reason = case when p_approve then null else p_rejection_reason end,
      reviewed_by = p_reviewer,
      reviewed_at = now(),
      updated_at = now()
  where id = p_submission_id;

  if p_approve then
    update members
    set kyc_verified = true, kyc_verified_at = now(), updated_at = now()
    where id = v_member_id;
  end if;
end;
$$;

create or replace function review_loan_topup(p_request_id uuid, p_approve boolean, p_reviewer uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid := get_tenant_id();
begin
  if v_tenant_id is null then
    raise exception 'not authorized';
  end if;

  update loan_topup_requests
  set status = (case when p_approve then 'APPROVED' else 'REJECTED' end)::request_status,
      reviewed_by = p_reviewer,
      reviewed_at = now()
  where id = p_request_id and tenant_id = v_tenant_id and status = 'PENDING';

  if not found then
    raise exception 'request not found or already reviewed';
  end if;
end;
$$;
