import {useEffect,useState} from 'react'
import {useDB,stock,mn} from './db'
import {Card,Tag,ItemImg,Modal,condTag,condLabel} from './ui'
export const S={phone:'+251900000000',addr:'Bole, Addis Ababa, Ethiopia',lat:9.0108,lng:38.7613,hrs:'Mon–Sat 8:30–19:00 · Sun closed',tg:'https://t.me/samket'}
// /api/pub can answer with an error object (e.g. 503 when the database is not configured). Only a real list may be used or cached.
const cached=()=>{try{const x=JSON.parse(localStorage.pubc||'[]');return Array.isArray(x)?x:[]}catch{return[]}}
// In-stock configurations (RAM / storage / condition) of a tracked item, grouped. The server builds the same list for visitors.
const variants=(d,i)=>{const m={};for(const u of d.unit)if(u.itemId===i.id&&u.status==='in_stock'){const v={ram:u.ram||i.ram||'',storage:u.storage||i.storage||'',cond:u.cond||i.cond||'',condNote:u.condNote||i.condNote||''},k=JSON.stringify(v);(m[k]??={...v,n:0}).n++}return Object.values(m)}
export function useCatalogue(){const d=useDB(),[pub,setPub]=useState(cached)
 useEffect(()=>{fetch('/api/pub').then(r=>r.ok?r.json():Promise.reject()).then(x=>{if(!Array.isArray(x))return;setPub(x);localStorage.pubc=JSON.stringify(x)}).catch(()=>{})},[])
 return d.item.length?d.item.filter(i=>i.pub).map(i=>({...i,stock:stock(d,i),variants:variants(d,i)})):pub}
const stockTag=n=><Tag c={n<=0?'bad':n<3?'warn':'ok'}>{n<=0?'Out of stock':n<3?`Only ${n} left`:`${n} left`}</Tag>
const NA='Not specified'
function ItemModal({i,onClose}){
 const rows=[['Condition',condLabel(i)||NA],['RAM',i.ram||NA],['Storage',i.storage||NA],['Screen',i.screen||NA],['Camera',i.camera||NA],...(i.cpu?[['Processor',i.cpu]]:[]),['Warranty',i.war>0?`${i.war} days`:'No warranty'],['Stock left',i.stock>0?String(i.stock):'Out of stock']]
 return <Modal title={i.name} onClose={onClose} z={60}>
  <div className="grid gap-5 sm:grid-cols-2"><ItemImg i={i} cls="h-56"/>
   <div><div className="text-3xl font-extrabold">{mn(i.price)}</div>
    <div className="mt-2 flex flex-wrap gap-2">{i.cond&&<Tag c={condTag(i.cond)}>{i.cond}</Tag>}{stockTag(i.stock)}</div>
    <dl className="mt-4 grid grid-cols-[7rem_1fr] gap-y-1.5 text-sm">{rows.map(([k,v])=><div key={k} className="contents"><dt className="text-slate-500">{k}</dt><dd className={`break-words font-medium ${v===NA?'!font-normal text-slate-400':''}`}>{v}</dd></div>)}</dl></div></div>
  {i.variants&&i.variants.length>1&&<div><h3 className="mb-2 text-sm font-bold">Available configurations</h3><div className="space-y-1.5">{i.variants.map((v,k)=><div key={k} className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-500/10 px-3 py-2 text-sm"><b>{[v.ram,v.storage].filter(Boolean).join(' · ')||'Standard'}</b>{v.cond&&<Tag c={condTag(v.cond)}>{v.cond==='Used'&&v.condNote?`Used (${v.condNote})`:v.cond}</Tag>}<span className="ml-auto text-slate-500">{v.n} left</span></div>)}</div></div>}
  <p className="text-xs text-slate-500">Prices are a guide. Visit us or call {S.phone} to reserve this item.</p></Modal>}
export function ItemCard({i}){const [open,setOpen]=useState(false)
 return <><Card role="button" tabIndex={0} aria-label={`Details of ${i.name}`} onClick={()=>setOpen(true)} onKeyDown={e=>(e.key==='Enter'||e.key===' ')&&(e.preventDefault(),setOpen(true))} className="cursor-pointer transition duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-orange-500/20">
  <ItemImg i={i}/><b className="mt-3 block">{i.name}</b><div className="text-xl font-extrabold">{mn(i.price)}</div>
  <p className="text-sm text-slate-500">{i.war>0?`${i.war} day warranty`:'No warranty'}</p>
  <div className="mt-2 flex flex-wrap gap-1.5">{i.cond&&<Tag c={condTag(i.cond)}>{i.cond}</Tag>}{stockTag(i.stock)}</div>
  <p className="mt-2 text-xs font-semibold text-orange-500">View full specs →</p></Card>
  {open&&<ItemModal i={i} onClose={()=>setOpen(false)}/>}</>}
