import { schoolPage } from './management.js';
import * as Portal from './portal.js';
import { getProfile, logout } from './auth.js';
import { list } from './services/dataService.js';
import * as P from './pages.js';
import { adminPage } from './adminPage.js';
import { loading, errorState, animateIn } from './components/ui.js';
import { openPublish } from './components/publishForm.js';
import { initBell } from './components/notifications.js';
import { canPublishGeneral } from './permissions.js';
import { icon } from './components/icons.js';
import { mural, subjectDirectory, subjectWorkspace } from './community.js';
import { onChange } from './services/notificationService.js';
import { isDemo } from './supabase.js';
import { esc } from './utils/format.js';
import { profilePage } from './profilePage.js';

const profile = await getProfile();
if (!profile) { if (location.hash.startsWith('#/')) sessionStorage.setItem('sesi_return',location.hash); location.href = 'login.html'; await new Promise(() => {}); }
const admin = canPublishGeneral(profile), $ = id => document.getElementById(id), app = document.querySelector('.app'), view = $('view');
const NAV = [['', 'home', 'Início'], ['mural', 'megaphone', 'Mural'], ['disciplinas', 'book', 'Disciplinas'], ['calendario', 'calendar', 'Calendário'], ['avisos', 'megaphone', 'Avisos'], ['eventos', 'star', 'Eventos'], ...(admin ? [['escola', 'user', 'Pessoas e disciplinas'], ['admin', 'send', 'Avisos diretos']] : []), ['passaporte', 'star', 'Passaporte'], ['salvos', 'book', 'Salvos'], ...(profile.role === 'teacher' || admin ? [['gestao', 'check', 'Gestão editorial']] : []), ['tela', 'calendar', 'Modo mural'], ['perfil', 'user', 'Perfil']];
const ROUTES = { escola: schoolPage, inicio: Portal.dashboard, busca: Portal.searchPage, passaporte: Portal.passport, salvos: c => Portal.noticePage(c, true), publicacao: Portal.detailPage, gestao: Portal.changesPage, tela: Portal.displayPage, '': Portal.dashboard, mural, disciplinas: subjectDirectory, disciplina: subjectWorkspace, calendario: Portal.calendarPage, avisos: Portal.noticePage, eventos: Portal.eventsPage, perfil: profilePage, admin: adminPage };
const link = (h, i, l, c) => `<a href="#/${h}" data-r="${h}"><span class="ico">${icon(i)}</span><span class="${c}">${l}</span></a>`;
$('sidebar').innerHTML = `<div class="brand"><span>SESI</span></div><p class="sidebar-caption label">PORTAL DE APRENDIZAGEM</p><nav class="nav">${NAV.map(([h, i, l]) => link(h, i, l, 'label')).join('')}</nav><div class="sidebar-footer label">${isDemo ? 'Demonstração local<br>Dados compartilhados entre abas deste navegador.' : 'Sua comunidade escolar<br>Conteúdos e comunicação em um só lugar.'}</div>`;
$('bottomnav').innerHTML = ['', 'disciplinas', 'calendario', 'avisos', 'perfil'].map(key => NAV.find(n => n[0] === key)).map(([h, i, l]) => link(h, i, l, '')).join('');
const ini = profile.full_name.split(' ').map(x => x[0]).slice(0, 2).join('');
$('header').innerHTML = `<button class="iconbtn" id="toggle" aria-label="Recolher menu" aria-expanded="true">${icon('menu')}</button><span class="hbrand">SESI</span><form class="global-search" role="search"><input type="search" aria-label="Buscar publicações no portal" placeholder="Buscar no portal…"><button class="btn" type="submit">Buscar</button></form><span class="grow"></span>${profile.role !== 'student' ? '<button class="btn header-publish" id="header-publish">+ Publicar</button>' : ''}<div id="bellhost"></div><a class="user" href="#/perfil" aria-label="Perfil"><span class="avatar">${esc(ini)}</span><span class="uname">${esc(profile.full_name.split(' ')[0])}</span></a>`;
$('header').querySelector('form').onsubmit = e => { e.preventDefault(); location.hash = '#/busca?q=' + encodeURIComponent(e.currentTarget.querySelector('input').value.trim()); };
document.querySelector('#header-publish')?.addEventListener('click', async () => { const [subjects, links] = await Promise.all([list('subjects'), list('teacher_subjects')]); openPublish({profile,subjects,links,onDone:render}); });
const bell = initBell(profile, $('bellhost'));
addEventListener('sesi:profile', () => {
  $('header').querySelector('.uname').textContent = profile.full_name.split(' ')[0];
  $('header').querySelector('.avatar').textContent = profile.full_name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('');
});
const updateBanner = document.createElement('div');
updateBanner.className = 'update-banner'; updateBanner.hidden = true;
updateBanner.innerHTML = '<span role="status">Há atualizações no portal.</span><button class="btn ghost">Atualizar conteúdo</button>';
view.before(updateBanner);
updateBanner.querySelector('button').onclick = () => render();
onChange(() => { updateBanner.hidden = false; const route = location.hash.split('?')[0]; if (['', '#/', '#/inicio', '#/calendario', '#/passaporte', '#/gestao'].includes(route) && !document.querySelector('.overlay')) render(); }, profile.id);

