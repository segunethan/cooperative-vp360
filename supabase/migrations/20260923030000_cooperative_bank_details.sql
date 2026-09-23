-- The cooperative's own bank account for members to pay their entrance fee
-- into — was missing entirely; the onboarding wizard asked for a receipt
-- without ever telling the member which account to transfer to.
alter table tenants
  add column bank_account_info text;
