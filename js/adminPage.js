import { list } from './services/dataService.js';
import { adminHistory, sendNotice, resolve } from './services/notificationService.js';
import { esc, parse } from './utils/format.js';
import { canPublishGeneral, roleLabel } from './permissions.js';
import { empty, modal, toast, confirmDialog, ring, priorityBadge } from './components/ui.js';
import { icon } from './components/icons.js';

const fmt = d => parse(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const expired = n => n.expires_at && new Date(n.expires_at) < new Date();

const histItem = ({ n, rs }) => {
  const read = rs.filter(r => r.read_at).length, pct = rs.length ? Math.round(read / rs.length * 100) : 0;
  return `<article class="card hist" data-p="${esc(n.priority)}" data-s="${expired(n) ? 'exp' : 'on'}" data-t="${esc(n.title.toLowerCase())}">
  <div class="hist-row"><div>${priorityBadge(n.priority)} <span class="muted">${esc(n.target_label || '')} • ${fmt(n.created_at)}${expired(n) ? ' • Expirado' : ''}</span><h3>${esc(n.title)}</h3><p>${esc(n.message)}</p></div>
  <div class="receipt">${ring(pct)}<span class="muted">${rs.length} entregues<br>${read} lidos</span></div></div>
  <details><summary>Ver leituras</summary><ul class="who">${rs.map(r => `<li><span>${esc(r.name)}</span><span class="${r.read_at ? 'ok' : 'muted'}">${r.read_at ? 'Lido ' + fmt(r.read_at) : 'Pendente'}</span></li>`).join('')}</ul></details></article>`;
};

export async function adminPage({ profile }) {
  if (!canPublishGeneral(profile)) return empty('Acesso restrito a administradores.');
  const [users, hist] = await Promise.all([list('profiles'), adminHistory(profile)]);
  const deliveries = hist.reduce((s, h) => s + h.rs.length, 0), reads = hist.reduce((s, h) => s + h.rs.filter(r => r.read_at).length, 0);
  const html = `<div class="topbar"><div><h1>Avisos diretos</h1><p class="muted">Envie comunicados para todos, um perfil, uma turma ou pessoas específicas.</p></div><button class="btn" data-compose>${icon('plus')} Novo aviso</button></div>
  <div class="grid three stats"><div class="stat"><b data-count="${hist.length}">0</b><span>Avisos enviados</span></div><div class="stat"><b data-count="${deliveries}">0</b><span>Entregas registradas</span></div><div class="stat"><b data-count="${reads}">0</b><span>Leituras</span></div></div>
  <div class="filters"><input id="fq" type="search" placeholder="Buscar por título" aria-label="Buscar por título"><select id="fp" aria-label="Prioridade"><option value="">Todas as prioridades</option><option>Normal</option><option>Importante</option><option>Urgente</option></select><select id="fs" aria-label="Status"><option value="">Todos os status</option><option value="on">Ativos</option><option value="exp">Expirados</option></select></div>
  <div class="grid" id="hist">${hist.map(histItem).join('') || empty('Nenhum aviso enviado ainda. Use “Novo aviso” para começar.')}</div>`;
  return { html, bind(root, refresh) {
    const fq = root.querySelector('#fq'), fp = root.querySelector('#fp'), fs = root.querySelector('#fs');
    const f = () => root.querySelectorAll('.hist').forEach(c => c.hidden = (fp.value && c.dataset.p !== fp.value) || (fs.value && c.dataset.s !== fs.value) || (fq.value && !c.dataset.t.includes(fq.value.toLowerCase())));
    root.querySelectorAll('#fq,#fp,#fs').forEach(e => e.addEventListener('input', f));
    root.querySelector('[data-compose]').onclick = () => openComposer({ profile, users, onDone: refresh });
  } };
}

function openComposer({ profile, users, onDone }) {
  const seg = (name, opts) => `<div class="seg">${opts.map(([v, l], i) => `<label class="chip"><input type="radio" name="${name}" value="${v}" ${i ? '' : 'checked'}><span>${l}</span></label>`).join('')}</div>`;
  const turmas = [...new Set(users.map(u => u.turma).filter(Boolean))].sort();
  const m = modal('Novo aviso', `<form id="cf"><fieldset><legend>Destinatários</legend>${seg('tt', [['all', 'Todos'], ['role', 'Perfil'], ['turma', 'Turma'], ['users', 'Pessoas']])}<div id="tv"></div><p class="muted" id="cnt" aria-live="polite"></p></fieldset>
  <label for="ct">Título</label><input id="ct" maxlength="80" required><label for="cm">Mensagem</label><textarea id="cm" rows="4" required></textarea>
  <fieldset><legend style="margin-top:12px;font-weight:600;font-size:.9rem">Prioridade</legend>${seg('pr', [['Normal', 'Normal'], ['Importante', 'Importante'], ['Urgente', 'Urgente']])}</fieldset>
  <label for="cx">Expira em (opcional)</label><input id="cx" type="datetime-local"><h3 style="margin-top:16px">Pré-visualização</h3><div id="pv"></div>
  <div class="actions"><button type="button" class="btn ghost" data-x>Cancelar</button><button class="btn" id="cs">Revisar e enviar</button></div></form>`);
  m.el.querySelector('.modal').classList.add('wide');
  const $ = s => m.el.querySelector(s), val = n => m.el.querySelector(`[name=${n}]:checked`).value;
  const target = () => { const type = val('tt'); const values = type === 'role' ? [$('#tvs').value] : type === 'turma' ? [$('#tvs').value] : type === 'users' ? [...m.el.querySelectorAll('.pick input:checked')].map(i => i.value) : [];
    const label = type === 'all' ? 'Todos' : type === 'role' ? (values[0] === 'teacher' ? 'Professores' : 'Alunos') : type === 'turma' ? 'Turma ' + values[0] : values.length + ' pessoa(s)'; return { type, values, label }; };
  const drawTv = () => { const t = val('tt');
    $('#tv').innerHTML = t === 'role' ? `<label for="tvs" class="sr">Perfil</label><select id="tvs"><option value="student">Alunos</option><option value="teacher">Professores</option></select>`
      : t === 'turma' ? `<label for="tvs" class="sr">Turma</label><select id="tvs">${turmas.map(x => `<option>${esc(x)}</option>`).join('')}</select>`
      : t === 'users' ? `<div class="pick">${users.map(u => `<label><input type="checkbox" value="${esc(u.id)}"> ${esc(u.full_name)} <span class="muted">${roleLabel(u.role)}</span></label>`).join('')}</div>` : '';
    upd(); };
  const upd = () => { const t = target(); $('#cnt').textContent = `${resolve(users, t).length} destinatário(s)`;
    $('#pv').innerHTML = `<div class="card ${esc(val('pr'))}">${priorityBadge(val('pr'))} <span class="muted">${esc(t.label)}</span><h3>${esc($('#ct').value) || 'Título do aviso'}</h3><p>${esc($('#cm').value) || 'A mensagem aparece aqui.'}</p></div>`; };
  m.el.addEventListener('input', e => e.target.name === 'tt' ? drawTv() : upd()); drawTv();
  $('[data-x]').onclick = m.close;
  $('#cf').onsubmit = async e => { e.preventDefault(); const t = target(), n = resolve(users, t).length;
    if (!n) return toast('Selecione ao menos um destinatário.', 'err');
    if (!await confirmDialog('Enviar aviso?', `O aviso será entregue a ${n} destinatário(s).`, 'Enviar')) return;
    const b = $('#cs'); b.disabled = true; b.textContent = 'Enviando...';
    try { await sendNotice(profile, { title: $('#ct').value, message: $('#cm').value, priority: val('pr'), target: t, target_label: t.label, expires_at: $('#cx').value || null }); m.close(); toast(`Aviso enviado para ${n} pessoa(s).`); onDone(); }
    catch (error) { toast(error.message || 'Não foi possível enviar o aviso.', 'err'); b.disabled = false; b.textContent = 'Revisar e enviar'; } };
}
