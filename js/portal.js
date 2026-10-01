import { openAttachment } from './services/attachmentService.js';
import { publications } from './community.js';
import { list, calendar } from './services/dataService.js';
import { readingState, toggleReading, changePublication, safeUrl, TABLES } from './services/publicationService.js';
import { esc, fullDate, iso, daysUntil } from './utils/format.js';
import { normalize } from './subjects.js';
import { modal, toast, empty, priorityBadge, confirmDialog } from './components/ui.js';
import { myNotifications } from './services/notificationService.js';
import { greeting } from './utils/format.js';

const params = () => new URLSearchParams(location.hash.split('?')[1] || '');
const head = (tag, title, description) => `<div class="page-heading"><p class="eyebrow">${tag}</p><h1>${title}</h1><p class="muted">${description}</p></div>`;
export const postLink = r => `#/publicacao/${r.type}/${encodeURIComponent(r.id)}`;
const date = r => r.due_date || r.event_date || r.date?.slice(0, 10);
const card = r => `<article class="card portal-post"><div class="post-top"><span class="badge">${esc(r.extra?.kind || r.label)}</span>${r.priority && r.priority !== 'Normal' ? priorityBadge(r.priority) : ''}</div><h3><a href="${postLink(r)}">${esc(r.title)}</a></h3><p class="muted">${esc(r.subject?.name || (r.extra?.area === 'passaporte' ? 'Passaporte' : 'Direção'))} · ${esc(r.author)}</p><p class="post-excerpt">${esc(r.text)}</p><div class="post-footer">${date(r) ? `<span class="muted">${fullDate(date(r))}</span>` : ''}<a class="text-link" href="${postLink(r)}">Ver detalhes →</a></div></article>`;

