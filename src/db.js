import {useEffect,useState} from 'react'
export const dev=localStorage.dev||(localStorage.dev=Math.random().toString(36).slice(2,6))
export const uid=()=>dev+Date.now().toString(36)+Math.random().toString(36).slice(2,6)
export const PFX={Phones:'P',Laptops:'L',Desktops:'D',Modems:'M',Parts:'PT',Accessories:'AC'}
export const code=async p=>{const re=new RegExp('^'+p+'-(\\d+)$');let u=0;for(const x of await everything()){const m=String(x.code||x.tag||'').match(re);if(m)u=Math.max(u,+m[1])}const n=Math.max(+localStorage['no_'+p]||0,u)+1;localStorage['no_'+p]=n;return p+'-'+n}
export const mn=n=>(+n||0).toLocaleString()+' ETB'
export const day=(t=Date.now())=>new Date(t).toISOString().slice(0,10)
export const addD=n=>day(Date.now()+n*864e5)
export const custId=p=>'c'+String(p||'').replace(/\D/g,'')
let _db;const open=()=>_db||(_db=new Promise((ok,no)=>{const r=indexedDB.open('samket',1);r.onupgradeneeded=()=>r.result.createObjectStore('d',{keyPath:'id'});r.onsuccess=()=>ok(r.result);r.onerror=no}))
const tx=async(m,f)=>{const db=await open();return new Promise((ok,no)=>{const t=db.transaction('d',m),r=f(t.objectStore('d'));t.oncomplete=()=>ok(r&&r.result);t.onerror=no})}
export const everything=async()=>(await tx('readonly',s=>s.getAll()))||[]
const put=o=>tx('readwrite',s=>s.put(o)),get=id=>tx('readonly',s=>s.get(id)),rm=id=>tx('readwrite',s=>s.delete(id))
const bus=new EventTarget(),ping=()=>bus.dispatchEvent(new Event('c'))
export const save=async(type,o)=>{o={...o,type,id:o.id||uid(),ts:Date.now(),dev,dirty:1};await put(o);ping();sync();return o}
const P=g=>new Proxy(g,{get:(t,k)=>t[k]||[]})
export function useDB(){const [d,setD]=useState(P({}));const f=async()=>{const g={};for(const x of await everything())if(!x.del)(g[x.type]??=[]).push(x);setD(P(g))}
 useEffect(()=>{f();bus.addEventListener('c',f);return()=>bus.removeEventListener('c',f)},[]);return d}
export function useSync(){const [s,setS]=useState({on:navigator.onLine,p:0,c:0}),f=async()=>{const a=await everything();setS({on:navigator.onLine,p:a.filter(x=>x.dirty).length,c:a.filter(x=>x.type==='conflict').length})}
 useEffect(()=>{f();['online','offline'].forEach(e=>addEventListener(e,f));bus.addEventListener('c',f);return()=>{['online','offline'].forEach(e=>removeEventListener(e,f));bus.removeEventListener('c',f)}},[]);return s}
export const stock=(d,i)=>i.ser?d.unit.filter(u=>u.itemId===i.id&&u.status==='in_stock').length:d.move.filter(m=>m.item===i.id).reduce((a,m)=>a+m.q,0)
export const upCust=async(name,phone)=>{if(!phone)return'';const id=custId(phone);await save('cust',{id,name,phone});return id}
export const notify=async(t,status)=>{const text=`Samket: your ${t.device||'device'} (${t.code}) is now "${status}".`;fetch((localStorage.surl||'')+'/api/notify',{method:'POST',headers:{'content-type':'application/json','x-key':localStorage.skey||'samket'},body:JSON.stringify({code:t.code,text})}).catch(()=>{});return save('notif',{ticket:t.code,to:t.code,channel:'Telegram',text})}
const core=({ts,dev,seq,dirty,...r})=>JSON.stringify(r)
let busy=0
export async function sync(){
 if(busy||!navigator.onLine)return;busy=1
 try{
  const post=async docs=>{const r=await fetch((localStorage.surl||'')+'/api/sync',{method:'POST',headers:{'content-type':'application/json','x-key':localStorage.skey||'samket'},body:JSON.stringify({since:+localStorage.since||0,docs})});if(!r.ok)throw 0;return r.json()}
  const j=await post([])
  for(const x of j.docs){const l=await get(x.id)
   if(l?.dirty&&l.ts!==x.ts&&core(l)!==core(x))await put({id:'c:'+x.id,type:'conflict',doc:x.id,mine:l,theirs:x,ts:Date.now(),dev})
   else if(!l||(!l.dirty&&x.ts>=l.ts)||core(l)===core(x))await put(x)}
  const a=await everything(),cs=new Set(a.filter(x=>x.type==='conflict').map(x=>x.doc)),d=a.filter(x=>x.dirty&&!cs.has(x.id))
  await post(d.map(({dirty,...x})=>x))
  for(const x of d){const l=await get(x.id);if(l?.dirty&&l.ts===x.ts)await put({...l,dirty:0})}
  localStorage.since=j.seq
 }catch{}
 busy=0;ping()}
export async function resolve(c,pick){await put(pick==='mine'?{...c.mine,ts:Date.now(),dirty:1}:{...c.theirs,dirty:0});await rm(c.id);ping();sync()}
addEventListener('online',sync);setInterval(sync,20000);setTimeout(sync,500)
