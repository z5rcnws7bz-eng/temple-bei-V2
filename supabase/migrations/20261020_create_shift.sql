-- Vercel scheduling writes use authenticated Supabase RPCs, not the Sites worker.
create or replace function public.portal_create_shift(shift_data jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor public.profiles; shift_id text; shift_date date; starts time; ends time; spots integer; saved jsonb;
begin
 select p.* into actor from public.profiles p join auth.users a on a.id::text=p.id
 where a.id=auth.uid() and a.email_confirmed_at is not null and p.disabled=0 and p.deleted_at is null
 and (p.eboard<>0 or a.raw_app_meta_data->>'portal_role'='admin');
 if actor.id is null then raise exception 'Only active chapter administrators and e-board members can create shifts.' using errcode='42501'; end if;
 if coalesce(shift_data->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(shift_data->>'start','') !~ '^\d{2}:\d{2}$' or coalesce(shift_data->>'end','') !~ '^\d{2}:\d{2}$' or coalesce(shift_data->>'capacity','') !~ '^\d{1,3}$' then raise exception 'Provide a valid date, time range, and capacity.'; end if;
 begin
 shift_date:=(shift_data->>'date')::date; starts:=(shift_data->>'start')::time; ends:=(shift_data->>'end')::time; spots:=(shift_data->>'capacity')::integer;
 exception when datetime_field_overflow or invalid_datetime_format then raise exception 'Provide a valid date and time range.'; end;
 if shift_date<(now() at time zone 'America/New_York')::date or starts>=ends or spots<1 or spots>50 or length(trim(coalesce(shift_data->>'facility','')))=0 or length(shift_data->>'facility')>200 or length(trim(coalesce(shift_data->>'activity','')))=0 or length(shift_data->>'activity')>200 then raise exception 'Provide a current or future date, end time after start, activity, facility, and 1–50 spots.'; end if;
 shift_id:=coalesce(nullif(shift_data->>'id',''),gen_random_uuid()::text);
 if length(shift_id)>100 then raise exception 'Invalid shift identifier.'; end if;
 saved:=jsonb_build_object('date',shift_data->>'date','start',shift_data->>'start','end',shift_data->>'end','facility',trim(shift_data->>'facility'),'activity',trim(shift_data->>'activity'),'createdBy',actor.name,'createdById',actor.id);
 insert into public.shifts(id,payload,capacity,taken) values(shift_id,saved,spots,0) on conflict(id) do nothing;
 if not exists(select 1 from public.shifts s where s.id=shift_id and s.payload=saved and s.capacity=spots) then raise exception 'This shift identifier is already in use. Reopen Create shift and try again.'; end if;
 return jsonb_build_object('ok',true,'id',shift_id);
end;
$$;
revoke all on function public.portal_create_shift(jsonb) from public,anon;
grant execute on function public.portal_create_shift(jsonb) to authenticated;
