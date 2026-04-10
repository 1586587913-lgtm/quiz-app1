import type { User, ExamSession, UserStats, QuestionBank } from '../types';
import { allQuestions, sampleQuestions, extendedQuestions, meteringQuestions } from '../data/questions';
import { 
  saveUserData,
  getUserDataFromJsonBin,
  hasUserDataInCloud,
  type JsonBinUserData
} from './jsonBinSync';

const KEYS = {
  users: 'quiz_users',
  currentUser: 'quiz_current_user',
  sessions: 'quiz_sessions',
  stats: 'quiz_stats',
  banks: 'quiz_banks',
  masteredQuestions: 'quiz_mastered',
  flaggedQuestions: 'quiz_flagged',
};

// 获取用户专属的题库key
function getBankKey(userId: string): string {
  return `quiz_banks_${userId}`;
}

// ===== 用户管理 =====
export function getUsers(): User[] {
  try {
    return JSON.parse(localStorage.getItem(KEYS.users) || '[]');
  } catch { return []; }
}

export function saveUser(user: User) {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === user.id);
  if (idx >= 0) users[idx] = user;
  else users.push(user);
  localStorage.setItem(KEYS.users, JSON.stringify(users));
}

export function login(username: string, password: string): User | null {
  const users = getUsers();
  const stored = localStorage.getItem(`pwd_${username}`);
  if (!stored || stored !== password) return null;
  return users.find(u => u.username === username) || null;
}

// 云端同步登录 - 使用 JSONBin
export async function loginWithCloudSync(username: string, password: string): Promise<User | null> {
  // 先尝试本地登录
  let user = login(username, password);
  
  // 如果本地登录成功，尝试从云端恢复数据
  if (user) {
    console.log('本地登录成功，检查云端数据...');
    const cloudData = await getUserDataFromJsonBin(username);
    
    if (cloudData) {
      console.log('从云端恢复数据...');
      
      // 恢复题库（合并）
      if (cloudData.banks && cloudData.banks.length > 0) {
        const localBanks = getBanks(user.id);
        const mergedBanks = [...localBanks];
        cloudData.banks.forEach((cloudBank: QuestionBank) => {
          const idx = mergedBanks.findIndex(b => b.id === cloudBank.id);
          if (idx < 0) {
            mergedBanks.push(cloudBank);
          }
        });
        localStorage.setItem(getBankKey(user.id), JSON.stringify(mergedBanks));
      }
      
      // 恢复统计
      if (cloudData.stats) {
        const allStats: Record<string, UserStats> = JSON.parse(localStorage.getItem(KEYS.stats) || '{}');
        allStats[user.id] = cloudData.stats;
        localStorage.setItem(KEYS.stats, JSON.stringify(allStats));
      }
      
      // 恢复掌握题库
      if (cloudData.masteredQuestions && cloudData.masteredQuestions.length > 0) {
        saveMasteredQuestions(cloudData.masteredQuestions);
      }
      
      // 恢复错题
      if (cloudData.wrongQuestions && cloudData.wrongQuestions.length > 0) {
        const allStats: Record<string, UserStats> = JSON.parse(localStorage.getItem(KEYS.stats) || '{}');
        allStats[user.id] = {
          ...(allStats[user.id] || createEmptyStats(user.id)),
          wrongQuestions: cloudData.wrongQuestions.map((w: any) => ({
            questionId: w.questionId,
            wrongCount: w.wrongCount,
            lastWrongAt: w.lastWrongAt,
            lastUserAnswer: w.lastUserAnswer,
          })),
        };
        localStorage.setItem(KEYS.stats, JSON.stringify(allStats));
      }
      
      console.log('云端数据恢复完成！');
    }
    
    // 同步本地数据到云端
    await syncToJsonBin(user.id, username);
    return user;
  }
  
  // 本地登录失败，尝试从云端恢复（用于换设备登录）
  console.log('本地未找到用户，检查云端...');
  const cloudData = await getUserDataFromJsonBin(username);
  
  if (cloudData) {
    console.log('从云端创建本地账号并恢复数据...');
    
    // 创建本地账号
    const newUser = register(username, password, cloudData.username || username);
    if (!newUser) return null;
    
    // 恢复题库
    if (cloudData.banks && cloudData.banks.length > 0) {
      localStorage.setItem(getBankKey(newUser.id), JSON.stringify(cloudData.banks));
    } else {
      initDefaultBank(newUser.id);
    }
    
    // 恢复统计
    if (cloudData.stats) {
      localStorage.setItem(KEYS.stats, JSON.stringify({
        [newUser.id]: cloudData.stats,
      }));
    }
    
    // 恢复掌握题库
    if (cloudData.masteredQuestions && cloudData.masteredQuestions.length > 0) {
      saveMasteredQuestions(cloudData.masteredQuestions);
    }
    
    console.log('云端账号恢复完成！');
    return newUser;
  }
  
  console.log('本地和云端都没有该用户');
  return null;
}

