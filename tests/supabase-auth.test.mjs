import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSupabaseUrl, signUp, signInWithPassword} from '../src/supabase.js';

test('Supabase dashboard API URLs resolve to the project root', () => {
  for (const suffix of ['', '/', '/rest/v1', '/rest/v1/', '/auth/v1/']) {
    assert.equal(normalizeSupabaseUrl(' https://project.supabase.co' + suffix + ' '), 'https://project.supabase.co');
  }
  assert.throws(() => normalizeSupabaseUrl('https://project.supabase.co/unexpected'));
  assert.throws(() => normalizeSupabaseUrl('javascript:alert(1)'));
});

test('production fails clearly instead of simulating registration or an admin login', async () => {
  await assert.rejects(signUp({email:'member@temple.edu',password:'test-password',name:'Member'}), /not configured/);
  await assert.rejects(signInWithPassword({email:'admin@temple.edu',password:'admin123'}), /not configured/);
});

test('invitation callback verifies identity and uses server-owned roles', async () => {
  const {acceptEmailLink, getStoredSession} = await import('../src/supabase.js');
  const store = new Map();
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  const originalStorage = globalThis.localStorage;
  globalThis.localStorage = {getItem:k=>store.get(k), setItem:(k,v)=>store.set(k,v), removeItem:k=>store.delete(k)};
  let replaced = false;
  globalThis.window = {location:{hash:'#access_token=test-token&type=invite',pathname:'/login',search:''},history:{replaceState:()=>{replaced=true}}};
  globalThis.fetch = async (url, options) => {
    assert.match(url,/\/auth\/v1\/user$/);
    assert.equal(options.headers.Authorization,'Bearer test-token');
    return new Response(JSON.stringify({id:'test-id',email:'officer@temple.edu',app_metadata:{portal_role:'admin'},user_metadata:{name:'Officer'}}));
  };
  try {
    const result = await acceptEmailLink();
    assert.equal(result.needsPassword,true);
    assert.equal(result.session.user.admin,true);
    assert.equal(getStoredSession().user.name,'Officer');
    assert.equal(replaced,true);
    globalThis.window.location.hash='#access_token=expired&type=invite';
    globalThis.fetch=async()=>new Response('{}',{status:401});
    await assert.rejects(acceptEmailLink(), /expired/);
  } finally {globalThis.fetch=originalFetch;globalThis.window=originalWindow;globalThis.localStorage=originalStorage;}
});

test('directory uses the authenticated Supabase endpoint and preserves account IDs', async () => {
  const {supabasePortalRequest,setStoredSession}=await import('../src/supabase.js');
  const originalFetch=globalThis.fetch;
  const storageDescriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  const store=new Map();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)}});
  setStoredSession({access_token:'directory-test-token',user:{id:'reader'}});
  const people=[{id:'account-one',name:'Same Name',major:'Biology',year:'2027'},{id:'account-two',name:'Same Name',major:'Chemistry',year:'2028'}];
  let calls=0;
  globalThis.fetch=async(url,options)=>{
    assert.match(url,/\/rest\/v1\/rpc\/portal_directory$/);
    assert.equal(options.headers.Authorization,'Bearer directory-test-token');
    const payload=JSON.parse(options.body);
    calls++;
    if(calls===1){assert.equal(payload.member_id,null);return new Response(JSON.stringify({members:people}));}
    if(calls===2){assert.equal(payload.member_id,'account-two');return new Response(JSON.stringify({member:{...people[1],bio:'Current profile'}}));}
    return new Response(JSON.stringify({message:'Session expired'}),{status:401});
  };
  try{
    assert.deepEqual((await supabasePortalRequest('directory')).members,people);
    assert.equal((await supabasePortalRequest('directory/account-two')).member.bio,'Current profile');
    await assert.rejects(supabasePortalRequest('directory'),/Session expired/);
  }finally{
    globalThis.fetch=originalFetch;
    if(storageDescriptor)Object.defineProperty(globalThis,'localStorage',storageDescriptor);else delete globalThis.localStorage;
  }
});

