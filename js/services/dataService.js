import { validatePublication, notifyPublication, visibleTo } from './publicationService.js';
import { sb, isDemo } from '../supabase.js';
import { iso } from '../utils/format.js';
import { SUBJECTS, normalize } from '../subjects.js';
import { canPublishGeneral, canPublishSubject } from '../permissions.js';
import { DEMO_PROFILES, DEMO_TEACHERS } from '../demoAccounts.js';
const d = n => { const x = new Date(); x.setDate(x.getDate() + n); return iso(x); };
const seed = () => ({
  subjects: SUBJECTS.map(s => ({ ...s })),
  teacher_subjects: [{teacher_id:'u2',subject_id:'s1'},{teacher_id:'u2',subject_id:'s3'}],
  materials: [{id:'m1',subject_id:'s1',title:'Lista de exercícios — Funções',description:'PDF com 20 exercícios.',url:'#',status:'published'}],
  assignments: [{id:'a1',subject_id:'s1',title:'Trabalho de Funções',description:'Resolver a lista e entregar em grupo.',due_date:d(0),status:'published'},{id:'a2',subject_id:'s2',title:'Resenha crítica',description:'Uma página sobre o livro do bimestre.',due_date:d(2),status:'published'},{id:'a3',subject_id:'s3',title:'Relatório de laboratório',description:'Experimento de queda livre.',due_date:d(8),status:'published'}],
  activities: [{id:'t1',subject_id:'s4',title:'Atividade — HTML semântico',description:'Montar página com header, main e footer.',due_date:d(4),status:'published'}],
  announcements: [{id:'n1',title:'Aula de Física na sala 12',content:'Hoje a aula acontece na sala 12.',priority:'Urgente',category:'Diário',published_at:new Date().toISOString()},{id:'n2',title:'Reunião de pais',content:'Confirme presença com a secretaria.',priority:'Importante',category:'Assuntos SESI',published_at:new Date(Date.now()-864e5).toISOString()}],
  school_events: [{id:'e1',title:'Feira de Projetos',description:'Apresentação dos projetos das turmas.',event_date:d(10),event_time:'14h',location:'Ginásio'}],
  audit_logs: [],
  profiles: [{id:'u1',full_name:'Ana Aluna',email:'aluno@demo',role:'student',turma:'2A'},{id:'u5',full_name:'Davi Aluno',email:'aluno2@demo',role:'student',turma:'2B'},{id:'u2',full_name:'Prof. Carlos',email:'prof@demo',role:'teacher'},{id:'u3',full_name:'Bia Monitora',email:'monitor@demo',role:'student_admin',turma:'2A'},{id:'u4',full_name:'Admin SESI',email:'admin@demo',role:'system_admin'}],
  notifications: [{id:'x1',title:'Alteração no horário de amanhã',message:'A primeira aula de amanhã começa às 8h30.',priority:'Urgente',created_by:'u4',created_at:new Date().toISOString(),expires_at:null,source_type:null,source_id:null,target_label:'Todos'}],
  notification_recipients: ['u1','u2','u3','u5'].map((u,i)=>({id:'r'+i,notification_id:'x1',user_id:u,delivered_at:new Date().toISOString(),read_at:null,created_at:new Date().toISOString()}))
});
export const load = () => {
  const db = JSON.parse(localStorage.getItem('sesi_demo2') || 'null') || seed();
  if (db.version !== 3) {
    for (const subject of SUBJECTS) {
      const existing = db.subjects.find(s => normalize(s.name) === normalize(subject.name));
      if (existing) existing.area ||= subject.area;
      else db.subjects.push({ ...subject, id: db.subjects.some(s => s.id === subject.id) ? crypto.randomUUID() : subject.id });
    }
    db.version = 3;
    save(db);
  }
  if (db.roster_version !== 1) {
    for (const account of DEMO_PROFILES) {
      if (!db.profiles.some(p => p.id === account.id || p.email === account.email)) db.profiles.push({ ...account });
    }
    // Substitui apenas o vínculo antigo de exemplo: Carlos passa a ensinar Matemática.
    const physics = db.subjects.find(s => normalize(s.name) === normalize('Física'));
    db.teacher_subjects = db.teacher_subjects.filter(l => !(l.teacher_id === 'u2' && l.subject_id === physics?.id));
    for (const teacher of DEMO_TEACHERS) {
      const subject = db.subjects.find(s => normalize(s.name) === normalize(teacher.subject_name));
      const account = db.profiles.find(p => p.email === teacher.email);
      if (subject && account && !db.teacher_subjects.some(l => l.teacher_id === account.id && l.subject_id === subject.id)) db.teacher_subjects.push({ teacher_id: account.id, subject_id: subject.id });
    }
    db.roster_version = 1; save(db);
  }
  if (db.portal_version !== 5) {
    const now = new Date().toISOString();
    for (const table of ['materials','assignments','activities','announcements','school_events']) {
      for (const row of db[table]) {
        row.created_by ||= db.teacher_subjects.find(l => l.subject_id === row.subject_id)?.teacher_id || 'u4';
        row.created_at ||= row.published_at || now;
      }
    }
    const passport = db.subjects.find(s => normalize(s.name) === 'passaporte');
    if (passport) {
      db.activities.push({id:crypto.randomUUID(),subject_id:passport.id,title:'Ideias que transformam a escola',description:'Demonstração: desenvolva uma proposta para melhorar a vida na comunidade escolar. Organize suas ideias e converse com o professor responsável.',due_date:d(7),status:'published',created_by:'u4',created_at:now,extra:{area:'passaporte',kind:'Projeto',audience:'all',location:'Espaço de projetos'}});
      db.school_events.push({id:crypto.randomUUID(),title:'Encontro de projetos do Passaporte',description:'Encontro demonstrativo para compartilhar descobertas, trocar experiências e planejar os próximos passos.',event_date:d(3),event_time:'14:30',location:'Laboratório de projetos',status:'published',created_by:'u4',created_at:now,extra:{area:'passaporte',kind:'Encontro',audience:'all'}});
    }
    db.portal_version = 5; save(db);
  }
  return db;
};
export const save = db => localStorage.setItem('sesi_demo2', JSON.stringify(db));

