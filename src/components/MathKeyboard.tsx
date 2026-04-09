import { useState, useRef, useEffect } from 'react';

interface Choice {
  id: string;
  text: string;
  image?: string;
}

interface Question {
  question: string;
  image?: string;
  choices: Choice[];
}

interface MathKeyboardProps {
  question: Question;
  onQuestionChange: (question: Question) => void;
  onClose: () => void;
}

const symbolCategories = [
  {
    name: '基础运算',
    symbols: [
      { label: '+', insert: '+' },
      { label: '−', insert: '−' },
      { label: '×', insert: '×' },
      { label: '÷', insert: '÷' },
      { label: '±', insert: '±' },
      { label: '=', insert: '=' },
      { label: '≠', insert: '≠' },
      { label: '≈', insert: '≈' },
      { label: '≡', insert: '≡' },
    ]
  },
  {
    name: '比较符号',
    symbols: [
      { label: '<', insert: '<' },
      { label: '>', insert: '>' },
      { label: '≤', insert: '≤' },
      { label: '≥', insert: '≥' },
      { label: '∝', insert: '∝' },
      { label: '≈', insert: '≈' },
    ]
  },
  {
    name: '集合符号',
    symbols: [
      { label: '∈', insert: '∈' },
      { label: '∉', insert: '∉' },
      { label: '⊂', insert: '⊂' },
      { label: '⊃', insert: '⊃' },
      { label: '∪', insert: '∪' },
      { label: '∩', insert: '∩' },
      { label: '∅', insert: '∅' },
    ]
  },
  {
    name: '逻辑符号',
    symbols: [
      { label: '∧', insert: '∧' },
      { label: '∨', insert: '∨' },
      { label: '¬', insert: '¬' },
      { label: '∀', insert: '∀' },
      { label: '∃', insert: '∃' },
      { label: '⇒', insert: '⇒' },
      { label: '⇔', insert: '⇔' },
      { label: '→', insert: '→' },
    ]
  },
  {
    name: '希腊字母',
    symbols: [
      { label: 'α', insert: 'α' },
      { label: 'β', insert: 'β' },
      { label: 'γ', insert: 'γ' },
      { label: 'δ', insert: 'δ' },
      { label: 'θ', insert: 'θ' },
      { label: 'λ', insert: 'λ' },
      { label: 'μ', insert: 'μ' },
      { label: 'π', insert: 'π' },
      { label: 'σ', insert: 'σ' },
      { label: 'φ', insert: 'φ' },
      { label: 'ω', insert: 'ω' },
      { label: 'Ω', insert: 'Ω' },
      { label: 'Δ', insert: 'Δ' },
      { label: 'Σ', insert: 'Σ' },
    ]
  },
  {
    name: '上下标',
    symbols: [
      { label: 'x²', insert: '²' },
      { label: 'x³', insert: '³' },
      { label: 'xⁿ', insert: 'ⁿ' },
      { label: 'x⁻¹', insert: '⁻¹' },
      { label: 'x₀', insert: '₀' },
      { label: 'x₁', insert: '₁' },
      { label: '∑', insert: '∑' },
      { label: '∏', insert: '∏' },
    ]
  },
  {
    name: '函数符号',
    symbols: [
      { label: '√', insert: '√' },
      { label: '∛', insert: '∛' },
      { label: '∜', insert: '∜' },
      { label: '∫', insert: '∫' },
      { label: '∂', insert: '∂' },
      { label: '∇', insert: '∇' },
      { label: '∞', insert: '∞' },
      { label: '%', insert: '%' },
    ]
  },
  {
    name: '其他',
    symbols: [
      { label: '°', insert: '°' },
      { label: '∠', insert: '∠' },
      { label: '△', insert: '△' },
      { label: '○', insert: '○' },
      { label: '□', insert: '□' },
      { label: '…', insert: '…' },
      { label: '•', insert: '•' },
    ]
  },
];

