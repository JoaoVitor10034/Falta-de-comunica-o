/* Dados DEMO fictícios (sem informações reais de estudantes). */
(function(){const S=window.SESI={};
const day=n=>{const d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};S.day=day;
S.users=[
{id:'u1',nome:'João Silva',role:'aluno',email:'aluno@demo.sesi',senha:'demo123'},
{id:'u2',nome:'Profa. Marta Lima',role:'professor',email:'professor@demo.sesi',senha:'demo123',subs:['mat','fis','qui']},
{id:'u3',nome:'Carla (Monitora)',role:'monitor',email:'monitor@demo.sesi',senha:'demo123',subs:['mat']},
{id:'u4',nome:'Direção SESI',role:'admin',email:'admin@demo.sesi',senha:'demo123'},
{id:'u5',nome:'Prof. Rafael Souza',role:'professor',email:'prof2@demo.sesi',senha:'demo123',subs:['por','prog','ing','his','geo']}];
S.subjects=[['mat','Matemática','u2'],['por','Língua Portuguesa','u5'],['fis','Física','u2'],['prog','Programação','u5'],['ing','Inglês','u5'],['his','História','u5'],['qui','Química','u2'],['geo','Geografia','u5']].map(([id,nome,prof])=>({id,nome,prof}));
S.seed=[
{id:'p1',tipo:'aviso',titulo:'Mudança de sala: Matemática',desc:'A aula de hoje será na Sala 12 (antes: Sala 8).',sub:'mat',area:'disc',data:day(0),hora:'08:00',sala:'Sala 12',pri:'Urgente',autor:'u2',status:'Publicado'},
{id:'p2',tipo:'atividade',titulo:'Lista de exercícios: funções',desc:'Resolver os exercícios 1 a 15 do caderno.',sub:'mat',area:'disc',data:day(-2),prazo:day(1),pri:'Importante',autor:'u2',status:'Publicado'},
{id:'p3',tipo:'atividade',titulo:'Projeto: site pessoal',desc:'Entregar o repositório com HTML e CSS.',sub:'prog',area:'disc',data:day(-5),prazo:day(0),pri:'Importante',autor:'u5',status:'Publicado'},
{id:'p4',tipo:'prova',titulo:'Prova de Física: cinemática',desc:'Conteúdo: MRU e MRUV. Trazer calculadora.',sub:'fis',area:'disc',data:day(4),hora:'10:30',sala:'Sala 5',pri:'Importante',autor:'u2',status:'Publicado'},
{id:'p5',tipo:'material',titulo:'Slides: Revolução Industrial',desc:'Apresentação da aula.',sub:'his',area:'disc',data:day(-1),fmt:'Slides',pri:'Normal',autor:'u5',status:'Publicado'},
{id:'p6',tipo:'material',titulo:'PDF: Tabela periódica',desc:'Material de apoio.',sub:'qui',area:'disc',data:day(-3),fmt:'PDF',pri:'Normal',autor:'u2',status:'Publicado'},
{id:'p7',tipo:'material',titulo:'Vídeo: Present Perfect',desc:'Videoaula complementar.',sub:'ing',area:'disc',data:day(-4),fmt:'Vídeos',pri:'Normal',autor:'u5',status:'Publicado'},
{id:'p8',tipo:'aviso',titulo:'Reunião de pais (demonstrativo)',desc:'Comunicado da direção sobre o calendário do trimestre.',sub:null,area:'direcao',data:day(0),hora:'09:00',pri:'Normal',autor:'u4',status:'Publicado'},
{id:'p9',tipo:'evento',titulo:'Feira de Ciências',desc:'Apresentação dos projetos das turmas.',sub:null,area:'evento',data:day(3),hora:'14:00',sala:'Ginásio',pri:'Importante',autor:'u4',status:'Publicado'},
{id:'p10',tipo:'evento',titulo:'Passaporte: encontro de projetos',desc:'Encontro para apresentar andamento dos projetos.',sub:null,area:'passaporte',data:day(2),hora:'15:00',sala:'Laboratório 2',pri:'Normal',autor:'u4',status:'Publicado'},
{id:'p11',tipo:'formulario',titulo:'Passaporte: inscrição em oficinas',desc:'Escolha sua oficina até o prazo.',sub:null,area:'passaporte',data:day(-1),prazo:day(5),pri:'Normal',autor:'u4',status:'Publicado'},
{id:'p12',tipo:'aviso',titulo:'Entrega de Português adiada',desc:'A redação foi adiada.',sub:'por',area:'disc',data:day(0),hora:'07:30',prazo:day(3),pri:'Importante',autor:'u5',status:'Publicado'}];
S.seedHist=[{ts:Date.now()-36e5*3,postId:'p1',txt:'Sala alterada: Sala 8 → Sala 12',autor:'u2'},{ts:Date.now()-36e5*2,postId:'p12',txt:'Prazo alterado: '+day(1)+' → '+day(3),autor:'u5'}];
})();
