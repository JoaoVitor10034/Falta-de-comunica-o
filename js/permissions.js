// Regras de UI apenas. A segurança real está no RLS (supabase/schema.sql).
const admin = p => p.role === 'system_admin';
export const canPublishSubject = (p, subjectId, links) => admin(p) || p.role === 'student_admin' || (p.role === 'teacher' && links.some(l => l.teacher_id === p.id && l.subject_id === subjectId));
export const allowedSubjects = (p, subjects, links) => subjects.filter(s => canPublishSubject(p, s.id, links));
export const canPublishGeneral = admin;
export const isEmergency = (p, subjectId, links) => p.role === 'student_admin' && !links.some(l => l.teacher_id === p.id && l.subject_id === subjectId);
export const roleLabel = r => ({ student: 'Aluno', teacher: 'Professor', student_admin: 'Aluno administrador', system_admin: 'Administrador do sistema' }[r]);