export default function MathKeyboard({ question, onQuestionChange, onClose }: MathKeyboardProps) {
  const [activeTab, setActiveTab] = useState('基础运算');
  const [activeTarget, setActiveTarget] = useState<'question' | 'choice_0' | 'choice_1' | 'choice_2' | 'choice_3'>('question');
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [recentSymbols, setRecentSymbols] = useState<string[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 加载常用符号
  useEffect(() => {
    const saved = localStorage.getItem('mathKeyboard_recent');
    if (saved) {
      setRecentSymbols(JSON.parse(saved));
    }
  }, []);

  // 保存常用符号
  const addToRecent = (symbol: string) => {
    const updated = [symbol, ...recentSymbols.filter(s => s !== symbol)].slice(0, 10);
    setRecentSymbols(updated);
    localStorage.setItem('mathKeyboard_recent', JSON.stringify(updated));
  };

  // 插入符号到当前目标
  const handleInsertSymbol = (symbol: string) => {
    addToRecent(symbol);
    
    if (activeTarget === 'question') {
      onQuestionChange({ ...question, question: question.question + symbol });
    } else if (activeTarget.startsWith('choice_')) {
      const idx = parseInt(activeTarget.replace('choice_', ''));
      const newChoices = [...question.choices];
      if (newChoices[idx]) {
        newChoices[idx] = { ...newChoices[idx], text: newChoices[idx].text + symbol };
        onQuestionChange({ ...question, choices: newChoices });
      }
    }
  };

  // 处理图片上传
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      
      if (activeTarget === 'question') {
        onQuestionChange({ ...question, image: dataUrl });
      } else if (activeTarget.startsWith('choice_')) {
        const idx = parseInt(activeTarget.replace('choice_', ''));
        const newChoices = [...question.choices];
        if (newChoices[idx]) {
          newChoices[idx] = { ...newChoices[idx], image: dataUrl };
          onQuestionChange({ ...question, choices: newChoices });
        }
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // 拖拽相关
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.no-drag')) return;
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: Math.max(0, e.clientX - dragOffset.x),
          y: Math.max(0, e.clientY - dragOffset.y)
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const updateQuestionText = (text: string) => {
    onQuestionChange({ ...question, question: text });
  };

  const updateChoiceText = (idx: number, text: string) => {
    const newChoices = [...question.choices];
    newChoices[idx] = { ...newChoices[idx], text };
    onQuestionChange({ ...question, choices: newChoices });
  };

  const removeChoiceImage = (idx: number) => {
    const newChoices = [...question.choices];
    newChoices[idx] = { ...newChoices[idx], image: undefined };
    onQuestionChange({ ...question, choices: newChoices });
  };

  return (
    <div
      ref={panelRef}
      className="fixed bg-white rounded-lg shadow-2xl border border-gray-200 z-[1000] overflow-hidden"
      style={{
        left: position.x,
        top: position.y,
        width: '480px',
        maxHeight: 'calc(100vh - 60px)',
        cursor: isDragging ? 'grabbing' : 'default'
      }}
    >
      {/* 可拖拽标题栏 */}
      <div
        className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white cursor-grab"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">📐</span>
          <span className="font-medium">数学编辑器</span>
        </div>
        <button
          onClick={onClose}
          className="no-drag w-7 h-7 flex items-center justify-center rounded-full hover:bg-blue-400 transition-colors text-lg"
        >
          ×
        </button>
      </div>

      {/* 内容区域 */}
      <div className="flex" style={{ maxHeight: 'calc(100vh - 120px)' }}>
        {/* 左侧编辑区 */}
        <div className="flex-1 p-3 overflow-y-auto border-r" style={{ maxHeight: 'calc(100vh - 120px)' }}>
          <div className="space-y-3">
            {/* 题目内容 */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">题目内容</label>
              <textarea
                className={`w-full p-2 border rounded text-sm ${activeTarget === 'question' ? 'border-blue-500 ring-1 ring-blue-300' : 'border-gray-200'}`}
                rows={3}
                value={question.question}
                onChange={e => updateQuestionText(e.target.value)}
                onFocus={() => setActiveTarget('question')}
                placeholder="输入题目内容..."
              />
              {question.image && (
                <div className="mt-1 relative inline-block">
                  <img src={question.image} alt="题目图片" className="h-16 rounded border" />
                  <button
                    onClick={() => onQuestionChange({ ...question, image: undefined })}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>

            {/* 选项 */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">选项</label>
              <div className="space-y-2">
                {question.choices.map((choice, idx) => (
                  <div key={idx} className="relative flex items-start gap-2">
                    <span className="no-drag w-6 h-10 flex items-center justify-center bg-gray-100 rounded text-xs font-medium flex-shrink-0">
                      {choice.id}
                    </span>
                    <div 
                      className={`flex-1 flex items-start gap-1 p-1.5 border rounded ${activeTarget === `choice_${idx}` ? 'border-blue-500 ring-1 ring-blue-300' : 'border-gray-200'}`}
                      onClick={() => setActiveTarget(`choice_${idx}` as any)}
                    >
                      <textarea
                        className="flex-1 bg-transparent border-none focus:outline-none resize-none text-sm"
                        rows={2}
                        value={choice.text}
                        onChange={e => updateChoiceText(idx, e.target.value)}
                        onFocus={() => setActiveTarget(`choice_${idx}` as any)}
                        placeholder={`选项 ${choice.id}...`}
                        style={{ paddingRight: choice.image ? '60px' : '0' }}
                      />
                      {choice.image && (
                        <div className="relative flex-shrink-0">
                          <img src={choice.image} alt={`选项${choice.id}`} className="h-10 rounded border" />
                          <button
                            onClick={(e) => { e.stopPropagation(); removeChoiceImage(idx); }}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 右侧符号区 */}
        <div className="w-56 flex flex-col" style={{ maxHeight: 'calc(100vh - 120px)' }}>
          {/* 常用符号 */}
          {recentSymbols.length > 0 && (
            <div className="px-2 py-1.5 border-b bg-yellow-50 flex-shrink-0">
              <div className="text-xs text-gray-500 mb-1">常用</div>
              <div className="flex flex-wrap gap-1">
                {recentSymbols.slice(0, 8).map((sym, i) => (
                  <button
                    key={i}
                    onClick={() => handleInsertSymbol(sym)}
                    className="no-drag px-1.5 py-0.5 bg-white border border-yellow-300 rounded hover:bg-yellow-100 text-sm font-mono"
                  >
                    {sym}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tab切换 */}
          <div className="no-drag flex border-b flex-shrink-0 overflow-x-auto">
            <button
              onClick={() => { setActiveTab('图片'); }}
              className={`px-2 py-1.5 text-xs whitespace-nowrap border-b-2 ${
                activeTab === '图片' ? 'border-green-500 text-green-600 font-medium' : 'border-transparent text-gray-600'
              }`}
            >
              🖼️
            </button>
            {symbolCategories.map(cat => (
              <button
                key={cat.name}
                onClick={() => setActiveTab(cat.name)}
                className={`px-2 py-1.5 text-xs whitespace-nowrap border-b-2 ${
                  activeTab === cat.name ? 'border-blue-500 text-blue-600 font-medium' : 'border-transparent text-gray-600'
                }`}
              >
                {cat.name.length > 4 ? cat.name.substring(0, 4) + '..' : cat.name}
              </button>
            ))}
          </div>

          {/* 符号网格或图片上传 */}
          <div className="flex-1 overflow-y-auto p-2">
            {activeTab === '图片' ? (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="math-keyboard-image-upload"
                />
                <label
                  htmlFor="math-keyboard-image-upload"
                  className="no-drag flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg py-6 px-4 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                >
                  <div className="text-3xl mb-2">📷</div>
                  <div className="text-xs text-gray-600 text-center">
                    点击上传图片<br />
                    <span className="text-gray-400">插入到 {activeTarget === 'question' ? '题目' : `选项${activeTarget.replace('choice_', '')}`}</span>
                  </div>
                </label>
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-1">
                {symbolCategories.find(c => c.name === activeTab)?.symbols.map((sym, i) => (
                  <button
                    key={i}
                    onClick={() => handleInsertSymbol(sym.insert)}
                    className="no-drag p-2 bg-white border border-gray-200 rounded hover:bg-blue-50 hover:border-blue-300 transition-colors text-center"
                    title={sym.insert}
                  >
                    <span className="text-base font-mono">{sym.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
