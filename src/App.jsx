import {AuditLog} from './AuditLog.jsx';
import {matchesAccountState} from './account-state.js';
import {totalHours} from './hours.js';
import {NewsletterArticle,NewsletterForm} from './Newsletter.jsx';
import {canEditNewsletter} from './newsletter-links.js';
import React, {useState,useEffect,useRef,useMemo,useCallback} from 'react';
import {PiHouseFill,PiClock,PiCalendarDots,PiUsersFill,PiStar,PiPlus,PiArrowRight,PiDotsThreeVerticalBold,PiX,PiCheck,PiTrash,PiPencilSimple,PiDownloadSimple,PiArrowCounterClockwise,PiMagnifyingGlass,PiList,PiMapPin,PiArrowLeft,PiAppleLogoFill,PiLockKeyFill,PiEnvelopeSimple,PiBellFill,PiArrowsLeftRight,PiUserPlus,PiUserMinus} from 'react-icons/pi';
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import './styles.css';
import {availabilityForShift} from './availability.js';
import {prepareProfilePhoto} from './profile-photo.js';
import {isLoginRoute,portalDestination} from './routing.js';
import {isSupabaseConfigured,supabasePortalRequest,acceptEmailLink,requestPasswordReset,setAccountPassword,getStoredSession,signInWithPassword,signUp,signOut as supabaseSignOut,updateSupabaseProfile,confirmLocalEmail,fetchSupabaseProfile} from './supabase.js';
import {signInWithApple,isAppleConfigured} from './appleAuth.js';
import {CookieBanner,PrivacyPolicyContent,TermsOfServiceContent,CookieSettingsContent} from './legal.jsx';
const activities=['Brain exercise session','Reading session','Volunteer training','Chapter event'];
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
let boardCredentials = null;
async function portalApi(path,method='GET',body){
  if(import.meta.env.PROD&&isSupabaseConfigured())return supabasePortalRequest(path,method,body);
  const headers={};
  if(method!=='GET')headers['Content-Type']='application/json';
  if(boardCredentials){
    headers['x-board-username']=boardCredentials.username;
    headers['x-board-password']=boardCredentials.password;
  }
  const session=getStoredSession();
  if(session?.user){
    headers['oai-authenticated-user-id']=session.user.id;
    headers['oai-authenticated-user-email']=session.user.email;
    headers['oai-authenticated-user-full-name']=session.user.name;
  }
  const r=await fetch('/api/'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),credentials:'same-origin'});
  const v=await r.json();
  if(!r.ok)throw Object.assign(new Error(v.error||'Request failed.'),{status:r.status});
  return v;
}
const empty={hours:[],shifts:[],trash:[],history:[],newsletters:[],availability:['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(day=>({day,enabled:false,start:'14:00',end:'17:00'}))};
function DateStamp({date,weekday=false}){const d=new Date(date+'T12:00:00');return <div className={'date-stamp '+(weekday?'large':'')}>{weekday&&<span>{d.toLocaleDateString('en-US',{weekday:'short'})}</span>}<span>{d.toLocaleDateString('en-US',{month:'short'})}</span><strong>{d.getDate()}</strong><span>{d.getFullYear()}</span></div>}
const time=t=>new Date('2000-01-01T'+t).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
const fmt=n=>Number(n).toLocaleString('en-US',{maximumFractionDigits:2});
function getShiftTimeInfo(s){
 if(!s||!s.date||!s.start)return {isPast:false,isToday:false,isUpcoming:false,isLocked:false,diffHours:999};
 const todayStr=today();
 const isPast=s.date<todayStr;
 const isToday=s.date===todayStr;
 const isUpcoming=s.date>todayStr;
 const [y,m,d]=s.date.split('-').map(Number);
 const [hh,mm]=s.start.split(':').map(Number);
 const shiftStart=new Date(y,m-1,d,hh,mm);
 const diffHours=(shiftStart.getTime()-Date.now())/(1000*60*60);
 const isLocked=diffHours<=4;
 return {isPast,isToday,isUpcoming,isLocked,diffHours,shiftStart};
}
function App(){
 const [data,setData]=useState(empty),[page,setPage]=useState(()=>{const section=new URLSearchParams(window.location.search).get('section');return ['E-board','Admin','Scheduling','Shifts'].includes(section)?(section==='Shifts'?'Scheduling':section):'Overview'}),[modal,setModal]=useState(()=>{const p=typeof window!=='undefined'?window.location.pathname:'';if(p==='/privacy')return {type:'privacy'};if(p==='/terms')return {type:'terms'};if(p==='/cookies')return {type:'cookies'};return null;}),[toast,setToast]=useState(''),[menu,setMenu]=useState(null),[query,setQuery]=useState(''),[filter,setFilter]=useState('All'),[shiftFilter,setShiftFilter]=useState('All'),[shiftSearch,setShiftSearch]=useState(''),[mobile,setMobile]=useState(false),[role,setRole]=useState('volunteer');
 const [draftAvailability,setDraftAvailability]=useState(data.availability),[availTab,setAvailTab]=useState('mine');
 const [user,setUser]=useState(null),[loading,setLoading]=useState(true),[loadError,setLoadError]=useState(''),[boardData,setBoardData]=useState({hours:[],newsletters:[]}),[rosterData,setRosterData]=useState([]),[registeredMembers,setRegisteredMembers]=useState([]),[members,setMembers]=useState([]),[directory,setDirectory]=useState([]),[directoryLoading,setDirectoryLoading]=useState(false),[directoryError,setDirectoryError]=useState(''),[directorySearch,setDirectorySearch]=useState(''),[profileLoading,setProfileLoading]=useState(false);
 const api=useCallback(async(path,method='GET',body)=>{
  if(method!=='GET'&&!matchesAccountState(user?.id,getStoredSession()?.user?.id,user?.id))throw new Error('Your signed-in account changed. Refresh this page before making changes.');
  return portalApi(path,method,body);
 },[user?.id]);
 const toastTimer=useRef();
 useEffect(()=>{
  const query=window.matchMedia('(max-width:1024px)');
  const closeOnWide=()=>{if(!query.matches)setMobile(false);};
  query.addEventListener('change',closeOnWide);
  return()=>query.removeEventListener('change',closeOnWide);
 },[]);
 useEffect(()=>{
  if(!mobile)return;
  const previous=document.body.style.overflow;
  document.body.style.overflow='hidden';
  const close=e=>{if(e.key==='Escape')setMobile(false);};
  window.addEventListener('keydown',close);
  document.getElementById('chapter-navigation')?.querySelector('button')?.focus();
  return()=>{document.body.style.overflow=previous;window.removeEventListener('keydown',close);if(window.matchMedia('(max-width:1024px)').matches)document.querySelector('.mobile-menu')?.focus();};
 },[mobile]);

 const rosterMap=useMemo(()=>{
  const map={};
  for(const r of rosterData){
   if(!map[r.shift_id])map[r.shift_id]=[];
   map[r.shift_id].push(r);
  }
  return map;
 },[rosterData]);



 async function refresh(){
  const session=getStoredSession();
  if(!session){
   setUser(null);
   setLoadError('');
   return;
  }
  try{
   const d=await api('state');
   if(!matchesAccountState(session.user?.id,getStoredSession()?.user?.id,d.user?.id))return;
   const currentUser={...session.user,...d.user,name:d.user?.name||session.user.name,eboard:!!d.user?.eboard};
   setData({...empty,...d});
   setUser(currentUser);
   setDraftAvailability(d.availability);
   if(d.roster)setRosterData(d.roster);
   setLoadError('');
  }catch(e){
   if(getStoredSession()?.user?.id!==session.user?.id)return;
   if(e.status===401||e.status===403){
    setUser(null);
    setLoadError('');
   }else{
    if(import.meta.env.DEV&&isSupabaseConfigured()&&session?.user){
     try{
      const supaProfile=await fetchSupabaseProfile(session.user.id);
      const currentUser={...session.user,name:supaProfile?.name||session.user.name,admin:session.user.admin===true,eboard:!!supaProfile?.eboard};
      setUser(currentUser);
      setData(d=>({...empty,...d,profile:supaProfile||{name:currentUser.name,email:currentUser.email,major:'',year:'',bio:'',availability:[]}}));
      setLoadError('');
      return;
     }catch(supaErr){}
    }
    setLoadError(e.message);
   }
  }
 }
 async function openShiftPlanner(){try{await loadBoard();setModal({type:'shift'});}catch(e){notify('Could not load saved member availability: '+e.message);}}
 async function loadBoard(){
  const d=await api('board');
  setBoardData(d);
  if(d.roster)setRosterData(d.roster);
  if(d.members)setRegisteredMembers(d.members);
 }
 const isEboard=!!(user?.admin||user?.eboard||role==='board');
 const isAdmin=!!user?.admin;
 async function loadSchedulingData(){
  if(isEboard){
   try{
    const b=await api('board');
    if(b.roster)setRosterData(b.roster);
    if(b.members)setRegisteredMembers(b.members);
   }catch(e){}
  }
  if(directory.length===0){
   api('directory').then(v=>{if(v.members)setDirectory(v.members)}).catch(()=>{});
  }
 }
 async function act(path,method,body,message){try{await api(path,method,body);await refresh();if(page==='E-board'||page==='Admin')await loadBoard();if(page==='Scheduling'||page==='Shifts')await loadSchedulingData();notify(message);return true;}catch(e){notify(e.message);return false;}}
 useEffect(()=>{refresh().catch(e=>setLoadError(e.message)).finally(()=>setLoading(false));},[]);
 useEffect(()=>{
  const sync=e=>{if(e?.type==='storage'&&e.key!=='temple_bei_supabase_session')return;if(getStoredSession()?.user?.id!==user?.id)refresh().catch(e=>setLoadError(e.message));};
  window.addEventListener('storage',sync);window.addEventListener('focus',sync);
  return()=>{window.removeEventListener('storage',sync);window.removeEventListener('focus',sync);};
 },[user?.id]);
 useEffect(()=>{
  if((page==='E-board'||page==='Admin')&&isEboard)loadBoard().catch(e=>{if(!user?.eboard&&!user?.admin){setRole('volunteer');boardCredentials=null;notify(e.message)}});
  if((page==='Admin'&&isAdmin)||(page==='E-board'&&isEboard))api('admin').then(v=>setMembers(v.members)).catch(e=>notify(e.message));
 },[page,isEboard,isAdmin]);
 useEffect(()=>{
  if(user&&!loading){
   if(page==='Admin'&&!isAdmin)go('Overview');
   if(page==='E-board'&&!isEboard)go('Overview');
  }
 },[page,isEboard,isAdmin,user,loading]);
 useEffect(()=>{if(page!=='Newsletter')return;const reload=()=>refresh().catch(e=>notify(e.message));reload();window.addEventListener('focus',reload);const timer=setInterval(reload,60000);return()=>{window.removeEventListener('focus',reload);clearInterval(timer);};},[page]);
 useEffect(()=>{if(page==='Scheduling'||page==='Shifts'||page==='Availability')loadSchedulingData();},[page,isEboard]);
 useEffect(()=>{
  if(page!=='Member directory')return;
  let active=true;
  setDirectoryLoading(true);
  setDirectoryError('');
  let requestNumber=0;
  async function loadDir(){
   const request=++requestNumber;
   try{
    const v=await api('directory');
    if(!Array.isArray(v?.members))throw new Error('The member directory could not be loaded.');
    if(active&&request===requestNumber){
     setDirectory(v.members);
     setDirectoryError('');
    }
   }catch(err){
    if(active&&request===requestNumber){setDirectory([]);setDirectoryError(err.message);}
   }finally{
    if(active&&request===requestNumber)setDirectoryLoading(false);
   }
  }
  const onFocus=()=>loadDir();
  const onVisibility=()=>{if(document.visibilityState==='visible')loadDir();};
  loadDir();
  window.addEventListener('focus',onFocus);
  document.addEventListener('visibilitychange',onVisibility);
  return()=>{active=false;window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onVisibility);};
 },[page]);
 async function openMember(id){
  setProfileLoading(true);
  try{
   const v=await api('directory/'+encodeURIComponent(id));
   const member=v?.member;
   if(member){
    setModal({type:'member',entry:member});
   }else{
    notify('This member profile is unavailable.');
   }
  }catch(e){
   notify(e.message);
  }finally{
   setProfileLoading(false);
  }
 }
 function notify(msg){setToast(msg);clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(''),4500)}
 function go(p){const target=p==='Shifts'?'Scheduling':p;setPage(target);setMobile(false);setFilter('All');setShiftFilter('All');setQuery('');setShiftSearch('');setMenu(null)}
 const sum=status=>totalHours(data.hours,status);
 const sorted=[...data.hours].sort((a,b)=>b.date.localeCompare(a.date));
 const visible=sorted.filter(h=>(filter==='All'||h.status===filter)&&[h.activity,h.facility,h.date].join(' ').toLowerCase().includes(query.toLowerCase()));
 const next=data.shifts.filter(s=>s.mine&&s.date>=today()).sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start))[0];
 async function logHours(h){if(await act('hours','POST',h,(isAdmin||user.eboard)?'Hours saved and automatically approved.':'Hours submitted for approval.'))setModal(null);}
 async function remove(h){if(await act('hours/remove','POST',{id:h.id},'Entry removed. It can be restored from Removed entries.'))setModal(null);}
 async function review(h,status,reason=''){if(await act('board/review','POST',{id:h.id,status,reason},status==='Approved'?'Hours approved. Totals updated.':'Entry returned with feedback.'))setModal(null);}
 async function pickup(s){await act('shifts/book','POST',{id:s.id},'Shift added to your schedule.');}
 async function drop(s){
  const {isLocked}=getShiftTimeInfo(s);
  if(isLocked&&!user?.admin){
   setModal({type:'shift-locked',shift:s});
   return;
  }
  if(await act('shifts/drop','POST',{id:s.id},'Shift dropped. Your spot is available again.'))setModal(null);
 }
 async function assignMemberToShift(shiftId,memberId){
  const ok=await act('board/shifts/assign','POST',{shiftId,memberId},'Member assigned to shift.');
  if(ok)await loadSchedulingData();
  return ok;
 }
 async function removeMemberFromShift(shiftId,memberId){
  const ok=await act('board/shifts/remove','POST',{shiftId,memberId},'Member removed from shift.');
  if(ok)await loadSchedulingData();
  return ok;
 }
 async function swapMembersInShift(shiftId,memberOut,memberIn){
  const ok=await act('board/shifts/swap','POST',{shiftId,memberOut,memberIn},'Member switched successfully.');
  if(ok)await loadSchedulingData();
  return ok;
 }
 function notifyVolunteers(s){
  const assigned=rosterMap[s.id]||[];
  const emails=assigned.map(m=>m.email).filter(Boolean);
  if(!emails.length)return notify('No volunteer emails found for this shift.');
  const subject=`Temple BEI Volunteer Session: ${s.facility} (${s.date})`;
  const body=`Hi Team,\n\nThis is an update regarding your scheduled Temple BEI volunteer shift.\n\nFacility: ${s.facility}\nDate: ${s.date}\nTime: ${time(s.start)} – ${time(s.end)}\nActivity: ${s.activity}\n\nPlease arrive 10 minutes prior to session start.\n\nTemple BEI Executive Board`;
  const a=document.createElement('a');
  a.href=`mailto:${emails.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  a.click();
  notify(`Notification email prepared for ${emails.length} volunteer(s).`);
 }
 function sendShiftReminder(s){
  const assigned=rosterMap[s.id]||[];
  const emails=assigned.map(m=>m.email).filter(Boolean);
  if(!emails.length)return notify('No volunteer emails found for this shift.');
  const subject=`Reminder: Temple BEI Volunteer Shift tomorrow at ${s.facility}`;
  const body=`Hi Team,\n\nReminder of your upcoming BEI volunteer shift tomorrow.\n\nFacility: ${s.facility}\nDate: ${s.date}\nTime: ${time(s.start)} – ${time(s.end)}\nActivity: ${s.activity}\n\nPlease arrive 10 minutes prior to session start.\n\nThank you for volunteering with Temple BEI!\n\nTemple BEI Executive Board`;
  const a=document.createElement('a');
  a.href=`mailto:${emails.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  a.click();
  notify(`Shift reminder email prepared for ${emails.length} volunteer(s).`);
 }
 function exportCSV(){
  const sanitize=v=>{const s=String(v??'');return/^[=+\-@\t\r]/.test(s)?"'"+s.replaceAll('"','""'):s.replaceAll('"','""')};
  const rows=[['Date','Activity','Facility','Hours','Status','Reviewed by'],...visible.map(h=>[h.date,h.activity,h.facility,h.hours,h.status,h.reviewer])];
  const csv=rows.map(r=>r.map(x=>'"'+sanitize(x)+'"').join(',')).join('\r\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download='bei-volunteer-hours.csv';
  a.click();
  URL.revokeObjectURL(a.href);
  notify('Hours exported.');
 }
 function exportScheduleCSV(){
  if(!user?.admin)return notify('Only the chapter administrator can export master schedule data.');
  const sanitize=v=>{const s=String(v??'');return/^[=+\-@\t\r]/.test(s)?"'"+s.replaceAll('"','""'):s.replaceAll('"','""')};
  const rows=[
   ['Shift ID','Date','Start Time','End Time','Facility','Activity','Capacity','Spots Taken','Spots Remaining','Status','Drop Locked (<=4h)','Assigned Volunteers'],
   ...data.shifts.map(s=>{
    const {isPast,isToday,isLocked}=getShiftTimeInfo(s);
    const status=isPast?'Previous (Past)':(isToday?'Present (Today)':'Upcoming (Future)');
    const assigned=(rosterMap[s.id]||[]).map(m=>`${m.name}${m.email?' <'+m.email+'>':''}`).join('; ');
    return [
     s.id,
     s.date,
     s.start,
     s.end,
     s.facility,
     s.activity,
     s.capacity,
     s.taken,
     Math.max(0,s.capacity-s.taken),
     status,
     isLocked?'Yes':'No',
     assigned||'None'
    ];
   })
  ];
  const csv=rows.map(r=>r.map(x=>'"'+sanitize(x)+'"').join(',')).join('\r\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download=`temple-bei-master-schedule-${today()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  notify('Master schedule CSV exported.');
 }
 const nav=[['Overview',PiHouseFill],['My hours',PiClock],['Scheduling',PiCalendarDots],['Availability',PiUsersFill],['Newsletter',PiPencilSimple],['Member directory',PiUsersFill],['Profile',PiUsersFill],...(isEboard?[['E-board',PiStar]]:[]),...(isAdmin?[['Admin',PiStar]]:[])];
 function HoursTable({rows}){return <div className="table-scroll" role="region" aria-label="Volunteer hours table" tabIndex={0}><table><thead><tr><th>Date</th><th>Activity & facility</th><th>Hours</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{rows.map(h=><tr key={h.id}><td><DateStamp date={h.date}/></td><td><b>{h.activity}</b><small>{h.facility}</small>{h.reason&&<small className="feedback">Feedback: {h.reason}</small>}</td><td className="hours-cell">{fmt(h.hours)} h</td><td><span className={'badge '+h.status.toLowerCase()}>{h.status}</span><small>{h.status==='Pending'?'Awaiting e-board review':h.status==='Returned'?'Please update your entry':`By ${h.reviewer}`}</small></td><td className="action-cell"><button className="icon-button" aria-label={'Actions for '+h.date+' '+h.activity} aria-expanded={menu===h.id} onClick={()=>setMenu(menu===h.id?null:h.id)}><PiDotsThreeVerticalBold/></button>{menu===h.id&&<div className="row-menu"><button onClick={()=>{setModal({type:'hours',entry:h});setMenu(null)}}><PiPencilSimple/> Edit entry</button><button className="danger-text" onClick={()=>{setModal({type:'remove',entry:h});setMenu(null)}}><PiTrash/> Remove entry</button></div>}</td></tr>)}</tbody></table>{rows.length===0&&<div className="empty"><PiClock/><h3>No hours here yet</h3><p>Log a session or adjust your filters.</p><button className="primary" onClick={()=>setModal({type:'hours'})}><PiPlus/> Log hours</button></div>}</div>}
 if(loading)return <div className="login-shell"><img src="/assets/bei-logo.png" alt="BEI Temple University"/><h1>Welcome to your BEI hub.</h1><p>Loading your member profile…</p></div>;
 if(!user||isLoginRoute(window.location.pathname))return <LoginPage user={user} error={loadError} onRetry={()=>{setLoading(true);refresh().catch(e=>setLoadError(e.message)).finally(()=>setLoading(false))}} onAuthSuccess={async s=>{setUser(s.user);await refresh();}} onSignOut={async ()=>{await supabaseSignOut();setUser(null);await refresh();}}/>;
 return <><div className="checker"/><button className="mobile-menu icon-button" aria-label={mobile?"Close navigation":"Open navigation"} aria-expanded={mobile} aria-controls="chapter-navigation" onClick={()=>setMobile(!mobile)}><PiList/></button>{mobile&&<button type="button" className="nav-scrim" aria-label="Close navigation overlay" onClick={()=>setMobile(false)}/>}
 <aside className={mobile?'sidebar open':'sidebar'}><button className="brand" aria-label="BEI overview" onClick={()=>go('Overview')}><img src="/assets/bei-logo.png" alt="BEI Temple University — Brain Exercise Initiative"/></button><nav id="chapter-navigation" aria-label="Main navigation">{nav.map(([name,Icon])=><button key={name} className={page===name?'nav-item selected':'nav-item'} aria-current={page===name?'page':undefined} onClick={()=>go(name)}><Icon/>{name}</button>)}</nav><div className="profile"><span className="avatar">{data.profile?.photo_data_url?<img className="member-photo" src={data.profile.photo_data_url} alt="Your profile"/>:user.name.split(' ').map(v=>v[0]).slice(0,2).join('').toUpperCase()}</span><div><b>{user.name}</b><small>{[user.admin?'Administrator':user.eboard?'E-board Officer':'BEI volunteer',data.profile?.chapter_title].filter(Boolean).join(' · ')}</small></div></div></aside>
 <main inert={mobile}><header className="page-header"><div><p className="eyebrow">{page==='Overview'?'Welcome back, '+user.name.split(' ')[0]:'Temple University · BEI'}</p><h1>{page==='Overview'?'A little time. A lasting difference.':page==='My hours'?'Every hour makes an impact.':(page==='Scheduling'||page==='Shifts')?'Volunteer Scheduling & Shifts':page==='Availability'?'Make room for doing good.':page==='Newsletter'?'Good things, worth sharing.':page==='Member directory'?'Meet the people making a difference.':page==='Profile'?'Your place in the chapter.':page==='Admin'?'Your chapter. Your workspace.':'A little leadership. A lasting impact.'}</h1></div><img className="mascot" src="/assets/temple-bei-mascot.png" alt="Temple BEI brain mascot wearing a Temple cap and lifting weights"/></header>
 {page==='Overview'&&<><section className="overview-grid"><div className="summary"><h2>Your approved hours</h2><div className="big-number">{fmt(sum('Approved'))}<span> h</span></div><p className="pending-line"><b>{fmt(sum('Pending'))} h</b> pending approval</p><button className="primary log-button" onClick={()=>setModal({type:'hours'})}><PiPlus/> Log hours</button></div><div className="next-shift panel"><h2>Your next shift</h2>{next?<div className="next-details"><DateStamp date={next.date} weekday/><div className="shift-detail"><p>{time(next.start)} – {time(next.end)}</p><h3>{next.facility}</h3><p className="muted">{next.activity}</p><button className="text-link" onClick={()=>go('Scheduling')}>View shifts <PiArrowRight/></button></div></div>:<div className="no-shift"><p>Your next good thing is waiting.</p><button className="text-link" onClick={()=>go('Scheduling')}>Find a shift <PiArrowRight/></button></div>}</div></section><section className="panel recent"><div className="section-title"><h2>Recent hours</h2><button className="text-link" onClick={()=>go('My hours')}>View all <PiArrowRight/></button></div><HoursTable rows={sorted.slice(0,3)}/><div className="table-note">Your volunteer records · {new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'America/New_York'})}</div></section></>}
 {page==='My hours'&&<><div className="page-toolbar"><div className="inline-totals"><span><b>{fmt(sum('Approved'))} h</b> approved</span><span><b>{fmt(sum('Pending'))} h</b> pending</span></div><div className="button-group"><button className="secondary" onClick={exportCSV}><PiDownloadSimple/> Export CSV</button><button className="primary" onClick={()=>setModal({type:'hours'})}><PiPlus/> Log hours</button></div></div><section className="panel"><div className="filter-bar"><div className="tabs" aria-label="Filter hours">{['All','Approved','Pending','Returned'].map(v=><button className={filter===v?'active':''} key={v} onClick={()=>setFilter(v)}>{v}</button>)}</div><label className="search"><PiMagnifyingGlass/><input aria-label="Search hours" placeholder="Search activity or facility" value={query} onChange={e=>setQuery(e.target.value)}/></label></div><HoursTable rows={visible}/><div className="table-note">{visible.length} entries · Saved securely to your member account.</div></section><button className="text-link trash-link" onClick={()=>setModal({type:'trash'})}><PiArrowCounterClockwise/> Removed entries ({data.trash.length})</button></>}
 {(page==='Scheduling'||page==='Shifts')&&<><div className="page-toolbar"><div><h2>Volunteer Scheduling</h2><p className="muted">Previous, present, and upcoming volunteering sessions.</p></div><div className="button-group">{user?.admin&&<button type="button" className="secondary" onClick={exportScheduleCSV}><PiDownloadSimple/> Export Schedule CSV</button>}{isEboard&&<button type="button" className="primary" onClick={()=>openShiftPlanner()}><PiPlus/> Create shift</button>}</div></div><section className="panel" style={{padding:'16px 22px 20px',marginBottom:20}}><div className="filter-bar" style={{padding:0}}><div className="tabs" aria-label="Filter shifts" style={{flexWrap:'wrap'}}>{['All','Present (Today)','Upcoming','Previous (Past)','My scheduled shifts','Open spots'].map(v=><button key={v} className={shiftFilter===v?'active':''} onClick={()=>setShiftFilter(v)}>{v}</button>)}</div><label className="search schedule-search"><PiMagnifyingGlass/><input aria-label="Search shifts" placeholder="Search facility, activity, or date" value={shiftSearch} onChange={e=>setShiftSearch(e.target.value)}/></label></div></section><section className="panel shift-list">{data.shifts.filter(s=>{const {isPast,isToday,isUpcoming}=getShiftTimeInfo(s);if(shiftFilter==='Present (Today)'&&!isToday)return false;if(shiftFilter==='Upcoming'&&!isUpcoming)return false;if(shiftFilter==='Previous (Past)'&&!isPast)return false;if(shiftFilter==='My scheduled shifts'&&!s.mine)return false;if(shiftFilter==='Open spots'&&(s.mine||s.taken>=s.capacity||isPast))return false;if(shiftSearch.trim()){const q=shiftSearch.toLowerCase();const textMatch=[s.facility,s.activity,s.date].join(' ').toLowerCase().includes(q);const rosterMatch=(rosterMap[s.id]||[]).some(m=>(m.name||'').toLowerCase().includes(q)||(m.email||'').toLowerCase().includes(q));if(!textMatch&&!rosterMatch)return false;}return true;}).sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start)).map(s=>{const lockInfo=getShiftTimeInfo(s);const assigned=rosterMap[s.id]||[];return <div className="shift-row" key={s.id} style={{flexDirection:'column',alignItems:'stretch'}}><div style={{display:'flex',alignItems:'center',gap:26,width:'100%',flexWrap:'wrap'}}><DateStamp date={s.date} weekday/><div className="shift-info" style={{flex:1,minWidth:200}}><div className="shift-meta-tags"><span className="shift-activity">{s.activity}</span>{lockInfo.isToday&&<span className="badge today-badge"><PiClock/> Today's Shift</span>}{lockInfo.isUpcoming&&<span className="badge upcoming-badge">Upcoming</span>}{lockInfo.isPast&&<span className="badge past-badge">Past Shift</span>}</div><h3>{s.facility}</h3><p><PiClock/> {time(s.start)} – {time(s.end)}</p><small className={s.capacity-s.taken<=0?'spots-full':'spots-avail'}>{Math.max(0,s.capacity-s.taken)} of {s.capacity} spots available</small></div><div className="shift-action">{s.mine?<div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:6}}><span className="badge approved"><PiCheck/> You're signed up</span>{lockInfo.isLocked?<div className="locked-action"><span className="badge locked-badge" title="Shifts within 4 hours of start time cannot be dropped online"><PiLockKeyFill/> Drop Locked (≤ 4h)</span><button type="button" className="text-link locked-help-link" onClick={()=>setModal({type:'shift-locked',shift:s})}>Need to drop? Contact E-board</button></div>:<button type="button" className="text-link danger-text" onClick={()=>setModal({type:'drop',shift:s})}>Drop shift</button>}</div>:<button className="primary" disabled={s.taken>=s.capacity||lockInfo.isPast} onClick={()=>pickup(s)}>{lockInfo.isPast?'Shift ended':s.taken>=s.capacity?'Shift full':'Pick up shift'}{s.taken<s.capacity&&!lockInfo.isPast&&<PiPlus/>}</button>}</div></div>{isEboard&&<div className="shift-roster-preview"><div className="roster-header"><span><b>Assigned Volunteers ({assigned.length}):</b> {assigned.map(r=>r.name).join(', ')||'None assigned yet'}</span><div className="roster-button-group"><button type="button" className="secondary sm-btn" onClick={async()=>{try{await loadBoard();setModal({type:'manage-roster',shift:s});}catch(e){notify('Could not load member availability: '+e.message)}}}><PiUsersFill/> Manage Roster ({assigned.length})</button><button type="button" className="secondary sm-btn" onClick={()=>notifyVolunteers(s)} title="Send email notice to all assigned volunteers"><PiEnvelopeSimple/> Notify</button><button type="button" className="secondary sm-btn" onClick={()=>sendShiftReminder(s)} title="Send reminder to assigned volunteers"><PiBellFill/> Send Reminder</button></div></div></div>}</div>})}{data.shifts.filter(s=>{const {isPast,isToday,isUpcoming}=getShiftTimeInfo(s);if(shiftFilter==='Present (Today)'&&!isToday)return false;if(shiftFilter==='Upcoming'&&!isUpcoming)return false;if(shiftFilter==='Previous (Past)'&&!isPast)return false;if(shiftFilter==='My scheduled shifts'&&!s.mine)return false;if(shiftFilter==='Open spots'&&(s.mine||s.taken>=s.capacity||isPast))return false;return true;}).length===0&&<div className="empty"><PiCalendarDots/><h3>No shifts to show</h3><p>Try switching timeframe filters to view previous, present, or upcoming shifts.</p></div>}</section></>}
 {page==='Availability'&&<><div className="page-toolbar"><div><h2>{availTab==='mine'?'Your weekly availability':'Chapter Availability (Coordinator View)'}</h2><p className="muted">{availTab==='mine'?'Let your coordinators know when you can volunteer.':'Review member availability windows when planning upcoming facility sessions.'}</p></div>{isEboard&&<div className="button-group"><button type="button" className={availTab==='mine'?'primary':'secondary'} onClick={()=>setAvailTab('mine')}>My Availability</button><button type="button" className={availTab==='chapter'?'primary':'secondary'} onClick={()=>setAvailTab('chapter')}>Chapter Overview ({registeredMembers.length})</button></div>}</div>{availTab==='mine'?<section className="panel availability"><form onSubmit={e=>{e.preventDefault();if(draftAvailability.some(d=>d.enabled&&d.start>=d.end))return notify('End times must be later than start times.');act('availability','PUT',draftAvailability,'Your availability has been saved.')}}><div className="availability-header"><span>Day</span><span>From</span><span>Until</span></div>{draftAvailability.map((d,i)=><div className={'availability-row '+(!d.enabled?'off':'')} key={d.day}><label className="day-toggle"><input type="checkbox" checked={d.enabled} onChange={e=>setDraftAvailability(a=>a.map((v,j)=>j===i?{...v,enabled:e.target.checked}:v))}/><span>{d.day}</span></label><label><span className="sr-only">{d.day} start time</span><input type="time" required disabled={!d.enabled} value={d.start} onChange={e=>setDraftAvailability(a=>a.map((v,j)=>j===i?{...v,start:e.target.value}:v))}/></label><label><span className="sr-only">{d.day} end time</span><input type="time" required disabled={!d.enabled} value={d.end} onChange={e=>setDraftAvailability(a=>a.map((v,j)=>j===i?{...v,end:e.target.value}:v))}/></label></div>)}<div className="form-footer"><p className="muted">Eastern Time · Availability does not book a shift.</p><button className="primary" type="submit"><PiCheck/> Save availability</button></div></form></section>:<section className="panel activity-panel"><div className="notice board-notice" style={{marginBottom:16}}><span>Coordinators' View · Active member availability saved in chapter database</span></div>{['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(day=>{const availableOnDay=registeredMembers.filter(m=>Array.isArray(m.availability)&&m.availability.some(d=>d.day===day&&d.enabled));return <div key={day} style={{borderBottom:'1px solid var(--line)',padding:'14px 0'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}><h3 style={{fontSize:18,color:'var(--cherry)'}}>{day}</h3><span className="badge" style={{background:'#f3f4f6',color:'#374151'}}>{availableOnDay.length} {availableOnDay.length===1?'volunteer':'volunteers'} available</span></div>{availableOnDay.length===0?<p className="muted" style={{fontSize:13,fontStyle:'italic'}}>No members currently available on {day}.</p>:<div style={{display:'flex',flexDirection:'column',gap:8}}>{availableOnDay.map(m=>{const daySlot=m.availability.find(d=>d.day===day);return <div key={m.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:14,background:'#fffdfa',padding:'8px 12px',borderRadius:8,border:'1px solid #ebdcd5'}}><div><b>{m.name}</b> <small style={{display:'inline',color:'var(--muted)'}}>({m.email||m.major||'Member'}{m.year?` · Class of ${m.year}`:''})</small></div><span className="badge approved" style={{fontSize:12}}><PiClock/> {daySlot?.start} – {daySlot?.end}</span></div>;})}</div>}</div>;})}</section>}</>}
 {page==='Newsletter'&&<section className="newsletter-list">{data.newsletters.length?data.newsletters.map(n=><NewsletterArticle key={n.id} entry={n} user={user} onEdit={entry=>setModal({type:'newsletter',entry})}/>):<section className="panel empty"><PiPencilSimple/><h2>Your chapter news, all in one place.</h2><p>Your e-board will publish the next newsletter here.</p></section>}</section>}
 {page==='Member directory'&&<section className="directory-section"><div className="page-toolbar"><div><h2>Your BEI community</h2><p className="muted">Get to know the members behind the impact.</p></div><label className="search"><PiMagnifyingGlass/><input aria-label="Search members" placeholder="Search name, major, or year" value={directorySearch} onChange={e=>setDirectorySearch(e.target.value)}/></label></div>{directoryLoading?<div className="panel empty" role="status"><p>Loading the chapter directory…</p></div>:directoryError?<div className="notice" role="alert">{directoryError}</div>:<><p className="directory-count">{directory.length} {directory.length===1?'member':'members'} · Profiles sync with registered Supabase accounts.</p><div className="directory-grid">{directory.filter(m=>[m.name,m.major,m.year].join(' ').toLowerCase().includes(directorySearch.trim().toLowerCase())).map(m=><button className={'member-card panel'+(m.disabled?' member-disabled':'')} key={m.id} onClick={()=>openMember(m.id)} disabled={profileLoading} aria-label={'View '+m.name+"'s profile"}><span className="avatar directory-avatar">{m.photo_data_url?<img className="member-photo" src={m.photo_data_url} alt={m.name+" profile photo"}/>:m.name.trim().split(/\s+/).map(v=>v[0]).slice(0,2).join('').toUpperCase()}</span><h3>{m.name}</h3>{m.disabled&&<span className="badge disabled-badge">Disabled</span>}{m.chapter_title&&<span className="badge approved">{m.chapter_title}</span>}<p>{m.major||'BEI member'}</p><small><b>{fmt(m.approved_hours||0)} h</b> approved hours</small>{m.year&&<small>Class of {m.year}</small>}<span className="text-link">View profile <PiArrowRight/></span></button>)}</div>{!directory.some(m=>[m.name,m.major,m.year].join(' ').toLowerCase().includes(directorySearch.trim().toLowerCase()))&&<div className="panel empty"><PiUsersFill/><h3>{directory.length?'No matching members':'Your community starts here.'}</h3><p>{directory.length?'Try another name, major, or year.':'Member profiles appear when accounts are registered.'}</p></div>}</>}{profileLoading&&<p role="status" className="directory-count">Opening member profile…</p>}</section>}
 {page==='Profile'&&<section className="panel profile-editor"><h2>Your member profile</h2><p><b>{fmt(sum('Approved'))} h</b> approved hours</p>{data.profile?.chapter_title&&<span className="badge approved">{data.profile.chapter_title}</span>}<p className="muted">Signed in as {user.email}</p><p className="profile-sharing-note">Your photo, name, major, class year, and bio are visible to signed-in members in the member directory.</p><ProfileForm profile={data.profile} onSave={async v=>{const ok=await act('profile','PUT',v,'Your profile has been updated.');if(ok){setData(d=>({...d,profile:{...d.profile,...v}}));setUser(u=>({...u,name:v.name}));if(import.meta.env.DEV&&user?.id){updateSupabaseProfile(user.id,{...v,email:user.email}).catch(err=>console.warn('Supabase sync error:',err));}}return ok;}}/><div className="profile-login-links"><a className="text-link" href="/login">Login page</a><button className="text-link danger-text" onClick={async ()=>{await supabaseSignOut();setUser(null);window.location.href='/login';}}>Sign out</button></div></section>}
 {page==='E-board'&&isEboard&&<>{!user.admin&&!user.eboard&&role!=='board'?<section className="panel demo-gate"><PiStar/><h2>E-board access</h2><p>Use your shared e-board credentials to unlock chapter management. Your individual member login stays active.</p><BoardLogin onUnlock={async credentials=>{boardCredentials=credentials;try{await api('board/unlock','POST',{});await loadBoard();setRole('board');return '';}catch(e){boardCredentials=null;return e.message}}}/></section>:<><div className="notice board-notice"><span>Chapter management · Actions recorded under {user.name?.trim()||user.email}</span>{!user.admin&&!user.eboard&&<button className="text-link" onClick={()=>{boardCredentials=null;setRole('volunteer');setBoardData({hours:[],newsletters:[]})}}>Lock e-board</button>}</div><div className="page-toolbar"><div><h2>Hours awaiting review</h2><p className="muted">{boardData.hours.filter(h=>h.status==='Pending').length} entries need attention.</p></div><div className="button-group"><button className="secondary" onClick={()=>setModal({type:'newsletter'})}><PiPencilSimple/> Write newsletter</button><button className="primary" onClick={()=>openShiftPlanner()}><PiPlus/> Create shift</button></div></div><section className="panel review-list">{boardData.hours.filter(h=>h.status==='Pending').map(h=>{const isSelf=h.owner===user?.id&&!user?.admin;return <div className="review-row" key={h.id}><div className="review-person"><div><b>{h.volunteer}</b><small>{h.date}</small></div>{isSelf&&<span className="badge" style={{background:'#fef3c7',color:'#92400e',fontSize:11,marginTop:4}}>Self-logged (Peer review required)</span>}</div><div><b>{h.activity}</b><small>{h.facility} · {h.hours} h</small>{h.notes&&<small>{h.notes}</small>}</div><div className="button-group"><button className="secondary" onClick={()=>setModal({type:'return',entry:h})}>Return</button><button className="primary" disabled={isSelf} title={isSelf?'Officers cannot approve their own hours per chapter integrity policy':undefined} onClick={()=>review(h,'Approved')}><PiCheck/> {isSelf?'Peer review':'Approve'}</button></div></div>;})}{!boardData.hours.some(h=>h.status==='Pending')&&<div className="empty"><PiCheck/><h3>All caught up!</h3><p>Every submitted entry has been reviewed.</p></div>}</section><section className="panel activity-panel"><h2>Chapter newsletters</h2>{boardData.newsletters.length?boardData.newsletters.map(n=><div className="trash-row" key={n.id}><div><b>{n.title}</b><small>{n.published?'Published':'Draft'} · {n.author}</small></div>{canEditNewsletter(user,n)&&<button className="secondary" onClick={()=>setModal({type:'newsletter',entry:n})}>Edit</button>}</div>):<p className="muted">Write the chapter's first newsletter.</p>}</section></>}</>}
 {page==='E-board'&&isEboard&&<section className="panel admin-panel"><h2>Member access</h2><p className="muted">Disabled profiles stay visible to members. Re-enable an account to restore its portal access.</p>{members.map(m=><div className={'trash-row'+(m.disabled?' member-disabled':'')} key={m.id}><div><b>{m.name}</b><small>{m.email}</small><span className={'badge '+(m.disabled?'disabled-badge':'approved')}>{m.disabled?'Disabled':'Active member'}</span></div>{m.id!==user.id&&(user.admin||!m.is_admin)&&<button type="button" className="secondary" onClick={async()=>{if(await act('admin/member','POST',{id:m.id,disabled:!m.disabled},m.disabled?'Member re-enabled.':'Member disabled.')){const updated=await api('admin');setMembers(updated.members);}}}>{m.disabled?'Re-enable':'Disable'}</button>}</div>)}</section>}
 {page==='Admin'&&isAdmin&&<>
  <div className="notice board-notice"><span>Chapter administration · Actions recorded as {user.name?.trim()||user.email}</span></div>
  <div className="page-toolbar"><div><h2>Chapter Administration</h2><p className="muted">Administrator: {user.email}. Manage executive powers, shifts, newsletters, and member permissions.</p></div><div className="button-group"><button type="button" className="secondary" onClick={()=>setModal({type:'newsletter'})}><PiPencilSimple/> Write newsletter</button><button type="button" className="primary" onClick={()=>openShiftPlanner()}><PiPlus/> Create shift</button></div></div>
  <section className="panel activity-panel"><div className="section-title"><h2>Chapter newsletters</h2><button type="button" className="secondary sm-btn" onClick={()=>setModal({type:'newsletter'})}><PiPencilSimple/> Write newsletter</button></div>{boardData.newsletters.length?boardData.newsletters.map(n=><div className="trash-row" key={n.id}><div><b>{n.title}</b><small>{n.published?'Published':'Draft'} · Written by {n.author}</small></div>{canEditNewsletter(user,n)&&<button type="button" className="secondary" onClick={()=>setModal({type:'newsletter',entry:n})}>Edit</button>}</div>):<p className="muted">No newsletters published yet. Click "Write newsletter" above to draft an announcement.</p>}</section>
  {boardData.hours.some(h=>h.status==='Pending')&&<section className="panel review-list"><div className="section-title"><h2>Volunteer hours awaiting review</h2><span className="badge pending">{boardData.hours.filter(h=>h.status==='Pending').length} pending</span></div>{boardData.hours.filter(h=>h.status==='Pending').slice(0,5).map(h=>{const isSelf=h.owner===user?.id&&!user?.admin;return <div className="review-row" key={h.id}><div className="review-person"><div><b>{h.volunteer}</b><small>{h.date}</small></div>{isSelf&&<span className="badge" style={{background:'#fef3c7',color:'#92400e',fontSize:11,marginTop:4}}>Self-logged (Peer review required)</span>}</div><div><b>{h.activity}</b><small>{h.facility} · {h.hours} h</small>{h.notes&&<small>{h.notes}</small>}</div><div className="button-group"><button type="button" className="secondary" onClick={()=>setModal({type:'return',entry:h})}>Return</button><button type="button" className="primary" disabled={isSelf} title={isSelf?'Officers cannot approve their own hours per chapter integrity policy':undefined} onClick={()=>review(h,'Approved')}><PiCheck/> {isSelf?'Peer review':'Approve'}</button></div></div>;})}</section>}
  <AuditLog request={api}/>
  <section className="panel admin-panel"><h2>Member management &amp; E-board Permissions</h2><p className="muted">Administrator: {user.email}. Manage member access and grant executive board positions to registered chapter accounts.</p>{members.map(m=><div className={'trash-row'+(m.disabled?' member-disabled':'')} key={m.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}}><div><b>{m.name} {m.id===user.id&&<small style={{color:'var(--cherry)',fontWeight:700}}>(You · Administrator{m.chapter_title?` · ${m.chapter_title}`:''})</small>}</b><small>{m.email} · {m.major||'Profile not completed'}{m.year?` · Class of ${m.year}`:''}</small><div style={{display:'flex',gap:6,marginTop:4}}><span className={'badge '+(m.disabled?'disabled-badge':'approved')}>{m.disabled?'Disabled':'Active member'}</span>{m.chapter_title&&<span className="badge approved">{m.chapter_title}</span>}{m.eboard?<span className="badge" style={{background:'#e8f4fd',color:'#0d6efd',borderColor:'#b6d4fe'}}>E-Board Officer</span>:<span className="badge" style={{background:'#f3f4f6',color:'#6b7280'}}>Volunteer</span>}</div></div>{m.id!==user.id&&<div className="button-group"><button type="button" className={m.eboard?"secondary danger-text":"secondary"} onClick={async()=>{const action=m.eboard?'Revoke E-board':'Grant E-board';if(await act('admin/member','POST',{id:m.id,eboard:!m.eboard},`${action} updated for ${m.name}.`)){const updated=await api('admin');setMembers(updated.members);}}}>{m.eboard?'Revoke E-board':'Grant E-board'}</button><button type="button" className="secondary" onClick={async()=>{if(await act('admin/member','POST',{id:m.id,disabled:!m.disabled},m.disabled?'Member re-enabled.':'Member disabled.')){const updated=await api('admin');setMembers(updated.members);}}}>{m.disabled?'Re-enable':'Disable'}</button><button type="button" className="secondary danger-text" onClick={()=>setModal({type:'delete-member',entry:m})}><PiTrash/> Delete account</button></div>}</div>)}<p className="muted admin-note">When a registered member is granted an E-board position, the E-board portal becomes visible in their navigation, allowing them to review hours, create shifts, and author newsletters under their respective profile name.</p></section>
 </>}
 <footer className="site-footer"><span>Brain Exercise Initiative · Temple University</span><div className="legal-footer-links"><button type="button" onClick={()=>setModal({type:'privacy'})}>Privacy Policy</button><span>·</span><button type="button" onClick={()=>setModal({type:'terms'})}>Terms of Service</button><span>·</span><button type="button" onClick={()=>setModal({type:'cookies'})}>Cookie Preferences</button><span>·</span><button type="button" onClick={()=>setModal({type:'about'})}>About Chapter Workspace</button></div></footer>
 </main>{toast&&<div className="toast" role="status"><PiCheck/>{toast}<button className="icon-button" aria-label="Dismiss notification" onClick={()=>setToast('')}><PiX/></button></div>}
 <CookieBanner onOpenSettings={()=>setModal({type:'cookies'})} onOpenPrivacy={()=>setModal({type:'privacy'})}/>
 {modal&&<Modal title={modal.type==='delete-member'?'Delete member account?':modal.type==='privacy'?'Privacy Policy':modal.type==='terms'?'Terms of Service & Liability Release':modal.type==='cookies'?'Cookie Policy & Preferences':modal.type==='hours'?(modal.entry?'Edit volunteer hours':'Log volunteer hours'):modal.type==='remove'?'Remove this entry?':modal.type==='drop'?'Drop this shift?':modal.type==='shift-locked'?'Shift Drop Locked (Within 4 Hours)':modal.type==='manage-roster'?'Manage Shift Roster':modal.type==='return'?'Return entry for changes':modal.type==='shift'?'Create a volunteer shift':modal.type==='trash'?'Removed entries':modal.type==='newsletter'?'Chapter newsletter':modal.type==='member'?'Member profile':'About this workspace'} onClose={()=>setModal(null)}>
 {modal.type==='delete-member'&&<DeleteMemberForm member={modal.entry} onCancel={()=>setModal(null)} onDelete={async confirmationEmail=>{
  await api('admin/member/delete','POST',{id:modal.entry.id,confirmationEmail});
  setMembers(v=>v.filter(m=>m.id!==modal.entry.id));
  setDirectory(v=>v.filter(m=>m.id!==modal.entry.id));
  setRegisteredMembers(v=>v.filter(m=>m.id!==modal.entry.id));
  setRosterData(v=>v.filter(m=>m.owner!==modal.entry.id));
  setModal(null);
  notify('Account deleted. Associated records are retained in the database.');
 }}/>}
 {modal.type==='privacy'&&<PrivacyPolicyContent/>}
 {modal.type==='terms'&&<TermsOfServiceContent/>}
 {modal.type==='cookies'&&<CookieSettingsContent onClose={()=>setModal(null)} onSave={()=>notify('Cookie preferences updated.')}/>}
 {modal.type==='hours'&&<HourForm entry={modal.entry} autoApprove={isAdmin||!!user.eboard} onSave={logHours} onCancel={()=>setModal(null)}/>}
 {modal.type==='remove'&&<><p>The {modal.entry.hours} h entry for {modal.entry.date} will be removed from your totals. You can restore it later.</p><div className="modal-actions"><button className="secondary" onClick={()=>setModal(null)}>Keep entry</button><button className="primary" onClick={()=>remove(modal.entry)}><PiTrash/> Remove entry</button></div></>}
 {modal.type==='drop'&&<><p>Release your spot at {modal.shift.facility} on {modal.shift.date}? Another volunteer will be able to pick it up.</p><div className="modal-actions"><button className="secondary" onClick={()=>setModal(null)}>Keep shift</button><button className="primary" onClick={()=>drop(modal.shift)}>Drop shift</button></div></>}
 {modal.type==='shift-locked'&&<div className="locked-modal-content"><div className="notice" style={{background:'#ffebee',borderColor:'#f5c2c7',color:'#842029',marginBottom:16}}><strong style={{display:'flex',alignItems:'center',gap:6}}><PiLockKeyFill/> Shifts within 4 hours are locked</strong><p style={{margin:'6px 0 0',fontSize:13,lineHeight:1.6}}>This shift starts in less than 4 hours (or is currently in progress). To guarantee our senior community members have coverage, regular self-drops are locked.</p></div><div className="shift-summary-box" style={{marginBottom:16}}><h3>{modal.shift.facility}</h3><p className="muted">{modal.shift.activity}</p><p style={{fontSize:14,marginTop:6}}><b>Date:</b> {modal.shift.date} · <b>Time:</b> {time(modal.shift.start)} – {time(modal.shift.end)}</p></div><p style={{fontSize:14,lineHeight:1.6}}>Please contact an Executive Board member immediately so emergency substitute coverage can be arranged:</p><div className="modal-actions" style={{marginTop:16}}><a className="primary" href={`mailto:templebei@gmail.com,admin@temple.edu?subject=Emergency%20Drop%20Request%20-%20${encodeURIComponent(modal.shift.facility)}%20(${modal.shift.date})&body=Hello%20E-board,%0D%0A%0D%0AI%20am%20scheduled%20for%20the%20shift%20at%20${encodeURIComponent(modal.shift.facility)}%20on%20${modal.shift.date}%20at%20${modal.shift.start},%20but%20I%20have%20an%20urgent%20conflict%20and%20cannot%20attend.%20Please%20help%20find%20coverage.%0D%0A%0D%0AThank%20you,%0D%0A${encodeURIComponent(user?.name||'')}`}><PiEnvelopeSimple/> Email E-Board Coordinator</a><button className="secondary" onClick={()=>setModal(null)}>Close</button></div></div>}
 {modal.type==='manage-roster'&&<ManageRosterModal shift={modal.shift} roster={rosterMap[modal.shift.id]||[]} availableMembers={registeredMembers} onAssign={async memberId=>assignMemberToShift(modal.shift.id,memberId)} onRemove={async memberId=>removeMemberFromShift(modal.shift.id,memberId)} onSwap={async (memberOut,memberIn)=>swapMembersInShift(modal.shift.id,memberOut,memberIn)} onNotify={()=>notifyVolunteers(modal.shift)} onRemind={()=>sendShiftReminder(modal.shift)} onClose={()=>setModal(null)}/>}
 {modal.type==='return'&&<form onSubmit={e=>{e.preventDefault();review(modal.entry,'Returned',new FormData(e.currentTarget).get('reason'))}}><label>What needs to change?<textarea name="reason" required maxLength={500} placeholder="Explain what the volunteer should update."/></label><button className="primary full" type="submit">Return with feedback</button></form>}
 {modal.type==='shift'&&<ShiftForm members={registeredMembers} onSave={async s=>{if(await act('board/shifts','POST',s,'New shift created. Volunteers can now pick it up.'))setModal(null)}}/>}
 {modal.type==='trash'&&<>{data.trash.length?data.trash.map(h=><div className="trash-row" key={h.id}><div><b>{h.activity}</b><small>{h.date} · {h.hours} h</small></div><button className="secondary" onClick={()=>{act('hours/restore','POST',{id:h.id},(isAdmin||user.eboard)?'Entry restored and automatically approved.':'Entry restored and sent for approval.')}}>Restore</button></div>):<p>No removed entries. Your log is all here.</p>}</>}
 {modal.type==='about'&&<><p>Your member profile and volunteer records are saved to the chapter database and tied to your individual sign-in.</p><p>Only the chapter administrator and password-authorized e-board members can review hours, create shifts, and publish newsletters.</p><p>You can export your hour log as CSV from My hours.</p></>}
 {modal.type==='member'&&<div className={'member-detail'+(modal.entry.disabled?' member-disabled':'')}><span className="avatar directory-avatar">{modal.entry.photo_data_url?<img className="member-photo" src={modal.entry.photo_data_url} alt={modal.entry.name+" profile photo"}/>:modal.entry.name.trim().split(/\s+/).map(v=>v[0]).slice(0,2).join('').toUpperCase()}</span><h3>{modal.entry.name}</h3>{modal.entry.disabled&&<span className="badge disabled-badge">Disabled</span>}{modal.entry.chapter_title&&<span className="badge approved">{modal.entry.chapter_title}</span>}<p className="muted">Temple University · Brain Exercise Initiative</p><dl className="member-facts"><div><dt>Approved hours</dt><dd>{fmt(modal.entry.approved_hours||0)} h</dd></div><div><dt>Major</dt><dd>{modal.entry.major||'Not added yet'}</dd></div><div><dt>Class year</dt><dd>{modal.entry.year||'Not added yet'}</dd></div></dl><h4>About {modal.entry.name.split(' ')[0]}</h4><div className="member-bio">{modal.entry.bio||'This member hasn’t added a bio yet.'}</div>{modal.entry.id===user.id&&<button className="primary full" onClick={()=>{setModal(null);go('Profile')}}><PiPencilSimple/> Edit my profile</button>}</div>}
 {modal.type==='newsletter'&&<NewsletterForm entry={modal.entry} onSave={async n=>{if(await act('board/newsletter','POST',n,n.published?'Newsletter published.':'Draft saved.'))setModal(null)}}/>}
 </Modal>}
 </>;
}
function Modal({title,onClose,children}){const ref=useRef();useEffect(()=>{const prev=document.activeElement;ref.current.showModal();return()=>{prev?.focus?.()}},[]);return <dialog ref={ref} className="modal" onCancel={e=>{e.preventDefault();onClose()}} onClick={e=>{if(e.target===ref.current){const r=ref.current.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose()}}}><div className="modal-heading"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><PiX/></button></div>{children}</dialog>}
function HourForm({entry,autoApprove=false,onSave,onCancel}){const [error,setError]=useState(''),[busy,setBusy]=useState(false);return <form onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget),hours=Number(f.get('hours'));if(hours<=0||hours>24)return setError('Enter more than 0 and no more than 24 hours.');if(f.get('date')>today())return setError('Hours must be logged for today or an earlier date.');setError('');setBusy(true);try{await onSave({id:entry?.id,date:f.get('date'),activity:f.get('activity'),facility:f.get('facility'),hours,status:'Pending',reviewer:'',volunteer:'',notes:f.get('notes')});}catch(err){setError(err?.message||'Failed to submit hours.');}finally{setBusy(false);}}}><p className="form-intro">{autoApprove?'Your admin or e-board hours save as approved immediately. All changes are recorded in the database audit history.':entry?'Changes will send this entry back for approval.':'Your e-board will review and approve your time.'}</p><div className="form-two"><label>Date<input name="date" type="date" required max={today()} defaultValue={entry?.date||today()}/></label><label>Hours<input name="hours" type="number" step="0.25" min="0.25" max="24" placeholder="e.g. 1.5" required defaultValue={entry?.hours}/></label></div><label>Activity<select name="activity" defaultValue={entry?.activity||activities[0]}>{activities.map(a=><option key={a}>{a}</option>)}</select></label><label>Facility<input name="facility" required maxLength={200} placeholder="Facility name" defaultValue={entry?.facility||''}/></label><label>Notes <span className="muted">(optional · strictly do not include resident names or health details per chapter privacy rules)</span><textarea name="notes" maxLength={500} placeholder="e.g. Assisted 4 residents with word puzzle packet and trivia (no resident names or private medical details)" defaultValue={entry?.notes||''}/></label>{error&&<p role="alert" className="error">{error}</p>}<div className="modal-actions"><button type="button" className="secondary" onClick={onCancel} disabled={busy}>Cancel</button><button className="primary" type="submit" disabled={busy}>{busy?'Saving…':autoApprove?'Save approved hours':'Submit for approval'} <PiArrowRight/></button></div></form>}
function ShiftForm({onSave,members=[]}){const [plannedShift,setPlannedShift]=useState({date:today(),start:'15:00',end:'16:00'});const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [shiftId]=useState(()=>crypto.randomUUID());return <form onSubmit={async e=>{e.preventDefault();if(busy)return;const f=new FormData(e.currentTarget);if(f.get('start')>=f.get('end'))return setError('End time must be later than start time.');setError('');setBusy(true);try{await onSave({id:shiftId,date:f.get('date'),start:f.get('start'),end:f.get('end'),facility:f.get('facility'),activity:f.get('activity'),capacity:Number(f.get('capacity')),taken:0,mine:false})}catch(err){setError(err.message||'Could not create shift. Try again.')}finally{setBusy(false)}}}><label>Date<input name="date" type="date" onChange={e=>setPlannedShift(v=>({...v,date:e.target.value}))} min={today()} defaultValue={today()} required/></label><div className="form-two"><label>Start<input name="start" type="time" onChange={e=>setPlannedShift(v=>({...v,start:e.target.value}))} required defaultValue="15:00"/></label><label>End<input name="end" type="time" onChange={e=>setPlannedShift(v=>({...v,end:e.target.value}))} required defaultValue="16:00"/></label></div><label>Activity<select name="activity">{activities.map(a=><option key={a}>{a}</option>)}</select></label><label>Facility<input name="facility" required maxLength={200} placeholder="Facility name"/></label><label>Volunteer spots<input name="capacity" type="number" required min="1" max="50" defaultValue="4"/></label><SavedAvailability members={members} shift={plannedShift}/>{error&&<p className="error" role="alert">{error}</p>}<button className="primary full" disabled={busy}>{busy?'Saving shift…':'Create shift'}</button></form>}
export default App;
function BoardLogin({onUnlock}){const [error,setError]=useState(''),[busy,setBusy]=useState(false);return <form className="board-form" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);setBusy(true);setError(await onUnlock({username:f.get('username'),password:f.get('password')}));setBusy(false)}}><label>E-board username<input name="username" autoComplete="username" required defaultValue="bei-eboard"/></label><label>E-board password<input name="password" type="password" autoComplete="current-password" required/></label><SavedAvailability members={members} shift={plannedShift}/>{error&&<p className="error" role="alert">{error}</p>}<button className="primary full" disabled={busy}>{busy?'Checking…':'Unlock e-board'}</button></form>}
function ProfileForm({profile,onSave}){
 const [busy,setBusy]=useState(false),[photoBusy,setPhotoBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 const [name,setName]=useState(profile?.name||''),[major,setMajor]=useState(profile?.major||''),[year,setYear]=useState(profile?.year||''),[bio,setBio]=useState(profile?.bio||''),[photo,setPhoto]=useState(profile?.photo_data_url||'');
 useEffect(()=>{if(profile){setName(profile.name||'');setMajor(profile.major||'');setYear(profile.year||'');setBio(profile.bio||'');setPhoto(profile.photo_data_url||'');}},[profile?.name,profile?.major,profile?.year,profile?.bio,profile?.photo_data_url]);
 return <form onChange={()=>setSaved(false)} onSubmit={async e=>{e.preventDefault();if(busy||photoBusy)return;setBusy(true);setError('');setSaved(false);try{const ok=await onSave({name,major,year,bio,photo_data_url:photo});if(ok)setSaved(true);else setError('Your profile was not saved. Please try again.');}catch(err){setError(err.message);}finally{setBusy(false);}}}>
 <div className="profile-photo-editor"><span className="avatar profile-photo-preview">{photo?<img className="member-photo" src={photo} alt="Profile photo preview"/>:(name||'?').split(' ').map(v=>v[0]).slice(0,2).join('').toUpperCase()}</span><div><label>Upload profile photo<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy||photoBusy} onChange={async e=>{const file=e.target.files?.[0];if(!file)return;setPhotoBusy(true);setError('');try{setPhoto(await prepareProfilePhoto(file));}catch(err){setError(err.message);}finally{setPhotoBusy(false);e.target.value='';}}}/></label><small>JPG, PNG, or WebP · up to 10 MB. Select Save profile to keep your changes.</small>{photo&&<button className="text-link danger-text" type="button" disabled={busy||photoBusy} onClick={()=>{setPhoto('');setSaved(false);}}>Remove photo</button>}</div></div>
 <label>Full name<input name="name" required maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Alice Smith"/></label><div className="form-two"><label>Major<input name="major" maxLength={120} value={major} onChange={e=>setMajor(e.target.value)} placeholder="e.g. Neuroscience"/></label><label>Class year<input name="year" maxLength={40} placeholder="e.g. 2028" value={year} onChange={e=>setYear(e.target.value)}/></label></div><label>About you<textarea name="bio" maxLength={500} value={bio} onChange={e=>setBio(e.target.value)} placeholder="Tell your chapter a little about yourself."/></label>
 {error&&<p className="login-error" role="alert">{error}</p>}{saved&&<p role="status">Profile saved. Your photo, year, and bio will be here next time you sign in.</p>}
 <button className="primary" disabled={busy||photoBusy}><PiCheck/> {photoBusy?'Preparing photo…':busy?'Saving…':'Save profile'}</button></form>
}


