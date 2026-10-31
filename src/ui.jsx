import {createContext,useContext,useEffect,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
export const UserCtx=createContext(),useUser=()=>useContext(UserCtx)
export const ROLES={cashier:['pos','repairs','newticket','crm','claims','cash'],admin:['*']}
export const can=(u,p)=>!!u&&(ROLES[u.role].includes('*')||ROLES[u.role].includes(p))
export const Card=({className='',...p})=><div {...p} className={`rounded-2xl border border-white/30 dark:border-white/10 bg-white/60 dark:bg-white/5 backdrop-blur-xl shadow-lg shadow-black/5 p-5 ${className}`}/>
export const Btn=({v,className='',...p})=><button {...p} className={`rounded-full px-4 py-2 text-sm font-semibold transition active:scale-95 disabled:opacity-40 ${v==='g'?'border border-slate-400/30 hover:bg-slate-500/10':'bg-gradient-to-br from-orange-500 to-pink-600 text-white shadow-lg shadow-pink-600/25 hover:brightness-110'} ${className}`}/>
const fc='mt-1 w-full rounded-xl border border-slate-400/30 bg-white/50 dark:bg-white/5 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-orange-500'
export const In=({label,cls='',...p})=><label className={`block text-xs font-semibold text-slate-500 dark:text-slate-400 ${cls}`}>{label}<input {...p} className={fc}/></label>
export const Sel=({label,o,cls='',...p})=><label className={`block text-xs font-semibold text-slate-500 dark:text-slate-400 ${cls}`}>{label}<select {...p} className={fc}>{o.map(x=><option key={x}>{x}</option>)}</select></label>
export const Tag=({c='slate',children})=><span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${{slate:'bg-slate-500/15',ok:'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',bad:'bg-red-500/15 text-red-600 dark:text-red-400',warn:'bg-amber-500/15 text-amber-600 dark:text-amber-400'}[c]}`}>{children}</span>
export const useF=(init={})=>{const [f,setF]=useState(init);return [f,k=>({value:f[k]??'',onChange:e=>setF(x=>({...x,[k]:e.target.value}))}),setF]}
export const STEPS=['Received','Diagnosing','Repairing','Ready','Delivered']
export const UNFIXED='Unfixed' // 6th status: the device could not be repaired
export const STATUSES=[...STEPS,UNFIXED]
export const statusColor=s=>s==='Requested'?'warn':s==='Delivered'?'ok':s===UNFIXED?'bad':'slate'
export const StatusTag=({s})=><Tag c={statusColor(s)}>{s}</Tag>
export const Timeline=({status,onStep,hist=[]})=>{const un=status===UNFIXED,last=STATUSES.length-1
 const n=un?Math.max(1,...(hist||[]).map(h=>STEPS.indexOf(h.s))):STEPS.indexOf(status) // furthest normal step reached
 return <ol className="flex w-full">{STATUSES.map((s,i)=>{const bad=i===last,on=bad?un:i<=n,cur=bad?un:(!un&&i===n)
  return <li key={s} className="relative min-w-0 flex-1 text-center">
  {i<last&&<div className={`absolute left-1/2 top-4 h-0.5 w-full transition-all duration-700 ${i===last-1?(un?'bg-red-500/60':'bg-slate-400/20'):i<n?'bg-orange-500':'bg-slate-400/30'}`}/>}
  <button type="button" disabled={!onStep} onClick={()=>onStep&&onStep(i)} aria-label={s} className={`relative mx-auto grid h-9 w-9 place-items-center rounded-full text-sm font-bold transition-all duration-500 ${on?(bad?'bg-red-600 text-white':'bg-gradient-to-br from-orange-500 to-pink-600 text-white'):'bg-slate-300 dark:bg-slate-700'} ${cur?`scale-125 ring-4 ${bad?'ring-red-500/30':'ring-orange-500/30'}`:''} ${onStep?'cursor-pointer hover:scale-125 active:scale-95':'cursor-default'}`}>{bad?'✕':on&&(un||i<n)?'✓':i+1}</button>
  <div className={`mt-2 truncate text-[10px] font-semibold sm:text-[11px] ${on?(bad?'text-red-500':''):'text-slate-400'}`}>{s}</div></li>})}</ol>}
export function Scan({onScan,label='Scan or type serial / IMEI / code'}){const [v,setV]=useState(''),[cam,setCam]=useState(false),r=useRef()
 useEffect(()=>{if(!cam)return;let s,stop;(async()=>{try{const det=new BarcodeDetector();s=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});r.current.srcObject=s;await r.current.play()
  const tick=async()=>{if(stop)return;const x=await det.detect(r.current).catch(()=>[]);if(x[0]){onScan(x[0].rawValue);setCam(false)}else setTimeout(tick,300)};tick()}catch{setCam(false);alert('Camera scanning is not supported on this device. Use a USB/Bluetooth scanner or type the code.')}})()
  return()=>{stop=1;s&&s.getTracks().forEach(t=>t.stop())}},[cam])
 return <div><form className="flex items-end gap-2" onSubmit={e=>{e.preventDefault();v.trim()&&onScan(v.trim());setV('')}}><In cls="flex-1" label={label} value={v} onChange={e=>setV(e.target.value)}/><Btn v="g" type="button" onClick={()=>setCam(!cam)}>📷</Btn></form>{cam&&<video ref={r} className="mt-2 w-full rounded-xl" muted playsInline/>}</div>}
// ---- item condition (stock form, POS variant picker, shop details) ----
export const CONDS=['Brand New','Refurbished','Used']
export const condLabel=o=>o&&o.cond?(o.cond==='Used'&&o.condNote?`Used (${o.condNote})`:o.cond):''
export const condTag=c=>c==='Brand New'?'ok':c==='Refurbished'?'warn':c==='Used'?'slate':'slate'

// ---- printing ----
// The print sheet is rendered in a portal directly under <body>. index.css hides everything else while printing, so the
// sheet is the only content (no hidden-but-still-laid-out page, no position:fixed repeated on every page = no 2-4 page prints).
export function PrintSheet({page='A4 portrait',children}){
 useEffect(()=>{const s=document.createElement('style');s.textContent=`@page{margin:0;size:${page}}`;document.head.append(s);return()=>s.remove()},[page])
 return createPortal(<div id="print-root">{children}</div>,document.body)}
const Rule=({a,cw})=><div>{'-'.repeat(a?50:cw<60?28:40)}</div>
export const Slip=({slip,w,copy})=>{const a=w==='a4',cw=a?138:+w,tear=slip.stub&&slip.stub.length>0
 return <div className="bg-white p-[4mm] font-mono leading-snug text-black" style={{width:cw+'mm',fontSize:a?12:cw<60?10:11,wordBreak:'break-word'}}>{copy&&<div className="mb-1 border-b border-black pb-0.5 text-center text-[10px] font-bold tracking-widest">{copy}</div>}<b>SAMKET TECHNOLOGIES</b><div>{slip.title}</div>{slip.lines.map((l,i)=>l==='--'?<Rule key={i} a={a} cw={cw}/>:l.startsWith('## ')?<div key={i} className="font-bold">{l.slice(3)}</div>:<div key={i}>{l}</div>)}
  {tear&&<><div className="my-1 border-t-2 border-dashed border-black pt-0.5 text-center text-[9px]">✂ TEAR OFF · TAPE TO DEVICE</div>{slip.stub.map((l,i)=><div key={i} className={i===0?'text-base font-bold':''}>{l}</div>)}</>}</div>}
/** One full A4 page (210x296 mm, fixed height so it can never spill onto a 2nd page). Main sheet on top; when slip.stub exists,
 *  a dashed cut line and the internal staff tear-away ticket sit at the bottom. */
export const A4Receipt=({slip,copy})=>{const tear=slip.stub&&slip.stub.length>0
 return <div className="a4page" style={{width:'210mm',height:'296mm',boxSizing:'border-box',padding:'12mm',display:'flex',flexDirection:'column',background:'#fff',color:'#000',fontFamily:'ui-monospace,Menlo,Consolas,monospace',fontSize:13,lineHeight:1.45,overflow:'hidden',wordBreak:'break-word'}}>
  <div style={{flex:1,minHeight:0,overflow:'hidden'}}>
   {copy&&<div style={{textAlign:'center',fontSize:10,fontWeight:700,letterSpacing:'.2em',borderBottom:'1px solid #000',paddingBottom:2,marginBottom:8}}>{copy}</div>}
   <div style={{fontSize:24,fontWeight:800,letterSpacing:'.02em'}}>SAMKET TECHNOLOGIES</div>
   <div style={{fontSize:17,fontWeight:700,marginBottom:8}}>{slip.title}</div>
   {slip.lines.map((l,i)=>l==='--'?<hr key={i} style={{border:0,borderTop:'1px solid #000',margin:'6px 0'}}/>:l.startsWith('## ')?<div key={i} style={{fontWeight:700,fontSize:14,marginTop:4}}>{l.slice(3)}</div>:<div key={i}>{l||' '}</div>)}
  </div>
  {tear&&<div style={{flex:'none',height:'74mm',marginTop:'5mm',borderTop:'2px dashed #000',paddingTop:'3mm',overflow:'hidden'}}>
   <div style={{textAlign:'center',fontSize:10,fontWeight:700,letterSpacing:'.2em',marginBottom:6}}>✂ TEAR AWAY · INTERNAL STAFF COPY · KEEP WITH THE JOB</div>
   {slip.stub.map((l,i)=><div key={i} style={i===0?{fontSize:20,fontWeight:800}:{}}>{l}</div>)}</div>}</div>}
// Checkout flow: big green check first, then Print. The window closes itself when printing is finished.
export function Gate({slip,onClose,title='Done',sub,a4only}){const [m,setM]=useState(a4only?'a4':localStorage.rw||'a4'),a4=m==='a4',tear=!!(slip.stub&&slip.stub.length)
 const go=()=>{if(!a4only)localStorage.rw=m;const end=()=>{removeEventListener('afterprint',end);onClose()};addEventListener('afterprint',end);setTimeout(()=>print(),60)}
 return <><div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-3 backdrop-blur-sm print:hidden"><Card className="max-h-[92vh] w-full max-w-sm overflow-auto text-center !bg-white dark:!bg-slate-900">
  <div className="pop mx-auto grid h-32 w-32 place-items-center rounded-full bg-emerald-500 shadow-xl shadow-emerald-500/40"><svg viewBox="0 0 24 24" className="h-20 w-20" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
  <h3 className="mt-5 text-2xl font-extrabold">{title}</h3>{sub&&<p className="mt-1 text-slate-500">{sub}</p>}
  {!a4only&&<div className="mt-5 text-left"><Sel label={`Paper (A4 = one full page${tear?' with the staff tear-away at the bottom':''})`} o={['a4','80','58']} value={m} onChange={e=>setM(e.target.value)}/></div>}
  {a4only&&<p className="mt-4 text-sm text-slate-500">Prints on one full A4 page{tear?', staff tear-away at the bottom':''}.</p>}
  <div className="mt-4 flex gap-2"><Btn className="flex-1 !py-3 text-base" onClick={go}>🖨 Print</Btn><Btn v="g" className="!py-3" onClick={onClose}>Close</Btn></div>
  <details className="mt-3 text-left text-sm"><summary className="cursor-pointer text-slate-500">Preview</summary><div className="mt-2 overflow-x-auto rounded-xl bg-slate-200 p-3"><div className="mx-auto w-fit"><Slip slip={slip} w={m}/></div></div></details></Card></div>
  <PrintSheet page={a4?'A4 portrait':m+'mm auto'}>{a4?<A4Receipt slip={slip} copy={tear?'CUSTOMER / MAIN SHEET':'CLIENT INVOICE'}/>:<Slip slip={slip} w={m}/>}</PrintSheet></>}
export const sns=l=>l.serial?[l.serial]:(l.imeis&&l.imeis.length?l.imeis.filter(Boolean):l.imei?[l.imei]:[])
const _saleSlip=s=>({title:'RECEIPT '+s.code,lines:[new Date(s.date).toLocaleString(),`${s.name||''} ${s.phone||''}`,'--',...s.lines.flatMap(l=>{const n=sns(l);return [`${l.q} x ${l.name}  ${l.price*l.q}`,...n.map((x,i)=>`SN${n.length>1?' #'+(i+1):''} ${x}${l.tag&&n.length===1?' ['+l.tag+']':''}`),l.spec?l.spec:'',l.until?'Warranty to '+l.until:'No warranty'].filter(Boolean)}),'--',`Discount ${s.disc}`,`TOTAL ${s.total} ETB (${s.pay})`],stub:[]})
export const ItemImg=({i,cls='h-32'})=>i.img?<img src={i.img} alt="" className={`${cls} w-full rounded-xl bg-slate-500/5 object-contain p-1`}/>:<div className={`${cls} grid w-full place-items-center rounded-xl bg-gradient-to-br from-orange-500/15 to-violet-500/15 text-5xl`}>{{Phones:'📱',Laptops:'💻',Desktops:'🖥️',Modems:'📡',Parts:'🔧',Accessories:'🎧'}[i.cat]||'📦'}</div>
export async function shrink(f){const b=await createImageBitmap(f),k=Math.min(1,480/Math.max(b.width,b.height)),c=document.createElement('canvas');c.width=b.width*k;c.height=b.height*k;c.getContext('2d').drawImage(b,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.72)}
export const Page=({title,children,right})=><div className="mx-auto max-w-6xl p-4 sm:p-6"><div className="mb-5 flex flex-wrap items-center gap-3"><h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1><span className="flex-1"/>{right}</div><div className="space-y-4">{children}</div></div>
export function Modal({title,onClose,z=50,children}){useEffect(()=>{const k=e=>e.key==='Escape'&&onClose();addEventListener('keydown',k);return()=>removeEventListener('keydown',k)},[])
 return <div className="fixed inset-0 grid place-items-end bg-black/50 backdrop-blur-sm sm:place-items-center sm:p-4" style={{zIndex:z}} onClick={onClose}><div onClick={e=>e.stopPropagation()} className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-white/20 bg-white shadow-2xl dark:bg-slate-900 sm:rounded-3xl"><div className="flex items-center gap-3 border-b border-slate-400/20 px-5 py-4"><h2 className="min-w-0 flex-1 truncate text-lg font-extrabold">{title}</h2><button aria-label="Close" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-slate-500/10 hover:bg-slate-500/20">✕</button></div><div className="space-y-6 overflow-y-auto p-5">{children}</div></div></div>}

/** Generic edit form. fields: [{k,label,type?:'number'|'tel'|'textarea'|..., o?:[options], req?:true, cls?}]
 *  onSave(values) runs the PATCH/update; throwing keeps the form open and shows the message. */
export function EditModal({title,fields,value,onSave,onClose,z=70}){
 const [f,setF]=useState(()=>({...value})),[busy,setBusy]=useState(false),[err,setErr]=useState('')
 const set=k=>e=>setF(x=>({...x,[k]:e.target.value}))
 const submit=async e=>{e.preventDefault();setErr('');const out={}
  for(const {k,type,req,label} of fields){let v=f[k]
   if(type==='number'){v=v===''||v==null?0:+v;if(isNaN(v)||v<0)return setErr('Enter a valid number for '+label)}else if(typeof v==='string')v=v.trim()
   if(req&&(v===''||v==null))return setErr('Required: '+label);out[k]=v}
  setBusy(true);try{await onSave(out);onClose()}catch(x){setErr(x.message||'Could not save');setBusy(false)}}
 return <Modal title={title} onClose={onClose} z={z}><form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">{fields.map(({k,label,type,o,cls=''})=>o?<Sel key={k} cls={cls} label={label} o={o} value={f[k]??o[0]} onChange={set(k)}/>:type==='textarea'?<label key={k} className={`block text-xs font-semibold text-slate-500 sm:col-span-2 ${cls}`}>{label}<textarea rows={2} value={f[k]??''} onChange={set(k)} className={fc}/></label>:<In key={k} cls={cls} label={label} type={type||'text'} min={type==='number'?0:undefined} value={f[k]??''} onChange={set(k)}/>)}
  {err&&<p className="text-sm text-red-500 sm:col-span-2">{err}</p>}
  <div className="flex gap-2 sm:col-span-2"><Btn disabled={busy}>{busy?'Saving…':'Save changes'}</Btn><Btn v="g" type="button" onClick={onClose}>Cancel</Btn></div></form></Modal>}

// Success modal after a customer creates a ticket on the website.
const wrapText=(x,t,w)=>{const out=[];let l='';for(const word of String(t).split(/\s+/)){const n=l?l+' '+word:word;if(x.measureText(n).width>w&&l){out.push(l);l=word}else l=n}if(l)out.push(l);return out}
function receiptPng(code,info={}){const W=900,pad=50,rows=[['Date',new Date().toLocaleString()],['Name',info.name],['Phone',info.phone],['Device',[info.dtype,info.device].filter(Boolean).join(' ')],['IMEI / serial',info.imei],['Problem',info.issue]].filter(r=>r[1])
 const m=document.createElement('canvas').getContext('2d');m.font='28px sans-serif'
 const body=rows.map(([k,v])=>[k,wrapText(m,v,W-pad*2-210)]),H=330+body.reduce((a,[,l])=>a+Math.max(1,l.length)*38+10,0)+150
 const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d')
 x.fillStyle='#fff';x.fillRect(0,0,W,H);x.fillStyle='#000';x.font='bold 44px sans-serif';x.fillText('SAMKET TECHNOLOGIES',pad,90)
 x.font='28px sans-serif';x.fillText('Repair ticket receipt',pad,135);x.fillRect(pad,160,W-pad*2,3)
 x.font='bold 68px monospace';x.fillText(code,pad,250);let y=330
 for(const [k,l] of body){x.font='bold 26px sans-serif';x.fillText(k,pad,y);x.font='28px sans-serif';(l.length?l:['']).forEach((t,i)=>x.fillText(t,pad+210,y+i*38));y+=Math.max(1,l.length)*38+10}
 x.font='24px sans-serif';x.fillText('Present this ticket number when dropping off your device.',pad,H-70)
 const a=document.createElement('a');a.href=c.toDataURL('image/png');a.download=`Samket-receipt-${code}.png`;document.body.append(a);a.click();a.remove()}
export function TicketDone({code,info,onClose}){const [ok,setOk]=useState(false),[bot,setBot]=useState('')
 useEffect(()=>{fetch('/api/cfg').then(r=>r.json()).then(x=>setBot(x.bot||'')).catch(()=>{})},[])
 if(!code)return null
 const copy=()=>{navigator.clipboard&&navigator.clipboard.writeText(code).then(()=>{setOk(true);setTimeout(()=>setOk(false),2000)}).catch(()=>{})},
  tgHref=bot?`https://t.me/${bot}?start=${code}`:'https://t.me/samket',
  slip={title:'REPAIR TICKET '+code,lines:[new Date().toLocaleString(),'--',...[['Name',info?.name],['Phone',info?.phone],['Device',[info?.dtype,info?.device].filter(Boolean).join(' ')],['IMEI / serial',info?.imei],['Problem',info?.issue]].filter(r=>r[1]).map(([k,v])=>`${k}: ${v}`),'--','Keep this number and present it when dropping off your device.','Track your repair: Repairs page on our website or Telegram.'],stub:[]}
 return <><div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4 backdrop-blur-sm print:hidden" role="dialog" aria-modal="true" aria-label="Ticket created">
  <Card className="max-h-[94vh] w-full max-w-sm overflow-auto text-center !bg-white dark:!bg-slate-900">
   <div className="pop mx-auto grid h-24 w-24 place-items-center rounded-full bg-emerald-500 shadow-xl shadow-emerald-500/40"><svg viewBox="0 0 24 24" className="h-14 w-14" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
   <h3 className="mt-4 text-xl font-extrabold">Ticket Created!</h3>
   <p className="mt-1 text-sm text-slate-500">Your ticket number</p>
   <div className="mt-2 break-all rounded-2xl bg-slate-500/10 px-3 py-4 font-mono text-3xl font-extrabold tracking-wider">#{code}</div>
   <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">Save this ticket number and present it when dropping off your device at our shop.</p>
   <div className="mt-5 grid gap-2"><Btn className="!py-3" onClick={copy}>{ok?'✓ Copied':'Copy Ticket ID'}</Btn>
    <Btn v="g" className="!py-3" onClick={()=>setTimeout(()=>print(),60)}>Save as PDF</Btn>
    <Btn v="g" className="!py-3" onClick={()=>receiptPng(code,info)}>Download Receipt</Btn>
    <a href={tgHref} target="_blank" rel="noreferrer" className="block rounded-full bg-sky-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 transition hover:brightness-110 active:scale-95">✈ Get updates on Telegram</a>
    {!bot&&<p className="text-xs text-slate-500">Open the bot and send <b className="font-mono">/track {code}</b> to start the updates.</p>}
    <Btn v="g" onClick={onClose}>Done</Btn></div>
  </Card></div>
  <PrintSheet page="A4 portrait"><A4Receipt slip={slip} copy="CLIENT COPY"/></PrintSheet></>}

// Only repair tickets carry a tear-away stub; sales and business invoices print as a clean single invoice.
export const saleSlip=s=>({..._saleSlip(s),stub:[]})
