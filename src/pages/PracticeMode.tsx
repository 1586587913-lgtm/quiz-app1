import { useState, useEffect, useCallback } from 'react';
import type { Question, ExamSession, AnswerRecord, User } from '../types';
import type { AppPage } from '../types';
import { genId, checkAnswer, calculateScore, formatTime } from '../utils/helpers';
import { saveSession, updateStatsAfterSession, getBanks, removeMasteredQuestion, addFlaggedQuestion, removeFlaggedQuestion, getFlaggedQuestionIds } from '../utils/storage';
import { generatePracticeSet } from '../utils/helpers';
import { allQuestions } from '../data/questions';
import Calculator from '../components/Calculator';

interface PracticeModeProps {
  user: User;
  onNavigate: (page: AppPage, sessionId?: string) => void;
  questionsOverride?: Question[]; // 用于错题专练
  modeLabel?: string;
  bankId?: string; // 指定题库ID
}

export default function PracticeMode({ user, onNavigate, questionsOverride, modeLabel, bankId }: PracticeModeProps) {
  const [session, setSession] = useState<ExamSession | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Map<string, string[]>>(new Map());
  const [submitted, setSubmitted] = useState<Set<string>>(new Set());
  const [showAnalysis, setShowAnalysis] = useState<Set<string>>(new Set());
  const [showCalc, setShowCalc] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [finished, setFinished] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showQuestionMap, setShowQuestionMap] = useState(false);
  const [finalResult, setFinalResult] = useState<ReturnType<typeof calculateScore> | null>(null);
  const [startTime] = useState(Date.now());
  const [showInsufficientWarning, setShowInsufficientWarning] = useState(false);
  const [insufficientInfo, setInsufficientInfo] = useState({ singles: 0, multiples: 0 });
  const [showRemoveWrongConfirm, setShowRemoveWrongConfirm] = useState(false);
  const [correctlyAnsweredInWrongMode, setCorrectlyAnsweredInWrongMode] = useState<string[]>([]);
  const [repeatedOriginalIds, setRepeatedOriginalIds] = useState<Set<string>>(new Set());
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());
  const [showFlaggedList, setShowFlaggedList] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  // 初始化题目
  useEffect(() => {
    let qs: Question[];
    let insufficient = false;
    let info = { singles: 0, multiples: 0 };
    
    if (questionsOverride) {
      qs = questionsOverride;
    } else {
      const banks = getBanks(user.id);
      console.log('[练题] bankId:', bankId);
      console.log('[练题] 可用题库:', banks.map(b => ({ id: b.id, name: b.name, count: b.questions?.length || 0 })));
      
      // 处理内置题库选择
      if (bankId === 'builtin_all') {
        // 全部题库：用户题库 + 内置题库
        const allBankQuestions = banks.reduce<Question[]>((acc, b) => [...acc, ...(b.questions || [])], []);
        const merged = [...allBankQuestions, ...allQuestions];
        const seen = new Set<string>();
        const unique = merged.filter(q => {
          if (seen.has(q.id)) return false;
          seen.add(q.id);
          return true;
        });
        const result = generatePracticeSet(unique);
        qs = result.questions;
        insufficient = result.insufficient;
        setRepeatedOriginalIds(result.repeatedOriginalIds);
        info = {
          singles: unique.filter(q => q.type === 'single').length,
          multiples: unique.filter(q => q.type === 'multiple').length
        };
      } else if (bankId === 'builtin_electrical') {
        // 电工基础题库
        const electrical = allQuestions.filter(q => 
          q.category === '电路基础' || q.category === '电工安全规程'
        );
        const result = generatePracticeSet(electrical);
        qs = result.questions;
        insufficient = result.insufficient;
        setRepeatedOriginalIds(result.repeatedOriginalIds);
        info = {
          singles: electrical.filter(q => q.type === 'single').length,
          multiples: electrical.filter(q => q.type === 'multiple').length
        };
      } else if (bankId === 'builtin_metering') {
        // 二级计量工程师题库
        const metering = allQuestions.filter(q => q.category === '二级计量工程师');
        const result = generatePracticeSet(metering);
        qs = result.questions;
        insufficient = result.insufficient;
        setRepeatedOriginalIds(result.repeatedOriginalIds);
        info = {
          singles: metering.filter(q => q.type === 'single').length,
          multiples: metering.filter(q => q.type === 'multiple').length
        };
      } else if (bankId === 'default') {
        // 全部题库：动态合并所有非"全部题库"的题库题目
        const allBankQuestions = banks
          .filter(b => b.id !== 'default')
          .reduce<Question[]>((acc, b) => [...acc, ...(b.questions || [])], []);
        const seen = new Set<string>();
        const unique = allBankQuestions.filter(q => {
          if (seen.has(q.id)) return false;
          seen.add(q.id);
          return true;
        });
        const result = generatePracticeSet(unique);
        qs = result.questions;
        insufficient = result.insufficient;
        setRepeatedOriginalIds(result.repeatedOriginalIds);
        info = {
          singles: unique.filter(q => q.type === 'single').length,
          multiples: unique.filter(q => q.type === 'multiple').length
        };
      } else if (bankId) {
        // 使用指定用户题库
        const selectedBank = banks.find(b => b.id === bankId);
        console.log('[练题] 选中题库:', selectedBank?.name, selectedBank?.questions.length);
        const result = selectedBank ? generatePracticeSet(selectedBank.questions) : generatePracticeSet(banks[0]?.questions || []);
        qs = result.questions;
        insufficient = result.insufficient;
        setRepeatedOriginalIds(result.repeatedOriginalIds);
        info = {
          singles: selectedBank?.questions.filter(q => q.type === 'single').length || 0,
          multiples: selectedBank?.questions.filter(q => q.type === 'multiple').length || 0
        };
      } else {
        // 没有指定题库：合并所有非"全部题库"的题库题目
        const allBankQuestions = banks
          .filter(b => b.id !== 'default')
          .reduce<Question[]>((acc, b) => [...acc, ...(b.questions || [])], []);
        const seen = new Set<string>();
        const unique = allBankQuestions.filter(q => {
          if (seen.has(q.id)) return false;
          seen.add(q.id);
          return true;
        });
        const result = generatePracticeSet(unique);
        qs = result.questions;
        insufficient = result.insufficient;
        setRepeatedOriginalIds(result.repeatedOriginalIds);
        info = {
          singles: unique.filter(q => q.type === 'single').length,
          multiples: unique.filter(q => q.type === 'multiple').length
        };
      }
    }
    setQuestions(qs);
    
    // 显示题库不足提示
    if (insufficient) {
      setInsufficientInfo(info);
      setShowInsufficientWarning(true);
    }

    const sess: ExamSession = {
      id: genId(),
      userId: user.id,
      mode: questionsOverride ? 'wrong' : 'practice',
      questionIds: qs.map(q => q.id),
      answers: [],
      startTime: Date.now(),
      totalScore: 100,
      status: 'ongoing',
    };
    setSession(sess);
    saveSession(sess);
  }, [user.id, questionsOverride]);

  // 计时器
  useEffect(() => {
    const timer = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const currentQ = questions[currentIndex];

  const handleSelect = useCallback((qId: string, choiceId: string, type: 'single' | 'multiple') => {
    if (submitted.has(qId)) return;
    setUserAnswers(prev => {
      const next = new Map(prev);
      if (type === 'single') {
        next.set(qId, [choiceId]);
      } else {
        const curr = next.get(qId) || [];
        if (curr.includes(choiceId)) {
          next.set(qId, curr.filter(c => c !== choiceId));
        } else {
          next.set(qId, [...curr, choiceId].sort());
        }
      }
      return next;
    });
  }, [submitted]);

  const handleSubmitAnswer = useCallback((qId: string) => {
    const q = questions.find(q => q.id === qId);
    if (!q) return;
    const ua = userAnswers.get(qId) || [];
    if (ua.length === 0) return;
    
    // 错题专练模式：记录答对的题目
    const isWrongMode = session?.mode === 'wrong';
    const isCorrect = checkAnswer(q, ua);
    if (isWrongMode && isCorrect) {
      setCorrectlyAnsweredInWrongMode(prev => [...prev, qId]);
    }
    
    setSubmitted(prev => new Set([...prev, qId]));
    setShowAnalysis(prev => new Set([...prev, qId]));
  }, [questions, userAnswers, session?.mode]);

  const handleFinish = useCallback(() => {
    if (!session) return;
    // 只记录用户实际做过的题目（选择了至少一个选项的）
    const answerRecords: AnswerRecord[] = questions
      .map(q => {
        const ua = userAnswers.get(q.id) || [];
        return {
          questionId: q.id,
          userAnswer: ua,
          isCorrect: checkAnswer(q, ua),
          timeSpent: Math.round((Date.now() - startTime) / 1000 / questions.length),
        };
      })
      .filter(r => r.userAnswer.length > 0); // 过滤掉没做过的题目

    const result = calculateScore(questions, answerRecords);
    setFinalResult(result);

    const updatedSession: ExamSession = {
      ...session,
      answers: answerRecords,
      endTime: Date.now(),
      score: result.score,
      status: 'completed',
    };
    saveSession(updatedSession);
    updateStatsAfterSession(updatedSession);
    setSession(updatedSession);
    setShowFinishConfirm(false);

    // 错题专练模式：询问是否移除答对的题目
    if (session.mode === 'wrong' && correctlyAnsweredInWrongMode.length > 0) {
      setShowRemoveWrongConfirm(true);
    } else if (flaggedQuestions.size > 0) {
      // 有标记的题目，显示标记列表
      setShowFlaggedList(true);
    } else {
      setFinished(true);
      onNavigate('result', updatedSession.id);
    }
  }, [session, questions, userAnswers, startTime, onNavigate, correctlyAnsweredInWrongMode, flaggedQuestions.size]);

  const handleRemoveWrongAndFinish = useCallback((remove: boolean) => {
    if (remove) {
      correctlyAnsweredInWrongMode.forEach(qId => removeMasteredQuestion(qId));
    }
    setShowRemoveWrongConfirm(false);
    // 检查是否有标记的题目
    if (flaggedQuestions.size > 0) {
      setShowFlaggedList(true);
    } else {
      setFinished(true);
      if (session) {
        onNavigate('result', session.id);
      }
    }
  }, [correctlyAnsweredInWrongMode, session, onNavigate, flaggedQuestions.size]);

  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f0f4f8' }}>
        <div className="card text-center p-10">
          <div className="text-4xl mb-4">⏳</div>
          <div className="text-gray-600">正在加载题目...</div>
        </div>
      </div>
    );
  }

  if (finished) {
    return null;
  }

  const answeredCount = submitted.size;
  const totalCount = questions.length;
  const progress = Math.round((answeredCount / totalCount) * 100);

  return (
    <div className="min-h-screen" style={{ background: '#f0f4f8' }}>
      {/* 顶部栏 */}
      <header className="sticky top-0 z-30 shadow-sm"
        style={{ background: 'linear-gradient(90deg, #1e3a8a, #4c1d95)' }}>
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowFinishConfirm(true)}
              className="text-white text-sm flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 12L6 8L10 4"/>
              </svg>
              退出
            </button>
            <span className="text-white font-bold">{modeLabel || '练题模式'}</span>
            <span className="badge text-xs" style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}>
              {answeredCount}/{totalCount}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white text-sm font-mono">{formatTime(elapsed)}</span>
            <button onClick={() => setShowCalc(!showCalc)}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white flex items-center gap-1"
              style={{ background: showCalc ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.15)' }}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                <rect x="6" y="6" width="3" height="2" rx="0.5" fill="currentColor"/>
                <rect x="11" y="6" width="3" height="2" rx="0.5" fill="currentColor"/>
                <rect x="6" y="10" width="3" height="2" rx="0.5" fill="currentColor"/>
                <rect x="11" y="10" width="3" height="2" rx="0.5" fill="currentColor"/>
                <rect x="6" y="14" width="3" height="2" rx="0.5" fill="currentColor"/>
                <rect x="11" y="14" width="3" height="2" rx="0.5" fill="currentColor"/>
              </svg>
              计算器
            </button>
            <button onClick={() => setShowQuestionMap(!showQuestionMap)}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white"
              style={{ background: 'rgba(255,255,255,0.15)' }}>
              题目列表
            </button>
            <button onClick={() => setShowFinishConfirm(true)}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold"
              style={{ background: '#f59e0b', color: 'white' }}>
              交卷
            </button>
          </div>
        </div>
        {/* 进度条 */}
        <div className="h-1 bg-white/20">
          <div className="h-full bg-yellow-400 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-4 flex gap-4">
        {/* 主区域 */}
        <div className="flex-1 min-w-0">
          {currentQ && (
            <QuestionCard
              question={currentQ}
              index={currentIndex}
              total={totalCount}
              userAnswer={userAnswers.get(currentQ.id) || []}
              isSubmitted={submitted.has(currentQ.id)}
              showAnalysis={showAnalysis.has(currentQ.id)}
              isRepeated={currentQ.id.includes('_rep_')}
              isFlagged={flaggedQuestions.has(currentQ.id)}
              onSelect={(choiceId) => handleSelect(currentQ.id, choiceId, currentQ.type)}
              onSubmit={() => handleSubmitAnswer(currentQ.id)}
              onToggleAnalysis={() => {
                if (submitted.has(currentQ.id)) {
                  setShowAnalysis(prev => {
                    const next = new Set(prev);
                    if (next.has(currentQ.id)) next.delete(currentQ.id);
                    else next.add(currentQ.id);
                    return next;
                  });
                }
              }}
              onPrev={() => setCurrentIndex(i => Math.max(0, i - 1))}
              onNext={() => setCurrentIndex(i => Math.min(totalCount - 1, i + 1))}
              onToggleFlag={() => {
                const qId = currentQ.id;
                const originalId = qId.includes('_rep_') ? qId.split('_rep_')[0] : qId;
                setFlaggedQuestions(prev => {
                  const next = new Set(prev);
                  if (next.has(qId)) {
                    next.delete(qId);
                    removeFlaggedQuestion(originalId);
                  } else {
                    next.add(qId);
                    addFlaggedQuestion(originalId, bankId || '');
                  }
                  return next;
                });
              }}
            />
          )}
        </div>

        {/* 计算器 */}
        {showCalc && (
          <div className="w-72 flex-shrink-0">
            <Calculator onClose={() => setShowCalc(false)} />
          </div>
        )}
      </div>

      {/* 题目导航地图 */}
      {showQuestionMap && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowQuestionMap(false)}>
          <div className="card w-full max-w-xl max-h-[70vh] overflow-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">题目导航</h3>
              <button onClick={() => setShowQuestionMap(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="mb-3">
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-5 h-5 rounded bg-green-100 border border-green-300 inline-block"/> 已答对</span>
                <span className="flex items-center gap-1"><span className="w-5 h-5 rounded bg-red-100 border border-red-300 inline-block"/> 已答错</span>
                <span className="flex items-center gap-1"><span className="w-5 h-5 rounded bg-blue-100 border border-blue-300 inline-block"/> 已选未提交</span>
                <span className="flex items-center gap-1"><span className="w-5 h-5 rounded bg-gray-100 border border-gray-200 inline-block"/> 未答</span>
                <span className="flex items-center gap-1"><span className="w-5 h-5 rounded bg-amber-100 border border-amber-300 inline-block text-amber-600">↻</span> 重复题</span>
              </div>
            </div>
            <div className="mb-2">
              <div className="text-xs font-semibold text-gray-500 mb-2">
                单选题（{questions.filter(q => q.type === 'single').length}题）
              </div>
              <div className="grid grid-cols-10 gap-1.5">
                {questions.map((q, i) => {
                  if (q.type !== 'single') return null;
                  const ua = userAnswers.get(q.id) || [];
                  const isSubmitted = submitted.has(q.id);
                  const isCorrect = isSubmitted && checkAnswer(q, ua);
                  const isWrong = isSubmitted && !isCorrect;
                  const hasSelected = ua.length > 0 && !isSubmitted;
                  const isRepeated = q.id.includes('_rep_');
                  return (
                    <button key={q.id}
                      onClick={() => { setCurrentIndex(i); setShowQuestionMap(false); }}
                      className={`w-8 h-8 rounded text-xs font-semibold transition-all relative ${
                        i === currentIndex ? 'ring-2 ring-blue-500' : ''
                      } ${isRepeated ? 'bg-amber-100 text-amber-700 border border-amber-300'
                        : isCorrect ? 'bg-green-100 text-green-700 border border-green-300'
                        : isWrong ? 'bg-red-100 text-red-700 border border-red-300'
                        : hasSelected ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                      {i + 1}
                      {isRepeated && <span className="absolute -top-1 -right-1 text-[8px]">↻</span>}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-3">
              <div className="text-xs font-semibold text-gray-500 mb-2">
                多选题（{questions.filter(q => q.type === 'multiple').length}题）
              </div>
              <div className="grid grid-cols-10 gap-1.5">
                {questions.map((q, i) => {
                  if (q.type !== 'multiple') return null;
                  const ua = userAnswers.get(q.id) || [];
                  const isSubmitted = submitted.has(q.id);
                  const isCorrect = isSubmitted && checkAnswer(q, ua);
                  const isWrong = isSubmitted && !isCorrect;
                  const hasSelected = ua.length > 0 && !isSubmitted;
                  const isRepeated = q.id.includes('_rep_');
                  return (
                    <button key={q.id}
                      onClick={() => { setCurrentIndex(i); setShowQuestionMap(false); }}
                      className={`w-8 h-8 rounded text-xs font-semibold transition-all relative ${
                        i === currentIndex ? 'ring-2 ring-blue-500' : ''
                      } ${isRepeated ? 'bg-amber-100 text-amber-700 border border-amber-300'
                        : isCorrect ? 'bg-green-100 text-green-700 border border-green-300'
                        : isWrong ? 'bg-red-100 text-red-700 border border-red-300'
                        : hasSelected ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                      {i + 1}
                      {isRepeated && <span className="absolute -top-1 -right-1 text-[8px]">↻</span>}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-4 flex justify-between items-center">
              <span className="text-sm text-gray-500">已答 {answeredCount} / 共 {totalCount} 题</span>
              <button onClick={() => { setShowQuestionMap(false); setShowFinishConfirm(true); }}
                className="btn btn-primary text-sm py-2">
                交卷
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 交卷确认 */}
      {showFinishConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="card max-w-sm w-full text-center">
            <div className="text-4xl mb-3">📋</div>
            <h3 className="font-bold text-gray-800 text-lg mb-2">确认交卷？</h3>
            <p className="text-gray-600 text-sm mb-1">
              已完成 <span className="font-bold text-blue-600">{answeredCount}</span> 题，
              还有 <span className="font-bold text-red-500">{totalCount - answeredCount}</span> 题未作答
            </p>
            <p className="text-gray-500 text-xs mb-5">未作答题目将计为错误</p>
            <div className="flex gap-3">
              <button onClick={() => setShowFinishConfirm(false)}
                className="btn btn-secondary flex-1">继续答题</button>
              <button onClick={handleFinish}
                className="btn btn-primary flex-1">确认交卷</button>
            </div>
          </div>
        </div>
      )}

      {/* 题库不足警告 */}
      {showInsufficientWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowInsufficientWarning(false)}>
          <div className="card max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="text-5xl mb-3">⚠️</div>
              <h3 className="font-bold text-gray-800 text-lg mb-2">题库容量不足</h3>
              <p className="text-gray-600 text-sm mb-3">
                当前题库共 <span className="font-bold text-blue-600">{insufficientInfo.singles}</span> 道单选题、
                <span className="font-bold text-blue-600">{insufficientInfo.multiples}</span> 道多选题
              </p>
              <p className="text-gray-500 text-sm mb-1">
                练习要求：<span className="font-bold">单选60题 + 多选20题</span>
              </p>
              <p className="text-amber-600 text-sm">
                题目会被重复使用并在题目标记显示「↻ 重复题」，建议扩充题库
              </p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <span className="text-lg">💡</span>
                <div className="text-sm text-amber-800">
                  <p className="font-semibold mb-1">建议操作</p>
                  <ul className="list-disc list-inside space-y-1 text-amber-700">
                    <li>进入「题库管理」添加更多题目</li>
                    <li>或切换到其他题库进行练习</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => onNavigate('bank-manage')}
                className="btn btn-secondary flex-1">题库管理</button>
              <button onClick={() => setShowInsufficientWarning(false)}
                className="btn btn-primary flex-1">继续练习</button>
            </div>
          </div>
        </div>
      )}

      {/* 错题移除确认 */}
      {showRemoveWrongConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="card max-w-sm w-full text-center">
            <div className="text-4xl mb-3">🎉</div>
            <h3 className="font-bold text-gray-800 text-lg mb-2">本次答对 {correctlyAnsweredInWrongMode.length} 题</h3>
            <p className="text-gray-600 text-sm mb-4">
              这些题目之前在错题本中，是否将其从错题本中移除？
            </p>
            <div className="flex gap-3">
              <button onClick={() => handleRemoveWrongAndFinish(false)}
                className="btn btn-secondary flex-1">保留在错题本</button>
              <button onClick={() => handleRemoveWrongAndFinish(true)}
                className="btn btn-primary flex-1"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                确认移除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 标记题目列表 */}
      {showFlaggedList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="card max-w-lg w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                <span className="text-red-500">⚑</span>
                已标记 {flaggedQuestions.size} 道问题题目
              </h3>
              <button onClick={() => setShowFlaggedList(false)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>
            <p className="text-gray-600 text-sm mb-4">
              以下题目在练题过程中被标记为问题题目，稍后可在「题库管理」中查看和修改。
            </p>
            <div className="flex-1 overflow-y-auto space-y-3 mb-4 max-h-96">
              {Array.from(flaggedQuestions).map((qId, idx) => {
                const originalId = qId.includes('_rep_') ? qId.split('_rep_')[0] : qId;
                const q = questions.find(question => question.id === qId || question.id === originalId);
                if (!q) return null;
                return (
                  <div key={qId} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-start gap-2">
                      <span className="text-red-500 font-bold">{idx + 1}.</span>
                      <div className="flex-1">
                        <p className="text-sm text-gray-700 line-clamp-2">{q.question}</p>
                        <p className="text-xs text-gray-400 mt-1">答案：{q.answer.join(', ')}</p>
                      </div>
                      <button
                        onClick={() => {
                          setFlaggedQuestions(prev => {
                            const next = new Set(prev);
                            next.delete(qId);
                            return next;
                          });
                          removeFlaggedQuestion(originalId);
                        }}
                        className="text-gray-400 hover:text-red-500 text-sm"
                        title="取消标记"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3">
              <button onClick={() => {
                setShowFlaggedList(false);
                setFinished(true);
                if (session) onNavigate('result', session.id);
              }}
                className="btn btn-secondary flex-1">
                稍后处理
              </button>
              <button onClick={() => {
                setShowFlaggedList(false);
                setFinished(true);
                if (session) onNavigate('result', session.id);
              }}
                className="btn btn-primary flex-1"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                查看成绩
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== 题目卡片组件 =====
interface QuestionCardProps {
  question: Question;
  index: number;
  total: number;
  userAnswer: string[];
  isSubmitted: boolean;
  showAnalysis: boolean;
  isRepeated?: boolean; // 是否为重复抽取的题目
  isFlagged?: boolean; // 是否已标记
  onSelect: (choiceId: string) => void;
  onSubmit: () => void;
  onToggleAnalysis: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleFlag?: () => void; // 标记/取消标记
}

function QuestionCard({
  question, index, total, userAnswer, isSubmitted, showAnalysis, isRepeated, isFlagged,
  onSelect, onSubmit, onToggleAnalysis, onPrev, onNext, onToggleFlag
}: QuestionCardProps) {
  const isCorrect = isSubmitted && checkAnswer(question, userAnswer);
  const isWrong = isSubmitted && !isCorrect;

  const difficultyColor = { easy: '#10b981', medium: '#f59e0b', hard: '#ef4444' }[question.difficulty];
  const difficultyLabel = { easy: '简单', medium: '中等', hard: '困难' }[question.difficulty];

  return (
    <div className="card">
      {/* 题目头部 */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-gray-400 text-sm">第 {index + 1} 题 / 共 {total} 题</span>
        {isRepeated && (
          <span className="badge text-xs bg-amber-100 text-amber-700 border border-amber-300" title="本题为重复抽取">
            ↻ 重复题
          </span>
        )}
        <span className="badge text-xs" style={{
          background: question.type === 'single' ? '#dbeafe' : '#f3e8ff',
          color: question.type === 'single' ? '#1d4ed8' : '#5b21b6',
        }}>
          {question.type === 'single' ? '单选题' : '多选题'}
        </span>
        <span className="badge text-xs" style={{ background: `${difficultyColor}20`, color: difficultyColor }}>
          {difficultyLabel}
        </span>
        <span className="badge text-xs" style={{ background: '#f1f5f9', color: '#475569' }}>
          {question.category}
        </span>
        {/* 标记按钮 */}
        {onToggleFlag && (
          <button
            onClick={onToggleFlag}
            className={`ml-auto px-2 py-1 text-xs rounded-full border transition-all ${
              isFlagged
                ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-50'
                : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
            title="标记问题题目"
          >
            {isFlagged ? '⚑ 已标记' : '⚐ 标记'}
          </button>
        )}
        {isSubmitted && (
          <span className={`badge text-xs ${isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {isCorrect ? '✓ 正确' : '✗ 错误'}
          </span>
        )}
      </div>

      {/* 题目内容 */}
      <div className="text-gray-800 font-medium text-base leading-relaxed mb-5">
        {question.question}
        {question.image && (
          <img src={question.image} alt="题目图片" className="mt-2 max-w-full max-h-48 rounded border" />
        )}
      </div>

      {/* 选项 */}
      <div className="space-y-2.5 mb-5">
        {question.choices.map(choice => {
          const isSelected = userAnswer.includes(choice.id);
          const isAnswerChoice = question.answer.includes(choice.id);
          
          let bg = 'bg-white border-2 border-gray-200 hover:border-blue-300';
          let textColor = 'text-gray-700';
          
          if (isSubmitted) {
            if (isAnswerChoice && isSelected) {
              bg = 'bg-green-50 border-2 border-green-400';
              textColor = 'text-green-800';
            } else if (isAnswerChoice && !isSelected) {
              bg = 'bg-green-50 border-2 border-green-400';
              textColor = 'text-green-800';
            } else if (!isAnswerChoice && isSelected) {
              bg = 'bg-red-50 border-2 border-red-400';
              textColor = 'text-red-800';
            } else {
              bg = 'bg-white border-2 border-gray-200';
            }
          } else if (isSelected) {
            bg = 'bg-blue-50 border-2 border-blue-400';
            textColor = 'text-blue-800';
          }

          return (
            <button
              key={choice.id}
              onClick={() => onSelect(choice.id)}
              disabled={isSubmitted}
              className={`w-full text-left p-3.5 rounded-xl flex items-start gap-3 transition-all ${bg} ${textColor} ${!isSubmitted ? 'cursor-pointer active:scale-[0.98]' : 'cursor-default'}`}>
              <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                isSelected && !isSubmitted ? 'bg-blue-500 text-white'
                  : isSubmitted && isAnswerChoice ? 'bg-green-500 text-white'
                  : isSubmitted && isSelected && !isAnswerChoice ? 'bg-red-500 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {choice.id}
              </span>
              <div className="flex-1">
                <span className="leading-snug">{choice.text}</span>
                {choice.image && (
                  <img src={choice.image} alt={`选项${choice.id}`} className="mt-1 max-w-full max-h-32 rounded border" />
                )}
              </div>
              {isSubmitted && isAnswerChoice && (
                <span className="text-green-600 text-lg flex-shrink-0">✓</span>
              )}
              {isSubmitted && isSelected && !isAnswerChoice && (
                <span className="text-red-600 text-lg flex-shrink-0">✗</span>
              )}
            </button>
          );
        })}
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-3">
        {!isSubmitted ? (
          <button
            onClick={onSubmit}
            disabled={userAnswer.length === 0}
            className={`btn flex-1 py-2.5 text-sm font-semibold ${
              userAnswer.length > 0
                ? 'btn-primary'
                : 'opacity-40 cursor-not-allowed bg-gray-300 text-gray-500'
            }`}>
            {question.type === 'single' ? '确认答案' : `确认答案（已选${userAnswer.length}项）`}
          </button>
        ) : (
          <button
            onClick={onToggleAnalysis}
            className="btn flex-1 py-2.5 text-sm font-semibold"
            style={{ background: showAnalysis ? '#f1f5f9' : 'linear-gradient(135deg, #10b981, #059669)', color: showAnalysis ? '#475569' : 'white' }}>
            {showAnalysis ? '收起解析' : '查看解析'}
          </button>
        )}
        <button onClick={onPrev} disabled={index === 0}
          className="btn btn-secondary py-2.5 px-4 text-sm disabled:opacity-40">
          上一题
        </button>
        <button onClick={onNext} disabled={index === total - 1}
          className="btn btn-primary py-2.5 px-4 text-sm disabled:opacity-40">
          下一题
        </button>
      </div>

      {/* 答案解析 */}
      {showAnalysis && isSubmitted && (
        <div className="mt-4 rounded-xl overflow-hidden" style={{ border: '1px solid #e2e8f0' }}>
          <div className="px-4 py-3" style={{ background: '#f8fafc' }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">📖</span>
              <span className="font-semibold text-gray-700">答案解析</span>
              <span className="badge text-xs" style={{ background: '#dcfce7', color: '#166534' }}>
                正确答案：{question.answer.join('、')}
              </span>
            </div>
            <p className="text-gray-600 text-sm leading-relaxed">{question.explanation}</p>
          </div>
          <div className="px-4 py-3 border-t" style={{ borderColor: '#e2e8f0', background: '#fffbeb' }}>
            <div className="flex items-start gap-2">
              <span className="text-lg flex-shrink-0">💡</span>
              <div>
                <span className="font-semibold text-amber-800 text-sm block mb-1">知识点</span>
                <p className="text-amber-700 text-sm leading-relaxed">{question.knowledge}</p>
              </div>
            </div>
          </div>
          {question.tags.length > 0 && (
            <div className="px-4 py-2 border-t flex flex-wrap gap-2" style={{ borderColor: '#e2e8f0' }}>
              {question.tags.map(tag => (
                <span key={tag} className="badge text-xs" style={{ background: '#eff6ff', color: '#1d4ed8' }}>#{tag}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
