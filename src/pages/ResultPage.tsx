import { useState, useEffect } from 'react';
import type { ExamSession, User, AppPage } from '../types';
import { getSession } from '../utils/storage';
import { allQuestions } from '../data/questions';
import { getBanks } from '../utils/storage';
import type { Question } from '../types';

interface ResultPageProps {
  user: User;
  sessionId: string;
  onNavigate: (page: AppPage) => void;
  onPracticeWrong: (questions: Question[]) => void;
}

export default function ResultPage({ user, sessionId, onNavigate, onPracticeWrong }: ResultPageProps) {
  const [session, setSession] = useState<ExamSession | null>(null);
  const [allQ, setAllQ] = useState<Question[]>([]);
  const [showWrongList, setShowWrongList] = useState(false);

  useEffect(() => {
    const sess = getSession(sessionId);
    setSession(sess);
    const banks = getBanks(user.username);
    const bankQuestions = banks.reduce<Question[]>((acc, b) => [...acc, ...(b.questions || [])], []);
    const merged = [...bankQuestions, ...allQuestions];
    const seen = new Set<string>();
    const unique = merged.filter(q => {
      if (seen.has(q.id)) return false;
      seen.add(q.id);
      return true;
    });
    setAllQ(unique);
  }, [sessionId]);

  if (!session) return null;

  const score = session.score || 0;
  const totalAnswered = session.answers.length;
  const correctCount = session.answers.filter(a => a.isCorrect).length;
  const wrongCount = totalAnswered - correctCount;
  const duration = session.endTime ? Math.round((session.endTime - session.startTime) / 1000) : 0;
  const durationStr = `${Math.floor(duration / 60)}分${duration % 60}秒`;

  const wrongAnswers = session.answers.filter(a => !a.isCorrect);
  const wrongQs = wrongAnswers.map(a => allQ.find(q => q.id === a.questionId)).filter(Boolean) as Question[];

  const scoreColor = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
  const scoreLabel = score >= 90 ? '优秀 🏆' : score >= 80 ? '良好 🌟' : score >= 60 ? '及格 📗' : '不及格 📕';

  const singleAnswers = session.answers.filter(a => {
    const q = allQ.find(q => q.id === a.questionId);
    return q?.type === 'single';
  });
  const multiAnswers = session.answers.filter(a => {
    const q = allQ.find(q => q.id === a.questionId);
    return q?.type === 'multiple';
  });
  const singleCorrect = singleAnswers.filter(a => a.isCorrect).length;
  const multiCorrect = multiAnswers.filter(a => a.isCorrect).length;

  return (
    <div className="min-h-screen" style={{ background: '#f0f4f8' }}>
      {/* 顶部 */}
      <header className="shadow-sm" style={{ background: 'linear-gradient(90deg, #1e3a8a, #4c1d95)' }}>
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center">
          <span className="text-white font-bold text-lg">答题结果</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* 分数卡片 */}
        <div className="card text-center py-8" style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #4c1d95 100%)' }}>
          <div className="text-white/70 text-sm mb-2">综合得分</div>
          <div className="text-7xl font-black mb-2" style={{ color: score >= 60 ? '#fbbf24' : '#f87171' }}>
            {score}
          </div>
          <div className="text-white/80 text-lg font-semibold mb-4">{scoreLabel}</div>
          <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
            <div className="text-center">
              <div className="text-white font-bold text-xl">{totalAnswered}</div>
              <div className="text-white/60 text-xs">总题数</div>
            </div>
            <div className="text-center">
              <div className="text-green-300 font-bold text-xl">{correctCount}</div>
              <div className="text-white/60 text-xs">答对</div>
            </div>
            <div className="text-center">
              <div className="text-red-300 font-bold text-xl">{wrongCount}</div>
              <div className="text-white/60 text-xs">答错</div>
            </div>
          </div>
        </div>

        {/* 详细统计 */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="card">
            <h3 className="font-bold text-gray-700 mb-3 text-sm">📊 答题分析</h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">单选题</span>
                  <span className="font-medium">{singleCorrect}/{singleAnswers.length}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-blue-500 transition-all"
                    style={{ width: `${singleAnswers.length > 0 ? (singleCorrect / singleAnswers.length) * 100 : 0}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">多选题</span>
                  <span className="font-medium">{multiCorrect}/{multiAnswers.length}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-purple-500 transition-all"
                    style={{ width: `${multiAnswers.length > 0 ? (multiCorrect / multiAnswers.length) * 100 : 0}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">正确率</span>
                  <span className="font-medium" style={{ color: scoreColor }}>
                    {totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-100">
                  <div className="h-full rounded-full transition-all"
                    style={{
                      width: `${totalAnswered > 0 ? (correctCount / totalAnswered) * 100 : 0}%`,
                      background: scoreColor,
                    }} />
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="font-bold text-gray-700 mb-3 text-sm">⏱ 答题详情</h3>
            <div className="space-y-2">
              {[
                { label: '答题用时', value: durationStr },
                { label: '平均每题', value: `${totalAnswered > 0 ? Math.round(duration / totalAnswered) : 0}秒` },
                { label: '答题模式', value: session.mode === 'wrong' ? '错题专练' : '随机练题' },
                { label: '错题数量', value: `${wrongCount}题` },
              ].map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-500">{item.label}</span>
                  <span className="font-medium text-gray-700">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 错题预览 */}
        {wrongCount > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-700">❌ 错题列表（{wrongCount}题）</h3>
              <button onClick={() => setShowWrongList(!showWrongList)}
                className="text-blue-500 text-sm hover:text-blue-700">
                {showWrongList ? '收起' : '展开查看'}
              </button>
            </div>

            {showWrongList && (
              <div className="space-y-3">
                {wrongAnswers.map((ans, i) => {
                  const q = allQ.find(q => q.id === ans.questionId);
                  if (!q) return null;
                  return (
                    <div key={i} className="p-3 rounded-xl" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="badge text-xs" style={{ background: '#fee2e2', color: '#991b1b' }}>
                          第{i + 1}题
                        </span>
                        <span className="text-gray-500 text-xs">{q.category}</span>
                      </div>
                      <p className="text-gray-700 text-sm mb-2">{q.question}</p>
                      <div className="flex gap-4 text-xs">
                        <span className="text-red-600">你的答案：{ans.userAnswer.join('、') || '未答'}</span>
                        <span className="text-green-600">正确答案：{q.answer.join('、')}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="grid sm:grid-cols-3 gap-3">
          <button onClick={() => onNavigate('home')}
            className="btn btn-secondary py-3 text-sm">
            返回主页
          </button>
          {wrongCount > 0 && (
            <button onClick={() => onPracticeWrong(wrongQs)}
              className="btn py-3 text-sm text-white"
              style={{ background: '#ef4444' }}>
              专项练错题 ({wrongCount}题)
            </button>
          )}
          <button onClick={() => onNavigate('practice')}
            className="btn btn-primary py-3 text-sm">
            再来一套
          </button>
        </div>
      </div>
    </div>
  );
}

