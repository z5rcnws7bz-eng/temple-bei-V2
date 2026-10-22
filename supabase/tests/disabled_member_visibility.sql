do $$
declare
 admin_id text:='00000000-0000-4000-8000-000000000971';
 officer_id text:='00000000-0000-4000-8000-000000000972';
 member_id text:='00000000-0000-4000-8000-000000000973';
 archived_id text:='00000000-0000-4000-8000-000000000974';
 result jsonb;
begin
 begin
 if has_function_privilege('anon','public.portal_set_member_disabled(text,boolean)','execute') then raise exception 'Anonymous toggle allowed'; end if;
 insert into auth.users(id,email,email_confirmed_at,aud,role,raw_user_meta_data,raw_app_meta_data)
 select id::uuid,id||'@example.invalid',now(),'authenticated','authenticated',jsonb_build_object('name','Disabled test'),case when id=admin_id then '{"portal_role":"admin"}'::jsonb else '{}'::jsonb end
 from unnest(array[admin_id,officer_id,member_id,archived_id]) id;
 update public.profiles set eboard=1 where id=officer_id;
 update public.profiles set disabled=1,deleted_at=now() where id=archived_id;
 perform set_config('request.jwt.claim.sub',officer_id,true);
 perform public.portal_set_member_disabled(member_id,true);
 result:=public.portal_directory(member_id)->'member';
 if result->>'disabled'<>'true' then raise exception 'Disabled profile missing status'; end if;
 if not exists(select 1 from jsonb_array_elements(public.portal_directory()->'members') m where m->>'id'=member_id and (m->>'disabled')::boolean) then raise exception 'Disabled member missing from directory'; end if;
 if exists(select 1 from jsonb_array_elements(public.portal_directory()->'members') m where m->>'id'=archived_id) then raise exception 'Archived account visible'; end if;
 if not exists(select 1 from jsonb_array_elements(public.portal_admin_members()->'members') m where m->>'id'=member_id and (m->>'disabled')::boolean) then raise exception 'Officer cannot find disabled member to re-enable'; end if;
 begin perform public.portal_set_member_disabled(admin_id,true);raise exception 'Officer changed administrator access';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',member_id,true);
 begin perform public.portal_request('state');raise exception 'Disabled account accessed portal';exception when insufficient_privilege then null;end;
 begin perform public.portal_set_member_disabled(officer_id,true);raise exception 'Disabled account managed members';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',officer_id,true);
 perform public.portal_set_member_disabled(member_id,false);
 perform set_config('request.jwt.claim.sub',member_id,true);
 if public.portal_request('state')->'user'->>'id'<>member_id then raise exception 'Re-enabled account did not regain access'; end if;
 if (public.portal_directory(member_id)->'member'->>'disabled')::boolean then raise exception 'Re-enabled profile still disabled'; end if;
 begin perform public.portal_set_member_disabled(officer_id,true);raise exception 'Ordinary member managed access';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',admin_id,true);
 perform public.portal_set_member_disabled(officer_id,true);
 perform public.portal_set_member_disabled(officer_id,false);
 begin perform public.portal_set_member_disabled(archived_id,false);raise exception 'Archived account restored';exception when raise_exception then if sqlerrm<>'Member not found.' then raise;end if;end;
 begin perform public.portal_set_member_disabled(admin_id,true);raise exception 'Admin disabled self';exception when raise_exception then if sqlerrm<>'You cannot change your own membership access.' then raise;end if;end;
 raise exception using errcode='PZ001',message='Rollback fixture';
 exception when sqlstate 'PZ001' then null;
 end;
end $$;
select 'PASS: disabled directory/detail status, deleted exclusion, officer/admin disable and re-enable, access restored, disabled/ordinary/anonymous and admin protections; fixtures rolled back' as result;