export async function dashboard({ profile }) {
  const [{ rows, subjects }, notes] = await Promise.all([publications(profile), myNotifications(profile)]);
  const today = iso(new Date()), tasks = rows.filter(r => r.due_date && r.due_date >= today).sort((a,b) => a.due_date.localeCompare(b.due_date));
  const upcoming = rows.filter(r => (r.due_date || r.event_date) >= today).sort((a,b) => date(a).localeCompare(date(b))).slice(0,5);
  const urgent = rows.filter(r => r.priority === 'Urgente').slice(0,1), unread = notes.filter(n => !n.read_at).length;
  const last = localStorage.getItem('sesi_visit_' + profile.id), changed = rows.filter(r => (r.updated_at || r.date) > (last || today)).slice(0,4);
  const days = Array.from({length:7},(_,i) => { const d = new Date(); d.setDate(d.getDate()+i); const n = rows.filter(r => date(r) === iso(d)).length; return `<a class="day ${i ? '' : 'today'}" href="#/calendario?v=semana"><span>${d.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.','')}</span><b>${d.getDate()}</b><i class="dots">${'<u></u>'.repeat(Math.min(n,3))}</i></a>`; }).join('');
  return { html: `<div class="dashboard-intro"><div><p class="eyebrow">SEU PORTAL. SUA ESCOLA. SEU FUTURO.</p><h1>${greeting()}, ${esc(profile.full_name.split(' ')[0])}<span class="hello-dot">.</span></h1><p class="muted">Tudo o que você precisa para seguir em frente, em um só lugar.</p></div><span class="today-label">${new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})}</span></div>
  <section class="hero campus-hero"><div class="campus-copy"><span class="hero-kicker">CONECTE-SE AO SEU PRÓXIMO PASSO</span><h2>Grandes ideias <br>começam aqui.</h2><p>Aprenda, descubra e faça parte. <br>Acompanhe o que acontece no SESI.</p><a class="btn hero-button" href="#/passaporte">Explore seu Passaporte <span>↗</span></a></div><img src="assets/images/sesi-escola.jpg" alt="Fachada da escola SESI" fetchpriority="high"><div class="campus-caption"><span class="live-dot"></span> Nossa escola, novas possibilidades</div></section>
  ${urgent.map(r => `<a class="urgent-strip" href="${postLink(r)}"><span class="urgent-icon">!</span><div><strong>${esc(r.title)}</strong><p>${esc(r.text)}</p></div><span>Ver aviso →</span></a>`).join('')}
  <div class="grid three stats"><a class="stat" href="#/calendario?v=hoje"><span class="stat-symbol">◷</span><div><b data-count="${tasks.filter(r => r.due_date === today).length}">0</b><span>Entregas para hoje</span></div><span class="stat-arrow">↗</span></a><a class="stat" href="#/disciplinas"><span class="stat-symbol blue">▤</span><div><b data-count="${subjects.length}">0</b><span>Espaços de aprendizagem</span></div><span class="stat-arrow">↗</span></a><button class="stat" data-open-notifs><span class="stat-symbol amber">◉</span><div><b data-count="${unread}">0</b><span>Notificações não lidas</span></div><span class="stat-arrow">↗</span></button></div>
  <div class="dashboard-columns"><section class="card day-planner"><div class="section-heading"><div><p class="eyebrow">UM PASSO DE CADA VEZ</p><h2>Meu dia no SESI</h2></div><a class="text-link" href="#/calendario">Ver agenda ↗</a></div><div class="weekstrip">${days}</div><div class="school-timeline">${upcoming.map(r => `<a class="timeline-row" href="${postLink(r)}"><div class="timeline-time">${r.extra?.time || r.event_time ? esc(r.extra?.time || r.event_time) : date(r) === today ? 'Hoje' : new Date(date(r)+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})}</div><span class="timeline-point"></span><div><span class="muted">${esc(r.subject?.name || 'Comunidade SESI')}</span><h3>${esc(r.title)}</h3><p class="muted">${esc(r.extra?.location || r.location || r.extra?.kind || r.label)}</p></div><span class="timeline-arrow">↗</span></a>`).join('') || empty('Você está em dia! Nenhum compromisso próximo.')}</div></section>
  <aside class="dashboard-rail"><section class="card"><div class="section-heading"><h2>Acesso rápido</h2><span>↗</span></div><div class="quick-tiles">${[['disciplinas','▤','Minhas matérias'],['avisos','◉','Avisos da escola'],['salvos','☆','Meus salvos'],['eventos','↗','Eventos']].map(([p,i,t]) => `<a href="#/${p}"><span>${i}</span><strong>${t}</strong></a>`).join('')}</div></section><section class="passport-teaser"><span class="eyebrow">APRENDIZAGEM SEM FRONTEIRAS</span><h2>Vá além<br>do esperado.</h2><p>Conheça os projetos e experiências do Passaporte.</p><a href="#/passaporte">Descobrir oportunidades ↗</a><span class="orbit" aria-hidden="true"></span></section></aside></div>
  <section class="search-group"><div class="section-heading"><div><p class="eyebrow">FIQUE POR DENTRO</p><h2>O que mudou?</h2></div><a class="text-link" href="#/mural">Todas as publicações ↗</a></div><div class="grid cards">${changed.map(card).join('') || empty('Nenhuma alteração desde sua última visita.')}</div></section>`, bind() { localStorage.setItem('sesi_visit_' + profile.id, new Date().toISOString()); } };
}

