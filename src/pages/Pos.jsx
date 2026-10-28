import {useState} from 'react'
import {useDB,save,stock,code,mn,addD,upCust} from '../db'
import {Card,Btn,In,Sel,Tag,Scan,Gate,saleSlip,Page} from '../ui'
const E={n:'',p:'',d:0,m:'Cash'}
export default function Pos(){const d=useDB(),[q,setQ]=useState(''),[cart,setCart]=useState([]),[c,setC]=useState(E),[pick,setPick]=useState(null),[done,setDone]=useState(null)
 const items=d.item.filter(i=>(i.name+i.cat).toLowerCase().includes(q.toLowerCase()))
 const free=i=>d.unit.filter(u=>u.itemId===i.id&&u.status==='in_stock'&&!cart.some(l=>l.serial===u.serial))
 const add=(i,u)=>{setCart([...cart,{k:Math.random(),itemId:i.id,name:i.name,serial:u&&u.serial,cost:u?u.cost:i.cost,base:i.price,price:i.price,war:i.war||0,q:1,imei:'',tag:u&&u.tag}]);setPick(null)}
 const click=i=>i.ser?setPick(i):((stock(d,i)<=0&&!confirm('No stock recorded. Add anyway?'))||add(i))
 const scan=s=>{const u=d.unit.find(x=>x.serial===s&&x.status==='in_stock');u?add(d.item.find(i=>i.id===u.itemId),u):alert('That serial is not in stock.')}
 const up=(k,p)=>setCart(cart.map(l=>l.k===k?{...l,...p}:l))
 const total=Math.max(0,cart.reduce((a,l)=>a+l.price*l.q,0)-(+c.d||0))
 const finish=async()=>{const cid=await upCust(c.n,c.p),L=cart.map(l=>({...l,until:l.war>0?addD(l.war):''}))
  const s=await save('sale',{code:await code('SL'),custId:cid,name:c.n,phone:c.p,lines:L,total,disc:+c.d||0,pay:c.m,date:Date.now()})
  for(const l of L)if(l.serial){const u=d.unit.find(x=>x.serial===l.serial);await save('unit',{...u,status:'sold',soldDate:Date.now(),saleId:s.id,until:l.until})}else await save('move',{item:l.itemId,q:-l.q,ref:s.id})
  setCart([]);setC(E);setDone(s)}
 return <Page title="Sell"><div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]"><div className="space-y-4"><Card><Scan onScan={scan}/></Card><In label="Search items" value={q} onChange={e=>setQ(e.target.value)}/>
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{items.map(i=>{const n=stock(d,i);return <button key={i.id} onClick={()=>click(i)} className="rounded-2xl border border-white/30 bg-white/60 p-4 text-left shadow transition hover:-translate-y-1 hover:shadow-xl active:scale-95 dark:border-white/10 dark:bg-white/5"><b className="block">{i.name}</b><span className="text-sm text-slate-500">{mn(i.price)}</span><div className="mt-1 flex gap-1"><Tag c={n<=(i.min||0)?'bad':'ok'}>{n} in stock</Tag>{i.ser&&<Tag>S/N</Tag>}</div></button>})}</div></div>
  <Card className="h-fit space-y-3"><h2 className="text-xl font-bold">Sale</h2>
   {cart.map(l=><div key={l.k} className="space-y-2 border-b border-slate-400/20 pb-3"><div className="flex items-center"><b className="flex-1">{l.name}{l.serial&&<span className="block font-mono text-xs font-normal text-slate-500">S/N {l.serial}</span>}</b><button onClick={()=>setCart(cart.filter(x=>x.k!==l.k))}>✕</button></div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3"><In cls="col-span-2 sm:col-span-3" label={l.serial?'IMEI / Serial (from stock)':'IMEI / Serial number (optional)'} readOnly={!!l.serial} placeholder="Scan or type" value={l.serial||l.imei||''} onChange={e=>up(l.k,{imei:e.target.value})}/>{!l.serial&&<In label="Qty" type="number" min="1" value={l.q} onChange={e=>up(l.k,{q:Math.max(1,+e.target.value)})}/>}<In label="Price" type="number" placeholder={l.base} value={l.price!==l.base?l.price:''} onChange={e=>up(l.k,{price:+e.target.value||l.base})}/><In label="Warranty days" type="number" min="0" value={l.war} onChange={e=>up(l.k,{war:+e.target.value||0})}/></div></div>)}
   {!cart.length&&<p className="text-slate-500">Scan or tap an item. Serialized items need a serial number.</p>}
   <In label="Customer" value={c.n} onChange={e=>setC({...c,n:e.target.value})}/><In label="Phone" type="tel" value={c.p} onChange={e=>setC({...c,p:e.target.value})}/>
   <div className="grid grid-cols-2 gap-2"><In label="Discount" type="number" min="0" value={c.d||''} onChange={e=>setC({...c,d:e.target.value})}/><Sel label="Payment" o={['Cash','Bank transfer','Telebirr','CBE Birr']} value={c.m} onChange={e=>setC({...c,m:e.target.value})}/></div>
   <div className="text-3xl font-extrabold tracking-tight">{mn(total)}</div><Btn className="w-full" disabled={!cart.length} onClick={finish}>Complete sale</Btn></Card></div>
  {pick&&<div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm"><Card className="max-h-[80vh] w-full max-w-sm overflow-auto !bg-white dark:!bg-slate-900"><h3 className="mb-3 font-bold">Pick a serial for {pick.name}</h3>{free(pick).map(u=><button key={u.id} onClick={()=>add(pick,u)} className="mb-2 block w-full rounded-xl border border-slate-400/30 p-3 text-left font-mono text-sm transition hover:bg-orange-500/10">{u.serial}</button>)}{!free(pick).length&&<p className="text-slate-500">No units in stock.</p>}<Btn v="g" onClick={()=>setPick(null)}>Cancel</Btn></Card></div>}
  {done&&<Gate slip={saleSlip(done)} onClose={()=>setDone(null)}/>}</Page>}
