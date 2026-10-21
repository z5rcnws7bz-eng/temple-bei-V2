-- Exercise the actual Data API roles, not just UI visibility. All fixtures roll back.
begin;
insert into auth.users(id,email,email_confirmed_at,aud,role,raw_user_meta_data,raw_app_meta_data) values
('00000000-0000-4000-8000-000000000881','training-member-one@example.invalid',now(),'authenticated','authenticated','{"name":"Training Member One","admin":true,"portal_role":"admin"}','{}'),
('00000000-0000-4000-8000-000000000882','training-member-two@example.invalid',now(),'authenticated','authenticated','{"name":"Training Member Two"}','{}'),
('00000000-0000-4000-8000-000000000883','training-board@example.invalid',now(),'authenticated','authenticated','{"name":"Training Board"}','{}'),
('00000000-0000-4000-8000-000000000884','training-admin@example.invalid',now(),'authenticated','authenticated','{"name":"Training Admin"}','{"portal_role":"admin"}');
update public.profiles set eboard=1 where id='00000000-0000-4000-8000-000000000883';
insert into public.portal_training(id,title,body,author_id) values('visibility-training-a','QA visibility A','A','00000000-0000-4000-8000-000000000883'),('visibility-training-b','QA visibility B','B','00000000-0000-4000-8000-000000000883');
set local role authenticated;
do $$
declare data jsonb; item jsonb; person text; expected text; count_seen int;
begin
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000881',true);
 perform public.portal_operations('training/complete','{"id":"visibility-training-a","version":1,"owner":"00000000-0000-4000-8000-000000000882"}');
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000882',true);
 perform public.portal_operations('training/complete','{"id":"visibility-training-b","version":1}');
 foreach person in array array['00000000-0000-4000-8000-000000000881','00000000-0000-4000-8000-000000000882'] loop
 perform set_config('request.jwt.claim.sub',person,true);
 data:=public.portal_operations('data',jsonb_build_object('owner','00000000-0000-4000-8000-000000000883','admin',true,'role','admin'));
 if jsonb_array_length(data->'progress')<>0 then raise exception 'General member obtained completion roster';end if;
 expected:=case when person like '%881' then 'visibility-training-a' else 'visibility-training-b' end;
 for item in select value from jsonb_array_elements(data->'training') where value->>'id' in ('visibility-training-a','visibility-training-b') loop
 if (item->>'completed_at' is not null) is distinct from (item->>'id'=expected) then raise exception 'Member completion leaked or own completion missing';end if;
 end loop;
 begin perform public.portal_operations('training/save','{"title":"Forged","body":"Must fail"}');raise exception 'Member edited training';exception when insufficient_privilege then null;end;
 end loop;
 foreach person in array array['00000000-0000-4000-8000-000000000883','00000000-0000-4000-8000-000000000884'] loop
 perform set_config('request.jwt.claim.sub',person,true);
 data:=public.portal_operations('data');
 select count(*) into count_seen from jsonb_array_elements(data->'progress') where value->>'training_id' in ('visibility-training-a','visibility-training-b');
 if count_seen<>2 then raise exception 'Admin or E-board cannot see both members';end if;
 if not exists(select 1 from jsonb_array_elements(data->'progress') where value->>'owner'='00000000-0000-4000-8000-000000000881' and value->>'training_id'='visibility-training-a') then raise exception 'Completion owner forged';end if;
 end loop;
 if has_table_privilege('authenticated','public.portal_training_progress','select') or has_table_privilege('anon','public.portal_training_progress','select') then raise exception 'Completion table directly exposed';end if;
 begin perform 1 from public.portal_training_progress limit 1;raise exception 'Direct completion read succeeded';exception when insufficient_privilege then null;end;
end $$;
reset role;
-- Permission changes must take effect immediately, without refreshing JWT claims.
update public.profiles set eboard=0 where id='00000000-0000-4000-8000-000000000883';
update public.profiles set disabled=1 where id='00000000-0000-4000-8000-000000000884';
set local role authenticated;
do $$ declare data jsonb;begin
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000883',true);
 data:=public.portal_operations('data');if jsonb_array_length(data->'progress')<>0 then raise exception 'Revoked E-board retained roster access';end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000884',true);
 begin perform public.portal_operations('data');raise exception 'Disabled admin retained access';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role anon;
do $$ begin
 perform set_config('request.jwt.claim.sub','',true);
 begin perform public.portal_operations('data');raise exception 'Anonymous completion access';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
select 'PASS: members only see own completion; admin and E-board see both members; forged owner/role metadata, direct table access, revoked/disabled access and anonymous access denied; fixtures rolled back' result;
