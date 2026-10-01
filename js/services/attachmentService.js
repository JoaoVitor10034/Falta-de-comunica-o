import { sb, isDemo } from '../supabase.js';
const types = new Set(['application/pdf','image/jpeg','image/png','image/webp','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.presentationml.presentation']);
export async function uploadAttachment(file, user) {
  if (!types.has(file.type)) throw new Error('Use PDF, JPG, PNG, WebP, TXT, DOCX ou PPTX.');
  if (file.size > (isDemo ? 2 : 5) * 1024 * 1024) throw new Error(`O limite por arquivo é ${isDemo ? 2 : 5} MB.`);
  if (user.role === 'student') throw new Error('Sem permissão para anexar arquivos.');
  const attachment = { name:file.name, mime:file.type, size:file.size };
  if (isDemo) {
    attachment.data = await new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
  } else {
    const path = `${user.id}/${crypto.randomUUID()}/${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
    const { error } = await sb.storage.from('school-attachments').upload(path,file,{contentType:file.type}); if (error) throw error; attachment.path = path;
  }
  return attachment;
}
export async function openAttachment(attachment) {
  let url;
  if (isDemo && attachment.data) {
    if (!types.has(attachment.mime)) throw new Error('Tipo de arquivo inválido.');
    const bytes = Uint8Array.from(atob(attachment.data.split(',')[1]), c => c.charCodeAt(0));
    url = URL.createObjectURL(new Blob([bytes],{type:attachment.mime}));
  } else {
    const { data,error } = await sb.storage.from('school-attachments').createSignedUrl(attachment.path,60); if(error) throw error; url=data.signedUrl;
  }
  const a=document.createElement('a'); a.href=url; a.download=attachment.name; a.rel='noopener'; a.target='_blank'; a.click();
  if(url.startsWith('blob:')) setTimeout(()=>URL.revokeObjectURL(url),60000);
}
