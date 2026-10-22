do $$
declare fixture text:='00000000-0000-4000-8000-000000000955'; data jsonb; result jsonb;
begin
 begin
 insert into auth.users(id,email,email_confirmed_at,aud,role,raw_user_meta_data) values(fixture::uuid,'shift-test@example.invalid',now(),'authenticated','authenticated',jsonb_build_object('name','Shift Test'));
 perform set_config('request.jwt.claim.sub',fixture,true);
 data:=jsonb_build_object('id','shift-fixture-955','date',((now() at time zone 'America/New_York')::date+1)::text,'start','15:00','end','16:00','facility','Fixture facility','activity','Reading','capacity',4,'createdBy','Forged');
 begin perform public.portal_create_shift(data); raise exception 'Member unexpectedly created shift'; exception when insufficient_privilege then null; end;
 update public.profiles set eboard=1 where id=fixture;
 result:=public.portal_create_shift(data);
 perform public.portal_create_shift(data);
 if (select count(*) from public.shifts where id=result->>'id')<>1 then raise exception 'Retry duplicated shift'; end if;
 if not exists(select 1 from public.shifts where id=result->>'id' and capacity=4 and taken=0 and payload->>'createdBy'='Shift Test') then raise exception 'Saved shift incorrect'; end if;
 if not exists(select 1 from jsonb_array_elements(public.portal_request('state','GET',null)->'shifts') s where s->>'id'=result->>'id') then raise exception 'Saved shift missing from state'; end if;
 begin perform public.portal_create_shift(data||jsonb_build_object('capacity',0)); raise exception 'Invalid capacity accepted'; exception when raise_exception then if sqlerrm not like 'Provide a current or future date%' then raise; end if; end;
 update public.profiles set disabled=1 where id=fixture;
 begin perform public.portal_create_shift(data); raise exception 'Disabled officer created shift'; exception when insufficient_privilege then null; end;
 raise exception using errcode='PZ001',message='Rollback fixture';
 exception when sqlstate 'PZ001' then null;
 end;
end $$;
select 'PASS: officer permissions, disabled account, validation, idempotency, saved state; fixtures rolled back' as result;
