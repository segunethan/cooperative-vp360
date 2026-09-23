-- Match the public application form to the same fields "Add Member" already
-- collects, instead of a stripped-down subset (name/email/phone/about).
alter table member_applications
  add column first_name text,
  add column last_name text,
  add column gender text,
  add column date_of_birth date,
  add column address text,
  add column occupation text;

update member_applications set first_name = split_part(full_name, ' ', 1) where first_name is null;
update member_applications set last_name = coalesce(nullif(substring(full_name from position(' ' in full_name) + 1), ''), first_name) where last_name is null;
update member_applications set phone = 'N/A' where phone is null;

alter table member_applications
  alter column first_name set not null,
  alter column last_name set not null,
  alter column phone set not null,
  drop column full_name,
  drop column about;
