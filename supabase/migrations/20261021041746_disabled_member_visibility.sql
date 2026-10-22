-- Disabled is reversible; deletion remains a separate archive/auth removal.
create or replace function public.portal_directory(member_id text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if not exists(select 1 from auth.users a join public.profiles p on p.id=a.id::text
 where a.id=auth.uid() and a.email_confirmed_at is not null and p.disabled=0) then
 raise exception 'Sign in with an active, confirmed account to view members.' using errcode='42501';
 end if;
 if member_id is null then
 select jsonb_build_object('members',coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'major',p.major,'year',p.year,'photo_data_url',p.photo_data_url,'chapter_title',p.chapter_title,'approved_hours',public.portal_approved_hours(p.id),'disabled',p.disabled<>0) order by lower(p.name),p.id),'[]'::jsonb))
 into result from public.profiles p join auth.users a on a.id::text=p.id where p.deleted_at is null;
 else
 select jsonb_build_object('member',jsonb_build_object('id',p.id,'name',p.name,'major',p.major,'year',p.year,'bio',p.bio,'photo_data_url',p.photo_data_url,'chapter_title',p.chapter_title,'approved_hours',public.portal_approved_hours(p.id),'disabled',p.disabled<>0))
 into result from public.profiles p join auth.users a on a.id::text=p.id where p.deleted_at is null and p.id=member_id;
 if result is null then raise exception 'This member profile is unavailable.'; end if;
 end if;
 return result;
end;
$$;
revoke all on function public.portal_directory(text) from public,anon;
grant execute on function public.portal_directory(text) to authenticated;


-- Only active leadership may list account controls. Deleted accounts remain excluded.
create or replace function public.portal_admin_members()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from auth.users a join public.profiles p on p.id=a.id::text
 where a.id=auth.uid() and a.email_confirmed_at is not null and p.disabled=0 and p.deleted_at is null
 and (a.raw_app_meta_data->>'portal_role'='admin' or p.eboard<>0)) then
 raise exception 'Chapter leadership access is required.' using errcode='42501'; end if;
 return jsonb_build_object('members',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('eboard',p.eboard<>0,'disabled',p.disabled<>0,'is_admin',coalesce(a.raw_app_meta_data->>'portal_role','')='admin') order by p.created desc)
 from public.profiles p join auth.users a on a.id::text=p.id where p.deleted_at is null),'[]'::jsonb));
end;
$$;
revoke all on function public.portal_admin_members() from public,anon;
grant execute on function public.portal_admin_members() to authenticated;

-- A narrow access toggle: officers cannot grant roles, delete accounts, or suspend admins.
create or replace function public.portal_set_member_disabled(member_id text, disabled boolean)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor_admin boolean; target_admin boolean;
begin
 select coalesce(a.raw_app_meta_data->>'portal_role','')='admin' into actor_admin
 from auth.users a join public.profiles p on p.id=a.id::text
 where a.id=auth.uid() and a.email_confirmed_at is not null and p.disabled=0 and p.deleted_at is null
 and (a.raw_app_meta_data->>'portal_role'='admin' or p.eboard<>0) for update of p;
 if actor_admin is null then raise exception 'Chapter leadership access is required.' using errcode='42501'; end if;
 if member_id=auth.uid()::text then raise exception 'You cannot change your own membership access.'; end if;
 if disabled is null then raise exception 'Choose whether this account is disabled.'; end if;
 select coalesce(a.raw_app_meta_data->>'portal_role','')='admin' into target_admin
 from public.profiles p join auth.users a on a.id::text=p.id
 where p.id=member_id and p.deleted_at is null for update of p;
 if target_admin is null then raise exception 'Member not found.'; end if;
 if target_admin and not actor_admin then raise exception 'Only administrators can change administrator access.' using errcode='42501'; end if;
 update public.profiles p set disabled=case when portal_set_member_disabled.disabled then 1 else 0 end where p.id=member_id;
 return jsonb_build_object('ok',true,'disabled',disabled);
end;
$$;
revoke all on function public.portal_set_member_disabled(text,boolean) from public,anon;
grant execute on function public.portal_set_member_disabled(text,boolean) to authenticated;
