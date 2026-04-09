const fs = require('fs');

const rawData = JSON.parse(fs.readFileSync('C:/Users/User/Desktop/二级计量工程师/2025考前预测卷/extracted_text.json', 'utf8'));

let allQuestions = [];
let qId = 1;

// 清理文本
const cleanText = (text) => {
  if (!text) return '';
  return text
    .replace(/\s+/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/骝于/g, '关于')
    .replace(/骝量/g, '测量')
    .replace(/讦量/g, '计量')
    .replace(/爲/g, '为')
    .replace(/爲/g, '为')
    .replace(/伕/g, '使')
    .trim();
};

// 解析单选题
const parseSingleChoice = (text, subject, isAnswerFile) => {
  const questions = [];
  const lines = text.split('\n');
  
  let currentQuestion = null;
  let optionBuffer = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // 匹配题目编号
    const qNumMatch = line.match(/^(\d+)[\.．、]\s*(.+)/);
    
    if (qNumMatch) {
      // 保存之前的题目
      if (currentQuestion && currentQuestion.options.length === 4) {
        questions.push({...currentQuestion, options: [...currentQuestion.options]});
      }
      
      const num = parseInt(qNumMatch[1]);
      let qText = qNumMatch[2];
      
      // 检查是否是带答案的题目
      if (qText.includes('【答案】')) {
        const ansMatch = qText.match(/【答案】([A-D])【解析】(.+)/);
        if (ansMatch) {
          questions.push({
            type: 'single',
            question: cleanText(qText.replace(/【答案】[A-D]【解析】.+/, '')),
            options: [],
            answer: [ansMatch[1]],
            explanation: cleanText(ansMatch[2]),
            subject,
            tags: [subject, '单选']
          });
          continue;
        }
      }
      
      // 检查是否是选项行
      const optMatch = qText.match(/^([A-D])[.、．](.+)/);
      if (optMatch) {
        currentQuestion = {
          type: 'single',
          question: '',
          options: [{ id: optMatch[1], text: cleanText(optMatch[2]) }],
          answer: [],
          explanation: '',
          subject,
          tags: [subject, '单选']
        };
      } else {
        currentQuestion = {
          type: 'single',
          question: cleanText(qText),
          options: [],
          answer: [],
          explanation: '',
          subject,
          tags: [subject, '单选']
        };
      }
    } else if (currentQuestion) {
      // 处理选项行
      const optMatch = line.match(/^([A-D])[.、．、\s]+(.+)/);
      if (optMatch) {
        currentQuestion.options.push({ id: optMatch[1], text: cleanText(optMatch[2]) });
      } else if (line.match(/【答案】/)) {
        // 答案行
        const ansMatch = line.match(/【答案】([A-D])【解析】(.+)/);
        if (ansMatch) {
          currentQuestion.answer = [ansMatch[1]];
          currentQuestion.explanation = cleanText(ansMatch[2]);
          if (currentQuestion.options.length === 4) {
            questions.push({...currentQuestion});
          }
          currentQuestion = null;
        }
      } else if (currentQuestion.options.length > 0) {
        // 选项内容的续行
        currentQuestion.options[currentQuestion.options.length - 1].text += ' ' + cleanText(line);
      }
    }
  }
  
  // 保存最后一个题目
  if (currentQuestion && currentQuestion.options.length === 4) {
    questions.push({...currentQuestion});
  }
  
  return questions;
};