export async function searchPage({ profile }) {
  const [{ subjects, rows }, people] = await Promise.all([publications(profile), list('profiles')]);
  return { html: head('ENCONTRE O QUE PRECISA', 'Pesquisa global', 'Disciplinas, professores, materiais, eventos e Passaporte.') + '<label for="portal-search">Buscar no Portal SESI</label><input id="portal-search" type="search" placeholder="O que você procura?" autocomplete="off"><div id="search-results" aria-live="polite"></div>', bind(root) {
    const input = root.querySelector('input'), result = root.querySelector('#search-results'); input.value = params().get('q') || '';
    const draw = () => {
      const q = normalize(input.value.trim());
      if (!q) { result.innerHTML = empty('Digite um assunto, professor ou disciplina para começar.'); return; }
      const match = x => normalize(x).includes(q), groups = new Map();
      const sub = subjects.filter(s => match(s.name + ' ' + s.description));
      const teachers = people.filter(p => p.role === 'teacher' && match(p.full_name));
      rows.filter(r => match(`${r.title} ${r.text} ${r.author} ${r.subject?.name || ''}`)).forEach(r => { const k = r.extra?.area === 'passaporte' ? 'Passaporte' : r.label; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); });
      result.innerHTML = (sub.length ? `<section class="search-group"><h2>Disciplinas · ${sub.length}</h2><div class="grid cards">${sub.map(s => `<a class="card" href="#/disciplina/${esc(s.id)}"><h3>${esc(s.name)}</h3><p>${esc(s.description)}</p></a>`).join('')}</div></section>` : '') + (teachers.length ? `<section class="search-group"><h2>Professores</h2>${teachers.map(p => `<p class="card">${esc(p.full_name)}</p>`).join('')}</section>` : '') + [...groups].map(([k, rs]) => `<section class="search-group"><h2>${esc(k)} · ${rs.length}</h2><div class="grid cards">${rs.map(card).join('')}</div></section>`).join('') || empty('Nenhum resultado. Tente outro termo.');
    }; input.oninput = draw; draw();
  } };
}

export async function noticePage({ profile }, savedOnly = false) {
  const [{ rows }, states] = await Promise.all([publications(profile), readingState(profile)]);
  const all = savedOnly ? rows.filter(r => states.some(s => s.source_id === r.id && s.saved)) : rows.filter(r => r.type === 'announcements' || r.extra?.kind === 'Aviso');
  const filters = ['Todos', 'Hoje', 'Importantes', 'Disciplinas', 'Direção', 'Eventos', 'Passaporte'];
  return { html: head('COMUNICAÇÃO ESCOLAR', savedOnly ? 'Meus salvos' : 'Central de avisos', 'As informações certas, sempre ao seu alcance.') + `<div class="filter-panel card"><input id="notice-query" type="search" aria-label="Pesquisar avisos" placeholder="Pesquisar avisos…"><div class="chip-row">${filters.map((f, i) => `<button class="filter-chip" data-filter="${f}" aria-pressed="${!i}">${f}</button>`).join('')}</div></div><p id="notice-count" class="muted" role="status"></p><div class="grid cards" id="notice-list"></div>`, bind(root) {
    let filter = 'Todos';
    const draw = () => {
      const q = normalize(root.querySelector('input').value);
      const items = all.filter(r => normalize(r.title + ' ' + r.text).includes(q) && (filter === 'Todos' || filter === 'Hoje' && r.date.slice(0, 10) === iso(new Date()) || filter === 'Importantes' && ['Importante', 'Urgente'].includes(r.priority) || filter === 'Disciplinas' && r.subject_id || filter === 'Direção' && !r.subject_id && r.extra?.area !== 'passaporte' || filter === 'Eventos' && r.extra?.area === 'eventos' || filter === 'Passaporte' && r.extra?.area === 'passaporte'));
      items.sort((a,b) => Number(b.priority === 'Urgente') - Number(a.priority === 'Urgente'));
      root.querySelector('#notice-count').textContent = `${items.length} resultado(s)`;
      root.querySelector('#notice-list').innerHTML = items.map(r => card(r).replace('</article>', `<div class="read-marker">${states.some(s => s.source_id === r.id && s.read) ? '✓ Lido' : '• Não lido'}</div></article>`)).join('') || empty('Nenhum aviso nesta seleção.');
    };
    root.querySelector('input').oninput = draw;
    root.querySelectorAll('[data-filter]').forEach(b => b.onclick = () => { filter = b.dataset.filter; root.querySelectorAll('[data-filter]').forEach(x => x.setAttribute('aria-pressed', x === b)); draw(); }); draw();
  } };
}