export function LoginPage({user,error,onRetry,onAuthSuccess,onSignOut}){
 const [entry,setEntry]=useState('Member');
 const [needsPassword,setNeedsPassword]=useState(false);
 const [confirmPassword,setConfirmPassword]=useState('');
 const [resetCooldown,setResetCooldown]=useState(0);
 useEffect(()=>{if(!resetCooldown)return;const timer=setTimeout(()=>setResetCooldown(v=>v-1),1000);return()=>clearTimeout(timer);},[resetCooldown]);
 useEffect(()=>{acceptEmailLink().then(result=>{if(!result)return;setNeedsPassword(result.needsPassword);if(result.needsPassword){setEntry(result.session.user.admin?'Admin':'Member');setAuthSuccess(result.type==='recovery'?'Reset link verified. Choose your new password below.':'Invitation accepted. Choose your own password to finish setting up your account.');}else{setAuthSuccess('Email confirmed. You can continue to your dashboard.');if(onAuthSuccess)onAuthSuccess(result.session);}}).catch(err=>setAuthError(err.message));},[]);
 const [authMode,setAuthMode]=useState(()=>new URLSearchParams(window.location.search).has('reset')?'forgot':'signin');
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [name,setName]=useState('');
 const [authBusy,setAuthBusy]=useState(false);
 const [authError,setAuthError]=useState('');
 const [authSuccess,setAuthSuccess]=useState('');
 const [unconfirmedEmail,setUnconfirmedEmail]=useState('');
 const [legalModal,setLegalModal]=useState(()=>{const p=typeof window!=='undefined'?window.location.pathname:'';if(p==='/privacy')return 'privacy';if(p==='/terms')return 'terms';if(p==='/cookies')return 'cookies';return null;});

 const destination=portalDestination(entry);
 const signIn='/signin-with-chatgpt?return_to='+encodeURIComponent(destination);

 async function handleAuth(e){
  e.preventDefault();
  setAuthBusy(true);
  setAuthError('');
  setAuthSuccess('');
  setUnconfirmedEmail('');
  try {
   if(needsPassword){
    if(password!==confirmPassword)throw new Error('The passwords do not match.');
    const session=await setAccountPassword(password);
    setNeedsPassword(false);setAuthMode('signin');setPassword('');setConfirmPassword('');
    setAuthSuccess('Your password is saved. You can now use your account.');
    if(onAuthSuccess)await onAuthSuccess(session);
   } else if(authMode==='forgot'){
    setAuthSuccess(await requestPasswordReset(email));setResetCooldown(60);
   } else if(authMode==='signup'){
    if(!name.trim())throw new Error('Please enter your full name.');
    const res=await signUp({email,password,name});
    setAuthSuccess(res.message);
    setUnconfirmedEmail(email.trim().toLowerCase());
   } else {
    const session=await signInWithPassword({email,password,portal:entry});
    setAuthSuccess('Signed in successfully!');
    if(onAuthSuccess)await onAuthSuccess(session);
   }
  } catch(err){
   setAuthError(err.message||'Authentication failed. Please verify your credentials or confirm your email.');
   if(err.unconfirmedEmail||err.message?.toLowerCase().includes('not been confirmed')){
    setUnconfirmedEmail(err.unconfirmedEmail||email.trim().toLowerCase());
   }
  } finally {
   setAuthBusy(false);
  }
 }

 async function handleAppleAuth(){
  setAuthBusy(true);
  setAuthError('');
  setAuthSuccess('');
  try {
   const res=await signInWithApple();
   setAuthSuccess(res.message||'Signed in with Apple successfully!');
   if(onAuthSuccess)await onAuthSuccess(res.session);
  } catch(err){
   if(err.error==='popup_closed_by_user'||err.message?.includes('popup_closed')){
    return;
   }
   setAuthError(err.message||'Sign in with Apple failed. Please try again.');
  } finally {
   setAuthBusy(false);
  }
 }

 function handleSimulateConfirm(){
  if(unconfirmedEmail){
   confirmLocalEmail(unconfirmedEmail);
   setAuthSuccess(`Email ${unconfirmedEmail} verified successfully! You can now sign in with your password.`);
   setAuthError('');
   setUnconfirmedEmail('');
   setAuthMode('signin');
  }
 }

 return <div className="login-page"><div className="checker"/><div className="login-layout"><section className="login-story"><a href="/" className="login-wordmark"><img src="/assets/bei-logo.png" alt="Brain Exercise Initiative · Temple University"/></a><p className="eyebrow">Temple University · Volunteer hub</p><h1>A little time.<br/>A lasting difference.</h1><p className="login-description">Show up for your community. Keep track of the difference you make.</p><img className="login-mascot" src="/assets/temple-bei-mascot.png" alt="Temple BEI brain mascot with glasses, Temple cap, and weights"/><p className="login-story-footer">Brain Exercise Initiative · Temple chapter</p></section><section className="login-form-area"><div className="login-card"><h2>Welcome to BEI.</h2><p className="login-intro">One place for volunteer hours, upcoming shifts, and chapter news.</p><div className="login-entry-tabs" role="group" aria-label="Choose portal">{['Member','E-board','Admin'].map(v=><button key={v} type="button" aria-pressed={entry===v} className={entry===v?'active':''} onClick={()=>setEntry(v)}>{v}</button>)}</div><div className="login-entry-copy"><h3>{entry==='Member'?'Your time starts here.':entry==='E-board'?'Lead your chapter.':'Your admin workspace.'}</h3><p>{entry==='Member'?'Sign in to view your profile, log hours, and pick up your next shift.':entry==='E-board'?'Sign in with your individual officer account to access chapter tools.':'Admin access is reserved for authorized chapter administrators.'}</p></div>{error&&<p className="login-error" role="alert">{error}</p>}{authError&&<p className="login-error" role="alert">{authError}</p>}{user&&!needsPassword&&authMode!=='forgot'?<><p className="signed-in-as">Signed in as <b>{user.name}</b><small>{user.email}</small></p>{entry==='Admin'&&!user.admin?<p className="login-error">This account does not have administrator access.</p>:<a className="primary login-submit" href={destination}>Continue to {entry==='Member'?'your dashboard':entry==='E-board'?'e-board':'admin'} <PiArrowRight/></a>}<button className="login-switch" onClick={onSignOut||(()=>{window.location.href='/signout-with-chatgpt?return_to=%2Flogin'})}>Use a different account / Sign out</button><button type="button" className="login-switch" onClick={()=>{setAuthMode('forgot');setAuthError('');setAuthSuccess('');}}>Forgot password?</button></>:<><div className="login-auth-tabs" role="tablist" hidden={needsPassword} style={needsPassword?{display:'none'}:undefined}><button type="button" role="tab" aria-selected={authMode==='signin'} className={authMode==='signin'?'active':''} onClick={()=>{setAuthMode('signin');setAuthError('');setAuthSuccess('');}}>Sign in</button><button type="button" role="tab" aria-selected={authMode==='signup'} className={authMode==='signup'?'active':''} onClick={()=>{setAuthMode('signup');setAuthError('');setAuthSuccess('');}}>Create account</button></div>{needsPassword&&<div className="login-auth-tabs" role="tablist" aria-label="Password reset"><button type="button" role="tab" aria-selected="true" className="active">Reset password</button></div>}{authMode==='forgot'&&!needsPassword&&<div className="login-entry-copy"><h3>Forgot your password?</h3><p>Enter your registered email to receive a password reset link.</p></div>}{import.meta.env.DEV&&!isSupabaseConfigured()&&unconfirmedEmail&&<button type="button" className="login-switch" style={{margin:'-5px 0 14px',fontWeight:'600'}} onClick={handleSimulateConfirm}>[Test helper: Verify email {unconfirmedEmail} now]</button>}{authSuccess&&<div className="login-success" role="status"><PiCheck/><span>{authSuccess}</span></div>}<form className="login-form" onSubmit={handleAuth}>{authMode==='signup'&&<label>Full name<input type="text" required placeholder="e.g. Alice Smith" value={name} onChange={e=>setName(e.target.value)}/></label>}<label hidden={needsPassword} style={needsPassword?{display:'none'}:undefined}>Email address<input type="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} required={!needsPassword} placeholder="you@temple.edu" value={email} onChange={e=>setEmail(e.target.value)}/></label><label hidden={authMode==='forgot'&&!needsPassword} style={authMode==='forgot'&&!needsPassword?{display:'none'}:undefined}>Password<input type="password" autoComplete={needsPassword||authMode==='signup'?'new-password':'current-password'} required={needsPassword||authMode!=='forgot'} minLength={authMode==='forgot'&&!needsPassword?undefined:needsPassword?12:6} placeholder={needsPassword?"Choose a password (12+ characters)":"Enter password"} value={password} onChange={e=>setPassword(e.target.value)}/></label>{needsPassword&&<label>Confirm new password<input type="password" autoComplete="new-password" required minLength={12} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/></label>}<button className="primary login-submit" type="submit" disabled={authBusy||(authMode==='forgot'&&resetCooldown>0)}>{authBusy?'Checking…':(needsPassword?'Save password':authMode==='forgot'?(resetCooldown?`Send again in ${resetCooldown}s`:'Send reset link'):authMode==='signup'?'Create account':'Sign in')} <PiArrowRight/></button></form>{!needsPassword&&<button type="button" className="login-switch" onClick={()=>{setAuthMode(authMode==='forgot'?'signin':'forgot');setAuthError('');setAuthSuccess('');setPassword('');}}>{authMode==='forgot'?'Back to sign in':'Forgot password?'}</button>}<small className="auth-note">Temple BEI accounts must be confirmed from your email before you can officially sign in.</small><div className="login-divider"><span>or continue with</span></div><button type="button" className="apple-button" onClick={handleAppleAuth} disabled={authBusy}><PiAppleLogoFill/> Sign in with Apple</button><a className="secondary login-submit chatgpt-button" href={signIn} target="_top">Sign in with ChatGPT</a>{error&&<button className="login-switch" onClick={onRetry}>Retry connection</button>}</>}<p className="login-help">Use the account approved for Temple BEI. Your member profile is created on your first sign-in.</p><div className="login-legal-bar"><div className="legal-footer-links"><button type="button" onClick={()=>setLegalModal('privacy')}>Privacy Policy</button><span>·</span><button type="button" onClick={()=>setLegalModal('terms')}>Terms of Service</button><span>·</span><button type="button" onClick={()=>setLegalModal('cookies')}>Cookie Preferences</button></div><p className="login-legal-note">By signing in or using this chapter platform, you grant permission for legally allowed data collection &amp; informatics/study use, and agree to our Terms of Service &amp; Privacy Policy.</p></div></div><p className="login-bottom-note">A stronger community, one session at a time.</p></section></div><CookieBanner onOpenSettings={()=>setLegalModal('cookies')} onOpenPrivacy={()=>setLegalModal('privacy')}/>{legalModal&&<Modal title={legalModal==='privacy'?'Privacy Policy':legalModal==='terms'?'Terms of Service & Volunteer Liability Release':'Cookie Policy & Preferences'} onClose={()=>setLegalModal(null)}>{legalModal==='privacy'&&<PrivacyPolicyContent/>}{legalModal==='terms'&&<TermsOfServiceContent/>}{legalModal==='cookies'&&<CookieSettingsContent onClose={()=>setLegalModal(null)} onSave={()=>{}}/>}</Modal>}</div>;
}

function ManageRosterModal({shift,roster,availableMembers,onAssign,onRemove,onSwap,onNotify,onRemind,onClose}){
 const [selectedMember,setSelectedMember]=useState('');
 const [swappingMemberId,setSwappingMemberId]=useState(null);
 const [replacementMemberId,setReplacementMemberId]=useState('');
 const [busy,setBusy]=useState(false);

 const unassignedMembers=availableMembers.filter(m=>!roster.some(r=>r.owner===m.id));
 const shiftDay=shift?.date?new Date(shift.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'long'}):'';
 const memberLabel=m=>{
  return `${m.name} (${m.email||m.major||'Member'}) • ${availabilityForShift(m,shift).label}`;
 };

 return <div className="roster-modal-content"><SavedAvailability members={availableMembers} shift={shift}/>
  <div className="shift-summary-box">
   <h3>{shift.facility}</h3>
   <p className="muted">{shift.activity} · {shift.date} ({shiftDay}) from {time(shift.start)} to {time(shift.end)}</p>
   <p style={{marginTop:6,fontSize:13}}>Capacity: <b>{roster.length} / {shift.capacity} filled</b> ({Math.max(0,shift.capacity-roster.length)} spots remaining)</p>
  </div>
  <div className="roster-modal-section">
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10,flexWrap:'wrap',gap:8}}>
    <h4 style={{margin:0,fontSize:16}}>Currently Assigned Volunteers ({roster.length})</h4>
    <div style={{display:'flex',gap:8}}>
     <button type="button" className="secondary sm-btn" onClick={onNotify} title="Draft email to assigned volunteers"><PiEnvelopeSimple/> Email Roster</button>
     <button type="button" className="secondary sm-btn" onClick={onRemind} title="Send 24h reminder"><PiBellFill/> Send Reminder</button>
    </div>
   </div>
   {roster.length===0?<p className="muted" style={{fontSize:13,fontStyle:'italic',margin:'8px 0'}}>No members are currently scheduled for this shift.</p>:<ul className="roster-list">
    {roster.map(r=><li key={r.owner||r.id} className="roster-item" style={{flexDirection:'column',alignItems:'stretch',gap:6}}>
     <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <div>
       <strong className="roster-name">{r.name}</strong>
       {r.email&&<span className="roster-email">&lt;{r.email}&gt;</span>}
      </div>
      <div style={{display:'flex',gap:6}}>
       <button type="button" className="secondary sm-btn" onClick={()=>{setSwappingMemberId(swappingMemberId===r.owner?null:r.owner);setReplacementMemberId('');}}><PiArrowsLeftRight/> {swappingMemberId===r.owner?'Cancel':'Switch'}</button>
       <button type="button" className="secondary sm-btn danger-text" disabled={busy} onClick={async()=>{setBusy(true);await onRemove(r.owner);setBusy(false);}}><PiUserMinus/> Remove</button>
      </div>
     </div>
     {swappingMemberId===r.owner&&<div className="roster-swap-row">
      <select className="roster-swap-select" value={replacementMemberId} onChange={e=>setReplacementMemberId(e.target.value)}>
       <option value="">Select replacement member…</option>
       {unassignedMembers.map(m=><option key={m.id} value={m.id}>{memberLabel(m)}</option>)}
      </select>
      <button type="button" className="primary sm-btn" disabled={!replacementMemberId||busy} onClick={async()=>{setBusy(true);await onSwap(r.owner,replacementMemberId);setSwappingMemberId(null);setReplacementMemberId('');setBusy(false);}}>Confirm Switch</button>
     </div>}
    </li>)}
   </ul>}
  </div>
  <div className="roster-modal-section">
   <h4 style={{margin:'0 0 10px',fontSize:16}}>Assign Registered Member</h4>
   <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
    <select style={{flex:1,minWidth:200,padding:10,borderRadius:8,border:'1px solid #ebdcd5',background:'#fff'}} value={selectedMember} onChange={e=>setSelectedMember(e.target.value)}>
     <option value="">Choose a registered chapter member…</option>
     {unassignedMembers.map(m=><option key={m.id} value={m.id}>{memberLabel(m)}</option>)}
    </select>
    <button type="button" className="primary" style={{padding:'10px 16px',minHeight:42}} disabled={!selectedMember||busy} onClick={async()=>{setBusy(true);await onAssign(selectedMember);setSelectedMember('');setBusy(false);}}><PiUserPlus/> Assign to Shift</button>
   </div>
  </div>
  <div className="modal-actions" style={{marginTop:10}}>
   <button type="button" className="secondary" onClick={onClose}>Done</button>
  </div>
 </div>;
}

