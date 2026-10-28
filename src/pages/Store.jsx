import {useEffect,useState} from 'react'
import {Link} from 'react-router-dom'
import {useDB,stock,mn} from '../db'
import {Card,Btn,Tag} from '../ui'
const S={phone:'+251900000000',addr:'Bole, Addis Ababa, Ethiopia',lat:9.0108,lng:38.7613,hrs:'Mon–Sat 8:30–19:00',tg:'https://t.me/samket'}
export default function Store(){const d=useDB(),[pub,setPub]=useState(()=>JSON.parse(localStorage.pubc||'[]')),[cat,setCat]=useState('')
 useEffect(()=>{fetch('/api/pub').then(r=>r.json()).then(x=>{setPub(x);localStorage.pubc=JSON.stringify(x)}).catch(()=>{})},[])
 const items=d.item.length?d.item.filter(i=>i.pub).map(i=>({...i,stock:stock(d,i)})):pub,cats=[...new Set(items.map(i=>i.cat))]
 return <main className="mx-auto max-w-6xl px-4 sm:px-6">
  <section className="py-16 sm:py-28"><span className="rounded-full border border-slate-400/30 px-4 py-1.5 text-sm font-semibold text-slate-500">● Open today · Addis Ababa</span>
   <h1 className="mt-6 text-5xl font-extrabold leading-[1.02] tracking-tighter sm:text-7xl">Tech that <span className="bg-gradient-to-r from-orange-500 to-pink-600 bg-clip-text text-transparent">just works.</span><br/>Fixed right.</h1>
   <p className="mt-6 max-w-xl text-lg text-slate-500">Phones and computers, sold with proof of warranty and repaired at board level.</p>
   <div className="mt-8 flex flex-wrap gap-3"><a href="#shop"><Btn className="!px-7 !py-3">Browse the shop</Btn></a><Link to="/track"><Btn v="g" className="!px-7 !py-3">Book or track a repair</Btn></Link></div></section>
  <section id="shop" className="scroll-mt-24 py-10"><h2 className="mb-4 text-3xl font-extrabold tracking-tight">In the shop</h2>
   <div className="mb-5 flex flex-wrap gap-2">{['',...cats].map(c=><button key={c} onClick={()=>setCat(c)} className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${cat===c?'bg-slate-900 text-white dark:bg-white dark:text-slate-900':'bg-slate-500/10 hover:bg-slate-500/20'}`}>{c||'All'}</button>)}</div>
   <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{items.filter(i=>!cat||i.cat===cat).map(i=><Card key={i.id} className="transition duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-orange-500/20"><div className="mb-3 grid h-32 place-items-center rounded-xl bg-gradient-to-br from-orange-500/15 to-violet-500/15 text-5xl">{{Phones:'📱',Laptops:'💻',Desktops:'🖥️',Parts:'🔧',Accessories:'🎧'}[i.cat]||'📦'}</div><b>{i.name}</b><div className="text-xl font-extrabold">{mn(i.price)}</div>{i.war>0&&<p className="text-sm text-slate-500">{i.war} day warranty</p>}<div className="mt-2"><Tag c={i.stock<=0?'bad':i.stock<3?'warn':'ok'}>{i.stock<=0?'Out of stock':i.stock<3?`Only ${i.stock} left`:'In stock'}</Tag></div></Card>)}
    {!items.length&&<p className="text-slate-500">The catalogue is being updated. Call us to ask what is available.</p>}</div></section>
  <section id="contact" className="scroll-mt-24 py-10"><h2 className="mb-4 text-3xl font-extrabold tracking-tight">Find us</h2>
   <div className="grid gap-4 lg:grid-cols-3"><Card className="space-y-3"><div><b>Address</b><p className="text-slate-500">{S.addr}</p></div><div><b>Hours</b><p className="text-slate-500">{S.hrs}</p></div><div className="flex flex-wrap gap-2"><a href={'tel:'+S.phone}><Btn>Call</Btn></a><a href={S.tg}><Btn v="g">Telegram</Btn></a><a href={`https://www.google.com/maps/dir/?api=1&destination=${S.lat},${S.lng}`}><Btn v="g">Directions</Btn></a></div></Card>
    <div className="min-h-72 overflow-hidden rounded-2xl border border-white/30 shadow-lg lg:col-span-2 dark:[&_iframe]:invert dark:[&_iframe]:hue-rotate-180"><iframe title="Map" loading="lazy" className="h-full min-h-72 w-full" src={`https://www.openstreetmap.org/export/embed.html?bbox=${S.lng-.012},${S.lat-.007},${S.lng+.012},${S.lat+.007}&layer=mapnik&marker=${S.lat},${S.lng}`}/></div></div></section></main>}
