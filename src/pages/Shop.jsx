import {useState} from 'react'
import {Page,In} from '../ui'
import {useCatalogue,ItemCard} from '../catalogue'
export default function Shop(){const items=useCatalogue(),[q,setQ]=useState(''),[cat,setCat]=useState(''),cats=['',...new Set(items.map(i=>i.cat))]
 const L=items.filter(i=>(!cat||i.cat===cat)&&(i.name+i.cat).toLowerCase().includes(q.toLowerCase()))
 return <Page title="Shop"><p className="-mt-2 text-slate-500">Prices are a guide. Ask in the shop for the best one.</p><In label="Search phones, laptops, parts…" value={q} onChange={e=>setQ(e.target.value)}/>
  <div className="flex gap-2 overflow-x-auto pb-1">{cats.map(c=><button key={c} onClick={()=>setCat(c)} className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition ${cat===c?'bg-slate-900 text-white dark:bg-white dark:text-slate-900':'bg-slate-500/10 hover:bg-slate-500/20'}`}>{c||'All'}</button>)}</div>
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{L.map(i=><ItemCard key={i.id} i={i}/>)}</div>{!L.length&&<p className="text-slate-500">Nothing matches. Call us, we may have it in the back.</p>}</Page>}
