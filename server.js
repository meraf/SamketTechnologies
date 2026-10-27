// Samket sync server: node server.js  (no dependencies)
const http=require('http'),fs=require('fs'),path=require('path');
const P=process.env.PORT||3000,KEY=process.env.SYNC_KEY||'samket',F=path.join(__dirname,'data.json'),W=path.join(__dirname,'public');
let S={seq:0,docs:{}};try{S=JSON.parse(fs.readFileSync(F))}catch{}
const save=()=>fs.writeFileSync(F,JSON.stringify(S));
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'};
const J=(r,c,o)=>{r.writeHead(c,{'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-headers':'*'});r.end(JSON.stringify(o))};
const docs=t=>Object.values(S.docs).filter(d=>d.type===t&&!d.del);
const stock=id=>docs('move').filter(m=>m.item===id).reduce((a,m)=>a+m.q,0);
const body=(q,f)=>{let b='';q.on('data',c=>b+=c).on('end',()=>{try{f(JSON.parse(b||'{}'))}catch{f({})}})};
http.createServer((q,r)=>{
 const u=new URL(q.url,'http://x');
 if(q.method==='OPTIONS')return J(r,200,{});
 if(u.pathname==='/api/sync'&&q.method==='POST'){
  if(q.headers['x-key']!==KEY)return J(r,401,{});
  return body(q,({since=0,docs:ds=[]})=>{
   for(const d of ds){const e=S.docs[d.id];if(!e||d.ts>e.ts||(d.ts===e.ts&&d.dev>e.dev))S.docs[d.id]={...d,seq:++S.seq}}
   save();J(r,200,{seq:S.seq,docs:Object.values(S.docs).filter(d=>d.seq>since)})})}
 if(u.pathname==='/api/pub')return J(r,200,docs('item').filter(i=>i.pub).map(i=>({id:i.id,name:i.name,cat:i.cat,price:i.price,war:i.war,stock:stock(i.id)})));
 if(u.pathname==='/api/track'){const t=docs('ticket').find(x=>x.code===(u.searchParams.get('c')||'').toUpperCase());return t?J(r,200,{code:t.code,device:t.device,status:t.status,work:t.work,war:t.war,done:t.done}):J(r,404,{})}
 if(u.pathname==='/api/req'&&q.method==='POST')return body(q,x=>{const id='w'+Date.now().toString(36),code='SK-WEB-'+Math.random().toString(36).slice(2,6).toUpperCase(),s=(v,n)=>String(v||'').slice(0,n);
  S.docs[id]={id,type:'ticket',code,name:s(x.name,80),phone:s(x.phone,30),device:s(x.device,80),issue:s(x.issue,300),status:'Received',war:30,cost:0,date:Date.now(),ts:Date.now(),dev:'web',seq:++S.seq};save();J(r,200,{code})});
 let p=path.normalize(u.pathname==='/'?'/index.html':u.pathname),f=path.join(W,p);
 if(!f.startsWith(W)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end('Not found')}
 r.writeHead(200,{'content-type':T[path.extname(f)]||'text/plain'});fs.createReadStream(f).pipe(r)
}).listen(P,()=>console.log('Samket running on http://localhost:'+P));
