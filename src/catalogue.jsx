import {useEffect,useState} from 'react'
import {useDB,stock,mn} from './db'
import {Card,Tag,ItemImg} from './ui'
export const S={phone:'+251900000000',addr:'Bole, Addis Ababa, Ethiopia',lat:9.0108,lng:38.7613,hrs:'Mon–Sat 8:30–19:00 · Sun closed',tg:'https://t.me/samket'}
export function useCatalogue(){const d=useDB(),[pub,setPub]=useState(()=>JSON.parse(localStorage.pubc||'[]'))
 useEffect(()=>{fetch('/api/pub').then(r=>r.json()).then(x=>{setPub(x);localStorage.pubc=JSON.stringify(x)}).catch(()=>{})},[])
 return d.item.length?d.item.filter(i=>i.pub).map(i=>({...i,stock:stock(d,i)})):pub}
export const ItemCard=({i})=><Card className="transition duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-orange-500/20"><ItemImg i={i}/><b className="mt-3 block">{i.name}</b><div className="text-xl font-extrabold">{mn(i.price)}</div>{i.war>0&&<p className="text-sm text-slate-500">{i.war} day warranty</p>}<div className="mt-2"><Tag c={i.stock<=0?'bad':i.stock<3?'warn':'ok'}>{i.stock<=0?'Out of stock':i.stock<3?`Only ${i.stock} left`:'In stock'}</Tag></div></Card>
