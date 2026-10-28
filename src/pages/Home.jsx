import {Link} from 'react-router-dom'
import {Btn,Card} from '../ui'
import {useCatalogue,ItemCard} from '../catalogue'
export default function Home(){const items=useCatalogue().slice(0,4)
 return <main className="mx-auto w-full max-w-6xl px-4 sm:px-6">
  <section className="py-12 sm:py-24"><span className="rounded-full border border-slate-400/30 px-4 py-1.5 text-sm font-semibold text-slate-500">● Open today · Addis Ababa</span>
   <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tighter sm:text-7xl">Tech that <span className="bg-gradient-to-r from-orange-500 to-pink-600 bg-clip-text text-transparent">just works.</span><br/>Fixed right.</h1>
   <p className="mt-5 max-w-xl text-base text-slate-500 sm:text-lg">Phones and computers sold with proof of warranty, and repaired at board level.</p>
   <div className="mt-8 flex flex-wrap gap-3"><Link to="/shop"><Btn className="!px-7 !py-3">Browse the shop</Btn></Link><Link to="/repair"><Btn v="g" className="!px-7 !py-3">Book or track a repair</Btn></Link></div></section>
  <section className="grid gap-4 sm:grid-cols-3">{[['🛒','Buy','Phones, laptops, parts and accessories at fair prices.'],['🔧','Repair','Screens, batteries, water damage and dead boards.'],['🛡️','Warranty','Every warranty is tied to your IMEI or serial number.']].map(([e,t,x])=><Card key={t} className="transition hover:-translate-y-1"><div className="text-3xl">{e}</div><b className="mt-2 block text-lg">{t}</b><p className="text-sm text-slate-500">{x}</p></Card>)}</section>
  <section className="py-12"><div className="mb-4 flex items-end gap-3"><h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">New in the shop</h2><span className="flex-1"/><Link to="/shop" className="text-sm font-semibold text-orange-500">See all →</Link></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{items.map(i=><ItemCard key={i.id} i={i}/>)}{!items.length&&<p className="text-slate-500">The catalogue is being updated.</p>}</div></section>
  <Card className="text-center"><h2 className="text-2xl font-extrabold">Something broken?</h2><p className="mx-auto mt-2 max-w-md text-slate-500">Open a ticket in a minute and follow your repair step by step.</p><Link to="/repair"><Btn className="mt-4">Get a repair ticket</Btn></Link></Card></main>}
