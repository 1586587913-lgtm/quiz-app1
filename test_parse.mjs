// 测试新的解析逻辑
const text = `1. 【答案】C 【解析】 教学演示用游标卡尺对量值准确与否没有要求，不在《计量法》的调整范围。 2. 【答案】B 【解析】我国现行有效的计量法律有 1 部；法规有 7 部。包括《计量法》等。 3. 【答案】C 【解析】计量行政部门指国务院、省（直辖市）。`;

function parseTextToQuestions(text) {
  const questions = [];
  const questionNumRegex = /(?<=^|\s)(\d+)[.、)][\s\u4e00-\u9fa5]*/gum;
  questionNumRegex.lastIndex = 0;
  const allMatches = [...text.matchAll(questionNumRegex)];

  const blocks = [];
  for (let i = 0; i < allMatches.length; i++) {
    const m = allMatches[i];
    const start = m.index;
    const end = i + 1 < allMatches.length ? allMatches[i + 1].index : text.length;
    blocks.push(text.slice(start, end).trim());
  }

  for (const block of blocks) {
    if (!block.trim()) continue;
    const parsed = parseBlock(block.trim());
    if (parsed && parsed.question && parsed.answer && parsed.answer.length > 0) {
      questions.push(parsed);
    }
  }
  return questions;
}

function parseBlock(block) {
  let content = block.replace(/^(?:^|\s)【?\d+[.、)】]?[\s\u4e00-\u9fa5]*/, '').trim();
  let answer = [], explanation = '';
  const type = 'single';

  const am = content.match(/(?:【答案】|答案[:：])\s*([A-D](?:\s*[,，]\s*[A-D]+)*)/i);
  if (am) { answer = am[1].trim().split(/[,，\s]+/).map(x => x.toUpperCase()).filter(Boolean); content = content.replace(am[0], ''); }

  const em = content.match(/【解析】[:：]?\s*(.+?)(?:$)/);
  if (em) { explanation = em[1].trim(); content = content.replace(/【解析】[:：]?\s*.+$/, ''); }

  content = content.replace(/\s+/g, ' ').trim();

  if (!content && explanation) {
    content = explanation;
    explanation = '';
  }

  if (!content) return null;
  return { type, question: content, answer, explanation };
}

const qs = parseTextToQuestions(text);
console.log('Total questions found:', qs.length);
for (const q of qs) {
  console.log('  A:', q.answer, '| Q:', q.question.slice(0, 50));
}
