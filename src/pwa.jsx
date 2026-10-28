import {useEffect,useState} from 'react'

// ---- two installable apps, one codebase ----
//  Client app: manifest-client.json  (start_url "/")
//  Staff app:  manifest-staff.json   (start_url "/staff/login")
// The <link rel="manifest"> must point at the right file BEFORE Chrome decides what "Install" installs, so
// index.html sets it synchronously from the URL, and this switches it on every client-side route change.
export const MANIFESTS={client:'/manifest-client.json',staff:'/manifest-staff.json'}
export const THEMES={client:'#0f5c46',staff:'#0f172a'}
export const areaOf=p=>/^\/staff(\/|$)/.test(p)?'staff':'client'
export function applyManifest(path=location.pathname){
 const a=areaOf(path),href=MANIFESTS[a],cur=document.querySelector('link[rel="manifest"]')
 if(!cur||cur.getAttribute('href')!==href){ // replace the element: Chrome re-reads a freshly inserted manifest link
  cur&&cur.remove();const l=document.createElement('link');l.rel='manifest';l.href=href;document.head.append(l)}
 const t=document.querySelector('meta[name="theme-color"]');t&&t.setAttribute('content',THEMES[a])}

// ---- install button (captures the browser's install prompt) ----
let ev=null;const subs=new Set(),tell=()=>subs.forEach(f=>f())
addEventListener('beforeinstallprompt',e=>{e.preventDefault();ev=e;tell()})
addEventListener('appinstalled',()=>{ev=null;tell()})
const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone
export function InstallButton({label='Install app'}){
 const [,set]=useState(0);useEffect(()=>{const f=()=>set(x=>x+1);subs.add(f);return()=>subs.delete(f)},[])
 if(!ev||standalone())return null
 return <button className="flex items-center gap-1.5 rounded-full bg-orange-500 px-3 py-1.5 text-xs font-bold text-white shadow transition hover:brightness-110 active:scale-95" onClick={async()=>{const e=ev;e.prompt();await e.userChoice.catch(()=>{});ev=null;tell()}}>⬇ {label}</button>}