export async function list(table, filter = {}) {
  if (isDemo) return load()[table].filter(r => Object.entries(filter).every(([k, v]) => r[k] === v));
  let q = sb.from(table).select('*');
  for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
  const { data, error } = await q; if (error) throw error; return data;
}
export async function create(table, row, user, reason) {
  validatePublication(table, row, user);
  row = { ...row, status: user.role === 'student_admin' ? 'pending' : 'published' };
  if (isDemo) {
    const db = load();
    const subjectTable = ['materials', 'assignments', 'activities'].includes(table);
    if (!(subjectTable ? canPublishSubject(user, row.subject_id, db.teacher_subjects) : ['announcements', 'school_events'].includes(table) && canPublishGeneral(user))) throw new Error('Sem permissão para publicar.');
    const rec = { ...row, id: crypto.randomUUID(), status: row.status, created_by: user.id, created_at: new Date().toISOString() };
    if (table === 'announcements') rec.published_at = new Date().toISOString();
    db[table].push(rec);
    // Publicação e notificações são gravadas juntas, sem alertas perdidos ou duplicados.
    notifyPublication(db, table, rec, user);
    db.audit_logs.push({ id: crypto.randomUUID(), user_id: user.id, action: 'INSERT', entity_type: table, entity_id: rec.id, metadata: { new: rec }, created_at: rec.created_at });
    if (reason) db.audit_logs.push({ user_id: user.id, action: 'EMERGENCY_INSERT', entity_type: table, entity_id: rec.id, metadata: { reason, role: user.role }, created_at: new Date().toISOString() });
    save(db); window.dispatchEvent(new Event('sesi:change')); return rec;
  }
  const { data, error } = await sb.from(table).insert(row).select().single(); if (error) throw error;
  if (reason) await sb.from('audit_logs').insert({ action: 'EMERGENCY_INSERT', entity_type: table, entity_id: data.id, metadata: { reason, role: user.role } });
  return data;
}
// Calendário consolidado: gerado a partir das fontes (sem cadastro duplicado).
export async function calendar(user) {
  const [subs, as, ac, ev] = await Promise.all([list('subjects'), list('assignments'), list('activities'), list('school_events')]);
  const name = id => subs.find(s => s.id === id)?.name;
  return [
    ...as.filter(x => visibleTo(x, user)).map(x => ({ title: x.title, date: x.due_date, type: x.extra?.kind || 'Trabalho', subject: name(x.subject_id), source_type: 'assignment', source_id: x.id })),
    ...ac.filter(x => x.due_date && visibleTo(x, user)).map(x => ({ title: x.title, date: x.due_date, type: x.extra?.kind || 'Atividade', subject: name(x.subject_id), source_type: 'activity', source_id: x.id })),
    ...ev.filter(x => visibleTo(x, user)).map(x => ({ title: x.title, date: x.event_date, type: 'Evento', subject: x.location, source_type: 'school_event', source_id: x.id }))
  ].sort((a, b) => a.date.localeCompare(b.date));
}
