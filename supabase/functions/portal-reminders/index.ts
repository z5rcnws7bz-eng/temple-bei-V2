import nodemailer from 'npm:nodemailer@10.1.7';
const url=Deno.env.get('SUPABASE_URL')!;
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
async function rpc(name:string,body:unknown){
 const r=await fetch(`${url}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
 if(!r.ok)throw new Error(`Database request failed (${r.status})`);
 return r.status===204?null:await r.json();
}
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return new Response('Method not allowed',{status:405});
 const key=req.headers.get('x-portal-worker-key');
 if(!key||!/^[a-f0-9]{64}$/.test(key))return new Response('Unauthorized',{status:401});
 const password=Deno.env.get('PORTAL_SMTP_PASSWORD');
 if(!password)return Response.json({error:'Email sender is not configured.'},{status:503});
 let jobs;
 try{jobs=await rpc('portal_claim_reminder_emails',{worker_key:key});}catch{return new Response('Unauthorized',{status:401});}
 const transport=nodemailer.createTransport({host:'smtp.gmail.com',port:465,secure:true,auth:{user:'templeuni.bei@gmail.com',pass:password.replace(/\s/g,'')},connectionTimeout:15000,socketTimeout:20000});
 let sent=0,failed=0;
 for(const job of jobs){
  try{
   await transport.sendMail({from:'Temple BEI <templeuni.bei@gmail.com>',to:job.email,subject:job.subject,text:job.message+'\n\nView your schedule and notifications: https://temple-bei-v2.vercel.app/app?section=Notifications',messageId:`<portal-${job.id}@templebei.local>`});
   await rpc('portal_finish_reminder_email',{notification_id:job.id,attempt:job.attempt,sent:true});sent++;
  }catch{
   await rpc('portal_finish_reminder_email',{notification_id:job.id,attempt:job.attempt,sent:false,error_message:'SMTP delivery failed; automatic retry scheduled.'});failed++;
  }
 }
 transport.close();
 return Response.json({sent,failed});
});
