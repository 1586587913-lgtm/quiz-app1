import { useState, useEffect } from 'react';
import type { Question, User, AppPage } from '../types';
import { getBanks, getMasteredQuestions, addMasteredQuestion, removeMasteredQuestion, isMastered } from '../utils/storage';
import { allQuestions } from '../data/questions';

interface ReviewModeProps {
  user: User;
  onNavigate: (page: AppPage) => void;
  bankId?: string; // 指定题库ID
}

export default function ReviewMode({ user, onNavigate, bankId }: ReviewModeProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [filter, setFilter] = useState<'all' | 'single' | 'multiple'>('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [showMastered, setShowMastered] = useState(false); // 显示已掌握列表
  const [masteredIds, setMasteredIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const banks = getBanks(user.username);
    let allQuestionsPool: Question[] = [];
    
    // 处理内置题库选择
    if (bankId === 'builtin_all') {
      // 全部题库：用户题库 + 内置题库
      const bankQuestions = banks.reduce<Question[]>((acc, b) => [...acc, ...(b.questions || [])], []);
      allQuestionsPool = [...bankQuestions, ...allQuestions];
    } else if (bankId === 'builtin_electrical') {
      // 电工基础题库
      allQuestionsPool = allQuestions.filter(q => 
        q.category === '电路基础' || q.category === '电工安全规程'
      );
    } else if (bankId === 'builtin_metering') {
      // 二级计量工程师题库
      allQuestionsPool = allQuestions.filter(q => q.category === '二级计量工程师');
    } else if (bankId === 'default') {
      // 全部题库：动态合并所有非"全部题库"的题库题目
      const bankQuestions = banks
        .filter(b => b.id !== 'default')
        .reduce<Question[]>((acc, b) => [...acc, ...(b.questions || [])], []);
      allQuestionsPool = bankQuestions;
    } else if (bankId) {
      // 使用指定用户题库
      const selectedBank = banks.find(b => b.id === bankId);
      allQuestionsPool = selectedBank ? (selectedBank.questions || []) : [];
    } else {
      // 没有指定题库：合并所有非"全部题库"的题库题目
      allQuestionsPool = banks
        .filter(b => b.id !== 'default')
        .reduce<Question[]>((acc, b) => [...acc, ...(b.questions || [])], []);
    }
    
    // 去重
    const seen = new Set<string>();
    const unique = allQuestionsPool.filter(q => {
      if (seen.has(q.id)) return false;
      seen.add(q.id);
      return true;
    });
    
    setQuestions(unique);
    const cats = [...new Set(unique.map(q => q.category))];
    setCategories(cats);
    
    // 加载已掌握题目
    const mastered = getMasteredQuestions();
    setMasteredIds(new Set(mastered.map(m => m.questionId)));
  }, [bankId]);

  const filtered = questions.filter(q => {
    // 已掌握列表筛选
    if (showMastered && !masteredIds.has(q.id)) return false;
    if (!showMastered && masteredIds.has(q.id)) return false;
    
    if (filter !== 'all' && q.type !== filter) return false;
    if (filterCategory !== 'all' && q.category !== filterCategory) return false;
    if (searchText && !q.question.toLowerCase().includes(searchText.toLowerCase()) &&
        !q.tags.some(t => t.includes(searchText))) return false;
    return true;
  });

  const currentQ = filtered[currentIndex];

  const goTo = (idx: number) => {
    setCurrentIndex(Math.max(0, Math.min(filtered.length - 1, idx)));
    setShowAnswer(false);
  };

  const toggleMastered = (qId: string) => {
    if (masteredIds.has(qId)) {
      removeMasteredQuestion(qId);
      setMasteredIds(prev => {
        const next = new Set(prev);
        next.delete(qId);
        return next;
      });
    } else {
      addMasteredQuestion(qId);
      setMasteredIds(prev => new Set([...prev, qId]));
    }
  };

  if (filtered.length === 0) {
    return (
      <div className="min-h-screen" style={{ background: '#f0f4f8' }}>
        <Header onBack={() => onNavigate('home')} />
        <div className="max-w-3xl mx-auto px-4 py-8 text-center">
          <div className="card py-16">
            <div className="text-5xl mb-4">📭</div>
            <div className="text-gray-500">没有找到符合条件的题目</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#f0f4f8' }}>
      <Header onBack={() => onNavigate('home')} />

      <div className="max-w-3xl mx-auto px-4 py-4">
        {/* 筛选工具栏 */}
        <div className="card mb-4 py-3">
          <div className="flex flex-wrap gap-2 items-center">
            {/* 已掌握切换 */}
            <button
              onClick={() => { setShowMastered(!showMastered); setCurrentIndex(0); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                showMastered 
                  ? 'bg-green-100 text-green-700 border border-green-300' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill={showMastered ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
              </svg>
              已掌握 ({masteredIds.size})
            </button>

            {/* 题型 */}
            <div className="flex gap-1 rounded-lg overflow-hidden bg-gray-100 p-0.5">
              {([['all', '全部'], ['single', '单选'], ['multiple', '多选']] as const).map(([v, l]) => (
                <button key={v} onClick={() => { setFilter(v); setCurrentIndex(0); }}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-all ${filter === v ? 'bg-white text-blue-600 shadow' : 'text-gray-500'}`}>
                  {l}
                </button>
              ))}
            </div>

            {/* 分类 */}
            <select
              value={filterCategory}
              onChange={e => { setFilterCategory(e.target.value); setCurrentIndex(0); }}
              className="input text-sm py-1 px-2 w-auto"
              style={{ height: 'auto' }}>
              <option value="all">全部分类</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            {/* 搜索 */}
            <input
              className="input text-sm py-1 flex-1 min-w-32"
              placeholder="搜索题目..."
              value={searchText}
              onChange={e => { setSearchText(e.target.value); setCurrentIndex(0); }}
            />

            <span className="text-gray-400 text-sm">共 {filtered.length} 题</span>
          </div>
        </div>

        {/* 题目卡片 */}
        {currentQ && (
          <div className="card">
            {/* 题头 */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-gray-400 text-sm">第 {currentIndex + 1} / {filtered.length} 题</span>
              <span className="badge text-xs" style={{
                background: currentQ.type === 'single' ? '#dbeafe' : '#f3e8ff',
                color: currentQ.type === 'single' ? '#1d4ed8' : '#5b21b6',
              }}>
                {currentQ.type === 'single' ? '单选题' : '多选题'}
              </span>
              <span className="badge text-xs" style={{ background: '#f1f5f9', color: '#475569' }}>
                {currentQ.category}
              </span>
              {currentQ.isExtended && (
                <span className="badge text-xs" style={{ background: '#fef3c7', color: '#92400e' }}>扩展题</span>
              )}
            </div>

            {/* 题目 */}
            <div className="text-gray-800 font-medium text-base leading-relaxed mb-5">
              {currentQ.question}
              {currentQ.image && (
                <img src={currentQ.image} alt="题目图片" className="mt-2 max-w-full max-h-48 rounded border" />
              )}
            </div>

            {/* 选项 */}
            <div className="space-y-2.5 mb-5">
              {currentQ.choices.map(choice => {
                const isAnswer = currentQ.answer.includes(choice.id);
                return (
                  <div key={choice.id}
                    className={`p-3.5 rounded-xl flex items-start gap-3 ${
                      showAnswer && isAnswer
                        ? 'border-2 border-green-400 bg-green-50'
                        : 'border-2 border-gray-200 bg-gray-50'
                    }`}>
                    <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                      showAnswer && isAnswer ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {choice.id}
                    </span>
                    <div className="flex-1">
                      <span className={`leading-snug ${showAnswer && isAnswer ? 'text-green-800 font-medium' : 'text-gray-700'}`}>
                        {choice.text}
                      </span>
                      {choice.image && (
                        <img src={choice.image} alt={`选项${choice.id}`} className="mt-1 max-w-full max-h-32 rounded border" />
                      )}
                    </div>
                    {showAnswer && isAnswer && <span className="text-green-500 text-xl flex-shrink-0">✓</span>}
                  </div>
                );
              })}
            </div>

            {/* 操作 */}
            <div className="flex gap-2 mb-4">
              <button onClick={() => setShowAnswer(!showAnswer)}
                className={`btn flex-1 py-2.5 text-sm ${showAnswer ? 'btn-secondary' : 'btn-primary'}`}
                style={!showAnswer ? { background: 'linear-gradient(135deg, #10b981, #059669)' } : {}}>
                {showAnswer ? '隐藏答案' : '显示答案与解析'}
              </button>
              <button onClick={() => toggleMastered(currentQ.id)}
                className={`btn py-2.5 px-4 text-sm flex items-center gap-1.5 ${
                  masteredIds.has(currentQ.id) 
                    ? 'bg-green-100 text-green-700 border border-green-300 hover:bg-green-50' 
                    : 'btn-secondary'
                }`}>
                <svg width="16" height="16" viewBox="0 0 20 20" fill={masteredIds.has(currentQ.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                  <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
                </svg>
                {masteredIds.has(currentQ.id) ? '已掌握' : '标记掌握'}
              </button>
            </div>

            {/* 解析 */}
            {showAnswer && (
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e2e8f0' }}>
                <div className="px-4 py-3" style={{ background: '#f8fafc' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">📖</span>
                    <span className="font-semibold text-gray-700">答案解析</span>
                    <span className="badge text-xs" style={{ background: '#dcfce7', color: '#166534' }}>
                      正确答案：{currentQ.answer.join('、')}
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed">{currentQ.explanation}</p>
                </div>
                <div className="px-4 py-3 border-t" style={{ borderColor: '#e2e8f0', background: '#fffbeb' }}>
                  <div className="flex items-start gap-2">
                    <span className="text-lg flex-shrink-0">💡</span>
                    <div>
                      <span className="font-semibold text-amber-800 text-sm block mb-1">知识点</span>
                      <p className="text-amber-700 text-sm leading-relaxed">{currentQ.knowledge}</p>
                    </div>
                  </div>
                </div>
                {currentQ.tags.length > 0 && (
                  <div className="px-4 py-2 border-t flex flex-wrap gap-2" style={{ borderColor: '#e2e8f0' }}>
                    {currentQ.tags.map(tag => (
                      <span key={tag} className="badge text-xs" style={{ background: '#eff6ff', color: '#1d4ed8' }}>#{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 翻页 */}
            <div className="flex justify-between mt-4">
              <button onClick={() => goTo(currentIndex - 1)} disabled={currentIndex === 0}
                className="btn btn-secondary py-2 px-5 disabled:opacity-40">← 上一题</button>
              <div className="flex items-center gap-1">
                {filtered.slice(Math.max(0, currentIndex - 2), Math.min(filtered.length, currentIndex + 3)).map((_, relIdx) => {
                  const absIdx = Math.max(0, currentIndex - 2) + relIdx;
                  return (
                    <button key={absIdx} onClick={() => goTo(absIdx)}
                      className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${absIdx === currentIndex ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                      {absIdx + 1}
                    </button>
                  );
                })}
              </div>
              <button onClick={() => goTo(currentIndex + 1)} disabled={currentIndex === filtered.length - 1}
                className="btn btn-primary py-2 px-5 disabled:opacity-40">下一题 →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <header className="sticky top-0 z-30 shadow-sm"
      style={{ background: 'linear-gradient(90deg, #5b21b6, #4c1d95)' }}>
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
        <button onClick={onBack} className="text-white flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10 text-sm">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 12L6 8L10 4"/>
          </svg>
          返回
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.15)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
          </div>
          <span className="text-white font-bold">背题模式</span>
        </div>
      </div>
    </header>
  );
}

