-- PRD 2.0: execute APÓS schema.sql e migrations v2, v3 e v4.
-- Não remove registros. Restrição de monitores: contribuições passam por aprovação.
begin;
alter table subjects add column if not exists area text;
do $$ declare t text; p record; begin
  foreach t in array array['materials','assignments','activities','announcements','school_events'] loop
    execute format('alter table %I add column if not exists extra jsonb not null default ''{}''',t);
    execute format('alter table %I add column if not exists priority text not null default ''Normal'' check(priority in (''Normal'',''Importante'',''Urgente''))',t);
    execute format('alter table %I add column if not exists status text not null default ''published''',t);
    execute format('alter table %I add column if not exists updated_at timestamptz default now()',t);
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy %I on %I',p.policyname,t);
    end loop;
  end loop;
end $$;

create or replace function is_admin() returns boolean language sql stable as $$ select my_role()='system_admin' $$;
create or replace function can_manage_subject(sid uuid) returns boolean language sql stable security definer set search_path=public as $$
  select my_role()='system_admin' or (my_role()='teacher' and exists(select 1 from teacher_subjects where teacher_id=auth.uid() and subject_id=sid))
$$;
create or replace function publication_audience(extra jsonb) returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(extra->>'audience','all')='all' or my_role()='system_admin' or exists(select 1 from profiles where id=auth.uid() and turma=extra->>'audience')
$$;
do $$ declare t text; begin
  foreach t in array array['materials','assignments','activities'] loop
    execute format('create policy publication_read on %I for select to authenticated using ((status=''published'' and publication_audience(extra)) or created_by=auth.uid() or can_manage_subject(subject_id))',t);
    execute format('create policy publication_insert on %I for insert to authenticated with check (created_by=auth.uid() and ((can_manage_subject(subject_id) and status=''published'') or (my_role()=''student_admin'' and status=''pending'')))',t);
    execute format('create policy publication_update on %I for update to authenticated using (my_role()=''system_admin'' or (can_manage_subject(subject_id) and (created_by=auth.uid() or status=''pending''))) with check (can_manage_subject(subject_id))',t);
    execute format('create policy publication_delete on %I for delete to authenticated using (my_role()=''system_admin'' or (can_manage_subject(subject_id) and created_by=auth.uid()))',t);
  end loop;
  foreach t in array array['announcements','school_events'] loop
    execute format('create policy publication_read on %I for select to authenticated using ((status=''published'' and publication_audience(extra)) or my_role()=''system_admin'')',t);
    execute format('create policy publication_manage on %I for all to authenticated using (my_role()=''system_admin'') with check (my_role()=''system_admin'')',t);
  end loop;
end $$;

create or replace function guard_publication() returns trigger language plpgsql set search_path=public as $$
declare doc jsonb := to_jsonb(new); before_doc jsonb;
begin
  if length(trim(new.title))=0 or length(new.title)>140 then raise exception 'Título inválido'; end if;
  if length(coalesce(doc->>'description',doc->>'content',''))>5000 then raise exception 'Conteúdo muito longo'; end if;
  if doc->>'status' not in ('published','pending') then raise exception 'Status inválido'; end if;
  if coalesce(doc->>'priority','Normal')='Urgente' and my_role()<>'system_admin' then raise exception 'Urgência restrita à direção'; end if;
  if my_role()<>'system_admin' and coalesce(new.extra->>'area','disciplina') not in ('disciplina','') then raise exception 'Seção restrita à direção'; end if;
  if coalesce(doc->>'url','') not in ('','#') and doc->>'url' !~* '^https?://' then raise exception 'URL inválida'; end if;
  if coalesce(new.extra->>'url','')<>'' and new.extra->>'url' !~* '^https?://' then raise exception 'URL inválida'; end if;
  if coalesce(new.extra->>'image','')<>'' and new.extra->>'image' !~* '^https?://' then raise exception 'Imagem inválida'; end if;
  if new.extra->'attachment'->>'path' is not null and (tg_op='INSERT' or new.extra->'attachment' is distinct from old.extra->'attachment') and split_part(new.extra->'attachment'->>'path','/',1)<>auth.uid()::text then raise exception 'Anexo deve pertencer ao autor'; end if;
  if tg_op='UPDATE' then
    before_doc:=to_jsonb(old);
    if new.created_by is distinct from old.created_by or doc->>'subject_id' is distinct from before_doc->>'subject_id' then raise exception 'Autoria e disciplina não podem mudar'; end if;
    -- Professor pode aprovar uma contribuição de monitor, preservando sua autoria.
    if my_role()='teacher' and old.created_by is distinct from auth.uid() and (old.status<>'pending' or new.status<>'published' or (doc - 'status' - 'updated_at') is distinct from (before_doc - 'status' - 'updated_at')) then raise exception 'Apenas aprovação é permitida'; end if;
  end if;
  new.updated_at:=now(); return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['materials','assignments','activities','announcements','school_events'] loop
    execute format('drop trigger if exists guard_publication on %I',t);
    execute format('create trigger guard_publication before insert or update on %I for each row execute function guard_publication()',t);
  end loop;
