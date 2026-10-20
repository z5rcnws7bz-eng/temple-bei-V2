import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../worker/index.js';
function setup(){const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../drizzle/0000_empty_stone_men.sql',import.meta.url),'utf8'));const wrap=(q,args=[])=>({bind(...a){return wrap(q,a)},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){const r=sql.prepare(q).run(...args);return {meta:{changes:Number(r.changes)}}},q,args});const DB={prepare:q=>wrap(q),async batch(list){sql.exec('BEGIN');try{const r=[];for(const x of list)r.push(await x.run());sql.exec('COMMIT');return r}catch(e){sql.exec('ROLLBACK');throw e}}};const env={DB,ADMIN_EMAIL:'owner@temple.edu',EBOARD_PASSWORD_SHA256:'',ASSETS:{fetch:()=>new Response('app')}};const call=async(path,method='GET',body,user='alice',extra={})=>{const headers={...extra};if(user){headers['oai-authenticated-user-id']=user;headers['oai-authenticated-user-email']=user==='owner'?'owner@temple.edu':user+'@temple.edu'}if(method!=='GET')headers['Content-Type']='application/json';const response=await worker.fetch(new Request('https://bei.test/api/'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),env);return {status:response.status,data:await response.json()}};return {call,env,sql}}
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),v=>v.toString(16).padStart(2,'0')).join('');
const entry={date:'2026-10-01',activity:'Brain exercises',facility:'Test facility',hours:2,status:'Approved',reviewer:'Forged'};
test('anonymous API requests are rejected',async()=>{const {call}=setup();assert.equal((await call('state','GET',undefined,null)).status,401)});
test('profiles are isolated and persist across requests',async()=>{const {call}=setup();await call('state');await call('profile','PUT',{name:'Alice A',major:'Biology',year:'2028',bio:'Hello'});const a=await call('state');assert.equal(a.data.user.name,'Alice A');assert.equal(a.data.profile.major,'Biology');assert.notEqual((await call('state','GET',undefined,'bob')).data.user.name,'Alice A')});
test('members cannot self-approve, access others hours, or remove them',async()=>{const {call}=setup();await call('hours','POST',entry);const a=(await call('state')).data;assert.equal(a.hours[0].status,'Pending');const id=a.hours[0].id;assert.equal((await call('state','GET',undefined,'bob')).data.hours.length,0);assert.equal((await call('hours','POST',{...entry,id},'bob')).status,404);await call('hours/remove','POST',{id},'bob');assert.equal((await call('state')).data.hours.length,1);assert.equal((await call('board/review','POST',{id,status:'Approved'})).status,403)});
test('owner admin is enforced on the server',async()=>{const {call}=setup();assert.equal((await call('admin')).status,403);assert.equal((await call('admin','GET',undefined,'owner')).status,200);assert.equal((await call('admin/member','POST',{id:'owner',disabled:true},'owner')).status,400)});
test('e-board password unlock does not grant admin access',async()=>{const {call,env}=setup();env.EBOARD_PASSWORD_SHA256=await hash('test-only-board-password');const headers={'x-board-username':'bei-eboard','x-board-password':'test-only-board-password'};assert.equal((await call('board/unlock','POST',{},'alice',headers)).status,200);assert.equal((await call('board','GET',undefined,'alice',headers)).status,200);assert.equal((await call('admin','GET',undefined,'alice',headers)).status,403)});
test('five incorrect e-board passwords lock further attempts',async()=>{const {call,env}=setup();env.EBOARD_PASSWORD_SHA256=await hash('correct');for(let i=0;i<5;i++)assert.equal((await call('board/unlock','POST',{},'alice',{'x-board-username':'bei-eboard','x-board-password':'wrong'})).status,403);assert.equal((await call('board/unlock','POST',{},'alice',{'x-board-username':'bei-eboard','x-board-password':'correct'})).status,429)});
test('approval and subsequent edits reset the review status',async()=>{const {call}=setup();await call('hours','POST',entry);const id=(await call('state')).data.hours[0].id;assert.equal((await call('board/review','POST',{id,status:'Approved'},'owner')).status,200);assert.equal((await call('state')).data.hours[0].reviewer,'Jace Roman');await call('hours','POST',{...entry,id,hours:3});assert.equal((await call('state')).data.hours[0].status,'Pending')});
test('removal and restoration persist and require reapproval',async()=>{const {call}=setup();await call('hours','POST',entry);const id=(await call('state')).data.hours[0].id;await call('board/review','POST',{id,status:'Approved'},'owner');await call('hours/remove','POST',{id});assert.equal((await call('state')).data.hours.length,0);await call('hours/restore','POST',{id});assert.equal((await call('state')).data.hours[0].status,'Pending')});
test('newsletter drafts stay private, published text is shared',async()=>{const {call}=setup();assert.equal((await call('board/newsletter','POST',{title:'News',body:'Hello',published:true})).status,403);await call('board/newsletter','POST',{title:'Draft',body:'Private',published:false},'owner');assert.equal((await call('state')).data.newsletters.length,0);await call('board/newsletter','POST',{title:'Published',body:'Hello',published:true},'owner');assert.equal((await call('state')).data.newsletters[0].body,'Hello')});
test('shift capacity, duplicate bookings and dropping are consistent',async()=>{const {call}=setup();await call('board/shifts','POST',{date:'2099-10-20',start:'15:00',end:'16:00',activity:'Test',facility:'Test center',capacity:1},'owner');const id=(await call('state')).data.shifts[0].id;assert.equal((await call('shifts/book','POST',{id})).status,200);assert.equal((await call('shifts/book','POST',{id})).status,400);assert.equal((await call('shifts/book','POST',{id},'bob')).status,400);await call('shifts/drop','POST',{id});await call('shifts/drop','POST',{id});assert.equal((await call('state')).data.shifts[0].taken,0);assert.equal((await call('shifts/book','POST',{id},'bob')).status,200)});
test('disabled members and cross-origin writes are rejected',async()=>{const {call}=setup();await call('state');await call('admin/member','POST',{id:'alice',disabled:true},'owner');assert.equal((await call('state')).status,403);assert.equal((await call('hours','POST',entry,'bob',{origin:'https://evil.test'})).status,403)});
test('invalid dates and time ranges are rejected',async()=>{const {call}=setup();assert.equal((await call('hours','POST',{...entry,date:'2026-02-30'})).status,400);assert.equal((await call('hours','POST',{...entry,hours:-2})).status,400);assert.equal((await call('board/shifts','POST',{date:'2099-01-01',start:'17:00',end:'15:00',capacity:1,activity:'Test',facility:'Test'},'owner')).status,400)});