export async function passport({ profile }) {
  const { rows } = await publications(profile);
  const items = rows.filter(r => r.extra?.area === 'passaporte' || normalize(r.subject?.name || '') === 'passaporte');
  const tabs = ['Todos', 'Atividade', 'Encontro', 'Formulário', 'Aviso', 'Projeto'];
  return { html: `<section class="passport-hero"><p class="eyebrow">APRENDER VAI ALÉM DA SALA DE AULA</p><h1>Seu próximo capítulo<br>começa aqui.</h1><p>Experiências, projetos e descobertas. Este é o seu Passaporte.</p><span class="passport-stamp" aria-hidden="true">SESI<br>PASSAPORTE ↗</span></section><div class="topbar"><h2>Explore as oportunidades</h2>${profile.role === 'system_admin' ? '<button class="btn" data-publish>+ Nova publicação</button>' : ''}</div><div class="chip-row">${tabs.map((t,i) => `<button class="filter-chip" data-pass="${t}" aria-pressed="${!i}">${t}</button>`).join('')}</div><div class="grid cards" id="passport-items"></div>`, bind(root) {
    const draw = t => root.querySelector('#passport-items').innerHTML = items.filter(r => t === 'Todos' || (r.extra?.kind || r.label) === t).map(card).join('') || empty('Nenhuma publicação nesta categoria. Novas experiências aparecerão aqui.');
    root.querySelectorAll('[data-pass]').forEach(b => b.onclick = () => { root.querySelectorAll('[data-pass]').forEach(x => x.setAttribute('aria-pressed', x === b)); draw(b.dataset.pass); }); draw('Todos');
  } };
}

export async function calendarPage({ profile }) {
  const { rows } = await publications(profile);
  const records = rows.filter(r => r.due_date || r.event_date);
  const initial = params().get('v') || 'mes';
  return { html: head('SUA ROTINA, ORGANIZADA', 'Calendário escolar', 'Entregas, encontros e eventos em uma única agenda.') + `<div class="calendar-toolbar"><div class="chip-row">${[['mes','Mês'],['semana','Semana'],['agenda','Agenda'],['hoje','Hoje']].map(([v,l]) => `<button class="filter-chip" data-mode="${v}">${l}</button>`).join('')}</div><div class="calendar-pager"><button class="iconbtn" data-prev aria-label="Período anterior">←</button><strong id="period-label"></strong><button class="iconbtn" data-next aria-label="Próximo período">→</button></div></div><div id="calendar-body"></div>`, bind(root) {
    let mode = initial, cursor = new Date();
    const draw = () => {
      root.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === mode));
      root.querySelector('#period-label').textContent = cursor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', ...(mode !== 'mes' ? { day: 'numeric' } : {}) });
      let html = '';
      if (mode === 'mes') {
        const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1); start.setDate(start.getDate() - start.getDay());
        html = `<div class="calendar-grid">${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d => `<div class="calendar-weekday">${d}</div>`).join('')}${Array.from({length:42}, (_,i) => { const d = new Date(start); d.setDate(d.getDate()+i); const key = iso(d); return `<div class="calendar-cell ${d.getMonth() !== cursor.getMonth() ? 'outside' : ''} ${key === iso(new Date()) ? 'is-today' : ''}"><span>${d.getDate()}</span>${records.filter(r => date(r) === key).map(r => `<a class="calendar-event ${r.type}" href="${postLink(r)}" title="${esc(r.title)}">${esc(r.title)}</a>`).join('')}</div>`; }).join('')}</div>`;
      } else {
        const start = iso(cursor), end = new Date(cursor); end.setDate(end.getDate() + (mode === 'hoje' ? 0 : mode === 'semana' ? 6 : 30));
        const selected = records.filter(r => date(r) >= start && date(r) <= iso(end)).sort((a,b) => date(a).localeCompare(date(b)));
        html = selected.map(r => `<div class="agenda-row"><div class="agenda-date">${fullDate(date(r))}</div>${card(r)}</div>`).join('') || empty('Nenhum compromisso neste período. Você está em dia!');
      }
      root.querySelector('#calendar-body').innerHTML = html;
    };
    root.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { mode = b.dataset.mode; cursor = new Date(); draw(); });
    const move = n => { if (mode === 'mes') cursor = new Date(cursor.getFullYear(), cursor.getMonth()+n, 1); else cursor.setDate(cursor.getDate()+n*(mode === 'semana' ? 7 : mode === 'hoje' ? 1 : 31)); draw(); };
    root.querySelector('[data-prev]').onclick = () => move(-1); root.querySelector('[data-next]').onclick = () => move(1); draw();
  } };
}

