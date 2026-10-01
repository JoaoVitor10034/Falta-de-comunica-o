import { sb, isDemo } from '../supabase.js';
import { load, save } from './dataService.js';
import { canPublishGeneral } from '../permissions.js';
const ping = () => window.dispatchEvent(new Event('sesi:change'));
export const resolve = (users, t) => users.filter(u => t.type === 'all' || (t.type === 'role' && t.values.includes(u.role)) || (t.type === 'turma' && t.values.includes(u.turma)) || (t.type === 'users' && t.values.includes(u.id)));
const alive = x => x.n && (!x.n.expires_at || new Date(x.n.expires_at) > new Date());

export function onChange(cb, userId) {
  if (isDemo) {
    const storage = e => e.key === 'sesi_demo2' && cb();
    addEventListener('sesi:change', cb); addEventListener('storage', storage);
    return () => { removeEventListener('sesi:change', cb); removeEventListener('storage', storage); };
  }
  const channel = sb.channel('notif-' + userId + '-' + crypto.randomUUID()).on('postgres_changes', { event: '*', schema: 'public', table: 'notification_recipients', filter: `user_id=eq.${userId}` }, cb).subscribe();
  return () => sb.removeChannel(channel);
}
export async function myNotifications(user) {
  if (isDemo) { const db = load(); return db.notification_recipients.filter(r => r.user_id === user.id).map(r => ({ ...r, n: db.notifications.find(n => n.id === r.notification_id) })).filter(alive).sort((a, b) => b.n.created_at.localeCompare(a.n.created_at)); }
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await sb.from('notification_recipients').select('*, n:notifications(*)').eq('user_id', user.id).order('created_at', { ascending: false }).order('id').range(offset, offset + 499);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) return rows.filter(alive);
  }
}
export async function markRead(user, id) { // id vazio = todas
  const now = new Date().toISOString();
  if (isDemo) { const db = load(); db.notification_recipients.forEach(r => { if (r.user_id === user.id && !r.read_at && (!id || r.id === id)) r.read_at = now; }); save(db); return ping(); }
  let q = sb.from('notification_recipients').update({ read_at: now }).eq('user_id', user.id).is('read_at', null); if (id) q = q.eq('id', id);
  const { error } = await q; if (error) throw error;
}
export async function sendNotice(user, o) {
  if (!canPublishGeneral(user)) throw new Error('Sem permissão para enviar avisos.');
  if (!o.title.trim() || !o.message.trim()) throw new Error('Preencha o título e a mensagem.');
  if (o.expires_at && new Date(o.expires_at) <= new Date()) throw new Error('A expiração deve ser futura.');
  if (!isDemo) {
    const { data, error } = await sb.rpc('send_notification', { p_title: o.title, p_message: o.message, p_priority: o.priority, p_target_type: o.target.type, p_target_value: o.target.values || [], p_expires: o.expires_at || null, p_source_type: o.source_type || null, p_source_id: o.source_id || null, p_target_label: o.target_label || null });
    if (error) throw error; return data;
  }
  const db = load(), now = new Date().toISOString(), nid = crypto.randomUUID(), to = resolve(db.profiles, o.target);
  db.notifications.push({ id: nid, title: o.title, message: o.message, priority: o.priority, created_by: user.id, created_at: now, expires_at: o.expires_at ? new Date(o.expires_at).toISOString() : null, source_type: o.source_type || null, source_id: o.source_id || null, target_label: o.target_label || '' });
  to.forEach(u => db.notification_recipients.push({ id: crypto.randomUUID(), notification_id: nid, user_id: u.id, delivered_at: now, read_at: null, created_at: now }));
  db.audit_logs.push({ user_id: user.id, action: 'SEND_NOTIFICATION', entity_type: 'notifications', entity_id: nid, metadata: { target: o.target, recipients: to.length }, created_at: now });
  save(db); ping(); return to.length;
}
export async function adminHistory(user) {
  if (isDemo) { const db = load(), name = id => db.profiles.find(p => p.id === id)?.full_name || '—';
    return db.notifications.filter(n => n.created_by === user.id).sort((a, b) => b.created_at.localeCompare(a.created_at)).map(n => ({ n, rs: db.notification_recipients.filter(r => r.notification_id === n.id).map(r => ({ ...r, name: name(r.user_id) })) })); }
  const { data: ns, error } = await sb.from('notifications').select('*').eq('created_by', user.id).order('created_at', { ascending: false }).limit(30); if (error) throw error;
  const { data: rs } = ns.length ? await sb.from('notification_recipients').select('*, p:profiles(full_name)').in('notification_id', ns.map(n => n.id)) : { data: [] };
  return ns.map(n => ({ n, rs: rs.filter(r => r.notification_id === n.id).map(r => ({ ...r, name: r.p?.full_name || '—' })) }));
}
