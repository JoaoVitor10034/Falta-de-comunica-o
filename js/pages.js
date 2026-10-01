import { iso } from './utils/format.js';
import { myNotifications } from './services/notificationService.js';
import { icon } from './components/icons.js';
import { canPublishGeneral } from './permissions.js';
import { list, calendar } from './services/dataService.js';
import { commitment, announcementCard, eventCard, empty } from './components/ui.js';
import { esc, greeting, daysUntil, fullDate, urgency, dayBox } from './utils/format.js';
import { roleLabel } from './permissions.js';

export const dashboard = async ({ profile }) => {
  const [cal, ann, ev, notes] = await Promise.all([calendar(profile), list('announcements'), list('school_events'), myNotifications(profile)]);
  const inWeek = cal.filter(c => { const n = daysUntil(c.date); return n >= 0 && n <= 6; });
  const due = inWeek.filter(c => c.type !== 'Evento').length, evs = ev.filter(e => { const n = daysUntil(e.event_date); return n >= 0 && n <= 30; }).length, unread = notes.filter(n => !n.read_at).length;
  const upcoming = cal.filter(c => daysUntil(c.date) >= 0).slice(0, 6), today = upcoming.filter(c => daysUntil(c.date) === 0).length;
  const w = { Urgente: 0, Importante: 1, Normal: 2 };
  const imp = [...ann].sort((a, b) => w[a.priority] - w[b.priority] || b.published_at.localeCompare(a.published_at)).slice(0, 3);
  const days = [...Array(7)].map((_, i) => { const x = new Date(); x.setDate(x.getDate() + i); const k = cal.filter(c => c.date === iso(x)).length;
    return `<a class="day ${i ? '' : 'today'}" href="#/calendario?v=semana" aria-label="${x.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric' })}: ${k} compromisso(s)"><span>${x.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</span><b>${x.getDate()}</b><i class="dots">${'<u></u>'.repeat(Math.min(k, 3))}</i></a>`; }).join('');
  const qa = (href, ic, t, d, tag = 'a') => `<${tag} class="card qa" ${tag === 'a' ? `href="${href}"` : href}><span class="qi">${icon(ic)}</span><span><strong>${t}</strong><br><span class="muted">${d}</span></span></${tag}>`;
  const actions = canPublishGeneral(profile) ? qa('#/admin', 'send', 'Novo aviso', 'Enviar para turma, perfil ou todos') + qa('data-publish', 'plus', 'Nova publicação', 'Material, trabalho ou atividade', 'button')
    : profile.role === 'teacher' ? qa('data-publish', 'plus', 'Nova publicação', 'Material, trabalho ou atividade', 'button') + qa('#/disciplinas', 'book', 'Minhas disciplinas', 'Abrir área da disciplina')
    : qa('#/calendario', 'calendar', 'Calendário', 'Hoje, semana e mês') + qa('#/disciplinas', 'book', 'Disciplinas', 'Materiais e trabalhos') + qa('#/avisos', 'megaphone', 'Avisos', 'Diários e Assuntos SESI');
  return `<section class="hero"><h1>${greeting()}, ${esc(profile.full_name.split(' ')[0])}</h1><p>${today ? `Você tem ${today} compromisso(s) hoje. Aqui está sua semana.` : 'Nada vence hoje. Aqui está sua semana.'}</p><div class="weekstrip">${days}</div></section>
  <div class="grid three stats"><a class="stat" href="#/calendario?v=semana"><b data-count="${due}">0</b><span>Trabalhos e atividades da semana</span></a><a class="stat" href="#/eventos"><b data-count="${evs}">0</b><span>Próximos eventos (30 dias)</span></a><button class="stat ${unread ? 'alert' : ''}" data-open-notifs><b data-count="${unread}">0</b><span>Avisos não lidos</span></button></div>
  <div class="grid two" style="margin-top:16px"><section class="card"><h2>Próximos compromissos</h2>${upcoming.map(commitment).join('') || empty('Nenhum compromisso próximo.')}</section>
  <section><h2>Avisos importantes</h2><div class="grid">${imp.map(announcementCard).join('') || empty('Nenhum aviso.')}</div></section></div>
  <section style="margin-top:24px"><h2>Atalhos</h2><div class="grid cards">${actions}</div></section>
  <section class="card mural-promo"><div><h2>O que está acontecendo na escola?</h2><p class="muted">Explore publicações de todas as disciplinas e encontre materiais, atividades e recados.</p></div><a class="btn" href="#/mural">Explorar mural</a></section>
  <section style="margin-top:24px"><h2>Eventos</h2><div class="grid cards">${ev.map(eventCard).join('') || empty('Nenhum evento.')}</div></section>`;
};
export const subjects = async () => {
  const s = await list('subjects');
  return `<h1>Disciplinas</h1><div class="grid cards" style="margin-top:16px">${s.map(x => `<a class="card" href="#/disciplina/${esc(x.id)}"><h3>${esc(x.name)}</h3><p class="muted">${esc(x.description)}</p></a>`).join('') || empty('Nenhuma disciplina.')}</div>`;
};
const TABS = [['materials', 'Materiais'], ['assignments', 'Trabalhos'], ['activities', 'Atividades']];
export const subject = async (ctx, id) => {
  const [subs, ...data] = await Promise.all([list('subjects'), ...TABS.map(([t]) => list(t, { subject_id: id }))]);
  const s = subs.find(x => x.id === id); if (!s) return empty('Disciplina não encontrada.');
  const row = (t, r) => `<div class="item ${t === 'assignments' ? urgency(r.due_date)[1] : ''}">${r.due_date ? `<div class="date">${dayBox(r.due_date)}</div>` : ''}<div><strong>${esc(r.title)}</strong> ${t === 'assignments' ? `<span class="badge ${urgency(r.due_date)[1]}">${urgency(r.due_date)[0]}</span>` : ''}<p>${esc(r.description)}</p>${r.url && r.url !== '#' ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">Abrir arquivo</a>` : ''}</div></div>`;
  const msg = ['Nenhum material cadastrado.', 'Nenhum trabalho cadastrado.', 'Nenhuma atividade cadastrada.'];
  return `<div class="topbar"><div><h1>${esc(s.name)}</h1><p class="muted">${esc(s.description)}</p></div><button class="btn" data-publish="${esc(id)}">Nova publicação</button></div>
  <div class="tabs" role="tablist">${TABS.map(([, l], i) => `<button role="tab" aria-selected="${i === 0}" data-tab="${i}">${l}</button>`).join('')}</div>
  ${TABS.map(([t], i) => `<div class="card" data-panel="${i}" ${i ? 'hidden' : ''}>${data[i].map(r => row(t, r)).join('') || empty(msg[i])}</div>`).join('')}`;
};
export const calendarPage = async () => {
  const cal = await calendar();
  const view = location.hash.split('?v=')[1] || 'semana', max = { hoje: 0, semana: 7, mes: 31 }[view] ?? 7;
  const items = cal.filter(c => { const n = daysUntil(c.date); return n >= 0 && n <= max; });
  const groups = items.reduce((g, c) => ((g[c.date] ||= []).push(c), g), {});
  return `<h1>Calendário</h1><div class="tabs" style="margin-top:12px">${[['hoje','Hoje'],['semana','Semana'],['mes','Mês']].map(([k, l]) => `<button aria-selected="${k === view}" data-view="${k}">${l}</button>`).join('')}</div>
  ${Object.entries(groups).map(([d, l]) => `<section class="card" style="margin-bottom:12px"><h2 style="text-transform:capitalize">${fullDate(d)}</h2>${l.map(commitment).join('')}</section>`).join('') || empty('Nada agendado neste período.')}`;
};
export const events = async () => `<h1>Eventos escolares</h1><div class="grid cards" style="margin-top:16px">${(await list('school_events')).map(eventCard).join('') || empty('Nenhum evento.')}</div>`;
export const announcements = async () => {
  const a = (await list('announcements')).sort((x, y) => y.published_at.localeCompare(x.published_at));
  const sec = c => `<h2>${c}</h2><div class="grid" style="margin-bottom:24px">${a.filter(x => x.category === c).map(announcementCard).join('') || empty('Nenhum aviso.')}</div>`;
  return `<h1 style="margin-bottom:16px">Avisos</h1>${sec('Diário')}${sec('Assuntos SESI')}`;
};
export const profilePage = ({ profile }) => `<h1>Perfil</h1><div class="card" style="margin-top:16px"><p><strong>${esc(profile.full_name)}</strong></p><p class="muted">${esc(profile.email)}</p><p><span class="badge">${roleLabel(profile.role)}</span>${profile.turma ? ` <span class="badge">Turma ${esc(profile.turma)}</span>` : ''}</p><div class="actions" style="justify-content:flex-start"><button class="btn ghost" data-logout>Sair</button></div></div><section class="card" style="margin-top:16px"><h2>Explore o portal</h2><div class="quick-links"><a class="text-link" href="#/avisos">Avisos da escola</a><a class="text-link" href="#/eventos">Eventos escolares</a>${canPublishGeneral(profile) ? '<a class="text-link" href="#/admin">Enviar avisos diretos</a>' : ''}</div></section>`;
