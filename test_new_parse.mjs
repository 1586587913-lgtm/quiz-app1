function cleanOptionText(text) {
  if (!text) return '';
  text = text.replace(/羿文教育官网\s*www\.yiwenjy\.com\s*版权所有/gi, '');
  text = text.replace(/yiwenjy\.com/gi, '');
  text = text.replace(/专业网校课程[、，]题库软件[、，]考试用书[、，]资讯信息.*/gi, '');
  text = text.replace(/\s*\d+\s*$/g, '');
  text = text.replace(/https?:\/\/[^\s]+/gi, '');
  text = text.replace(/www\.[a-zA-Z0-9]+\.[a-zA-Z]+/gi, '');
  text = text.replace(/参考\s*[A-D]+/gi, '');
  text = text.replace(/参考[答案]?\s*/gi, '');
  return text.replace(/\s+/g, ' ').trim();
}

function cleanNoiseText(text) {
  if (!text) return '';
  text = text.replace(/羿文教育官网\s*www\.yiwenjy\.com\s*版权所有/gi, '');
  text = text.replace(/专业网校课程[、，]题库软件[、，]考试用书[、，]资讯信息.*/gi, '');
  text = text.replace(/yiwenjy\.com/gi, '');
  text = text.replace(/\s+\d+\s*$/g, '');
  text = text.replace(/https?:\/\/[^\s]+/gi, '');
  text = text.replace(/www\.[a-zA-Z0-9]+\.[a-zA-Z]+/gi, '');
  text = text.replace(/^[A-D]\s*[.、:：]\s*/, '');
  return text.trim();
}

function parseQuestionBlock(block) {
  let rest = block.replace(/^(?:^|\s)【?\d+[.、)】]?[\s\u4e00-\u9fa5]*/, '').trim();
  let answer = [], explanation = '', question = '';
  let choices = [];

  const refMatch = rest.match(/参考\s*([A-D]{1,4})/i);
  const ansMatch = rest.match(/【答案】[:：]?\s*([A-D]{1,4})/i);
  const ans2Match = rest.match(/(?:^|\s)答案[:：]\s*([A-D]{1,4})/i);

  let answerStr = '';
  if (refMatch) { answerStr = refMatch[1].toUpperCase(); rest = rest.replace(refMatch[0], ''); }
  else if (ansMatch) { answerStr = ansMatch[1].toUpperCase(); rest = rest.replace(ansMatch[0], ''); }
  else if (ans2Match) { answerStr = ans2Match[1].toUpperCase(); rest = rest.replace(ans2Match[0], ''); }
  if (answerStr) answer = [...answerStr];

  // 用 indexOf 精确分割，避免】残留
  const expMarkers = ['【羿文解析】', '【答案解析】', '【解析】'];
  let expMarkerPos = -1, expMarker = '';
  for (const marker of expMarkers) {
    const pos = rest.indexOf(marker);
    if (pos !== -1 && (expMarkerPos === -1 || pos < expMarkerPos)) {
      expMarkerPos = pos; expMarker = marker;
    }
  }
  if (expMarkerPos !== -1) {
    explanation = rest.slice(expMarkerPos + expMarker.length).replace(/\s+/g, ' ').trim();
    rest = rest.slice(0, expMarkerPos);
  }

  const optionsRegex = /([A-D])\s*[.、:：]\s*(.+?)(?=(?:[A-D]\s*[.、:：])|$)/gi;
  let optionMatch;
  const optionTexts = [];
  while ((optionMatch = optionsRegex.exec(rest)) !== null) {
    let optText = cleanOptionText(optionMatch[2].trim());
    if (optText && optText.length > 0) optionTexts.push(optText);
  }
  if (optionTexts.length >= 2) {
    choices = optionTexts.map((text, i) => ({ id: String.fromCharCode(65 + i), text }));
  }

  rest = cleanNoiseText(rest);
  question = rest.replace(/[A-D]\s*[.、:：]\s*.+?(?=[A-D]|$)/gi, '').replace(/\s+/g, ' ').trim();
  
  if ((question.length < 3 || !question) && explanation) {
    question = explanation;
    explanation = '';
  }

  const type = answer.length > 1 ? 'multiple' : 'single';
  return { type, question, answer, explanation, choices };
}

// 测试用例
const tests = [
  {
    name: 'PDF两栏格式（多选题）',
    text: '（ ）。 A.产品的检验 B.计量器具的周期检定 专业网校课程、题库软件、考试用书、资讯信息全方位一体化职业考试学习平台 羿文教育官网 www.yiwenjy.com 版权所有 15 C.计量器具修理后的检定 D.计量器具的仲裁检定 参考CD 【羿文解析】计量检定规程是执行检定的依据。检定必须按照检定规程进行。'
  },
  {
    name: '标准单选格式',
    text: '1. 【答案】C 【解析】教学演示用游标卡尺对量值准确与否没有要求，不在《计量法》的调整范围。'
  },
  {
    name: '标准多选格式',
    text: '2. 【答案】BD 【解析】计量行政部门指国务院、省（直辖市）。'
  }
];

tests.forEach(tc => {
  const r = parseQuestionBlock(tc.text);
  console.log('\n==========', tc.name, '==========');
  console.log('类型:', r.type === 'multiple' ? '多选题' : '单选题');
  console.log('答案:', r.answer.join(', '));
  if (r.choices.length) {
    r.choices.forEach(c => console.log(' ', c.id + '.', c.text));
  }
  console.log('解析:', r.explanation || '(无)');
  console.log('题目:', r.question);
});