test('Jace can sign in only through Admin and Admin requires server-assigned admin role', async()=>{
  const {assertLoginPortal}=await import('../src/supabase.js');
  for(const portal of ['Member','E-board'])assert.throws(()=>assertLoginPortal(' JACE.ROMAN@TEMPLE.EDU ',portal),/Admin section/);
  assert.doesNotThrow(()=>assertLoginPortal('jace.roman@temple.edu','Admin',{app_metadata:{portal_role:'admin'}}));
  assert.throws(()=>assertLoginPortal('member@temple.edu','Admin',{app_metadata:{}}),/does not have administrator/);
  assert.doesNotThrow(()=>assertLoginPortal('member@temple.edu','Member',{app_metadata:{}}));
});

test('account deletion uses the protected RPC and forwards explicit email confirmation',async()=>{
 const {supabasePortalRequest,setStoredSession}=await import('../src/supabase.js');
 const originalFetch=globalThis.fetch;
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 const store=new Map();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)}});
 setStoredSession({access_token:'admin-test-token',user:{id:'admin'}});
 globalThis.fetch=async(url,options)=>{
  assert.match(url,/\/rpc\/portal_delete_member$/);
  assert.equal(options.headers.Authorization,'Bearer admin-test-token');
  assert.deepEqual(JSON.parse(options.body),{member_id:'target',confirmation_email:'target@example.invalid'});
  return new Response(JSON.stringify({message:'Only chapter administrators can delete accounts.'}),{status:403});
 };
 try{await assert.rejects(supabasePortalRequest('admin/member/delete','POST',{id:'target',confirmationEmail:'target@example.invalid'}),/Only chapter administrators/);}
 finally{globalThis.fetch=originalFetch;if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete globalThis.localStorage;}
});

test('photo, year, and bio are sent together to the authenticated profile save RPC',async()=>{
 const {supabasePortalRequest,setStoredSession}=await import('../src/supabase.js');
 const fetchBefore=globalThis.fetch,storageBefore=Object.getOwnPropertyDescriptor(globalThis,'localStorage');const store=new Map();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)}});
 const profile={name:'Member',major:'Biology',year:'2028',bio:'My saved bio',photo_data_url:'data:image/jpeg;base64,/9j/4P/Z'};
 setStoredSession({access_token:'profile-test-token',user:{id:'profile-owner'}});
 globalThis.fetch=async(url,options)=>{assert.match(url,/\/rpc\/portal_update_profile$/);assert.equal(options.headers.Authorization,'Bearer profile-test-token');assert.deepEqual(JSON.parse(options.body),{profile_data:profile});return new Response('{"ok":true}');};
 try{assert.equal((await supabasePortalRequest('profile','PUT',profile)).ok,true);}
 finally{globalThis.fetch=fetchBefore;if(storageBefore)Object.defineProperty(globalThis,'localStorage',storageBefore);else delete globalThis.localStorage;}
});

test('shift creation routes to authenticated Supabase persistence',async()=>{
 const {supabasePortalRequest,setStoredSession}=await import('../src/supabase.js');
 const fetchBefore=globalThis.fetch,storageBefore=Object.getOwnPropertyDescriptor(globalThis,'localStorage');const store=new Map();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)}});
 const shift={id:'retry-safe-id',date:'2026-12-01',start:'15:00',end:'16:00',facility:'Test',activity:'Reading',capacity:4};
 setStoredSession({access_token:'shift-test-token',user:{id:'officer'}});
 globalThis.fetch=async(url,options)=>{assert.match(url,/\/rpc\/portal_create_shift$/);assert.equal(options.headers.Authorization,'Bearer shift-test-token');assert.deepEqual(JSON.parse(options.body),{shift_data:shift});return new Response('{"ok":true}');};
 try{assert.equal((await supabasePortalRequest('board/shifts','POST',shift)).ok,true);}
 finally{globalThis.fetch=fetchBefore;if(storageBefore)Object.defineProperty(globalThis,'localStorage',storageBefore);else delete globalThis.localStorage;}
});

