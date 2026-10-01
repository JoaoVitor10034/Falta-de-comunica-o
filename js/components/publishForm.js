import { uploadAttachment } from '../services/attachmentService.js';
import { modal, toast } from './ui.js';
import { create, list } from '../services/dataService.js';
import { allowedSubjects, canPublishGeneral, isEmergency } from '../permissions.js';
import { esc } from '../utils/format.js';

const F = (id, label, type = 'text', req = true) => ({ id, label, type, req });
const TYPES = {
  materials: { label: 'Material', subject: true, fields: [F('title','Título'), F('description','Descrição','textarea',false), F('url','Link do arquivo (URL)','url',false)] },
  assignments: { label: 'Trabalho', subject: true, fields: [F('title','Título'), F('description','Descrição','textarea',false), F('due_date','Data de entrega','date')] },
  activities: { label: 'Atividade', subject: true, fields: [F('title','Título'), F('description','Descrição','textarea',false), F('due_date','Prazo','date',false)] },
  announcements: { label: 'Aviso', general: true, fields: [F('title','Título'), F('content','Mensagem','textarea'), { id:'priority', label:'Prioridade', type:'select', opts:['Normal','Importante','Urgente'], req:true }, { id:'category', label:'Categoria', type:'select', opts:['Diário','Assuntos SESI'], req:true }] },
  school_events: { label: 'Evento', general: true, fields: [F('title','Nome'), F('description','Descrição','textarea',false), F('event_date','Data','date'), F('event_time','Horário','text',false), F('location','Local','text',false)] }
};
const input = f => f.type === 'textarea' ? `<textarea id="f_${f.id}" rows="3" ${f.req ? 'required' : ''}></textarea>`
  : f.type === 'select' ? `<select id="f_${f.id}">${f.opts.map(o => `<option>${o}</option>`).join('')}</select>`
  : `<input id="f_${f.id}" type="${f.type}" ${f.req ? 'required' : ''}>`;

export async function openPublish({ profile, subjects, links, subjectId, onDone }) {
  const subs = allowedSubjects(profile, subjects, links);
  const types = Object.entries(TYPES).filter(([, t]) => t.general ? canPublishGeneral(profile) : subs.length);
  if (!types.length) return toast('Você não tem permissão para publicar.');
  const m = modal('Nova publicação', `<form id="pf"><label for="type">Tipo</label><select id="type">${types.map(([k, t]) => `<option value="${k}">${t.label}</option>`).join('')}</select>
    <div id="dyn"></div><div class="publish-grid"><div><label for="pub-area">Seção</label><select id="pub-area"><option value="disciplina">Disciplina / escola</option>${profile.role === 'system_admin' ? '<option value="passaporte">Passaporte</option><option value="eventos">Eventos</option><option value="direcao">Direção</option>' : ''}</select></div><div><label for="pub-audience">Público</label><select id="pub-audience"><option value="all">Toda a comunidade</option><option value="2A">Turma 2A</option><option value="2B">Turma 2B</option></select></div><div><label for="pub-kind">Categoria</label><select id="pub-kind"><option value="">Conforme o tipo</option><option>Aviso</option><option>Prova</option><option>Apresentação</option><option>Prazo</option><option>Formulário</option><option>Encontro</option><option>Projeto</option><option>Atividade</option></select></div><div><label for="pub-format">Formato do material</label><select id="pub-format"><option>Links</option><option>PDF</option><option>Slides</option><option>Documentos</option><option>Vídeos</option></select></div><div><label for="pub-time">Horário (opcional)</label><input id="pub-time" type="time"></div><div><label for="pub-room">Sala / local (opcional)</label><input id="pub-room" maxlength="100"></div></div><label for="pub-priority">Prioridade da publicação</label><select id="pub-priority"><option>Normal</option><option>Importante</option>${profile.role === 'system_admin' ? '<option>Urgente</option>' : ''}</select><label for="pub-url">Link de formulário ou anexo (opcional)</label><input id="pub-url" type="url" placeholder="https://…"><label for="pub-image">Imagem do evento — URL (opcional)</label><input id="pub-image" type="url" placeholder="https://…"><label for="pub-file">Anexar arquivo (opcional)</label><input id="pub-file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.docx,.pptx"><p class="muted">Até 2 MB no demo ou 5 MB com Supabase.</p><p class="publish-hint">${profile.role === 'student_admin' ? 'Sua contribuição será enviada para aprovação do professor ou da direção.' : 'Ao publicar, o público selecionado recebe uma notificação no portal.'}</p><p id="publish-error" role="alert"></p><div class="actions"><button type="button" class="btn ghost" data-x>Cancelar</button><button class="btn">${profile.role === 'student_admin' ? 'Enviar para aprovação' : 'Publicar'}</button></div></form>`);
  const $ = s => m.el.querySelector(s);
  try { const people = await list('profiles'); const classes = [...new Set(people.map(p => p.turma).filter(Boolean))]; $('#pub-audience').innerHTML = '<option value="all">Toda a comunidade</option>' + classes.map(t => `<option value="${esc(t)}">Turma ${esc(t)}</option>`).join(''); } catch { /* Mantém opções básicas disponíveis. */ }
  const draw = () => {
    const t = TYPES[$('#type').value];
    $('#dyn').innerHTML = (t.subject ? `<label for="f_subject">Disciplina</label><select id="f_subject">${subs.map(s => `<option value="${s.id}" ${s.id === subjectId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select><div id="why"></div>` : '') + t.fields.map(f => `<label for="f_${f.id}">${f.label}</label>${input(f)}`).join('');
    const sel = $('#f_subject'), why = () => { if ($('#why')) $('#why').innerHTML = isEmergency(profile, sel.value, links) ? `<label for="f_reason">Motivo da publicação emergencial</label><input id="f_reason" required>` : ''; };
    if (sel) { sel.onchange = why; why(); }
  };
  $('#type').onchange = draw; draw(); $('[data-x]').onclick = m.close;
  $('#pf').onsubmit = async e => {
    e.preventDefault(); const key = $('#type').value, t = TYPES[key], row = {};
    t.fields.forEach(f => { const v = $('#f_' + f.id).value; if (v !== '') row[f.id] = v; });
    if (t.subject) row.subject_id = $('#f_subject').value;
    row.priority = $('#f_priority')?.value || $('#pub-priority').value;
    row.extra = { area: $('#pub-area').value, audience: $('#pub-audience').value, kind: $('#pub-kind').value, format: $('#pub-format').value, time: $('#pub-time').value, location: $('#pub-room').value, url: $('#pub-url').value, image: $('#pub-image').value, reason: $('#f_reason')?.value || '' };
    const b = $('#pf .btn:last-child'); b.disabled = true; b.textContent = 'Publicando...';
    try { const file = $('#pub-file').files[0]; if (file) row.extra.attachment = await uploadAttachment(file, profile); await create(key, row, profile, $('#f_reason')?.value);
      m.close(); toast(profile.role === 'student_admin' ? 'Enviada para aprovação.' : 'Publicação enviada e notificações geradas.'); onDone?.(); }
    catch (error) { $('#publish-error').textContent = error.message || 'Não foi possível publicar.'; b.disabled = false; b.textContent = 'Tentar novamente'; }
  };
}
