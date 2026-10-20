alter table public.profiles add column if not exists photo_data_url text not null default '';
create or replace function public.portal_update_profile(profile_data jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare member_id text:=auth.uid()::text; photo text; image_bytes bytea;
begin
 if not exists(select 1 from auth.users a join public.profiles p on p.id=a.id::text where a.id::text=member_id and a.email_confirmed_at is not null and p.disabled=0 and p.deleted_at is null) then
 raise exception 'Sign in with an active, confirmed account to save your profile.' using errcode='42501'; end if;
 if length(trim(coalesce(profile_data->>'name','')))=0 or length(profile_data->>'name')>80 or length(profile_data->>'major')>120 or length(profile_data->>'year')>40 or length(profile_data->>'bio')>500 then raise exception 'Check your profile name, major, year, and bio lengths.'; end if;
 photo:=profile_data->>'photo_data_url';
 if photo is not null and photo<>'' then
  if length(photo)>120000 or photo !~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$' then raise exception 'Choose a JPG, PNG, or WebP photo using Upload photo.'; end if;
  image_bytes:=decode(substring(photo from 24),'base64');
  if octet_length(image_bytes)<5 or encode(substring(image_bytes from 1 for 3),'hex')<>'ffd8ff' or encode(substring(image_bytes from octet_length(image_bytes)-1 for 2),'hex')<>'ffd9' then raise exception 'The uploaded photo is invalid. Choose another image.'; end if;
 end if;
 update public.profiles set name=trim(profile_data->>'name'),major=coalesce(profile_data->>'major',''),year=coalesce(profile_data->>'year',''),bio=coalesce(profile_data->>'bio',''),photo_data_url=coalesce(photo,photo_data_url) where id=member_id;
 return jsonb_build_object('ok',true);
end;
$$;
revoke all on function public.portal_update_profile(jsonb) from public,anon;
grant execute on function public.portal_update_profile(jsonb) to authenticated;

create or replace function public.portal_directory(member_id text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if not exists(select 1 from auth.users a join public.profiles p on p.id=a.id::text
 where a.id=auth.uid() and a.email_confirmed_at is not null and p.disabled=0) then
 raise exception 'Sign in with an active, confirmed account to view members.' using errcode='42501';
 end if;
 if member_id is null then
 select jsonb_build_object('members',coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'major',p.major,'year',p.year,'photo_data_url',p.photo_data_url) order by lower(p.name),p.id),'[]'::jsonb))
 into result from public.profiles p join auth.users a on a.id::text=p.id where p.disabled=0;
 else
 select jsonb_build_object('member',jsonb_build_object('id',p.id,'name',p.name,'major',p.major,'year',p.year,'bio',p.bio,'photo_data_url',p.photo_data_url))
 into result from public.profiles p join auth.users a on a.id::text=p.id where p.disabled=0 and p.id=member_id;
 if result is null then raise exception 'This member profile is unavailable.'; end if;
 end if;
 return result;
end;
$$;
revoke all on function public.portal_directory(text) from public,anon;
grant execute on function public.portal_directory(text) to authenticated;
