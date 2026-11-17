// Brasil Play Fortal RPG — servidor (Node.js puro, sem dependências). Rode: node server.js
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
for(const f of ['.env.local','.env']){try{for(const l of fs.readFileSync(path.join(__dirname,f),'utf8').split(/\r?\n/)){const m=l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);if(m&&!(m[1] in process.env))process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')}}catch(e){}}
const PORT=process.env.PORT||3000,PUB=path.join(__dirname,'public'),DATA=path.join(__dirname,'data'),DBF=path.join(DATA,'db.json');
fs.mkdirSync(DATA,{recursive:true});fs.mkdirSync(path.join(PUB,'uploads'),{recursive:true});
const hash=(p,s=crypto.randomBytes(16).toString('hex'))=>s+':'+crypto.scryptSync(p,s,32).toString('hex');
const chk=(p,h)=>{const a=Buffer.from(hash(p,h.split(':')[0])),b=Buffer.from(h);return a.length===b.length&&crypto.timingSafeEqual(a,b)};
const dt=()=>new Date().toLocaleDateString('pt-BR'),str=(v,n)=>String(v==null?'':v).trim().slice(0,n);
let pool=null;if(process.env.DATABASE_URL){const{Pool}=require('pg');pool=new Pool({connectionString:process.env.DATABASE_URL,max:3})}
let busy=0,again=0;
async function persist(){if(!pool){const t=DBF+'.tmp';fs.writeFileSync(t,JSON.stringify(db,null,1));fs.renameSync(t,DBF);return}
 if(busy){again=1;return}busy=1;try{do{again=0;await pool.query('INSERT INTO app_state(id,data) VALUES(1,$1) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data',[JSON.stringify(db)])}while(again)}catch(e){console.error('Erro ao salvar no banco:',e.message)}busy=0}
const save=()=>{persist()};
let db;
const defaults=()=>({users:[{u:'admin',e:'',p:hash('admin123'),role:'admin',coins:0,vip:'',chars:[],buys:[],ban:0}],sessions:{},reports:[],music:[],
events:[{id:1,t:'Corrida Clandestina — Orla',d:'2026-11-22',h:'20:00',x:'Premiação de 500 moedas para o 1º lugar. Veículo livre.'},{id:2,t:'Assalto ao Banco Central',d:'2026-11-29',h:'21:00',x:'Evento oficial das facções. Inscrição pelo Discord.'}],
msgs:[{u:'Sistema',r:'admin',x:'Bem-vindo ao chat global! Respeite as regras.'}],
news:[{t:'Atualização 4.2: nova economia',x:'Novos empregos, ajuste de preços e sistema de concessionárias revisado.'},{t:'Whitelist aberta',x:'Crie sua conta, monte seu personagem e faça o teste de roleplay.'}]});
async function init(){
 if(pool){await pool.query('CREATE TABLE IF NOT EXISTS app_state(id int PRIMARY KEY,data jsonb NOT NULL)');const r=await pool.query('SELECT data FROM app_state WHERE id=1');db=r.rows[0]&&r.rows[0].data;console.log('Banco: Neon/Postgres')}
 else{try{db=JSON.parse(fs.readFileSync(DBF,'utf8'))}catch(e){}console.log('Banco: arquivo data/db.json (defina DATABASE_URL para usar Postgres)')}
 if(!db){db=defaults();await persist();console.log('Primeiro acesso: login admin / senha admin123 — TROQUE A SENHA no painel!')}}

const pub=u=>({u:u.u,role:u.role,coins:u.coins,vip:u.vip,chars:u.chars,buys:u.buys});
function state(u){const s={me:u?pub(u):null,events:db.events,news:db.news,music:db.music,msgs:db.msgs.slice(-80),count:db.users.length};
if(u)s.reports=u.role==='admin'?db.reports:db.reports.filter(r=>r.by===u.u);
if(u&&u.role==='admin'){s.users=db.users.map(x=>({u:x.u,role:x.role,coins:x.coins,ban:x.ban,vip:x.vip}));s.sales=db.users.reduce((n,x)=>n+x.buys.length,0);s.vips=db.users.filter(x=>x.vip).length}return s}
const find=n=>db.users.find(x=>x.u.toLowerCase()===String(n).toLowerCase());
const A={
buyC(u,b){const P={100:5,300:12,700:25,1500:45},n=+b.n;if(!P[n])return'Pacote inválido.';u.coins+=n;u.buys.push({d:dt(),i:n+' moedas',v:'R$ '+P[n]+',00'})},
buyV(u,b){const c={Bronze:300,Prata:700,Ouro:1200}[b.n];if(!c)return'VIP inválido.';if(u.coins<c)return'Moedas insuficientes. Compre mais moedas.';u.coins-=c;u.vip=b.n;u.buys.push({d:dt(),i:'VIP '+b.n+' (30 dias)',v:c+' moedas'})},
say(u,b){const x=str(b.x,200);if(!x)return'Mensagem vazia.';db.msgs.push({u:u.u,r:u.role,v:u.vip,x});db.msgs=db.msgs.slice(-200)},
rep(u,b){const r={id:db.reports.length+1,by:u.u,tp:str(b.tp,30),al:str(b.al,30),dh:str(b.dh,40),ds:str(b.ds,1000),pf:str(b.pf,300),st:'Aberta'};if(!r.al||!r.ds||!r.pf)return'Preencha todos os campos.';db.reports.push(r)},
ch(u,b){const n=str(b.n,30);if(!/^[A-Z][a-z]+_[A-Z][a-z]+$/.test(n))return'Use o formato Nome_Sobrenome.';if(u.chars.length>=3)return'Limite de 3 personagens.';if(db.users.some(x=>x.chars.some(c=>c.n===n)))return'Esse nome já está em uso.';u.chars.push({n,s:b.s==='Feminino'?'Feminino':'Masculino',d:dt()})},
pw(u,b){if(!chk(str(b.a,100),u.p))return'Senha atual incorreta.';const n=str(b.n,100);if(n.length<6)return'A nova senha precisa de 6 caracteres ou mais.';u.p=hash(n)},
rs(u,b){const r=db.reports.find(x=>x.id==b.id);if(!r||!['Aberta','Em análise','Resolvida','Rejeitada'].includes(b.st))return'Inválido.';r.st=b.st},
gv(u,b){const t=find(b.u);if(!t)return'Jogador não encontrado.';t.coins+=100},
bn(u,b){const t=find(b.u);if(!t||t.role==='admin')return'Não permitido.';t.ban=t.ban?0:1;if(t.ban)for(const k in db.sessions)if(db.sessions[k]===t.u)delete db.sessions[k]},
mk(u,b){const t=find(b.u);if(!t)return'Jogador não encontrado.';t.role='admin'},
ev(u,b){const e={id:Date.now(),t:str(b.t,80),d:str(b.d,10),h:str(b.h,5),x:str(b.x,400)};if(!e.t||!e.d)return'Preencha título e data.';db.events.push(e)},
evDel(u,b){db.events=db.events.filter(e=>e.id!=b.id)},
nw(u,b){const t=str(b.t,80),x=str(b.x,500);if(!t||!x)return'Preencha tudo.';db.news.unshift({t,x});db.news=db.news.slice(0,20)},
muAdd(u,b){const t=str(b.t,80),url=str(b.url,400);if(!t||!/^(https?:\/\/|\/uploads\/)/.test(url))return'Informe o título e um link http(s) ou envie um arquivo.';db.music.push({id:Date.now(),t,url})},
muDel(u,b){db.music=db.music.filter(m=>m.id!=b.id)}};
const ADM=['rs','gv','bn','mk','ev','evDel','nw','muAdd','muDel'];
const json=(res,c,o,h={})=>{res.writeHead(c,{'Content-Type':'application/json',...h});res.end(JSON.stringify(o))};
const raw=(req,max)=>new Promise((ok,no)=>{const c=[];let n=0;req.on('data',d=>{n+=d.length;if(n>max){no(new Error('big'));req.destroy()}else c.push(d)});req.on('end',()=>ok(Buffer.concat(c)));req.on('error',no)});
const sid=req=>((req.headers.cookie||'').match(/sid=([a-f0-9]+)/)||[])[1];
const auth=req=>{const n=db.sessions[sid(req)],u=n&&find(n);return u&&!u.ban?u:null};
const ck=t=>({'Set-Cookie':`sid=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${t?2592000:0}`});
function login(res,u){const t=crypto.randomBytes(24).toString('hex');db.sessions[t]=u.u;save();json(res,200,{ok:1},ck(t))}
const fails={},MT={'.html':'text/html;charset=utf-8','.js':'text/javascript','.css':'text/css','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav','.m4a':'audio/mp4','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
const srv=http.createServer(async(req,res)=>{try{
const url=req.url.split('?')[0],u=auth(req),ip=req.socket.remoteAddress;
if(req.method==='GET'&&url==='/api/state')return json(res,200,state(u));
if(req.method==='POST'&&url==='/api/upload'){if(!u||u.role!=='admin')return json(res,403,{err:'Apenas administradores.'});if(pool)return json(res,400,{err:'Nesta hospedagem o envio de arquivo não guarda a música. Use um link direto de áudio.'});
 const nm=decodeURIComponent(req.headers['x-filename']||'').replace(/[^\w.-]/g,'_'),ext=path.extname(nm).toLowerCase();
 if(!['.mp3','.ogg','.wav','.m4a'].includes(ext))return json(res,400,{err:'Envie mp3, ogg, wav ou m4a.'});
 const f=Date.now()+'_'+nm;fs.writeFileSync(path.join(PUB,'uploads',f),await raw(req,25e6));return json(res,200,{url:'/uploads/'+f})}
if(req.method==='POST'&&url.startsWith('/api/')){let b={};try{b=JSON.parse((await raw(req,1e5)).toString()||'{}')}catch(e){return json(res,400,{err:'Pedido inválido.'})}
 if(url==='/api/login'){const f=fails[ip]||{n:0,t:Date.now()};if(f.n>=8&&Date.now()-f.t<6e5)return json(res,429,{err:'Muitas tentativas. Aguarde 10 minutos.'});
  const t=find(str(b.u,20));if(!t||!chk(str(b.p,100),t.p)){fails[ip]={n:f.n+1,t:Date.now()};return json(res,401,{err:'Usuário ou senha incorretos.'})}
  if(t.ban)return json(res,403,{err:'Esta conta está banida.'});delete fails[ip];return login(res,t)}
 if(url==='/api/register'){const n=str(b.u,20),p=str(b.p,100),e=str(b.e,80);
  if(!/^\w{3,20}$/.test(n))return json(res,400,{err:'Usuário: 3 a 20 letras, números ou _.'});if(!/^\S+@\S+\.\S+$/.test(e))return json(res,400,{err:'E-mail inválido.'});
  if(p.length<6)return json(res,400,{err:'A senha precisa de 6 caracteres ou mais.'});if(find(n))return json(res,400,{err:'Este usuário já existe.'});
  const t={u:n,e,p:hash(p),role:'player',coins:50,vip:'',chars:[],buys:[],ban:0};db.users.push(t);return login(res,t)}
 if(url==='/api/logout'){delete db.sessions[sid(req)];save();return json(res,200,{ok:1},ck(''))}
 if(url==='/api/act'){if(!u)return json(res,401,{err:'Entre na sua conta primeiro.'});const f=A[b.t];if(!f||(ADM.includes(b.t)&&u.role!=='admin'))return json(res,403,{err:'Ação não permitida.'});
  const e=f(u,b);if(e)return json(res,400,{err:e});save();return json(res,200,{ok:1})}
 return json(res,404,{err:'Não encontrado.'})}
let p=path.normalize(path.join(PUB,url==='/'?'index.html':url));
if(!p.startsWith(PUB)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){res.writeHead(404);return res.end('404')}
const ext=path.extname(p).toLowerCase(),st=fs.statSync(p),rg=/bytes=(\d+)-(\d*)/.exec(req.headers.range||'');
if(rg&&ext!=='.html'){const a=+rg[1],z=rg[2]?+rg[2]:st.size-1;res.writeHead(206,{'Content-Type':MT[ext]||'application/octet-stream','Content-Range':`bytes ${a}-${z}/${st.size}`,'Accept-Ranges':'bytes','Content-Length':z-a+1});return fs.createReadStream(p,{start:a,end:z}).pipe(res)}
res.writeHead(200,{'Content-Type':MT[ext]||'application/octet-stream','Accept-Ranges':'bytes'});fs.createReadStream(p).pipe(res)
}catch(e){try{json(res,500,{err:'Erro interno.'})}catch(x){}}});
init().then(()=>srv.listen(PORT,()=>console.log('Site no ar: http://localhost:'+PORT))).catch(e=>{console.error('Falha ao iniciar:',e.message);process.exit(1)});