test('directory exposes saved member profile fields without private account data',async()=>{const {call}=setup();await call('profile','PUT',{name:'Alice Biology',major:'Biology',year:'2028',bio:'I enjoy helping my community.'});await call('hours','POST',entry);const list=await call('directory','GET',undefined,'bob');assert.equal(list.status,200);const alice=list.data.members.find(m=>m.id==='alice');assert.equal(alice.name,'Alice Biology');assert.equal(alice.major,'Biology');assert.equal(alice.email,undefined);const detail=await call('directory/alice','GET',undefined,'bob');assert.equal(detail.data.member.bio,'I enjoy helping my community.');assert.deepEqual(Object.keys(detail.data.member).sort(),['id','name','major','year','bio'].sort());assert.equal((await call('directory','GET',undefined,null)).status,401);assert.equal((await call('directory/alice','GET',undefined,null)).status,401)});
test('directory excludes disabled members and profile edits are reflected',async()=>{const {call}=setup();await call('profile','PUT',{name:'Alice',major:'Chemistry',year:'2027',bio:'Original'});await call('profile','PUT',{name:'Alice Updated',major:'Biology',year:'2028',bio:'Updated bio'});assert.equal((await call('directory/alice','GET',undefined,'bob')).data.member.bio,'Updated bio');await call('admin/member','POST',{id:'alice',disabled:true},'owner');assert.equal((await call('directory','GET',undefined,'bob')).data.members.some(m=>m.id==='alice'),false);assert.equal((await call('directory/alice','GET',undefined,'bob')).status,404);assert.equal((await call('directory/missing','GET',undefined,'bob')).status,404)});

