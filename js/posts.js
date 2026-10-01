/* Publicações, histórico, notificações, leitura e busca. */
(function(S){
S.posts=()=>S.get('posts',null)||(S.set('posts',S.seed),S.seed.slice());
S.hist=()=>S.get('hist',null)||(S.set('hist',S.seedHist),S.seedHist.slice());
S.notifs=()=>S.get('notifs',null)||S.hist().map(h=>({id:'n'+h.postId,txt:h.txt,ts:h.ts,read:false}));
S.visible=(p,u)=>p.status!=='Aguardando aprovação'||u.role==='admin'||p.autor===u.id||S.canManage(u,p.sub);
S.visiblePosts=u=>S.posts().filter(p=>S.visible(p,u));
S.subName=id=>(S.subjects.find(s=>s.id===id)||{}).nome||'Institucional';
S.userName=id=>(S.users.find(u=>u.id===id)||{}).nome||'—';
const log=(p,txt,u)=>{const h=S.hist();h.unshift({ts:Date.now(),postId:p.id,txt:p.titulo+': '+txt,autor:u.id});S.set('hist',h);const n=S.notifs();n.unshift({id:'n'+Date.now(),txt:p.titulo+': '+txt,ts:Date.now(),read:false});S.set('notifs',n)};
S.publish=(u,d)=>{
 const t=String(d.titulo||'').trim(),ds=String(d.desc||'').trim();
 if(t.length<3||t.length>90)return{err:'O título deve ter entre 3 e 90 caracteres.'};
 if(ds.length<3||ds.length>600)return{err:'A descrição deve ter entre 3 e 600 caracteres.'};
 if(d.area==='disc'&&!d.sub)return{err:'Escolha a disciplina.'};
 if(!S.canPublish(u,d.area,d.sub))return{err:'Você não tem permissão para publicar nesta área.'};
 if(d.pri==='Urgente'&&!S.canUrgent(u))return{err:'Apenas professores e a direção podem marcar como urgente.'};
 if(d.data&&isNaN(new Date(d.data)))return{err:'Data inválida.'};
 const p={id:'p'+Date.now(),tipo:d.tipo,titulo:t,desc:ds,sub:d.area==='disc'?d.sub:null,area:d.area,data:d.data||S.day(0),prazo:d.prazo||'',hora:d.hora||'',sala:String(d.sala||'').slice(0,40),pri:d.pri||'Normal',autor:u.id,status:u.role==='monitor'?'Aguardando aprovação':'Publicado'};
 if(d.tipo==='material')p.fmt=d.fmt||'Links';
 const a=S.posts();a.unshift(p);S.set('posts',a);log(p,u.role==='monitor'?'enviada para aprovação (por '+u.nome+')':'nova publicação por '+u.nome,u);return{post:p};};
S.approve=(u,id)=>{const a=S.posts(),p=a.find(x=>x.id===id);if(!p||!(u.role==='admin'||(u.role==='professor'&&S.canManage(u,p.sub))))return false;p.status='Publicado';S.set('posts',a);log(p,'aprovada por '+u.nome,u);return true};
S.changeDeadline=(u,id,novo)=>{const a=S.posts(),p=a.find(x=>x.id===id);if(!p||!S.canManage(u,p.sub)||u.role==='monitor')return false;const old=p.prazo;p.prazo=novo;S.set('posts',a);log(p,`prazo alterado: ${old||'—'} → ${novo}`,u);return true};
S.state=u=>S.get('st_'+u.id,{read:{},saved:{}});
S.toggle=(u,kind,id)=>{const s=S.state(u);s[kind][id]=!s[kind][id];S.set('st_'+u.id,s)};
S.markAllRead=()=>{S.set('notifs',S.notifs().map(n=>({...n,read:true})))};
S.search=(u,q)=>{q=q.trim().toLowerCase();if(q.length<2)return null;const nz=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();q=nz(q);const m=s=>nz(s).includes(q),vp=S.visiblePosts(u),pm=p=>m(p.titulo)||m(p.desc);
 return{Disciplinas:S.subjects.filter(s=>m(s.nome)).map(s=>({t:s.nome,h:'#/disciplina/'+s.id})),
 Professores:S.users.filter(x=>x.role==='professor'&&m(x.nome)).map(x=>({t:x.nome,h:'#/disciplinas'})),
 Atividades:vp.filter(p=>p.tipo==='atividade'&&pm(p)).map(p=>({t:p.titulo,h:'#/disciplina/'+p.sub+'/atividades'})),
 Materiais:vp.filter(p=>p.tipo==='material'&&pm(p)).map(p=>({t:p.titulo,h:'#/disciplina/'+p.sub+'/materiais'})),
 Avisos:vp.filter(p=>p.tipo==='aviso'&&pm(p)).map(p=>({t:p.titulo,h:'#/avisos'})),
 Eventos:vp.filter(p=>p.area==='evento'&&pm(p)).map(p=>({t:p.titulo,h:'#/eventos'})),
 Passaporte:vp.filter(p=>p.area==='passaporte'&&pm(p)).map(p=>({t:p.titulo,h:'#/passaporte'}))}};
S.resetDemo=()=>{['posts','hist','notifs'].forEach(k=>{try{localStorage.removeItem('sesi_'+k)}catch(e){}});S.users.forEach(u=>{try{localStorage.removeItem('sesi_st_'+u.id)}catch(e){}})};
})(window.SESI);
