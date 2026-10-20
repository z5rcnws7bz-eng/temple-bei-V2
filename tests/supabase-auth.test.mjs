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
