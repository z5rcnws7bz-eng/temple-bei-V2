-- Delete authentication, retain linked chapter records in a disabled archive.
alter table public.profiles add column if not exists deleted_at timestamptz;
alter table public.profiles add column if not exists deleted_by text;

create or replace function public.portal_admin_members()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from auth.users a join public.profiles p on p.id=a.id::text
 where a.id=auth.uid() and a.email_confirmed_at is not null and p.disabled=0 and p.deleted_at is null and a.raw_app_meta_data->>'portal_role'='admin') then
 raise exception 'Only chapter administrators can manage members.' using errcode='42501'; end if;
 return jsonb_build_object('members',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('eboard',p.eboard<>0,'disabled',p.disabled<>0) order by p.created desc)
 from public.profiles p join auth.users a on a.id::text=p.id where p.deleted_at is null),'[]'::jsonb));
end;
$$;
revoke all on function public.portal_admin_members() from public,anon;
grant execute on function public.portal_admin_members() to authenticated;

create or replace function public.portal_delete_member(member_id text, confirmation_email text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid(); target auth.users%rowtype;
begin
 if not exists(select 1 from auth.users a join public.profiles p on p.id=a.id::text
 where a.id=actor and a.email_confirmed_at is not null and p.disabled=0 and p.deleted_at is null and a.raw_app_meta_data->>'portal_role'='admin') then
 raise exception 'Only chapter administrators can delete accounts.' using errcode='42501'; end if;
 if member_id=actor::text then raise exception 'You cannot delete your own administrator account.'; end if;
 select * into target from auth.users where id::text=member_id for update;
 if target.id is null then raise exception 'This account no longer exists. Refresh the member list.'; end if;
 if lower(trim(coalesce(confirmation_email,'')))<>lower(target.email) then raise exception 'Type the member email exactly to confirm deletion.'; end if;
 -- Fail closed if a future schema change would cascade away retained data.
 if exists(select 1 from pg_constraint where contype='f' and conrelid='public.profiles'::regclass and confrelid='auth.users'::regclass) then
 raise exception 'Account deletion is blocked because the archive needs a database migration.'; end if;
 if exists(select 1 from storage.objects where owner=target.id) then
 raise exception 'This account owns uploaded files. Transfer file ownership before deleting the account.'; end if;
 update public.profiles set disabled=1,eboard=0,deleted_at=now(),deleted_by=actor::text where id=member_id;
 if not found then raise exception 'The member profile is missing; no account was deleted.'; end if;
 -- profiles is deliberately retained; hours/bookings reference profiles, not Auth.
 -- Supabase removes identities and refresh sessions through Auth FK cascades.
 delete from auth.users where id=target.id;
 return jsonb_build_object('ok',true,'retained_data',true);
end;
$$;
revoke all on function public.portal_delete_member(text,text) from public,anon;
grant execute on function public.portal_delete_member(text,text) to authenticated;

-- Keep archived members out of operational rosters and review queues too.
create or replace function public.portal_board_data()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb; key text;
begin
 result:=public.portal_request('board');
 foreach key in array array['hours','roster'] loop
  result:=jsonb_set(result,array[key],coalesce((select jsonb_agg(v) from jsonb_array_elements(result->key) v
   where not exists(select 1 from public.profiles p where p.id=v->>'owner' and p.deleted_at is not null)),'[]'::jsonb));
 end loop;
 return result;
end;
$$;
revoke all on function public.portal_board_data() from public,anon;
grant execute on function public.portal_board_data() to authenticated;

-- Retained records are database archives, not editable browser records.
drop policy if exists protect_archived_hours on public.hours;
create policy protect_archived_hours on public.hours as restrictive for all to anon,authenticated
 using(exists(select 1 from public.profiles p where p.id=owner and p.deleted_at is null))
 with check(exists(select 1 from public.profiles p where p.id=owner and p.deleted_at is null));
drop policy if exists protect_archived_bookings on public.bookings;
create policy protect_archived_bookings on public.bookings as restrictive for all to anon,authenticated
 using(exists(select 1 from public.profiles p where p.id=owner and p.deleted_at is null))
 with check(exists(select 1 from public.profiles p where p.id=owner and p.deleted_at is null));
