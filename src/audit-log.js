export const auditActions={created:'Created',updated:'Updated',deleted:'Deleted',disabled:'Disabled',re_enabled:'Re-enabled',eboard_granted:'Granted E-board',eboard_revoked:'Revoked E-board',approved:'Approved hours',returned:'Returned hours',removed:'Removed hours',restored:'Restored hours'};
const flatten=record=>record?Object.fromEntries(Object.entries({...record,...record.payload}).filter(([key])=>!['payload','id','updated','created'].includes(key))):{};
export function auditChanges(before,after){
 const previous=flatten(before),next=flatten(after);
 return [...new Set([...Object.keys(previous),...Object.keys(next)])].sort().filter(key=>JSON.stringify(previous[key])!==JSON.stringify(next[key])).map(key=>({field:key,before:previous[key],after:next[key]}));
}
export function auditValue(value,field){
 const flags={disabled:['Active','Disabled'],eboard:['No E-board access','E-board access'],deleted:['Active record','Removed record'],published:['Draft','Published']};
 if(flags[field]&&[0,1,false,true].includes(value))return flags[field][Number(value)];
 if(field==='availability'&&typeof value==='string'){
  try{const days=JSON.parse(value);if(Array.isArray(days))return days.map(d=>`${d.day}: ${d.enabled?`${d.start}–${d.end}`:'Unavailable'}`).join('\n');}catch{}
 }
 if(value===undefined)return 'Not set';
 if(value===null||value==='')return 'None';
 if(typeof value==='object')return JSON.stringify(value);
 return String(value);
}
export function auditSubject(entry){
 const record=entry.after_record||entry.before_record||{};
 return entry.member_name||record.title||record.payload?.facility||record.name||entry.resource_id;
}
