-- Browser clients use authenticated, account-bound RPCs exclusively.
revoke all on public.profiles,public.hours,public.shifts,public.bookings,public.newsletters,public.attempts from public,anon,authenticated;
do $$
declare r record; cols text;
begin
 for r in select tablename from pg_tables where schemaname='public' and tablename in ('profiles','hours','shifts','bookings','newsletters','attempts') loop
  select string_agg(quote_ident(column_name),',') into cols from information_schema.columns where table_schema='public' and table_name=r.tablename;
  execute format('revoke select(%1$s),insert(%1$s),update(%1$s),references(%1$s) on table public.%2$I from public,anon,authenticated',cols,r.tablename);
  execute format('alter table public.%I enable row level security',r.tablename);
 end loop;
 for r in select tablename,policyname from pg_policies where schemaname='public' and tablename in ('profiles','hours','shifts','bookings','newsletters','attempts') loop
  execute format('drop policy %I on public.%I',r.policyname,r.tablename);
 end loop;
end $$;
-- Trigger-only helper must not be exposed as an anonymous RPC.
alter function public.handle_new_user() set search_path=public,pg_temp;
revoke all on function public.handle_new_user() from public,anon,authenticated;

create or replace function public.portal_request(path text, method text default 'GET', body jsonb default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  account auth.users%rowtype;
  member public.profiles%rowtype;
  admin boolean;
  officer boolean;
  target public.profiles%rowtype;
  result jsonb;
  default_availability jsonb := '[{"day":"Monday","enabled":false,"start":"14:00","end":"17:00"},{"day":"Tuesday","enabled":false,"start":"14:00","end":"17:00"},{"day":"Wednesday","enabled":false,"start":"14:00","end":"17:00"},{"day":"Thursday","enabled":false,"start":"14:00","end":"17:00"},{"day":"Friday","enabled":false,"start":"14:00","end":"17:00"},{"day":"Saturday","enabled":false,"start":"14:00","end":"17:00"},{"day":"Sunday","enabled":false,"start":"14:00","end":"17:00"}]';
begin
  select * into account from auth.users where id = auth.uid();
  if account.id is null or account.email_confirmed_at is null then
    raise exception 'Confirm your email and sign in to continue.' using errcode = '42501';
  end if;
  admin := coalesce(account.raw_app_meta_data->>'portal_role', '') = 'admin';
  insert into public.profiles(id,email,name,created)
    values(account.id::text, account.email, coalesce(nullif(account.raw_user_meta_data->>'name',''), split_part(account.email,'@',1)), now())
    on conflict(id) do nothing;
  select * into member from public.profiles where id = account.id::text;
  if member.disabled <> 0 then raise exception 'Your membership is disabled. Contact chapter leadership.' using errcode='42501'; end if;
  officer := admin or member.eboard <> 0;
  if path = 'state' and method = 'GET' then
    return jsonb_build_object(
      'user',jsonb_build_object('id',account.id,'email',account.email,'name',member.name,'admin',admin,'eboard',officer),
      'profile',to_jsonb(member),
      'availability',case when member.availability::jsonb = '[]'::jsonb then default_availability else member.availability::jsonb end,
      'hours',coalesce((select jsonb_agg(payload || jsonb_build_object('id',id)) from public.hours where owner=member.id and deleted=0),'[]'::jsonb),
      'trash',coalesce((select jsonb_agg(payload || jsonb_build_object('id',id)) from public.hours where owner=member.id and deleted<>0),'[]'::jsonb),
      'shifts',coalesce((select jsonb_agg(s.payload || jsonb_build_object('id',s.id,'capacity',s.capacity,'taken',s.taken,'mine',exists(select 1 from public.bookings b where b.shift_id=s.id and b.owner=member.id))) from public.shifts s),'[]'::jsonb),
      'newsletters',coalesce((select jsonb_agg(to_jsonb(n)) from public.newsletters n where published=1),'[]'::jsonb),
      'roster','[]'::jsonb);
  elsif path = 'admin' and method = 'GET' then
    if not admin then raise exception 'Only chapter administrators can manage members.' using errcode='42501'; end if;
    return jsonb_build_object('members',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('eboard',p.eboard<>0,'disabled',p.disabled<>0)) from public.profiles p),'[]'::jsonb));
  elsif path = 'admin/member' and method = 'POST' then
    if not admin then raise exception 'Only chapter administrators can manage members.' using errcode='42501'; end if;
    if body->>'id' = member.id then raise exception 'You cannot change your own membership access.'; end if;
    select * into target from public.profiles p where p.id=body->>'id' and p.deleted_at is null and exists(select 1 from auth.users a where a.id::text=p.id);
    if target.id is null then raise exception 'Member not found.'; end if;
    if body ? 'eboard' then update public.profiles set eboard=case when (body->>'eboard')::boolean then 1 else 0 end where id=target.id; end if;
    if body ? 'disabled' then update public.profiles set disabled=case when (body->>'disabled')::boolean then 1 else 0 end where id=target.id; end if;
    return '{"ok":true}'::jsonb;
  elsif path in ('board','board/roster') and method='GET' then
    if not officer then raise exception 'Executive board access is required.' using errcode='42501'; end if;
    return jsonb_build_object(
      'hours',coalesce((select jsonb_agg(h.payload||jsonb_build_object('id',h.id,'owner',h.owner,'volunteer',p.name)) from public.hours h join public.profiles p on p.id=h.owner where h.deleted=0),'[]'::jsonb),
      'newsletters',coalesce((select jsonb_agg(to_jsonb(n)) from public.newsletters n),'[]'::jsonb),
      'members',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('availability',p.availability::jsonb)) from public.profiles p where disabled=0),'[]'::jsonb),
      'roster',coalesce((select jsonb_agg(jsonb_build_object('shift_id',b.shift_id,'owner',b.owner,'name',p.name,'email',p.email)) from public.bookings b join public.profiles p on p.id=b.owner),'[]'::jsonb));
  elsif path='profile' and method='PUT' then
    return public.portal_update_profile(body);
  elsif path='availability' and method='PUT' then
    return public.portal_save_availability(body);
  elsif path='directory' and method='GET' then
    return public.portal_directory(null);
  elsif path like 'directory/%' and method='GET' then
    return public.portal_directory(substring(path from 11));
  end if;
  raise exception 'This workflow is not connected to the Vercel backend yet. Contact chapter leadership.';
