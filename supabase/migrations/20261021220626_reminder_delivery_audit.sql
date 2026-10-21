alter table public.portal_notifications add column email_recipient text,add column email_sent_at timestamptz;
create or replace function public.portal_claim_reminder_emails(worker_key text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;begin
 if worker_key is null or worker_key<>(select decrypted_secret from vault.decrypted_secrets where name='portal_reminder_worker_key' limit 1) then raise exception 'Invalid worker credentials.' using errcode='42501';end if;
 -- Suppress reminders for memberships or assignments that no longer exist.
 update public.portal_notifications n set email_status='cancelled' where email_status in ('pending','retry','sending') and (not exists(select 1 from profiles where id=n.owner and disabled=0 and deleted_at is null) or (kind in ('reminder_24h','reminder_2h','manual_reminder','assignment') and not exists(select 1 from bookings where owner=n.owner and shift_id=n.shift_id)) or (kind in ('reminder_24h','reminder_2h','manual_reminder') and exists(select 1 from shifts where id=n.shift_id and ((payload->>'date')||' '||(payload->>'start'))::timestamp at time zone 'America/New_York'<=now())));
 with picked as (select n.id,a.email as recipient from public.portal_notifications n join auth.users a on a.id::text=n.owner where n.email_status in ('pending','retry','sending') and n.next_attempt<=now() and n.email_attempts<8 order by n.created_at limit 20 for update of n skip locked),claimed as (update public.portal_notifications n set email_status='sending',email_recipient=picked.recipient,email_attempts=email_attempts+1,next_attempt=now()+interval '10 minutes' from picked where n.id=picked.id returning n.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'email',n.email_recipient,'subject',n.subject,'message',n.message,'attempt',n.email_attempts)),'[]'::jsonb) into result from claimed n;
 return result;
end $$;
create or replace function public.portal_finish_reminder_email(notification_id text,attempt int,sent boolean,error_message text default '') returns void language sql security definer set search_path=public,pg_temp as $$
 update public.portal_notifications set email_status=case when sent then 'sent' when email_attempts>=8 then 'failed' else 'retry' end,email_sent_at=case when sent then clock_timestamp() else email_sent_at end,email_error=case when sent then null else left(error_message,300) end,next_attempt=now()+interval '15 minutes' where id=notification_id and email_status='sending' and email_attempts=attempt;
$$;
