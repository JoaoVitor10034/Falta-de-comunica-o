import { list, calendar } from './services/dataService.js';
import { normalize, subjectArea } from './subjects.js';
import { esc, daysUntil, fullDate, urgency } from './utils/format.js';
import { canPublishGeneral, canPublishSubject } from './permissions.js';
import { commitment, empty, priorityBadge } from './components/ui.js';
import { icon } from './components/icons.js';
import { visibleTo, readingState } from './services/publicationService.js';

const TYPES = { materials: 'Material', assignments: 'Trabalho', activities: 'Atividade', announcements: 'Aviso', school_events: 'Evento' };
const options = subjects => subjects.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
const dateLabel = date => date ? new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : 'Conteúdo inicial';
const safeUrl = value => { try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };

export async function publications(profile) {
  const [subjects, profiles, ...tables] = await Promise.all([list('subjects'), list('profiles'), ...Object.keys(TYPES).map(t => list(t))]);
  const rows = tables.flatMap((items, i) => items.filter(r => visibleTo(r, profile)).map(r => ({
    ...r, type: Object.keys(TYPES)[i], label: Object.values(TYPES)[i],
    subject: subjects.find(s => s.id === r.subject_id),
    author: profiles.find(p => p.id === r.created_by)?.full_name || 'Equipe SESI',
    date: r.published_at || r.created_at || '', text: r.content || r.description || ''
  })));
  rows.sort((a, b) => b.date.localeCompare(a.date));
  return { subjects, rows };
}

const publicationCard = r => {
  const url = safeUrl(r.url), deadline = r.due_date || r.event_date;
  return `<article class="card publication" id="post-${esc(r.id)}">
    <div class="post-meta"><span class="subject-mark">${icon(r.type === 'announcements' ? 'megaphone' : 'book')}</span><div><strong>${esc(r.subject?.name || 'Comunidade SESI')}</strong><p class="muted">${esc(r.author)} · ${dateLabel(r.date)}</p></div><span class="badge">${r.label}</span></div>
    <h3><a href="#/publicacao/${r.type}/${encodeURIComponent(r.id)}">${esc(r.title)}</a></h3>${r.priority && r.priority !== 'Normal' ? priorityBadge(r.priority) : ''}${r.due_date ? `<span class="badge ${urgency(r.due_date)[1]}">${urgency(r.due_date)[0]}</span>` : ''}
    <p class="post-text">${esc(r.text)}</p>
    <div class="post-footer">${deadline ? `<span class="deadline ${daysUntil(deadline) === 0 ? 'due-today' : ''}">${r.type === 'school_events' ? 'Evento' : 'Prazo'}: ${fullDate(deadline)}</span>` : ''}${r.location ? `<span class="muted">${esc(r.location)} ${esc(r.event_time || '')}</span>` : ''}
    ${url ? `<a class="btn ghost" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Abrir material</a>` : ''}
    ${r.subject ? `<a class="text-link" href="#/disciplina/${esc(r.subject.id)}">Ver disciplina →</a>` : ''}</div>
  </article>`;
};

