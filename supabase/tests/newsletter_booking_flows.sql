do $$
declare officer text:='00000000-0000-4000-8000-000000000991'; member1 text:='00000000-0000-4000-8000-000000000992'; other_officer text:='00000000-0000-4000-8000-000000000993'; post jsonb; post_id text; shift_id text; state jsonb;
begin
 begin
 insert into auth.users(id,email,email_confirmed_at,aud,role,raw_user_meta_data) values(officer::uuid,'flow-author@example.invalid',now(),'authenticated','authenticated',jsonb_build_object('name','Flow Author')),(member1::uuid,'flow-member@example.invalid',now(),'authenticated','authenticated',jsonb_build_object('name','Flow Member')),(other_officer::uuid,'flow-officer@example.invalid',now(),'authenticated','authenticated',jsonb_build_object('name','Other Officer'));
 update public.profiles set eboard=1 where id in (officer,other_officer);
 perform set_config('request.jwt.claim.sub',officer,true);
 shift_id:=public.portal_create_shift(jsonb_build_object('id','flow-shift-991','date',((now() at time zone 'America/New_York')::date+10)::text,'start','15:00','end','16:00','facility','Fixture','activity','Reading','capacity',1))->>'id';
 perform public.portal_roster_action('board/shifts/assign',jsonb_build_object('shiftId',shift_id,'memberId',member1));
 post:=jsonb_build_object('title','Test newsletter','body','Visit https://temple.edu','title_url','https://temple.edu','published',false,'images',jsonb_build_array('data:image/jpeg;base64,/9j/4P/Z'));
 begin perform public.portal_save_newsletter(post||jsonb_build_object('title_url','javascript:alert(1)'));raise exception 'Unsafe title link accepted';exception when raise_exception then if sqlerrm<>'Use an http:// or https:// title link.' then raise;end if;end;
 begin perform public.portal_save_newsletter(post||jsonb_build_object('images',jsonb_build_array('data:text/html,unsafe')));raise exception 'Unsafe image accepted';exception when raise_exception then if sqlerrm<>'Upload valid JPG, PNG, or WebP images through the image picker.' then raise;end if;end;
 post_id:=public.portal_save_newsletter(post)->>'id';post:=post||jsonb_build_object('id',post_id);
 perform set_config('request.jwt.claim.sub',member1,true);
 state:=public.portal_request('state','GET',null);
 if not exists(select 1 from jsonb_array_elements(state->'shifts') s where s->>'id'=shift_id and (s->>'mine')::boolean) then raise exception 'Assigned shift missing from member account'; end if;
 if exists(select 1 from jsonb_array_elements(state->'newsletters') n where n->>'id'=post_id) then raise exception 'Draft leaked to member'; end if;
 begin perform public.portal_save_newsletter(post||jsonb_build_object('published',true));raise exception 'Member edited newsletter'; exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub',other_officer,true);
 begin perform public.portal_save_newsletter(post);raise exception 'Other officer edited newsletter'; exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub',officer,true);
 perform public.portal_save_newsletter(post||jsonb_build_object('published',true));
 perform set_config('request.jwt.claim.sub',member1,true);
 state:=public.portal_request('state','GET',null);
 if not exists(select 1 from jsonb_array_elements(state->'newsletters') n where n->>'id'=post_id and n->>'author_id'=officer and n->'images'=post->'images') then raise exception 'Published image newsletter missing from member account'; end if;
 -- Return to a different identity and back, mirroring independent authenticated state loads.
 perform set_config('request.jwt.claim.sub',other_officer,true);perform public.portal_request('state','GET',null);
 perform set_config('request.jwt.claim.sub',member1,true);
 if not exists(select 1 from jsonb_array_elements(public.portal_request('state','GET',null)->'shifts') s where s->>'id'=shift_id and (s->>'mine')::boolean) then raise exception 'Assigned shift did not persist across sessions'; end if;
 perform public.portal_booking_action('shifts/drop',jsonb_build_object('id',shift_id));
 perform public.portal_booking_action('shifts/book',jsonb_build_object('id',shift_id));
 perform set_config('request.jwt.claim.sub','4c502ace-898d-4eeb-bdec-5ebb21e2dc57',true);
 perform public.portal_save_newsletter(post||jsonb_build_object('body','Administrator edit','published',true));
 if (select author_id from public.newsletters where id=post_id)<>officer then raise exception 'Admin edit changed author identity'; end if;
 if has_table_privilege('authenticated','public.newsletters','UPDATE') or has_table_privilege('anon','public.newsletters','SELECT') then raise exception 'Direct access bypasses newsletter rules'; end if;
 raise exception using errcode='PZ001',message='Rollback fixture';
 exception when sqlstate 'PZ001' then null;
 end;
end $$;
select 'PASS: created shift, assigned member, independent account reloads, book/drop, private drafts, published images and links, author-only edit and admin override; fixtures rolled back' as result;
