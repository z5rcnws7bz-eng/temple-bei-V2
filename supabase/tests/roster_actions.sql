do $$
declare officer text:='00000000-0000-4000-8000-000000000981'; member1 text:='00000000-0000-4000-8000-000000000982'; member2 text:='00000000-0000-4000-8000-000000000983'; data jsonb;
begin
 begin
 insert into auth.users(id,email,email_confirmed_at,aud,role,raw_user_meta_data) values(officer::uuid,'roster-officer@example.invalid',now(),'authenticated','authenticated',jsonb_build_object('name','Roster Officer')),(member1::uuid,'roster-one@example.invalid',now(),'authenticated','authenticated',jsonb_build_object('name','Roster One')),(member2::uuid,'roster-two@example.invalid',now(),'authenticated','authenticated',jsonb_build_object('name','Roster Two'));
 update public.profiles set eboard=1 where id=officer;
 insert into public.shifts(id,payload,capacity,taken) values('roster-fixture-981',jsonb_build_object('date','2026-12-07','start','15:00','end','16:00'),1,0);
 data:=jsonb_build_object('shiftId','roster-fixture-981','memberId',member1);
 perform set_config('request.jwt.claim.sub',member1,true);
 begin perform public.portal_roster_action('board/shifts/assign',data); raise exception 'Member assigned roster'; exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub',officer,true);
 perform public.portal_roster_action('board/shifts/assign',data);
 if (select taken from public.shifts where id='roster-fixture-981')<>1 then raise exception 'Assignment not saved'; end if;
 begin perform public.portal_roster_action('board/shifts/assign',data||jsonb_build_object('memberId',member2)); raise exception 'Overbooked shift'; exception when raise_exception then if sqlerrm<>'This shift is full.' then raise; end if; end;
 perform public.portal_roster_action('board/shifts/swap',jsonb_build_object('shiftId','roster-fixture-981','memberOut',member1,'memberIn',member2));
 if not exists(select 1 from public.bookings where shift_id='roster-fixture-981' and owner=member2) or exists(select 1 from public.bookings where shift_id='roster-fixture-981' and owner=member1) then raise exception 'Switch not saved'; end if;
 perform public.portal_roster_action('board/shifts/remove',data||jsonb_build_object('memberId',member2));
 if (select taken from public.shifts where id='roster-fixture-981')<>0 then raise exception 'Removal did not update capacity'; end if;
 raise exception using errcode='PZ001',message='Rollback fixture';
 exception when sqlstate 'PZ001' then null;
 end;
end $$;
select 'PASS: officer authorization, assignment persistence, capacity enforcement, member switch and removal; fixtures rolled back' as result;
