// IDs estáveis preservam os vínculos e as publicações existentes no modo demo.
export const SUBJECTS = [
  ['s1', 'Matemática', 'Funções, geometria, estatística e resolução de problemas.', 'Matemática'],
  ['s2', 'Língua Portuguesa', 'Leitura, literatura, produção de texto e gramática.', 'Linguagens'],
  ['s3', 'Física', 'Movimento, energia, ondas e investigação experimental.', 'Ciências da natureza'],
  ['s4', 'Programação', 'Lógica, algoritmos e desenvolvimento de projetos digitais.', 'Tecnologia e projetos'],
  ['s5', 'Educação Física', 'Esportes, práticas corporais, saúde e cooperação.', 'Linguagens'],
  ['s6', 'Língua Inglesa', 'Comunicação, leitura e culturas de língua inglesa.', 'Linguagens'],
  ['s7', 'REC de Língua Portuguesa', 'Retomada de leitura, escrita e conhecimentos linguísticos.', 'Recuperação'],
  ['s8', 'Filosofia', 'Ética, conhecimento e reflexão crítica sobre a sociedade.', 'Ciências humanas'],
  ['s9', 'REC de Matemática', 'Revisão de conceitos e acompanhamento da aprendizagem.', 'Recuperação'],
  ['s10', 'Geografia', 'Territórios, ambiente, população e relações globais.', 'Ciências humanas'],
  ['s11', 'Química', 'Matéria, transformações e química no cotidiano.', 'Ciências da natureza'],
  ['s12', 'REC de Ciências da Natureza', 'Retomada integrada de Física, Química e Biologia.', 'Recuperação'],
  ['s13', 'MindLab', 'Jogos de raciocínio, estratégias e habilidades socioemocionais.', 'Tecnologia e projetos'],
  ['s14', 'Teatro', 'Expressão corporal, interpretação e criação cênica.', 'Linguagens'],
  ['s15', 'História', 'Processos históricos, memória, cultura e cidadania.', 'Ciências humanas'],
  ['s16', 'Biologia', 'Vida, ecologia, genética e diversidade dos seres vivos.', 'Ciências da natureza'],
  ['s17', 'Música', 'Escuta, ritmo, composição e expressão musical.', 'Linguagens'],
  ['s18', 'Sociologia', 'Sociedade, diversidade, direitos e relações sociais.', 'Ciências humanas'],
  ['s19', 'Passaporte', 'Percurso de aprendizagem, experiências e projetos pessoais.', 'Tecnologia e projetos']
].map(([id, name, description, area]) => ({ id, name, description, area }));

export const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export const subjectArea = subject => subject.area || SUBJECTS.find(s => normalize(s.name) === normalize(subject.name))?.area || 'Outras disciplinas';
