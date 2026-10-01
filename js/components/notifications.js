import { shouldToast } from '../preferences.js';
import { myNotifications, markRead, onChange } from '../services/notificationService.js';
import { esc } from '../utils/format.js';
import { icon } from './icons.js';
import { modal, toast, priorityBadge } from './ui.js';
import { list as listRecords } from '../services/dataService.js';
const when = d => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export function initBell(profile, host) {
  host.innerHTML = `<button class="bell" aria-label="Notificações" aria-haspopup="dialog">${icon('bell')}<span class="count" hidden>0</span></button>`;
  const bell = host.querySelector('.bell'), badge = host.querySelector('.count');
  const scrim = Object.assign(document.createElement('div'), { className: 'scrim' }), dr = document.createElement('aside');
  dr.className = 'drawer'; dr.inert = true; dr.setAttribute('role', 'dialog'); dr.setAttribute('aria-label', 'Notificações');
  dr.innerHTML = `<div class="drawer-h"><h2>Notificações</h2><div><button class="linkbtn" data-all>Marcar todas como lidas</button><button class="iconbtn" data-close aria-label="Fechar">${icon('x')}</button></div></div><ul class="nlist"></ul>`;
  document.body.append(scrim, dr);
  const list = dr.querySelector('.nlist'); let items = [], seen = null, refreshVersion = 0;
  const open = v => { dr.classList.toggle('open', v); scrim.classList.toggle('open', v); dr.inert = !v; (v ? dr.querySelector('[data-close]') : bell).focus(); };
  const paint = () => {
    const n = items.filter(i => !i.read_at).length; badge.hidden = !n; badge.textContent = n > 9 ? '9+' : n;
    bell.setAttribute('aria-label', n ? `Notificações, ${n} não lidas` : 'Notificações');
    list.innerHTML = items.map(i => `<li><button class="nitem ${i.read_at ? '' : 'unread'} ${esc(i.n.priority)}" data-id="${esc(i.id)}"><span class="dot"></span><span><strong>${esc(i.n.title)}</strong> ${priorityBadge(i.n.priority)}${i.read_at ? '' : '<span class="sr"> Não lida</span>'}<span class="nitem-message">${esc(i.n.message)}</span><span class="muted">${when(i.n.created_at)}</span></span></button></li>`).join('') || '<li class="state">Nenhuma notificação.</li>';
  };
  async function refresh() {
    const version = ++refreshVersion;
    try { const result = await myNotifications(profile); if (version !== refreshVersion) return; items = result; }
    catch { if (version !== refreshVersion) return; list.innerHTML = '<li class="state" role="alert">Não foi possível atualizar as notificações. <button class="linkbtn" data-notif-retry>Tentar novamente</button></li>'; return; }
    if (seen) { const fresh = items.filter(i => !seen.has(i.id) && !i.read_at); if (fresh.length) { badge.classList.remove('bump'); void badge.offsetWidth; badge.classList.add('bump'); if (shouldToast(profile, fresh[0].n)) toast('Novo aviso: ' + fresh[0].n.title, 'info'); } }
    seen = new Set(items.map(i => i.id)); paint();
  }
  bell.onclick = () => open(!dr.classList.contains('open')); scrim.onclick = () => open(false);
  dr.addEventListener('keydown', e => e.key === 'Escape' && open(false));
  dr.querySelector('[data-close]').onclick = () => open(false);
  dr.querySelector('[data-all]').onclick = async () => { try { await markRead(profile); await refresh(); toast('Tudo marcado como lido.'); } catch { toast('Não foi possível registrar a leitura.', 'err'); } };
  list.onclick = async e => {
    if (e.target.closest('[data-notif-retry]')) return refresh();
    const b = e.target.closest('[data-id]'); if (!b) return; const it = items.find(i => i.id === b.dataset.id); if (!it) return;
    try { await markRead(profile, it.id); } catch { toast('Não foi possível registrar a leitura.', 'err'); return; }
    open(false); refresh();
    const detail = modal(it.n.title, `<p>${priorityBadge(it.n.priority)} <span class="muted">${when(it.n.created_at)}</span></p><p class="notification-message" style="margin-top:12px">${esc(it.n.message)}</p><div class="actions">${it.n.source_type && it.n.source_type !== 'chat' ? '<button class="btn ghost" data-source>Abrir publicação</button>' : ''}<button class="btn" data-ok>Fechar</button></div>`);
    detail.el.querySelector('[data-ok]').onclick = detail.close;
    const sourceButton = detail.el.querySelector('[data-source]');
    if (sourceButton) sourceButton.onclick = async () => {
      sourceButton.disabled = true;
      try {
        const type = it.n.source_type;
        let route = type === 'announcement' || type === 'announcements' ? '#/avisos' : type === 'school_events' ? '#/eventos' : '#/mural';
        if (['materials', 'assignments', 'activities'].includes(type)) {
          const [record] = await listRecords(type, { id: it.n.source_id });
          if (!record) throw new Error('Publicação indisponível.');
          route = '#/disciplina/' + encodeURIComponent(record.subject_id);
        }
        detail.close(); location.hash = route;
      } catch { toast('A publicação não está disponível agora.', 'err'); sourceButton.disabled = false; }
    };
  };
  onChange(refresh, profile.id); setInterval(refresh, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); }); refresh();
  return { refresh, open };
}
