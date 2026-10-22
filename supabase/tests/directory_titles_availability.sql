do $$
declare fixture text:='00000000-0000-4000-8000-000000000977'; schedule jsonb; result jsonb;
begin
 begin
 insert into auth.users(id,email,email_confirmed_at,aud,role,raw_user_meta_data) values(fixture::uuid,'availability-test@example.invalid',now(),'authenticated','authenticated',jsonb_build_object('name','Availability Test'));
 update public.profiles set chapter_title='Test title',eboard=1 where id=fixture;
 perform set_config('request.jwt.claim.sub',fixture,true);
 select jsonb_agg(jsonb_build_object('day',day,'enabled',day='Monday','start','09:00','end','12:00') order by ord) into schedule from unnest(array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']) with ordinality as d(day,ord);
 perform public.portal_save_availability(schedule);
 perform set_config('request.jwt.claim.sub','4c502ace-898d-4eeb-bdec-5ebb21e2dc57',true);
 if not exists(select 1 from jsonb_array_elements(public.portal_board_data()->'members') m where m->>'id'=fixture and m->'availability'=schedule) then raise exception 'Coordinator view missing saved availability'; end if;
 perform set_config('request.jwt.claim.sub',fixture,true);
 if public.portal_request('state','GET',null)->'availability'<>schedule then raise exception 'Availability not restored to account'; end if;
 if public.portal_directory(fixture)->'member'->>'chapter_title'<>'Test title' then raise exception 'Profile title missing'; end if;
 if not exists(select 1 from jsonb_array_elements(public.portal_directory()->'members') m where m->>'id'=fixture and m->>'chapter_title'='Test title') then raise exception 'Directory title missing'; end if;
 begin perform public.portal_save_availability(jsonb_set(schedule,'{0,end}','"08:00"')); raise exception 'Invalid time accepted'; exception when raise_exception then if sqlerrm<>'End times must be later than start times.' then raise; end if; end;
 if (select availability::jsonb from public.profiles where id=fixture)<>schedule then raise exception 'Invalid save altered availability'; end if;
 raise exception using errcode='PZ001',message='Rollback fixture';
 exception when sqlstate 'PZ001' then null;
 end;
end $$;
select 'PASS: saved account availability, reload, coordinator view, validation, directory and profile titles; fixtures rolled back' as result;
