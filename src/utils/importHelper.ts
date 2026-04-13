/**
 * 题目导入工具
 * 支持文件上传和图片 OCR 识别
 */

import type { Question } from '../types';
import { getBanks } from './storage';

// ========================
// 题目解析器
// ========================

/**
 * 文本解析器 - 支持多种格式
 * 常见格式：
 * 1. PDF提取: "1. 【答案】C 【解析】题目内容"
 * 2. "1. 题目  A.选项  B.选项  C.选项  D.选项  答案:A"
 * 3. 支持罗马数字、中文数字、无空格格式等
 */
/**
 * 合并被 PDF 双栏格式分开的题目
 * 常见情况：
 * - 左栏：题目内容（无结尾标点或以____结尾）
 * - 右栏：选项 A. B. C. D.
 * - 或：左栏结尾 ____  右栏开头 A.选项
 */
function mergeSplitQuestions(text: string): string {
  const lines = text.split('\n');
  const mergedLines: string[] = [];
  
  // PDF碎片识别函数
  const isPdfFragment = (line: string): boolean => {
    const trimmed = line.trim();
    
    // 以数字+英文开头（如 "7 ISO, IEC等）发布的国际标准"）
    if (/^\d+[\s,，.、][A-Za-z]{2,}/.test(trimmed)) return true;
    
    // 以"等）"或"等]"结尾
    if (/等[）)\]]+$/.test(trimmed)) return true;
    
    // 以"发布的国际标准"结尾
    if (/发布的国际标准$/.test(trimmed)) return true;
    
    // 纯英文短行
    if (/^[A-Za-z\s,\.]+$/.test(trimmed) && trimmed.length < 60) return true;
    
    // 以斜杠/开头的行（PDF双栏分隔符，如 "/ 2"）
    if (/^\/\s*\d*$/.test(trimmed)) return true;
    
    // 单独一行只有斜杠
    if (/^\/+$/.test(trimmed)) return true;
    
    return false;
  };
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : '';
    
    // 跳过 PDF 碎片行
    if (isPdfFragment(line)) {
      continue;
    }
    
    // 检测需要合并的情况：
    // 1. 当前行以 ____ 结尾，下一行是选项（如 "A."）
    const endsWithBlank = /____\s*$/.test(line);
    const nextIsOption = /^[A-D][.、:：]/.test(nextLine);
    
    // 2. 当前行有选项标记，下一行也有选项标记（连续选项行）
    const hasOption = /^[A-D][.、:：]/.test(line);
    const nextHasOption = /^[A-D][.、:：]/.test(nextLine);
    
    // 3. 当前行是解析，下一行是题目或题号（新题目开始，不合并）
    const isExpLine = /^【羿文解析】/.test(line) || /^【答案解析】/.test(line);
    const nextIsQuestionNum = /^\d+[.、)\])】\]]/.test(nextLine);
    
    // 4. 当前行是选项，下一行是新题目，不合并（当前行留在mergedLines）
    // 但如果当前行是选项 A.，且下一行是 B. C. D.，则合并
    
    // 如果当前行是解析，且下一行是新题目，不合并
    if (isExpLine && nextIsQuestionNum) {
      mergedLines.push(line);
      continue;
    }
    
    // 如果上一行是解析，当前行是新题目或题号，不合并
    if (mergedLines.length > 0) {
      const prevLine = mergedLines[mergedLines.length - 1];
      const prevIsExp = /^【羿文解析】/.test(prevLine) || /^【答案解析】/.test(prevLine);
      if (prevIsExp && (nextIsQuestionNum || /^[A-D][.、:：]/.test(line))) {
        mergedLines.push(line);
        continue;
      }
    }
    
    // 如果当前行以填空结尾，下一行是选项，合并
    if (endsWithBlank && nextIsOption) {
      mergedLines.push(line + ' ' + nextLine);
      i++; // 跳过下一行
      continue;
    }
    
    // 连续选项行合并（关键修复）
    if (hasOption && nextHasOption) {
      mergedLines.push(line + ' ' + nextLine);
      i++;
      continue;
    }
    
    // 如果上一行结尾没有正常标点，且当前行是选项，合并
    if (mergedLines.length > 0) {
      const prevLine = mergedLines[mergedLines.length - 1];
      const prevEndsNoPunct = /[^。？！.?!;；]\s*$/.test(prevLine) && !/____\s*$/.test(prevLine);
      
      if (prevEndsNoPunct && hasOption) {
        mergedLines[mergedLines.length - 1] = prevLine + ' ' + line;
        continue;
      }
    }
    
    mergedLines.push(line);
  }
  
  return mergedLines.join('\n');
}

