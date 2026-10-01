export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const parse = d => new Date(String(d).length === 10 ? d + 'T00:00:00' : d);
export const daysUntil = d => { const a = parse(d); a.setHours(0,0,0,0); const t = new Date(); t.setHours(0,0,0,0); return Math.round((a - t) / 864e5); };
export const dayBox = d => { const x = parse(d); return `${x.getDate()}<br>${x.toLocaleDateString('pt-BR',{month:'short'}).replace('.','')}`; };
export const fullDate = d => parse(d).toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'});
export function urgency(d) {
  const n = daysUntil(d);
  return n < 0 ? ['Encerrado','done'] : n === 0 ? ['Entrega hoje','today'] : n <= 3 ? ['Próximo','soon'] : ['Publicado','ok'];
}
export const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; };
export const iso = x => x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