// 解析多选题
const parseMultipleChoice = (text, subject) => {
  const questions = [];
  const lines = text.split('\n');
  
  let currentQuestion = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const qNumMatch = line.match(/^(\d+)[\.．、]\s*(.+)/);
    
    if (qNumMatch) {
      if (currentQuestion && currentQuestion.options.length >= 2) {
        questions.push({...currentQuestion});
      }
      
      let qText = qNumMatch[2];
      
      if (qText.includes('【答案】')) {
        const ansMatch = qText.match(/【答案】([A-Z]+)【解析】(.+)/);
        if (ansMatch) {
          questions.push({
            type: 'multiple',
            question: cleanText(qText.replace(/【答案】[A-Z]+【解析】.+/, '')),
            options: [],
            answer: ansMatch[1].split(''),
            explanation: cleanText(ansMatch[2]),
            subject,
            tags: [subject, '多选']
          });
          continue;
        }
      }
      
      const optMatch = qText.match(/^([A-D])[.、．](.+)/);
      if (optMatch) {
        currentQuestion = {
          type: 'multiple',
          question: '',
          options: [{ id: optMatch[1], text: cleanText(optMatch[2]) }],
          answer: [],
          explanation: '',
          subject,
          tags: [subject, '多选']
        };
      } else {
        currentQuestion = {
          type: 'multiple',
          question: cleanText(qText),
          options: [],
          answer: [],
          explanation: '',
          subject,
          tags: [subject, '多选']
        };
      }
    } else if (currentQuestion) {
      const optMatch = line.match(/^([A-D])[.、．、\s]+(.+)/);
      if (optMatch) {
        currentQuestion.options.push({ id: optMatch[1], text: cleanText(optMatch[2]) });
      } else if (line.match(/【答案】/)) {
        const ansMatch = line.match(/【答案】([A-Z]+)【解析】(.+)/);
        if (ansMatch) {
          currentQuestion.answer = ansMatch[1].split('');
          currentQuestion.explanation = cleanText(ansMatch[2]);
          if (currentQuestion.options.length >= 2) {
            questions.push({...currentQuestion});
          }
          currentQuestion = null;
        }
      } else if (currentQuestion.options.length > 0 && currentQuestion.options.length <= 4) {
        currentQuestion.options[currentQuestion.options.length - 1].text += ' ' + cleanText(line);
      }
    }
  }
  
  if (currentQuestion && currentQuestion.options.length >= 2) {
    questions.push({...currentQuestion});
  }
  
  return questions;
};

// 处理所有文件
for (const [filename, text] of Object.entries(rawData)) {
  const isAnswer = filename.includes('答案');
  const isPractice = filename.includes('模拟试题') || filename.includes('预测卷');
  const isLaw = filename.includes('法律法规');
  const subject = isLaw ? '计量法律法规及综合知识' : '计量专业实务与案例分析';
  
  // 分割单选题和多选题区域
  const singleSection = text.match(/单项选择题[\s\S]*?(?=二[\.．多]|$)/g);
  const multiSection = text.match(/二[.．]多项选择题[\s\S]*$/g);
  
  if (singleSection) {
    const singles = parseSingleChoice(singleSection[0], subject, isAnswer);
    allQuestions.push(...singles);
    console.log(`${filename}: 单选 ${singles.length} 道`);
  }
  
  if (multiSection) {
    const multis = parseMultipleChoice(multiSection[0], subject);
    allQuestions.push(...multis);
    console.log(`${filename}: 多选 ${multis.length} 道`);
  }
}

// 分配ID
allQuestions.forEach((q, idx) => {
  q.id = `meter_${idx + 1}`;
});

// 统计
const singles = allQuestions.filter(q => q.type === 'single');
const multis = allQuestions.filter(q => q.type === 'multiple');
console.log(`\n总计: ${allQuestions.length} 道题目`);
console.log(`- 单选题: ${singles.length} 道`);
console.log(`- 多选题: ${multis.length} 道`);
console.log(`- 有答案的题目: ${allQuestions.filter(q => q.answer.length > 0).length} 道`);

// 保存
const output = {
  name: '二级注册计量工程师题库',
  description: '2024-2025年二级注册计量师考试预测卷及模拟题精选',
  version: '1.0',
  count: allQuestions.length,
  questions: allQuestions
};

fs.writeFileSync(
  'C:/Users/User/Desktop/二级计量工程师/2025考前预测卷/metering_bank.json',
  JSON.stringify(output, null, 2)
);

console.log('\n题库已保存到 metering_bank.json');

// 输出示例
console.log('\n示例题目:');
console.log(JSON.stringify(allQuestions.slice(0, 3), null, 2));