// 注册时同步到 JSONBin
export async function registerWithCloudSync(username: string, password: string, displayName: string): Promise<User | null> {
  // 先本地注册（不依赖云端）
  const user = register(username, password, displayName);
  if (!user) return null;

  // 初始化内置题库
  initDefaultBank(user.id);

  // 尝试云端同步（失败不影响本地注册）
  try {
    await syncToJsonBin(user.id, username);
    console.log('注册成功，数据已同步到云端');
  } catch (e) {
    console.log('注册成功，云端同步暂不可用，已保存到本地');
  }

  return user;
}

// 同步本地数据到 JSONBin
export async function syncToJsonBin(userId: string, username: string): Promise<boolean> {
  try {
    const banks = getBanks(userId);
    const stats = getStats(userId);
    const masteredQuestions = getMasteredQuestions();

    return await saveUserData(
      username,
      userId,
      banks,
      stats,
      masteredQuestions,
      stats.wrongQuestions
    );
  } catch (error) {
    console.error('同步到 JSONBin 失败:', error);
    return false;
  }
}

// 兼容旧函数名
export async function syncToCloud(userId: string, username: string, _password?: string): Promise<boolean> {
  return syncToJsonBin(userId, username);
}

// 登录后调用此函数确保数据同步
export async function ensureCloudSync(user: User): Promise<void> {
  await syncToJsonBin(user.id, user.username);
}

export function register(username: string, password: string, displayName: string): User | null {
  const users = getUsers();
  if (users.find(u => u.username === username)) return null;
  const user: User = {
    id: `u_${Date.now()}`,
    username,
    displayName,
    createdAt: Date.now(),
  };
  saveUser(user);
  localStorage.setItem(`pwd_${username}`, password);
  return user;
}

