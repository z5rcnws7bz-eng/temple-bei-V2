-- Append-only history attributed to the actual database-authenticated account.
-- No cascading foreign keys: history survives account/content deletion.
create table if not exists public.portal_activity_audit (
 id bigint generated always as identity primary key,
 recorded_at timestamptz not null default clock_timestamp(),
 actor_id text, actor_name text, actor_email text, actor_role text not null,
 database_role text not null, operation text not null,
 resource_table text not null, resource_id text not null,
 before_record jsonb, after_record jsonb
);
alter table public.portal_activity_audit enable row level security;
revoke all on public.portal_activity_audit from public,anon,authenticated;
create index if not exists portal_activity_audit_actor_time on public.portal_activity_audit(actor_id,recorded_at desc);
create index if not exists portal_activity_audit_resource_time on public.portal_activity_audit(resource_table,resource_id,recorded_at desc);

-- Record image fingerprints instead of duplicating large image payloads in the log.
create or replace function public.portal_audit_snapshot(record_data jsonb)
returns jsonb language sql immutable set search_path=public,pg_temp as $$
 select case when record_data is null then null else
 (record_data-'photo_data_url'-'images')
 ||case when record_data ? 'photo_data_url' then jsonb_build_object('photo_fingerprint',md5(coalesce(record_data->>'photo_data_url',''))) else '{}'::jsonb end
 ||case when jsonb_typeof(record_data->'images')='array' then jsonb_build_object('image_fingerprints',coalesce((select jsonb_agg(md5(image_data)) from jsonb_array_elements_text(record_data->'images') image_data),'[]'::jsonb)) else '{}'::jsonb end end;
$$;
revoke all on function public.portal_audit_snapshot(jsonb) from public,anon,authenticated;

create or replace function public.audit_portal_activity() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor_name text; actor_email text; actor_role text; old_data jsonb; new_data jsonb;
begin
 if TG_OP='UPDATE' and new is not distinct from old then return new; end if;
 select p.name,a.email,case when a.raw_app_meta_data->>'portal_role'='admin' then 'admin' when p.eboard<>0 then 'eboard' else 'member' end
 into actor_name,actor_email,actor_role from public.profiles p join auth.users a on a.id::text=p.id where a.id=auth.uid();
 if TG_OP<>'INSERT' then old_data:=to_jsonb(old); end if;
 if TG_OP<>'DELETE' then new_data:=to_jsonb(new); end if;
 insert into public.portal_activity_audit(actor_id,actor_name,actor_email,actor_role,database_role,operation,resource_table,resource_id,before_record,after_record)
 values(auth.uid()::text,actor_name,actor_email,coalesce(actor_role,'database'),session_user,TG_OP,TG_TABLE_NAME,coalesce(new_data->>'id',old_data->>'id'),public.portal_audit_snapshot(old_data),public.portal_audit_snapshot(new_data));
 return coalesce(new,old);
end $$;
revoke all on function public.audit_portal_activity() from public,anon,authenticated;
create or replace trigger audit_profile_activity after insert or update or delete on public.profiles for each row execute function public.audit_portal_activity();
create or replace trigger audit_shift_activity after insert or update or delete on public.shifts for each row execute function public.audit_portal_activity();
create or replace trigger audit_booking_activity after insert or update or delete on public.bookings for each row execute function public.audit_portal_activity();
create or replace trigger audit_newsletter_activity after insert or update or delete on public.newsletters for each row execute function public.audit_portal_activity();
