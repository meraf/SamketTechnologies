import {useEffect,useState} from 'react'

// Two installable apps, one codebase.
//  Client app: /manifest-client.json (start_url "/")
//  Staff app:  /manifest-staff.json  (start_url "/staff")
export const MANIFESTS={client:'/manifest-client.json',staff:'/manifest-staff.json'}
export const THEMES={client:'#0f5c46',staff:'#1E293B'}
export const TITLES={client:'Samket Technologies',staff:'Samket Technologies Staff - Portal'}
export const areaOf=p=>/^\/staff(\/|$)/.test(p)?'staff':'client'

// Swaps the manifest, theme colour and page title for the current area. Called on every route change.
export function applyManifest(path=location.pathname){
 const a=areaOf(path),href=MANIFESTS[a],cur=document.querySelector('link[rel="manifest"]')
 if(!cur||cur.getAttribute('href')!==href){
  cur&&cur.remove();const l=document.createElement('link');l.rel='manifest';l.href=href;document.head.append(l)
 }
 const t=document.querySelector('meta[name="theme-color"]');t&&t.setAttribute('content',THEMES[a]);document.title=a==='staff'?'Samket Technologies Staff - Portal':'Samket Technologies'
 document.title=TITLES[a]
}

export const isIOS=()=>/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)
export const isStandalone=()=>matchMedia('(display-mode: standalone)').matches||!!navigator.standalone

// Chrome / Android / desktop Chromium: capture the native install prompt.
let ev=null;const subs=new Set(),tell=()=>subs.forEach(f=>f())
addEventListener('beforeinstallprompt',e=>{e.preventDefault();ev=e;tell()})
addEventListener('appinstalled',()=>{ev=null;tell()})

const IOS_STEPS=[
 ['Tap the Share icon','It is in the Safari toolbar at the bottom of the screen: a square with an arrow pointing up.'],
 ['Scroll down and select "Add to Home Screen"','You may need to scroll the share sheet to find it.'],
 ['Tap "Add" in the top right corner','Samket then opens full screen from your home screen.'],
]

function IosGuide({onClose}){
 useEffect(()=>{const k=e=>e.key==='Escape'&&onClose();addEventListener('keydown',k);return()=>removeEventListener('keydown',k)},[])
 return <div className="fixed inset-0 z-[70] grid place-items-end bg-black/60 p-3 backdrop-blur-sm sm:place-items-center" onClick={onClose}>
  <div role="dialog" aria-modal="true" aria-label="Install on iPhone or iPad" onClick={e=>e.stopPropagation()} className="w-full max-w-sm rounded-3xl bg-white p-6 text-slate-900 shadow-2xl dark:bg-slate-900 dark:text-slate-100">
   <div className="flex items-center gap-3"><h3 className="flex-1 text-lg font-extrabold">Install on iPhone or iPad</h3><button aria-label="Close" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-slate-500/10">✕</button></div>
   <ol className="mt-5 space-y-4">{IOS_STEPS.map(([t,d],i)=><li key={t} className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-orange-500 to-pink-600 font-bold text-white">{i+1}</span><div className="min-w-0"><b className="block">{t}</b><span className="text-sm text-slate-500">{d}</span></div></li>)}</ol>
   <button onClick={onClose} className="mt-6 w-full rounded-full bg-slate-900 py-3 font-semibold text-white dark:bg-white dark:text-slate-900">Got it</button>
  </div></div>
}

export function InstallButton({label='Install app'}){
 const [,set]=useState(0),[guide,setGuide]=useState(false)
 useEffect(()=>{const f=()=>set(x=>x+1);subs.add(f);return()=>subs.delete(f)},[])
 if(isStandalone())return null
 if(!ev&&!isIOS())return null
 return <>
  <button type="button" className="flex items-center gap-1.5 rounded-full bg-orange-500 px-3 py-1.5 text-xs font-bold text-white shadow transition hover:brightness-110 active:scale-95"
   onClick={async()=>{
    if(!ev){setGuide(true);return}
    const e=ev;e.prompt();await e.userChoice.catch(()=>{});ev=null;tell()
   }}>⬇ {label}</button>
  {guide&&<IosGuide onClose={()=>setGuide(false)}/>}
 </>
}
