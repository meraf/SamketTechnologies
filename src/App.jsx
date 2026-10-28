import {useState,useEffect} from 'react'
import {BrowserRouter,Routes,Route,Link,NavLink,Outlet,Navigate,useLocation,useNavigate} from 'react-router-dom'
import {useSync,setCfg,sync} from './db'
import {applyManifest,InstallButton} from './pwa'
import {UserCtx,can,Card,Btn,Sel,In} from './ui'
import {S} from './catalogue'
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
const Bar=({items,right,extra,home='/'})=>{const [open,setOpen]=useState(false),bar='h-0.5 w-4 bg-current'
 return <><header className="sticky top-2 z-40 mx-2 mt-2 flex items-center gap-2 rounded-3xl border border-white/30 bg-white/70 px-3 py-2 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/70 sm:mx-auto sm:max-w-6xl sm:px-4">
  <button aria-label="Menu" onClick={()=>setOpen(true)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-500/10 lg:hidden"><span className="grid gap-1"><i className={bar}/><i className={bar}/><i className={bar}/></span></button>
  <Link to={home} className="shrink-0 text-lg font-extrabold tracking-tight">SAMKET<span className="text-orange-500">.</span></Link>
  <nav className="hidden min-w-0 flex-1 flex-wrap justify-center gap-1 lg:flex">{items.map(([t,l,e])=><NavLink key={t} to={t} end={e} className={lk}>{l}</NavLink>)}</nav><div className="ml-auto flex shrink-0 items-center gap-2">{right}</div></header>
  <div className={`fixed inset-0 z-50 lg:hidden ${open?'':'pointer-events-none'}`} aria-hidden={!open}><div onClick={()=>setOpen(false)} className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${open?'opacity-100':'opacity-0'}`}/>
   <aside className={`absolute left-0 top-0 flex h-full w-72 max-w-[84%] flex-col gap-1 overflow-y-auto border-r border-white/10 bg-white p-4 shadow-2xl transition-transform duration-300 ease-out dark:bg-slate-900 ${open?'translate-x-0':'-translate-x-full'}`}><div className="mb-4 flex items-center"><span className="flex-1 text-lg font-extrabold">SAMKET<span className="text-orange-500">.</span></span><button aria-label="Close menu" onClick={()=>setOpen(false)} className="grid h-9 w-9 place-items-center rounded-full bg-slate-500/10">✕</button></div>
    {items.map(([t,l,e])=><NavLink key={t} to={t} end={e} onClick={()=>setOpen(false)} className={({isActive})=>`rounded-xl px-4 py-3 text-base font-semibold transition ${isActive?'bg-gradient-to-br from-orange-500 to-pink-600 text-white':'hover:bg-slate-500/10'}`}>{l}</NavLink>)}<div className="mt-auto pt-4">{extra}</div></aside></div></>}
const pn=[['/','Home',true],['/shop','Shop'],['/repair','Repairs'],['/purchases','My purchases'],['/contact','Contact']]
const Foot=()=><footer className="mx-auto mt-16 w-full max-w-6xl border-t border-slate-400/20 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-10 sm:px-6"><div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
 <div className="sm:col-span-2 lg:col-span-1"><Link to="/" className="text-xl font-extrabold tracking-tight">SAMKET<span className="text-orange-500">.</span></Link><p className="mt-2 max-w-xs text-sm text-slate-500">Phones and computers, sold and repaired properly.</p></div>
 <div><h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Explore</h4><ul className="space-y-1 text-sm">{pn.map(([t,l])=><li key={t}><Link className="transition hover:text-orange-500" to={t}>{l}</Link></li>)}</ul></div>
 <div className="min-w-0"><h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Visit</h4><p className="break-words text-sm text-slate-500">{S.addr}</p><a className="mt-1 block break-all text-sm transition hover:text-orange-500" href={'tel:'+S.phone}>{S.phone}</a></div>
 <div className="min-w-0"><h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Hours</h4><p className="break-words text-sm text-slate-500">{S.hrs}</p></div></div>
 <div className="mt-8 flex flex-col gap-1 border-t border-slate-400/20 pt-5 text-sm text-slate-500 sm:flex-row sm:justify-between"><span>© {new Date().getFullYear()} Samket Technologies</span><span>Powered by Mafi Technologies</span></div></footer>
function Public(){return <Bg><Bar items={pn} right={<><InstallButton label="Install Samket"/><Theme/></>}/><Outlet/><Foot/></Bg>}
// Keeps <link rel="manifest"> pointing at the client or staff manifest for the current area.
function ManifestSync(){const {pathname}=useLocation();useEffect(()=>{applyManifest(pathname)},[pathname]);return null}
const PINS={cashier:'1111',admin:'9999'}
const sessionUser=()=>JSON.parse(sessionStorage.u||'null')
// /staff/login is the staff PWA's start_url
function StaffLogin(){const [r,setR]=useState('cashier'),[p,setP]=useState(''),nav=useNavigate(),loc=useLocation()
 if(sessionUser())return <Navigate to={loc.state?.from||'/staff/pos'} replace/>
 const go=()=>p===(localStorage['pin_'+r]||PINS[r])?(sessionStorage.u=JSON.stringify({role:r}),sync(),nav(loc.state?.from||'/staff/pos',{replace:true})):setP('')
 const set=k=>({defaultValue:localStorage[k]||'',onChange:e=>setCfg(k,e.target.value)})
 return <Bg><Bar items={[]} home="/staff/login" right={<><InstallButton label="Install Staff app"/><Theme/></>}/><div className="grid min-h-[70vh] place-items-center p-3"><Card className="w-full max-w-sm"><h1 className="mb-4 text-2xl font-extrabold">Staff sign in</h1><Sel label="Role" o={Object.keys(PINS)} value={r} onChange={e=>setR(e.target.value)}/><div className="mt-3"><In label="PIN" type="password" inputMode="numeric" value={p} onChange={e=>setP(e.target.value)} onKeyDown={e=>e.key==='Enter'&&go()}/></div><Btn className="mt-4 w-full" onClick={go}>Unlock</Btn>
  <details className="mt-4 text-sm"><summary className="cursor-pointer font-semibold text-slate-500">Device settings</summary><div className="mt-2 space-y-3"><In label="Server URL (blank = this site)" {...set('surl')}/><In label="Sync key (needed once per device if the owner changed it)" type="password" {...set('skey')}/></div></details></Card></div></Bg>}
const sn=[['pos','Sell'],['inventory','Stock','stock'],['repairs','Repairs'],['repairs/new','New ticket','newticket'],['crm','Customers'],['claims','Claims'],['cash','Cash'],['reports','Reports'],['sync','Sync']]
function Staff(){const [u,setU]=useState(sessionUser),s=useSync(),loc=useLocation()
 if(!u)return <Navigate to="/staff/login" replace state={{from:loc.pathname}}/>
 const out=()=>{sessionStorage.removeItem('u');setU(null)}
 // Sync runs silently in the background for everyone; only admins get the indicator and the Sync page.
 const admin=u.role==='admin'
 return <UserCtx.Provider value={u}><Bg><Bar home="/staff/pos" items={sn.filter(([a,,p])=>can(u,p||a)).map(([a,t])=>[a,t,a==='repairs'])} extra={<button className="w-full rounded-xl border border-slate-400/30 px-4 py-3 text-sm font-semibold" onClick={out}>Sign out ({u.role})</button>} right={<>{admin&&<Link to="sync" className="flex items-center gap-1.5 rounded-full bg-slate-500/10 px-2.5 py-1 text-xs font-semibold"><span className={`h-2 w-2 rounded-full ${!s.on?'bg-red-500':s.p||s.c||s.o?'animate-pulse bg-amber-500':'bg-emerald-500'}`}/><span className="hidden sm:inline">{s.on?'Online':'Offline'} · </span>{s.c?s.c+' conflicts':s.p||s.o?(s.p+s.o)+' to sync':'synced'}</Link>}<InstallButton label="Install Staff app"/><Theme/><button className="hidden text-xs text-slate-500 lg:block" onClick={out}>Exit</button></>}/><Outlet/></Bg></UserCtx.Provider>}
export default function App(){return <BrowserRouter><ManifestSync/><Routes><Route element={<Public/>}><Route index element={<Home/>}/><Route path="shop" element={<Shop/>}/><Route path="contact" element={<Contact/>}/><Route path="repair" element={<Track/>}/><Route path="purchases" element={<Purchases/>}/><Route path="track" element={<Navigate to="/repair" replace/>}/></Route>
 <Route path="staff/login" element={<StaffLogin/>}/>
 <Route path="staff" element={<Staff/>}><Route index element={<Navigate to="pos" replace/>}/><Route path="pos" element={<Pos/>}/><Route path="inventory" element={<Inventory/>}/><Route path="repairs" element={<Repairs/>}/><Route path="repairs/new" element={<NewTicket/>}/><Route path="crm" element={<Crm/>}/><Route path="claims" element={<Claims/>}/><Route path="cash" element={<Cash/>}/><Route path="reports" element={<Reports/>}/><Route path="sync" element={<SyncPage/>}/></Route></Routes></BrowserRouter>}
