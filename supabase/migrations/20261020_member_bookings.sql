create or replace function public.portal_booking_action(action text,booking_data jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor_id text:=auth.uid()::text; target public.shifts; administrator boolean; starts_at timestamptz;
begin
 select coalesce(a.raw_app_meta_data->>'portal_role'='admin',false) into administrator from auth.users a join public.profiles p on p.id=a.id::text where a.id=auth.uid() and a.email_confirmed_at is not null and p.disabled=0 and p.deleted_at is null;
 if administrator is null then raise exception 'Sign in with an active, confirmed account.' using errcode='42501'; end if;
 if action not in ('shifts/book','shifts/drop') then raise exception 'Unknown booking action.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor_id,0));
 select * into target from public.shifts where id=booking_data->>'id' for update;
 if target.id is null then raise exception 'Shift not found.'; end if;
 starts_at:=((target.payload->>'date')||' '||(target.payload->>'start'))::timestamp at time zone 'America/New_York';
 if action='shifts/book' then
 if ((target.payload->>'date')||' '||(target.payload->>'end'))::timestamp at time zone 'America/New_York'<=now() then raise exception 'This shift has ended.'; end if;
 if exists(select 1 from public.bookings where shift_id=target.id and owner=actor_id) then raise exception 'You already have this shift.'; end if;
 if exists(select 1 from public.bookings b join public.shifts s on s.id=b.shift_id where b.owner=actor_id and s.payload->>'date'=target.payload->>'date' and s.payload->>'start'<target.payload->>'end' and s.payload->>'end'>target.payload->>'start') then raise exception 'This shift overlaps with another booking.'; end if;
 if (select count(*) from public.bookings where shift_id=target.id)>=target.capacity then raise exception 'This shift is full.'; end if;
 insert into public.bookings(id,shift_id,owner) values(actor_id||':'||target.id,target.id,actor_id);
 else
 if not administrator and starts_at<=now()+interval '4 hours' then raise exception 'Shifts within 4 hours of start time cannot be dropped online. Please contact an e-board member.' using errcode='42501'; end if;
 delete from public.bookings where shift_id=target.id and owner=actor_id;
 end if;
 update public.shifts set taken=(select count(*) from public.bookings where shift_id=target.id) where id=target.id;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.portal_booking_action(text,jsonb) from public,anon;
grant execute on function public.portal_booking_action(text,jsonb) to authenticated;
