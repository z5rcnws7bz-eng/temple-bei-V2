import React,{useState,useEffect} from 'react';
import {auditActions,auditChanges,auditValue,auditSubject} from './audit-log.js';
const blank={member:'',action:'',from:'',until:''};
const entities={profiles:'Member profile / access',hours:'Hours',shifts:'Shift',bookings:'Shift assignment',newsletters:'Newsletter',portal_waitlist:'Shift waitlist',portal_notifications:'Notification / email',portal_training:'Training resource',portal_training_progress:'Training completion'};
const timestamp=value=>new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',dateStyle:'medium',timeStyle:'medium'}).format(new Date(value));
export function AuditLog({request}){
 const [draft,setDraft]=useState(blank),[filters,setFilters]=useState(blank),[offset,setOffset]=useState(0),[revision,setRevision]=useState(0);
 const [data,setData]=useState({entries:[],members:[],total:0}),[busy,setBusy]=useState(true),[error,setError]=useState('');
 useEffect(()=>{let active=true;setBusy(true);setError('');
 request('admin/audit','POST',{...filters,offset}).then(result=>{if(active)setData(result);}).catch(err=>{if(active){setError(err.message);setData(d=>({...d,entries:[],total:0}));}}).finally(()=>{if(active)setBusy(false);});
 return()=>{active=false;};
 },[request,filters,offset,revision]);
 const update=(key,value)=>setDraft(d=>({...d,[key]:value}));
 return <section className="panel audit-panel" aria-labelledby="audit-heading">
 <div className="section-title"><div><h2 id="audit-heading">Audit log</h2><p className="muted">Who changed what and when · Admins only · Dates and times are Eastern.</p></div><button type="button" className="secondary" disabled={busy} onClick={()=>setRevision(v=>v+1)}>Refresh log</button></div>
 <form className="audit-filters" onSubmit={e=>{e.preventDefault();if(draft.from&&draft.until&&draft.from>draft.until){setError('The end date must be on or after the start date.');return;}setFilters({...draft});setOffset(0);}}>
 <label>Member<select aria-label="Member" value={draft.member} onChange={e=>update('member',e.target.value)}><option value="">All members</option>{data.members.map(m=><option key={m.id} value={m.id}>{m.name} ({m.email})</option>)}</select></label>
 <label>Action<select aria-label="Action" value={draft.action} onChange={e=>update('action',e.target.value)}><option value="">All actions</option>{Object.entries(auditActions).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
 <label>From date<input aria-label="From date" type="date" value={draft.from} onChange={e=>update('from',e.target.value)}/></label>
 <label>Through date<input aria-label="Through date" type="date" value={draft.until} min={draft.from||undefined} onChange={e=>update('until',e.target.value)}/></label>
 <div className="button-group"><button className="primary" disabled={busy}>Apply filters</button><button type="button" className="secondary" disabled={busy} onClick={()=>{setDraft(blank);setFilters({...blank});setOffset(0);}}>Clear</button></div>
 </form><p className="muted audit-help">Member matches changes made by that account or changes to their profile, hours, or assignments. History includes retained accounts.</p>
 {error&&<p className="error" role="alert">{error}</p>}
 {busy?<p role="status">Loading audit history…</p>:!error&&<>
 <p role="status" className="muted">{data.total} matching {data.total===1?'event':'events'}{data.total>0?` · Showing ${offset+1}–${Math.min(offset+25,data.total)}`:''}</p>
 {data.entries.length?<div className="audit-table-scroll" role="region" aria-label="Audit history table" tabIndex={0}><table className="audit-table"><thead><tr><th scope="col">When (Eastern)</th><th scope="col">Who</th><th scope="col">Action / record</th><th scope="col">What changed</th></tr></thead><tbody>{data.entries.map(entry=><tr key={entry.id}>
 <td><time dateTime={entry.recorded_at} title={entry.recorded_at}>{timestamp(entry.recorded_at)}</time></td>
 <td><b>{entry.actor_name||'Database / system'}</b><small>{entry.actor_email||entry.actor_role}</small><small>{entry.actor_role}</small></td>
 <td><b>{auditActions[entry.action]||entry.operation}</b><small>{entities[entry.resource_table]||entry.resource_table}</small><span>{auditSubject(entry)}</span></td>
 <td><details><summary>View changes ({auditChanges(entry.before_record,entry.after_record).length})</summary><p className="audit-id">Actor account: {entry.actor_id||`Database operation (${entry.database_role})`}<br/>Record: {entry.resource_id}</p><div className="audit-diffs">{auditChanges(entry.before_record,entry.after_record).map(change=><div key={change.field}><b>{change.field.replaceAll('_',' ')}</b><dl><dt>Before</dt><dd>{auditValue(change.before,change.field)}</dd><dt>After</dt><dd>{auditValue(change.after,change.field)}</dd></dl></div>)}</div></details></td>
 </tr>)}</tbody></table></div>:<p>No audit events match these filters.</p>}
 <div className="audit-pagination"><button type="button" className="secondary" disabled={offset===0} onClick={()=>setOffset(v=>Math.max(0,v-25))}>Previous</button><button type="button" className="secondary" disabled={offset+25>=data.total} onClick={()=>setOffset(v=>v+25)}>Next</button></div>
 </>}
 </section>;
}
