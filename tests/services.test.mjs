import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const storage = new Map();
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
globalThis.window = new EventTarget();
const { load, save, create } = await import('../js/services/dataService.js');
const { sendNotice, myNotifications, markRead } = await import('../js/services/notificationService.js');
const { SUBJECTS, normalize } = await import('../js/subjects.js');
const { publications } = await import('../js/community.js');
const { messages, sendMessage } = await import('../js/services/chatService.js');
const { updateProfile } = await import('../js/services/profileService.js');
const { login } = await import('../js/auth.js');
globalThis.sessionStorage = { setItem() {} };
const admin = { id: 'u4', role: 'system_admin' }, student = { id: 'u1', role: 'student' };
const { changePublication, readingState, toggleReading } = await import('../js/services/publicationService.js');
beforeEach(() => storage.clear());

test('monitor aguarda aprovação: aluno não vê conteúdo nem recebe alerta antes da revisão', async () => {
  const monitor={id:'u3',role:'student_admin'}, teacher={id:'u2',role:'teacher'};
  const before=(await myNotifications(student)).length;
  const post=await create('activities',{title:'Contribuição do monitor',subject_id:'s1',due_date:'2026-10-05'},monitor);
  assert.equal(post.status,'pending');
  assert.ok(!(await publications(student)).rows.some(r=>r.id===post.id));
  assert.equal((await myNotifications(student)).length,before);
  await assert.rejects(()=>changePublication(student,'activities',post.id,{},'APPROVE'));
  await changePublication(teacher,'activities',post.id,{},'APPROVE');
  assert.ok((await publications(student)).rows.some(r=>r.id===post.id));
  assert.equal((await myNotifications(student)).length,before+1);
  assert.equal(load().activities.find(r=>r.id===post.id).created_by,monitor.id);
  await assert.rejects(()=>create('announcements',{title:'Urgente',priority:'Urgente'},monitor));
});

test('edição respeita autoria e disciplina, registra antes/depois e notifica prazo alterado',async()=>{
  const teacher={id:'u2',role:'teacher'}, other=load().profiles.find(p=>p.role==='teacher'&&p.id!=='u2');
  const post=await create('assignments',{title:'Prazo original',subject_id:'s1',due_date:'2026-10-01'},teacher);
  await assert.rejects(()=>changePublication(other,'assignments',post.id,{due_date:'2026-10-02'}));
  await changePublication(teacher,'assignments',post.id,{due_date:'2026-10-03'});
  assert.equal(load().audit_logs.at(-1).metadata.old.due_date,'2026-10-01');
  assert.equal(load().audit_logs.at(-1).metadata.new.due_date,'2026-10-03');
  assert.ok((await myNotifications(student)).some(n=>n.n.message.includes('2026-10-01 → 2026-10-03')));
});

test('publicação por turma preserva privacidade nos resultados e nas notificações; leitura é individual',async()=>{
  const a=load().profiles.find(p=>p.id==='u1'), b=load().profiles.find(p=>p.id==='u5');
  const post=await create('announcements',{title:'Somente 2A',content:'Recado',extra:{audience:'2A'}},admin);
  assert.ok((await publications(a)).rows.some(r=>r.id===post.id));
  assert.ok(!(await publications(b)).rows.some(r=>r.id===post.id));
  assert.ok(!(await myNotifications(b)).some(n=>n.n.source_id===post.id));
  await toggleReading(a,'announcements',post.id,'saved');
  await toggleReading(a,'announcements',post.id,'read');
  assert.equal((await readingState(a))[0].saved,true);
  assert.equal((await readingState(a))[0].read,true);
  assert.deepEqual(await readingState(b),[]);
});

test('validação rejeita links executáveis, datas impossíveis e publicação em seção restrita',async()=>{
  await assert.rejects(()=>create('materials',{title:'Arquivo',subject_id:'s1',url:'javascript:alert(1)'},admin));
  await assert.rejects(()=>create('assignments',{title:'Prazo',subject_id:'s1',due_date:'2026-02-30'},admin));
  await assert.rejects(()=>create('activities',{title:'Projeto',subject_id:'s1',extra:{area:'passaporte'}},{id:'u2',role:'teacher'}));
});

test('contas demo: seis alunos, quatro monitores e um professor por disciplina, todos com login', async () => {
  const db = load();
  assert.equal(db.profiles.filter(p => p.role === 'student').length, 6);
  assert.equal(db.profiles.filter(p => p.role === 'student_admin').length, 4);
  assert.equal(db.profiles.filter(p => p.role === 'teacher').length, 19);
  assert.equal(db.profiles.length, 30);
  for (const subject of db.subjects) {
    const links = db.teacher_subjects.filter(l => l.subject_id === subject.id);
    assert.equal(links.length, 1, subject.name);
    assert.equal(db.profiles.find(p => p.id === links[0].teacher_id).role, 'teacher');
  }
  for (const user of db.profiles) await login(user.email, 'demo');
  assert.equal(load().profiles.length, 30);
});

test('expansão de contas preserva nomes editados, publicações e avisos antigos', () => {
  const db = load();
  db.profiles = db.profiles.filter(p => ['u1', 'u2', 'u3', 'u4', 'u5'].includes(p.id));
  db.profiles.find(p => p.id === 'u1').full_name = 'Nome personalizado';
  db.teacher_subjects = [{ teacher_id: 'u2', subject_id: 's1' }, { teacher_id: 'u2', subject_id: 's3' }];
  delete db.roster_version;
  save(db);
  const updated = load();
  assert.equal(updated.profiles.length, 30);
  assert.equal(updated.profiles.find(p => p.id === 'u1').full_name, 'Nome personalizado');
  assert.deepEqual(updated.materials, db.materials);
  assert.deepEqual(updated.notifications, db.notifications);
  assert.equal(updated.teacher_subjects.length, 19);
  assert.equal(load().teacher_subjects.length, 19);
});

