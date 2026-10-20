alter table public.profiles add column if not exists chapter_title text not null default '';
-- Titles are descriptive; they do not change authorization flags.
update public.profiles set chapter_title='President' where id='4c502ace-898d-4eeb-bdec-5ebb21e2dc57' and lower(email)='jace.roman@temple.edu';
update public.profiles set chapter_title='Co-President' where id='f79aed01-6793-44c2-acc4-66c6c8ad183b' and lower(email)='tuv13760@temple.edu';
select name,email,chapter_title,eboard from public.profiles where id in ('4c502ace-898d-4eeb-bdec-5ebb21e2dc57','f79aed01-6793-44c2-acc4-66c6c8ad183b');
