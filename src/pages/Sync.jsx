import {useDB,useSync,sync,resolve} from '../db'
import {Card,Btn,In,Sel,Tag,Page} from '../ui'
const diff=c=>Object.keys({...c.mine,...c.theirs}).filter(k=>!['ts','dev','seq','dirty'].includes(k)&&JSON.stringify(c.mine[k])!==JSON.stringify(c.theirs[k]))
export default function SyncPage(){const d=useDB(),s=useSync()
 const set=k=>({defaultValue:localStorage[k]||'',onChange:e=>{localStorage[k]=e.target.value}})
 return <Page title="Sync" right={<Btn onClick={sync}>Sync now</Btn>}><Card><div className="flex gap-2"><Tag c={s.on?'ok':'bad'}>{s.on?'Online':'Offline'}</Tag><Tag c={s.p?'warn':'ok'}>{s.p} waiting to upload</Tag><Tag c={s.c?'bad':'ok'}>{s.c} conflicts</Tag></div><p className="mt-2 text-sm text-slate-500">Everything is saved on this device first and uploaded automatically when the connection returns.</p></Card>
  {d.conflict.map(c=><Card key={c.id} className="space-y-2"><b>Edited on two devices: {c.mine.name||c.mine.code||c.mine.serial||c.doc}</b>{diff(c).map(k=><div key={k} className="grid grid-cols-3 gap-2 text-sm"><b>{k}</b><span className="rounded bg-orange-500/10 p-1">Mine: {JSON.stringify(c.mine[k])}</span><span className="rounded bg-violet-500/10 p-1">Theirs: {JSON.stringify(c.theirs[k])}</span></div>)}<div className="flex gap-2"><Btn onClick={()=>resolve(c,'mine')}>Keep mine</Btn><Btn v="g" onClick={()=>resolve(c,'theirs')}>Take theirs</Btn></div></Card>)}
  <Card className="grid gap-3 sm:grid-cols-2"><In label="Server URL (blank = this site)" {...set('surl')}/><In label="Sync key" {...set('skey')}/><Sel label="Receipt paper" o={['80','58']} defaultValue={localStorage.rw||'80'} onChange={e=>{localStorage.rw=e.target.value}}/>
   {['cashier','admin'].map(r=><In key={r} label={r+' PIN'} {...set('pin_'+r)}/>)}</Card></Page>}
