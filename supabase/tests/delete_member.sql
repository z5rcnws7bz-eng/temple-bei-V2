-- Run as database owner in SQL Editor. The sentinel exception rolls every
-- fixture change back; no real account is targeted and no mail is sent.
do $$
declare t text:='00000000-0000-4000-8000-000000000901'; a text:='4c502ace-898d-4eeb-bdec-5ebb21e2dc57'; result jsonb;
begin
 begin
  insert into auth.users(id,email,email_confirmed_at,aud,role,raw_user_meta_data,raw_app_meta_data)
  values(t::uuid,'delete-fixture@example.invalid',now(),'authenticated','authenticated','{"name":"Deletion Test"}','{}');
  insert into public.hours(id,owner,payload) values('delete-fixture-hours',t,'{"hours":2,"status":"Approved"}');
  insert into public.shifts(id,payload,capacity,taken) values('delete-fixture-shift','{}',5,1);
  insert into public.bookings(id,shift_id,owner) values('delete-fixture-booking','delete-fixture-shift',t);
  perform set_config('request.jwt.claim.sub',t,true);
  begin
   perform public.portal_delete_member(a,'jace.roman@temple.edu');
   raise exception 'FAIL: non-admin deletion succeeded';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',a,true);
  begin
   perform public.portal_delete_member(a,'jace.roman@temple.edu');
   raise exception 'FAIL: self-deletion succeeded';
  exception when raise_exception then
   if sqlerrm<>'You cannot delete your own administrator account.' then raise; end if;
  end;
  begin
   perform public.portal_delete_member(t,'wrong@example.invalid');
   raise exception 'FAIL: wrong confirmation succeeded';
  exception when raise_exception then
   if sqlerrm<>'Type the member email exactly to confirm deletion.' then raise; end if;
  end;
  result:=public.portal_delete_member(t,'delete-fixture@example.invalid');
  if result->>'ok'<>'true' or exists(select 1 from auth.users where id=t::uuid) then raise exception 'FAIL: Auth account remains'; end if;
  if not exists(select 1 from public.profiles where id=t and deleted_at is not null and disabled=1 and deleted_by=a) then raise exception 'FAIL: profile archive missing'; end if;
  if not exists(select 1 from public.hours where owner=t) or not exists(select 1 from public.bookings where owner=t) then raise exception 'FAIL: linked records removed'; end if;
  if public.portal_admin_members()::text like '%'||t||'%' or public.portal_directory()::text like '%'||t||'%' or public.portal_board_data()::text like '%'||t||'%' then raise exception 'FAIL: deleted account still listed'; end if;
  perform set_config('request.jwt.claim.sub',t,true);
  begin
   perform public.portal_request('state');
   raise exception 'FAIL: deleted account still has access';
  exception when insufficient_privilege then null; end;
  raise exception using errcode='PZ001',message='Rollback successful test fixtures';
 exception when sqlstate 'PZ001' then null;
 end;
end;
$$;
select 'PASS: role checks, confirmation, self-protection, account removal, archive retention, hidden member, revoked access; fixtures rolled back' as deletion_tests;
