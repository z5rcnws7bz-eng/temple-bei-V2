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
 case when a.resource_table='profiles' then a.resource_id when a.resource_table='bookings' then coalesce(a.after_record->>'owner',a.before_record->>'owner') end as member_id from public.portal_activity_audit a
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
