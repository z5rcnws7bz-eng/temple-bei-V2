import test from 'node:test';
import assert from 'node:assert/strict';
import {auditChanges,auditValue,auditSubject} from '../src/audit-log.js';
test('audit differences show actual edited fields and flatten hour payloads',()=>{
 assert.deepEqual(auditChanges({id:'x',updated:'old',payload:{hours:1,status:'Pending'}},{id:'x',updated:'new',payload:{hours:2,status:'Approved'}}),[{field:'hours',before:1,after:2},{field:'status',before:'Pending',after:'Approved'}]);
 assert.deepEqual(auditChanges(null,{name:'Member'}),[{field:'name',before:undefined,after:'Member'}]);
 assert.deepEqual(auditChanges({disabled:0},{disabled:1}),[{field:'disabled',before:0,after:1}]);
});
test('audit detail values preserve readable data without treating text as markup',()=>{
 assert.equal(auditValue('<script>unsafe</script>'),'<script>unsafe</script>');assert.equal(auditValue(1,'disabled'),'Disabled');assert.equal(auditValue(0,'disabled'),'Active');assert.equal(auditValue(undefined),'Not set');assert.equal(auditValue(null),'None');assert.equal(auditValue({day:'Monday'}),' {"day":"Monday"}'.trim());
 assert.equal(auditSubject({member_name:'Member',resource_id:'id'}),'Member');assert.equal(auditSubject({before_record:{title:'Deleted newsletter'},resource_id:'id'}),'Deleted newsletter');
});
