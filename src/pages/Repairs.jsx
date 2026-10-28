import {useState} from 'react'
import {Link} from 'react-router-dom'
import {useDB,save,mn,notify} from '../db'
import {Card,Btn,In,Tag,Gate,Timeline,STEPS,Page} from '../ui'
import {ps} from './NewTicket'
export default function Repairs(){const d=useDB(),[q,setQ]=useState(''),[slip,setSlip]=useState(null),[m,setM]=useState(null),[v,setV]=useState({}),[err,setErr]=useState('')
 const apply=async(t,i,x={})=>{const now=Date.now(),hist=[...(t.hist||[])];for(let k=STEPS.indexOf(t.status)+1;k<=i;k++)hist.push({s:STEPS[k],t:now})
  const nt=await save('ticket',{...t,...x,status:STEPS[i],hist,done:i>=3?now:null});notify(nt,STEPS[i]);return nt}
 const step=(t,i)=>{const cur=STEPS.indexOf(t.status);if(i===cur)return;if(i<=cur||i<3)return apply(t,i);setErr('');setV({cost:t.cost||'',pcost:t.pcost||'',war:t.war||0});setM({t,i})}
 const askP=m&&(m.i===3||!(m.t.cost>0)),askW=m&&m.i===4
 const ok=async()=>{if(askP&&(v.cost===''||isNaN(+v.cost)||+v.cost<0))return setErr('Enter the repair price (0 or more).');const nt=await apply(m.t,m.i,{cost:askP?+v.cost:m.t.cost,pcost:askP?+v.pcost||0:m.t.pcost,war:askW?+v.war||0:m.t.war});setM(null);if(m.i===4)setSlip(ps(nt))}
 const set=k=>e=>{setErr('');setV({...v,[k]:e.target.value})}
 const L=d.ticket.filter(t=>JSON.stringify(t).toLowerCase().includes(q.toLowerCase())).sort((a,b)=>b.ts-a.ts)
 return <Page title="Repair tickets" right={<Link to="/staff/repairs/new"><Btn>+ New ticket</Btn></Link>}>
  <In label="Search name, phone, IMEI, code" value={q} onChange={e=>setQ(e.target.value)}/>
  <div className="grid gap-3 lg:grid-cols-2">{L.map(t=><Card key={t.id} className="space-y-3"><div className="flex flex-wrap items-center gap-2"><b className="font-mono">{t.code}</b><Tag c={t.status==='Requested'?'warn':t.status==='Delivered'?'ok':'slate'}>{t.status}</Tag><span className="flex-1"/><span className="text-sm">{mn(t.cost)}</span></div>
   <div className="break-words text-sm text-slate-500">{t.name} · {t.phone} · {t.device} {t.imei}<br/>{t.issue}</div><Timeline status={t.status} onStep={i=>step(t,i)}/><p className="text-center text-[11px] text-slate-400">Tap a number to move the repair to that step</p>
   <label className="block text-xs font-semibold text-slate-500">Work done / notes (customer sees this)<textarea rows={2} defaultValue={t.work||''} onBlur={e=>e.target.value!==(t.work||'')&&save('ticket',{...t,work:e.target.value})} className="mt-1 w-full rounded-xl border border-slate-400/30 bg-white/50 px-3 py-2 text-sm dark:bg-white/5"/></label>
   <Btn v="g" className="!py-1" onClick={()=>setSlip(ps(t))}>Print</Btn></Card>)}</div>
  <Card><h2 className="mb-2 font-bold">Telegram outbox</h2>{d.notif.slice(-5).reverse().map(n=><div key={n.id} className="break-words text-sm text-slate-500">📨 {n.to}: {n.text}</div>)}{!d.notif.length&&<p className="text-sm text-slate-500">Status changes message the customer once they link the bot from the tracking page.</p>}</Card>
  {m&&<div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-3 backdrop-blur-sm"><Card className="w-full max-w-sm space-y-3 !bg-white dark:!bg-slate-900"><h3 className="font-bold">Step {m.i+1}: {STEPS[m.i]}</h3>{askP&&<div className="grid grid-cols-2 gap-2"><In label="Repair price (ETB)" type="number" min="0" value={v.cost} onChange={set('cost')}/><In label="Parts cost (ETB)" type="number" min="0" value={v.pcost} onChange={set('pcost')}/></div>}{askW&&<In label="Warranty days (0 = none)" type="number" min="0" value={v.war} onChange={set('war')}/>}{err&&<p className="text-sm text-red-500">{err}</p>}<div className="flex gap-2"><Btn onClick={ok}>{m.i===4?'Deliver and print receipt':'Confirm'}</Btn><Btn v="g" onClick={()=>setM(null)}>Cancel</Btn></div></Card></div>}
  {slip&&<Gate slip={slip} onClose={()=>setSlip(null)}/>}</Page>}
