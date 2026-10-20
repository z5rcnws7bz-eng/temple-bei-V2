import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../worker/index.js';

function setup(){
  const sql=new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../drizzle/0000_empty_stone_men.sql',import.meta.url),'utf8'));
  const wrap=(q,args=[])=>({
    bind(...a){return wrap(q,a)},
    async first(){return sql.prepare(q).get(...args)||null},
    async all(){return {results:sql.prepare(q).all(...args)}},
    async run(){const r=sql.prepare(q).run(...args);return {meta:{changes:Number(r.changes)}}},
    q,
    args
  });
  const DB={
    prepare:q=>wrap(q),
    async batch(list){
      sql.exec('BEGIN');
      try{
        const r=[];
        for(const x of list)r.push(await x.run());
        sql.exec('COMMIT');
        return r;
      }catch(e){
        sql.exec('ROLLBACK');
        throw e;
      }
    }
  };
  const env={
    DB,
    ADMIN_EMAIL:'owner@temple.edu',
    EBOARD_PASSWORD_SHA256:'5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8', // 'password'
    ASSETS:{fetch:()=>new Response('app')}
  };
  const call=async(path,method='GET',body,user='alice',extra={})=>{
    const headers={...extra};
    if(user){
      headers['oai-authenticated-user-id']=user;
      headers['oai-authenticated-user-email']=user==='owner'?'owner@temple.edu':user+'@temple.edu';
    }
    if(method!=='GET')headers['Content-Type']='application/json';
    const response=await worker.fetch(new Request('https://bei.test/api/'+path,{
      method,
      headers,
      body:body===undefined?undefined:JSON.stringify(body)
    }),env);
    return {status:response.status,data:await response.json()};
  };
  return {call,env,sql};
}

test('cannot drop shift within 4 hours if regular member, but admin/owner can override', async () => {
  const {call} = setup();
  // Create a shift scheduled today in 1 hour
  const now = new Date();
  const todayStr = new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const startHour = String((now.getHours() + 1) % 24).padStart(2, '0');
  const endHour = String((now.getHours() + 2) % 24).padStart(2, '0');
  
  // Owner creates shift
  await call('board/shifts','POST',{
    date: todayStr,
    start: `${startHour}:00`,
    end: `${endHour}:00`,
    facility: 'Penn Memory Center',
    activity: 'Brain exercises',
    capacity: 2
  }, 'owner');

  const stateRes = await call('state', 'GET', undefined, 'alice');
  const shiftId = stateRes.data.shifts[0].id;

  // Alice books shift
  const bookRes = await call('shifts/book', 'POST', {id: shiftId}, 'alice');
  assert.equal(bookRes.status, 200);

  // Alice attempts to drop shift starting within 4 hours -> rejected with 403
  const dropRes = await call('shifts/drop', 'POST', {id: shiftId}, 'alice');
  assert.equal(dropRes.status, 403);
  assert.match(dropRes.data.error, /within 4 hours/i);

  // But owner/admin or e-board remove can remove Alice
  const removeRes = await call('board/shifts/remove', 'POST', {shiftId, memberId: 'alice'}, 'owner');
  assert.equal(removeRes.status, 200);

  // Alice's booking is now gone and shift spot is freed
  const stateAfter = await call('state', 'GET', undefined, 'alice');
  assert.equal(stateAfter.data.shifts[0].taken, 0);
  assert.equal(stateAfter.data.shifts[0].mine, false);
});

test('eboard and admin can assign registered members and swap members on shifts', async () => {
  const {call} = setup();
  // Register profiles for bob and charlie
  await call('state', 'GET', undefined, 'bob');
  await call('profile', 'PUT', {name: 'Bob Smith', major: 'Bio', year: '2026', bio: 'Bio'}, 'bob');
  await call('state', 'GET', undefined, 'charlie');
  await call('profile', 'PUT', {name: 'Charlie Davis', major: 'Neuro', year: '2027', bio: 'Bio'}, 'charlie');

  // Owner creates shift
  await call('board/shifts', 'POST', {
    date: '2099-11-15',
    start: '14:00',
    end: '15:00',
    facility: 'Philadelphia Senior Center',
    activity: 'Memory games',
    capacity: 3
  }, 'owner');

  const shiftId = (await call('state', 'GET', undefined, 'owner')).data.shifts[0].id;

  // Assign Bob to shift
  const assignRes = await call('board/shifts/assign', 'POST', {shiftId, memberId: 'bob'}, 'owner');
  assert.equal(assignRes.status, 200);

  // Roster check
  const boardData = await call('board', 'GET', undefined, 'owner');
  assert.equal(boardData.data.roster.some(r => r.shift_id === shiftId && r.owner === 'bob'), true);

  // Swap Bob with Charlie
  const swapRes = await call('board/shifts/swap', 'POST', {shiftId, memberOut: 'bob', memberIn: 'charlie'}, 'owner');
  assert.equal(swapRes.status, 200);

  // Verify Charlie is now in roster and Bob is not
  const boardAfterSwap = await call('board', 'GET', undefined, 'owner');
  assert.equal(boardAfterSwap.data.roster.some(r => r.shift_id === shiftId && r.owner === 'charlie'), true);
  assert.equal(boardAfterSwap.data.roster.some(r => r.shift_id === shiftId && r.owner === 'bob'), false);
});

test('officer self-approval recusal rule is enforced and coordinator availability data is provided', async () => {
  const {call} = setup();
  // Grant e-board to Alice
  await call('state', 'GET', undefined, 'alice');
  await call('admin/member', 'POST', {id: 'alice', eboard: true}, 'owner');

  // Alice saves availability
  const weekAvail = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(day => ({
    day,
    enabled: day === 'Friday',
    start: '14:00',
    end: '17:00'
  }));
  await call('availability', 'PUT', weekAvail, 'alice');

  // Verify coordinator board endpoint returns member availability
  const boardInfo = await call('board', 'GET', undefined, 'owner');
  const aliceOnBoard = boardInfo.data.members.find(m => m.id === 'alice');
  assert.ok(aliceOnBoard);
  assert.equal(aliceOnBoard.availability.find(d => d.day === 'Friday')?.enabled, true);

  // Alice (officer) logs volunteer hours
  await call('hours', 'POST', {
    date: '2026-10-15',
    hours: 2.0,
    activity: 'Brain exercise session',
    facility: 'Paul\'s Run Retirement Community',
    notes: 'Memory games with residents'
  }, 'alice');

  const aliceState = await call('state', 'GET', undefined, 'alice');
  const hourId = aliceState.data.hours[0].id;

  // Alice attempts to self-approve her own hours -> rejected with 403
  const selfApproveRes = await call('board/review', 'POST', {id: hourId, status: 'Approved'}, 'alice');
  assert.equal(selfApproveRes.status, 403);
  assert.match(selfApproveRes.data.error, /Officers cannot approve their own volunteer hours/i);

  // Owner / Chapter President approves Alice's hours -> succeeds
  const presidentApproveRes = await call('board/review', 'POST', {id: hourId, status: 'Approved'}, 'owner');
  assert.equal(presidentApproveRes.status, 200);

  const stateAfter = await call('state', 'GET', undefined, 'alice');
  assert.equal(stateAfter.data.hours[0].status, 'Approved');
  assert.equal(stateAfter.data.hours[0].reviewer, 'Jace Roman');
});