export function parseTextToQuestions(text: string): Partial<Question>[] {
  // 预处理：统一换行符，清理多余空格
  let cleanText = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/　/g, ' ') // 全角空格转半角
    .replace(/[ \u00A0]+/g, ' ') // 多个空格合并
    .trim();

  // 合并被 PDF 双栏格式分开的题目
  cleanText = mergeSplitQuestions(cleanText);

  console.log('[ImportHelper] 预处理后文本长度:', cleanText.length);

  if (!cleanText || cleanText.length < 10) {
    console.log('[ImportHelper] 文本太短，无法解析');
    return [];
  }


  // ─────────────────────────────────────────────────────────────
  // 第一步：识别并切分题目
  // ─────────────────────────────────────────────────────────────
  // 策略：找到所有题号位置，按题号切分
  // 格式：\n1.  或  \n 2.  或  1. (文本开头)
  // 注意：排除解析中的列表序号如 (1) (2)
  
  const blocks: string[] = [];
  
  // 题号正则：排除解析中的列表序号 (1)(2)
  // 题号前必须是：行首、换行、空格、或开头括号如【或（
  // 不能是：中文字符后紧跟的数字
  const questionNumRegex = /(^|[\n\s（【])([1-9]\d*)[.、)\])】\]]/gm;
  const questionPositions: { start: number; num: string }[] = [];
  
  let match;
  while ((match = questionNumRegex.exec(cleanText)) !== null) {
    // 计算题号数字的起始位置（数字在第2个捕获组）
    const numStart = match.index + match[0].indexOf(match[2]);
    questionPositions.push({
      start: numStart,
      num: match[2]
    });
  }
  
  console.log(`[ImportHelper] 找到 ${questionPositions.length} 个题号`);
  
  // 按题号位置切分块
  if (questionPositions.length > 0) {
    for (let i = 0; i < questionPositions.length; i++) {
      const start = questionPositions[i].start;
      const end = i < questionPositions.length - 1 
        ? questionPositions[i + 1].start 
        : cleanText.length;
      
      const block = cleanText.slice(start, end).trim();
      if (block.length > 5) {
        blocks.push(block);
      }
    }
    console.log(`[ImportHelper] 按题号切分出 ${blocks.length} 个块`);
  }
  
  // 备选策略：基于参考答案切分
  if (blocks.length < 10) {
    console.log('[ImportHelper] 题号切分块数不足，尝试参考答案策略...');
    
    const answerRefRegex = /参考答案[：:]?\s*[A-D]/gi;
    const answerPositions: number[] = [];
    
    while ((match = answerRefRegex.exec(cleanText)) !== null) {
      answerPositions.push(match.index);
    }
    
    console.log(`[ImportHelper] 找到 ${answerPositions.length} 个参考答案`);
    
    if (answerPositions.length > 0) {
      blocks.length = 0; // 清空
      
      for (let i = 0; i < answerPositions.length; i++) {
        const answerPos = answerPositions[i];
        
        // 向前搜索题号：找到答案前的换行，然后找换行后的题号
        const beforeText = cleanText.slice(0, answerPos);
        const lastNewline = beforeText.lastIndexOf('\n');
        const afterNewline = beforeText.slice(lastNewline + 1);
        
        const numMatch = afterNewline.match(/^(\d+)[.、)\])】\]]/);
        
        let blockStart = lastNewline + 1;
        if (numMatch && numMatch.index !== undefined) {
          blockStart = lastNewline + 1 + numMatch.index;
        }
        
        const blockEnd = i < answerPositions.length - 1 
          ? answerPositions[i + 1] 
          : cleanText.length;
        
        const block = cleanText.slice(blockStart, blockEnd).trim();
        if (block.length > 10) {
          blocks.push(block);
        }
      }
      console.log(`[ImportHelper] 按参考答案切分出 ${blocks.length} 个块`);
    }
  }
  
  // 最后备选：整段解析
  if (blocks.length === 0) {
    console.log('[ImportHelper] 无法切分，整段解析');
    blocks.push(cleanText);
  }

  console.log(`[ImportHelper] 最终切分出 ${blocks.length} 个块`);

  // ─────────────────────────────────────────────────────────────
  // 第二步：逐个解析题目块
  // ─────────────────────────────────────────────────────────────
  const questions: Partial<Question>[] = [];
  
  for (const block of blocks) {
    if (!block.trim() || block.length < 5) continue;
    
    const parsed = parseQuestionBlock(block.trim());
    // 放宽条件：只要有题目内容或答案就保留
    if (parsed && ((parsed.question && parsed.question.length >= 2) || (parsed.answer && parsed.answer.length > 0))) {
      // 如果没有答案但有选项，标记为待编辑
      if (!parsed.answer || parsed.answer.length === 0) {
        parsed.answer = [];
      }
      questions.push(parsed);
    }
  }

  console.log(`[ImportHelper] 解析出 ${questions.length} 道题目`);
  return questions;
}

/**
 * 解析单个题目块
 * 支持 PDF 多种格式：
 * 1. 【答案】D 【解析】...（答案在题目前面）
 * 2. 题目+选项+参考答案+C+【羿文解析】...（答案在选项后面）
 */
