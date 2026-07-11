-- Members can read their own record (linked via auth_user_id)
create policy "members_self_select" on members
  for select using (auth_user_id = auth.uid());

-- Members can read their own contributions
create policy "contributions_self_select" on contributions
  for select using (
    member_id in (select id from members where auth_user_id = auth.uid())
  );

-- Members can read their own loans
create policy "loans_self_select" on loans
  for select using (
    member_id in (select id from members where auth_user_id = auth.uid())
  );

-- Members can read announcements from their cooperative
create policy "announcements_member_select" on announcements
  for select using (
    tenant_id in (select tenant_id from members where auth_user_id = auth.uid())
  );
