export function availabilityForShift(member,shift){
 const day=shift?.date?new Date(`${shift.date}T12:00:00Z`).toLocaleDateString('en-US',{weekday:'long',timeZone:'UTC'}):'';
 const saved=Array.isArray(member.availability)?member.availability:[];
 const slot=saved.find(d=>d.day===day&&d.enabled);
 if(!saved.some(d=>d.enabled))return {matches:false,label:'No availability selected'};
 if(!slot)return {matches:false,label:`Unavailable ${day}`};
 const matches=!!shift.start&&!!shift.end&&slot.start<=shift.start&&slot.end>=shift.end;
 return {matches,label:`${slot.start}–${slot.end} ET · ${matches?'Covers shift':'Does not cover full shift'}`};
}