export async function detailPage({ profile }, table) {
  const id = decodeURIComponent(location.hash.split('?')[0].split('/')[3] || '');
  const [{ rows }, states, links] = await Promise.all([publications(profile), readingState(profile), list('teacher_subjects')]);
  const r = rows.find(r => r.type === table && r.id === id);
  if (!r) return empty('Publicação indisponível ou sem permissão para sua conta.');
  const state = states.find(s => s.source_id === id && s.source_type === table) || {};
  const manage = profile.role === 'system_admin' || profile.role === 'teacher' && r.created_by === profile.id && links.some(l => l.teacher_id === profile.id && l.subject_id === r.subject_id);
  const url = safeUrl(r.url || r.extra?.url), image = safeUrl(r.extra?.image);
  return { html: `<a class="text-link" href="#/mural">← Voltar ao mural</a><article class="card detail-card">${image ? `<img class="event-cover" src="${esc(image)}" alt="${esc(r.title)}" loading="lazy">` : ''}<p class="eyebrow">${esc(r.subject?.name || r.extra?.area || 'Comunidade SESI')}</p><h1>${esc(r.title)}</h1><p class="muted">${esc(r.author)} · ${r.date ? new Date(r.date).toLocaleString('pt-BR') : 'Publicação inicial'}</p><div class="chip-row"><span class="badge">${esc(r.extra?.kind || r.label)}</span>${priorityBadge(r.priority || 'Normal')}</div><p class="detail-text">${esc(r.text)}</p><dl class="profile-details">${date(r) ? `<dt>Data / prazo</dt><dd>${fullDate(date(r))}</dd>` : ''}${r.event_time || r.extra?.time ? `<dt>Horário</dt><dd>${esc(r.event_time || r.extra.time)}</dd>` : ''}${r.location || r.extra?.location ? `<dt>Local</dt><dd>${esc(r.location || r.extra.location)}</dd>` : ''}</dl>${url ? `<a class="btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${r.extra?.kind === 'Formulário' ? 'Abrir formulário / inscrição' : 'Abrir material'}</a>` : ''}${r.extra?.attachment ? `<button class="btn" data-attachment>Baixar ${esc(r.extra.attachment.name)}</button>` : ''}<div class="actions wrap"><button class="btn ghost" data-read>${state.read ? '✓ Lido' : 'Marcar como lido'}</button><button class="btn ghost" data-save>${state.saved ? '★ Salvo' : 'Salvar'}</button><button class="btn ghost" data-share>Compartilhar / QR</button>${manage ? '<button class="btn ghost" data-edit>Editar</button><button class="btn ghost" data-delete>Excluir</button>' : ''}</div></article>`, bind(root, render) {
    ['read','save'].forEach(k => root.querySelector(`[data-${k}]`).onclick = async () => { try { await toggleReading(profile, table, id, k === 'save' ? 'saved' : 'read'); render(); } catch { toast('Não foi possível salvar sua preferência.', 'err'); } });
    root.querySelector('[data-share]').onclick = () => sharePost(r);
    root.querySelector('[data-attachment]')?.addEventListener('click', async () => { try { await openAttachment(r.extra.attachment); } catch { toast('Não foi possível abrir o anexo.', 'err'); } });
    if (manage) {
      root.querySelector('[data-delete]').onclick = async () => { if (await confirmDialog('Excluir publicação', 'Esta publicação deixará de aparecer no portal. O histórico será preservado.', 'Excluir')) { try { await changePublication(profile, table, id, {}, 'DELETE'); location.hash = '#/mural'; } catch(e) { toast(e.message,'err'); } } };
      root.querySelector('[data-edit]').onclick = () => {
        const m = modal('Editar publicação', `<form id="edit-post"><label for="edit-title">Título</label><input id="edit-title" required maxlength="140" value="${esc(r.title)}"><label for="edit-text">Descrição</label><textarea id="edit-text" rows="5" maxlength="5000">${esc(r.text)}</textarea>${r.due_date || r.event_date ? `<label for="edit-date">Data / prazo</label><input id="edit-date" required type="date" value="${date(r)}">` : ''}<label for="edit-room">Local</label><input id="edit-room" value="${esc(r.location || r.extra?.location || '')}"><p role="alert" id="edit-error"></p><div class="actions"><button type="button" class="btn ghost" data-cancel>Cancelar</button><button class="btn">Salvar alterações</button></div></form>`);
        m.el.querySelector('[data-cancel]').onclick = m.close;
        m.el.querySelector('form').onsubmit = async e => { e.preventDefault(); const button = e.submitter || e.currentTarget.querySelector('button:not([type="button"])'); button.disabled = true; const $ = s => m.el.querySelector(s); try { await changePublication(profile, table, id, { title: $('#edit-title').value, [table === 'announcements' ? 'content' : 'description']: $('#edit-text').value, ...(r.due_date ? {due_date:$('#edit-date').value} : r.event_date ? {event_date:$('#edit-date').value} : {}), ...(table === 'school_events' ? {location:$('#edit-room').value} : {extra:{...r.extra,location:$('#edit-room').value}}) }); m.close(); toast('Alteração salva e comunicada.'); render(); } catch(e) { $('#edit-error').textContent = e.message; button.disabled = false; } };
      };
    }
  } };
}

