import { bindNotificationPreferences } from './preferences.js';
import { updateProfile } from './services/profileService.js';
import { isDemo } from './supabase.js';
import { esc } from './utils/format.js';
import { roleLabel, canPublishGeneral } from './permissions.js';
import { toast } from './components/ui.js';

const initials = name => name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('');
export async function profilePage({ profile }, active = 'geral') {
  const tabs = [['geral', 'Informações gerais'], ['conta', 'Meu perfil'], ['configuracoes', 'Configurações']];
  if (!tabs.some(([id]) => id === active)) active = 'geral';
  const email = isDemo ? (profile.email || 'aluno@demo').replace('@demo', '@exemplo.com') : profile.email;
  const hero = `<section class="card profile-heading"><span class="avatar profile-avatar">${esc(initials(profile.full_name))}</span><div><p class="eyebrow">SEU ESPAÇO NO PORTAL</p><h1>${esc(profile.full_name)}</h1><p class="muted">${roleLabel(profile.role)}${profile.turma ? ' · Turma ' + esc(profile.turma) : ''}</p></div><button class="btn ghost" data-logout>Sair da conta</button></section><nav class="tabs profile-tabs" aria-label="Seções do perfil">${tabs.map(([id, label]) => `<a href="#/perfil/${id}" ${active === id ? 'aria-current="page"' : ''}>${label}</a>`).join('')}</nav>`;
  let body;
  if (active === 'geral') body = `<div class="grid two"><section class="card"><h2>Informações gerais</h2><dl class="profile-details"><dt>Nome</dt><dd>${esc(profile.full_name)}</dd><dt>E-mail${isDemo ? ' de exemplo' : ''}</dt><dd>${esc(email || 'Não informado')}</dd><dt>Perfil de acesso</dt><dd>${roleLabel(profile.role)}</dd><dt>Turma</dt><dd>${esc(profile.turma || 'Não vinculada')}</dd><dt>Sobre mim</dt><dd>${esc(profile.bio || 'Adicione uma apresentação na aba Meu perfil.')}</dd></dl></section><section class="card"><h2>Sua comunidade</h2><p class="muted">${isDemo ? 'Você está no modo de demonstração. Mensagens são compartilhadas entre abas deste navegador; aparelhos diferentes precisam do Supabase.' : 'Sua conta está conectada à comunidade escolar.'}</p><div class="profile-shortcuts"><a class="text-link" href="#/disciplinas">Explorar disciplinas →</a><a class="text-link" href="#/avisos">Avisos da escola →</a><a class="text-link" href="#/passaporte">Passaporte →</a><a class="text-link" href="#/salvos">Meus salvos →</a><a class="text-link" href="#/mural">Comunidade →</a><a class="text-link" href="#/eventos">Eventos escolares →</a>${canPublishGeneral(profile) ? '<a class="text-link" href="#/admin">Enviar avisos diretos →</a>' : ''}</div></section></div>`;
  if (active === 'conta') body = `<section class="card profile-form"><h2>Meu perfil</h2><p class="muted">Personalize como você aparece para a comunidade.</p><form id="profile-form"><label for="profile-name">Nome de exibição</label><input id="profile-name" maxlength="80" required value="${esc(profile.full_name)}" autocomplete="name"><label for="profile-email">E-mail${isDemo ? ' de exemplo' : ' da conta'}</label><input id="profile-email" type="email" readonly value="${esc(email || '')}" aria-describedby="email-help"><p class="muted" id="email-help">${isDemo ? `Endereço fictício de apresentação. Seu login continua sendo ${esc(profile.email)}.` : 'O e-mail de acesso é administrado pela escola.'}</p><label for="profile-bio">Sobre mim</label><textarea id="profile-bio" maxlength="400" rows="4" placeholder="Conte um pouco sobre seus interesses e estudos…">${esc(profile.bio || '')}</textarea><p id="profile-status" role="status"></p><div class="actions"><button class="btn" type="submit">Salvar perfil</button></div></form></section>`;
  if (active === 'configuracoes') body = `<section class="card"><h2>Aparência do portal</h2><p class="muted">As mudanças são aplicadas na hora e ficam salvas neste navegador.</p><fieldset class="settings-group"><legend>Tema</legend><div class="appearance-options">${[['light', 'Claro', 'Fundo claro para o dia a dia'], ['dark', 'Escuro', 'Fundos escuros e texto claro'], ['system', 'Automático', 'Acompanhar o tema do aparelho']].map(([id, title, text]) => `<label class="appearance-option"><input type="radio" name="theme" value="${id}"><span><strong>${title}</strong><small>${text}</small></span></label>`).join('')}</div></fieldset><fieldset class="settings-group"><legend>Cor dos botões principais</legend><div class="appearance-options">${[['green', 'Verde'], ['blue', 'Azul']].map(([id, label]) => `<label class="appearance-option"><input type="radio" name="accent" value="${id}"><span class="color-dot ${id}"></span><strong>${label}</strong></label>`).join('')}</div></fieldset><p id="appearance-status" role="status"></p><div class="actions"><button class="btn ghost" id="reset-appearance">Restaurar padrão</button></div></section>`;
  return { html: hero + body, bind(root, render) {
    if (active === 'conta') {
      root.querySelector('#profile-form').onsubmit = async e => {
        e.preventDefault(); const button = e.currentTarget.querySelector('button'), status = root.querySelector('#profile-status'); button.disabled = true;
        try { await updateProfile(profile, { full_name: root.querySelector('#profile-name').value, bio: root.querySelector('#profile-bio').value }); toast('Perfil atualizado.'); render(); }
        catch (error) { status.textContent = error.message; button.disabled = false; }
      };
    }
    if (active === 'configuracoes') {
      bindNotificationPreferences(root, profile);
      const paint = () => { const settings = window.portalAppearance.get(); root.querySelectorAll('input[type=radio]').forEach(input => input.checked = settings[input.name] === input.value); };
      const set = value => { try { window.portalAppearance.set(value); root.querySelector('#appearance-status').textContent = 'Preferências salvas.'; } catch { root.querySelector('#appearance-status').textContent = 'Não foi possível salvar neste navegador.'; } paint(); };
      root.querySelectorAll('input[type=radio]').forEach(input => input.onchange = () => set({ [input.name]: input.value }));
      root.querySelector('#reset-appearance').onclick = () => set({ theme: 'system', accent: 'green' }); paint();
    }
  } };
}