end $$;

create or replace function notify_school_publication() returns trigger language plpgsql security definer set search_path=public as $$
declare item jsonb:=to_jsonb(new); previous jsonb; nid uuid; message text;
begin
  if new.status<>'published' then return new; end if;
  message:=coalesce(item->>'content',item->>'description','Nova publicação no portal.');
  if tg_op='UPDATE' then
    previous:=to_jsonb(old);
    if item->>'due_date' is distinct from previous->>'due_date' then message:='Prazo alterado: '||coalesce(previous->>'due_date','sem prazo')||' → '||coalesce(item->>'due_date','sem prazo');
    elsif item->>'location' is distinct from previous->>'location' then message:='Local alterado: '||coalesce(previous->>'location','não informado')||' → '||coalesce(item->>'location','não informado');
    else message:='Publicação atualizada: '||new.title; end if;
  end if;
  insert into notifications(title,message,priority,created_by,source_type,source_id,target_label,expires_at)
    values(new.title,message,coalesce(item->>'priority','Normal'),auth.uid(),tg_table_name,new.id,coalesce(new.extra->>'audience','all'),(item->>'expires_at')::timestamptz) returning id into nid;
  insert into notification_recipients(notification_id,user_id)
    select nid,id from profiles where id is distinct from auth.uid() and (coalesce(new.extra->>'audience','all')='all' or turma=new.extra->>'audience' or role='system_admin');
  return new;
end $$;

create table if not exists reading_states (
 user_id uuid references profiles on delete cascade not null,
 source_type text not null check(source_type in ('materials','assignments','activities','announcements','school_events')),
 source_id uuid not null, saved boolean not null default false, read boolean not null default false,
 primary key(user_id,source_type,source_id)
);
alter table reading_states enable row level security;
drop policy if exists own_reading on reading_states;
create policy own_reading on reading_states for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists "ver auditoria" on audit_logs;
create policy "ver auditoria" on audit_logs for select to authenticated using(my_role()='system_admin' or (my_role()='teacher' and exists(select 1 from teacher_subjects where teacher_id=auth.uid() and subject_id::text=coalesce(metadata->'new'->>'subject_id',metadata->'old'->>'subject_id'))));
create or replace function log_school_change() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into audit_logs(user_id,action,entity_type,entity_id,metadata) values(auth.uid(),tg_op,tg_table_name,coalesce(to_jsonb(new)->>'id',to_jsonb(old)->>'id',to_jsonb(new)->>'teacher_id',to_jsonb(old)->>'teacher_id')::uuid,jsonb_build_object('old',to_jsonb(old),'new',to_jsonb(new))); return coalesce(new,old); end $$;
do $$ declare t text; begin foreach t in array array['subjects','teacher_subjects','profiles'] loop
 execute format('drop trigger if exists audit_school on %I',t);
 execute format('create trigger audit_school after insert or update or delete on %I for each row execute function log_school_change()',t);
end loop; end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('school-attachments','school-attachments',false,5242880,array['application/pdf','image/jpeg','image/png','image/webp','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.presentationml.presentation']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists attachment_upload on storage.objects;
create policy attachment_upload on storage.objects for insert to authenticated with check(bucket_id='school-attachments' and (storage.foldername(name))[1]=auth.uid()::text and public.my_role() in ('teacher','student_admin','system_admin'));
drop policy if exists attachment_read on storage.objects;
create policy attachment_read on storage.objects for select to authenticated using(bucket_id='school-attachments' and ((storage.foldername(name))[1]=auth.uid()::text or exists(select 1 from public.materials where extra->'attachment'->>'path'=name) or exists(select 1 from public.assignments where extra->'attachment'->>'path'=name) or exists(select 1 from public.activities where extra->'attachment'->>'path'=name) or exists(select 1 from public.announcements where extra->'attachment'->>'path'=name) or exists(select 1 from public.school_events where extra->'attachment'->>'path'=name)));
commit;
