var t={id:"operation-calculateScores",handler:async({keys:t},{env:e,logger:a,accountability:r,services:o,getSchema:i})=>{try{const{ItemsService:e}=o,a=await i();let n=100;r.admin=!0;const s=new e("ratings_measures",{schema:a,accountability:r}),c=new e("measures",{schema:a,accountability:r}),l=new e("municipalities",{schema:a,accountability:r});let u={limit:-1};const m=await s.readMany(t,u),d=await c.readByQuery(u),h=Object.values(m).map((t=>t.localteam_id));if(0===h.length)return;u={filter:{localteam_id:{_in:h}}};const w=await l.readByQuery(u);for(const t of w){const e={};m.forEach((a=>{if(a.localteam_id===t.localteam_id){const t=d.find((t=>t.id===a.measure_id));void 0!==t&&(e[t.sector]={denominator:0,numerator:0})}})),e.total={denominator:0,numerator:0},u={filter:{_and:[{localteam_id:{_eq:t.localteam_id}}]}};let a=(await s.readByQuery(u)).map((t=>{const e=d.find((e=>e.id===t.measure_id));return null!=e.weight&&null!=e.sector&&null!=e.status?(t.weight=e.weight,t.sector=e.sector,t.measureStatus=e.status):(t.weight=0,t.sector="total",t.measureStatus="draft"),t}));for(const t of a){const{applicable:a,weight:r,approved:o,status:i,rating:n,sector:s,measureStatus:c}=t;a&&"published"===c&&(e.total.denominator+=r,e[s]&&(e[s].denominator+=r),o&&"published"===i&&(e.total.numerator+=Number(n)*r,e[s]&&(e[s].numerator+=Number(n)*r)))}let r={};for(const t in e)e.hasOwnProperty(t)&&(e[t].denominator>0?r["score_"+t]=e[t].numerator/e[t].denominator:r["score_"+t]=0,r["score_"+t]*=n);await l.updateOne(t.id,r)}}catch(t){throw a.error(t),t}return{}}};export{t as default};
