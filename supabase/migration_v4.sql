-- Execute depois de schema.sql, migration_v2.sql e migration_v3.sql.
begin;
alter table public.profiles add column if not exists bio text not null default '';

create or replace function public.update_my_profile(p_name text, p_bio text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Autenticação necessária'; end if;
  if p_name is null or length(trim(p_name)) not between 1 and 80 or p_bio is null or length(p_bio) > 400 then
    raise exception 'Dados inválidos';
  end if;
  -- O usuário não pode alterar seu papel, e-mail de acesso ou turma.
  update profiles set full_name = trim(p_name), bio = trim(p_bio) where id = auth.uid();
  if not found then raise exception 'Perfil não encontrado'; end if;
end $$;
revoke all on function public.update_my_profile(text,text) from public;
grant execute on function public.update_my_profile(text,text) to authenticated;

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles on delete cascade,
  recipient_id uuid not null references public.profiles on delete cascade,
  body text not null check (length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);
create index if not exists chat_conversation_idx on public.chat_messages(sender_id, recipient_id, created_at desc);
create index if not exists chat_recipient_idx on public.chat_messages(recipient_id, created_at desc);
alter table public.chat_messages enable row level security;
drop policy if exists "participantes leem mensagens" on public.chat_messages;
create policy "participantes leem mensagens" on public.chat_messages for select to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id);
revoke all on public.chat_messages from anon, authenticated;
grant select on public.chat_messages to authenticated;

create or replace function public.send_chat_message(p_recipient uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare mid uuid; nid uuid; sender_name text;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária'; end if;
  if p_body is null or length(trim(p_body)) not between 1 and 2000 then raise exception 'Mensagem inválida'; end if;
  if p_recipient = auth.uid() then raise exception 'Escolha outra pessoa'; end if;
  select full_name into sender_name from profiles where id = auth.uid();
  insert into chat_messages(sender_id,recipient_id,body) values(auth.uid(),p_recipient,trim(p_body)) returning id into mid;
  insert into notifications(title,message,priority,created_by,source_type,source_id,target_label)
    values('Mensagem de ' || coalesce(sender_name,'Usuário'),trim(p_body),'Normal',auth.uid(),'chat',mid,'Conversa privada') returning id into nid;
  insert into notification_recipients(notification_id,user_id) values(nid,p_recipient);
  return mid;
end $$;
revoke all on function public.send_chat_message(uuid,text) from public;
grant execute on function public.send_chat_message(uuid,text) to authenticated;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages') then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;
commit;
