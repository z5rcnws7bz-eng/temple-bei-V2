-- Audit rows deliberately have no cascading foreign keys: retain history after account removal.
create table if not exists public.hour_audit (
 id bigint generated always as identity primary key,
 recorded_at timestamptz not null default clock_timestamp(),
 actor_id text, actor_name text, actor_role text not null,
 database_role text not null, operation text not null,
 entry_id text not null, owner_id text not null,
 before_record jsonb, after_record jsonb
);
alter table public.hour_audit enable row level security;
revoke all on public.hour_audit from public,anon,authenticated;
create or replace function public.audit_hour_change() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor_name text; actor_role text;
begin
 select p.name,case when a.raw_app_meta_data->>'portal_role'='admin' then 'admin' when p.eboard<>0 then 'eboard' else 'member' end
 into actor_name,actor_role from public.profiles p join auth.users a on a.id::text=p.id where a.id=auth.uid();
 insert into public.hour_audit(actor_id,actor_name,actor_role,database_role,operation,entry_id,owner_id,before_record,after_record)
 values(auth.uid()::text,actor_name,coalesce(actor_role,'database'),session_user,TG_OP,coalesce(new.id,old.id),coalesce(new.owner,old.owner),case when TG_OP<>'INSERT' then to_jsonb(old) end,case when TG_OP<>'DELETE' then to_jsonb(new) end);
 return coalesce(new,old);
end $$;
create or replace trigger audit_hours after insert or update or delete on public.hours for each row execute function public.audit_hour_change();
revoke all on function public.audit_hour_change() from public,anon,authenticated;
-- Clients must use role-checked RPCs; direct writes could otherwise forge approval.
revoke insert,update,delete,truncate on public.hours from anon,authenticated;

create or replace function public.portal_hours_action(action text,entry_data jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor public.profiles; officer boolean; administrator boolean; target public.hours; record_data jsonb; entry_id text; hours_value numeric; entry_date date;
begin
 select p.* into actor from public.profiles p join auth.users a on a.id::text=p.id where a.id=auth.uid() and a.email_confirmed_at is not null and p.disabled=0 and p.deleted_at is null;
 if actor.id is null then raise exception 'Sign in with an active, confirmed account.' using errcode='42501'; end if;
 select coalesce(raw_app_meta_data->>'portal_role'='admin',false) into administrator from auth.users where id=auth.uid();
 officer:=coalesce(administrator,false) or actor.eboard<>0;
 entry_id:=nullif(entry_data->>'id','');
 if entry_id is not null then
 select * into target from public.hours where id=entry_id for update;
 if target.id is null then raise exception 'Hour entry not found.'; end if;
 if target.owner<>actor.id and not officer then raise exception 'You cannot change another member''s hours.' using errcode='42501'; end if;
 if not exists(select 1 from public.profiles where id=target.owner and deleted_at is null) then raise exception 'Archived hour records cannot be changed.'; end if;
 end if;
 if action='hours' then
 if coalesce(entry_data->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(entry_data->>'hours','') !~ '^\d+(\.\d+)?$' then raise exception 'Provide a valid past date and 0–24 hours.'; end if;
 begin entry_date:=(entry_data->>'date')::date; hours_value:=(entry_data->>'hours')::numeric; exception when datetime_field_overflow or invalid_datetime_format then raise exception 'Provide a valid date.'; end;
 if entry_date>(now() at time zone 'America/New_York')::date or hours_value<=0 or hours_value>24 or length(trim(coalesce(entry_data->>'activity','')))=0 or length(entry_data->>'activity')>200 or length(trim(coalesce(entry_data->>'facility','')))=0 or length(entry_data->>'facility')>200 or length(coalesce(entry_data->>'notes',''))>500 then raise exception 'Provide a valid past date, activity, facility, and 0–24 hours.'; end if;
 if target.deleted<>0 then raise exception 'Restore this entry before editing it.'; end if;
 record_data:=jsonb_build_object('date',entry_data->>'date','hours',hours_value,'activity',trim(entry_data->>'activity'),'facility',trim(entry_data->>'facility'),'notes',coalesce(entry_data->>'notes',''),'status',case when officer then 'Approved' else 'Pending' end,'reviewer',case when officer then actor.name||' (automatic)' else '' end,'approvalMethod',case when officer then 'officer_auto' else 'review_required' end,'volunteer',coalesce((select name from public.profiles where id=target.owner),actor.name));
 if target.id is null then entry_id:=gen_random_uuid()::text; insert into public.hours(id,owner,payload) values(entry_id,actor.id,record_data);
 else update public.hours set payload=record_data,updated=now() where id=target.id; end if;
 elsif action='hours/remove' then
 if target.id is null then raise exception 'Hour entry not found.'; end if;
 update public.hours set deleted=1,updated=now() where id=target.id and deleted=0;
 elsif action='hours/restore' then
 if target.id is null or target.deleted=0 then raise exception 'Removed entry not found.'; end if;
 update public.hours set deleted=0,updated=now(),payload=payload||jsonb_build_object('status',case when officer then 'Approved' else 'Pending' end,'reviewer',case when officer then actor.name||' (automatic)' else '' end,'reason','','approvalMethod',case when officer then 'officer_auto' else 'review_required' end) where id=target.id;
 elsif action='board/review' then
 if not officer then raise exception 'Only chapter officers may review hours.' using errcode='42501'; end if;
 if target.id is null or target.deleted<>0 then raise exception 'Hour entry not found.'; end if;
 if target.payload->>'status'<>'Pending' then raise exception 'This entry has already been reviewed.'; end if;
 if coalesce(entry_data->>'status','') not in ('Approved','Returned') or (entry_data->>'status'='Returned' and length(trim(coalesce(entry_data->>'reason','')))=0) or length(coalesce(entry_data->>'reason',''))>500 then raise exception 'Choose an approval action and provide feedback for returned entries.'; end if;
 update public.hours set payload=payload||jsonb_build_object('status',entry_data->>'status','reviewer',actor.name,'reason',coalesce(entry_data->>'reason',''),'reviewedAt',now(),'approvalMethod','officer_review'),updated=now() where id=target.id;
 else raise exception 'Unknown hour action.';
 end if;
 return jsonb_build_object('ok',true,'id',entry_id);
end $$;
revoke all on function public.portal_hours_action(text,jsonb) from public,anon;
grant execute on function public.portal_hours_action(text,jsonb) to authenticated;

-- Profile role flags are maintained by the administrator RPC, never a direct client update.
revoke insert,update,delete on public.profiles from anon,authenticated;
