import { sb, isDemo } from './supabase.js';
import { load } from './services/dataService.js';
export async function login(email, password) {
  if (isDemo) { const u = load().profiles.find(p => p.email === email.trim().toLowerCase()); if (!u) throw new Error('Use um e-mail de demonstração.'); sessionStorage.setItem('sesi_user', JSON.stringify(u)); return; }
  const { error } = await sb.auth.signInWithPassword({ email, password }); if (error) throw new Error('E-mail ou senha inválidos.');
}
export async function getProfile() {
  if (isDemo) { const user = JSON.parse(sessionStorage.getItem('sesi_user') || 'null'); return user ? { ...user, ...load().profiles.find(p => p.id === user.id) } : null; }
  const { data: { session } } = await sb.auth.getSession(); if (!session) return null;
  const { data } = await sb.from('profiles').select('*').eq('id', session.user.id).single(); return data;
}
export async function logout() { isDemo ? sessionStorage.removeItem('sesi_user') : await sb.auth.signOut(); location.href = 'login.html'; }