function parseQuestionBlock(block: string): Partial<Question> | null {
  // 去除行首的题号：直接匹配常见题号格式
  // 匹配: 1. 1、 1) 1） 1】 1] （1） 【1】 等，后面可能跟空格
  // 关键：确保题号后面不是单个大写字母（可能是PDF双栏碎片混入的题目开头，如 "26.U95" 中的 "U"）
  let rest = block.replace(/^\s*[\u300a\u300b]?\d+[.、)\]\uff08\uff09\u300c\u300d\u3010\u3011]\s*/, '').trim();
  
  // 进一步清理：如果开头是非选项标记的单个大写字母+数字格式（如 "U95"），保留完整
  // 这是为了处理 PDF 双栏导致的 "26.U95" 被错误拆分的情况
  if (/^[A-Z]\d/.test(rest)) {
    // 开头是单个大写字母+数字，这是正常的题目内容（如 "U95表示..."）
    // 不需要额外处理
  }
  
  // 清理PDF双栏碎片：移除PDF双栏导致的碎片文本
  // 如 "7 ISO，IEC等）发布的国际标准"、" / 2"、"/ 2"等
  rest = rest
    // 移除空格+/开头的碎片（如 " / 2"）
    .replace(/\s+\/\s*\d+/g, '')
    // 移除以/开头的单独行（如 "/ 2"）
    .replace(/\n\/\s*\d+/g, '')
    // 移除空格+数字开头+整段内容的碎片（数字必须是连续数字且内容较短才移除）
    .replace(/\s+\d{2,}\s+[A-Za-z][^A-D\n]{0,50}(?:[.）)）)]\s*)?$/gm, '')
    // 移除以数字+英文+等）格式的国际标准碎片行（如 "7 ISO，IEC等）"）
    .replace(/^\d+[\s,，.、][A-Za-z]{2,}([\s,，.、][A-Za-z]{2,})*[\s,，.、]*[等之的]?[）).\]]*$/gm, '')
    // 移除以"发布的国际标准"结尾的行碎片
    .replace(/^.*发布的国际标准$/gm, '')
    // 移除以"等）"或"等]"结尾的行碎片
    .replace(/^.*等[）)\]]+$/gm, '');
  
  let answer: string[] = [];
  let explanation = '';
  let question = '';
  let choices: { id: string; text: string }[] = [];

  // ─────────────────────────────────────────────────────────────
  // 第一步：提取所有可能的答案格式
  // ─────────────────────────────────────────────────────────────
  let answerStr = '';
  
  // 格式1: 【答案】ABCD（最常见，最优先匹配）
  // 注意：PDF中【答案】可能紧跟答案字母，如【答案】D【解析】
  const ansMatch = rest.match(/【答案】\s*([A-D]{1,4})/i);
  if (ansMatch) {
    answerStr = ansMatch[1].toUpperCase();
    rest = rest.replace(ansMatch[0], ''); // 移除答案部分
  }
  
  // 格式2: 参考答案：C（注意中间有"答案"两个字，但可能没有冒号）
  // 这是用户PDF的实际格式：参考答案：C 或 参考答案 C
  if (!answerStr) {
    const refMatch = rest.match(/参考答案[:：]?\s*([A-D]{1,4})/i);
    if (refMatch) {
      answerStr = refMatch[1].toUpperCase();
      rest = rest.replace(refMatch[0], '');
    }
  }
  
  // 格式3: 参考ABCD 参考AB（没有"答案"两字）
  if (!answerStr) {
    const refMatch = rest.match(/参考\s*([A-D]{1,4})(?!\s*答案)/i);
    if (refMatch) {
      answerStr = refMatch[1].toUpperCase();
      rest = rest.replace(refMatch[0], '');
    }
  }
  
  // 格式4: 答案:ABCD 答案ABCD
  if (!answerStr) {
    const ans2Match = rest.match(/(?:^|\s)答案[:：]\s*([A-D]{1,4})/i);
    if (ans2Match) {
      answerStr = ans2Match[1].replace(/[,，\s]/g, '').toUpperCase();
      rest = rest.replace(ans2Match[0], '');
    }
  }
  
  // 格式5: 答案在括号中，如 (ABCD) 或 （ABCD）
  if (!answerStr) {
    const ans3Match = rest.match(/[（(]\s*([A-D]{1,4})\s*[)）]/i);
    if (ans3Match) {
      answerStr = ans3Match[1].toUpperCase();
      rest = rest.replace(ans3Match[0], '');
    }
  }
  
  // 解析答案数组
  answer = answerStr ? [...answerStr] : [];
  if (answerStr) {
    console.log(`[ImportHelper] 提取答案: ${answerStr}`);
  }

  // ─────────────────────────────────────────────────────────────
  // 第二步：提取解析（用 indexOf 精确分割，避免】残留）
  // ─────────────────────────────────────────────────────────────
  // 特殊格式处理：题目内容可能在第一个【解析】之后
  // 格式如: 
  //   "2.【答案】B 【解析】题目内容\n选项...\n【解析】真正的解析"
  // 如果【解析】之后的内容像题目，就把它当题目
  
  const fullExpMarkers = ['【羿文解析】', '【答案解析】', '【解析】'];
  let expMarkerPos = -1;
  let expMarker = '';
  
  for (const marker of fullExpMarkers) {
    const pos = rest.indexOf(marker);
    if (pos !== -1 && (expMarkerPos === -1 || pos < expMarkerPos)) {
      expMarkerPos = pos;
      expMarker = marker;
    }
  }
  
  if (expMarkerPos !== -1) {
    const afterFirstMarker = rest.slice(expMarkerPos + expMarker.length);
    
    // 检查是否有第二个解析标记
    let secondExpPos = -1;
    for (const marker of fullExpMarkers) {
      const pos = afterFirstMarker.indexOf(marker);
      if (pos !== -1 && (secondExpPos === -1 || pos < secondExpPos)) {
        secondExpPos = pos;
      }
    }
    
    if (secondExpPos !== -1 && secondExpPos < 200) {
      // 存在第二个解析标记，说明第一个【解析】后面紧跟的是题目内容（可能跨行）
      const afterFirstExpContent = afterFirstMarker.slice(0, secondExpPos);
      const realExplanation = afterFirstMarker.slice(secondExpPos + 4).trim();
      
      // 检查第一行是否像题目（短、有标点结尾或填空标记）
      const firstLine = afterFirstExpContent.split('\n')[0].trim();
      const looksLikeQuestion = (
        firstLine.length > 3 && 
        firstLine.length < 150 &&
        (/[____。？！?]$/.test(firstLine) || firstLine.includes('____'))
      );
      
      
      
      if (looksLikeQuestion) {
        // 提取题目内容（可能跨多行直到遇到选项）
        const lines = afterFirstExpContent.split('\n');
        const questionLines: string[] = [];
        const optionLines: string[] = [];
        let foundOption = false;
        
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          
          // 检测是否开始有选项
          if (/^[A-D][.、:：]/.test(trimmed) || /[A-D][.、:：].*[A-D][.、:：]/.test(trimmed)) {
            foundOption = true;
          }
          
          if (!foundOption && questionLines.length < 3) {
            // 还在题目区域
            questionLines.push(trimmed);
          } else if (foundOption) {
            // 选项区域
            optionLines.push(trimmed);
          }
        }
        
        question = questionLines.join(' ');
        explanation = realExplanation;
        
        // 把选项行加回 rest，用于后续提取选项
        if (optionLines.length > 0) {
          rest = rest.slice(0, expMarkerPos) + '\n' + optionLines.join('\n');
        } else {
          rest = rest.slice(0, expMarkerPos);
        }
        
        // 重新提取答案
        answerStr = '';
        const ansMatch = rest.match(/【答案】\s*([A-D]{1,4})/i);
        if (ansMatch) {
          answerStr = ansMatch[1].toUpperCase();
        }
        answer = [...answerStr];
        
        console.log(`[ImportHelper] 特殊格式 - 题目: ${question.substring(0, 30)}..., 选项行: ${optionLines.length}`);
      } else {
        // 正常情况：第一个【解析】之后就是解析
        explanation = afterFirstMarker.replace(/\s+/g, ' ').trim();
        rest = rest.slice(0, expMarkerPos);
      }
    } else {
      // 正常情况：只有一个【解析】标记
      explanation = afterFirstMarker.replace(/\s+/g, ' ').trim();
      rest = rest.slice(0, expMarkerPos);
    }
  }
  
  // 如果题目还没提取（正常情况），继续从rest中提取
  if (!question || question.length < 2) {
    // ... existing code will handle this
  }

  // ─────────────────────────────────────────────────────────────
  // 第三步：提取选项 A. B. C. D. （可能连在一起，有广告噪音）
  // ─────────────────────────────────────────────────────────────
  // 预处理：把连在一起的选项分开
  // 情况1: "A.米每秒B.秒米" -> "A.米每秒\nB.秒米"
  // 情况2: "____。 B.秒米" -> "____。\nB.秒米"
  // 情况3: "A.____；B.____；C.____；D.____" -> 逐个提取
  // 情况4: "A. a= / 2" -> "A. a=0.29" (PDF双栏碎片合并)
  let processedRest = rest
    // 先处理选项紧跟选项或中文的情况
    .replace(/([A-D])[.、:：](?=[A-D\u4e00-\u9fa5])/g, '\n$1.')
    // 再处理选项前有空格的情况（如 "____。 B."）
    .replace(/(?<=[。？！.?!;；])\s+([A-D])[.、:：]/g, '\n$1.')
    // 处理选项前有多个空格的情况
    .replace(/(\n)\s+([A-D])[.、:：]/g, '\n$2.')
    // 处理分号分隔的选项（如 A.____；B.____；C.____；D.____）
    .replace(/；\s*([A-D])[.、:：]/g, '\n$1.')
    // 处理选项之间没有分隔的情况（加空格方便后续解析）
    .replace(/([A-D])[.、:：](?=[^A-D\n\s])/g, '$1. ')
    // 合并被PDF双栏分开的选项（如 "a= / 2" + "D. a=0.29" -> "a=0.29"）
    // 如果一行以 "a= /" 结尾，下一行是 "D. xxx"，合并这两行
    .replace(/(a=\s*)\/\s*\n([A-D])/gi, '$1\n$2')
    // 合并被斜杠分开的数学表达式（如 "a=0." + "D. 29" -> "a=0.29"）
    // 如果 / 数字 后面紧跟选项，把 / 数字 和选项合并
    .replace(/\/\s*(\d+)\s*\n([A-D][.、:：]\s*)([^A-D]*)/g, '\n$2$1$3')
    // 移除孤立的 / 数字 碎片（前后都有正常内容的情况）
    .replace(/([A-Za-z0-9])\s*\/\s*(\d+)\s*\n([^A-D])/g, '$1\n$3');
  
  // 逐行提取选项，每行一个选项或多个选项
  const optionTexts: string[] = [];
  const foundOptions = new Set<string>(); // 用于去重
  
  // 方法：逐行提取每个选项，确保完整提取
  const lines = processedRest.split('\n');
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    // 用正则找到该行中所有选项标记的位置
    const optionPattern = /[A-D][.、:：]/g;
    let match;
    const indices: number[] = [];
    while ((match = optionPattern.exec(trimmedLine)) !== null) {
      indices.push(match.index);
    }
    
    for (let i = 0; i < indices.length; i++) {
      const startIdx = indices[i];
      
      // 选项内容从选项标记后开始（跳过 "A." 的2个字符）
      let contentStart = startIdx + 2;
      let contentEnd;
      
      // 确定内容结束位置：到下一个选项之前，或到行尾
      if (i < indices.length - 1) {
        contentEnd = indices[i + 1];
      } else {
        contentEnd = trimmedLine.length;
      }
      
      let optText = trimmedLine.slice(contentStart, contentEnd).trim();
      
      // 去掉选项后面的题号残留
      optText = optText.replace(/\s*\d{1,2}[.、)\])】\]].*$/, '');
      optText = cleanOptionText(optText);
      
      // 选项内容至少1个字符
      if (optText && optText.length >= 1 && !foundOptions.has(optText)) {
        foundOptions.add(optText);
        optionTexts.push(optText);
      }
    }
  }
  
  // 备选方法：如果提取的选项少于2个，尝试直接匹配所有选项
  if (optionTexts.length < 2) {
    const allMatches = [...processedRest.matchAll(/[A-D][.、:：]\s*([^\n]*?)(?=\s*[A-D][.、:：]|$|\s*$)/g)];
    for (const match of allMatches) {
      let optText = (match[1] || '').trim();
      optText = cleanOptionText(optText);
      if (optText && optText.length >= 1 && !foundOptions.has(optText)) {
        foundOptions.add(optText);
        optionTexts.push(optText);
      }
    }
  }
  
  if (optionTexts.length >= 2) {
    // 取前4个选项（A、B、C、D）
    choices = optionTexts.slice(0, 4).map((text, i) => ({
      id: String.fromCharCode(65 + i),
      text
    }));
    
    // 后处理：尝试从解析中补全不完整的选项
    // PDF双栏可能导致选项内容被截断，如 "置信概率为规定的p=" 后面缺失
    try {
      if (explanation && choices.length > 0) {
        choices = choices.map((choice) => {
          const optText = choice.text;
          const optId = choice.id;
          
          // 检测选项是否不完整：以等号、逗号或空白结尾
          const endsIncomplete = /[=,，]\s*$/.test(optText) || /\s$/.test(optText);
          
          if (endsIncomplete && optText.length > 5) {
            // 获取选项标记（如 "D."）
            const optionMarker = optId + '.';
            
            // 尝试从解析中提取该选项的完整内容
            // 解析格式可能是：
            // 1. "A.xxx B.yyy C.zzz D.www"（选项连在一起）
            // 2. "A.xxx\nB.yyy\nC.zzz\nD.www"（选项分行）
            
            // 方法1：在解析中查找包含选项标记的内容
            try {
              const optionPattern = new RegExp(`${optionMarker}[^A-D【】\\n]{2,80}`, 'i');
              const optionMatch = explanation.match(optionPattern);
              
              if (optionMatch) {
                const fullOptionText = optionMatch[0].replace(/^[A-D][.、:：]/, '').trim();
                
                // 检查解析中的选项是否比当前的更完整
                if (fullOptionText.length > optText.length && fullOptionText.length < 100) {
                  console.log(`[ImportHelper] 补全选项${optId}: "${fullOptionText}"`);
                  return { ...choice, text: fullOptionText };
                }
              }
            } catch (e) {
              // 正则出错，跳过
            }
            
            // 方法2：如果当前选项以等号结尾，尝试从解析中找等号后的内容
            if (optText.includes('=')) {
              try {
                // 查找选项标记 + 当前内容 + 等号后的内容
                const eqParts = optText.split('=');
                const eqKeyword = eqParts[eqParts.length - 1]?.trim() || '';
                
                // 在解析中查找包含该关键词的内容
                if (eqKeyword) {
                  const afterEqPattern = new RegExp(`${optionMarker}[^A-D]*${eqKeyword}[^A-D\\n]{0,50}`, 'i');
                  const afterEqMatch = explanation.match(afterEqPattern);
                  
                  if (afterEqMatch) {
                    const extracted = afterEqMatch[0];
                    // 提取等号后的内容
                    const parts = extracted.split('=');
                    const afterEq = parts[parts.length - 1]?.trim();
                    if (afterEq && afterEq.length > 2 && afterEq.length < 50) {
                      console.log(`[ImportHelper] 补全选项${optId}等号后内容: "${afterEq}"`);
                      return { ...choice, text: optText + afterEq };
                    }
                  }
                }
              } catch (e) {
                // 正则出错，跳过
              }
            }
          }
          
          return choice;
        });
      }
    } catch (e) {
      console.error('[ImportHelper] 选项补全出错:', e);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 第四步：提取题目内容（使用 processedRest，因为它已经分开选项）
  // ─────────────────────────────────────────────────────────────
  // 先清理噪音
  let questionText = cleanNoiseText(processedRest);
  
  // 关键修复：过滤掉PDF双栏导致的碎片文本
  // 这些碎片以"有"、"量，即"等开头，不是完整的选项内容
  questionText = questionText
    // 移除以"有"开头且前面没有选项标记的行（如 "有不同的数学模型"）
    .replace(/(?<![A-D][.、:：])\n有[A-D\u4e00-\u9fa5][^\n]*/g, '')
    // 移除以"量，即"开头的行碎片
    .replace(/(?<![A-D][.、:：])\n量，即[^\n]*/g, '')
    // 移除以"即"开头且可能包含PDF碎片内容的行
    .replace(/(?<![A-D][.、:：])\n即[^\n]*/g, '')
    // 移除以数字开头且包含"ISO"、"IEC"等国际标准碎片的行
    .replace(/\n\d+\s+[A-Za-z]+[,，][A-Za-z]+[.）)）].*$/gm, '')
    // 移除以斜杠/开头的行碎片（如 "/ 2"）
    .replace(/\n\s*\/\s*\d*/g, '')
    // 移除以斜杠/结尾的行碎片
    .replace(/\/\s*$/gm, '');
  
  // 关键修复：检测题目中是否有数学符号丢失
  // 如果题目以 "为" 结尾（可能后面有图片/符号丢失），尝试从解析补全
  const endsWithZuiWei = /为$/.test(question);
  
  if (endsWithZuiWei && explanation) {
    // 从解析中提取完整内容
    // 解析格式："数字显示装置的分辨力为1个数字所代表的量值δ，则取a=δ / 2"
    // 尝试匹配 "为" + 一些内容 + "则"
    const mathSymbolMatch = explanation.match(/为([^则]+)则/);
    if (mathSymbolMatch) {
      const missingPart = mathSymbolMatch[1].trim();
      // 确保 missingPart 不是太长（正常应该是几个字符）
      if (missingPart.length < 50) {
        question = question + missingPart + '则';
        console.log(`[ImportHelper] 从解析补全题目: "${missingPart}则"`);
      }
    }
  }
  
  // 进一步检测：如果解析中有与题目相似的开头但更完整
  if (explanation && question.length < 30) {
    // 检查解析开头是否包含题目的关键部分
    const questionKeyPart = question.substring(0, Math.min(10, question.length));
    if (explanation.includes(questionKeyPart) && explanation !== question) {
      // 解析有更完整的版本，尝试提取
      // 格式："...为XXX则..." -> 提取 "为XXX则"
      const fullMatch = explanation.match(/([^则]+则)/);
      if (fullMatch) {
        const extracted = fullMatch[1].trim();
        if (extracted.length > question.length && extracted.length < 100) {
          // 解析中的内容更完整，替换
          question = extracted;
          console.log(`[ImportHelper] 用解析内容替换不完整题目: "${question}"`);
        }
      }
    }
  }

  // 去掉所有选项行，保留题目行
  // 选项行以 A. B. C. D. 开头
  const questionLines = questionText.split('\n').filter(line => {
    const trimmed = line.trim();
    // 跳过空行和选项行
    if (!trimmed) return false;
    if (/^[A-D][.、:：]/.test(trimmed)) return false;
    
    // 跳过PDF双栏碎片行：以数字+英文开头（如 "7 ISO, IEC等）发布的国际标准"）
    // 匹配格式：数字 + 空格/逗号 + 英文单词（可能有多个）+ "等" 或句号结尾
    if (/^\d+[\s,，.、][A-Za-z]{2,}([\s,，.、][A-Za-z]{2,})*[\s,，.、]*[等之的]?[）).\]]*$/.test(trimmed)) {
      return false;
    }
    
    // 跳过纯英文或包含大量英文的行（可能是PDF碎片）
    if (/^[A-Za-z\s,\.]+$/.test(trimmed) && trimmed.length < 80) return false;
    
    // 跳过以"等）"或"等]"结尾的行（国际标准碎片）
    if (/等[）)\]]+$/.test(trimmed)) return false;
    
    // 跳过以"发布的国际标准"结尾的行
    if (/发布的国际标准$/.test(trimmed)) return false;
    
    // 跳过以斜杠/开头的行
    if (/^\/\s*\d*$/.test(trimmed)) return false;
    
    // 跳过只有斜杠的行
    if (/^\/+$/.test(trimmed)) return false;
    
    // 跳过混合了斜杠和选项的行（如 "/ 2 D. a=0.29"）
    if (/^\/\s*\d*\s+[A-D][.、:：]/.test(trimmed)) return false;
    
    // 跳过单独的选项标记行（如 "D."）
    if (/^[A-D][.、:：]\s*$/.test(trimmed)) return false;
    
    return true;
  }).map(line => {
    // 清理每行内的PDF碎片
    let cleaned = line;
    
    // 移除行内的 "/ 数字" 碎片（如 "/ 2"）
    cleaned = cleaned.replace(/\s*\/\s*\d+/g, ' ');
    
    // 移除行内的 "/ 数字+选项" 碎片（如 "/ 2 D. a=0.29"）
    cleaned = cleaned.replace(/\s*\/\s*\d+\s+[A-D][.、:：]\s*[^A-D]*/g, ' ');
    
    // 移除行尾的 "/ 数字" 模式
    cleaned = cleaned.replace(/\s+\/\s*\d+\s*$/g, '');
    cleaned = cleaned.replace(/\s*\/\s*\d+\s*$/g, '');
    
    // 移除行内的 "a= 数字" 形式的碎片（来自PDF双栏的残留）
    cleaned = cleaned.replace(/\s+a=\s*\d+(\.\d+)?/g, '');
    
    // 清理连续空格
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
  });
  question = questionLines.join(' ').replace(/\s+/g, ' ').trim();
  
  // 关键修复：处理选项被错误识别为题目内容的情况
  // 如果题目以 "B." 或其他选项开头，说明选项被混入了题目
  // 需要从第一个选项标记处截断
  const firstOptionInQuestion = question.match(/^[^A-D]*?([A-D])[.、:：]/);
  if (firstOptionInQuestion && firstOptionInQuestion.index !== undefined && firstOptionInQuestion.index > 0) {
    const beforeOption = question.slice(0, firstOptionInQuestion.index).trim();
    if (beforeOption.length > 5) {
      question = beforeOption;
    }
  }
  
  // 进一步修复：如果题目超过200字符且包含多个选项标记，说明选项内容被混入了题目
  // 从第一个选项标记处截断
  if (question.length > 200) {
    const optionMatch = question.match(/(^|[^A-D])([A-D])[.、:：]/);
    if (optionMatch && optionMatch.index !== undefined && optionMatch.index > 10) {
      question = question.slice(0, optionMatch.index).trim();
    }
  }
  
  // 题目最大长度限制：正常选择题题目一般不超过200字符
  // 如果超过，检查是否在合理范围内
  if (question.length > 300 && choices.length >= 2) {
    // 题目太长了，说明选项被混入了，需要在第一个选项处截断
    const longOptionMatch = question.match(/([A-D])[.、:：]/);
    if (longOptionMatch && longOptionMatch.index !== undefined) {
      const potentialQuestion = question.slice(0, longOptionMatch.index).trim();
      if (potentialQuestion.length < question.length - 50) {
        question = potentialQuestion;
      }
    }
  }
  
  // 如果题目太短或不完整（只有填空标记），尝试从解析中提取
  // 但只有当没有有效选项时才从解析提取（避免把解析内容当题目）
  const isOnlyBlank = /^[_█□▢]{2,}/.test(question);
  if ((question.length <= 4 || isOnlyBlank || !question) && explanation && choices.length < 2) {
    // 尝试从解析中提取题目（可能包含"某项..."这样的解释）
    const expWithoutOptionRefs = explanation
      .replace(/^[A-D]项[：:]/g, '') // 去掉 "A项：" 等
      .replace(/[A-D]项[：:]/g, ' ')  // 替换为空格
      .trim();
    
    if (expWithoutOptionRefs.length > 5) {
      question = expWithoutOptionRefs.slice(0, 100); // 截取前100字符
    } else if (explanation.length > 5) {
      question = explanation.slice(0, 100);
    }
  }

  // 关键修复：检测题目中 "为...则" 之间的内容是否被截断（PDF图片符号丢失）
  // 例如："分辨力为，则" 中间应该有内容但被截断了
  // 或者 "分辨力为1个数字所代表的量值δ，则" 其中 δ 是图片丢失了
  try {
    if (explanation) {
      // 检测题目中 "为" 和 "则" 之间的字符数是否很少（正常应该有几个字符）
      const weiZhiMatch = question.match(/为([^则]*?)则/);
      
      if (weiZhiMatch) {
        const contentBetween = weiZhiMatch[1]; // "为" 和 "则" 之间的内容
        // 如果中间只有空白、逗号或很短的内容（< 3个非空白字符），说明可能有内容丢失
        const meaningfulLength = contentBetween.replace(/[，,、\s]/g, '').length;
        
        if (meaningfulLength < 3) {
          // 从解析中提取完整内容
          // 解析格式："数字显示装置的分辨力为1个数字所代表的量值δ，则取a=δ / 2"
          const fullMatch = explanation.match(/为([^则]+)则/);
          if (fullMatch) {
            const missingPart = fullMatch[1].trim();
            // 替换题目中的 "为...则" 部分
            if (missingPart.length > meaningfulLength && missingPart.length < 50) {
              question = question.replace(/为([^则]*?)则/, `为${missingPart}则`);
              console.log(`[ImportHelper] 从解析补全丢失内容: "${missingPart}"`);
            }
          }
        }
      }
      
      // 备选方案：如果题目很短（< 30字符）且解析中有类似开头
      if (question.length < 30 && question.length > 5) {
        const questionKey = question.slice(0, Math.min(10, question.length));
        // 检查解析是否包含类似开头（说明可能有更完整版本）
        if (explanation.includes(questionKey) && explanation.length > question.length + 10) {
          // 尝试提取解析中从题目的 "为" 到 "则" 的完整内容
          const weiStart = explanation.indexOf('为');
          const zeIndex = explanation.indexOf('则', weiStart);
          if (weiStart !== -1 && zeIndex !== -1 && zeIndex - weiStart > question.length - question.indexOf('为')) {
            const fullText = explanation.slice(weiStart, zeIndex + 1);
            if (fullText.length > question.length - question.indexOf('为') && fullText.length < 80) {
              // 用更完整的版本替换
              const beforeQuestion = question.slice(0, question.indexOf('为'));
              question = beforeQuestion + fullText;
              console.log(`[ImportHelper] 用解析完整内容替换: "${question}"`);
            }
          }
        }
      }
    }
  } catch (e) {
    console.error('[ImportHelper] 题目补全出错:', e);
  }

  // 如果仍然没有题目，但有答案，说明这是一个有效的题目块（题目可能在PDF另一栏）
  // 我们仍然保留这个块，标记为需要手动补充题目
  if (!question || question.length < 2) {
    // 如果完全没有题目文本，检查是否有选项
    if (choices.length >= 2) {
      // 把第一个选项或整段作为题目（临时）
      question = `【需补充题目】${rest.slice(0, 50)}...`;
    } else {
      // 完全没有可用的题目内容，跳过
      console.log('[ImportHelper] 跳过无效块（无题目、无选项）:', rest.slice(0, 50));
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 智能判断题目类型
  // ─────────────────────────────────────────────────────────────
  const type: 'single' | 'multiple' = answer.length > 1 ? 'multiple' : 'single';

  return {
    type,
    question,
    answer,
    explanation,
    choices: choices.length >= 2 ? choices : undefined,
    difficulty: 'medium',
    tags: []
  };
}

/**
 * 清理选项中的噪音文本（广告、版权、页码、网址等）
 */
function cleanOptionText(text: string): string {
  if (!text) return '';
  
  // 去除版权信息
  text = text.replace(/羿文教育官网\s*www\.yiwenjy\.com\s*版权所有/gi, '');
  text = text.replace(/yiwenjy\.com/gi, '');
  text = text.replace(/羿文教育/gi, '');
  text = text.replace(/专业网校课程[、，]题库软件[、，]考试用书[、，]资讯信息.*/gi, '');
  
  // 去除页码
  text = text.replace(/\s*\d+\s*$/g, '');
  
  // 去除网址
  text = text.replace(/https?:\/\/[^\s]+/gi, '');
  text = text.replace(/www\.[a-zA-Z0-9]+\.[a-zA-Z]+/gi, '');
  
  // 去除参考答案残留
  text = text.replace(/参考\s*[A-D]+/gi, '');
  
  // 去除"参考答案"等字样
  text = text.replace(/参考[答案]?\s*/gi, '');
  
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * 清理混合文本中的噪音
 */
function cleanNoiseText(text: string): string {
  if (!text) return '';
  
  // 去除版权信息
  text = text.replace(/羿文教育官网\s*www\.yiwenjy\.com\s*版权所有/gi, '');
  text = text.replace(/专业网校课程[、，]题库软件[、，]考试用书[、，]资讯信息.*/gi, '');
  text = text.replace(/yiwenjy\.com/gi, '');
  
  // 去除页码
  text = text.replace(/\s+\d+\s*$/g, '');
  
  // 去除网址
  text = text.replace(/https?:\/\/[^\s]+/gi, '');
  text = text.replace(/www\.[a-zA-Z0-9]+\.[a-zA-Z]+/gi, '');
  
  // 去除选项残留（如果还没被提取）
  text = text.replace(/^[A-D]\s*[.、:：]\s*/, '');
  
  return text.trim();
}

/**
 * 解析答案字符串
 */
function parseAnswer(answerStr: string): string[] {
  return answerStr.split(/[,，\s]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
}

// ========================
// OCR 识别
// ========================

/**
 * 加载 Tesseract.js 进行 OCR
 * 注意：需要网络连接加载 WASM 文件
 */
export async function performOCR(imageFile: File): Promise<string> {
  // 动态导入 Tesseract.js
  const Tesseract = await import('tesseract.js');
  
  const result = await Tesseract.recognize(imageFile, 'chi_sim+eng', {
    logger: (m) => console.log('[OCR]', m.status, m.progress)
  });
  
  return result.data.text;
}

// ========================
// 文件处理
// ========================

export type FileType = 'text' | 'docx' | 'pdf' | 'image';

/**
 * 检测文件类型
 */
export function detectFileType(file: File): FileType {
  const ext = file.name.toLowerCase().split('.').pop() || '';
  
  if (['txt', 'text', 'md'].includes(ext)) return 'text';
  if (['docx'].includes(ext)) return 'docx';
  if (['pdf'].includes(ext)) return 'pdf';
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) return 'image';
  
  // 根据 MIME 类型检测
  if (file.type.startsWith('text/')) return 'text';
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (file.type.startsWith('image/')) return 'image';
  
  return 'text'; // 默认作为文本处理
}

/**
 * 读取文件内容
 */
export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsText(file);
  });
}

