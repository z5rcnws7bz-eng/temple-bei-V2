-- Vercel uses Supabase Auth; Sites continues to use its Worker/D1 backend.
-- This RPC derives identity and roles on the server, never from browser headers.
alter table public.profiles add column if not exists eboard integer not null default 0;
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
    select * into target from public.profiles where id=body->>'id';
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
    if length(trim(coalesce(body->>'name','')))=0 then raise exception 'Enter your name.'; end if;
    update public.profiles set name=left(trim(body->>'name'),80),major=left(coalesce(body->>'major',''),120),year=left(coalesce(body->>'year',''),40),bio=left(coalesce(body->>'bio',''),500) where id=member.id;
    return '{"ok":true}'::jsonb;
  elsif path='availability' and method='PUT' then
    if jsonb_typeof(body)<>'array' or jsonb_array_length(body)<>7 then raise exception 'Provide availability for all seven days.'; end if;
    update public.profiles set availability=body::text where id=member.id;
    return '{"ok":true}'::jsonb;
  elsif path='directory' and method='GET' then
    return jsonb_build_object('members',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'major',major,'year',year)) from public.profiles where disabled=0),'[]'::jsonb));
  elsif path like 'directory/%' and method='GET' then
    select jsonb_build_object('id',id,'name',name,'major',major,'year',year,'bio',bio) into result from public.profiles where id=substring(path from 11) and disabled=0;
    if result is null then raise exception 'Member not found.'; end if;
    return jsonb_build_object('member',result);
  end if;
  raise exception 'This workflow is not connected to the Vercel backend yet. Contact chapter leadership.';
end;
$$;
revoke all on function public.portal_request(text,text,jsonb) from public, anon;
grant execute on function public.portal_request(text,text,jsonb) to authenticated;

-- Browser clients must not write role or suspension columns directly.
-- All role changes pass through the authenticated, admin-checked RPC above.
revoke insert,update,delete on public.profiles from anon,authenticated;
grant update(name,major,year,bio,availability) on public.profiles to authenticated;
-- Replace the prototype's anonymous write policy with ownership checks.
drop policy if exists "Allow user insert own profile" on public.profiles;
drop policy if exists "Allow authenticated update own profile" on public.profiles;
create policy "Allow authenticated update own profile" on public.profiles for update to authenticated using(auth.uid()::text=id) with check(auth.uid()::text=id);
