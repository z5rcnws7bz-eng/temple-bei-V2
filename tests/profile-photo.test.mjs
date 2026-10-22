import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePhotoFile,prepareProfilePhoto} from '../src/profile-photo.js';
test('photos reject unsupported, empty and oversized uploads',()=>{
 for(const file of [{type:'image/svg+xml',size:50},{type:'image/jpeg',size:0},{type:'image/png',size:11*1024*1024}])assert.throws(()=>validatePhotoFile(file));
 for(const type of ['image/jpeg','image/png','image/webp'])assert.doesNotThrow(()=>validatePhotoFile({type,size:500}));
});
test('photos are resized, re-encoded as JPEG, and release decoded images',async()=>{
 const oldBitmap=globalThis.createImageBitmap,oldDocument=globalThis.document;
 let closed=false,drawn=false;
 const canvas={getContext:()=>({fillRect(){},drawImage(){drawn=true;}}),toDataURL:(type,quality)=>{assert.equal(type,'image/jpeg');assert.equal(quality,0.8);return 'data:image/jpeg;base64,/9j/4P/Z';}};
 globalThis.createImageBitmap=async()=>({width:2048,height:1024,close(){closed=true;}});
 globalThis.document={createElement:()=>canvas};
 try{assert.match(await prepareProfilePhoto({type:'image/png',size:100}),/^data:image\/jpeg;base64,/);assert.equal(canvas.width,256);assert.equal(canvas.height,128);assert.ok(drawn&&closed);}
 finally{globalThis.createImageBitmap=oldBitmap;globalThis.document=oldDocument;}
});