export async function mural({ profile }) {
  const [{ subjects, rows }, cal] = await Promise.all([publications(profile), calendar(profile)]);
  const upcoming = cal.filter(c => daysUntil(c.date) >= 0).slice(0, 5);
  const canPublish = canPublishGeneral(profile) || ['teacher','student_admin'].includes(profile.role);
  const html = `<div class="topbar"><div><p class="eyebrow">COMUNIDADE ESCOLAR</p><h1>Mural de publicações</h1><p class="muted">Conteúdos, recados e prazos de todas as disciplinas em um só lugar.</p></div>${canPublish ? '<button class="btn" data-publish>+ Nova publicação</button>' : ''}</div>
    <div class="workspace"><section aria-label="Publicações"><div class="card filter-panel"><label for="feed-search">Buscar no mural</label><input id="feed-search" type="search" placeholder="Título, conteúdo, disciplina ou autor…"><div class="filter-row"><select id="feed-subject" aria-label="Filtrar por disciplina"><option value="">Todas as disciplinas</option>${options(subjects)}</select><select id="feed-type" aria-label="Filtrar por tipo"><option value="">Todos os tipos</option>${Object.entries(TYPES).map(([key, label]) => `<option value="${key}">${label}</option>`).join('')}</select></div></div>
    <p class="result-count muted" id="feed-count" role="status"></p><div class="grid" id="feed-results"></div><button class="btn ghost load-more" id="feed-more" hidden>Carregar mais publicações</button></section>
    <aside class="context-rail"><section class="card"><h2>Sua agenda</h2>${upcoming.map(commitment).join('') || empty('Nenhum prazo próximo.')}<a class="text-link" href="#/calendario">Abrir calendário →</a></section><section class="card"><h2>Espaços de aprendizagem</h2><p class="muted">${subjects.length} disciplinas com materiais, trabalhos e atividades organizados.</p><a class="btn ghost" href="#/disciplinas">Explorar disciplinas</a></section><section class="card"><h2>Acompanhe os avisos</h2><p class="muted">As novas publicações aparecem no sino. Abra uma notificação para registrar sua leitura.</p><button class="text-link" data-open-notifs>Abrir notificações →</button></section></aside></div>`;
  return { html, bind(root) {
    const search = root.querySelector('#feed-search'), subject = root.querySelector('#feed-subject'), type = root.querySelector('#feed-type'), more = root.querySelector('#feed-more');
    const params = new URLSearchParams(location.hash.split('?')[1] || '');
    search.value = params.get('q') || '';
    let limit = 12;
    const paint = () => {
      const query = normalize(search.value);
      const filtered = rows.filter(r => (!subject.value || r.subject_id === subject.value) && (!type.value || r.type === type.value) && normalize(`${r.title} ${r.text} ${r.subject?.name || ''} ${r.author}`).includes(query));
      root.querySelector('#feed-count').textContent = `${filtered.length} publicação(ões) encontrada(s)`;
      root.querySelector('#feed-results').innerHTML = filtered.slice(0, limit).map(publicationCard).join('') || empty('Nenhuma publicação encontrada. Experimente outra busca.');
      more.hidden = filtered.length <= limit;
    };
    [search, subject, type].forEach(el => el.addEventListener('input', () => { limit = 12; paint(); }));
    more.onclick = () => { limit += 12; paint(); };
    paint();
  } };
}

