import {useState} from 'react'
import {useDB,day} from '../db'
import {Card,Btn,In,Tag,Slip,saleSlip,Page} from '../ui'
export default function Purchases(){const d=useDB(),[f,setF]=useState({}),[s,setS]=useState(null),[issue,setIssue]=useState({}),[msg,setMsg]=useState('')
 const dg=v=>String(v||'').replace(/\D/g,''),post=(u,b)=>fetch(u,{method:'POST',body:JSON.stringify(b)}).then(r=>r.ok?r.json():Promise.reject())
 const look=async()=>{setMsg('');const c=(f.code||'').trim(),un=d.unit.find(u=>u.serial===c);let x=d.sale.find(y=>(y.code===c.toUpperCase()||(un&&y.id===un.saleId))&&dg(y.phone)===dg(f.phone));if(!x)try{x=await post('/api/purchase',f)}catch{};setS(x||{none:1})}
 const claim=async l=>{try{const r=await post('/api/claimreq',{serial:l.serial,phone:f.phone,issue:issue[l.serial]});setMsg('Claim '+r.code+' opened. We will contact you.')}catch{setMsg('We could not open that claim. Check the warranty dates or visit the shop.')}}
 const n=day()
 return <Page title="Purchases and warranty"><p className="-mt-2 text-slate-500">Find your receipt with its code (or the device IMEI / serial) and the phone number used at purchase.</p>
  <Card className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"><In label="Receipt code or IMEI / serial" value={f.code||''} onChange={e=>setF({...f,code:e.target.value})}/><In label="Phone number" type="tel" value={f.phone||''} onChange={e=>setF({...f,phone:e.target.value})}/><Btn onClick={look}>Find purchase</Btn></Card>
  {s&&(s.none?<p className="text-slate-500">No purchase found. Check the code and phone number.</p>:<div className="grid gap-4 lg:grid-cols-2"><Card className="space-y-3"><div className="flex flex-wrap items-center gap-2"><b className="font-mono">{s.code}</b><span className="text-sm text-slate-500">{new Date(s.date).toLocaleDateString()}</span>{s.void&&<Tag c="bad">Refunded</Tag>}</div>
   {s.lines.map((l,i)=>{const sn=l.serial||l.imei,ok=l.until&&l.until>=n;return <div key={i} className="space-y-2 border-t border-slate-400/20 pt-3"><div><b>{l.q} × {l.name}</b>{sn&&<div className="font-mono text-xs text-slate-500">IMEI/SN {sn}</div>}</div><Tag c={!l.until?'slate':ok?'ok':'bad'}>{!l.until?'No warranty':ok?'Warranty until '+l.until:'Warranty ended '+l.until}</Tag>
    {ok&&l.serial&&<div className="flex items-end gap-2"><In cls="flex-1" label="Describe the fault" onChange={e=>setIssue({...issue,[l.serial]:e.target.value})}/><Btn disabled={!issue[l.serial]} onClick={()=>claim(l)}>Claim</Btn></div>}</div>})}{msg&&<p className="rounded-xl bg-slate-500/10 p-3 text-sm">{msg}</p>}<Btn v="g" onClick={()=>print()}>Print invoice</Btn></Card>
   <div className="overflow-x-auto"><div id="sheet" className="w-fit"><Slip slip={saleSlip(s)} w="80"/></div></div></div>)}</Page>}