test('all hour mutations use the protected audited Supabase RPC',async()=>{
 const {supabasePortalRequest,setStoredSession}=await import('../src/supabase.js');
 const fetchBefore=globalThis.fetch,storageBefore=Object.getOwnPropertyDescriptor(globalThis,'localStorage');const store=new Map();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)}});
 setStoredSession({access_token:'hours-test-token',user:{id:'member'}});
 let action;
 globalThis.fetch=async(url,options)=>{assert.match(url,/\/rpc\/portal_hours_action$/);assert.equal(options.headers.Authorization,'Bearer hours-test-token');assert.deepEqual(JSON.parse(options.body),{action,entry_data:{id:'entry'}});return new Response('{"ok":true}');};
 try{for(action of ['hours','hours/remove','hours/restore','board/review'])assert.equal((await supabasePortalRequest(action,'POST',{id:'entry'})).ok,true);}
 finally{globalThis.fetch=fetchBefore;if(storageBefore)Object.defineProperty(globalThis,'localStorage',storageBefore);else delete globalThis.localStorage;}
});

test('availability is saved through the account-bound RPC',async()=>{
 const {supabasePortalRequest,setStoredSession}=await import('../src/supabase.js');
 const fetchBefore=globalThis.fetch,storageBefore=Object.getOwnPropertyDescriptor(globalThis,'localStorage');const store=new Map();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)}});
 setStoredSession({access_token:'availability-test-token',user:{id:'member'}});
 const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(day=>({day,enabled:false,start:'09:00',end:'12:00'}));
 globalThis.fetch=async(url,options)=>{assert.match(url,/\/rpc\/portal_save_availability$/);assert.equal(options.headers.Authorization,'Bearer availability-test-token');assert.deepEqual(JSON.parse(options.body),{availability_data:days});return new Response('{"ok":true}');};
 try{assert.equal((await supabasePortalRequest('availability','PUT',days)).ok,true);}
 finally{globalThis.fetch=fetchBefore;if(storageBefore)Object.defineProperty(globalThis,'localStorage',storageBefore);else delete globalThis.localStorage;}
});

test('coordinator roster mutations route to authenticated Supabase transactions',async()=>{
 const {supabasePortalRequest,setStoredSession}=await import('../src/supabase.js');
 const fetchBefore=globalThis.fetch,storageBefore=Object.getOwnPropertyDescriptor(globalThis,'localStorage');const store=new Map();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)}});
 setStoredSession({access_token:'roster-test-token',user:{id:'officer'}});
 let action;
 globalThis.fetch=async(url,options)=>{assert.match(url,/\/rpc\/portal_roster_action$/);assert.equal(options.headers.Authorization,'Bearer roster-test-token');assert.deepEqual(JSON.parse(options.body),{action,roster_data:{shiftId:'shift',memberId:'member'}});return new Response('{"ok":true}');};
 try{for(action of ['board/shifts/assign','board/shifts/remove','board/shifts/swap'])assert.equal((await supabasePortalRequest(action,'POST',{shiftId:'shift',memberId:'member'})).ok,true);}
 finally{globalThis.fetch=fetchBefore;if(storageBefore)Object.defineProperty(globalThis,'localStorage',storageBefore);else delete globalThis.localStorage;}
});

