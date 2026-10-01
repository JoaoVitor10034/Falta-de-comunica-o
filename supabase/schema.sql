-- Portal Escolar SESI — schema MVP + RLS. Rode no SQL Editor do Supabase.
create type user_role as enum ('student','teacher','student_admin','system_admin');

create table profiles (id uuid primary key references auth.users on delete cascade, full_name text, email text, role user_role not null default 'student', avatar_url text, created_at timestamptz default now());
create table subjects (id uuid primary key default gen_random_uuid(), name text not null, description text, created_at timestamptz default now());
create table teacher_subjects (teacher_id uuid references profiles on delete cascade, subject_id uuid references subjects on delete cascade, primary key (teacher_id, subject_id));

create table materials (id uuid primary key default gen_random_uuid(), subject_id uuid references subjects on delete cascade, title text not null, description text, url text, status text default 'published', created_by uuid references profiles default auth.uid(), updated_by uuid, created_at timestamptz default now(), updated_at timestamptz default now());
create table assignments (id uuid primary key default gen_random_uuid(), subject_id uuid references subjects on delete cascade, title text not null, description text, due_date date not null, status text default 'published', created_by uuid references profiles default auth.uid(), updated_by uuid, created_at timestamptz default now(), updated_at timestamptz default now());
create table activities (id uuid primary key default gen_random_uuid(), subject_id uuid references subjects on delete cascade, title text not null, description text, due_date date, status text default 'published', created_by uuid references profiles default auth.uid(), updated_by uuid, created_at timestamptz default now(), updated_at timestamptz default now());
create table announcements (id uuid primary key default gen_random_uuid(), title text not null, content text, priority text default 'Normal' check (priority in ('Normal','Importante','Urgente')), category text default 'Diário', created_by uuid references profiles default auth.uid(), published_at timestamptz default now(), expires_at timestamptz);
create table school_events (id uuid primary key default gen_random_uuid(), title text not null, description text, event_date date not null, event_time text, location text, created_by uuid references profiles default auth.uid(), created_at timestamptz default now());
create table audit_logs (id uuid primary key default gen_random_uuid(), user_id uuid default auth.uid(), action text, entity_type text, entity_id uuid, metadata jsonb, created_at timestamptz default now());

create function my_role() returns user_role language sql stable security definer set search_path=public as $$ select role from profiles where id = auth.uid() $$;
create function is_admin() returns boolean language sql stable as $$ select my_role() in ('student_admin','system_admin') $$;
create function can_manage_subject(sid uuid) returns boolean language sql stable security definer set search_path=public as $$
  select is_admin() or exists(select 1 from teacher_subjects where teacher_id = auth.uid() and subject_id = sid) $$;

create function handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into profiles(id,email,full_name) values (new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',new.email)); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

create function log_change() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into audit_logs(user_id,action,entity_type,entity_id,metadata)
  values (auth.uid(), tg_op, tg_table_name, coalesce(new.id,old.id), jsonb_build_object('old',to_jsonb(old),'new',to_jsonb(new)));
  return coalesce(new,old); end $$;
do $$ declare t text; begin foreach t in array array['materials','assignments','activities','announcements','school_events'] loop
  execute format('create trigger audit_%1$s after insert or update or delete on %1$s for each row execute function log_change()', t); end loop; end $$;

alter table profiles enable row level security; alter table subjects enable row level security; alter table teacher_subjects enable row level security;
alter table materials enable row level security; alter table assignments enable row level security; alter table activities enable row level security;
alter table announcements enable row level security; alter table school_events enable row level security; alter table audit_logs enable row level security;

create policy "ver perfis" on profiles for select to authenticated using (true);
create policy "sysadmin gerencia perfis" on profiles for all to authenticated using (my_role()='system_admin') with check (my_role()='system_admin');
create policy "ver disciplinas" on subjects for select to authenticated using (true);
create policy "sysadmin gerencia disciplinas" on subjects for all to authenticated using (my_role()='system_admin') with check (my_role()='system_admin');
create policy "ver vinculos" on teacher_subjects for select to authenticated using (true);
create policy "sysadmin gerencia vinculos" on teacher_subjects for all to authenticated using (my_role()='system_admin') with check (my_role()='system_admin');

do $$ declare t text; begin foreach t in array array['materials','assignments','activities'] loop
  execute format('create policy "ler %1$s" on %1$s for select to authenticated using (status=''published'' or can_manage_subject(subject_id))', t);
  execute format('create policy "criar %1$s" on %1$s for insert to authenticated with check (can_manage_subject(subject_id))', t);
  execute format('create policy "editar %1$s" on %1$s for update to authenticated using (can_manage_subject(subject_id)) with check (can_manage_subject(subject_id))', t);
  execute format('create policy "excluir %1$s" on %1$s for delete to authenticated using (can_manage_subject(subject_id))', t);
end loop; end $$;

create policy "ler avisos" on announcements for select to authenticated using (true);
create policy "gerir avisos" on announcements for all to authenticated using (is_admin()) with check (is_admin());
create policy "ler eventos" on school_events for select to authenticated using (true);
create policy "gerir eventos" on school_events for all to authenticated using (is_admin()) with check (is_admin());
create policy "ver auditoria" on audit_logs for select to authenticated using (my_role()='system_admin');
create policy "registrar motivo" on audit_logs for insert to authenticated with check (is_admin() and user_id = auth.uid());
