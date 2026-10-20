import {test} from 'node:test';
import assert from 'node:assert/strict';
import {availabilityForShift} from '../src/availability.js';
test('shift planning distinguishes full coverage, partial coverage and no saved selection',()=>{
 const shift={date:'2026-10-26',start:'15:00',end:'16:00'};
 assert.equal(availabilityForShift({availability:[{day:'Monday',enabled:true,start:'14:00',end:'17:00'}]},shift).matches,true);
 assert.match(availabilityForShift({availability:[{day:'Monday',enabled:true,start:'15:30',end:'17:00'}]},shift).label,/Does not cover full shift/);
 assert.match(availabilityForShift({availability:[{day:'Tuesday',enabled:true,start:'14:00',end:'17:00'}]},shift).label,/Unavailable Monday/);
 assert.match(availabilityForShift({availability:[]},shift).label,/No availability selected/);
});
