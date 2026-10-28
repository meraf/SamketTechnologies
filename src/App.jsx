import {useState} from 'react'
import {BrowserRouter,Routes,Route,Link,NavLink,Outlet,Navigate} from 'react-router-dom'
import {useSync} from './db'
import {UserCtx,can,Card,Btn,Sel,In} from './ui'
import Home from './pages/Home'
import Shop from './pages/Shop'
import Contact from './pages/Contact'
import Track from './pages/Track'
import Purchases from './pages/Purchases'
import Pos from './pages/Pos'
import Inventory from './pages/Inventory'
import Repairs from './pages/Repairs'
import NewTicket from './pages/NewTicket'
import Crm from './pages/Crm'
import Claims from './pages/Claims'
import Cash from './pages/Cash'
import Reports from './pages/Reports'
import SyncPage from './pages/Sync'
const Theme=()=><button aria-label="Theme" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-500/10 transition hover:scale-110" onClick={()=>{const d=document.documentElement.classList.toggle('dark');localStorage.theme=d?'dark':'light'}}>🌓</button>
const Bg=({children})=><div className="min-h-screen w-full overflow-x-hidden bg-gradient-to-br from-slate-100 via-white to-orange-50 text-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:text-slate-100"><div className="pointer-events-none fixed inset-0 overflow-hidden"><i className="absolute -right-40 -top-40 h-[40rem] w-[40rem] rounded-full bg-orange-500/20 blur-3xl"/><i className="absolute -bottom-40 -left-40 h-[36rem] w-[36rem] rounded-full bg-violet-500/20 blur-3xl"/></div><div className="relative">{children}</div></div>
const lk=({isActive})=>`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold transition ${isActive?'bg-slate-900 text-white dark:bg-white dark:text-slate-900':'text-slate-500 hover:bg-slate-500/10'}`
const Bar=({nav,right})=><header className="sticky top-2 z-40 mx-2 mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-3xl border border-white/30 bg-white/70 px-3 py-2 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/70 sm:mx-auto sm:max-w-6xl sm:px-4"><Link to="/" className="text-lg font-extrabold tracking-tight">SAMKET<span className="text-orange-500">.</span></Link>
 <nav className="order-last flex w-full gap-1 overflow-x-auto pb-1 md:order-none md:w-auto md:flex-1 md:justify-center md:pb-0">{nav}</nav><div className="ml-auto flex items-center gap-2">{right}</div></header>
const pn=[['/','Home'],['/shop','Shop'],['/repair','Repairs'],['/purchases','My purchases'],['/contact','Contact']]
function Public(){return <Bg><Bar nav={pn.map(([t,l])=><NavLink key={t} to={t} end={t==='/'} className={lk}>{l}</NavLink>)} right={<Theme/>}/><Outlet/>
 <footer className="mx-auto mt-16 flex max-w-6xl flex-wrap gap-x-4 gap-y-1 border-t border-slate-400/20 px-4 py-8 text-sm text-slate-500 sm:px-6"><span>© {new Date().getFullYear()} Samket Technologies</span><span className="flex-1"/><span>Powered by Mafi Technologies</span></footer></Bg>}
const PINS={cashier:'1111',admin:'9999'}
function Login({onLogin}){const [r,setR]=useState('cashier'),[p,setP]=useState('')
 return <div className="grid min-h-[70vh] place-items-center p-3"><Card className="w-full max-w-sm"><h1 className="mb-4 text-2xl font-extrabold">Staff sign in</h1><Sel label="Role" o={Object.keys(PINS)} value={r} onChange={e=>setR(e.target.value)}/><div className="mt-3"><In label="PIN" type="password" inputMode="numeric" value={p} onChange={e=>setP(e.target.value)} onKeyDown={e=>e.key==='Enter'&&document.getElementById('go').click()}/></div><Btn id="go" className="mt-4 w-full" onClick={()=>p===(localStorage['pin_'+r]||PINS[r])?onLogin({role:r}):setP('')}>Unlock</Btn></Card></div>}
const sn=[['pos','Sell'],['inventory','Stock','stock'],['repairs','Repairs'],['repairs/new','New ticket','newticket'],['crm','Customers'],['claims','Claims'],['cash','Cash'],['reports','Reports'],['sync','Sync']]
function Staff(){const [u,setU]=useState(()=>JSON.parse(sessionStorage.u||'null')),s=useSync()
 if(!u)return <Bg><Bar nav={null} right={<Theme/>}/><Login onLogin={x=>{sessionStorage.u=JSON.stringify(x);setU(x)}}/></Bg>
 return <UserCtx.Provider value={u}><Bg><Bar nav={sn.filter(([a,,p])=>can(u,p||a)).map(([a,t])=><NavLink key={a} to={a} end={a==='repairs'} className={lk}>{t}</NavLink>)} right={<><Link to="sync" className="flex items-center gap-1.5 rounded-full bg-slate-500/10 px-2.5 py-1 text-xs font-semibold"><span className={`h-2 w-2 rounded-full ${!s.on?'bg-red-500':s.p||s.c?'animate-pulse bg-amber-500':'bg-emerald-500'}`}/><span className="hidden sm:inline">{s.on?'Online':'Offline'} · </span>{s.c?s.c+' conflicts':s.p?s.p+' to sync':'synced'}</Link><Theme/><button className="text-xs text-slate-500" onClick={()=>{sessionStorage.removeItem('u');setU(null)}}>Exit</button></>}/><Outlet/></Bg></UserCtx.Provider>}
export default function App(){return <BrowserRouter><Routes><Route element={<Public/>}><Route index element={<Home/>}/><Route path="shop" element={<Shop/>}/><Route path="contact" element={<Contact/>}/><Route path="repair" element={<Track/>}/><Route path="purchases" element={<Purchases/>}/><Route path="track" element={<Navigate to="/repair" replace/>}/></Route>
 <Route path="staff" element={<Staff/>}><Route index element={<Navigate to="pos" replace/>}/><Route path="pos" element={<Pos/>}/><Route path="inventory" element={<Inventory/>}/><Route path="repairs" element={<Repairs/>}/><Route path="repairs/new" element={<NewTicket/>}/><Route path="crm" element={<Crm/>}/><Route path="claims" element={<Claims/>}/><Route path="cash" element={<Cash/>}/><Route path="reports" element={<Reports/>}/><Route path="sync" element={<SyncPage/>}/></Route></Routes></BrowserRouter>}
