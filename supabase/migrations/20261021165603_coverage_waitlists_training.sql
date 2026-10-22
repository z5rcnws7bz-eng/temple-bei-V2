-- Private RPC-backed operations. Audit history has no cascading foreign keys.
create table public.portal_waitlist(id text primary key default gen_random_uuid()::text,shift_id text not null references public.shifts(id) on delete cascade,owner text not null references public.profiles(id),joined_at timestamptz not null default clock_timestamp(),unique(shift_id,owner));
create index portal_waitlist_order on public.portal_waitlist(shift_id,joined_at,id);
create table public.portal_notifications(id text primary key default gen_random_uuid()::text,owner text not null references public.profiles(id),kind text not null,shift_id text,subject text not null,message text not null,created_at timestamptz not null default now(),read_at timestamptz,email_status text not null default 'pending',email_attempts int not null default 0,next_attempt timestamptz not null default now(),email_error text,dedupe_key text unique);
create index portal_notifications_owner on public.portal_notifications(owner,created_at desc);
create index portal_notifications_pending on public.portal_notifications(next_attempt) where email_status in ('pending','retry','sending');
create table public.portal_training(id text primary key default gen_random_uuid()::text,title text not null,body text not null,resource_url text not null default '',required boolean not null default false,active boolean not null default true,version int not null default 1,author_id text not null,updated_at timestamptz not null default now());
create table public.portal_training_progress(id text primary key,owner text not null references public.profiles(id),training_id text not null references public.portal_training(id),version int not null,completed_at timestamptz not null default now(),unique(owner,training_id));
do $$ declare t text; begin foreach t in array array['portal_waitlist','portal_notifications','portal_training','portal_training_progress'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('create trigger audit_operations after insert or update or delete on public.%I for each row execute function public.audit_portal_activity()',t);
 if t<>'portal_notifications' then execute format('create trigger limit_operations after insert or update or delete on public.%I for each row execute function public.portal_limit_writes()',t);end if;
 end loop;end $$;

create function public.portal_notify(member_id text,notification_kind text,shift_key text,heading text,content text,dedupe text default null) returns void language sql security definer set search_path=public,pg_temp as $$
 insert into public.portal_notifications(owner,kind,shift_id,subject,message,dedupe_key) select member_id,notification_kind,shift_key,left(heading,200),left(content,4000),dedupe where exists(select 1 from public.profiles where id=member_id and disabled=0 and deleted_at is null) on conflict(dedupe_key) do nothing;
$$;
revoke all on function public.portal_notify(text,text,text,text,text,text) from public,anon,authenticated;
create function public.portal_booking_notice() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.shifts; m text; label text;
begin
 select * into s from public.shifts where id=coalesce(new.shift_id,old.shift_id);
 m:=coalesce(new.owner,old.owner);
 label:=coalesce(s.payload->>'facility','Volunteer shift')||' · '||coalesce(s.payload->>'date','')||' '||coalesce(s.payload->>'start','')||' Eastern';
 if tg_op='INSERT' then
 if s.payload->>'cancelled'='true' then raise exception 'This shift has been cancelled.'; end if;
 delete from public.portal_waitlist where shift_id=s.id and owner=m;
 perform public.portal_notify(m,'assignment',s.id,'Shift assigned',label||'. This shift is saved to your account.');
 else
 update public.portal_notifications set email_status='cancelled' where owner=m and shift_id=s.id and kind in ('reminder_24h','reminder_2h') and email_status in ('pending','retry');
 perform public.portal_notify(m,'cancellation',s.id,'Shift assignment cancelled',label||'. This assignment was removed from your schedule.');
 end if;
 return coalesce(new,old);
end $$;
revoke all on function public.portal_booking_notice() from public,anon,authenticated;
create trigger booking_notification after insert or delete on public.bookings for each row execute function public.portal_booking_notice();

create function public.portal_promote_waitlist(shift_key text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.shifts; w record;
begin
 select * into s from public.shifts where id=shift_key for update;
 if s.id is null or s.payload->>'cancelled'='true' or ((s.payload->>'date')||' '||(s.payload->>'start'))::timestamp at time zone 'America/New_York'<=now() then return;end if;
 for w in select q.* from public.portal_waitlist q join public.profiles p on p.id=q.owner join auth.users a on a.id::text=p.id where q.shift_id=s.id and p.disabled=0 and p.deleted_at is null and a.email_confirmed_at is not null order by q.joined_at,q.id for update of q loop
 exit when (select count(*) from public.bookings where shift_id=s.id)>=s.capacity;
 -- Member-level lock also prevents overlapping simultaneous assignments.
 if not pg_try_advisory_xact_lock(hashtextextended(w.owner,0)) then continue;end if;
 if not exists(select 1 from public.bookings b join public.shifts t on t.id=b.shift_id where b.owner=w.owner and t.payload->>'date'=s.payload->>'date' and t.payload->>'start'<s.payload->>'end' and t.payload->>'end'>s.payload->>'start') then
 insert into public.bookings(id,shift_id,owner) values(w.owner||':'||s.id,s.id,w.owner) on conflict do nothing;
 end if;
 end loop;
 update public.shifts set taken=(select count(*) from public.bookings where shift_id=s.id) where id=s.id;
end $$;
revoke all on function public.portal_promote_waitlist(text) from public,anon,authenticated;

alter function public.portal_booking_action(text,jsonb) rename to portal_booking_action_base;
revoke all on function public.portal_booking_action_base(text,jsonb) from public,anon,authenticated;
create function public.portal_booking_action(action text,booking_data jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;begin
 if exists(select 1 from public.shifts where id=booking_data->>'id' and payload->>'cancelled'='true') then raise exception 'This shift has been cancelled.';end if;
 result:=public.portal_booking_action_base(action,booking_data);
 if action='shifts/drop' then perform public.portal_promote_waitlist(booking_data->>'id');end if;
 return result;end $$;
revoke all on function public.portal_booking_action(text,jsonb) from public,anon;
grant execute on function public.portal_booking_action(text,jsonb) to authenticated;
alter function public.portal_roster_action(text,jsonb) rename to portal_roster_action_base;
revoke all on function public.portal_roster_action_base(text,jsonb) from public,anon,authenticated;
create function public.portal_roster_action(action text,roster_data jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;begin
 if exists(select 1 from public.shifts where id=roster_data->>'shiftId' and payload->>'cancelled'='true') then raise exception 'This shift has been cancelled.';end if;
 result:=public.portal_roster_action_base(action,roster_data);
 perform public.portal_promote_waitlist(roster_data->>'shiftId');
 return result;end $$;
revoke all on function public.portal_roster_action(text,jsonb) from public,anon;
grant execute on function public.portal_roster_action(text,jsonb) to authenticated;

create function public.portal_operations(action text,operation_data jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
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
revoke all on function public.portal_operations(text,jsonb) from public,anon;
grant execute on function public.portal_operations(text,jsonb) to authenticated;

create function public.portal_schedule_reminders() returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare booking_row record;begin
 -- Retry eligible promotions skipped because another transaction held the member lock.
 for booking_row in select distinct shift_id from public.portal_waitlist order by shift_id loop perform public.portal_promote_waitlist(booking_row.shift_id);end loop;
 for booking_row in select b.owner,b.shift_id,s.payload,((s.payload->>'date')||' '||(s.payload->>'start'))::timestamp at time zone 'America/New_York' starts_at from public.bookings b join public.shifts s on s.id=b.shift_id where coalesce(s.payload->>'cancelled','false')<>'true' loop
 if booking_row.starts_at>now() and booking_row.starts_at<=now()+interval '24 hours' then
 perform public.portal_notify(booking_row.owner,case when booking_row.starts_at<=now()+interval '2 hours' then 'reminder_2h' else 'reminder_24h' end,booking_row.shift_id,'Upcoming volunteer shift',(booking_row.payload->>'facility')||' · '||(booking_row.payload->>'date')||' '||(booking_row.payload->>'start')||' Eastern',booking_row.owner||':'||booking_row.shift_id||case when booking_row.starts_at<=now()+interval '2 hours' then ':2h' else ':24h' end);
 end if;end loop;
end $$;
revoke all on function public.portal_schedule_reminders() from public,anon,authenticated;
create extension if not exists pg_cron;
select cron.schedule('portal-shift-reminders','*/5 * * * *','select public.portal_schedule_reminders()');

-- Email delivery is a private scheduled worker; no credentials are exposed to clients.
select vault.create_secret(encode(gen_random_bytes(32),'hex'),'portal_reminder_worker_key') where not exists(select 1 from vault.secrets where name='portal_reminder_worker_key');
create function public.portal_claim_reminder_emails(worker_key text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;begin
 if worker_key is null or worker_key<>(select decrypted_secret from vault.decrypted_secrets where name='portal_reminder_worker_key' limit 1) then raise exception 'Invalid worker credentials.' using errcode='42501';end if;
 -- Suppress reminders for memberships or assignments that no longer exist.
 update public.portal_notifications n set email_status='cancelled' where email_status in ('pending','retry','sending') and (not exists(select 1 from profiles where id=n.owner and disabled=0 and deleted_at is null) or (kind in ('reminder_24h','reminder_2h','manual_reminder','assignment') and not exists(select 1 from bookings where owner=n.owner and shift_id=n.shift_id)));
 with picked as (select n.id from public.portal_notifications n where n.email_status in ('pending','retry','sending') and n.next_attempt<=now() and n.email_attempts<8 order by created_at limit 20 for update skip locked),claimed as (update public.portal_notifications n set email_status='sending',email_attempts=email_attempts+1,next_attempt=now()+interval '10 minutes' from picked where n.id=picked.id returning n.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'email',a.email,'subject',n.subject,'message',n.message,'attempt',n.email_attempts)),'[]'::jsonb) into result from claimed n join auth.users a on a.id::text=n.owner;
 return result;
end $$;
create function public.portal_finish_reminder_email(notification_id text,attempt int,sent boolean,error_message text default '') returns void language sql security definer set search_path=public,pg_temp as $$
 update public.portal_notifications set email_status=case when sent then 'sent' when email_attempts>=8 then 'failed' else 'retry' end,email_error=case when sent then null else left(error_message,300) end,next_attempt=now()+interval '15 minutes' where id=notification_id and email_status='sending' and email_attempts=attempt;
$$;
revoke all on function public.portal_claim_reminder_emails(text),public.portal_finish_reminder_email(text,int,boolean,text) from public,anon,authenticated;
grant execute on function public.portal_claim_reminder_emails(text),public.portal_finish_reminder_email(text,int,boolean,text) to service_role;
create extension if not exists pg_net with schema extensions;
select cron.schedule('portal-reminder-email-delivery','* * * * *',$job$
select net.http_post(url:='https://znbosnwimjklfaooxnjv.supabase.co/functions/v1/portal-reminders',headers:=jsonb_build_object('Content-Type','application/json','x-portal-worker-key',(select decrypted_secret from vault.decrypted_secrets where name='portal_reminder_worker_key' limit 1)),body:='{}'::jsonb);
$job$);

-- Read-only, bounded access to both audit ledgers. Authorization uses current server data.
create or replace function public.portal_admin_audit(member_filter text default null, action_filter text default null, date_from date default null, date_until date default null, page_offset integer default 0)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if not exists(select 1 from auth.users a join public.profiles p on p.id=a.id::text where a.id=auth.uid() and a.email_confirmed_at is not null and p.disabled=0 and p.deleted_at is null and a.raw_app_meta_data->>'portal_role'='admin') then
 raise exception 'Only active chapter administrators may view audit history.' using errcode='42501'; end if;
 if date_from is not null and date_until is not null and date_from>date_until then raise exception 'The end date must be on or after the start date.'; end if;
 if page_offset is null or page_offset<0 or page_offset>1000000 then raise exception 'Invalid audit page.'; end if;
 with raw as (
 select 'activity-'||a.id as id,a.recorded_at,a.actor_id,a.actor_name,a.actor_email,a.actor_role,a.database_role,a.operation,a.resource_table,a.resource_id,a.before_record,a.after_record,
 case when a.resource_table='profiles' then a.resource_id when a.resource_table in ('bookings','portal_waitlist','portal_notifications','portal_training_progress') then coalesce(a.after_record->>'owner',a.before_record->>'owner') end as member_id from public.portal_activity_audit a
 union all
 select 'hours-'||a.id,a.recorded_at,a.actor_id,a.actor_name,null,a.actor_role,a.database_role,a.operation,'hours',a.entry_id,a.before_record,a.after_record,a.owner_id from public.hour_audit a
 ), classified as (
 select r.*,case
 when operation='INSERT' then 'created' when operation='DELETE' then 'deleted'
 when resource_table='profiles' and before_record->>'disabled' is distinct from after_record->>'disabled' then case when after_record->>'disabled'='1' then 'disabled' else 're_enabled' end
 when resource_table='profiles' and before_record->>'eboard' is distinct from after_record->>'eboard' then case when after_record->>'eboard'='1' then 'eboard_granted' else 'eboard_revoked' end
 when resource_table='hours' and before_record->>'deleted' is distinct from after_record->>'deleted' then case when after_record->>'deleted'='1' then 'removed' else 'restored' end
 when resource_table='hours' and before_record->'payload'->>'status' is distinct from after_record->'payload'->>'status' and after_record->'payload'->>'status'='Approved' then 'approved'
 when resource_table='hours' and before_record->'payload'->>'status' is distinct from after_record->'payload'->>'status' and after_record->'payload'->>'status'='Returned' then 'returned'
 else 'updated' end as action from raw r
 ), filtered as (
 select c.*,p.name as member_name from classified c left join public.profiles p on p.id=c.member_id
 where (nullif(member_filter,'') is null or c.actor_id=member_filter or c.member_id=member_filter)
 and (nullif(action_filter,'') is null or c.action=action_filter)
 and (date_from is null or c.recorded_at >= (date_from::timestamp at time zone 'America/New_York'))
 and (date_until is null or c.recorded_at < ((date_until+1)::timestamp at time zone 'America/New_York'))
 ), paged as (select * from filtered order by recorded_at desc,id desc limit 25 offset page_offset)
 select jsonb_build_object('entries',coalesce((select jsonb_agg(to_jsonb(p) order by recorded_at desc,id desc) from paged p),'[]'::jsonb),'total',(select count(*) from filtered),'members',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'email',email) order by lower(name),id) from public.profiles),'[]'::jsonb)) into result;
 return result;
end;
$$;
revoke all on function public.portal_admin_audit(text,text,date,date,integer) from public,anon;
grant execute on function public.portal_admin_audit(text,text,date,date,integer) to authenticated;
