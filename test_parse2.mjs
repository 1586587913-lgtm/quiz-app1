function cleanOptionText(t){
  if(!t)return'';
  t=t.replace(/羿文教育官网\s*www\.yiwenjy\.com\s*版权所有/gi,'');
  t=t.replace(/yiwenjy\.com/gi,'');
  t=t.replace(/专业网校课程[、，]题库软件[、，]考试用书[、，]资讯信息.*/gi,'');
  t=t.replace(/\s*\d+\s*$/g,'');
  t=t.replace(/https?:\/\/[^\s]+/gi,'');
  t=t.replace(/www\.[a-zA-Z0-9]+\.[a-zA-Z]+/gi,'');
  t=t.replace(/参考\s*[A-D]+/gi,'');
  t=t.replace(/参考[答案]?\s*/gi,'');
  return t.replace(/\s+/g,' ').trim();
}
function cleanNoiseText(t){
  if(!t)return'';
  t=t.replace(/羿文教育官网\s*www\.yiwenjy\.com\s*版权所有/gi,'');
  t=t.replace(/专业网校课程[、，]题库软件[、，]考试用书[、，]资讯信息.*/gi,'');
  t=t.replace(/yiwenjy\.com/gi,'');
  t=t.replace(/\s+\d+\s*$/g,'');
  t=t.replace(/https?:\/\/[^\s]+/gi,'');
  t=t.replace(/www\.[a-zA-Z0-9]+\.[a-zA-Z]+/gi,'');
  t=t.replace(/^[A-D]\s*[.、:：]\s*/,'');
  return t.trim();
}
function parseBlock(b){
  let r=b.replace(/^(?:^|\s)【?\d+[.、)】]?[\s\u4e00-\u9fa5]*/,'').trim();
  let ans=[],exp='',q='';let ch=[];
  const rm=r.match(/参考\s*([A-D]{1,4})/i);
  const am=r.match(/【答案】[:：]?\s*([A-D]{1,4})/i);
  const am2=r.match(/(?:^|\s)答案[:：]\s*([A-D]{1,4})/i);
  let as='';
  if(rm){as=rm[1].toUpperCase();r=r.replace(rm[0],'')}
  else if(am){as=am[1].toUpperCase();r=r.replace(am[0],'')}
  else if(am2){as=am2[1].toUpperCase();r=r.replace(am2[0],'')}
  if(as)ans=[...as];
  const ms=['【羿文解析】','【答案解析】','【解析】'];let mp=-1,mm='';
  for(const m of ms){const p=r.indexOf(m);if(p!==-1&&(mp===-1||p<mp)){mp=p;mm=m;}}
  if(mp!==-1){exp=r.slice(mp+mm.length).replace(/\s+/g,' ').trim();r=r.slice(0,mp);}
  const rx=/([A-D])\s*[.、:：]\s*(.+?)(?=(?:[A-D]\s*[.、:：])|$)/gi;let om;const ot=[];
  while((om=rx.exec(r))!==null){let t=cleanOptionText(om[2].trim());if(t&&t.length>0)ot.push(t);}
  if(ot.length>=2)ch=ot.map((t,i)=>({id:String.fromCharCode(65+i),text:t}));
  r=cleanNoiseText(r);
  q=r.replace(/[A-D]\s*[.、:：]\s*.+?(?=[A-D]|$)/gi,'').replace(/\s+/g,' ').trim();
  // 题目太短 → 用解析内容作为题目
  if((q.length<=4||!q)&&exp){q=exp;exp='';}
  const tp=ans.length>1?'multiple':'single';
  return{type:tp,question:q,answer:ans,explanation:exp,choices:ch};
}
const tests=[
  {name:'PDF两栏多选题',text:'（ ）。 A.产品的检验 B.计量器具的周期检定 专业网校课程、题库软件、考试用书、资讯信息全方位一体化职业考试学习平台 羿文教育官网 www.yiwenjy.com 版权所有 15 C.计量器具修理后的检定 D.计量器具的仲裁检定 参考CD 【羿文解析】计量检定规程是执行检定的依据。检定必须按照检定规程进行。'},
  {name:'标准单选',text:'1. 【答案】C 【解析】教学演示用游标卡尺对量值准确与否没有要求，不在《计量法》的调整范围。'},
  {name:'标准多选',text:'2. 【答案】BD 【解析】计量行政部门指国务院、省（直辖市）。'}
];
tests.forEach(tc=>{
  const r=parseBlock(tc.text);
  console.log('\n== '+tc.name+' ==');
  console.log('类型:',r.type==='multiple'?'多选题':'单选题','| 答案:',r.answer.join(', '));
  r.choices.forEach(c=>console.log(c.id+'.',c.text));
  console.log('解析:',r.explanation||'(无)');
  console.log('题目:',r.question);
});
