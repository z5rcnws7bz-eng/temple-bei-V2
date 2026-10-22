create or replace function public.portal_directory(member_id text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if not exists(select 1 from auth.users a join public.profiles p on p.id=a.id::text
 where a.id=auth.uid() and a.email_confirmed_at is not null and p.disabled=0) then
 raise exception 'Sign in with an active, confirmed account to view members.' using errcode='42501';
 end if;
 if member_id is null then
 select jsonb_build_object('members',coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'major',p.major,'year',p.year,'photo_data_url',p.photo_data_url,'chapter_title',p.chapter_title) order by lower(p.name),p.id),'[]'::jsonb))
 into result from public.profiles p join auth.users a on a.id::text=p.id where p.disabled=0;
 else
 select jsonb_build_object('member',jsonb_build_object('id',p.id,'name',p.name,'major',p.major,'year',p.year,'bio',p.bio,'photo_data_url',p.photo_data_url,'chapter_title',p.chapter_title))
 into result from public.profiles p join auth.users a on a.id::text=p.id where p.disabled=0 and p.id=member_id;
 if result is null then raise exception 'This member profile is unavailable.'; end if;
 end if;
 return result;
end;
$$;
revoke all on function public.portal_directory(text) from public,anon;
grant execute on function public.portal_directory(text) to authenticated;

create or replace function public.portal_save_availability(availability_data jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare slot jsonb; days text[]:=array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']; seen text[]:=array[]::text[];
begin
 if not exists(select 1 from public.profiles p join auth.users a on a.id::text=p.id where a.id=auth.uid() and a.email_confirmed_at is not null and p.disabled=0 and p.deleted_at is null) then raise exception 'Sign in with an active, confirmed account.' using errcode='42501'; end if;
 if jsonb_typeof(availability_data) is distinct from 'array' then raise exception 'Provide availability for all seven days.'; end if;
 if jsonb_array_length(availability_data)<>7 then raise exception 'Provide availability for all seven days.'; end if;
 for slot in select value from jsonb_array_elements(availability_data) loop
 if coalesce(slot->>'day','')<>all(days) or (slot->>'day')=any(seen) or jsonb_typeof(slot->'enabled') is distinct from 'boolean' or coalesce(slot->>'start','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(slot->>'end','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Choose each day once with valid start and end times.'; end if;
 if (slot->>'enabled')::boolean and slot->>'start'>=slot->>'end' then raise exception 'End times must be later than start times.'; end if;
 seen:=array_append(seen,slot->>'day');
 end loop;
 -- Identity comes from the signed-in account, never a supplied profile ID.
 update public.profiles set availability=availability_data::text where id=auth.uid()::text;
 return jsonb_build_object('ok',true,'availability',availability_data);
end $$;
revoke all on function public.portal_save_availability(jsonb) from public,anon;
grant execute on function public.portal_save_availability(jsonb) to authenticated;
