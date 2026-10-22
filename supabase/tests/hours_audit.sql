do $$
declare member_id text:='00000000-0000-4000-8000-000000000966'; officer_id text:='00000000-0000-4000-8000-000000000967'; admin_id text:='00000000-0000-4000-8000-000000000968'; data jsonb; own_id text; member_entry text; admin_entry text;
begin
 begin
 insert into auth.users(id,email,email_confirmed_at,aud,role,raw_user_meta_data) values(member_id::uuid,'hour-member@example.invalid',now(),'authenticated','authenticated',jsonb_build_object('name','Member Test')),(officer_id::uuid,'hour-officer@example.invalid',now(),'authenticated','authenticated',jsonb_build_object('name','Officer Test')),(admin_id::uuid,'hour-admin@example.invalid',now(),'authenticated','authenticated',jsonb_build_object('name','Admin Test'));
 update public.profiles set eboard=1 where id=officer_id;
 update auth.users set raw_app_meta_data=jsonb_build_object('portal_role','admin') where id=admin_id::uuid;
 data:=jsonb_build_object('date',(now() at time zone 'America/New_York')::date::text,'hours',2,'activity','Reading','facility','Test fixture','status','Approved');
 perform set_config('request.jwt.claim.sub',member_id,true);
 member_entry:=public.portal_hours_action('hours',data)->>'id';
 if (select payload->>'status' from public.hours where id=member_entry)<>'Pending' then raise exception 'Member forged approval'; end if;
 perform set_config('request.jwt.claim.sub',officer_id,true);
 own_id:=public.portal_hours_action('hours',data)->>'id';
 if (select payload->>'status' from public.hours where id=own_id)<>'Approved' then raise exception 'Officer not auto approved'; end if;
 perform public.portal_hours_action('hours',data||jsonb_build_object('id',own_id,'hours',3));
 perform public.portal_hours_action('hours/remove',jsonb_build_object('id',own_id));
 perform public.portal_hours_action('hours/restore',jsonb_build_object('id',own_id));
 perform public.portal_hours_action('board/review',jsonb_build_object('id',member_entry,'status','Approved'));
 perform public.portal_hours_action('hours',data||jsonb_build_object('id',member_entry,'hours',4));
 if not exists(select 1 from public.hour_audit where entry_id=member_entry and actor_id=officer_id and owner_id=member_id and before_record->'payload'->>'hours'='2' and after_record->'payload'->>'hours'='4') then raise exception 'Cross-account audit missing snapshots'; end if;
 if (select count(*) from public.hour_audit where entry_id=own_id)<>4 then raise exception 'Create/edit/remove/restore audit missing'; end if;
 perform set_config('request.jwt.claim.sub',admin_id,true);
 admin_entry:=public.portal_hours_action('hours',data)->>'id';
 if (select payload->>'status' from public.hours where id=admin_entry)<>'Approved' then raise exception 'Admin not auto approved'; end if;
 perform set_config('request.jwt.claim.sub',member_id,true);
 begin perform public.portal_hours_action('hours',data||jsonb_build_object('id',own_id)); raise exception 'Member edited another account'; exception when insufficient_privilege then null; end;
 if has_table_privilege('authenticated','public.hour_audit','UPDATE') or has_table_privilege('authenticated','public.hours','UPDATE') then raise exception 'Clients can bypass audit protections'; end if;
 delete from public.hours where id=admin_entry;
 if not exists(select 1 from public.hour_audit where entry_id=admin_entry and operation='DELETE' and after_record is null and before_record is not null) then raise exception 'Database delete audit missing'; end if;
 raise exception using errcode='PZ001',message='Rollback fixture';
 exception when sqlstate 'PZ001' then null;
 end;
end $$;
select 'PASS: admin/eboard auto approval, member review, edit/remove/restore/review/delete audits, actor and owner snapshots, client protections; fixtures rolled back' as result;
