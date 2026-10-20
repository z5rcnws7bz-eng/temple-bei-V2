import test from 'node:test';
import assert from 'node:assert/strict';
import {isLoginRoute,portalDestination} from '../src/routing.js';
test('main address and explicit login routes retain the login screen',()=>{for(const path of ['/','/login','/login/','/index.html','/privacy','/terms','/cookies'])assert.equal(isLoginRoute(path),true,path)});
test('dashboard path stays separate from login landing paths',()=>{assert.equal(isLoginRoute('/app'),false);assert.equal(isLoginRoute('/app/'),false)});
test('each portal continues into the protected app instead of looping to login',()=>{assert.equal(portalDestination('Member'),'/app');assert.equal(portalDestination('E-board'),'/app?section=E-board');assert.equal(portalDestination('Admin'),'/app?section=Admin');for(const role of ['Member','E-board','Admin'])assert.equal(isLoginRoute(new URL(portalDestination(role),'https://example.test').pathname),false)});
