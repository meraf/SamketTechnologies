import {useEffect,useState} from 'react'
import {In} from './ui'
import {normPhone,phoneOk} from '../lib/phone.js'

/** Live phone lookup (debounced). st: idle | checking | A (known, has password) | B (known, no password) | C (new) | offline */
export function usePhoneCheck(phone){
 const [st,setSt]=useState('idle')
 useEffect(()=>{
  if(!phoneOk(phone)){setSt('idle');return}
  setSt('checking');let dead=0
  const t=setTimeout(async()=>{try{
   const r=await fetch('/api/auth/check-phone',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({phone:normPhone(phone)})})
   if(!r.ok)throw 0;const j=await r.json();!dead&&setSt(!j.exists?'C':j.hasPassword?'A':'B')
  }catch{!dead&&setSt('offline')}},450)
  return()=>{dead=1;clearTimeout(t)}},[phone])
 return st}

const Hint=({c='slate',children})=><p className={`rounded-xl p-2.5 text-xs ${{slate:'bg-slate-500/10 text-slate-500',ok:'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',warn:'bg-amber-500/10 text-amber-700 dark:text-amber-400'}[c]}`}>{children}</p>

/** Password field that adapts to what we know about the phone number.
 *  mode "ticket": opening a repair request.  mode "history": viewing the account history. */
export function PasswordFor({st,mode='ticket',value,onChange}){
 const f={type:'password',value,onChange:e=>onChange(e.target.value),autoComplete:'current-password'}
 if(st==='idle')return null
 if(st==='checking')return <Hint>Checking this number…</Hint>
 if(st==='A')return <div className="space-y-2"><Hint c="ok">Welcome back. This number already has an account{mode==='ticket'?', your new request will be added to your history':''}.</Hint><In label="Password *" required {...f}/></div>
 if(st==='B')return <div className="space-y-2"><Hint c="warn">We found earlier activity for this number. {mode==='history'?'Create a password to claim and secure it.':'Create a password to claim and secure your history (optional).'}</Hint><In label={mode==='history'?'Create a password * (min 4)':'Create a password (optional, min 4)'} required={mode==='history'} {...f} autoComplete="new-password"/></div>
 if(st==='C')return mode==='history'?<Hint>No history for this number yet. Open a repair request first, or visit the shop.</Hint>:<div className="space-y-2"><Hint>New number: we will create your profile. A password is optional but lets you see your history later.</Hint><In label="Password (optional, min 4)" {...f} autoComplete="new-password"/></div>
 return <div className="space-y-2"><Hint>You are offline. We will check this number when you reconnect.</Hint><In label="Password (optional)" {...f} autoComplete="new-password"/></div>}
