import { SUBJECTS } from './subjects.js';

const teachers = [
  ['Carlos', 'prof'], ['Mariana', 'prof.portugues'], ['Rafael', 'prof.fisica'],
  ['Lucas', 'prof.programacao'], ['Camila', 'prof.edfisica'], ['Julia', 'prof.ingles'],
  ['Beatriz', 'prof.recportugues'], ['Andre', 'prof.filosofia'], ['Renata', 'prof.recmatematica'],
  ['Fernanda', 'prof.geografia'], ['Bruno', 'prof.quimica'], ['Patricia', 'prof.recnatureza'],
  ['Diego', 'prof.mindlab'], ['Helena', 'prof.teatro'], ['Gabriel', 'prof.historia'],
  ['Isabela', 'prof.biologia'], ['Eduardo', 'prof.musica'], ['Leticia', 'prof.sociologia'],
  ['Thiago', 'prof.passaporte']
];
export const DEMO_TEACHERS = teachers.map(([name, email], index) => ({
  id: index === 0 ? 'u2' : `teacher-${index + 1}`, full_name: `Prof. ${name}`,
  email: `${email}@demo`, role: 'teacher', subject_name: SUBJECTS[index].name
}));
export const DEMO_PROFILES = [
  { id: 'u1', full_name: 'Ana Aluna', email: 'aluno@demo', role: 'student', turma: '2A' },
  { id: 'u5', full_name: 'Davi Aluno', email: 'aluno2@demo', role: 'student', turma: '2B' },
  ...['Sofia', 'Pedro', 'Laura', 'Miguel'].map((name, index) => ({ id: `student-${index + 3}`, full_name: `${name} Aluno`, email: `aluno${index + 3}@demo`, role: 'student', turma: index % 2 ? '2B' : '2A' })),
  ...DEMO_TEACHERS,
  { id: 'u3', full_name: 'Bia Monitora', email: 'monitor@demo', role: 'student_admin', turma: '2A' },
  ...['João', 'Clara', 'Felipe'].map((name, index) => ({ id: `monitor-${index + 2}`, full_name: `${name} Monitor`, email: `monitor${index + 2}@demo`, role: 'student_admin', turma: index % 2 ? '2A' : '2B' })),
  { id: 'u4', full_name: 'Admin SESI', email: 'admin@demo', role: 'system_admin' }
];