async function sharePost(r) {
  const url = new URL('dashboard.html', location.href); url.hash = r ? postLink(r).slice(1) : '/';
  const m = modal('Compartilhar publicação', `<p>O acesso respeita as permissões da conta. Para abrir em outro aparelho, use o endereço hospedado da escola.</p><div id="qr-code"></div><label for="share-url">Link direto</label><input id="share-url" readonly value="${esc(url.href)}"><div class="actions"><button class="btn" data-copy>Copiar link</button><button class="btn ghost" data-close>Fechar</button></div>`);
  m.el.querySelector('[data-close]').onclick = m.close;
  m.el.querySelector('[data-copy]').onclick = async () => { try { await navigator.clipboard.writeText(url.href); toast('Link copiado.'); } catch { m.el.querySelector('input').select(); toast('Selecione e copie o link.'); } };
  try { const { default: QRCode } = await import('./vendor/qrcode.js'); const canvas = document.createElement('canvas'); await QRCode.toCanvas(canvas, url.href, { width:240, margin:3 }); canvas.setAttribute('aria-label','QR Code desta publicação'); m.el.querySelector('#qr-code').append(canvas); } catch { m.el.querySelector('#qr-code').textContent = 'QR indisponível. Use o link abaixo.'; }
}

export async function changesPage({ profile }) {
  if (!['system_admin','teacher'].includes(profile.role)) return empty('O histórico administrativo é restrito à equipe autorizada.');
  const [logs, people, links, ...tables] = await Promise.all([list('audit_logs'), list('profiles'), list('teacher_subjects'), ...TABLES.map(t => list(t))]);
  const pending = tables.flatMap((rs,i) => rs.filter(r => r.status === 'pending' && (profile.role === 'system_admin' || links.some(l => l.teacher_id === profile.id && l.subject_id === r.subject_id))).map(r => ({...r,type:TABLES[i]})));
  return { html: head('TRANSPARÊNCIA E CUIDADO', 'Gestão de publicações', 'Revise contribuições dos monitores e acompanhe as alterações.') + `<section class="card"><h2>Aguardando aprovação · ${pending.length}</h2>${pending.map(r => `<div class="item"><div class="grow"><strong>${esc(r.title)}</strong><p>${esc(r.content || r.description)}</p><p class="muted">${esc(people.find(p => p.id === r.created_by)?.full_name || 'Monitor')} · ${esc(r.extra?.reason || 'Contribuição de monitor')}</p></div><button class="btn" data-approve="${esc(r.id)}" data-table="${r.type}">Aprovar</button></div>`).join('') || empty('Nenhuma publicação aguardando revisão.')}</section><section class="card search-group"><h2>Histórico de alterações</h2>${logs.filter(l => profile.role === 'system_admin' || links.some(x => x.teacher_id === profile.id && x.subject_id === (l.metadata?.new?.subject_id || l.metadata?.old?.subject_id))).sort((a,b) => b.created_at.localeCompare(a.created_at)).slice(0,100).map(l => `<div class="audit-item"><span class="audit-dot"></span><div><strong>${esc(l.metadata?.new?.title || l.metadata?.old?.title || l.entity_type)}</strong><p>${esc(({INSERT:'Publicação criada',UPDATE:'Publicação editada',DELETE:'Publicação excluída',APPROVE:'Publicação aprovada'})[l.action] || l.action)}</p>${l.metadata?.old?.due_date !== l.metadata?.new?.due_date && l.metadata?.old?.due_date ? `<p>Prazo: ${esc(l.metadata.old.due_date)} → ${esc(l.metadata.new?.due_date || 'removido')}</p>` : ''}<span class="muted">${esc(people.find(p => p.id === l.user_id)?.full_name || 'Equipe SESI')} · ${new Date(l.created_at).toLocaleString('pt-BR')}</span></div></div>`).join('') || empty('As próximas alterações serão registradas aqui.')}</section>`, bind(root, render) { root.querySelectorAll('[data-approve]').forEach(b => b.onclick = async () => { b.disabled = true; try { await changePublication(profile,b.dataset.table,b.dataset.approve,{},'APPROVE'); toast('Publicação aprovada.'); render(); } catch(e) { toast(e.message,'err'); b.disabled = false; } }); } };
}

