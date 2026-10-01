import { sb, isDemo } from '../supabase.js';
import { load, save } from './dataService.js';

export async function messages(user, peerId) {
  if (isDemo) return (load().chat_messages || []).filter(m => (m.sender_id === user.id && m.recipient_id === peerId) || (m.sender_id === peerId && m.recipient_id === user.id)).slice(-100);
  const { data, error } = await sb.from('chat_messages').select('*')
    .or(`and(sender_id.eq.${user.id},recipient_id.eq.${peerId}),and(sender_id.eq.${peerId},recipient_id.eq.${user.id})`)
    .order('created_at', { ascending: false }).order('id').limit(100);
  if (error) throw new Error('Chat indisponível. Confira a conexão e a migração v4 do banco.');
  return data.reverse();
}

export async function sendMessage(user, peerId, text) {
  const body = text.trim();
  if (!body || body.length > 2000) throw new Error('Escreva uma mensagem de até 2.000 caracteres.');
  if (peerId === user.id) throw new Error('Escolha outra pessoa para conversar.');
  if (!isDemo) {
    const { data, error } = await sb.rpc('send_chat_message', { p_recipient: peerId, p_body: body });
    if (error) throw new Error('Não foi possível enviar. Confira a conexão e a migração v4.');
    return data;
  }
  const db = load();
  if (!db.profiles.some(p => p.id === user.id) || !db.profiles.some(p => p.id === peerId)) throw new Error('Participante não encontrado.');
  const now = new Date().toISOString(), id = crypto.randomUUID(), nid = crypto.randomUUID();
  (db.chat_messages ||= []).push({ id, sender_id: user.id, recipient_id: peerId, body, created_at: now });
  db.notifications.push({ id: nid, title: 'Mensagem de ' + user.full_name, message: body, priority: 'Normal', created_by: user.id, created_at: now, source_type: 'chat', source_id: id, target_label: 'Conversa privada' });
  db.notification_recipients.push({ id: crypto.randomUUID(), notification_id: nid, user_id: peerId, delivered_at: now, created_at: now, read_at: null });
  save(db); window.dispatchEvent(new Event('sesi:change'));
  return id;
}

export function watchMessages(user, callback) {
  const storage = e => { if (e.key === 'sesi_demo2') callback(); };
  const visible = () => { if (!document.hidden) callback(); };
  let channel;
  if (isDemo) { addEventListener('storage', storage); addEventListener('sesi:change', callback); }
  else channel = sb.channel('chat-' + user.id + '-' + crypto.randomUUID())
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `recipient_id=eq.${user.id}` }, callback)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `sender_id=eq.${user.id}` }, callback).subscribe();
  const timer = setInterval(callback, 15000);
  document.addEventListener('visibilitychange', visible);
  return () => { clearInterval(timer); removeEventListener('storage', storage); removeEventListener('sesi:change', callback); document.removeEventListener('visibilitychange', visible); if (channel) sb.removeChannel(channel); };
}
