import {test} from 'node:test';import assert from 'node:assert/strict';import{totalHours}from'../src/hours.js';
test('historical credits add precisely to future approved hours and exclude pending/removed entries',()=>{
 for(const baseline of [97.85,115.65])assert.equal(totalHours([{hours:baseline,status:'Approved'},{hours:1.25,status:'Approved'},{hours:8,status:'Pending'},{hours:3,status:'Approved',deleted:true}]),Math.round((baseline+1.25)*100)/100);
 assert.equal(totalHours([{hours:'0.1',status:'Approved'},{hours:0.2,status:'Approved'}]),0.3);
});
