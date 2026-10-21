do $$
<<audit_test>>
declare admin_id text:='00000000-0000-4000-8000-000000000951'; officer_id text:='00000000-0000-4000-8000-000000000952'; member_id text:='00000000-0000-4000-8000-000000000953'; r jsonb; hour_id text;
begin
 begin
 perform set_config('request.jwt.claim.sub','',true);
 insert into auth.users(id,email,email_confirmed_at,aud,role,raw_user_meta_data,raw_app_meta_data)
 select id::uuid,id||'@example.invalid',now(),'authenticated','authenticated',jsonb_build_object('name','Audit Viewer Test'),case when id=admin_id then '{"portal_role":"admin"}'::jsonb else '{}'::jsonb end from unnest(array[admin_id,officer_id,member_id]) id;
 update public.profiles set eboard=1 where id=officer_id;
 perform set_config('request.jwt.claim.sub',member_id,true);
 hour_id:=public.portal_hours_action('hours',jsonb_build_object('date',(now() at time zone 'America/New_York')::date::text,'hours',1,'activity','Test','facility','Fixture'))->>'id';
 begin perform public.portal_admin_audit();raise exception 'Member read audit';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',officer_id,true);
 begin perform public.portal_admin_audit();raise exception 'Officer read audit';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub','',true);
 begin perform public.portal_admin_audit();raise exception 'Anonymous read audit';exception when insufficient_privilege then null;end;
 if has_function_privilege('anon','public.portal_admin_audit(text,text,date,date,integer)','EXECUTE') then raise exception 'Anonymous execute granted';end if;
 perform set_config('request.jwt.claim.sub',admin_id,true);
 r:=public.portal_admin_audit(member_id,'created');
 if not exists(select 1 from jsonb_array_elements(r->'entries') e where e->>'resource_id'=hour_id and e->>'resource_table'='hours' and e->>'actor_id'=member_id) then raise exception 'Unified hour history missing';end if;
 insert into public.portal_activity_audit(recorded_at,actor_id,actor_name,actor_role,database_role,operation,resource_table,resource_id,before_record,after_record)
 select event_time,admin_id,'Audit Admin','admin',session_user,'UPDATE','profiles',member_id,'{"bio":"Before"}','{"bio":"After"}' from unnest(array['2026-03-08 04:59:59+00'::timestamptz,'2026-03-08 05:00:00+00','2026-03-09 03:59:59+00','2026-03-09 04:00:00+00']) event_time;
 r:=public.portal_admin_audit(member_id,'updated','2026-03-08','2026-03-08');
 if (r->>'total')::int<>2 then raise exception 'Eastern DST date boundaries incorrect';end if;
 r:=public.portal_admin_audit(admin_id,'updated','2026-03-08','2026-03-08');
 if (r->>'total')::int<>2 then raise exception 'Actor member filter incorrect';end if;
 r:=public.portal_admin_audit(officer_id,'updated','2026-03-08','2026-03-08');
 if (r->>'total')::int<>0 then raise exception 'Unrelated member included';end if;
 r:=public.portal_admin_audit(member_id,'deleted','2026-03-08','2026-03-08');
 if (r->>'total')::int<>0 then raise exception 'Action filter incorrect';end if;
 insert into public.portal_activity_audit(recorded_at,actor_id,actor_name,actor_role,database_role,operation,resource_table,resource_id,before_record,after_record)
 select '2026-04-01 16:00:00+00'::timestamptz+make_interval(secs=>n),admin_id,'Audit Admin','admin',session_user,'UPDATE','profiles',member_id,'{"disabled":0}','{"disabled":1}' from generate_series(1,30) n;
 r:=public.portal_admin_audit(member_id,'disabled','2026-04-01','2026-04-01',0);
 if (r->>'total')::int<>30 or jsonb_array_length(r->'entries')<>25 then raise exception 'First page incorrect';end if;
 r:=public.portal_admin_audit(member_id,'disabled','2026-04-01','2026-04-01',25);
 if jsonb_array_length(r->'entries')<>5 then raise exception 'Second page incorrect';end if;
 begin perform public.portal_admin_audit(null,null,'2026-04-02','2026-04-01');raise exception 'Invalid date range accepted';exception when raise_exception then if sqlerrm<>'The end date must be on or after the start date.' then raise;end if;end;
 update public.profiles set disabled=1 where id=admin_id;
 begin perform public.portal_admin_audit();raise exception 'Disabled admin read audit';exception when insufficient_privilege then null;end;
 raise exception using errcode='PZ001',message='Rollback fixture';
 exception when sqlstate 'PZ001' then null;
 end;
end $$;
select 'PASS: admin-only unified logs; member/actor/action/Eastern DST date filters; pagination; invalid dates; anonymous/member/officer/disabled-admin denial; fixtures rolled back' as result;
