import {createRoot} from 'react-dom/client'
import {applyManifest} from './pwa'
import {sync} from './db'
import App from './App'
import './index.css'
applyManifest()
createRoot(document.getElementById('root')).render(<App/>)
if('serviceWorker' in navigator&&import.meta.env.PROD)addEventListener('load',()=>{
 navigator.serviceWorker.register('/sw.js')
 navigator.serviceWorker.addEventListener('message',e=>e.data&&e.data.type==='samket-sync'&&sync()) // background sync woke the worker
})

addEventListener('keydown',e=>{const t=e.target;if(e.key!=='Enter'||e.shiftKey||e.isComposing||!t||!/^(INPUT|SELECT)$/.test(t.tagName)||/^(button|submit|checkbox|radio|file|search)$/.test(t.type)||t.closest('form'))return
 const box=t.closest('dialog,[role=dialog],.fixed,.rounded-2xl'),b=box&&[...box.querySelectorAll('button')].find(x=>!x.disabled&&x.className.includes('bg-gradient-to-br'));if(b){e.preventDefault();b.click()}})
