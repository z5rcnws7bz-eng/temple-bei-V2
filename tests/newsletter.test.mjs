import {test} from 'node:test';
import assert from 'node:assert/strict';
import {safeNewsletterUrl,newsletterTextParts,canEditNewsletter} from '../src/newsletter-links.js';
test('newsletter web links are clickable data without executing markup',()=>{
 assert.equal(safeNewsletterUrl('javascript:alert(1)'),null);
 assert.equal(safeNewsletterUrl('data:text/html,hi'),null);
 assert.deepEqual(newsletterTextParts('See [Temple](https://temple.edu) or https://example.com.'),[{text:'See '},{text:'Temple',url:'https://temple.edu/'},{text:' or '},{text:'https://example.com',url:'https://example.com/'},{text:'.'}]);
 assert.deepEqual(newsletterTextParts('<script>alert(1)</script>'),[{text:'<script>alert(1)</script>'}]);
});
test('edit controls require admin or immutable author account ID',()=>{
 assert.equal(canEditNewsletter({id:'author'},{author_id:'author'}),true);
 assert.equal(canEditNewsletter({id:'other',admin:true},{author_id:'author'}),true);
 assert.equal(canEditNewsletter({id:'other',eboard:true},{author_id:'author'}),false);
 assert.equal(canEditNewsletter({id:'other',name:'Same Name'},{author:'Same Name'}),false);
});