test('admin can grant and revoke eboard power to registered accounts and actions record under user name',async()=>{
 const {call}=setup();
 // Initialize alice and bob
 await call('state','GET',undefined,'alice');
 await call('profile','PUT',{name:'Alice Officer',major:'Neuroscience',year:'2027',bio:''},'alice');
 await call('state','GET',undefined,'bob');
 await call('profile','PUT',{name:'Bob Volunteer',major:'Psychology',year:'2028',bio:''},'bob');

 // Bob (regular volunteer) cannot access eboard endpoints
 assert.equal((await call('board','GET',undefined,'bob')).status,403);
 assert.equal((await call('board/newsletter','POST',{title:'Unauthorized',body:'Text',published:true},'bob')).status,403);

 // Admin grants E-board to Alice
 const grantRes=await call('admin/member','POST',{id:'alice',eboard:true},'owner');
 assert.equal(grantRes.status,200);

 // Alice's state now reflects eboard
 const aliceState=await call('state','GET',undefined,'alice');
 assert.equal(aliceState.data.user.eboard,true);

 // Alice can access eboard endpoints without password
 const aliceBoard=await call('board','GET',undefined,'alice');
 assert.equal(aliceBoard.status,200);

 // Alice creates shift and writes newsletter - recorded under Alice's profile name
 const shiftRes=await call('board/shifts','POST',{date:'2099-11-15',start:'14:00',end:'15:00',facility:'Sunrise Senior Living',activity:'Brain exercise session',capacity:4},'alice');
 assert.equal(shiftRes.status,200);

 const newsRes=await call('board/newsletter','POST',{title:'Officer Announcement',body:'Chapter meeting on Friday!',published:true},'alice');
 assert.equal(newsRes.status,200);

 const stateAfter=await call('state','GET',undefined,'alice');
 const createdShift=stateAfter.data.shifts.find(s=>s.facility==='Sunrise Senior Living');
 assert.equal(createdShift.createdBy,'Alice Officer');
 const createdNews=stateAfter.data.newsletters.find(n=>n.title==='Officer Announcement');
 assert.equal(createdNews.author,'Alice Officer');

 // Admin revokes E-board from Alice
 const revokeRes=await call('admin/member','POST',{id:'alice',eboard:false},'owner');
 assert.equal(revokeRes.status,200);
 assert.equal((await call('board','GET',undefined,'alice')).status,403);
});

test('Jace Roman admin account has 121 baseline approved hours and user hour submissions properly associate and pending',async()=>{
 const {call}=setup();
 // Check Jace Roman / owner initial state
 const ownerState=(await call('state','GET',undefined,'owner')).data;
 const approvedOwnerHours=ownerState.hours.filter(h=>h.status==='Approved');
 const totalOwnerHours=approvedOwnerHours.reduce((sum,h)=>sum+h.hours,0);
 assert.equal(totalOwnerHours,121.0);
 assert.equal(approvedOwnerHours.length,50);
 assert.equal(ownerState.user.name,'Jace Roman');
 assert.equal(approvedOwnerHours[0].volunteer,'Jace Roman');
 assert.equal(approvedOwnerHours[0].reviewer,'Executive Board');

 // Member submits new volunteer hours (without client id)
 const newSubmission={
  date:'2026-10-15',
  hours:2.5,
  activity:'Brain exercise session',
  facility:'Sunrise Senior Living of Granite Run',
  notes:'Memory and arithmetic session with 10 residents.'
 };
 const postRes=await call('hours','POST',newSubmission,'bob');
 assert.equal(postRes.status,200);

 // Verify bob's state has the new pending entry associated to bob
 const bobState=(await call('state','GET',undefined,'bob')).data;
 assert.equal(bobState.hours.length,1);
 assert.equal(bobState.hours[0].status,'Pending');
 assert.equal(bobState.hours[0].hours,2.5);
 assert.equal(bobState.hours[0].facility,'Sunrise Senior Living of Granite Run');

 // Verify owner can see and approve bob's pending hours
 const boardRes=(await call('board','GET',undefined,'owner')).data;
 const bobPendingOnBoard=boardRes.hours.find(h=>h.id===bobState.hours[0].id);
 assert.ok(bobPendingOnBoard);
 assert.equal(bobPendingOnBoard.status,'Pending');

 const approveRes=await call('board/review','POST',{id:bobState.hours[0].id,status:'Approved'},'owner');
 assert.equal(approveRes.status,200);

 // Verify bob's hours are now approved and credited
 const bobStateAfter=(await call('state','GET',undefined,'bob')).data;
 assert.equal(bobStateAfter.hours[0].status,'Approved');
 assert.equal(bobStateAfter.hours[0].reviewer,'Jace Roman');
});
