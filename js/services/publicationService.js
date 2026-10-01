import { load, save, list } from './dataService.js';
import { sb, isDemo } from '../supabase.js';
import { canPublishSubject } from '../permissions.js';

export const TABLES = ['materials', 'assignments', 'activities', 'announcements', 'school_events'];
export const safeUrl = value => { try { const u = new URL(value); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch { return ''; } };
export const visibleTo = (r, user) => (!r.status || r.status === 'published') && (!r.expires_at || new Date(r.expires_at) > new Date()) && (!r.extra?.audience || r.extra.audience === 'all' || r.extra.audience === user?.turma || r.created_by === user?.id || user?.role === 'system_admin');
export function validatePublication(table, row, user) {
  if (!TABLES.includes(table)) throw new Error('Tipo de publicação inválido.');
  if (!row.title?.trim() || row.title.length > 140) throw new Error('Informe um título de até 140 caracteres.');
  if ((row.description || row.content || '').length > 5000) throw new Error('O conteúdo deve ter até 5.000 caracteres.');
  if (row.priority && !['Normal','Importante','Urgente'].includes(row.priority)) throw new Error('Prioridade inválida.');
  for (const url of [row.url, row.extra?.url, row.extra?.image]) if (url && url !== '#' && !safeUrl(url)) throw new Error('Use um link HTTP ou HTTPS válido.');
  for (const date of [row.due_date, row.event_date]) if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(date).toISOString().slice(0, 10) !== date)) throw new Error('Data inválida.');
  if (row.priority === 'Urgente' && user.role !== 'system_admin') throw new Error('Apenas a direção pode publicar avisos urgentes.');
  if (user.role !== 'system_admin' && row.extra?.area && row.extra.area !== 'disciplina') throw new Error('Esta seção é administrada pela direção.');
}
export function notifyPublication(db, table, row, actor, message) {
  if (row.status === 'pending') return;
  const now = new Date().toISOString(), id = crypto.randomUUID();
  db.notifications.push({ id, title: row.title, message: message || row.content || row.description || 'Nova publicação.', priority: row.priority || 'Normal', created_by: actor.id, created_at: now, source_type: table, source_id: row.id, target_label: row.extra?.audience || 'all' });
  db.profiles.filter(p => p.id !== actor.id && visibleTo(row, p)).forEach(p => db.notification_recipients.push({ id: crypto.randomUUID(), notification_id: id, user_id: p.id, created_at: now, delivered_at: now, read_at: null }));
}
export async function changePublication(user, table, id, patch, action = 'UPDATE') {
  if (!['UPDATE','APPROVE','DELETE'].includes(action)) throw new Error('Operação inválida.');
  if (!TABLES.includes(table)) throw new Error('Publicação inválida.');
  const [rows, links] = await Promise.all([list(table), list('teacher_subjects')]);
  const old = rows.find(r => r.id === id);
  const manager = user.role === 'system_admin' || (user.role === 'teacher' && old?.subject_id && canPublishSubject(user, old.subject_id, links) && (old.created_by === user.id || (action === 'APPROVE' && old.status === 'pending')));
  if (!old || !manager) throw new Error('Você não pode alterar esta publicação.');
  const allowed = ['title', 'description', 'content', 'due_date', 'event_date', 'event_time', 'location', 'url', 'priority', 'extra'];
  const clean = Object.fromEntries(Object.entries(patch).filter(([k]) => allowed.includes(k)));
  if (action === 'APPROVE') clean.status = 'published';
  const next = { ...old, ...clean, updated_at: new Date().toISOString() };
  validatePublication(table, next, user);
  if (isDemo) {
    const db = load(), index = db[table].findIndex(r => r.id === id);
    if (action === 'DELETE') db[table].splice(index, 1); else db[table][index] = next;
    db.audit_logs.push({ id: crypto.randomUUID(), user_id: user.id, action, entity_type: table, entity_id: id, metadata: { old, new: action === 'DELETE' ? null : next }, created_at: next.updated_at });
    const changed = old.due_date !== next.due_date ? `Prazo alterado: ${old.due_date || 'sem prazo'} → ${next.due_date}.` : old.location !== next.location ? `Local alterado: ${old.location || 'não informado'} → ${next.location}.` : 'Publicação atualizada: ' + next.title;
    if (action !== 'DELETE') notifyPublication(db, table, next, user, changed);
    save(db); window.dispatchEvent(new Event('sesi:change')); return next;
  }
  const query = action === 'DELETE' ? sb.from(table).delete().eq('id', id) : sb.from(table).update(clean).eq('id', id);
  const { error } = await query; if (error) throw error;
  return next;
}
export async function readingState(user) {
  if (isDemo) return load().reading_states?.filter(r => r.user_id === user.id) || [];
  const { data, error } = await sb.from('reading_states').select('*').eq('user_id', user.id); if (error) throw error; return data;
}
export async function toggleReading(user, table, id, field) {
  if (!['saved', 'read'].includes(field) || !TABLES.includes(table)) throw new Error('Estado inválido.');
  const rows = await readingState(user), old = rows.find(r => r.source_type === table && r.source_id === id);
  const next = { user_id: user.id, source_type: table, source_id: id, saved: false, read: false, ...old, [field]: !old?.[field] };
  if (isDemo) { const db = load(); db.reading_states = (db.reading_states || []).filter(r => !(r.user_id === user.id && r.source_type === table && r.source_id === id)); db.reading_states.push(next); save(db); }
  else { const { error } = await sb.from('reading_states').upsert(next); if (error) throw error; }
  return next;
}
