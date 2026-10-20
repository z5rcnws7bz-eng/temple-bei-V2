-- Isolated fixtures; the sentinel rolls back every write.
do $$
declare t text:='00000000-0000-4000-8000-000000000911'; other_id text:='00000000-0000-4000-8000-000000000912'; p jsonb; photo text:='data:image/jpeg;base64,/9j/4P/Z';
begin begin
 insert into auth.users(id,email,email_confirmed_at,aud,role,raw_user_meta_data) values(t::uuid,'photo-test@example.invalid',now(),'authenticated','authenticated','{"name":"Photo Test"}'),(other_id::uuid,'other-photo-test@example.invalid',now(),'authenticated','authenticated','{"name":"Other Test"}');
 perform set_config('request.jwt.claim.sub',t,true);
 perform public.portal_update_profile(jsonb_build_object('id',other_id,'name','Saved Profile','major','Biology','year','2028','bio','Saved biography','photo_data_url',photo));
 p:=public.portal_request('state')->'profile';
 if p->>'photo_data_url'<>photo or p->>'year'<>'2028' or p->>'bio'<>'Saved biography' then raise exception 'FAIL: photo/year/bio did not persist'; end if;
 if exists(select 1 from public.profiles where id=other_id and name='Saved Profile') then raise exception 'FAIL: changed another profile'; end if;
 perform set_config('request.jwt.claim.sub','',true);
 begin perform public.portal_update_profile('{"name":"Not signed in"}'); raise exception 'FAIL: anonymous profile update'; exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub',t,true);
 p:=public.portal_request('state')->'profile';
 if p->>'photo_data_url'<>photo or p->>'year'<>'2028' or p->>'bio'<>'Saved biography' then raise exception 'FAIL: profile changed across sessions'; end if;
 p:=public.portal_directory(t)->'member';
 if p->>'photo_data_url'<>photo or p->>'bio'<>'Saved biography' then raise exception 'FAIL: directory profile mismatch'; end if;
 begin perform public.portal_update_profile('{"name":"Invalid change","photo_data_url":"data:image/svg+xml;base64,AAAA"}'); raise exception 'FAIL: accepted unsafe image'; exception when raise_exception then if sqlerrm<>'Choose a JPG, PNG, or WebP photo using Upload photo.' then raise; end if; end;
 if (select name from public.profiles where id=t)<>'Saved Profile' then raise exception 'FAIL: invalid save partially changed profile'; end if;
 perform public.portal_update_profile('{"name":"Saved Profile","major":"Biology","year":"2028","bio":"Saved biography","photo_data_url":""}');
 if (select photo_data_url from public.profiles where id=t)<>'' then raise exception 'FAIL: photo removal did not persist'; end if;
 raise exception using errcode='PZ001',message='Rollback test data';
 exception when sqlstate 'PZ001' then null; end;
end; $$;
select 'PASS: photo/year/bio persisted across sessions, directory matched, other account protected, invalid photo rejected atomically, removal saved; fixtures rolled back' as profile_tests;