export async function displayPage({ profile }) {
  const { rows } = await publications(profile);
  const items = rows.filter(r => r.priority === 'Urgente' || date(r) >= iso(new Date())).sort((a,b) => Number(b.priority === 'Urgente') - Number(a.priority === 'Urgente')).slice(0,12);
  return { html: `<section class="display-head"><div><p class="eyebrow">CONECTADOS COM O SEU DIA</p><h1>Hoje no SESI</h1></div><time id="wall-clock"></time><button class="btn ghost" id="wall-fullscreen">Tela cheia</button><button class="btn ghost" id="wall-share">QR do portal</button><a class="text-link" href="#/">Sair do modo mural</a></section><div class="grid cards wall-posts">${items.map(card).join('') || empty('Nenhuma novidade para hoje.')}</div><p class="muted">Acesse o portal para consultar os detalhes. Atualização automática a cada minuto.</p>`, bind(root, render) {
    root.querySelector('#wall-share').onclick = () => sharePost(null); document.body.classList.add('wall-mode'); const update = () => root.querySelector('#wall-clock').textContent = new Date().toLocaleString('pt-BR',{weekday:'long',hour:'2-digit',minute:'2-digit'}); update(); const timer = setInterval(update,1000), refresh = setInterval(render,60000);
    root.querySelector('#wall-fullscreen').onclick = async () => { try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); else await document.exitFullscreen(); } catch { toast('Tela cheia indisponível neste navegador.'); } };
    return () => { clearInterval(timer); clearInterval(refresh); document.body.classList.remove('wall-mode'); };
  } };
}

export async function eventsPage({ profile }) { const { rows } = await publications(profile); return head('VIVA A ESCOLA', 'Eventos escolares', 'Encontros que conectam ideias e pessoas.') + `<div class="grid cards">${rows.filter(r => r.type === 'school_events').map(r => card(r).replace('<article class="card portal-post">', `<article class="card portal-post"><img class="event-cover" src="${esc(safeUrl(r.extra?.image) || 'assets/images/sesi-escola.jpg')}" alt="${r.extra?.image ? esc(r.title) : 'Fachada da escola SESI'}" loading="lazy">`)).join('') || empty('Novos eventos serão divulgados aqui.')}</div>`; }