test('newsletter saves use protected author-aware RPC',async()=>{
 const {supabasePortalRequest,setStoredSession}=await import('../src/supabase.js');
 const fetchBefore=globalThis.fetch,storageBefore=Object.getOwnPropertyDescriptor(globalThis,'localStorage');const store=new Map();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)}});
 setStoredSession({access_token:'newsletter-test-token',user:{id:'officer'}});
 const post={title:'Hello',body:'https://temple.edu',published:true,images:[]};
 globalThis.fetch=async(url,options)=>{assert.match(url,/\/rpc\/portal_save_newsletter$/);assert.equal(options.headers.Authorization,'Bearer newsletter-test-token');assert.deepEqual(JSON.parse(options.body),{newsletter_data:post});return new Response('{"ok":true}');};
 try{assert.equal((await supabasePortalRequest('board/newsletter','POST',post)).ok,true);}
 finally{globalThis.fetch=fetchBefore;if(storageBefore)Object.defineProperty(globalThis,'localStorage',storageBefore);else delete globalThis.localStorage;}
});
test('expired API sessions refresh once and retry with renewed credentials',async()=>{
 const {supabasePortalRequest,setStoredSession,getStoredSession}=await import('../src/supabase.js');
 const fetchBefore=globalThis.fetch,storageBefore=Object.getOwnPropertyDescriptor(globalThis,'localStorage');const store=new Map();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)}});
 setStoredSession({access_token:'expired',refresh_token:'refresh-one',user:{id:'member'}});let calls=0;
 globalThis.fetch=async(url,options)=>{calls++;if(calls===1)return new Response('{"message":"JWT expired"}',{status:401});if(calls===2){assert.match(url,/grant_type=refresh_token/);assert.equal(JSON.parse(options.body).refresh_token,'refresh-one');return new Response('{"access_token":"renewed","refresh_token":"refresh-two"}');}assert.equal(options.headers.Authorization,'Bearer renewed');return new Response('{"ok":true}');};
 try{assert.equal((await supabasePortalRequest('state')).ok,true);assert.equal(calls,3);assert.equal(getStoredSession().refresh_token,'refresh-two');}
 finally{globalThis.fetch=fetchBefore;if(storageBefore)Object.defineProperty(globalThis,'localStorage',storageBefore);else delete globalThis.localStorage;}
});

test('member pickup and drop use account-bound booking transactions',async()=>{
 const {supabasePortalRequest,setStoredSession}=await import('../src/supabase.js');
 const fetchBefore=globalThis.fetch,storageBefore=Object.getOwnPropertyDescriptor(globalThis,'localStorage');const store=new Map();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)}});
 setStoredSession({access_token:'booking-test-token',user:{id:'member'}});let action;
 globalThis.fetch=async(url,options)=>{assert.match(url,/\/rpc\/portal_booking_action$/);assert.equal(options.headers.Authorization,'Bearer booking-test-token');assert.deepEqual(JSON.parse(options.body),{action,booking_data:{id:'shift'}});return new Response('{"ok":true}');};
 try{for(action of ['shifts/book','shifts/drop'])assert.equal((await supabasePortalRequest(action,'POST',{id:'shift'})).ok,true);}
 finally{globalThis.fetch=fetchBefore;if(storageBefore)Object.defineProperty(globalThis,'localStorage',storageBefore);else delete globalThis.localStorage;}
});