export function getCurrentUser(): User | null {
  try {
    const s = localStorage.getItem(KEYS.currentUser);
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

export function setCurrentUser(user: User | null) {
  if (user) localStorage.setItem(KEYS.currentUser, JSON.stringify(user));
  else localStorage.removeItem(KEYS.currentUser);
}

// ===== 会话管理 =====
export function getSessions(): ExamSession[] {
  try {
    return JSON.parse(localStorage.getItem(KEYS.sessions) || '[]');
  } catch { return []; }
}

export function saveSession(session: ExamSession) {
  const sessions = getSessions();
  const idx = sessions.findIndex(s => s.id === session.id);
  if (idx >= 0) sessions[idx] = session;
  else sessions.push(session);
  localStorage.setItem(KEYS.sessions, JSON.stringify(sessions));
}

export function getSession(id: string): ExamSession | null {
  return getSessions().find(s => s.id === id) || null;
}

// ===== 统计管理 =====
export function getStats(userId: string): UserStats {
  try {
    const allStats: Record<string, UserStats> = JSON.parse(localStorage.getItem(KEYS.stats) || '{}');
    return allStats[userId] || createEmptyStats(userId);
  } catch { return createEmptyStats(userId); }
}

function createEmptyStats(userId: string): UserStats {
  return {
    userId,
    totalExams: 0,
    totalQuestions: 0,
    correctCount: 0,
    wrongQuestions: [],
    categoryStats: {},
    recentSessions: [],
  };
}

export function saveStats(stats: UserStats) {
  try {
    const allStats: Record<string, UserStats> = JSON.parse(localStorage.getItem(KEYS.stats) || '{}');
    allStats[stats.userId] = stats;
    localStorage.setItem(KEYS.stats, JSON.stringify(allStats));
    
    // 自动同步到 JSONBin（异步，不阻塞）
    const user = getCurrentUser();
    if (user) {
      syncToJsonBin(stats.userId, user.username);
    }
  } catch {}
}

// 删除错题
export function removeWrongQuestion(userId: string, questionId: string) {
  const stats = getStats(userId);
  stats.wrongQuestions = stats.wrongQuestions.filter(w => w.questionId !== questionId);
  saveStats(stats);
}

// 批量删除错题
export function removeWrongQuestions(userId: string, questionIds: string[]) {
  const stats = getStats(userId);
  stats.wrongQuestions = stats.wrongQuestions.filter(w => !questionIds.includes(w.questionId));
  saveStats(stats);
}

// 清空全部错题
export function clearAllWrongQuestions(userId: string) {
  const stats = getStats(userId);
  stats.wrongQuestions = [];
  saveStats(stats);
}

export function updateStatsAfterSession(session: ExamSession) {
  if (!session.userId) return;
  const stats = getStats(session.userId);
  stats.totalExams += 1;
  stats.totalQuestions += session.answers.length;
  stats.correctCount += session.answers.filter(a => a.isCorrect).length;

  // 更新错题本
  session.answers.forEach(ans => {
    if (!ans.isCorrect) {
      const existing = stats.wrongQuestions.find(w => w.questionId === ans.questionId);
      if (existing) {
        existing.wrongCount++;
        existing.lastWrongAt = Date.now();
        existing.lastUserAnswer = ans.userAnswer;
      } else {
        stats.wrongQuestions.push({
          questionId: ans.questionId,
          wrongCount: 1,
          lastWrongAt: Date.now(),
          lastUserAnswer: ans.userAnswer,
        });
      }
    }
  });

  // 分类统计
  session.answers.forEach(ans => {
    const q = allQuestions.find(q => q.id === ans.questionId);
    if (q) {
      if (!stats.categoryStats[q.category]) {
        stats.categoryStats[q.category] = { total: 0, correct: 0 };
      }
      stats.categoryStats[q.category].total++;
      if (ans.isCorrect) stats.categoryStats[q.category].correct++;
    }
  });

  // 最近会话
  stats.recentSessions.unshift(session.id);
  if (stats.recentSessions.length > 20) stats.recentSessions = stats.recentSessions.slice(0, 20);

  saveStats(stats);
}

// ===== 题库管理（用户隔离）=====
export function getBanks(userId: string): QuestionBank[] {
  try {
    const banks = JSON.parse(localStorage.getItem(getBankKey(userId)) || '[]');
    return banks;
  } catch { return []; }
}

export function saveBank(bank: QuestionBank, userId: string) {
  const banks = getBanks(userId);
  const idx = banks.findIndex((b: QuestionBank) => b.id === bank.id);
  if (idx >= 0) banks[idx] = bank;
  else banks.push(bank);
  localStorage.setItem(getBankKey(userId), JSON.stringify(banks));
  
  // 自动同步到 JSONBin（异步，不阻塞）
  const user = getCurrentUser();
  if (user) {
    syncToJsonBin(userId, user.username);
  }
}

export function deleteBank(id: string, userId: string) {
  const banks = getBanks(userId).filter((b: QuestionBank) => b.id !== id);
  localStorage.setItem(getBankKey(userId), JSON.stringify(banks));
  
  // 自动同步到 JSONBin（异步，不阻塞）
  const user = getCurrentUser();
  if (user) {
    syncToJsonBin(userId, user.username);
  }
}

// 初始化内置题库
export function initDefaultBank(userId: string) {
  const banks = getBanks(userId);

  // 电工基础题库
  if (!banks.find((b: QuestionBank) => b.id === 'bank_electrical')) {
    saveBank({
      id: 'bank_electrical',
      name: '电工基础题库',
      description: '电路基础、安全用电、变压器、电动机等核心知识点，共50题',
      questions: [...sampleQuestions, ...extendedQuestions],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }, userId);
  }

  // 二级计量工程师题库
  if (!banks.find((b: QuestionBank) => b.id === 'bank_metering')) {
    saveBank({
      id: 'bank_metering',
      name: '二级计量工程师题库',
      description: '2025年考前预测卷，含计量法律法规及综合知识、计量专业实务，共50题',
      questions: meteringQuestions,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }, userId);
  }

  // 合并题库（兼容旧版本）
  if (!banks.find((b: QuestionBank) => b.id === 'default')) {
    saveBank({
      id: 'default',
      name: '全部题库',
      description: '电工基础 + 二级计量工程师，共100题',
      questions: [...sampleQuestions, ...extendedQuestions, ...meteringQuestions],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }, userId);
  }
}

// ===== 掌握题库管理 =====
export interface MasteredQuestion {
  questionId: string;
  masteredAt: number;
}

export function getMasteredQuestions(): MasteredQuestion[] {
  try {
    return JSON.parse(localStorage.getItem(KEYS.masteredQuestions) || '[]');
  } catch { return []; }
}

export function saveMasteredQuestions(mastered: MasteredQuestion[]) {
  localStorage.setItem(KEYS.masteredQuestions, JSON.stringify(mastered));
  
  // 自动同步到 JSONBin（异步，不阻塞）
  const user = getCurrentUser();
  if (user) {
    syncToJsonBin(user.id, user.username);
  }
}

export function addMasteredQuestion(questionId: string) {
  const mastered = getMasteredQuestions();
  if (!mastered.find(m => m.questionId === questionId)) {
    mastered.push({ questionId, masteredAt: Date.now() });
    saveMasteredQuestions(mastered);
  }
}

export function removeMasteredQuestion(questionId: string) {
  const mastered = getMasteredQuestions().filter(m => m.questionId !== questionId);
  saveMasteredQuestions(mastered);
}

export function isMastered(questionId: string): boolean {
  return getMasteredQuestions().some(m => m.questionId === questionId);
}

// ===== 问题题目标记管理 =====
export interface FlaggedQuestion {
  questionId: string;
  bankId: string;
  flaggedAt: number;
  note?: string;
}

export function getFlaggedQuestions(): FlaggedQuestion[] {
  return JSON.parse(localStorage.getItem(KEYS.flaggedQuestions) || '[]');
}

export function saveFlaggedQuestions(flagged: FlaggedQuestion[]) {
  localStorage.setItem(KEYS.flaggedQuestions, JSON.stringify(flagged));
}

export function addFlaggedQuestion(questionId: string, bankId: string, note?: string) {
  const flagged = getFlaggedQuestions();
  const filtered = flagged.filter(f => f.questionId !== questionId);
  filtered.push({ questionId, bankId, flaggedAt: Date.now(), note });
  saveFlaggedQuestions(filtered);
}

export function removeFlaggedQuestion(questionId: string) {
  const flagged = getFlaggedQuestions().filter(f => f.questionId !== questionId);
  saveFlaggedQuestions(flagged);
}

export function isFlagged(questionId: string): boolean {
  return getFlaggedQuestions().some(f => f.questionId === questionId);
}

export function getFlaggedQuestionIds(): Set<string> {
  return new Set(getFlaggedQuestions().map(f => f.questionId));
}

export function getFlaggedByBank(bankId: string): FlaggedQuestion[] {
  return getFlaggedQuestions().filter(f => f.bankId === bankId);
}

// ===== 数据导出/导入（跨设备同步）=====
export interface ExportData {
  version: number;
  exportTime: number;
  user: User;
  password: string;
  banks: QuestionBank[];
  stats: UserStats;
  masteredQuestions: MasteredQuestion[];
  wrongQuestions: { questionId: string; wrongCount: number; lastWrongAt: number; lastUserAnswer: string[] }[];
}

export function exportUserData(): ExportData | null {
  const user = getCurrentUser();
  if (!user) return null;
  
  const password = localStorage.getItem(`pwd_${user.username}`) || '';
  const banks = getBanks(user.id);
  const stats = getStats(user.id);
  const masteredQuestions = getMasteredQuestions();
  
  return {
    version: 1,
    exportTime: Date.now(),
    user,
    password,
    banks,
    stats,
    masteredQuestions,
    wrongQuestions: stats.wrongQuestions,
  };
}

export function downloadExportData() {
  const data = exportUserData();
  if (!data) {
    alert('请先登录后再导出数据');
    return;
  }
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `quiz-data-${data.user.username}-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importUserData(file: File): Promise<{ success: boolean; message: string }> {
  try {
    const text = await file.text();
    const data: ExportData = JSON.parse(text);
    
    if (!data.version || !data.user || !data.user.username) {
      return { success: false, message: '文件格式无效' };
    }
    
    const existingUsers = getUsers();
    const existingUser = existingUsers.find(u => u.username === data.user.username);
    
    if (existingUser) {
      const existingBanks = getBanks(existingUser.id);
      const existingStats = getStats(existingUser.id);
      
      const mergedBanks = [...existingBanks];
      data.banks.forEach(bank => {
        if (!mergedBanks.find(b => b.id === bank.id)) {
          mergedBanks.push(bank);
        }
      });
      
      const mergedWrong = [...existingStats.wrongQuestions];
      data.wrongQuestions.forEach(wrong => {
        const idx = mergedWrong.findIndex(w => w.questionId === wrong.questionId);
        if (idx < 0) {
          mergedWrong.push(wrong);
        } else if (wrong.wrongCount > mergedWrong[idx].wrongCount) {
          mergedWrong[idx] = wrong;
        }
      });
      
      localStorage.setItem(getBankKey(existingUser.id), JSON.stringify(mergedBanks));
      const newStats = { ...existingStats, wrongQuestions: mergedWrong };
      saveStats(newStats);
      
      return { success: true, message: `已合并 ${data.user.username} 的数据到现有账号` };
    } else {
      const newUser: User = {
        ...data.user,
        id: `u_${Date.now()}`,
      };
      saveUser(newUser);
      localStorage.setItem(`pwd_${newUser.username}`, data.password);
      
      data.banks.forEach(bank => saveBank(bank, newUser.id));
      
      const newStats = { ...data.stats, userId: newUser.id };
      saveStats(newStats);
      
      return { success: true, message: `已导入账号 ${data.user.username} 的数据` };
    }
  } catch (e) {
    return { success: false, message: '导入失败：' + (e instanceof Error ? e.message : '未知错误') };
  }
}
