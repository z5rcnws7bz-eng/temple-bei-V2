do $$
declare fixture text:='00000000-0000-4000-8000-000000000988'; added jsonb;
begin
 begin
 insert into auth.users(id,email,email_confirmed_at,aud,role,raw_user_meta_data) values(fixture::uuid,'hours-total@example.invalid',now(),'authenticated','authenticated',jsonb_build_object('name','Hours Total Test'));
 update public.profiles set eboard=1 where id=fixture;
 insert into public.hours(id,owner,payload) values('totals-opening-fixture',fixture,jsonb_build_object('date','2026-10-20','hours',97.85,'status','Approved'));
 perform set_config('request.jwt.claim.sub',fixture,true);
 added:=public.portal_hours_action('hours',jsonb_build_object('date',(now() at time zone 'America/New_York')::date::text,'hours',1.25,'activity','Reading','facility','Test fixture'));
 if public.portal_approved_hours(fixture)<>99.10 then raise exception 'Approved credit plus new entry total is incorrect'; end if;
 if (public.portal_directory(fixture)->'member'->>'approved_hours')::numeric<>99.10 then raise exception 'Profile total disagrees with ledger'; end if;
 if (select sum((h->>'hours')::numeric) from jsonb_array_elements(public.portal_request('state','GET',null)->'hours') h where h->>'status'='Approved')<>99.10 then raise exception 'Overview ledger total disagrees'; end if;
 perform public.portal_hours_action('hours/remove',jsonb_build_object('id',added->>'id'));
 if public.portal_approved_hours(fixture)<>97.85 then raise exception 'Removed hours counted in approved total'; end if;
 raise exception using errcode='PZ001',message='Rollback fixture';
 exception when sqlstate 'PZ001' then null;
 end;
end $$;
select 'PASS: approved historical credit plus future hours; profile, directory, overview and removed-entry totals match; fixtures rolled back' as result;
