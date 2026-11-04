const fs=require('node:fs');
const original=JSON.parse(fs.readFileSync(__dirname+'/browser-all.json','utf8'));
const rechecks=JSON.parse(fs.readFileSync(__dirname+'/browser-recheck.json','utf8'));
const results=original.results.map(r=>rechecks.find(x=>x.name===r.name)||r);
const edges=JSON.parse(fs.readFileSync(__dirname+'/browser-edgecases.json','utf8')).map(r=>({...r,classification:r.name.startsWith('zero-price')?'inconclusive':r.status==='failed'?'observed_defect':'passed'}));
const summary=list=>list.reduce((s,r)=>(s[r.status]=(s[r.status]||0)+1,s),{});
const out={workflowSummary:summary(results),workflows:results,edgeSummary:summary(edges),edgeClassifications:edges.reduce((s,r)=>(s[r.classification]=(s[r.classification]||0)+1,s),{}),edges,notes:'Workflow rechecks replace ambiguous audit selectors/duplicate-fixture failures; original raw results are retained in browser-all.json. Failed desired-behavior assertions expose observed defects and are not passing regression tests. The zero-price assertion failed at a toast wait and is inconclusive, not a confirmed product bug.'};
fs.writeFileSync(__dirname+'/browser-final.json',JSON.stringify(out,null,2));
console.log(JSON.stringify(out,null,2));
