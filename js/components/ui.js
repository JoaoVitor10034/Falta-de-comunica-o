import { esc, dayBox, urgency, daysUntil } from '../utils/format.js';
import { icon } from './icons.js';
export const loading = () => `<div class="sr" role="status">Carregando informações...</div><div class="sk hero-sk"></div><div class="grid three"><div class="sk"></div><div class="sk"></div><div class="sk"></div></div><div class="grid two" style="margin-top:16px"><div class="sk tall"></div><div class="sk tall"></div></div>`;
export const empty = msg => `<div class="state">${esc(msg)}</div>`;
export const errorState = () => `<div class="state" role="alert">Não foi possível carregar.<br><button class="btn" data-retry>Tentar novamente</button></div>`;
export function toast(msg, type = 'ok') {
  const t = document.createElement('div'); t.className = 'toast ' + type; t.setAttribute('role', 'status');
  t.innerHTML = icon(type === 'err' ? 'alert' : type === 'info' ? 'bell' : 'check') + `<span>${esc(msg)}</span>`;
  document.body.append(t); setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 3200);
}
export function modal(title, body, onClose) {
  const back = document.activeElement, o = document.createElement('div'); o.className = 'overlay';
  o.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h2>${esc(title)}</h2>${body}</div>`;
  const close = () => { o.remove(); back?.focus?.(); onClose?.(); };
  o.addEventListener('click', e => { if (e.target === o) close(); });
  o.addEventListener('keydown', e => {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') {
      const nodes = [...o.querySelectorAll('button,a[href],input,select,textarea,[tabindex="0"]')].filter(n => !n.disabled && !n.hidden);
      const first = nodes[0], last = nodes.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  });
  document.body.append(o); o.querySelector('input,select,textarea,button')?.focus();
  return { el: o, close };
}
export const confirmDialog = (title, msg, ok = 'Confirmar') => new Promise(res => {
  const m = modal(title, `<p>${esc(msg)}</p><div class="actions"><button class="btn ghost" data-no>Cancelar</button><button class="btn" data-yes>${esc(ok)}</button></div>`, () => res(false));
  m.el.querySelector('[data-yes]').onclick = () => { res(true); m.close(); };
  m.el.querySelector('[data-no]').onclick = m.close;
});
export const priorityBadge = p => `<span class="badge ${esc(p)}">${p === 'Urgente' ? '! ' : p === 'Importante' ? '▲ ' : ''}${esc(p)}</span>`;
export const ring = pct => `<div class="ring" role="img" aria-label="${pct}% lidos"><svg viewBox="0 0 56 56"><circle class="bg" cx="28" cy="28" r="24"/><circle class="rg" cx="28" cy="28" r="24" stroke-dasharray="150.8" stroke-dashoffset="150.8" data-pct="${pct}"/></svg><b>${pct}%</b></div>`;
// Contadores e anéis animados (respeita prefers-reduced-motion)
export function animateIn(root) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.querySelectorAll('[data-count]').forEach(el => {
    const to = +el.dataset.count; if (reduce || !to) return void (el.textContent = to);
    const t0 = performance.now(), step = t => { const p = Math.min((t - t0) / 600, 1); el.textContent = Math.round(to * (1 - (1 - p) ** 3)); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
  requestAnimationFrame(() => requestAnimationFrame(() => root.querySelectorAll('[data-pct]').forEach(c => c.style.strokeDashoffset = 150.8 * (1 - c.dataset.pct / 100))));
}
export const commitment = c => {
  const cls = c.type === 'Trabalho' ? urgency(c.date)[1] : daysUntil(c.date) === 0 ? 'today' : daysUntil(c.date) <= 3 ? 'soon' : '';
  return `<div class="item ${cls}"><div class="date">${dayBox(c.date)}</div><div><strong>${esc(c.title)}</strong><br><span class="muted">${esc(c.type)}${c.subject ? ' • ' + esc(c.subject) : ''}</span></div></div>`;
};
export const announcementCard = a => `<article class="card ${esc(a.priority)}">${priorityBadge(a.priority)} <span class="muted">${esc(a.category)} • ${new Date(a.published_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span><h3>${esc(a.title)}</h3><p>${esc(a.content)}</p></article>`;
export const eventCard = e => `<article class="card"><div class="item" style="border:0;padding:0"><div class="date">${dayBox(e.event_date)}</div><div><h3>${esc(e.title)}</h3><p class="muted">${esc(e.event_time || '')} ${e.location ? '• ' + esc(e.location) : ''}</p><p>${esc(e.description)}</p></div></div></article>`;
