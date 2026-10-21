export function totalHours(entries,status='Approved'){
 return entries.filter(entry=>entry.status===status&&!entry.deleted).reduce((cents,entry)=>{const hours=Number(entry.hours);return Number.isFinite(hours)?cents+Math.round(hours*100):cents;},0)/100;
}