/**
 * 解析 Word 文档 (.docx)
 */
export async function parseDocx(file: File): Promise<string> {
  // 动态导入 mammoth.js
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return result.value;
}

/**
 * 加载 PDF.js 库
 * 使用多个CDN备选
 */
function loadPdfJs(): Promise<any> {
  return new Promise((resolve, reject) => {
    // 如果已经加载，直接返回
    if ((window as any).pdfjsLib) {
      resolve((window as any).pdfjsLib);
      return;
    }

    // CDN列表（按优先级排序）
    const cdns = [
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174',
      'https://unpkg.com/pdfjs-dist@3.11.174/build',
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build'
    ];
    
    let cdnIndex = 0;
    
    function tryLoadCdn() {
      if (cdnIndex >= cdns.length) {
        reject(new Error('所有CDN都加载失败'));
        return;
      }
      
      const cdnBase = cdns[cdnIndex++];
      console.log('[PDF.js] 尝试加载:', cdnBase);
      
      // 加载主库
      const script = document.createElement('script');
      script.src = `${cdnBase}/pdf.min.js`;
      script.onload = () => {
        console.log('[PDF.js] 加载成功:', cdnBase);
        (window as any).pdfjsLib = (window as any).pdfjsLib;
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = `${cdnBase}/pdf.worker.min.js`;
        resolve((window as any).pdfjsLib);
      };
      script.onerror = () => {
        console.log('[PDF.js] 加载失败，尝试下一个CDN');
        tryLoadCdn();
      };
      document.head.appendChild(script);
    }
    
    tryLoadCdn();
  });
}

