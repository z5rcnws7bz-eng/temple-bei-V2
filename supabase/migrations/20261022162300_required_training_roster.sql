create or replace function public.portal_operations(action text,operation_data jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor public.profiles; officer boolean; s public.shifts; training_record public.portal_training; item record; key text;
begin
 select p.* into actor from public.profiles p join auth.users a on a.id::text=p.id where a.id=auth.uid() and a.email_confirmed_at is not null and p.disabled=0 and p.deleted_at is null;
 if actor.id is null then raise exception 'Sign in with an active, confirmed account.' using errcode='42501';end if;
 select actor.eboard<>0 or coalesce(raw_app_meta_data->>'portal_role'='admin',false) into officer from auth.users where id=auth.uid();
 if action='data' then
 return jsonb_build_object('coverage',coalesce((select jsonb_agg(jsonb_build_object('id',ss.id,'waiting', (select count(*) from public.portal_waitlist where shift_id=ss.id),'waitlisted',exists(select 1 from public.portal_waitlist where shift_id=ss.id and owner=actor.id),'position',(select n from (select owner,row_number() over(order by joined_at,id) n from public.portal_waitlist where shift_id=ss.id) q where owner=actor.id),'cancelled',coalesce(ss.payload->>'cancelled'='true',false))) from public.shifts ss),'[]'::jsonb),
 'waitlist',case when officer then coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'shift_id',w.shift_id,'owner',w.owner,'name',p.name,'joined_at',w.joined_at) order by w.joined_at,w.id) from public.portal_waitlist w join public.profiles p on p.id=w.owner),'[]'::jsonb) else '[]'::jsonb end,
 'notifications',coalesce((select jsonb_agg(to_jsonb(n)-'email_error'-'dedupe_key' order by created_at desc) from (select * from public.portal_notifications where owner=actor.id order by created_at desc limit 100) n),'[]'::jsonb),
 'training',coalesce((select jsonb_agg(to_jsonb(t)||jsonb_build_object('completed_at',(select completed_at from public.portal_training_progress where training_id=t.id and owner=actor.id and version=t.version)) order by t.required desc,t.updated_at desc) from public.portal_training t where t.active or officer),'[]'::jsonb),
 'completion_roster',case when officer then coalesce((select jsonb_agg(jsonb_build_object('owner',m.id,'member_name',m.name,'member_state',case when m.disabled<>0 then 'Disabled' when u.email_confirmed_at is null then 'Email unconfirmed' else 'Active' end,'training_id',t.id,'title',t.title,'required',t.required,'version',t.version,'status',case when p.version=t.version then 'completed' when p.id is not null then 'update_required' else 'not_completed' end,'completed_at',case when p.version=t.version then p.completed_at else null end) order by t.required desc,t.title,lower(m.name),m.id) from public.profiles m join auth.users u on u.id::text=m.id cross join public.portal_training t left join public.portal_training_progress p on p.owner=m.id and p.training_id=t.id where m.deleted_at is null and t.active),'[]'::jsonb) else '[]'::jsonb end,
 'progress',case when officer then coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('member_name',m.name,'title',t.title,'current',p.version=t.version)) from public.portal_training_progress p join public.profiles m on m.id=p.owner join public.portal_training t on t.id=p.training_id),'[]'::jsonb) else '[]'::jsonb end);
 elsif action='notifications/read' then
 update public.portal_notifications set read_at=coalesce(read_at,now()) where owner=actor.id and (id=operation_data->>'id' or operation_data->>'id'='all');
 elsif action in ('waitlist/join','waitlist/leave') then
 perform pg_advisory_xact_lock(hashtextextended(actor.id,0));
 select * into s from public.shifts where id=operation_data->>'id' for update;
 if s.id is null then raise exception 'Shift not found.';end if;
 if action='waitlist/leave' then delete from public.portal_waitlist where shift_id=s.id and owner=actor.id;
 else
 if s.payload->>'cancelled'='true' or ((s.payload->>'date')||' '||(s.payload->>'start'))::timestamp at time zone 'America/New_York'<=now() then raise exception 'This shift is not available for waitlisting.';end if;
 if exists(select 1 from public.bookings where owner=actor.id and shift_id=s.id) then raise exception 'You are already assigned.';end if;
 if (select count(*) from public.bookings where shift_id=s.id)<s.capacity then raise exception 'A spot is available. Pick up the shift instead.';end if;
 if exists(select 1 from public.bookings b join public.shifts t on t.id=b.shift_id where b.owner=actor.id and t.payload->>'date'=s.payload->>'date' and t.payload->>'start'<s.payload->>'end' and t.payload->>'end'>s.payload->>'start') then raise exception 'This shift overlaps with your schedule.';end if;
 insert into public.portal_waitlist(shift_id,owner) values(s.id,actor.id) on conflict do nothing;
 end if;
 elsif action='shift/cancel' then
 if not officer then raise exception 'Only chapter leadership can cancel shifts.' using errcode='42501';end if;
 select * into s from public.shifts where id=operation_data->>'id' for update;
 if s.id is null then raise exception 'Shift not found.';end if;
 update public.shifts set payload=payload||jsonb_build_object('cancelled',true,'cancelledBy',actor.id,'cancelledAt',now()),taken=0 where id=s.id;
 delete from public.bookings where shift_id=s.id;
 for item in select owner from public.portal_waitlist where shift_id=s.id loop
 perform public.portal_notify(item.owner,'cancellation',s.id,'Waitlisted shift cancelled',coalesce(s.payload->>'facility','Volunteer shift')||' · '||(s.payload->>'date')||' has been cancelled.');end loop;
 delete from public.portal_waitlist where shift_id=s.id;
 elsif action='shift/remind' then
 if not officer then raise exception 'Only chapter leadership can send shift reminders.' using errcode='42501';end if;
 select * into s from public.shifts where id=operation_data->>'id';
 if s.id is null or s.payload->>'cancelled'='true' then raise exception 'Choose an active shift.';end if;
 for item in select owner from public.bookings where shift_id=s.id loop
 perform public.portal_notify(item.owner,'manual_reminder',s.id,'Shift reminder',coalesce(s.payload->>'facility','Volunteer shift')||' · '||(s.payload->>'date')||' '||(s.payload->>'start')||' Eastern',s.id||':'||item.owner||':manual:'||to_char(now(),'YYYYMMDDHH24'));end loop;
 elsif action='training/save' then
 if not officer then raise exception 'Only chapter leadership can publish training.' using errcode='42501';end if;
 if length(trim(coalesce(operation_data->>'title','')))=0 or length(operation_data->>'title')>160 or length(trim(coalesce(operation_data->>'body','')))=0 or length(operation_data->>'body')>20000 then raise exception 'Add a title (up to 160 characters) and instructions (up to 20,000 characters).';end if;
 if coalesce(operation_data->>'resource_url','')<>'' and (operation_data->>'resource_url' !~ '^https://[^[:space:]]+$' or length(operation_data->>'resource_url')>2000) then raise exception 'Resource links must use HTTPS.';end if;
 key:=coalesce(nullif(operation_data->>'id',''),gen_random_uuid()::text);
 insert into public.portal_training(id,title,body,resource_url,required,author_id) values(key,trim(operation_data->>'title'),operation_data->>'body',coalesce(operation_data->>'resource_url',''),coalesce((operation_data->>'required')::boolean,false),actor.id)
 on conflict(id) do update set title=excluded.title,body=excluded.body,resource_url=excluded.resource_url,required=excluded.required,version=portal_training.version+1,updated_at=now();
 elsif action='training/archive' then
 if not officer then raise exception 'Only chapter leadership can archive training.' using errcode='42501';end if;
 update public.portal_training set active=false,updated_at=now() where id=operation_data->>'id';
 elsif action='training/complete' then
 select * into training_record from public.portal_training where id=operation_data->>'id' and active for share;
 if training_record.id is null then raise exception 'Training not found.';end if;
 if coalesce(operation_data->>'version','')<>training_record.version::text then raise exception 'This training changed. Refresh it before marking complete.';end if;
 insert into public.portal_training_progress(id,owner,training_id,version) values(actor.id||':'||training_record.id,actor.id,training_record.id,training_record.version) on conflict(owner,training_id) do update set version=excluded.version,completed_at=now();
 else raise exception 'Unknown chapter operation.';end if;
 return jsonb_build_object('ok',true);
end $$;

-- Mark the existing, unchanged deck required without invalidating prior completions.
update public.portal_training set required=true,updated_at=now() where id='bei-student-info' and required=false;