export async function subjectDirectory({ profile } = {}) {
  const [subjects, materials, assignments, activities, people, links] = await Promise.all(['subjects', 'materials', 'assignments', 'activities', 'profiles', 'teacher_subjects'].map(t => list(t)));
  const states = profile ? await readingState(profile) : [];
  const areas = [...new Set(subjects.map(subjectArea))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const html = `<div class="topbar"><div><p class="eyebrow">SEUS ESPAÇOS DE APRENDIZAGEM</p><h1>Disciplinas</h1><p class="muted">Explore ${subjects.length} disciplinas e acompanhe conteúdos e entregas.</p></div><a class="btn ghost" href="#/mural">Ver mural</a></div><div class="card filter-panel"><label for="subject-search">Encontrar uma disciplina</label><div class="filter-row"><input id="subject-search" type="search" placeholder="Busque por nome ou assunto…"><select id="subject-area" aria-label="Área de conhecimento"><option value="">Todas as áreas</option>${areas.map(a => `<option>${esc(a)}</option>`).join('')}</select></div></div><p class="result-count muted" id="subject-count" role="status"></p><div class="grid cards subject-grid" id="subject-results"></div>`;
  return { html, bind(root) {
    const search = root.querySelector('#subject-search'), area = root.querySelector('#subject-area');
    const paint = () => {
      const filtered = subjects.filter(s => (!area.value || subjectArea(s) === area.value) && normalize(`${s.name} ${s.description}`).includes(normalize(search.value)));
      root.querySelector('#subject-count').textContent = `${filtered.length} disciplina(s)`;
      root.querySelector('#subject-results').innerHTML = filtered.map(s => {
        const files = materials.filter(m => m.subject_id === s.id && visibleTo(m, profile)).length;
        const tasks = [...assignments, ...activities].filter(t => t.subject_id === s.id && visibleTo(t, profile) && t.due_date && daysUntil(t.due_date) >= 0).length;
        const notices = activities.filter(r => r.subject_id === s.id && r.extra?.kind === 'Aviso' && visibleTo(r, profile) && !states.some(x => x.source_id === r.id && x.read)).length;
        return `<a class="card subject-card" href="${normalize(s.name) === 'passaporte' ? '#/passaporte' : '#/disciplina/' + esc(s.id)}"><div class="subject-card-top"><span class="subject-mark">${icon('book')}</span><span class="badge">${esc(subjectArea(s))}</span></div><h2>${esc(s.name)}</h2><p class="muted">${esc(links.filter(l => l.subject_id === s.id).map(l => people.find(p => p.id === l.teacher_id)?.full_name).filter(Boolean).join(', ') || 'Professor a definir')}</p><p class="muted">${esc(s.description)}</p><div class="subject-card-bottom"><span>${notices} aviso(s) novo(s)</span><span>${files} material(is)</span><span>${tasks} entrega(s) próxima(s)</span></div><span class="text-link">Abrir disciplina →</span></a>`;
      }).join('') || empty('Nenhuma disciplina encontrada.');
    };
    search.oninput = area.onchange = paint; paint();
  } };
}

export async function subjectWorkspace({ profile }, id) {
  const [{ subjects, rows }, links] = await Promise.all([publications(profile), list('teacher_subjects')]);
  const subject = subjects.find(s => s.id === id);
  if (!subject) return empty('Disciplina não encontrada.');
  const items = rows.filter(r => r.subject_id === id), types = [['', 'Todas'], ['materials', 'Materiais'], ['assignments', 'Trabalhos'], ['activities', 'Atividades'], ['aviso', 'Avisos'], ['agenda', 'Calendário']];
  const next = items.filter(r => r.due_date && daysUntil(r.due_date) >= 0).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const html = `<a class="text-link breadcrumb" href="#/disciplinas">← Todas as disciplinas</a><section class="subject-hero"><div><span class="badge">${esc(subjectArea(subject))}</span><h1>${esc(subject.name)}</h1><p>${esc(subject.description)}</p></div>${canPublishSubject(profile, id, links) ? `<button class="btn" data-publish="${esc(id)}">+ Nova publicação</button>` : ''}</section><div class="workspace"><section><div class="filter-panel card"><label for="channel-search">Buscar nesta disciplina</label><select id="material-format" aria-label="Formato do material"><option value="">Todos os formatos</option><option>PDF</option><option>Slides</option><option>Links</option><option>Documentos</option><option>Vídeos</option></select><input id="channel-search" type="search" placeholder="Busque um material, trabalho ou atividade…"><div class="tabs channel-tabs" aria-label="Tipo de publicação">${types.map(([type, label], i) => `<button data-channel-type="${type}" aria-pressed="${i === 0}">${label} (${type ? items.filter(r => r.type === type).length : items.length})</button>`).join('')}</div></div><p class="result-count muted" id="channel-count" role="status"></p><div class="grid" id="channel-results"></div><button class="btn ghost load-more" id="channel-more" hidden>Carregar mais</button></section><aside class="context-rail"><section class="card"><h2>Próximas entregas</h2>${next.slice(0, 5).map(r => commitment({ title: r.title, date: r.due_date, type: r.label })).join('') || empty('Nenhuma entrega agendada.')}</section><section class="card"><h2>Sobre este espaço</h2><p class="muted">Consulte os materiais e acompanhe as orientações da equipe escolar. Novas publicações geram avisos na central de notificações.</p></section></aside></div>`;
  return { html, bind(root) {
    let type = '', limit = 12;
    const search = root.querySelector('#channel-search'), more = root.querySelector('#channel-more');
    const paint = () => {
      const filtered = items.filter(r => (!type || r.type === type || type === 'aviso' && r.extra?.kind === 'Aviso' || type === 'agenda' && (r.due_date || r.event_date)) && (!root.querySelector('#material-format').value || r.type === 'materials' && (r.extra?.format || 'Links') === root.querySelector('#material-format').value) && normalize(`${r.title} ${r.text}`).includes(normalize(search.value)));
      root.querySelector('#channel-count').textContent = `${filtered.length} publicação(ões)`;
      root.querySelector('#channel-results').innerHTML = filtered.slice(0, limit).map(publicationCard).join('') || empty('Ainda não há publicações para esta seleção.');
      more.hidden = filtered.length <= limit;
    };
    root.querySelectorAll('[data-channel-type]').forEach(button => button.onclick = () => {
      type = button.dataset.channelType; limit = 12;
      root.querySelectorAll('[data-channel-type]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      paint();
    });
    root.querySelector('#material-format').onchange = () => { limit = 12; paint(); }; search.oninput = () => { limit = 12; paint(); }; more.onclick = () => { limit += 12; paint(); }; paint();
  } };
}
