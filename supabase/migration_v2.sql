-- PRD v2 — Avisos diretos e notificações. Rode DEPOIS de schema.sql.
alter table profiles add column if not exists turma text;

create table notifications (id uuid primary key default gen_random_uuid(), title text not null, message text, priority text default 'Normal' check (priority in ('Normal','Importante','Urgente')), created_by uuid references profiles default auth.uid(), created_at timestamptz default now(), expires_at timestamptz, source_type text, source_id uuid, target_label text);
create table notification_recipients (id uuid primary key default gen_random_uuid(), notification_id uuid not null references notifications on delete cascade, user_id uuid not null references profiles on delete cascade, delivered_at timestamptz default now(), read_at timestamptz, created_at timestamptz default now(), unique (notification_id, user_id));
create index on notification_recipients (user_id, read_at);

alter table notifications enable row level security; alter table notification_recipients enable row level security;
-- Usuário só vê notificações destinadas a ele (ou que ele enviou)
create policy "ver minhas notificacoes" on notifications for select to authenticated
  using (created_by = auth.uid() or exists (select 1 from notification_recipients r where r.notification_id = id and r.user_id = auth.uid()));
create policy "ver destinatarios" on notification_recipients for select to authenticated using (user_id = auth.uid() or is_admin());
create policy "marcar como lida" on notification_recipients for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on notification_recipients from authenticated;
grant update (read_at) on notification_recipients to authenticated;   -- só read_at pode mudar

-- Envio: apenas administradores, via função (cria aviso + destinatários + auditoria)
create function send_notification(p_title text, p_message text, p_priority text, p_target_type text, p_target_value text[], p_expires timestamptz default null, p_source_type text default null, p_source_id uuid default null, p_target_label text default null)
returns int language plpgsql security definer set search_path = public as $$
declare nid uuid; cnt int;
begin
  if not is_admin() then raise exception 'sem permissão'; end if;
  insert into notifications(title,message,priority,created_by,expires_at,source_type,source_id,target_label)
    values (p_title,p_message,p_priority,auth.uid(),p_expires,p_source_type,p_source_id,p_target_label) returning id into nid;
  insert into notification_recipients(notification_id,user_id)
    select nid, id from profiles where case p_target_type
      when 'all' then true when 'role' then role::text = any(p_target_value)
      when 'turma' then turma = any(p_target_value) when 'users' then id::text = any(p_target_value) else false end;
  get diagnostics cnt = row_count;
  insert into audit_logs(action,entity_type,entity_id,metadata)
    values ('SEND_NOTIFICATION','notifications',nid,jsonb_build_object('target',p_target_type,'value',p_target_value,'recipients',cnt));
  return cnt;
end $$;

alter publication supabase_realtime add table notification_recipients;   -- Realtime