test('migração adiciona 15 disciplinas sem apagar publicações nem duplicar matérias', () => {
  const db = load();
  delete db.version;
  db.subjects = db.subjects.slice(0, 4);
  db.materials.push({ id: 'preservado', subject_id: 's1', title: 'Meu material' });
  save(db);
  assert.equal(load().subjects.length, 19);
  assert.equal(load().subjects.length, 19);
  assert.equal(load().materials.at(-1).id, 'preservado');
  assert.equal(load().subjects[0].id, 's1');
  assert.equal(new Set(SUBJECTS.map(s => s.id)).size, 19);
  assert.equal(normalize('Educação Física'), 'educacao fisica');
});

test('todas as publicações notificam o aluno uma vez, preservando autor e origem', async () => {
  for (const table of ['materials', 'assignments', 'activities', 'announcements', 'school_events']) {
    const before = (await myNotifications(student)).length;
    const record = await create(table, { title: 'Novo conteúdo', description: 'Texto', subject_id: 's1' }, admin);
    const notes = await myNotifications(student);
    assert.equal(notes.length, before + 1);
    const note = notes.find(n => n.n.source_id === record.id);
    assert.equal(note.n.source_type, table);
    assert.equal(note.n.created_by, admin.id);
    assert.equal(note.read_at, null);
    assert.equal((await myNotifications(admin)).filter(n => n.n.source_id === record.id).length, 0);
  }
});

test('aluno não publica e professor publica somente nas disciplinas vinculadas', async () => {
  await assert.rejects(create('materials', { title: 'Teste', subject_id: 's1' }, student));
  const teacher = { id: 'u2', role: 'teacher' };
  await assert.rejects(create('materials', { title: 'Teste', subject_id: 's2' }, teacher));
  await create('materials', { title: 'Teste', subject_id: 's1' }, teacher);
  await assert.rejects(sendNotice(student, { title: 'Não permitido', message: 'Mensagem' }));
});

test('aviso para turma 2A não chega à 2B e recibos de leitura são individuais', async () => {
  await sendNotice(admin, { title: 'Somente 2A', message: 'Orientações da turma', priority: 'Normal', target: { type: 'turma', values: ['2A'] } });
  const note = (await myNotifications(student)).find(n => n.n.title === 'Somente 2A');
  assert.ok(note);
  assert.equal((await myNotifications({ id: 'u5' })).some(n => n.n.title === 'Somente 2A'), false);
  await markRead(student, note.id);
  assert.ok((await myNotifications(student)).find(n => n.id === note.id).read_at);
  assert.equal((await myNotifications({ id: 'u3' })).find(n => n.n.title === 'Somente 2A').read_at, null);
});

test('mural inclui publicações novas e remove rascunhos e avisos expirados', async () => {
  await create('materials', { title: 'Biologia em foco', subject_id: 's16', description: 'Ecologia' }, admin);
  const db = load();
  db.materials.push({ id: 'draft', title: 'Rascunho', status: 'draft', subject_id: 's16' });
  db.announcements.push({ id: 'expired', title: 'Expirado', expires_at: '2000-01-01' });
  save(db);
  const { rows } = await publications();
  const record = rows.find(r => r.title === 'Biologia em foco');
  assert.equal(record.subject.name, 'Biologia');
  assert.equal(record.author, 'Admin SESI');
  assert.equal(rows.some(r => ['draft', 'expired'].includes(r.id)), false);
});

test('falha de gravação não deixa uma publicação sem seus alertas', async () => {
  load();
  const original = localStorage.setItem;
  localStorage.setItem = () => { throw new Error('Armazenamento cheio'); };
  try { await assert.rejects(create('materials', { title: 'Não salvo', subject_id: 's1' }, admin)); }
  finally { localStorage.setItem = original; }
  assert.equal(load().materials.some(r => r.title === 'Não salvo'), false);
  assert.equal(load().notifications.some(r => r.title === 'Não salvo'), false);
});

test('chat compartilha mensagens apenas entre participantes e notifica o destinatário', async () => {
  const sender = { ...admin, full_name: 'Admin SESI' };
  const id = await sendMessage(sender, student.id, 'Olá, estudante!');
  assert.equal((await messages(student, admin.id))[0].id, id);
  assert.equal((await messages(sender, student.id))[0].body, 'Olá, estudante!');
  assert.deepEqual(await messages({ id: 'u5' }, admin.id), []);
  assert.equal((await myNotifications(student)).filter(n => n.n.source_id === id).length, 1);
  assert.equal((await myNotifications({ id: 'u5' })).filter(n => n.n.source_id === id).length, 0);
  await assert.rejects(sendMessage(sender, student.id, '   '));
  await assert.rejects(sendMessage(sender, sender.id, 'Teste'));
  await assert.rejects(sendMessage(sender, 'inexistente', 'Teste'));
  await assert.rejects(sendMessage(sender, student.id, 'a'.repeat(2001)));
});

test('edição do perfil preserva e-mail, papel de acesso e turma', async () => {
  const user = { ...load().profiles.find(p => p.id === student.id) };
  await updateProfile(user, { full_name: 'Ana Silva', bio: 'Gosto de música.', role: 'system_admin', email: 'outro@exemplo.com' });
  const saved = load().profiles.find(p => p.id === student.id);
  assert.equal(saved.full_name, 'Ana Silva');
  assert.equal(saved.bio, 'Gosto de música.');
  assert.equal(saved.role, 'student');
  assert.equal(saved.email, 'aluno@demo');
  assert.equal(saved.turma, '2A');
  await assert.rejects(updateProfile(user, { full_name: '', bio: '' }));
});
