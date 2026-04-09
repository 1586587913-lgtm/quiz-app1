// 解析二级计量工程师题库
const fs = require('fs');

const rawData = JSON.parse(fs.readFileSync('C:/Users/User/Desktop/二级计量工程师/2025考前预测卷/extracted_text.json', 'utf8'));

let questions = [];
let qId = 1;

// 处理计量专业实务与案例分析试卷
const processPapers = () => {
  for (const [filename, text] of Object.entries(rawData)) {
    const isAnswer = filename.includes('答案');
    const isSingle = filename.includes('计量专业实务');
    const subject = isSingle ? '计量专业实务' : '计量法律法规';
    
    // 提取单选题
    const singlePattern = /单项选择题[\s\S]*?(?=二\.多项选择题|$)/g;
    const singleMatch = text.match(singlePattern);
    if (singleMatch) {
      const questions = extractSingleQuestions(singleMatch[0], 'single', subject, isAnswer);
      questions.forEach(q => {
        q.id = `meter_${qId++}`;
        questions.push(q);
      });
    }
    
    // 提取多选题
    const multiplePattern = /二\.多项选择题[\s\S]*$/g;
    const multipleMatch = text.match(multiplePattern);
    if (multipleMatch) {
      const multiQuestions = extractMultipleQuestions(multipleMatch[0], 'multiple', subject, isAnswer);
      multiQuestions.forEach(q => {
        q.id = `meter_${qId++}`;
        questions.push(q);
      });
    }
  }
};

const extractSingleQuestions = (text, type, subject, hasAnswer) => {
  const questions = [];
  // 匹配格式: 数字.题干 (A.选项 B.选项 C.选项 D.选项)
  // 或: 数字.【答案】X 【解析】内容
  
  const patterns = [
    // 匹配带选项的题目
    /(\d+)[.．、]([^\nA-D]+?)[\n\s]*([A-D])[.、．]([^\n]+?)[\n\s]*([A-D])[.、．]([^\n]+?)[\n\s]*([A-D])[.、．]([^\n]+?)[\n\s]*([A-D])[.、．]([^\n]+?)(?=\n\s*\d+[.．、]|$)/g,
    // 匹配带答案的题目
    /(\d+)[\.．、]【答案】([A-D])【解析】([^\n]+?)(?=\n\s*\d+[\.．、]【答案】|$)/g
  ];
  
  // 更精确的解析方法
  const lines = text.split('\n').filter(l => l.trim());
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i].trim();
    
    // 检查是否是题目行（以数字开头）
    const qMatch = line.match(/^(\d+)[\.．、]\s*(.+)$/);
    if (qMatch && !line.includes('【答案】')) {
      const num = parseInt(qMatch[1]);
      let question = qMatch[2];
      
      // 收集选项
      const options = [];
      let j = i + 1;
      while (j < lines.length && options.length < 4) {
        const optLine = lines[j].trim();
        const optMatch = optLine.match(/^([A-D])[.、．、\s]+(.+)$/);
        if (optMatch) {
          options.push({ id: optMatch[1], text: optMatch[2] });
        } else if (optLine.match(/^\d+[\.．、]/) || optLine.includes('【答案】')) {
          break;
        } else if (optLine && !optLine.match(/^[A-D][.、．]/)) {
          // 选项内容的续行
          if (options.length > 0) {
            options[options.length - 1].text += optLine;
          }
        }
        j++;
      }
      
      if (options.length === 4) {
        questions.push({
          type,
          question: cleanText(question),
          options: options.map(o => ({ id: o.id, text: cleanText(o.text) })),
          answer: [],
          explanation: '',
          subject,
          category: subject,
          knowledgePoint: '',
          tags: [subject]
        });
        i = j;
        continue;
      }
    }
    
    // 检查是否是带答案的题目行
    const ansMatch = line.match(/^(\d+)[\.．、]【答案】([A-D])【解析】(.+)$/);
    if (ansMatch) {
      const num = parseInt(ansMatch[1]);
      questions.push({
        type,
        question: '',
        options: [],
        answer: [ansMatch[2]],
        explanation: cleanText(ansMatch[3]),
        subject,
        category: subject,
        knowledgePoint: '',
        tags: [subject]
      });
    }
    i++;
  }
  
  return questions;
};

const extractMultipleQuestions = (text, type, subject, hasAnswer) => {
  const questions = [];
  const lines = text.split('\n').filter(l => l.trim());
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i].trim();
    
    // 检查是否是题目行
    const qMatch = line.match(/^(\d+)[\.．、]\s*(.+)$/);
    if (qMatch && !line.includes('【答案】')) {
      const num = parseInt(qMatch[1]);
      let question = qMatch[2];
      
      // 收集选项
      const options = [];
      let j = i + 1;
      while (j < lines.length && options.length < 4) {
        const optLine = lines[j].trim();
        const optMatch = optLine.match(/^([A-D])[.、．、\s]+(.+)$/);
        if (optMatch) {
          options.push({ id: optMatch[1], text: optMatch[2] });
        } else if (optLine.match(/^\d+[\.．、]/) || optLine.includes('【答案】')) {
          break;
        } else if (optLine && !optLine.match(/^[A-D][.、．]/)) {
          if (options.length > 0) {
            options[options.length - 1].text += optLine;
          }
        }
        j++;
      }
      
      if (options.length === 4) {
        questions.push({
          type,
          question: cleanText(question),
          options: options.map(o => ({ id: o.id, text: cleanText(o.text) })),
          answer: [],
          explanation: '',
          subject,
          category: subject,
          knowledgePoint: '',
          tags: [subject, '多选']
        });
        i = j;
        continue;
      }
    }
    
    // 检查是否是带答案的题目行
    const ansMatch = line.match(/^(\d+)[\.．、]【答案】([A-Z]+)【解析】(.+)$/);
    if (ansMatch) {
      questions.push({
        type,
        question: '',
        options: [],
        answer: ansMatch[2].split(''),
        explanation: cleanText(ansMatch[3]),
        subject,
        category: subject,
        knowledgePoint: '',
        tags: [subject, '多选']
      });
    }
    i++;
  }
  
  return questions;
};

const cleanText = (text) => {
  if (!text) return '';
  return text
    .replace(/\s+/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim();
};

// 运行解析
processPapers();

// 合并题干和答案
const mergedQuestions = [];
const answerMap = {};

questions.forEach(q => {
  if (q.question && q.answer.length === 0) {
    // 这是题干
    const key = `${q.subject}_${q.type}`;
    if (!answerMap[key]) answerMap[key] = [];
    answerMap[key].push(q);
  } else if (!q.question && q.answer.length > 0) {
    // 这是答案
    const key = `${q.subject}_${q.type}`;
    if (answerMap[key] && answerMap[key].length > 0) {
      const matching = answerMap[key].shift();
      matching.answer = q.answer;
      matching.explanation = q.explanation;
      mergedQuestions.push(matching);
    }
  }
});

// 添加只有题干的题目（可能是没有答案解析的）
Object.values(answerMap).forEach(arr => {
  mergedQuestions.push(...arr);
});

console.log(`解析完成，共 ${mergedQuestions.length} 道题目`);
console.log(JSON.stringify(mergedQuestions.slice(0, 5), null, 2));

// 保存结果
fs.writeFileSync(
  'C:/Users/User/Desktop/二级计量工程师/2025考前预测卷/parsed_questions.json',
  JSON.stringify(mergedQuestions, null, 2)
);
