// Offline-first store: every device keeps a full IndexedDB copy. Stock = sum of immutable "move" records (never overwritten),
// other records merge last-write-wins per record. Codes include the device id so two offline devices never collide.
const dev=localStorage.dev||(localStorage.dev=Math.random().toString(36).slice(2,6));
const uid=()=>dev+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const nextCode=p=>{localStorage.n=(+localStorage.n||0)+1;return p+'-'+dev.toUpperCase()+'-'+String(localStorage.n).padStart(4,'0')};
let _db;const open=()=>_db||(_db=new Promise((ok,no)=>{const r=indexedDB.open('samket',1);r.onupgradeneeded=()=>r.result.createObjectStore('d',{keyPath:'id'});r.onsuccess=()=>ok(r.result);r.onerror=no}));
const tx=async(m,f)=>{const db=await open();return new Promise((ok,no)=>{const t=db.transaction('d',m),r=f(t.objectStore('d'));t.oncomplete=()=>ok(r&&r.result);t.onerror=no})};
const everything=async()=>(await tx('readonly',s=>s.getAll()))||[];
const all=async t=>(await everything()).filter(x=>x.type===t&&!x.del);
const put=o=>tx('readwrite',s=>s.put(o));
const get=id=>tx('readonly',s=>s.get(id));
const save=async(type,o)=>{o={...o,type,id:o.id||uid(),ts:Date.now(),dev,dirty:1};await put(o);return o};
const pending=async()=>(await everything()).filter(x=>x.dirty).length;
let busy=0;
async function sync(){
 if(busy)return false;busy=1;
 try{
  const d=(await everything()).filter(x=>x.dirty);
  const r=await fetch((localStorage.surl||'')+'/api/sync',{method:'POST',headers:{'content-type':'application/json','x-key':localStorage.skey||'samket'},body:JSON.stringify({since:+localStorage.since||0,docs:d.map(({dirty,...x})=>x)})});
  if(!r.ok)throw 0;
  const j=await r.json();
  for(const x of j.docs){const l=await get(x.id);if(!l||x.ts>l.ts||(x.ts===l.ts&&x.dev>=l.dev))await put(x)}
  for(const x of d){const l=await get(x.id);if(l&&l.dirty&&l.ts===x.ts)await put({...l,dirty:0})}
  localStorage.since=j.seq;busy=0;return true
 }catch(e){busy=0;return false}
}
