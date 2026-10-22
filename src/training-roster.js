export function filterTrainingRoster(rows,{trainingId='',query='',status='all'}={}){
 const search=query.trim().toLowerCase();return rows.filter(r=>(!trainingId||r.training_id===trainingId)&&(!search||r.member_name.toLowerCase().includes(search))&&(status==='all'||(status==='completed'?r.status==='completed':r.status!=='completed')));
}
export function trainingRosterSummary(rows){return {total:rows.length,completed:rows.filter(r=>r.status==='completed').length,pending:rows.filter(r=>r.status!=='completed').length};}
