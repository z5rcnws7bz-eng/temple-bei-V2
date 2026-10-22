create or replace function public.portal_roster_action(action text,roster_data jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare shift_record public.shifts; member_id text; outgoing text; count_taken integer;
begin
 if not exists(select 1 from public.profiles p join auth.users a on a.id::text=p.id where a.id=auth.uid() and a.email_confirmed_at is not null and p.disabled=0 and p.deleted_at is null and (p.eboard<>0 or a.raw_app_meta_data->>'portal_role'='admin')) then raise exception 'Only active chapter administrators and e-board members can manage shift assignments.' using errcode='42501'; end if;
 if action not in ('board/shifts/assign','board/shifts/remove','board/shifts/swap') then raise exception 'Unknown roster action.'; end if;
 member_id:=case when action='board/shifts/swap' then roster_data->>'memberIn' else roster_data->>'memberId' end;
 outgoing:=roster_data->>'memberOut';
 -- Serialize changes for this member and shift so simultaneous assignments cannot overbook.
 perform pg_advisory_xact_lock(hashtextextended(coalesce(member_id,''),0));
 select * into shift_record from public.shifts where id=roster_data->>'shiftId' for update;
 if shift_record.id is null then raise exception 'Shift not found.'; end if;
 if action='board/shifts/remove' then
 delete from public.bookings where shift_id=shift_record.id and owner=member_id;
 else
 if not exists(select 1 from public.profiles p join auth.users a on a.id::text=p.id where p.id=member_id and p.disabled=0 and p.deleted_at is null and a.email_confirmed_at is not null) then raise exception 'Choose an active, confirmed chapter member.'; end if;
 if exists(select 1 from public.bookings where shift_id=shift_record.id and owner=member_id) then raise exception 'Member is already assigned to this shift.'; end if;
 if exists(select 1 from public.bookings b join public.shifts s on s.id=b.shift_id where b.owner=member_id and s.payload->>'date'=shift_record.payload->>'date' and s.payload->>'start'<shift_record.payload->>'end' and s.payload->>'end'>shift_record.payload->>'start') then raise exception 'This shift overlaps with another assignment for this member.'; end if;
 if action='board/shifts/swap' then
 if outgoing=member_id then raise exception 'Choose a different replacement member.'; end if;
 delete from public.bookings where shift_id=shift_record.id and owner=outgoing;
 if not found then raise exception 'Original member is no longer assigned. Refresh the roster.'; end if;
 end if;
 select count(*) into count_taken from public.bookings where shift_id=shift_record.id;
 if count_taken>=shift_record.capacity then raise exception 'This shift is full.'; end if;
 insert into public.bookings(id,shift_id,owner) values(member_id||':'||shift_record.id,shift_record.id,member_id);
 end if;
 update public.shifts set taken=(select count(*) from public.bookings where shift_id=shift_record.id) where id=shift_record.id;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.portal_roster_action(text,jsonb) from public,anon;
grant execute on function public.portal_roster_action(text,jsonb) to authenticated;
-- All roster writes go through the protected RPC rather than permissive prototype policies.
revoke insert,update,delete on public.bookings from anon,authenticated;
