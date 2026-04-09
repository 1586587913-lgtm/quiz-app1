import { useState, useEffect } from 'react';
import type { User, AppPage } from '../types';
import type { Question } from '../types';
import { getStats, removeWrongQuestion, removeWrongQuestions, clearAllWrongQuestions } from '../utils/storage';
import { getBanks } from '../utils/storage';
import { allQuestions } from '../data/questions';

interface WrongListPageProps {
  user: User;
  onNavigate: (page: AppPage) => void;
  onPracticeWrong: (questions: Question[]) => void;
}

export default function WrongListPage({ user, onNavigate, onPracticeWrong }: WrongListPageProps) {
  const [wrongQs, setWrongQs] = useState<Array<{ q: Question; wrongCount: number; lastWrongAt: number }>>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const loadWrongQuestions = () => {
    const stats = getStats(user.id);
    const banks = getBanks(user.id);
    const bankQuestions = banks.reduce<Question[]>((acc, b) => [...acc, ...b.questions], []);
    const merged = [...bankQuestions, ...allQuestions];
    const seen = new Set<string>();
    const allQ = merged.filter(q => {
      if (seen.has(q.id)) return false;
      seen.add(q.id);
      return true;
    });

    const list = stats.wrongQuestions
      .map(w => {
        const q = allQ.find(q => q.id === w.questionId);
        if (!q) return null;
        return { q, wrongCount: w.wrongCount, lastWrongAt: w.lastWrongAt };
      })
      .filter(Boolean) as Array<{ q: Question; wrongCount: number; lastWrongAt: number }>;

    list.sort((a, b) => b.wrongCount - a.wrongCount);
    setWrongQs(list);
    setSelected(new Set(list.map(item => item.q.id)));
  };

  useEffect(() => {
    loadWrongQuestions();
  }, [user.id]);

  // 删除单个错题
  const handleDeleteOne = (questionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('确定要从错题本中删除这道题吗？')) {
      removeWrongQuestion(user.id, questionId);
      // 删除后返回首页刷新数据
      onNavigate('home');
    }
  };

  // 批量删除选中的错题
  const handleDeleteSelected = () => {
    if (selected.size === 0) return;
    if (confirm(`确定要删除选中的 ${selected.size} 道错题吗？`)) {
      removeWrongQuestions(user.id, Array.from(selected));
      // 删除后返回首页刷新数据
      onNavigate('home');
    }
  };

  // 清空全部错题
  const handleClearAll = () => {
    if (confirm('确定要清空全部错题吗？此操作不可恢复！')) {
      clearAllWrongQuestions(user.id);
      onNavigate('home');
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedQs = wrongQs.filter(item => selected.has(item.q.id)).map(item => item.q);

  if (wrongQs.length === 0) {
    return (
      <div className="min-h-screen" style={{ background: '#f0f4f8' }}>
        <header className="shadow-sm" style={{ background: 'linear-gradient(90deg, #dc2626, #b91c1c)' }}>
          <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
            <button onClick={() => onNavigate('home')} className="text-white text-sm flex items-center gap-1">
              ← 返回
            </button>
            <span className="text-white font-bold">错题本</span>
          </div>
        </header>
        <div className="max-w-3xl mx-auto px-4 py-12 text-center">
          <div className="card py-16">
            <div className="text-6xl mb-4">🎉</div>
            <div className="text-gray-700 text-xl font-bold mb-2">错题本是空的！</div>
            <div className="text-gray-500">继续保持，你已经全部掌握了</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#f0f4f8' }}>
      <header className="sticky top-0 z-30 shadow-sm" style={{ background: 'linear-gradient(90deg, #dc2626, #7c3aed)' }}>
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => onNavigate('home')} className="text-white text-sm flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10">
              ← 返回
            </button>
            <span className="text-white font-bold">错题本</span>
            <span className="badge text-xs" style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>
              {wrongQs.length}题
            </span>
          </div>
          <button
            onClick={() => selectedQs.length > 0 && onPracticeWrong(selectedQs)}
            disabled={selectedQs.length === 0}
            className="btn py-2 px-4 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: '#f59e0b' }}>
            开始专练（{selected.size}题）
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-4">
        {/* 全选/批量删除 */}
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => setSelected(new Set(wrongQs.map(i => i.q.id)))}
            className="text-blue-500 text-sm hover:text-blue-700">全选</button>
          <button onClick={() => setSelected(new Set())}
            className="text-gray-500 text-sm hover:text-gray-700">全不选</button>
          <span className="text-gray-400 text-sm">已选 {selected.size}/{wrongQs.length} 题</span>
          {selected.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              className="text-red-500 text-sm hover:text-red-700 flex items-center gap-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z"/>
              </svg>
              删除选中
            </button>
          )}
          <button
            onClick={handleClearAll}
            className="ml-auto text-red-600 text-sm hover:text-red-800 font-medium">
            清空全部
          </button>
        </div>

        <div className="space-y-3">
          {wrongQs.map(({ q, wrongCount, lastWrongAt }) => (
            <div key={q.id}
              className={`card cursor-pointer transition-all ${selected.has(q.id) ? 'ring-2 ring-red-400' : ''}`}
              onClick={() => toggleSelect(q.id)}>
              <div className="flex items-start gap-3">
                {/* 复选框 */}
                <div className={`flex-shrink-0 w-5 h-5 rounded mt-0.5 border-2 flex items-center justify-center transition-all ${
                  selected.has(q.id) ? 'bg-red-500 border-red-500' : 'border-gray-300'}`}>
                  {selected.has(q.id) && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="badge text-xs" style={{
                      background: q.type === 'single' ? '#dbeafe' : '#f3e8ff',
                      color: q.type === 'single' ? '#1d4ed8' : '#5b21b6',
                    }}>
                      {q.type === 'single' ? '单选' : '多选'}
                    </span>
                    <span className="text-gray-500 text-xs">{q.category}</span>
                    <span className="badge text-xs" style={{ background: '#fee2e2', color: '#991b1b' }}>
                      错误 {wrongCount} 次
                    </span>
                    <span className="text-gray-400 text-xs">
                      {new Date(lastWrongAt).toLocaleDateString()}
                    </span>
                    <button
                      onClick={(e) => handleDeleteOne(q.id, e)}
                      className="ml-auto text-gray-400 hover:text-red-500 p-1"
                      title="从错题本删除">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z"/>
                      </svg>
                    </button>
                  </div>
                  <p className="text-gray-700 text-sm leading-relaxed line-clamp-2">{q.question}</p>
                  <p className="text-green-600 text-xs mt-1">正确答案：{q.answer.join('、')}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="pb-8"/>
      </div>
    </div>
  );
}