const mq = matchMedia('(min-width:1024px)'), setCollapsed = c => { app.classList.toggle('collapsed', c); $('toggle').setAttribute('aria-expanded', !c); };
setCollapsed(localStorage.getItem('sesi_side') ? localStorage.getItem('sesi_side') === '1' : !mq.matches);
mq.addEventListener('change', e => setCollapsed(!e.matches));
$('toggle').onclick = () => { const c = !app.classList.contains('collapsed'); setCollapsed(c); localStorage.setItem('sesi_side', c ? '1' : '0'); };

let renderVersion = 0, cleanupView;
async function render() {
  const version = ++renderVersion;
  cleanupView?.(); cleanupView = undefined;
  updateBanner.hidden = true;
  const [name = '', arg] = location.hash.replace(/^#\//, '').split('?')[0].split('/');
  document.querySelectorAll('[data-r]').forEach(a => { const on = a.dataset.r === name || (name === 'disciplina' && a.dataset.r === 'disciplinas'); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
  view.innerHTML = loading();
  try {
    const r = await (ROUTES[name] || ROUTES[''])({ profile }, arg);
    if (version !== renderVersion) return;
    let html = typeof r === 'string' ? r : r.html;
    if (!arg && admin && (name === 'avisos' || name === 'eventos')) html = `<div style="text-align:right"><button class="btn" data-publish>Nova publicação</button></div>` + html;
    view.innerHTML = html; view.focus({preventScroll:true}); view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter');
    animateIn(view); cleanupView = r.bind?.(view, render);
  } catch (e) { if (version !== renderVersion) return; console.error(e); view.innerHTML = errorState(); }
}
view.addEventListener('click', async e => {
  const t = e.target.closest('[data-tab],[data-view],[data-publish],[data-logout],[data-retry],[data-open-notifs]'); if (!t) return;
  if (t.dataset.tab !== undefined) { view.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', b === t)); view.querySelectorAll('[data-panel]').forEach(p => p.hidden = p.dataset.panel !== t.dataset.tab); }
  else if (t.dataset.view) location.hash = `#/calendario?v=${t.dataset.view}`;
  else if ('logout' in t.dataset) logout();
  else if ('retry' in t.dataset) render();
  else if ('openNotifs' in t.dataset) bell.open(true);
  else if ('publish' in t.dataset) { const [subjects, links] = await Promise.all([list('subjects'), list('teacher_subjects')]); openPublish({ profile, subjects, links, subjectId: t.dataset.publish, onDone: render }); }
});
addEventListener('hashchange', render); render();
