import { sb, isDemo } from '../supabase.js';
import { load, save } from './dataService.js';

export async function updateProfile(user, values) {
  const full_name = values.full_name.trim(), bio = values.bio.trim();
  if (!full_name || full_name.length > 80 || bio.length > 400) throw new Error('Informe um nome de até 80 caracteres e uma apresentação de até 400.');
  if (!isDemo) {
    const { error } = await sb.rpc('update_my_profile', { p_name: full_name, p_bio: bio });
    if (error) throw new Error('Não foi possível salvar o perfil. Confira se a migração v4 foi aplicada.');
  } else {
    const db = load(), current = db.profiles.find(p => p.id === user.id);
    if (!current) throw new Error('Conta não encontrada.');
    Object.assign(current, { full_name, bio }); save(db);
    sessionStorage.setItem('sesi_user', JSON.stringify({ ...user, full_name, bio }));
  }
  Object.assign(user, { full_name, bio });
  window.dispatchEvent(new CustomEvent('sesi:profile', { detail: user }));
}
