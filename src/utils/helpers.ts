import type { Question } from '../types';

/**
 * 从题库中随机抽取 count 道指定类型的题目
 * 当题库不足时，采用有放回抽样（bootstrap），并标记哪些题目是重复抽取的
 * 返回 { questions, repeatedIds } - repeatedIds 为重复抽取的题目ID集合
 */
export function randomPick(
  questions: Question[], 
  type: 'single' | 'multiple', 
  count: number
): { questions: Question[]; repeatedIds: Set<string> } {
  const filtered = questions.filter(q => q.type === type);
  const shuffled = [...filtered].sort(() => Math.random() - 0.5);
  
  // 题目足够，直接返回
  if (shuffled.length >= count) {
    return { questions: shuffled.slice(0, count), repeatedIds: new Set() };
  }
  
  // 题目不足，采用有放回抽样
  const result: Question[] = [...shuffled]; // 先放入所有不重复的题目
  const repeatedIds = new Set<string>(shuffled.map(q => q.id)); // 标记哪些会被视为"重复"
  
  // 继续抽取补足数量
  while (result.length < count) {
    const randomIdx = Math.floor(Math.random() * shuffled.length);
    const q = shuffled[randomIdx];
    result.push({ ...q, id: `${q.id}_rep_${result.length}` }); // 给重复题目新的ID避免冲突
  }
  
  return { questions: result, repeatedIds };
}

/**
 * 生成一套练习题（60单选 + 20多选）
 * 返回 { questions, insufficient, repeatedOriginalIds } - insufficient 表示题库是否不足
 * repeatedOriginalIds 为重复题目的原始ID集合，用于UI标记
 */
export function generatePracticeSet(questions: Question[]): { 
  questions: Question[]; 
  insufficient: boolean;
  repeatedOriginalIds: Set<string>;
} {
  const singlesResult = randomPick(questions, 'single', 60);
  const multiplesResult = randomPick(questions, 'multiple', 20);
  
  // 检查题库是否充足（单选需要60题，多选需要20题）
  const singlesCount = questions.filter(q => q.type === 'single').length;
  const multiplesCount = questions.filter(q => q.type === 'multiple').length;
  const insufficient = singlesCount < 60 || multiplesCount < 20;
  
  // 合并重复ID
  const allRepeated = new Set<string>();
  singlesResult.repeatedIds.forEach(id => allRepeated.add(id));
  multiplesResult.repeatedIds.forEach(id => allRepeated.add(id));
  
  return { 
    questions: [...singlesResult.questions, ...multiplesResult.questions], 
    insufficient,
    repeatedOriginalIds: allRepeated
  };
}

/**
 * 判断答案是否正确
 */
export function checkAnswer(question: Question, userAnswer: string[]): boolean {
  const correctSet = new Set(question.answer);
  const userSet = new Set(userAnswer);
  if (correctSet.size !== userSet.size) return false;
  for (const a of correctSet) {
    if (!userSet.has(a)) return false;
  }
  return true;
}

/**
 * 计算得分（满分100分）
 * 单选：每题1分；多选：每题2分（全对得2分，漏选得1分，错选/多选得0分）
 */
export function calculateScore(questions: Question[], answers: Array<{ questionId: string; userAnswer: string[]; isCorrect: boolean }>): {
  score: number;
  totalScore: number;
  correctCount: number;
  wrongCount: number;
} {
  let score = 0;
  let totalScore = 0;
  let correctCount = 0;
  let wrongCount = 0;

  answers.forEach(ans => {
    const q = questions.find(q => q.id === ans.questionId);
    if (!q) return;
    if (q.type === 'single') {
      totalScore += 1;
      if (ans.isCorrect) { score += 1; correctCount++; }
      else wrongCount++;
    } else {
      totalScore += 2;
      if (ans.isCorrect) {
        score += 2;
        correctCount++;
      } else {
        // 漏选（部分正确）得1分
        const correctSet = new Set(q.answer);
        const userSet = new Set(ans.userAnswer);
        const hasWrong = [...userSet].some(a => !correctSet.has(a));
        const hasMissing = [...correctSet].some(a => !userSet.has(a));
        if (!hasWrong && hasMissing) score += 1; // 漏选
        wrongCount++;
      }
    }
  });

  // 换算为100分制
  const normalizedScore = totalScore > 0 ? Math.round((score / totalScore) * 100) : 0;
  return { score: normalizedScore, totalScore: 100, correctCount, wrongCount };
}

/**
 * 生成唯一 ID
 */
export function genId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 格式化时间（秒 -> mm:ss）
 */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * cn 工具函数
 */
export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
