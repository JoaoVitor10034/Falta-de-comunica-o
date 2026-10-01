import { list, load, save } from './services/dataService.js';
import { sb, isDemo } from './supabase.js';
import { esc } from './utils/format.js';
import { roleLabel } from './permissions.js';
import { toast, empty } from './components/ui.js';

export async function manageSchool(actor, action, data) {
  if(actor.role !== 'system_admin') throw new Error('Apenas a direção pode gerenciar a escola.');
  if(action === 'profile' && (data.id === actor.id || !['student','teacher','student_admin','system_admin'].includes(data.role))) throw new Error('Não altere suas próprias permissões.');
  if(action === 'subject' && (!data.name?.trim() || data.name.length>100)) throw new Error('Informe o nome da disciplina (até 100 caracteres).');
  if(!['profile','subject','link','unlink'].includes(action)) throw new Error('Operação inválida.');
  if(isDemo) {
    const db=load();
    if(action==='profile') { const p=db.profiles.find(p=>p.id===data.id); if(!p) throw new Error('Conta não encontrada.'); p.role=data.role; p.turma=data.turma.slice(0,30); }
    if(action==='subject') { const old=db.subjects.find(s=>s.id===data.id); const row={name:data.name.trim(),description:data.description.slice(0,500),area:data.area}; if(old) Object.assign(old,row); else db.subjects.push({id:crypto.randomUUID(),...row}); }
    if(action==='link' || action==='unlink') {
      if(!db.profiles.some(p=>p.id===data.teacher_id&&p.role==='teacher') || !db.subjects.some(s=>s.id===data.subject_id)) throw new Error('Escolha um professor e uma disciplina válidos.');
      db.teacher_subjects=db.teacher_subjects.filter(l=>l.teacher_id!==data.teacher_id || l.subject_id!==data.subject_id);
      if(action==='link') db.teacher_subjects.push({teacher_id:data.teacher_id,subject_id:data.subject_id});
    }
    db.audit_logs.push({id:crypto.randomUUID(),user_id:actor.id,action:'SCHOOL_'+action.toUpperCase(),entity_type:action,metadata:{new:data},created_at:new Date().toISOString()});
    save(db); window.dispatchEvent(new Event('sesi:change')); return;
  }
  let query;
  if(action==='profile') query=sb.from('profiles').update({role:data.role,turma:data.turma}).eq('id',data.id);
  if(action==='subject') { const row={name:data.name.trim(),description:data.description,area:data.area}; query=data.id ? sb.from('subjects').update(row).eq('id',data.id) : sb.from('subjects').insert(row); }
  if(action==='link') query=sb.from('teacher_subjects').upsert({teacher_id:data.teacher_id,subject_id:data.subject_id});
  if(action==='unlink') query=sb.from('teacher_subjects').delete().eq('teacher_id',data.teacher_id).eq('subject_id',data.subject_id);
  const {error}=await query; if(error) throw error;
}

export async function schoolPage({profile}) {
  if(profile.role!=='system_admin') return empty('Esta área é exclusiva da direção.');
  const [people,subjects,links]=await Promise.all(['profiles','subjects','teacher_subjects'].map(t=>list(t)));
  return {html:`<div class="page-heading"><p class="eyebrow">ADMINISTRAÇÃO ESCOLAR</p><h1>Pessoas e disciplinas</h1><p class="muted">Gerencie os perfis existentes e os vínculos de professores. Contas de acesso reais são criadas no Supabase Authentication.</p></div><div class="grid two"><section class="card"><h2>Perfis e turmas</h2><form id="manage-person"><label for="manage-user">Pessoa</label><select id="manage-user">${people.filter(p=>p.id!==profile.id).map(p=>`<option value="${esc(p.id)}">${esc(p.full_name)}</option>`).join('')}</select><label for="manage-role">Perfil</label><select id="manage-role">${['student','teacher','student_admin','system_admin'].map(r=>`<option value="${r}">${roleLabel(r)}</option>`).join('')}</select><label for="manage-class">Turma</label><input id="manage-class" maxlength="30"><div class="actions"><button class="btn">Salvar permissões</button></div></form></section><section class="card"><h2>Disciplinas</h2><form id="manage-subject"><label for="manage-subject-id">Disciplina</label><select id="manage-subject-id"><option value="">+ Nova disciplina</option>${subjects.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select><label for="manage-name">Nome</label><input id="manage-name" required maxlength="100"><label for="manage-desc">Descrição</label><textarea id="manage-desc" maxlength="500"></textarea><label for="manage-area">Área de conhecimento</label><input id="manage-area" maxlength="80"><div class="actions"><button class="btn">Salvar disciplina</button></div></form></section></div><section class="card search-group"><h2>Professores responsáveis</h2><form id="manage-link" class="publish-grid"><div><label for="link-teacher">Professor</label><select id="link-teacher">${people.filter(p=>p.role==='teacher').map(p=>`<option value="${esc(p.id)}">${esc(p.full_name)}</option>`).join('')}</select></div><div><label for="link-subject">Disciplina</label><select id="link-subject">${subjects.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select></div><div class="actions"><button class="btn">Vincular professor</button></div></form>${links.map(l=>`<div class="item"><span class="grow">${esc(people.find(p=>p.id===l.teacher_id)?.full_name || 'Professor')} · ${esc(subjects.find(s=>s.id===l.subject_id)?.name)}</span><button class="btn ghost" data-unlink="${esc(l.teacher_id)}" data-subject="${esc(l.subject_id)}">Remover vínculo</button></div>`).join('')}</section>`, bind(root,render) {
    const $=id=>root.querySelector('#'+id), run=async(action,data)=>{try{await manageSchool(profile,action,data);toast('Alterações salvas.');render();}catch(e){toast(e.message,'err');}};
    const person=()=>{const p=people.find(p=>p.id===$('manage-user').value);$('manage-role').value=p.role;$('manage-class').value=p.turma||'';};$('manage-user').onchange=person;person();
    $('manage-person').onsubmit=e=>{e.preventDefault();run('profile',{id:$('manage-user').value,role:$('manage-role').value,turma:$('manage-class').value});};
    $('manage-subject-id').onchange=()=>{const s=subjects.find(s=>s.id===$('manage-subject-id').value);$('manage-name').value=s?.name||'';$('manage-desc').value=s?.description||'';$('manage-area').value=s?.area||'';};
    $('manage-subject').onsubmit=e=>{e.preventDefault();run('subject',{id:$('manage-subject-id').value,name:$('manage-name').value,description:$('manage-desc').value,area:$('manage-area').value});};
    $('manage-link').onsubmit=e=>{e.preventDefault();run('link',{teacher_id:$('link-teacher').value,subject_id:$('link-subject').value});};
    root.querySelectorAll('[data-unlink]').forEach(b=>b.onclick=()=>run('unlink',{teacher_id:b.dataset.unlink,subject_id:b.dataset.subject}));
  }};
}
