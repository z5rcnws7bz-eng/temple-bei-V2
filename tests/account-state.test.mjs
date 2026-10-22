import test from 'node:test';import assert from 'node:assert/strict';import{matchesAccountState}from'../src/account-state.js';
test('late account responses cannot overwrite a newer sign-in or sign-out',()=>{
 assert.equal(matchesAccountState('mobile','ipad','mobile'),false);
 assert.equal(matchesAccountState('mobile',undefined,'mobile'),false);
 assert.equal(matchesAccountState('mobile','mobile','ipad'),false);
 assert.equal(matchesAccountState(undefined,undefined,undefined),false);
 assert.equal(matchesAccountState('ipad','ipad','ipad'),true);
});
