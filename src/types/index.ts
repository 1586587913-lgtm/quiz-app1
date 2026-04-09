// ========================
// 题目类型定义
// ========================

export type QuestionType = 'single' | 'multiple';

export interface Choice {
  id: string; // A, B, C, D, E...
  text: string;
  image?: string; // 选项图片（base64或URL）
}

export interface Question {
  id: string;
  type: QuestionType;
  category: string;       // 题目分类/知识点
  difficulty: 'easy' | 'medium' | 'hard';
  question: string;       // 题目内容
  image?: string;         // 题目图片（base64或URL）
  choices: Choice[];      // 选项
  answer: string[];       // 正确答案 id 数组
  explanation: string;    // 答案解析
  knowledge: string;      // 相关知识点
  tags: string[];         // 标签
  isExtended?: boolean;   // 是否为扩展题
}

// ========================
// 用户相关
// ========================

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  createdAt: number;
}

// ========================
// 练习记录
// ========================

export interface AnswerRecord {
  questionId: string;
  userAnswer: string[];
  isCorrect: boolean;
  timeSpent: number; // 秒
}

export interface ExamSession {
  id: string;
  userId: string;
  mode: 'practice' | 'review' | 'wrong';
  questionIds: string[];
  answers: AnswerRecord[];
  startTime: number;
  endTime?: number;
  score?: number;
  totalScore: number;
  status: 'ongoing' | 'completed';
}

// ========================
// 错题本
// ========================

export interface WrongQuestion {
  questionId: string;
  wrongCount: number;
  lastWrongAt: number;
  lastUserAnswer: string[];
}

// ========================
// 统计数据
// ========================

export interface UserStats {
  userId: string;
  totalExams: number;
  totalQuestions: number;
  correctCount: number;
  wrongQuestions: WrongQuestion[];
  categoryStats: Record<string, { total: number; correct: number }>;
  recentSessions: string[]; // session ids
}

// ========================
// 题库
// ========================

export interface QuestionBank {
  id: string;
  name: string;
  description: string;
  questions: Question[];
  createdAt: number;
  updatedAt: number;
}

// ========================
// 应用状态
// ========================

export type AppPage =
  | 'login'
  | 'home'
  | 'practice'
  | 'review'
  | 'result'
  | 'wrong-practice'
  | 'wrong-list'
  | 'bank-manage';

export interface AppState {
  currentPage: AppPage;
  currentUser: User | null;
  currentSession: ExamSession | null;
}