test('password reset sends registered email to Auth with the production reset landing URL',async()=>{
 const {requestPasswordReset}=await import('../src/supabase.js');const fetchBefore=globalThis.fetch,windowBefore=globalThis.window;
 globalThis.window={location:{origin:'https://temple-bei-v2.vercel.app'}};
 globalThis.fetch=async(url,options)=>{assert.match(url,/\/auth\/v1\/recover\?redirect_to=/);assert.equal(new URL(url).searchParams.get('redirect_to'),'https://temple-bei-v2.vercel.app/login');assert.deepEqual(JSON.parse(options.body),{email:'member@temple.edu'});return new Response('{}');};
 try{assert.match(await requestPasswordReset(' Member@Temple.edu '),/If this email has a registered account/);await assert.rejects(requestPasswordReset('bad'),/valid registered email/);}
 finally{globalThis.fetch=fetchBefore;if(windowBefore===undefined)delete globalThis.window;else globalThis.window=windowBefore;}
});
test('password reset exposes sending limits without pretending an email was delivered',async()=>{
 const {requestPasswordReset}=await import('../src/supabase.js');const fetchBefore=globalThis.fetch,windowBefore=globalThis.window;globalThis.window={location:{origin:'https://temple-bei-v2.vercel.app'}};
 globalThis.fetch=async()=>new Response('{"msg":"email rate limit exceeded"}',{status:429});
 try{await assert.rejects(requestPasswordReset('member@temple.edu'),/sending limit/);}finally{globalThis.fetch=fetchBefore;if(windowBefore===undefined)delete globalThis.window;else globalThis.window=windowBefore;}
});
test('verified recovery links open reset mode and remove credentials from the URL',async()=>{
 const {acceptEmailLink,getStoredSession}=await import('../src/supabase.js');const fetchBefore=globalThis.fetch,windowBefore=globalThis.window,storageBefore=Object.getOwnPropertyDescriptor(globalThis,'localStorage');const store=new Map();let cleaned;
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)}});
 globalThis.window={location:{hash:'#access_token=recovery-token&refresh_token=recovery-refresh&type=recovery',pathname:'/login',search:'?reset=1'},history:{replaceState:(a,b,url)=>{cleaned=url;}}};
 globalThis.fetch=async(url,options)=>{assert.match(url,/\/auth\/v1\/user$/);assert.equal(options.headers.Authorization,'Bearer recovery-token');return new Response(JSON.stringify({id:'member',email:'member@temple.edu',app_metadata:{},user_metadata:{name:'Member'}}));};
 try{const result=await acceptEmailLink();assert.equal(result.type,'recovery');assert.equal(result.needsPassword,true);assert.equal(cleaned,'/login?reset=1');assert.equal(getStoredSession().user.id,'member');}
 finally{globalThis.fetch=fetchBefore;if(windowBefore===undefined)delete globalThis.window;else globalThis.window=windowBefore;if(storageBefore)Object.defineProperty(globalThis,'localStorage',storageBefore);else delete globalThis.localStorage;}
});

test('password changes use the verified recovery session and enforce minimum length',async()=>{
 const {setAccountPassword,setStoredSession}=await import('../src/supabase.js');const fetchBefore=globalThis.fetch,storageBefore=Object.getOwnPropertyDescriptor(globalThis,'localStorage');const store=new Map();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)}});setStoredSession({access_token:'verified-recovery',user:{id:'fixture'}});
 let calls=0;globalThis.fetch=async(url,options)=>{calls++;assert.match(url,/\/auth\/v1\/user$/);assert.equal(options.method,'PUT');assert.equal(options.headers.Authorization,'Bearer verified-recovery');assert.equal(JSON.parse(options.body).password,'fixture-only-password');return new Response('{}');};
 try{await assert.rejects(setAccountPassword('short'),/at least 12/);await setAccountPassword('fixture-only-password');assert.equal(calls,1);}finally{globalThis.fetch=fetchBefore;if(storageBefore)Object.defineProperty(globalThis,'localStorage',storageBefore);else delete globalThis.localStorage;}
});

test('disable and re-enable use the leadership-only access RPC while role grants stay admin-only',async()=>{
 const {supabasePortalRequest,setStoredSession}=await import('../src/supabase.js');
 const fetchBefore=globalThis.fetch,storageBefore=Object.getOwnPropertyDescriptor(globalThis,'localStorage');const store=new Map();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)}});
 setStoredSession({access_token:'leadership-test',user:{id:'officer'}});
 let disabled;
 globalThis.fetch=async(url,options)=>{assert.match(url,/\/rpc\/portal_set_member_disabled$/);assert.equal(options.headers.Authorization,'Bearer leadership-test');assert.deepEqual(JSON.parse(options.body),{member_id:'member',disabled});return new Response('{"ok":true}');};
 try{
  for(disabled of [true,false])assert.equal((await supabasePortalRequest('admin/member','POST',{id:'member',disabled})).ok,true);
  globalThis.fetch=async(url,options)=>{assert.match(url,/\/rpc\/portal_request$/);assert.deepEqual(JSON.parse(options.body),{path:'admin/member',method:'POST',body:{id:'member',eboard:true}});return new Response('{"ok":true}');};
  await supabasePortalRequest('admin/member','POST',{id:'member',eboard:true});
 }finally{globalThis.fetch=fetchBefore;if(storageBefore)Object.defineProperty(globalThis,'localStorage',storageBefore);else delete globalThis.localStorage;}
});
