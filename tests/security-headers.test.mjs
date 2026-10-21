import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
test('deployment blocks script injection and framing while allowing the chapter API',()=>{
 const c=JSON.parse(fs.readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));const headers=Object.fromEntries(c.headers.find(r=>r.source==='/(.*)').headers.map(h=>[h.key.toLowerCase(),h.value]));const csp=headers['content-security-policy'];
 assert.match(csp,/script-src 'self'/);assert.doesNotMatch(csp,/script-src[^;]*'unsafe-(inline|eval)'/);assert.match(csp,/frame-ancestors 'none'/);assert.match(csp,/object-src 'none'/);assert.match(csp,/connect-src[^;]*https:\/\/znbosnwimjklfaooxnjv\.supabase\.co/);assert.equal(headers['x-content-type-options'],'nosniff');assert.equal(headers['x-frame-options'],'DENY');assert.match(headers['permissions-policy'],/microphone=\(\)/);
});
