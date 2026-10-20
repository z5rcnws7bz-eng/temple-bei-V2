export function safeNewsletterUrl(value){
 try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:null;}catch{return null;}
}
export function newsletterTextParts(text=''){
 const result=[];const pattern=/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>]+)/g;let cursor=0;
 for(const match of text.matchAll(pattern)){
  if(match.index>cursor)result.push({text:text.slice(cursor,match.index)});
  let label=match[1]||match[3],url=match[2]||match[3];
  const suffix=match[3]?url.match(/[.,!?;:]+$/)?.[0]||'':'';
  if(suffix){url=url.slice(0,-suffix.length);label=url;}
  result.push({text:label,url:safeNewsletterUrl(url)});if(suffix)result.push({text:suffix});cursor=match.index+match[0].length;
 }
 if(cursor<text.length)result.push({text:text.slice(cursor)});
 return result;
}
export function canEditNewsletter(user,entry){return !!user?.admin||!!entry?.author_id&&entry.author_id===user?.id;}
