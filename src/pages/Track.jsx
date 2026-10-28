import {useEffect,useState} from 'react'
import {useDB} from '../db'
import {queue} from '../offline'
import {Card,Btn,In,Sel,Timeline,UNFIXED,StatusTag,useF,Page} from '../ui'
import {usePhoneCheck,PasswordFor} from '../PhoneAuth'
import {normPhone} from '../../lib/phone.js'
const J={'content-type':'application/json'}
const Ticket=({t,bot})=><div className="space-y-3"><div className="flex flex-wrap items-center gap-2"><b className="font-mono">{t.code}</b><span className="text-sm">{t.device}</span><StatusTag s={t.status}/></div><Timeline status={t.status} hist={t.hist}/>
 {t.status==='Requested'&&<p className="text-sm text-slate-500">Request received. Bring the device to the shop and we will start.</p>}{t.status==='Ready'&&<p className="rounded-xl bg-emerald-500/10 p-3 text-sm">Ready for pickup. Bring your ticket code {t.code}.</p>}
 {t.status===UNFIXED&&<p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400"><b>We could not repair this device.</b> Please collect it from the shop.{t.why&&<><br/>Reason: {t.why}</>}</p>}
 {t.work&&<p className="rounded-xl bg-slate-500/10 p-3 text-sm"><b>Technician notes:</b> {t.work}</p>}{t.status==='Delivered'&&t.war>0&&<p className="text-sm text-slate-500">Warranty until {new Date(t.done+t.war*864e5).toLocaleDateString()}</p>}
 {bot&&<a className="text-sm font-semibold text-orange-500" href={`https://t.me/${bot}?start=${t.code}`}>Get updates on Telegram →</a>}</div>
export default function Track(){const d=useDB(),[f,b]=useF({dtype:'Phone'}),[tc,setTc]=useState(''),[t,setT]=useState(null),[msg,setMsg]=useState(''),[queued,setQueued]=useState(false),[err,setErr]=useState(''),[bot,setBot]=useState(''),[mp,setMp]=useState({phone:'',password:''}),[mine,setMine]=useState(null),[herr,setHerr]=useState('')
 const st=usePhoneCheck(f.phone),hst=usePhoneCheck(mp.phone)
 useEffect(()=>{fetch('/api/cfg').then(r=>r.json()).then(x=>setBot(x.bot)).catch(()=>{})},[])
 const find=async c=>{c=c.trim().toUpperCase();let x=d.ticket.find(y=>y.code===c);if(!x)try{const r=await fetch('/api/track?c='+encodeURIComponent(c));if(r.ok)x=await r.json()}catch{};setT(x||{none:1})}
 // Open a ticket. Phone known + password: must log in (A). Known + no password: password claims it (B). New phone: profile created (C).
 const send=async e=>{e.preventDefault();setErr('');setQueued(false);setMsg('');const body={...f,phone:normPhone(f.phone)}
  try{const r=await fetch('/api/req',{method:'POST',headers:J,body:JSON.stringify(body)})
   if(r.status===401)return setErr('Wrong password for this phone number.')
   if(r.status===400){const j=await r.json().catch(()=>({}));return setErr(j.error==='password_short'?'Password must be at least 4 characters.':'Please check the form and try again.')}
   if(!r.ok)throw 0
   const c=(await r.json()).code;setMsg(c);setTc(c);find(c)
  }catch{await queue({url:'/api/req',method:'POST',body});setQueued(true)}} // offline: kept in IndexedDB, sent automatically when back online
 const my=async()=>{setHerr('');setMine(null);const p=normPhone(mp.phone)
  try{let tok=sessionStorage.ctokP===p?sessionStorage.ctok:''
   if(!tok){const r=await fetch('/api/auth/access',{method:'POST',headers:J,body:JSON.stringify({phone:p,password:mp.password})})
    if(r.status===401)return setMine('bad')
    if(r.status===400)return setHerr('Password must be at least 4 characters.')
    const j=await r.json();if(j.needsPassword)return setHerr('Create a password (at least 4 characters) to claim your history.')
    tok=j.token;sessionStorage.ctok=tok;sessionStorage.ctokP=p}
   const r2=await fetch('/api/my',{method:'POST',headers:{...J,authorization:'Bearer '+tok},body:'{}'})
   if(r2.status===401){sessionStorage.removeItem('ctok');return setMine('bad')}
   setMine(await r2.json())
  }catch{setHerr('Could not reach the server. Try again when you are online.')}}
 return <Page title="Repair customer portal"><div className="grid gap-4 lg:grid-cols-2">
  <Card><h2 className="mb-2 text-xl font-bold">Open a ticket</h2><form onSubmit={send} className="space-y-3"><In label="Your name *" required {...b('name')}/><In label="Phone *" type="tel" required {...b('phone')}/><PasswordFor st={st} value={f.password||''} onChange={v=>b('password').onChange({target:{value:v}})}/><Sel label="Device type *" o={['Phone','Laptop','Desktop','Tablet','Other']} {...b('dtype')}/><label className="block text-xs font-semibold text-slate-500">What is wrong? *<textarea required rows={3} {...b('issue')} className="mt-1 w-full rounded-xl border border-slate-400/30 bg-white/50 px-3 py-2 text-sm dark:bg-white/5"/></label>
   <details><summary className="cursor-pointer text-sm font-semibold text-slate-500">More details (optional)</summary><div className="mt-2 space-y-3"><In label="Email" type="email" {...b('email')}/><In label="Brand and model" {...b('device')}/><In label="IMEI or serial" {...b('imei')}/></div></details>{err&&<p className="text-sm text-red-500">{err}</p>}<Btn className="w-full">Get my ticket</Btn></form>{msg&&<p className="mt-3 text-sm">Your ticket: <b className="font-mono text-lg">{msg}</b>. Keep it and bring your device in.</p>}{queued&&<p className="mt-3 rounded-xl bg-amber-500/10 p-3 text-sm">You are offline. Your request is saved on this device and will be sent automatically when you are back online. Look it up under "My repair history" afterwards.</p>}</Card>
  <div className="space-y-4"><Card><h2 className="mb-2 text-xl font-bold">Track a repair</h2><div className="flex items-end gap-2"><In cls="flex-1" label="Ticket code" value={tc} onChange={e=>setTc(e.target.value)} placeholder="R-12"/><Btn type="button" onClick={()=>find(tc)}>Check</Btn></div>{t&&<div className="mt-5">{t.none?<p className="text-slate-500">No ticket with that code.</p>:<Ticket t={t} bot={bot}/>}</div>}</Card>
   <Card><h2 className="mb-2 text-xl font-bold">My repair history</h2><p className="mb-2 text-sm text-slate-500">Enter your phone number. Old activity on the same number is linked to your account.</p><div className="space-y-3"><In label="Phone" type="tel" value={mp.phone} onChange={e=>{setMine(null);setMp({...mp,phone:e.target.value})}}/><PasswordFor st={hst} mode="history" value={mp.password} onChange={v=>setMp({...mp,password:v})}/></div><Btn className="mt-3" disabled={hst==='idle'||hst==='checking'||hst==='C'} onClick={my}>{hst==='B'?'Set password and show my history':'Show my history'}</Btn>
    {mine==='bad'&&<p className="mt-3 text-sm text-red-500">Wrong phone number or password.</p>}{herr&&<p className="mt-3 text-sm text-red-500">{herr}</p>}{mine&&mine!=='bad'&&<div className="mt-4 space-y-5">{mine.tickets.map(x=><Ticket key={x.code} t={x} bot={bot}/>)}{!mine.tickets.length&&<p className="text-slate-500">No repairs yet.</p>}{!!mine.purchases.length&&<div><h3 className="mb-1 text-sm font-bold">Purchases</h3>{mine.purchases.map(p=><div key={p.code} className="text-sm text-slate-500"><b className="font-mono">{p.code}</b> · {new Date(p.date).toLocaleDateString()} · {p.items.join(', ')} · {p.total.toLocaleString()} ETB</div>)}</div>}</div>}</Card></div></div></Page>}
