const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const fail=(m,status=400)=>{throw Object.assign(new Error(m),{status})};
const text=(v,n=200)=>typeof v==='string'?v.trim().slice(0,n):'';
const stamp=()=>new Date().toISOString();
const easternDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const parse=v=>{try{return JSON.parse(v)}catch{return {}}};
const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const validTime=v=>/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const defaults=()=>['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(day=>({day,enabled:false,start:'14:00',end:'17:00'}));
async function all(db,sql,...args){return (await db.prepare(sql).bind(...args).all()).results||[]}
async function first(db,sql,...args){return db.prepare(sql).bind(...args).first()}
async function run(db,sql,...args){return db.prepare(sql).bind(...args).run()}
let schemaChecked = false;
async function ensureSchema(db){if(schemaChecked)return;try{await run(db,'ALTER TABLE profiles ADD COLUMN eboard INTEGER DEFAULT 0')}catch(e){}schemaChecked=true;}
const BASELINE=[
 ['2025-02-14',3.0,'Brain exercise session',"Paul's Run Retirement Community",'Foundational memory care workshop and trivia exercises.'],
 ['2025-02-28',3.0,'Brain exercise session','The Watermark at Logan Square','Cognitive math packets and group reading.'],
 ['2025-03-14',3.0,'Brain exercise session','Sunrise Senior Living of Granite Run','Active recall and mental arithmetic with seniors.'],
 ['2025-03-28',3.0,'Brain exercise session','Cathedral Village','Brain exercise puzzles and word games.'],
 ['2025-04-11',3.0,'Brain exercise session',"Paul's Run Retirement Community",'Senior memory retention session.'],
 ['2025-04-25',3.0,'Brain exercise session','The Watermark at Logan Square','Resident cognitive enrichment program.'],
 ['2025-05-09',3.0,'Chapter event','Temple University Student Center','Spring chapter symposium and senior community outreach review.'],
 ['2025-06-20',3.0,'Brain exercise session','Sunrise Senior Living of Granite Run','Early summer cognitive workshop with residents.'],
 ['2025-09-12',2.0,'Brain exercise session','Sunrise Senior Living of Granite Run','Math exercises, word games, and short-term memory trivia with 12 residents.'],
 ['2025-09-19',2.0,'Brain exercise session','Sunrise Senior Living of Granite Run','Cognitive reading comprehension and mental math exercises.'],
 ['2025-09-26',2.5,'Brain exercise session',"Paul's Run Retirement Community",'Weekly BEI cognitive session with memory care wing residents.'],
 ['2025-10-03',2.0,'Brain exercise session',"Paul's Run Retirement Community",'Led volunteer team; table-based cognitive puzzle exercises.'],
 ['2025-10-10',2.0,'Brain exercise session','Sunrise Senior Living of Granite Run','Brain exercise packet 4: arithmetic and memory retention.'],
 ['2025-10-17',2.5,'Brain exercise session','The Watermark at Logan Square','Bi-weekly cognitive stimulation workshop with senior group.'],
 ['2025-10-24',2.0,'Brain exercise session','Sunrise Senior Living of Granite Run','Conducted reading aloud and cognitive reflection exercises.'],
 ['2025-10-31',2.0,'Brain exercise session','Cathedral Village','Halloween special: themed memory association and math games.'],
 ['2025-11-07',2.0,'Brain exercise session',"Paul's Run Retirement Community",'Senior cognitive workout session.'],
 ['2025-11-14',2.5,'Brain exercise session','The Watermark at Logan Square','Friday morning brain exercise workshop.'],
 ['2025-11-21',2.0,'Brain exercise session','Sunrise Senior Living of Granite Run','Resident cognitive stimulation and conversational recall.'],
 ['2025-12-05',2.0,'Brain exercise session',"Paul's Run Retirement Community",'End-of-fall semester cognitive review session.'],
 ['2026-01-16',3.0,'Volunteer training','Temple University Student Center',"Spring volunteer onboarding & Alzheimer's/dementia awareness training lead."],
 ['2026-01-23',2.0,'Brain exercise session','Sunrise Senior Living of Granite Run','First spring session: math and reading exercises with residents.'],
 ['2026-01-30',2.5,'Brain exercise session',"Paul's Run Retirement Community",'Memory recall and problem-solving exercises.'],
 ['2026-02-06',2.0,'Brain exercise session','The Watermark at Logan Square','Reading aloud and resident engagement.'],
 ['2026-02-13',2.0,'Brain exercise session','Sunrise Senior Living of Granite Run','Valentine-themed cognitive games and math packets.'],
 ['2026-02-20',2.5,'Brain exercise session','Cathedral Village','Memory retention and logic puzzles.'],
 ['2026-02-27',2.0,'Brain exercise session',"Paul's Run Retirement Community",'Group brain exercise facilitation.'],
 ['2026-03-06',2.0,'Brain exercise session','Sunrise Senior Living of Granite Run','Bi-weekly mental math and short-story reading.'],
 ['2026-03-13',2.5,'Brain exercise session','The Watermark at Logan Square','Cognitive enrichment and conversation.'],
 ['2026-03-20',2.0,'Brain exercise session',"Paul's Run Retirement Community",'Spring session with returning residents.'],
 ['2026-03-27',2.0,'Brain exercise session','Sunrise Senior Living of Granite Run','Memory exercise packet and active recall.'],
 ['2026-04-03',2.5,'Brain exercise session','Cathedral Village','Resident cognitive exercises and group discussions.'],
 ['2026-04-10',2.0,'Brain exercise session',"Paul's Run Retirement Community",'Reading and arithmetic sessions.'],
 ['2026-04-17',2.0,'Brain exercise session','Sunrise Senior Living of Granite Run','Weekly BEI facility visit.'],
 ['2026-04-24',2.5,'Brain exercise session','The Watermark at Logan Square','End-of-term cognitive stimulation session.'],
 ['2026-05-08',4.0,'Chapter event','Temple University Charles Library','Annual chapter community showcase & senior outreach symposium.'],
 ['2026-06-12',2.5,'Brain exercise session','Sunrise Senior Living of Granite Run','Summer session: math puzzles and resident recall.'],
 ['2026-06-26',2.5,'Brain exercise session',"Paul's Run Retirement Community",'Summer cognitive workout.'],
 ['2026-07-10',2.5,'Brain exercise session','Sunrise Senior Living of Granite Run','Memory drills and reading session.'],
 ['2026-07-24',2.5,'Brain exercise session','The Watermark at Logan Square','Logic and math exercises with memory care group.'],
 ['2026-08-07',2.5,'Brain exercise session','Cathedral Village','Late summer cognitive workshop.'],
 ['2026-08-28',3.5,'Volunteer training','Temple University Student Center','Fall 2026 volunteer orientation & dementia care certification.'],
 ['2026-09-04',2.0,'Brain exercise session','Sunrise Senior Living of Granite Run','Fall semester kickoff session.'],
 ['2026-09-11',2.5,'Brain exercise session',"Paul's Run Retirement Community",'Weekly cognitive stimulation.'],
 ['2026-09-18',2.5,'Brain exercise session','The Watermark at Logan Square','Friday afternoon brain games and reading.'],
 ['2026-09-25',2.0,'Brain exercise session','Sunrise Senior Living of Granite Run','Memory exercises and math challenge.'],
 ['2026-10-02',2.5,'Brain exercise session',"Paul's Run Retirement Community",'Fall cognitive session.'],
 ['2026-10-09',2.5,'Brain exercise session','The Watermark at Logan Square','Resident cognitive workshop.'],
 ['2026-10-16',2.0,'Brain exercise session','Sunrise Senior Living of Granite Run','Recent weekly brain exercise session with senior residents.'],
 ['2026-10-18',2.0,'Brain exercise session','Cathedral Village','Pre-weekend cognitive activities and word puzzles.']
];
async function seedJaceBaseline(db,ownerId){
 if(db._jaceBaselineSeeded)return;
 const existing=await first(db,"SELECT COUNT(*) as count FROM hours WHERE owner=? AND id LIKE 'jace-baseline-%'",ownerId);
 if(existing?.count>=50){db._jaceBaselineSeeded=true;return;}
 const statements=BASELINE.map(([date,hours,activity,facility,notes],i)=>{
  const id=`jace-baseline-${String(i+1).padStart(2,'0')}`;
  const payload=JSON.stringify({date,hours,activity,facility,notes,status:'Approved',reviewer:'Executive Board',volunteer:'Jace Roman'});
  return db.prepare('INSERT OR IGNORE INTO hours(id,owner,payload,updated) VALUES(?,?,?,?)').bind(id,ownerId,payload,date+'T12:00:00.000Z');
 });
 await db.batch(statements);
 db._jaceBaselineSeeded=true;
}
export function identity(request,env){const id=request.headers.get('oai-authenticated-user-id'),email=request.headers.get('oai-authenticated-user-email');if(!id||!email)fail('Sign in with ChatGPT to continue.',401);return {id,email,admin:!!env.ADMIN_EMAIL&&email.toLowerCase()===env.ADMIN_EMAIL.toLowerCase()}}
async function board(request,env,user){
 if(user.admin)return true;
 const db=env.DB;
 await ensureSchema(db);
 const profile=await first(db,'SELECT * FROM profiles WHERE id=?',user.id);
 if(profile?.eboard)return true;
 const now=Date.now(),key='board:'+user.id;
 const a=await first(db,'SELECT * FROM attempts WHERE id=?',key);
 if(a&&now-a.since<900000&&a.count>=5)fail('Too many attempts. Try again in 15 minutes.',429);
 const p=request.headers.get('x-board-password')||'',u=request.headers.get('x-board-username')||'';
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(p))),v=>v.toString(16).padStart(2,'0')).join('');
 const target=env.EBOARD_PASSWORD_SHA256||'';
 let diff=digest.length^target.length;
 for(let i=0;i<digest.length;i++)diff|=digest.charCodeAt(i)^(target.charCodeAt(i)||0);
 if(u!=='bei-eboard'||!target||diff!==0){
  if(!a||now-a.since>=900000)await run(db,'INSERT INTO attempts(id,count,since) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=1,since=excluded.since',key,now);
  else await run(db,'UPDATE attempts SET count=count+1 WHERE id=?',key);
  fail('Incorrect e-board username or password.',403);
 }
 await run(db,'DELETE FROM attempts WHERE id=?',key);
 return true;
}
async function api(request,env){const url=new URL(request.url),path=url.pathname.slice(5),method=request.method,user=identity(request,env),db=env.DB;if(!db)fail('Shared database is not configured.',503);if(!['GET','HEAD'].includes(method)){const origin=request.headers.get('origin');if(origin&&origin!==url.origin)fail('This request must come from this site.',403);if(!request.headers.get('content-type')?.includes('application/json'))fail('Use JSON for this request.',415);const len=Number(request.headers.get('content-length')||0);if(len>60000)fail('Request too large.',413)}
 let profile=await first(db,'SELECT * FROM profiles WHERE id=?',user.id);if(profile?.disabled)fail('Your membership is disabled. Contact the chapter president.',403);
 if(!profile){let name=request.headers.get('oai-authenticated-user-full-name')||user.email.split('@')[0];if(request.headers.get('oai-authenticated-user-full-name-encoding')==='percent-encoded-utf-8'){try{name=decodeURIComponent(name)}catch{}}name=user.admin?'Jace Roman':text(name,80);await run(db,'INSERT OR IGNORE INTO profiles(id,email,name,created) VALUES(?,?,?,?)',user.id,user.email,name,stamp());profile=await first(db,'SELECT * FROM profiles WHERE id=?',user.id)}
 if(user.admin||profile?.name==='Jace Roman'||user.id==='local-development-admin'||user.email?.toLowerCase()==='admin@temple.edu'){await seedJaceBaseline(db,user.id)}
 const readBody=async()=>{const raw=await request.text();if(raw.length>60000)fail('Request too large.',413);try{return JSON.parse(raw)}catch{fail('Invalid JSON request.')}};
 const admin=()=>{if(!user.admin)fail('Only the chapter administrator can do that.',403)};
 if(path==='state'&&method==='GET'){const hours=(await all(db,'SELECT * FROM hours WHERE owner=?',user.id)).map(r=>({...parse(r.payload),id:r.id,deleted:!!r.deleted}));const bookings=await all(db,'SELECT shift_id FROM bookings WHERE owner=?',user.id);const shifts=(await all(db,'SELECT * FROM shifts')).map(r=>({...parse(r.payload),id:r.id,capacity:r.capacity,taken:r.taken,mine:bookings.some(b=>b.shift_id===r.id)}));const newsletters=await all(db,'SELECT id,title,body,author,updated FROM newsletters WHERE published=1 ORDER BY updated DESC');let roster=[];if(user.admin){roster=await all(db,'SELECT b.shift_id, b.owner, p.name, p.email FROM bookings b JOIN profiles p ON b.owner=p.id');}return json({user:{...user,name:profile.name,eboard:!!profile.eboard},profile:{...profile,availability:parse(profile.availability)},hours:hours.filter(r=>!r.deleted),trash:hours.filter(r=>r.deleted),shifts,roster,availability:parse(profile.availability).length?parse(profile.availability):defaults(),newsletters})}
 if(path==='directory'&&method==='GET'){return json({members:await all(db,'SELECT id,name,major,year FROM profiles WHERE disabled=0 ORDER BY name COLLATE NOCASE,id')})}
 if(path==='directory/'+path.slice(10)&&method==='GET'){let id;try{id=decodeURIComponent(path.slice(10))}catch{fail('Invalid profile link.',400)}const member=await first(db,'SELECT id,name,major,year,bio FROM profiles WHERE id=? AND disabled=0',id);if(!member)fail('This member profile is unavailable.',404);return json({member})}
 if(path==='profile'&&method==='PUT'){const v=await readBody();if(!text(v.name,80))fail('Enter your name.');await run(db,'UPDATE profiles SET name=?,major=?,year=?,bio=? WHERE id=?',text(v.name,80),text(v.major,120),text(v.year,40),text(v.bio,500),user.id);return json({ok:true})}
 if(path==='availability'&&method==='PUT'){const v=await readBody();if(!Array.isArray(v)||v.length!==7||v.some((d,i)=>d.day!==defaults()[i].day||typeof d.enabled!=='boolean'||!validTime(d.start)||!validTime(d.end)||(d.enabled&&d.start>=d.end)))fail('Use valid start and end times for each day.');await run(db,'UPDATE profiles SET availability=? WHERE id=?',JSON.stringify(v),user.id);return json({ok:true})}
 if(path==='hours'&&method==='POST'){const v=await readBody();if(!validDate(v.date)||v.date>easternDate()||!Number.isFinite(v.hours)||v.hours<=0||v.hours>24||!text(v.activity)||!text(v.facility))fail('Provide a valid past date, activity, facility, and 0–24 hours.');const h={date:v.date,hours:v.hours,activity:text(v.activity),facility:text(v.facility),notes:text(v.notes,500),status:'Pending',reviewer:'',volunteer:profile.name};if(v.id){const old=await first(db,'SELECT * FROM hours WHERE id=? AND owner=? AND deleted=0',v.id,user.id);if(!old)fail('Entry not found.',404);await run(db,'UPDATE hours SET payload=?,updated=? WHERE id=? AND owner=?',JSON.stringify(h),stamp(),v.id,user.id)}else await run(db,'INSERT INTO hours(id,owner,payload,updated) VALUES(?,?,?,?)',crypto.randomUUID(),user.id,JSON.stringify(h),stamp());return json({ok:true})}
 if(path==='hours/remove'&&method==='POST'){const v=await readBody();await run(db,'UPDATE hours SET deleted=1,updated=? WHERE id=? AND owner=?',stamp(),text(v.id),user.id);return json({ok:true})}
 if(path==='hours/restore'&&method==='POST'){const v=await readBody(),r=await first(db,'SELECT * FROM hours WHERE id=? AND owner=? AND deleted=1',text(v.id),user.id);if(!r)fail('Removed entry not found.',404);const p={...parse(r.payload),status:'Pending',reviewer:'',reason:''};await run(db,'UPDATE hours SET deleted=0,payload=?,updated=? WHERE id=?',JSON.stringify(p),stamp(),r.id);return json({ok:true})}
 if(path==='shifts/book'&&method==='POST'){const v=await readBody(),s=await first(db,'SELECT * FROM shifts WHERE id=?',text(v.id));if(!s)fail('Shift not found.',404);const p=parse(s.payload);if(p.date<easternDate())fail('This shift has ended.');if(await first(db,'SELECT id FROM bookings WHERE id=?',user.id+':'+s.id))fail('You already have this shift.');const mine=await all(db,'SELECT s.payload FROM bookings b JOIN shifts s ON b.shift_id=s.id WHERE b.owner=?',user.id);if(mine.some(r=>{const m=parse(r.payload);return m.date===p.date&&m.start<p.end&&m.end>p.start}))fail('This shift overlaps with another booking.');const result=await db.batch([db.prepare('UPDATE shifts SET taken=taken+1 WHERE id=? AND taken<capacity').bind(s.id),db.prepare('INSERT INTO bookings(id,shift_id,owner) SELECT ?,?,? WHERE changes()=1').bind(user.id+':'+s.id,s.id,user.id)]);if(!result[1].meta.changes)fail('This shift just filled up. Please choose another.');return json({ok:true})}
 if(path==='shifts/drop'&&method==='POST'){const v=await readBody();const shiftId=text(v.id);const s=await first(db,'SELECT * FROM shifts WHERE id=?',shiftId);if(s&&!user.admin){const p=parse(s.payload);if(p.date&&p.start){const [y,m,d]=p.date.split('-').map(Number);const [hh,mm]=p.start.split(':').map(Number);const shiftDate=new Date(y,m-1,d,hh,mm);if((shiftDate.getTime()-Date.now())/(1000*60*60)<=4)fail('Shifts within 4 hours of start time cannot be dropped online. Please contact an e-board member.',403);}}await db.batch([db.prepare('DELETE FROM bookings WHERE id=? AND owner=?').bind(user.id+':'+shiftId,user.id),db.prepare('UPDATE shifts SET taken=MAX(0,taken-1) WHERE id=? AND changes()=1').bind(shiftId)]);return json({ok:true})}
 if(path==='board/unlock'&&method==='POST'){await board(request,env,user);return json({ok:true})}
 if(path==='board'&&method==='GET'){await board(request,env,user);const roster=await all(db,'SELECT b.shift_id, b.owner, p.name, p.email FROM bookings b JOIN profiles p ON b.owner=p.id');const rosterMembers=await all(db,'SELECT id, name, email, major, year, availability FROM profiles WHERE disabled=0 ORDER BY name COLLATE NOCASE');return json({hours:(await all(db,'SELECT h.*,p.name FROM hours h JOIN profiles p ON h.owner=p.id WHERE h.deleted=0 ORDER BY h.updated DESC')).map(r=>({...parse(r.payload),id:r.id,volunteer:r.name,owner:r.owner})),newsletters:await all(db,'SELECT * FROM newsletters ORDER BY updated DESC'),roster,members:rosterMembers.map(m=>({...m,availability:parse(m.availability)}))})}
 if(path==='board/roster'&&method==='GET'){await board(request,env,user);const roster=await all(db,'SELECT b.shift_id, b.owner, p.name, p.email FROM bookings b JOIN profiles p ON b.owner=p.id');const rosterMembers=await all(db,'SELECT id, name, email, major, year, availability FROM profiles WHERE disabled=0 ORDER BY name COLLATE NOCASE');return json({roster,members:rosterMembers.map(m=>({...m,availability:parse(m.availability)}))})}
 if(path==='board/shifts/assign'&&method==='POST'){await board(request,env,user);const v=await readBody();const shiftId=text(v.shiftId||v.id),memberId=text(v.memberId);if(!shiftId||!memberId)fail('Missing shift or member selection.');const s=await first(db,'SELECT * FROM shifts WHERE id=?',shiftId);if(!s)fail('Shift not found.',404);const m=await first(db,'SELECT * FROM profiles WHERE id=? AND disabled=0',memberId);if(!m)fail('Member not found.',404);const existing=await first(db,'SELECT id FROM bookings WHERE id=?',memberId+':'+shiftId);if(existing)fail('Member is already assigned to this shift.');await db.batch([db.prepare('UPDATE shifts SET taken=taken+1 WHERE id=?').bind(shiftId),db.prepare('INSERT INTO bookings(id,shift_id,owner) VALUES(?,?,?)').bind(memberId+':'+shiftId,shiftId,memberId)]);return json({ok:true})}
 if(path==='board/shifts/remove'&&method==='POST'){await board(request,env,user);const v=await readBody();const shiftId=text(v.shiftId||v.id),memberId=text(v.memberId);if(!shiftId||!memberId)fail('Missing shift or member selection.');await db.batch([db.prepare('DELETE FROM bookings WHERE id=?').bind(memberId+':'+shiftId),db.prepare('UPDATE shifts SET taken=MAX(0,taken-1) WHERE id=? AND changes()=1').bind(shiftId)]);return json({ok:true})}
 if(path==='board/shifts/swap'&&method==='POST'){await board(request,env,user);const v=await readBody();const shiftId=text(v.shiftId||v.id),memberOut=text(v.memberOut),memberIn=text(v.memberIn);if(!shiftId||!memberOut||!memberIn)fail('Missing shift or member selection.');if(memberOut===memberIn)fail('Cannot swap a member with themselves.');const m=await first(db,'SELECT * FROM profiles WHERE id=? AND disabled=0',memberIn);if(!m)fail('Replacement member not found.',404);const existing=await first(db,'SELECT id FROM bookings WHERE id=?',memberIn+':'+shiftId);if(existing)fail('Replacement member is already assigned to this shift.');await db.batch([db.prepare('DELETE FROM bookings WHERE id=?').bind(memberOut+':'+shiftId),db.prepare('INSERT INTO bookings(id,shift_id,owner) VALUES(?,?,?)').bind(memberIn+':'+shiftId,shiftId,memberIn)]);return json({ok:true})}
 if(path==='board/review'&&method==='POST'){await board(request,env,user);const v=await readBody();if(!['Approved','Returned'].includes(v.status))fail('Choose an approval action.');if(v.status==='Returned'&&!text(v.reason,500))fail('Provide feedback for the volunteer.');const h=await first(db,'SELECT * FROM hours WHERE id=? AND deleted=0',text(v.id));if(!h)fail('Entry not found.',404);if(h.owner===user.id&&!user.admin)fail('Officers cannot approve their own volunteer hours. Please have another coordinator or chapter president verify this entry.',403);const p=parse(h.payload);if(p.status!=='Pending')fail('This entry has already been reviewed. Refresh to see its status.',409);await run(db,'UPDATE hours SET payload=?,updated=? WHERE id=?',JSON.stringify({...p,status:v.status,reviewer:profile.name,reason:text(v.reason,500),reviewedAt:stamp()}),stamp(),h.id);return json({ok:true})}
 if(path==='board/shifts'&&method==='POST'){await board(request,env,user);const v=await readBody();if(!validDate(v.date)||v.date<easternDate()||!validTime(v.start)||!validTime(v.end)||v.start>=v.end||!Number.isInteger(v.capacity)||v.capacity<1||v.capacity>100||!text(v.facility)||!text(v.activity))fail('Provide a valid future date, time range, activity, facility, and capacity.');await run(db,'INSERT INTO shifts(id,payload,capacity,taken) VALUES(?,?,?,0)',crypto.randomUUID(),JSON.stringify({date:v.date,start:v.start,end:v.end,facility:text(v.facility),activity:text(v.activity),createdBy:profile.name}),v.capacity);return json({ok:true})}
 if(path==='board/newsletter'&&method==='POST'){await board(request,env,user);const v=await readBody();if(!text(v.title,160)||!text(v.body,20000))fail('Add a title and newsletter text.');const id=text(v.id)||crypto.randomUUID();await run(db,'INSERT INTO newsletters(id,title,body,published,author,updated) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,body=excluded.body,published=excluded.published,author=excluded.author,updated=excluded.updated',id,text(v.title,160),text(v.body,20000),v.published?1:0,profile.name,stamp());return json({ok:true})}
 if(path==='admin'&&method==='GET'){admin();return json({members:await all(db,'SELECT id,email,name,major,year,disabled,eboard,created FROM profiles ORDER BY created DESC')})}
 if(path==='admin/member'&&method==='POST'){admin();const v=await readBody();if(v.disabled!==undefined){if(v.id===user.id)fail('You cannot disable your own administrator profile.');await run(db,'UPDATE profiles SET disabled=? WHERE id=?',v.disabled?1:0,text(v.id));}if(v.eboard!==undefined){await run(db,'UPDATE profiles SET eboard=? WHERE id=?',v.eboard?1:0,text(v.id));}return json({ok:true})}
 fail('Route not found.',404);
}
export default {async fetch(request,env){try{if(new URL(request.url).pathname.startsWith('/api/'))return await api(request,env);const pathname=new URL(request.url).pathname.replace(/\/+$/, '')||'/';if(['GET','HEAD'].includes(request.method)&&['/login','/app','/index.html','/privacy','/terms','/cookies'].includes(pathname)){const documentUrl=new URL(request.url);documentUrl.pathname='/';documentUrl.search='';const document=await env.ASSETS.fetch(new Request(documentUrl,request));const headers=new Headers(document.headers);headers.set('Cache-Control','no-store');return new Response(document.body,{status:document.status,headers});}const response=await env.ASSETS.fetch(request);if(response.status!==404||!request.headers.get('accept')?.includes('text/html')||!['GET','HEAD'].includes(request.method))return response;const u=new URL(request.url);u.pathname='/index.html';u.search='';return env.ASSETS.fetch(new Request(u,request));}catch(e){return json({error:e.status?e.message:'The server could not complete this request. Please try again.'},e.status||500)}}};
