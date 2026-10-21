do $$
declare fixture text:='00000000-0000-4000-8000-000000000941'; t text; r text;
begin
 begin
 foreach t in array array['profiles','hours','shifts','bookings','newsletters','attempts','portal_write_limits'] loop
  foreach r in array array['anon','authenticated'] loop
   if has_table_privilege(r,'public.'||t,'SELECT') or has_table_privilege(r,'public.'||t,'INSERT') or has_table_privilege(r,'public.'||t,'UPDATE') or has_table_privilege(r,'public.'||t,'DELETE') or has_table_privilege(r,'public.'||t,'TRUNCATE') then raise exception 'Direct table privilege remains: % %',r,t;end if;
  end loop;
 end loop;
 if has_function_privilege('anon','public.handle_new_user()','EXECUTE') or has_function_privilege('authenticated','public.portal_limit_writes()','EXECUTE') then raise exception 'Internal trigger function exposed';end if;
 perform set_config('request.jwt.claim.sub','',true);
 insert into auth.users(id,email,email_confirmed_at,aud,role,raw_user_meta_data) values(fixture::uuid,'security-fixture@example.invalid',now(),'authenticated','authenticated','{"name":"Security fixture"}');
 perform set_config('request.jwt.claim.sub',fixture,true);
 if public.portal_request('state')->'user'->>'id'<>fixture then raise exception 'RPC state stopped working';end if;
 begin perform public.portal_request('profile','PUT','{"name":""}');raise exception 'Legacy profile bypass accepted';exception when raise_exception then if sqlerrm<>'Check your profile name, major, year, and bio lengths.' then raise;end if;end;
 begin perform public.portal_request('availability','PUT','[1,2,3,4,5,6,7]');raise exception 'Legacy availability bypass accepted';exception when raise_exception then if sqlerrm='Legacy availability bypass accepted' then raise;end if;end;
 insert into public.portal_write_limits values(fixture,date_trunc('minute',clock_timestamp()),120,date_trunc('hour',clock_timestamp()),120);
 begin perform public.portal_update_profile('{"name":"Blocked change"}');raise exception 'Write throttle bypassed';exception when sqlstate 'PT429' then null;end;
 if (select name from public.profiles where id=fixture)<>'Security fixture' then raise exception 'Throttled change partially committed';end if;
 if exists(select 1 from public.portal_activity_audit where actor_id=fixture and after_record->>'name'='Blocked change') then raise exception 'Throttled change left false audit';end if;
 update public.portal_write_limits set minute_bucket=clock_timestamp()-interval '2 minutes',hour_count=999 where actor_id=fixture;
 perform public.portal_update_profile('{"name":"Allowed change"}');
 if (select minute_count from public.portal_write_limits where actor_id=fixture)<>1 then raise exception 'Minute bucket did not reset';end if;
 begin perform public.portal_update_profile('{"name":"Hourly blocked change"}');raise exception 'Hourly throttle bypassed';exception when sqlstate 'PT429' then null;end;
 perform public.portal_request('state');
 raise exception using errcode='PZ001',message='Rollback fixture';
 exception when sqlstate 'PZ001' then null;
 end;
end $$;
select 'PASS: no direct anonymous/authenticated table access, protected RPC state works, legacy validation enforced, atomic minute/hour write limits and private helpers; fixtures rolled back' as result;
