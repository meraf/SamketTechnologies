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
