do $$
declare member_id text:='00000000-0000-4000-8000-000000000794'; response jsonb; notice text; secret_value text;
begin
 begin
 insert into auth.users(id,email,email_confirmed_at,aud,role,raw_user_meta_data) values(member_id::uuid,'reminder-test@example.invalid',now(),'authenticated','authenticated','{"name":"Reminder Test"}');
 insert into public.shifts(id,payload,capacity,taken) values('qa-reminder-794',jsonb_build_object('date',to_char((now()+interval '90 minutes') at time zone 'America/New_York','YYYY-MM-DD'),'start',to_char((now()+interval '90 minutes') at time zone 'America/New_York','HH24:MI'),'end',to_char((now()+interval '100 minutes') at time zone 'America/New_York','HH24:MI'),'facility','QA reminders'),1,1);
 insert into public.bookings(id,shift_id,owner) values(member_id||':qa-reminder-794','qa-reminder-794',member_id);
 perform public.portal_schedule_reminders();perform public.portal_schedule_reminders();
 if (select count(*) from public.portal_notifications where owner=member_id and kind='reminder_2h')<>1 then raise exception 'Scheduled reminder missing or duplicated';end if;
 begin perform public.portal_claim_reminder_emails('forged');raise exception 'Forged worker accepted';exception when insufficient_privilege then null;end;
 select decrypted_secret into secret_value from vault.decrypted_secrets where name='portal_reminder_worker_key';
 insert into public.shifts(id,payload,capacity,taken) values('qa-expired-reminder-794',jsonb_build_object('date',to_char((now()-interval '10 minutes') at time zone 'America/New_York','YYYY-MM-DD'),'start',to_char((now()-interval '10 minutes') at time zone 'America/New_York','HH24:MI'),'end',to_char((now()+interval '10 minutes') at time zone 'America/New_York','HH24:MI'),'facility','QA expired reminder'),1,1);
 insert into public.bookings(id,shift_id,owner) values(member_id||':qa-expired-reminder-794','qa-expired-reminder-794',member_id);
 perform public.portal_notify(member_id,'reminder_2h','qa-expired-reminder-794','QA expired reminder','Do not send after start');
 response:=public.portal_claim_reminder_emails(secret_value);
 if not exists(select 1 from public.portal_notifications where owner=member_id and shift_id='qa-expired-reminder-794' and kind='reminder_2h' and email_status='cancelled') then raise exception 'Expired reminder was not suppressed';end if;
 select id into notice from public.portal_notifications where owner=member_id and kind='reminder_2h' and shift_id='qa-reminder-794';
 if not exists(select 1 from public.portal_notifications where id=notice and email_status='sending' and email_attempts=1 and email_recipient='reminder-test@example.invalid') then raise exception 'Queue claim failed';end if;
 perform public.portal_finish_reminder_email(notice,1,false,'QA temporary error');
 if not exists(select 1 from public.portal_notifications where id=notice and email_status='retry' and next_attempt>now()) then raise exception 'Delivery retry failed';end if;
 update public.portal_notifications set email_status='sending',email_attempts=2 where id=notice;
 perform public.portal_finish_reminder_email(notice,1,true);
 if not exists(select 1 from public.portal_notifications where id=notice and email_status='sending') then raise exception 'Stale worker acknowledgement accepted';end if;
 perform public.portal_finish_reminder_email(notice,2,true);
 if not exists(select 1 from public.portal_notifications where id=notice and email_status='sent' and email_sent_at is not null) then raise exception 'Delivery acknowledgement failed';end if;
 raise exception using errcode='PZ001',message='Rollback fixture';
 exception when sqlstate 'PZ001' then null;end;
end $$;
select 'PASS: automatic scheduled reminder deduplication, worker authentication, atomic claims, retry, stale acknowledgement protection, exact recipient/sent-time audit and expired reminder suppression; fixtures rolled back' result;
