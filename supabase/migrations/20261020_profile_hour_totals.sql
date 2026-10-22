-- Match approved totals to nonremoved ledger entries; decimal arithmetic preserves hundredths.
create or replace function public.portal_approved_hours(member_id text)
returns numeric language sql stable set search_path=public,pg_temp as $$
 select coalesce(round(sum((payload->>'hours')::numeric),2),0) from public.hours where owner=member_id and deleted=0 and payload->>'status'='Approved';
$$;
revoke all on function public.portal_approved_hours(text) from public,anon,authenticated;
create or replace function public.portal_directory(member_id text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if not exists(select 1 from auth.users a join public.profiles p on p.id=a.id::text
 where a.id=auth.uid() and a.email_confirmed_at is not null and p.disabled=0) then
 raise exception 'Sign in with an active, confirmed account to view members.' using errcode='42501';
 end if;
 if member_id is null then
 select jsonb_build_object('members',coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'major',p.major,'year',p.year,'photo_data_url',p.photo_data_url,'chapter_title',p.chapter_title,'approved_hours',public.portal_approved_hours(p.id)) order by lower(p.name),p.id),'[]'::jsonb))
 into result from public.profiles p join auth.users a on a.id::text=p.id where p.disabled=0;
 else
 select jsonb_build_object('member',jsonb_build_object('id',p.id,'name',p.name,'major',p.major,'year',p.year,'bio',p.bio,'photo_data_url',p.photo_data_url,'chapter_title',p.chapter_title,'approved_hours',public.portal_approved_hours(p.id)))
 into result from public.profiles p join auth.users a on a.id::text=p.id where p.disabled=0 and p.id=member_id;
 if result is null then raise exception 'This member profile is unavailable.'; end if;
 end if;
 return result;
end;
$$;
revoke all on function public.portal_directory(text) from public,anon;
grant execute on function public.portal_directory(text) to authenticated;