function DeleteMemberForm({member,onCancel,onDelete}){
 const [confirmation,setConfirmation]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 return <form onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{await onDelete(confirmation);}catch(err){setError(err.message);setBusy(false);}}}>
  <p>Delete the login for <b>{member.name}</b> ({member.email})? This permanently removes their sign-in account and hides them from the website.</p>
  <p>Their archived profile, volunteer records, and associated data will remain in the database for later studies and informatics. This does not erase their collected data.</p>
  <label>Type {member.email} to confirm<input type="email" required autoComplete="off" value={confirmation} disabled={busy} onChange={e=>setConfirmation(e.target.value)}/></label>
  {error&&<p className="login-error" role="alert">{error}</p>}
  <div className="modal-actions"><button type="button" className="secondary" disabled={busy} onClick={onCancel}>Cancel</button><button type="submit" className="primary" disabled={busy||confirmation.trim().toLowerCase()!==member.email.toLowerCase()}><PiTrash/> {busy?'Deleting…':'Permanently delete account'}</button></div>
 </form>;
}

function SavedAvailability({members,shift}){return <section className="saved-availability"><h4>Saved member availability</h4><p className="muted">Eastern Time · For the selected shift. Availability does not reserve a spot.</p>{members.length?<div style={{maxHeight:220,overflowY:'auto'}}>{members.map(m=>{const status=availabilityForShift(m,shift);return <div key={m.id} style={{borderBottom:'1px solid var(--line)',padding:'8px 0'}}><b>{m.name}</b><small style={{display:'block'}}>{status.label}</small><details><summary>Full saved week</summary><p className="muted">{Array.isArray(m.availability)&&m.availability.some(d=>d.enabled)?m.availability.filter(d=>d.enabled).map(d=>`${d.day}: ${d.start}–${d.end}`).join(' · '):'No availability selected'}</p></details></div>})}</div>:<p>No active members found.</p>}</section>}