end;
$$;
revoke all on function public.portal_request(text,text,jsonb) from public, anon;
grant execute on function public.portal_request(text,text,jsonb) to authenticated;


-- Private per-account budgets serialize concurrent writes. Normal seven-member workflows
-- remain well below these limits. Rejected transactions commit neither data nor audit changes.
create table if not exists public.portal_write_limits(
 actor_id text primary key,minute_bucket timestamptz not null,minute_count integer not null,
 hour_bucket timestamptz not null,hour_count integer not null
);
alter table public.portal_write_limits enable row level security;
revoke all on public.portal_write_limits from public,anon,authenticated;
create or replace function public.portal_limit_writes() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor text:=auth.uid()::text; minute_now timestamptz:=date_trunc('minute',clock_timestamp());hour_now timestamptz:=date_trunc('hour',clock_timestamp()); hits public.portal_write_limits;
begin
 if actor is null or (TG_OP='UPDATE' and new is not distinct from old) then return coalesce(new,old);end if;
 insert into public.portal_write_limits(actor_id,minute_bucket,minute_count,hour_bucket,hour_count) values(actor,minute_now,1,hour_now,1)
 on conflict(actor_id) do update set
 minute_count=case when portal_write_limits.minute_bucket=excluded.minute_bucket then portal_write_limits.minute_count+1 else 1 end,
 minute_bucket=excluded.minute_bucket,
 hour_count=case when portal_write_limits.hour_bucket=excluded.hour_bucket then portal_write_limits.hour_count+1 else 1 end,
 hour_bucket=excluded.hour_bucket returning * into hits;
 if hits.minute_count>120 or hits.hour_count>1000 then raise exception 'Too many changes. Please wait before trying again or contact chapter leadership.' using errcode='PT429';end if;
 return coalesce(new,old);
end $$;
revoke all on function public.portal_limit_writes() from public,anon,authenticated;
create or replace trigger limit_profile_writes after insert or update or delete on public.profiles for each row execute function public.portal_limit_writes();
create or replace trigger limit_hour_writes after insert or update or delete on public.hours for each row execute function public.portal_limit_writes();
create or replace trigger limit_shift_writes after insert or update or delete on public.shifts for each row execute function public.portal_limit_writes();
create or replace trigger limit_booking_writes after insert or update or delete on public.bookings for each row execute function public.portal_limit_writes();
create or replace trigger limit_newsletter_writes after insert or update or delete on public.newsletters for each row execute function public.portal_limit_writes();
