import {useEffect,useState} from 'react'
import {idb,bus,ping,flushOutbox,queue,pendingCount,setMeta} from './offline'
import {normPhone} from '../lib/phone.js'
export {normPhone}

export const dev=localStorage.dev||(localStorage.dev=Math.random().toString(36).slice(2,6))
export const uid=()=>dev+Date.now().toString(36)+Math.random().toString(36).slice(2,6)
export const PFX={Phones:'P',Laptops:'L',Desktops:'D',Modems:'M',Parts:'PT',Accessories:'AC'}
export const mn=n=>(+n||0).toLocaleString()+' ETB'
export const day=(t=Date.now())=>new Date(t).toISOString().slice(0,10)
export const addD=n=>day(Date.now()+n*864e5)
// one customer per normalised phone: 0924598198 = +251924598198 = 251924598198
export const custId=p=>'c'+normPhone(p)

// ---- settings (mirrored into IndexedDB so the service worker can use them) ----
export const setCfg=(k,v)=>{localStorage[k]=v;if(k==='surl'||k==='skey')setMeta(k,v)}
setMeta('surl',localStorage.surl||'');setMeta('skey',localStorage.skey||'samket')
const base=()=>localStorage.surl||''
const hdr=()=>({'content-type':'application/json','x-key':localStorage.skey||'samket'})
// Only a signed-in staff session syncs the shared database. Public visitors never download or upload records.
const staffOn=()=>!!sessionStorage.u

// ---- local record store (IndexedDB) ----
export const everything=async()=>(await (await idb()).getAll('d'))||[]
const put=async o=>(await idb()).put('d',o),get=async id=>(await idb()).get('d',id),rm=async id=>(await idb()).delete('d',id)

export const code=async p=>{const re=new RegExp('^'+p+'-(\\d+)$');let u=0;for(const x of await everything()){const m=String(x.code||x.tag||'').match(re);if(m)u=Math.max(u,+m[1])}const n=Math.max(+localStorage['no_'+p]||0,u)+1;localStorage['no_'+p]=n;return p+'-'+n}

export const save=async(type,o)=>{o={...o,type,id:o.id||uid(),ts:Date.now(),dev,dirty:1};await put(o);ping();sync();return o}

/** Edit an existing record: PATCH /api/docs/:id when online, otherwise saved locally and synced later. */
export async function update(type,id,patch){
 const l=await get(id);if(!l)throw new Error('Record not found: '+id)
 const ts=Date.now(),o={...l,...patch,type,id,ts,dev,dirty:1};await put(o);ping()
 if(!l.dirty&&navigator.onLine&&staffOn()){ // nothing unsynced on this record, so a partial update is safe
  try{const r=await fetch(base()+'/api/docs/'+encodeURIComponent(id),{method:'PATCH',headers:hdr(),body:JSON.stringify({patch,base:l.ts,ts,dev})})
   if(r.ok){const j=await r.json(),cur=await get(id);if(cur&&cur.ts===ts)await put({...j.doc,dirty:0});ping();return o}
  }catch{} // offline or 409 conflict: the dirty record goes through the normal sync (and conflict review)
 }
 sync();return o}

const P=g=>new Proxy(g,{get:(t,k)=>t[k]||[]})
export function useDB(){const [d,setD]=useState(P({}));const f=async()=>{const g={};for(const x of await everything())if(!x.del)(g[x.type]??=[]).push(x);setD(P(g))}
 useEffect(()=>{f();bus.addEventListener('c',f);return()=>bus.removeEventListener('c',f)},[]);return d}
export function useSync(){const [s,setS]=useState({on:navigator.onLine,p:0,c:0,o:0,e:''}),f=async()=>{const a=await everything();setS({on:navigator.onLine,p:a.filter(x=>x.dirty).length,c:a.filter(x=>x.type==='conflict').length,o:await pendingCount(),e:localStorage.syncErr||''})}
 useEffect(()=>{f();['online','offline'].forEach(e=>addEventListener(e,f));bus.addEventListener('c',f);return()=>{['online','offline'].forEach(e=>removeEventListener(e,f));bus.removeEventListener('c',f)}},[]);return s}