/**
 * 解析 PDF 文件
 */
export async function parsePdf(file: File): Promise<string> {
  try {
    // 加载 PDF.js
    const pdfjsLib = await loadPdfJs();

    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const pdf = await pdfjsLib.getDocument({ data }).promise;

    let text = '';
    for (let i = 1; i <= Number(pdf.numPages); i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      
      // 根据文本项的 Y 坐标判断是否换行
      const pageText = itemsToText(content.items as any[]);
      text += pageText + '\n';
    }

    console.log('[PDF解析] 成功，共', Number(pdf.numPages), '页');
    return text;
  } catch (error) {
    console.error('[PDF解析错误]', error);
    throw new Error(`PDF解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * 将 PDF 文本项转换为保留换行的文本
 * 改进版本：更好的合并策略
 */
function itemsToText(items: any[]): string {
  if (!items || items.length === 0) return '';
  
  // 调试：打印前20个文本项
  console.log('[PDF解析] 文本项数量:', items.length);
  if (items.length > 0) {
    console.log('[PDF解析] 前5个文本项:', items.slice(0, 5).map(i => ({
      str: i.str,
      y: i.transform ? i.transform[5] : null
    })));
  }
  
  const lines: string[] = [];
  let currentLine: string[] = [];
  let lastY: number | null = null;
  let lastX: number | null = null;
  
  for (const item of items) {
    const transform = item.transform || [1, 0, 0, 1, 0, 0];
    const x = transform[4]; // X 坐标
    const y = transform[5]; // Y 坐标
    const str = item.str || '';
    
    // 跳过空白字符
    if (!str.trim()) continue;
    
    // 判断是否换行：
    // 1. Y 坐标变化超过阈值（不同行）
    // 2. 或者 X 坐标突然变小很多（可能是新的一行）
    const yChanged = lastY !== null && Math.abs(y - lastY) > 2;
    const xReset = lastX !== null && x < lastX - 50; // X 坐标突然左移
    
    if ((yChanged || xReset) && currentLine.length > 0) {
      lines.push(currentLine.join(''));
      currentLine = [];
    }
    
    currentLine.push(str);
    lastY = y;
    lastX = x;
  }
  
  // 最后一行
  if (currentLine.length > 0) {
    lines.push(currentLine.join(''));
  }
  
  // 调试：打印前10行提取结果
  console.log('[PDF解析] 提取行数:', lines.length);
  console.log('[PDF解析] 前10行:', lines.slice(0, 10));
  
  return lines.join('\n');
}

// ========================
// 查重算法
// ========================

/**
 * 计算两个字符串的相似度 (Levenshtein 距离)
 * 返回 0-1 的相似度，1 表示完全相同
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  const len1 = s1.length;
  const len2 = s2.length;
  
  // 创建距离矩阵
  const matrix: number[][] = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));
  
  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // 删除
        matrix[i][j - 1] + 1,      // 插入
        matrix[i - 1][j - 1] + cost // 替换
      );
    }
  }
  
  const maxLen = Math.max(len1, len2);
  return 1 - matrix[len1][len2] / maxLen;
}

/**
 * 计算题目的哈希值（用于快速查重）
 */
export function calculateQuestionHash(question: string): string {
  // 移除标点、空格、转换为小写
  const normalized = question
    .toLowerCase()
    .replace(/[^\u4e00-\u9fa5a-z0-9]/g, '') // 只保留中文、英文、数字
    .slice(0, 100); // 取前100个字符
  return normalized;
}

/**
 * 查重结果
 */
export interface DuplicateCheckResult {
  originalQuestions: Question[];
  newQuestions: Partial<Question>[];
  duplicates: { new: Partial<Question>; original: Question; similarity: number }[];
}

/**
 * 检查重复题目
 * @param questions 待导入的题目
 * @param userId 用户ID
 * @param similarityThreshold 相似度阈值（默认 0.85）
 */
export function checkDuplicates(
  questions: Partial<Question>[],
  userId: string,
  similarityThreshold: number = 0.85
): DuplicateCheckResult {
  // 获取所有题库的已有题目
  const banks = getBanks(userId);
  const originalQuestions = banks.flatMap(b => b.questions);
  
  const newQuestions: Partial<Question>[] = [];
  const duplicates: DuplicateCheckResult['duplicates'] = [];
  
  for (const q of questions) {
    if (!q.question) continue;
    
    const hash = calculateQuestionHash(q.question);
    let isDuplicate = false;
    let mostSimilar: Question | null = null;
    let highestSimilarity = 0;
    
    for (const original of originalQuestions) {
      const originalHash = calculateQuestionHash(original.question);
      
      // 首先检查哈希是否相同（快速筛选）
      if (hash === originalHash) {
        isDuplicate = true;
        mostSimilar = original;
        highestSimilarity = 1;
        break;
      }
      
      // 计算相似度
      const similarity = calculateSimilarity(q.question, original.question);
      if (similarity > highestSimilarity && similarity >= similarityThreshold) {
        highestSimilarity = similarity;
        mostSimilar = original;
      }
    }
    
    if (mostSimilar && highestSimilarity >= similarityThreshold) {
      duplicates.push({
        new: q,
        original: mostSimilar,
        similarity: highestSimilarity
      });
    } else {
      newQuestions.push(q);
    }
  }
  
  return { originalQuestions, newQuestions, duplicates };
}

// ========================
// 批量导入接口
// ========================

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  duplicates: number;
  errors: string[];
}

/**
 * 处理文件导入
 */
export async function importFromFile(
  file: File,
  targetBankId?: string
): Promise<{ questions: Partial<Question>[]; rawText: string }> {
  const fileType = detectFileType(file);
  let text = '';
  
  switch (fileType) {
    case 'text':
      text = await readFileAsText(file);
      break;
    case 'docx':
      text = await parseDocx(file);
      break;
    case 'pdf':
      text = await parsePdf(file);
      break;
    case 'image':
      text = await performOCR(file);
      break;
    default:
      throw new Error(`不支持的文件类型: ${file.name}`);
  }
  
  // 解析题目
  const questions = parseTextToQuestions(text);
  
  return { questions, rawText: text };
}
