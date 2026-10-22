do $$
<<leadership_activity_audit>>
declare
 first_id text:='00000000-0000-4000-8000-000000000961';
 second_id text:='00000000-0000-4000-8000-000000000962';
 member_id text:='00000000-0000-4000-8000-000000000963';
 shift_id text; post_id text; booking_id text;
begin
 begin
 insert into auth.users(id,email,email_confirmed_at,aud,role,raw_user_meta_data) values
 (first_id::uuid,'audit-first@example.invalid',now(),'authenticated','authenticated','{"name":"Audit Officer One"}'),
 (second_id::uuid,'audit-second@example.invalid',now(),'authenticated','authenticated','{"name":"Audit Officer Two"}'),
 (member_id::uuid,'audit-member@example.invalid',now(),'authenticated','authenticated','{"name":"Audit Member"}');
 update public.profiles set eboard=1 where id in (first_id,second_id);
 perform set_config('request.jwt.claim.sub',first_id,true);
 perform public.portal_set_member_disabled(member_id,true);
 perform set_config('request.jwt.claim.sub',second_id,true);
 perform public.portal_set_member_disabled(member_id,false);
 if not exists(select 1 from public.portal_activity_audit where resource_id=member_id and actor_id=first_id and actor_name='Audit Officer One' and actor_email='audit-first@example.invalid' and actor_role='eboard' and before_record->>'disabled'='0' and after_record->>'disabled'='1') then raise exception 'Disable attributed to wrong account'; end if;
 if not exists(select 1 from public.portal_activity_audit where resource_id=member_id and actor_id=second_id and actor_name='Audit Officer Two' and before_record->>'disabled'='1' and after_record->>'disabled'='0') then raise exception 'Re-enable attributed to wrong account'; end if;
 shift_id:=public.portal_create_shift(jsonb_build_object('id','audit-shift-961','date',((now() at time zone 'America/New_York')::date+15)::text,'start','15:00','end','16:00','facility','Fixture','activity','Reading','capacity',2,'createdBy','Jace Roman','createdById','forged'))->>'id';
 perform public.portal_roster_action('board/shifts/assign',jsonb_build_object('shiftId',shift_id,'memberId',member_id));
 select id into booking_id from public.bookings where bookings.shift_id=leadership_activity_audit.shift_id and owner=member_id;
 post_id:=public.portal_save_newsletter(jsonb_build_object('title','Audit fixture','body','Test','published',true,'author','Jace Roman','author_id','forged','images',jsonb_build_array('data:image/jpeg;base64,/9j/4P/Z')))->>'id';
 if not exists(select 1 from public.portal_activity_audit where resource_table='shifts' and resource_id=shift_id and actor_id=second_id and after_record->'payload'->>'createdById'=second_id) then raise exception 'Shift identity forged'; end if;
 if not exists(select 1 from public.portal_activity_audit where resource_table='bookings' and resource_id=booking_id and actor_id=second_id) then raise exception 'Assignment actor missing'; end if;
 if not exists(select 1 from public.portal_activity_audit where resource_table='newsletters' and resource_id=post_id and actor_id=second_id and after_record->>'author_id'=second_id and not (after_record ? 'images') and jsonb_array_length(after_record->'image_fingerprints')=1) then raise exception 'Newsletter actor/fingerprint missing'; end if;
 perform set_config('request.jwt.claim.sub',member_id,true);
 perform public.portal_update_profile(jsonb_build_object('name','Audit Member','major','Biology','year','2028','bio','Audit persistence','actor_id',first_id,'actor_name','Jace Roman'));
 if not exists(select 1 from public.portal_activity_audit where resource_table='profiles' and resource_id=member_id and actor_id=member_id and actor_name='Audit Member' and after_record->>'bio'='Audit persistence' and not (after_record ? 'photo_data_url')) then raise exception 'Profile identity or safe snapshot missing'; end if;
 perform public.portal_save_availability(jsonb_set(public.portal_request('state')->'availability','{0,enabled}','true'::jsonb));
 if not exists(select 1 from public.portal_activity_audit where resource_id=member_id and actor_id=member_id and after_record->>'availability' is distinct from before_record->>'availability') then raise exception 'Availability audit missing'; end if;
 update auth.users set raw_app_meta_data='{"portal_role":"admin"}' where id=first_id::uuid;
 perform set_config('request.jwt.claim.sub',first_id,true);
 perform public.portal_request('admin/member','POST',jsonb_build_object('id',member_id,'eboard',true));
 if not exists(select 1 from public.portal_activity_audit where resource_id=member_id and actor_id=first_id and actor_role='admin' and before_record->>'eboard'='0' and after_record->>'eboard'='1') then raise exception 'Role grant audit missing'; end if;
 perform set_config('request.jwt.claim.sub',second_id,true);
 delete from public.newsletters where id=post_id;
 if not exists(select 1 from public.portal_activity_audit where resource_id=post_id and operation='DELETE' and before_record is not null and after_record is null and actor_id=second_id) then raise exception 'Deletion history lost'; end if;
 if has_table_privilege('authenticated','public.portal_activity_audit','SELECT') or has_table_privilege('authenticated','public.portal_activity_audit','UPDATE') or has_table_privilege('authenticated','public.portal_activity_audit','DELETE') or has_table_privilege('authenticated','public.portal_activity_audit','INSERT') or has_function_privilege('anon','public.audit_portal_activity()','EXECUTE') then raise exception 'Clients can access or forge audit'; end if;
 raise exception using errcode='PZ001',message='Rollback fixture';
 exception when sqlstate 'PZ001' then null;
 end;
end $$;
select 'PASS: independent officers attributed by authenticated account, spoofed names/IDs ignored, before/after access history, shift/assignment/newsletter/profile/deletion audit, image fingerprints and private log; fixtures rolled back' as result;
