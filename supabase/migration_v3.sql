-- Execute depois de schema.sql e migration_v2.sql.
begin;

-- Qualifica a coluna externa: "id" sozinho era interpretado como o ID do recibo.
drop policy if exists "ver minhas notificacoes" on notifications;
create policy "ver minhas notificacoes" on notifications for select to authenticated
  using (created_by = auth.uid() or exists (
    select 1 from notification_recipients r
    where r.notification_id = notifications.id and r.user_id = auth.uid()
  ));

-- A publicação e seus alertas fazem parte da mesma transação.
-- Se o alerta falhar, a publicação também é revertida.
create or replace function notify_school_publication() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  item jsonb := to_jsonb(new);
  nid uuid;
  actor uuid := auth.uid();
begin
  if coalesce(item->>'status', 'published') <> 'published' then return new; end if;
  if TG_OP = 'UPDATE' and coalesce(to_jsonb(old)->>'status', 'published') = 'published' then return new; end if;
  insert into notifications(title, message, priority, created_by, source_type, source_id, target_label, expires_at)
    values (new.title, coalesce(item->>'content', item->>'description', 'Uma nova publicação está disponível no portal.'),
      coalesce(item->>'priority', 'Normal'), actor, TG_TABLE_NAME, new.id, 'Comunidade escolar', (item->>'expires_at')::timestamptz)
    returning id into nid;
  insert into notification_recipients(notification_id, user_id)
    select nid, id from profiles where id is distinct from actor;
  return new;
end $$;
revoke all on function notify_school_publication() from public;

do $$ declare t text;
begin
  foreach t in array array['materials', 'assignments', 'activities', 'announcements', 'school_events'] loop
    execute format('drop trigger if exists notify_publication on %I', t);
    execute format('create trigger notify_publication after insert or update on %I for each row execute function notify_school_publication()', t);
  end loop;
end $$;

-- Cadastro aditivo: preserva IDs, vínculos e publicações existentes.
insert into subjects(name, description)
select v.name, v.description from (values
  ('Matemática', 'Funções, geometria, estatística e resolução de problemas.'),
  ('Língua Portuguesa', 'Leitura, literatura, produção de texto e gramática.'),
  ('Física', 'Movimento, energia, ondas e investigação experimental.'),
  ('Programação', 'Lógica, algoritmos e desenvolvimento de projetos digitais.'),
  ('Educação Física', 'Esportes, práticas corporais, saúde e cooperação.'),
  ('Língua Inglesa', 'Comunicação, leitura e culturas de língua inglesa.'),
  ('REC de Língua Portuguesa', 'Retomada de leitura, escrita e conhecimentos linguísticos.'),
  ('Filosofia', 'Ética, conhecimento e reflexão crítica sobre a sociedade.'),
  ('REC de Matemática', 'Revisão de conceitos e acompanhamento da aprendizagem.'),
  ('Geografia', 'Territórios, ambiente, população e relações globais.'),
  ('Química', 'Matéria, transformações e química no cotidiano.'),
  ('REC de Ciências da Natureza', 'Retomada integrada de Física, Química e Biologia.'),
  ('MindLab', 'Jogos de raciocínio, estratégias e habilidades socioemocionais.'),
  ('Teatro', 'Expressão corporal, interpretação e criação cênica.'),
  ('História', 'Processos históricos, memória, cultura e cidadania.'),
  ('Biologia', 'Vida, ecologia, genética e diversidade dos seres vivos.'),
  ('Música', 'Escuta, ritmo, composição e expressão musical.'),
  ('Sociologia', 'Sociedade, diversidade, direitos e relações sociais.'),
  ('Passaporte', 'Percurso de aprendizagem, experiências e projetos pessoais.')
) as v(name, description)
where not exists (select 1 from subjects s where lower(trim(s.name)) = lower(v.name));
commit;
