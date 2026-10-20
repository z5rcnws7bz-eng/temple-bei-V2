-- Keep account identity attached to one durable profile, without overwriting
-- academic details, saved bios, officer permissions, or suspension settings.
create or replace function public.sync_portal_profile()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.email is null then return new; end if;
 insert into public.profiles(id,email,name,created)
 values(new.id::text,new.email,coalesce(nullif(trim(new.raw_user_meta_data->>'name'),''),nullif(trim(new.raw_user_meta_data->>'full_name'),''),split_part(new.email,'@',1)),now())
 on conflict(id) do update set email=excluded.email,
 name=case when nullif(trim(profiles.name),'') is null or profiles.name=split_part(profiles.email,'@',1) then excluded.name else profiles.name end;
 return new;
end;
$$;
revoke all on function public.sync_portal_profile() from public,anon,authenticated;
create or replace trigger sync_portal_profile_account
 after insert or update of email,raw_user_meta_data on auth.users
 for each row execute function public.sync_portal_profile();
insert into public.profiles(id,email,name,created)
select id::text,email,coalesce(nullif(trim(raw_user_meta_data->>'name'),''),nullif(trim(raw_user_meta_data->>'full_name'),''),split_part(email,'@',1)),created_at
from auth.users where email is not null
on conflict(id) do update set email=excluded.email,
 name=case when nullif(trim(profiles.name),'') is null or profiles.name=split_part(profiles.email,'@',1) then excluded.name else profiles.name end;

create or replace function public.portal_directory(member_id text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if not exists(select 1 from auth.users a join public.profiles p on p.id=a.id::text
 where a.id=auth.uid() and a.email_confirmed_at is not null and p.disabled=0) then
 raise exception 'Sign in with an active, confirmed account to view members.' using errcode='42501';
 end if;
 if member_id is null then
 select jsonb_build_object('members',coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'major',p.major,'year',p.year) order by lower(p.name),p.id),'[]'::jsonb))
 into result from public.profiles p join auth.users a on a.id::text=p.id where p.disabled=0;
 else
 select jsonb_build_object('member',jsonb_build_object('id',p.id,'name',p.name,'major',p.major,'year',p.year,'bio',p.bio))
 into result from public.profiles p join auth.users a on a.id::text=p.id where p.disabled=0 and p.id=member_id;
 if result is null then raise exception 'This member profile is unavailable.'; end if;
 end if;
 return result;
end;
$$;
revoke all on function public.portal_directory(text) from public,anon;
grant execute on function public.portal_directory(text) to authenticated;
