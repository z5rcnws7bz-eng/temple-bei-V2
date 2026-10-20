alter table public.newsletters add column if not exists author_id text;
alter table public.newsletters add column if not exists images jsonb not null default '[]'::jsonb;
alter table public.newsletters add column if not exists title_url text not null default '';
-- Attribute legacy posts only when the author's saved name identifies one account.
update public.newsletters n set author_id=p.id from public.profiles p where n.author_id is null and p.name=n.author and (select count(*) from public.profiles q where q.name=n.author)=1;
create or replace function public.portal_save_newsletter(newsletter_data jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor public.profiles; administrator boolean; existing public.newsletters; post_id text; image_data jsonb; image_text text; image_bytes bytea; title_link text;
begin
 select p.* into actor from public.profiles p join auth.users a on a.id::text=p.id where a.id=auth.uid() and a.email_confirmed_at is not null and p.disabled=0 and p.deleted_at is null;
 if actor.id is null then raise exception 'Sign in with an active, confirmed account.' using errcode='42501'; end if;
 select coalesce(raw_app_meta_data->>'portal_role'='admin',false) into administrator from auth.users where id=auth.uid();
 post_id:=coalesce(nullif(newsletter_data->>'id',''),gen_random_uuid()::text);
 -- Serialize creation/edit checks for a supplied ID to prevent ownership races.
 perform pg_advisory_xact_lock(hashtextextended('newsletter:'||post_id,0));
 select * into existing from public.newsletters where id=post_id for update;
 if existing.id is null then
 if not administrator and actor.eboard=0 then raise exception 'Only administrators and e-board members can create newsletters.' using errcode='42501'; end if;
 elsif not administrator and existing.author_id is distinct from actor.id then raise exception 'Only the author or an administrator can edit this newsletter.' using errcode='42501'; end if;
 if length(trim(coalesce(newsletter_data->>'title','')))=0 or length(newsletter_data->>'title')>160 or length(trim(coalesce(newsletter_data->>'body','')))=0 or length(newsletter_data->>'body')>20000 or jsonb_typeof(newsletter_data->'published') is distinct from 'boolean' then raise exception 'Add a title, newsletter text, and a publication choice.'; end if;
 title_link:=trim(coalesce(newsletter_data->>'title_url',''));
 if length(title_link)>2000 or (title_link<>'' and title_link !~* '^https?://[^[:space:]]+$') then raise exception 'Use an http:// or https:// title link.'; end if;
 image_data:=coalesce(newsletter_data->'images','[]'::jsonb);
 if jsonb_typeof(image_data)<>'array' then raise exception 'Choose up to 3 newsletter images.'; end if;
 if jsonb_array_length(image_data)>3 then raise exception 'Choose up to 3 newsletter images.'; end if;
 for image_text in select value #>> '{}' from jsonb_array_elements(image_data) loop
 if image_text is null or length(image_text)>700000 or image_text !~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$' then raise exception 'Upload valid JPG, PNG, or WebP images through the image picker.'; end if;
 image_bytes:=decode(substring(image_text from 24),'base64');
 if octet_length(image_bytes)<5 or encode(substring(image_bytes from 1 for 3),'hex')<>'ffd8ff' or encode(substring(image_bytes from octet_length(image_bytes)-1 for 2),'hex')<>'ffd9' then raise exception 'The uploaded image is invalid.'; end if;
 end loop;
 insert into public.newsletters(id,title,body,published,author,author_id,images,title_url,updated)
 values(post_id,trim(newsletter_data->>'title'),newsletter_data->>'body',case when (newsletter_data->>'published')::boolean then 1 else 0 end,actor.name,actor.id,image_data,title_link,now())
 on conflict(id) do update set title=excluded.title,body=excluded.body,published=excluded.published,images=excluded.images,title_url=excluded.title_url,updated=excluded.updated;
 return jsonb_build_object('ok',true,'id',post_id);
end $$;
revoke all on function public.portal_save_newsletter(jsonb) from public,anon;
grant execute on function public.portal_save_newsletter(jsonb) to authenticated;
-- State/board RPCs control publication visibility and hide drafts from ordinary members.
revoke all on public.newsletters from anon,authenticated;