export const stock=(d,i)=>i.ser?d.unit.filter(u=>u.itemId===i.id&&u.status==='in_stock').length:d.move.filter(m=>m.item===i.id).reduce((a,m)=>a+m.q,0)
export const upCust=async(name,phone)=>{const p=normPhone(phone);if(!p)return'';const ex=(await everything()).find(x=>x.type==='cust'&&!x.del&&normPhone(x.phone)===p);const id=ex?ex.id:custId(p);await save('cust',{...(ex||{}),id,name:name||ex?.name||'',phone:ex?ex.phone:p});return id}
export const alertStaff=text=>queue({url:'/api/staff-alert',method:'POST',auth:'key',body:{text}}) // Telegram message to the staff chat (queued if offline)
export const notify=async(t,status)=>{const text=status==='Unfixed'?`Samket: we could not repair your ${t.device||'device'} (${t.code}). Please collect it from the shop.`:`Samket: your ${t.device||'device'} (${t.code}) is now "${status}".`
 await queue({url:'/api/notify',method:'POST',auth:'key',body:{code:t.code,text}}) // queued if offline, sent when the connection returns
 return save('notif',{ticket:t.code,to:t.code,channel:'Telegram',text})}

const core=({ts,dev,seq,dirty,...r})=>JSON.stringify(r)
let busy=0
export async function sync(){
 if(!navigator.onLine)return
 await flushOutbox().catch(()=>0) // queued calls (e.g. a customer's offline repair request) go out for everyone
 if(busy||!staffOn())return;busy=1 // record sync is staff-only
 try{
  const post=async(docs,since)=>{const r=await fetch(base()+'/api/sync',{method:'POST',headers:hdr(),body:JSON.stringify({since,docs})});if(!r.ok)throw{status:r.status};return r.json()}
  // pull in pages (the server caps each response)
  let since=+localStorage.since||0
  for(;;){
   const j=await post([],since)
   for(const x of j.docs){const l=await get(x.id)
    if(l?.dirty&&l.ts!==x.ts&&core(l)!==core(x))await put({id:'c:'+x.id,type:'conflict',doc:x.id,mine:l,theirs:x,ts:Date.now(),dev})
    else if(!l||(!l.dirty&&x.ts>=l.ts)||core(l)===core(x))await put(x)}
   since=j.seq;localStorage.since=since
   if(!j.more)break}
  // push local changes in batches under the host's request-size limit
  const a=await everything(),cs=new Set(a.filter(x=>x.type==='conflict').map(x=>x.doc)),d=a.filter(x=>x.dirty&&!cs.has(x.id))
  for(let i=0;i<d.length;){let k=i,sz=0;while(k<d.length&&(k===i||sz+JSON.stringify(d[k]).length<2.5e6)){sz+=JSON.stringify(d[k]).length;k++}
   await post(d.slice(i,k).map(({dirty,...x})=>x),9e15);i=k}
  for(const x of d){const l=await get(x.id);if(l?.dirty&&l.ts===x.ts)await put({...l,dirty:0})}
 localStorage.removeItem('syncErr')
 }catch(e){localStorage.syncErr=e&&e.status?String(e.status):'net'}
 busy=0;ping()}
export async function resolve(c,pick){await put(pick==='mine'?{...c.mine,ts:Date.now(),dirty:1}:{...c.theirs,dirty:0});await rm(c.id);ping();sync()}
addEventListener('online',sync);addEventListener('visibilitychange',()=>!document.hidden&&sync());setInterval(sync,20000);setTimeout(sync,500)

/** Pull every record again from the server (use after fixing the sync key on a device). */
export const resync=async()=>{localStorage.since=0;await sync()}
/** Does this ticket / customer match the typed text? Name, phone (any format), ticket code, device, IMEI, email. */
export const matchQ=(o,q)=>{q=String(q||'').trim().toLowerCase();if(!q)return true;const dg=q.replace(/\D/g,'').replace(/^(0|251)/,'')
 return[o.name,o.code,o.device,o.imei,o.email].some(v=>String(v||'').toLowerCase().includes(q))||(dg.length>=3&&normPhone(o.phone).includes(dg))}
/** Ask the database (staff only) and cache hits locally, so results show even before a full sync. */
export async function searchRemote(text){
 if(!navigator.onLine||!staffOn()||String(text||'').trim().length<2)return
 try{const r=await fetch(base()+'/api/search?q='+encodeURIComponent(String(text).trim()),{headers:hdr()});if(!r.ok)return
  for(const x of(await r.json()).docs){const l=await get(x.id);if(!l||(!l.dirty&&x.ts>l.ts))await put(x)};ping()}catch{}}
export function useRemoteSearch(q){useEffect(()=>{const t=setTimeout(()=>searchRemote(q),350);return()=>clearTimeout(t)},[q])}
