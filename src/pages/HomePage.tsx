import { useState, useEffect, useRef } from 'react';
import type { User, AppPage, QuestionBank, Question } from '../types';
import { getBanks, saveBank, deleteBank, getStats, getFlaggedQuestions, removeFlaggedQuestion, FlaggedQuestion } from '../utils/storage';
import { allQuestions } from '../data/questions';
import { 
  importFromFile, 
  detectFileType, 
  checkDuplicates,
  FileType 
} from '../utils/importHelper';
import MathKeyboard from '../components/MathKeyboard';

interface HomePageProps {
  user: User;
  onNavigate: (page: AppPage, bankId?: string) => void;
  onLogout: () => void;
}

export default function HomePage({ user, onNavigate, onLogout }: HomePageProps) {
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [stats, setStats] = useState<ReturnType<typeof getStats> | null>(null);
  const [showAddBank, setShowAddBank] = useState(false);
  const [showImportBank, setShowImportBank] = useState(false);
  const [showEditBank, setShowEditBank] = useState(false);
  const [showQuestionEditor, setShowQuestionEditor] = useState(false);
  const [showBankSelect, setShowBankSelect] = useState(false);
  const [selectedMode, setSelectedMode] = useState<'practice' | 'review' | null>(null);
  const [editingBank, setEditingBank] = useState<QuestionBank | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number>(-1);
  const [showFlaggedList, setShowFlaggedList] = useState(false);
  const [flaggedQuestions, setFlaggedQuestions] = useState<FlaggedQuestion[]>([]);
  const [newBankName, setNewBankName] = useState('');
  const [newBankDesc, setNewBankDesc] = useState('');
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [activeTab, setActiveTab] = useState<'home' | 'banks' | 'stats'>('home');
  
  // 文件导入相关
  const [showFileImport, setShowFileImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const [importedQuestions, setImportedQuestions] = useState<Partial<Question>[]>([]);
  const [duplicateInfo, setDuplicateInfo] = useState<{
    duplicates: { new: Partial<Question>; original: Question; similarity: number; selected: boolean }[];
    newQuestions: Partial<Question>[];
  } | null>(null);
  const [selectedBankForImport, setSelectedBankForImport] = useState<string>('');
  const [rawTextPreview, setRawTextPreview] = useState('');
  // 导入题目编辑
  const [editingImportIndex, setEditingImportIndex] = useState<number | null>(null);
  const [editingImportQuestion, setEditingImportQuestion] = useState<Partial<Question> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 数学键盘相关
  const [showMathKeyboard, setShowMathKeyboard] = useState(false);
  const [mathKeyboardTarget, setMathKeyboardTarget] = useState<'question' | 'option' | 'explanation' | 'import'>('question');
  const [mathKeyboardOptionIndex, setMathKeyboardOptionIndex] = useState<number>(0);
  const questionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const importTextareaRef = useRef<HTMLTextAreaElement>(null);
  
  // 插入文本到目标位置
  const handleMathInsert = (text: string) => {
    if (mathKeyboardTarget === 'question' && questionTextareaRef.current) {
      const textarea = questionTextareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText = textarea.value.substring(0, start) + text + textarea.value.substring(end);
      setEditingQuestion({ ...editingQuestion!, question: newText });
      // 设置光标位置
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + text.length;
        textarea.focus();
      }, 0);
    } else if (mathKeyboardTarget === 'explanation' && questionTextareaRef.current) {
      const textarea = questionTextareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText = textarea.value.substring(0, start) + text + textarea.value.substring(end);
      setEditingQuestion({ ...editingQuestion!, explanation: newText });
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + text.length;
        textarea.focus();
      }, 0);
    } else if (mathKeyboardTarget === 'option') {
      const newChoices = [...(editingQuestion?.choices || [])];
      if (newChoices[mathKeyboardOptionIndex]) {
        newChoices[mathKeyboardOptionIndex] = { 
          ...newChoices[mathKeyboardOptionIndex], 
          text: newChoices[mathKeyboardOptionIndex].text + text 
        };
        setEditingQuestion({ ...editingQuestion!, choices: newChoices });
      }
    } else if (mathKeyboardTarget === 'import' && importTextareaRef.current) {
      const textarea = importTextareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText = textarea.value.substring(0, start) + text + textarea.value.substring(end);
      setImportText(newText);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + text.length;
        textarea.focus();
      }, 0);
    }
  };
  
  // 插入图片到目标位置
  const handleMathInsertImage = (dataUrl: string) => {
    if (mathKeyboardTarget === 'question') {
      // 直接设置题目图片
      setEditingQuestion({ ...editingQuestion!, image: dataUrl });
    } else if (mathKeyboardTarget === 'option') {
      // 设置选项图片
      const newChoices = [...(editingQuestion?.choices || [])];
      if (newChoices[mathKeyboardOptionIndex]) {
        newChoices[mathKeyboardOptionIndex] = { 
          ...newChoices[mathKeyboardOptionIndex], 
          image: dataUrl 
        };
        setEditingQuestion({ ...editingQuestion!, choices: newChoices });
      }
    } else if (mathKeyboardTarget === 'import' && importTextareaRef.current) {
      const textarea = importTextareaRef.current;
      const imgTag = `\n[图片: ${dataUrl.substring(0, 50)}...]\n`;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText = textarea.value.substring(0, start) + imgTag + textarea.value.substring(end);
      setImportText(newText);
    }
  };

  // 开始编辑导入的题目
  const handleStartEditImport = (index: number, q: Partial<Question>) => {
    setEditingImportIndex(index);
    setEditingImportQuestion({ ...q, choices: q.choices ? [...q.choices] : [] });
  };

  // 保存编辑的导入题目
  const handleSaveEditImport = () => {
    if (editingImportIndex === null || !editingImportQuestion) return;
    const updated = [...(duplicateInfo?.newQuestions || [])];
    updated[editingImportIndex] = { ...editingImportQuestion };
    setDuplicateInfo(prev => prev ? { ...prev, newQuestions: updated } : null);
    setEditingImportIndex(null);
    setEditingImportQuestion(null);
  };

  // 删除导入的题目
  const handleDeleteImportQuestion = (index: number) => {
    setDuplicateInfo(prev => {
      if (!prev) return null;
      const newQuestions = prev.newQuestions.filter((_, i) => i !== index);
      return { ...prev, newQuestions };
    });
  };

  // 切换重复题目的选择状态
  const handleToggleDuplicate = (index: number) => {
    setDuplicateInfo(prev => {
      if (!prev) return null;
      const duplicates = [...prev.duplicates];
      duplicates[index] = { ...duplicates[index], selected: !duplicates[index].selected };
      return { ...prev, duplicates };
    });
  };

  // 全部选择重复题目（导入）
  const handleSelectAllDuplicates = () => {
    setDuplicateInfo(prev => {
      if (!prev) return null;
      return {
        ...prev,
        duplicates: prev.duplicates.map(d => ({ ...d, selected: true }))
      };
    });
  };

  // 全部跳过重复题目
  const handleSkipAllDuplicates = () => {
    setDuplicateInfo(prev => {
      if (!prev) return null;
      return {
        ...prev,
        duplicates: prev.duplicates.map(d => ({ ...d, selected: false }))
      };
    });
  };

  // 导入选中的重复题目
  const handleImportSelectedDuplicates = () => {
    if (!duplicateInfo) return;
    const selectedDupes = duplicateInfo.duplicates.filter(d => d.selected);
    const selectedQuestions = selectedDupes.map(d => d.new);
    setDuplicateInfo(prev => {
      if (!prev) return null;
      return {
        ...prev,
        newQuestions: [...prev.newQuestions, ...selectedQuestions],
        duplicates: prev.duplicates.filter(d => !d.selected)
      };
    });
  };

  // 练题/背题前选择题库
  const handleStartWithBank = (mode: 'practice' | 'review') => {
    setSelectedMode(mode);
    setShowBankSelect(true);
  };

  const handleConfirmBank = (bankId: string) => {
    setShowBankSelect(false);
    if (selectedMode === 'practice') {
      onNavigate('practice', bankId);  // 传递 bankId，确保使用指定题库
    } else {
      onNavigate('review', bankId);
    }
  };

  useEffect(() => {
    setBanks(getBanks(user.id));
    setStats(getStats(user.id));
  }, [user.id]);

  // 监听页面可见性变化，从练题/背题页面返回时刷新统计数据
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setBanks(getBanks(user.id));
        setStats(getStats(user.id));
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user.id]);

  const totalQuestions = banks.reduce((sum, b) => sum + b.questions.length, 0);
  const accuracy = stats && stats.totalQuestions > 0
    ? Math.round((stats.correctCount / stats.totalQuestions) * 100) : 0;

  const handleDeleteBank = (id: string) => {
    if (id === 'default' || id === 'bank_electrical' || id === 'bank_metering') return;
    deleteBank(id, user.id);
    setBanks(getBanks(user.id));
  };

  const handleEditBank = (bank: QuestionBank) => {
    setEditingBank(bank);
    setNewBankName(bank.name);
    setNewBankDesc(bank.description);
    setShowEditBank(true);
  };

  const handleSaveEditBank = () => {
    if (!editingBank || !newBankName.trim()) return;
    const updatedBank: QuestionBank = {
      ...editingBank,
      name: newBankName,
      description: newBankDesc,
      updatedAt: Date.now(),
    };
    saveBank(updatedBank, user.id);
    setBanks(getBanks(user.id));
    setShowEditBank(false);
    setEditingBank(null);
    setNewBankName('');
    setNewBankDesc('');
  };

  // 题目编辑相关
  const emptyQuestion = (): Question => ({
    id: `q_${Date.now()}`,
    type: 'single',
    category: '',
    difficulty: 'medium',
    question: '',
    choices: [
      { id: 'A', text: '' },
      { id: 'B', text: '' },
      { id: 'C', text: '' },
      { id: 'D', text: '' },
    ],
    answer: [],
    explanation: '',
    knowledge: '',
    tags: [],
  });

  const handleOpenQuestionEditor = (bank: QuestionBank, index: number = -1) => {
    setEditingBank(bank);
    if (index >= 0) {
      setEditingQuestion({ ...bank.questions[index] });
      setEditingQuestionIndex(index);
    } else {
      setEditingQuestion(emptyQuestion());
      setEditingQuestionIndex(-1);
    }
    setShowQuestionEditor(true);
  };

  const handleSaveQuestion = () => {
    if (!editingBank || !editingQuestion) return;
    if (!editingQuestion.question.trim()) {
      alert('请输入题目内容');
      return;
    }
    const validChoices = editingQuestion.choices.filter(c => c.text.trim());
    if (validChoices.length < 2) {
      alert('请至少输入2个选项');
      return;
    }
    if (editingQuestion.answer.length === 0) {
      alert('请选择正确答案');
      return;
    }

    const updatedBank = { ...editingBank };
    if (editingQuestionIndex >= 0) {
      updatedBank.questions = [...editingBank.questions];
      updatedBank.questions[editingQuestionIndex] = { ...editingQuestion, choices: validChoices };
    } else {
      updatedBank.questions = [...editingBank.questions, { ...editingQuestion, choices: validChoices }];
    }
    updatedBank.updatedAt = Date.now();

    saveBank(updatedBank, user.id);
    setBanks(getBanks(user.id));
    setShowQuestionEditor(false);
    setEditingQuestion(null);
    setEditingQuestionIndex(-1);
  };

  const handleDeleteQuestion = (bank: QuestionBank, index: number) => {
    if (!confirm('确定要删除这道题目吗？')) return;
    const updatedBank = {
      ...bank,
      questions: bank.questions.filter((_, i) => i !== index),
      updatedAt: Date.now(),
    };
    saveBank(updatedBank, user.id);
    setBanks(getBanks(user.id));
  };

  const handleCreateBank = () => {
    if (!newBankName.trim()) return;
    const bank: QuestionBank = {
      id: `bank_${Date.now()}`,
      name: newBankName,
      description: newBankDesc,
      questions: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    saveBank(bank, user.id);
    setBanks(getBanks(user.id));
    setNewBankName('');
    setNewBankDesc('');
    setShowAddBank(false);
  };

  const handleImportJSON = () => {
    setImportError('');
    try {
      const data = JSON.parse(importText);
      // 支持导入题目数组或题库对象
      if (Array.isArray(data)) {
        const bank: QuestionBank = {
          id: `bank_${Date.now()}`,
          name: `导入题库_${new Date().toLocaleDateString()}`,
          description: `共${data.length}题`,
          questions: data,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        saveBank(bank, user.id);
        setBanks(getBanks(user.id));
        setImportText('');
        setShowImportBank(false);
      } else if (data.questions && Array.isArray(data.questions)) {
        const bank: QuestionBank = {
          ...data,
          id: `bank_${Date.now()}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        saveBank(bank, user.id);
        setBanks(getBanks(user.id));
        setImportText('');
        setShowImportBank(false);
      } else {
        setImportError('格式错误：需要题目数组或包含questions字段的题库对象');
      }
    } catch {
      setImportError('JSON格式解析失败，请检查格式');
    }
  };

  // 文件导入处理
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportProgress('正在处理文件...');
    setImportError('');

    try {
      const fileType = detectFileType(file);
      setImportProgress(`正在解析${fileType === 'image' ? '图片（OCR识别中）...' : '文件...'}`);

      console.log('[文件导入] 开始解析文件:', file.name, '类型:', fileType);
      
      const { questions, rawText } = await importFromFile(file);
      
      console.log('[文件导入] 解析完成，题目数量:', questions.length, '文本长度:', rawText.length);
      setRawTextPreview(rawText.slice(0, 1000));
      
      // 调试日志
      console.log('[文件导入] 文件类型:', fileType);
      console.log('[文件导入] 原始文本前300字符:', rawText.slice(0, 300));

      if (questions.length === 0) {
        // 显示更多调试信息
        const debugInfo = rawText.length > 0 
          ? `\n\n原始文本（前500字符）：\n${rawText.slice(0, 500)}${rawText.length > 500 ? '...' : ''}`
          : '\n\n（文件内容为空或解析失败）';
        setImportError('未能识别到任何题目，请检查文件格式。常见原因：\n1. 题目编号格式不标准（如缺少 1. 2. 等）\n2. 答案标记缺失（如无 答案: 或 【答案】）\n3. 文件内容为纯图片（需OCR识别）' + debugInfo);
        console.error('[文件导入] 解析失败，原始文本:', rawText);
        setImporting(false);
        return;
      }

      setImportProgress(`识别到 ${questions.length} 道题目，正在查重...`);
      
      // 查重
      const duplicateResult = checkDuplicates(questions, user.id);
      // 100%相似自动跳过，低于100%让用户选择
      const duplicatesWithSelection = duplicateResult.duplicates.map(d => ({
        ...d,
        selected: d.similarity < 1.0 // 只有低于100%才让用户选择
      }));
      // 自动将100%相似的题目跳过（不加入导入列表）
      setDuplicateInfo({
        duplicates: duplicatesWithSelection,
        newQuestions: duplicateResult.newQuestions
      });
      setImportedQuestions(questions);
      setImportProgress('');
      setImporting(false);
    } catch (err: any) {
      console.error('[文件导入] 导入失败:', err);
      setImportError(`导入失败: ${err.message || '未知错误'}\n\n详细信息请查看浏览器控制台（F12）。`);
      setImporting(false);
    }
  };

  // 执行导入
  const handleConfirmImport = () => {
    if (!duplicateInfo || duplicateInfo.newQuestions.length === 0) return;

    let targetBank: QuestionBank;
    
    if (selectedBankForImport) {
      // 追加到已有题库
      const existingBank = banks.find(b => b.id === selectedBankForImport);
      if (!existingBank) return;
      
      targetBank = {
        ...existingBank,
        questions: [
          ...existingBank.questions,
          ...duplicateInfo.newQuestions.map((q, i) => ({
            ...q,
            id: `imported_${Date.now()}_${i}`,
            category: q.category || '未分类',
          })) as Question[]
        ],
        updatedAt: Date.now()
      };
    } else {
      // 创建新题库
      targetBank = {
        id: `bank_${Date.now()}`,
        name: `导入题库_${new Date().toLocaleDateString()}`,
        description: `导入${duplicateInfo.newQuestions.length}题`,
        questions: duplicateInfo.newQuestions.map((q, i) => ({
          ...q,
          id: `imported_${Date.now()}_${i}`,
          category: q.category || '未分类',
        })) as Question[],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
    }

    saveBank(targetBank, user.id);
    setBanks(getBanks(user.id));
    setShowFileImport(false);
    setImportedQuestions([]);
    setDuplicateInfo(null);
    setRawTextPreview('');
    setSelectedBankForImport('');
    
    // 清理文件输入
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 关闭导入弹窗时重置状态
  const handleCloseFileImport = () => {
    setShowFileImport(false);
    setImportedQuestions([]);
    setDuplicateInfo(null);
    setImportError('');
    setImporting(false);
    setImportProgress('');
    setRawTextPreview('');
    setSelectedBankForImport('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen" style={{ background: '#f0f4f8' }}>
      {/* 顶部导航 */}
      <header className="sticky top-0 z-30 shadow-sm"
        style={{ background: 'linear-gradient(90deg, #1e3a8a, #4c1d95)', backdropFilter: 'blur(10px)' }}>
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.15)' }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <circle cx="11" cy="11" r="9" stroke="white" strokeWidth="2"/>
                <path d="M7 11L10 14L15 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-white font-bold text-lg">智能刷题系统</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-white">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                style={{ background: 'rgba(255,255,255,0.2)' }}>
                {user.displayName.charAt(0)}
              </div>
              <span className="text-sm hidden sm:block">{user.displayName}</span>
            </div>
            <button onClick={onLogout}
              className="text-white text-sm px-3 py-1.5 rounded-lg transition-all"
              style={{ background: 'rgba(255,255,255,0.15)' }}>
              退出
            </button>
          </div>
        </div>
      </header>

      {/* Tab 导航 */}
      <div className="max-w-5xl mx-auto px-4 pt-4">
        <div className="flex gap-2 mb-6">
          {[
            { id: 'home', label: '首页', icon: '🏠' },
            { id: 'banks', label: '题库管理', icon: '📚' },
            { id: 'stats', label: '学习统计', icon: '📊' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-blue-600 shadow-md'
                  : 'text-gray-500 hover:bg-white hover:text-gray-700'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* 首页 */}
        {activeTab === 'home' && (
          <div>
            {/* 统计卡片 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              {[
                { label: '题库总量', value: totalQuestions, unit: '题', color: '#2563eb' },
                { label: '已做题数', value: stats?.totalQuestions || 0, unit: '题', color: '#7c3aed' },
                { label: '正确率', value: accuracy, unit: '%', color: '#10b981' },
                { label: '错题数量', value: stats?.wrongQuestions.length || 0, unit: '题', color: '#f59e0b' },
              ].map((item, i) => (
                <div key={i} className="card text-center py-5">
                  <div className="text-3xl font-bold mb-1" style={{ color: item.color }}>
                    {item.value}<span className="text-lg">{item.unit}</span>
                  </div>
                  <div className="text-gray-500 text-sm">{item.label}</div>
                </div>
              ))}
            </div>

            {/* 模式选择 */}
            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              {/* 练题模式 */}
              <div className="card relative overflow-hidden cursor-pointer group transition-all hover:-translate-y-1 hover:shadow-xl"
                onClick={() => handleStartWithBank('practice')}
                style={{ borderLeft: '4px solid #2563eb' }}>
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10 -translate-y-8 translate-x-8"
                  style={{ background: '#2563eb' }} />
                <div className="relative">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white"
                      style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 text-lg">练题模式</h3>
                      <p className="text-gray-500 text-xs">随机出题 · 限时挑战</p>
                    </div>
                  </div>
                  <ul className="text-sm text-gray-600 space-y-1 mb-4">
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block"/><span>80道题（60单选+20多选）</span></li>
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block"/><span>随机题目，含扩展题库</span></li>
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block"/><span>科学计算器辅助</span></li>
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block"/><span>实时答案解析与知识点</span></li>
                  </ul>
                  <button className="btn btn-primary w-full text-sm py-2"
                    style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}>
                    开始练题 →
                  </button>
                </div>
              </div>

              {/* 背题模式 */}
              <div className="card relative overflow-hidden cursor-pointer group transition-all hover:-translate-y-1 hover:shadow-xl"
                onClick={() => handleStartWithBank('review')}
                style={{ borderLeft: '4px solid #7c3aed' }}>
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10 -translate-y-8 translate-x-8"
                  style={{ background: '#7c3aed' }} />
                <div className="relative">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white"
                      style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 text-lg">背题模式</h3>
                      <p className="text-gray-500 text-xs">逐题浏览 · 加深记忆</p>
                    </div>
                  </div>
                  <ul className="text-sm text-gray-600 space-y-1 mb-4">
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block"/><span>按顺序浏览全部题目</span></li>
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block"/><span>即时显示答案和解析</span></li>
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block"/><span>知识点系统梳理</span></li>
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block"/><span>自由翻页，随时查阅</span></li>
                  </ul>
                  <button className="btn w-full text-sm py-2 text-white"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)' }}>
                    开始背题 →
                  </button>
                </div>
              </div>
            </div>

            {/* 错题练习 */}
            {(stats?.wrongQuestions.length || 0) > 0 && (
              <div className="card mb-6" style={{ borderLeft: '4px solid #ef4444' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                      style={{ background: '#ef4444' }}>
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10 2l2.39 7.26H20l-6.19 4.5 2.39 7.26L10 17.52 3.8 21l2.39-7.26L0 9.26h7.61z"/>
                      </svg>
                    </div>
                    <div>
                      <div className="font-bold text-gray-800">错题本</div>
                      <div className="text-gray-500 text-sm">共 {stats?.wrongQuestions.length} 道错题待复习</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => onNavigate('wrong-list')}
                      className="btn btn-secondary text-sm py-2">查看错题</button>
                    <button onClick={() => onNavigate('wrong-practice')}
                      className="btn btn-danger text-sm py-2">专项练习</button>
                  </div>
                </div>
              </div>
            )}

            {/* 最近题库 */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800">当前题库</h3>
                <button onClick={() => setActiveTab('banks')}
                  className="text-blue-500 text-sm hover:text-blue-700">管理 →</button>
              </div>
              <div className="space-y-2">
                {banks.map(bank => (
                  <div key={bank.id} className="flex items-center justify-between p-3 rounded-lg"
                    style={{ background: '#f8fafc' }}>
                    <div>
                      <span className="font-medium text-gray-700">{bank.name}</span>
                      <span className="ml-2 badge text-xs" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                        {bank.questions.length}题
                      </span>
                    </div>
                    <span className="text-gray-400 text-xs">{bank.description?.slice(0, 20)}</span>
                  </div>
                ))}
                {banks.length === 0 && (
                  <div className="text-center py-6 text-gray-400">
                    <div className="text-3xl mb-2">📭</div>
                    <div>暂无题库，请先添加</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 题库管理 */}
        {activeTab === 'banks' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">题库管理</h2>
              <div className="flex gap-2">
                <button onClick={() => {
                  setFlaggedQuestions(getFlaggedQuestions());
                  setShowFlaggedList(true);
                }}
                  className="btn text-sm py-2 px-4"
                  style={{ background: '#ef4444', color: 'white' }}>
                  ⚑ 问题题目 ({getFlaggedQuestions().length})
                </button>
                <button onClick={() => setShowFileImport(true)}
                  className="btn text-sm py-2 px-4"
                  style={{ background: '#10b981', color: 'white' }}>
                  📄 文件导入
                </button>
                <button onClick={() => setShowImportBank(true)}
                  className="btn btn-secondary text-sm py-2 px-4">
                  导入JSON
                </button>
                <button onClick={() => setShowAddBank(true)}
                  className="btn btn-primary text-sm py-2 px-4">
                  + 新建题库
                </button>
              </div>
            </div>

            {/* 添加题库弹窗 */}
            {showAddBank && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                style={{ background: 'rgba(0,0,0,0.5)' }}>
                <div className="card w-full max-w-md">
                  <h3 className="font-bold text-lg mb-4">新建题库</h3>
                  <div className="space-y-3">
                    <input className="input" placeholder="题库名称" value={newBankName}
                      onChange={e => setNewBankName(e.target.value)} />
                    <textarea className="input" rows={3} placeholder="题库描述（可选）"
                      value={newBankDesc} onChange={e => setNewBankDesc(e.target.value)} />
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => setShowAddBank(false)} className="btn btn-secondary flex-1">取消</button>
                    <button onClick={handleCreateBank} className="btn btn-primary flex-1">创建</button>
                  </div>
                </div>
              </div>
            )}

            {/* 导入JSON弹窗 */}
            {showImportBank && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                style={{ background: 'rgba(0,0,0,0.5)' }}>
                <div className="card w-full max-w-lg">
                  <h3 className="font-bold text-lg mb-2">导入题库 (JSON格式)</h3>
                  <p className="text-sm text-gray-500 mb-3">
                    支持题目数组格式，每道题包含：type(single/multiple)、question、choices、answer、explanation等字段
                  </p>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">JSON数据</span>
                    <button
                      type="button"
                      onClick={() => { setMathKeyboardTarget('import'); setShowMathKeyboard(!showMathKeyboard); }}
                      className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 border border-blue-200"
                    >
                      📐 数学键盘
                    </button>
                  </div>
                  <textarea
                    ref={importTextareaRef}
                    className="input font-mono text-xs"
                    rows={8}
                    placeholder='粘贴JSON数据，例如：[{"type":"single","question":"...","choices":[{"id":"A","text":"..."}],"answer":["A"],"explanation":"...","knowledge":"...","category":"...","difficulty":"easy","tags":[]}]'
                    value={importText}
                    onChange={e => setImportText(e.target.value)}
                    onFocus={() => { setMathKeyboardTarget('import'); }}
                  />
                  {/* 数学键盘 */}
                  {showMathKeyboard && mathKeyboardTarget === 'import' && (
                    <MathKeyboard
                      question={{
                        question: importText,
                        choices: [],
                      }}
                      onQuestionChange={() => {}}
                      onClose={() => setShowMathKeyboard(false)}
                    />
                  )}
                  {importError && <div className="text-red-500 text-sm mt-2">{importError}</div>}
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => { setShowImportBank(false); setImportError(''); setImportText(''); setShowMathKeyboard(false); }}
                      className="btn btn-secondary flex-1">取消</button>
                    <button onClick={handleImportJSON} className="btn btn-primary flex-1">导入</button>
                  </div>
                </div>
              </div>
            )}

            {/* 问题题目列表弹窗 */}
            {showFlaggedList && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                style={{ background: 'rgba(0,0,0,0.5)' }}>
                <div className="card w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <span className="text-red-500">⚑</span>
                      问题题目 ({flaggedQuestions.length})
                    </h3>
                    <button onClick={() => setShowFlaggedList(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    以下是练题过程中被标记的题目，可以查看原始题目并修改。
                  </p>
                  <div className="flex-1 overflow-y-auto space-y-3">
                    {flaggedQuestions.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <div className="text-4xl mb-2">✨</div>
                        <div>暂无问题题目</div>
                      </div>
                    ) : (
                      flaggedQuestions.map((flag, idx) => {
                        // 找到对应的题库和题目
                        const bank = banks.find(b => b.id === flag.bankId);
                        const question = bank?.questions.find(q => q.id === flag.questionId);
                        return (
                          <div key={flag.questionId} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex items-start gap-3">
                              <span className="text-red-500 font-bold text-lg">{idx + 1}.</span>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="badge text-xs bg-red-100 text-red-700">⚑ 已标记</span>
                                  <span className="badge text-xs bg-gray-100 text-gray-600">
                                    {bank?.name || '未知题库'}
                                  </span>
                                  {question && (
                                    <span className="badge text-xs" style={{
                                      background: question.type === 'single' ? '#dbeafe' : '#f3e8ff',
                                      color: question.type === 'single' ? '#1d4ed8' : '#5b21b6',
                                    }}>
                                      {question.type === 'single' ? '单选题' : '多选题'}
                                    </span>
                                  )}
                                </div>
                                {question ? (
                                  <>
                                    <p className="text-gray-700 font-medium mb-2">{question.question}</p>
                                    {question.choices && (
                                      <div className="space-y-1 mb-2">
                                        {question.choices.map((c: any) => (
                                          <div key={c.id} className="text-sm text-gray-600">
                                            {c.id}. {c.text}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    <p className="text-sm text-green-600 font-medium">
                                      答案：{question.answer?.join(', ')}
                                    </p>
                                    <button
                                      onClick={() => {
                                        // 打开题目编辑器
                                        setEditingBank(bank!);
                                        setEditingQuestion({...question});
                                        setEditingQuestionIndex(bank!.questions.findIndex(q => q.id === question.id));
                                        setShowFlaggedList(false);
                                        setShowQuestionEditor(true);
                                      }}
                                      className="mt-2 btn btn-primary text-sm py-1.5"
                                    >
                                      编辑此题目
                                    </button>
                                  </>
                                ) : (
                                  <p className="text-gray-500 text-sm">
                                    题目已被删除或不存在
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-col gap-1">
                                <button
                                  onClick={() => {
                                    removeFlaggedQuestion(flag.questionId);
                                    setFlaggedQuestions(flaggedQuestions.filter(f => f.questionId !== flag.questionId));
                                  }}
                                  className="text-gray-400 hover:text-blue-500 px-2 py-1 text-xs"
                                  title="只移除标记"
                                >
                                  移除标记
                                </button>
                                {question && (
                                  <button
                                    onClick={() => {
                                      if (confirm(`确定要从题库"${bank?.name}"中删除此题目吗？此操作不可恢复。`)) {
                                        // 从题库中删除题目
                                        const updatedBanks = banks.map(b => {
                                          if (b.id === flag.bankId) {
                                            return {
                                              ...b,
                                              questions: b.questions.filter(q => q.id !== flag.questionId)
                                            };
                                          }
                                          return b;
                                        });
                                        // 保存更新后的题库
                                        updatedBanks.forEach(b => saveBank(b, user.id));
                                        // 移除标记
                                        removeFlaggedQuestion(flag.questionId);
                                        setFlaggedQuestions(flaggedQuestions.filter(f => f.questionId !== flag.questionId));
                                        // 刷新题库列表
                                        setBanks(getBanks(user.id));
                                      }
                                    }}
                                    className="text-gray-400 hover:text-red-500 px-2 py-1 text-xs"
                                    title="删除题目"
                                  >
                                    删除题目
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 文件导入弹窗 */}
            {showFileImport && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                style={{ background: 'rgba(0,0,0,0.5)' }}>
                <div className="card w-full max-w-2xl max-h-[85vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg">📄 文件导入题目</h3>
                    <button onClick={handleCloseFileImport} className="text-gray-400 hover:text-gray-600">✕</button>
                  </div>
                  
                  {!importedQuestions.length ? (
                    // 第一步：选择文件
                    <div>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                        <h4 className="font-semibold text-green-800 mb-2">支持的文件格式</h4>
                        <ul className="text-sm text-green-700 space-y-1">
                          <li>📄 <b>文本文件</b> (.txt) - 直接解析</li>
                          <li>📝 <b>Word文档</b> (.docx) - 自动提取文字</li>
                          <li>📕 <b>PDF文件</b> (.pdf) - 提取文本内容</li>
                          <li>🖼️ <b>图片文件</b> (.jpg/.png) - OCR文字识别</li>
                        </ul>
                      </div>

                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-green-400 transition-colors">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".txt,.text,.md,.docx,.pdf,.jpg,.jpeg,.png"
                          onChange={handleFileSelect}
                          className="hidden"
                          id="file-input"
                        />
                        <label htmlFor="file-input" className="cursor-pointer">
                          <div className="text-5xl mb-3">📁</div>
                          <div className="text-gray-700 font-medium mb-2">点击选择文件或将文件拖拽到此处</div>
                          <div className="text-gray-400 text-sm">支持 TXT, DOCX, PDF, JPG, PNG</div>
                        </label>
                      </div>

                      {importing && (
                        <div className="mt-4 text-center">
                          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg text-blue-600">
                            <span className="animate-spin">⏳</span>
                            {importProgress}
                          </div>
                        </div>
                      )}

                      {importError && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                          {importError}
                        </div>
                      )}

                      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="text-amber-800 text-sm">
                          <b>💡 提示：</b>导入前请确保题目格式规范，如：
                          <br/>1. 题目编号（如 1. 2. 3.）
                          <br/>2. 选项标识（如 A. B. C. D.）
                          <br/>3. 答案标记（如 答案: A 或 【答案】A）
                        </div>
                      </div>
                    </div>
                  ) : (
                    // 第二步：预览和确认
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="flex-1">
                          <div className="flex gap-2 text-sm">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">识别: {importedQuestions.length}题</span>
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded">新增: {duplicateInfo?.newQuestions.length || 0}题</span>
                            <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded">重复: {duplicateInfo?.duplicates.length || 0}题</span>
                          </div>
                        </div>
                      </div>

                      {/* 原始文本预览 */}
                      {rawTextPreview && (
                        <div className="mb-4">
                          <details className="bg-gray-50 rounded-lg">
                            <summary className="px-3 py-2 cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                              📋 原始文本预览（点击展开）
                            </summary>
                            <pre className="px-3 pb-3 text-xs text-gray-500 whitespace-pre-wrap max-h-32 overflow-auto">
                              {rawTextPreview}...
                            </pre>
                          </details>
                        </div>
                      )}

                      {/* 重复题目列表 */}
                      {duplicateInfo && duplicateInfo.duplicates.length > 0 && (
                        <div className="mb-4">
                          <div className="bg-amber-50 border border-amber-200 rounded-lg">
                            <div className="px-3 py-2 flex items-center justify-between text-sm font-medium text-amber-700">
                              <span>
                                ⚠️ 检测到 {duplicateInfo.duplicates.length} 道重复题目
                                <span className="text-xs ml-1">
                                  （100%相似自动跳过 {duplicateInfo.duplicates.filter(d => d.similarity === 1).length} 道，
                                  待选择 {duplicateInfo.duplicates.filter(d => d.similarity < 1).filter(d => d.selected).length}/{duplicateInfo.duplicates.filter(d => d.similarity < 1).length} 道）
                                </span>
                              </span>
                              <div className="flex gap-2">
                                <button
                                  className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                                  onClick={handleSelectAllDuplicates}
                                >
                                  全部导入
                                </button>
                                <button
                                  className="px-2 py-1 text-xs bg-gray-400 text-white rounded hover:bg-gray-500"
                                  onClick={handleSkipAllDuplicates}
                                >
                                  全部跳过
                                </button>
                              </div>
                            </div>
                            <div className="max-h-80 overflow-y-auto space-y-2 p-3">
                              {duplicateInfo.duplicates.map((dup, i) => (
                                <div key={i} className={`p-2 border rounded text-xs ${
                                  dup.similarity === 1 
                                    ? 'bg-gray-100 border-gray-200 opacity-60' // 100%相似灰色
                                    : dup.selected 
                                      ? 'bg-green-50 border-green-300' 
                                      : 'bg-white border-amber-200'
                                }`}>
                                  {dup.similarity === 1 ? (
                                    // 100%相似，自动跳过
                                    <div className="flex gap-3 items-start">
                                      <span className="px-3 py-1 rounded text-xs font-medium bg-gray-300 text-gray-600 shrink-0">
                                        自动跳过
                                      </span>
                                      <div className="flex-1 min-w-0">
                                        <div className="text-gray-600 truncate">
                                          {dup.new.question?.substring(0, 80)}...
                                        </div>
                                        <div className="text-gray-400 mt-1">
                                          相似度: {(dup.similarity * 100).toFixed(1)}%
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    // 低于100%，可选择，可展开查看对比
                                    <details className="group">
                                      <summary className="flex gap-3 items-start cursor-pointer list-none">
                                        <button
                                          className={`px-3 py-1 rounded text-xs font-medium shrink-0 ${
                                            dup.selected
                                              ? 'bg-green-500 text-white'
                                              : 'bg-amber-200 text-amber-800 hover:bg-amber-300'
                                          }`}
                                          onClick={(e) => {
                                            e.preventDefault();
                                            handleToggleDuplicate(i);
                                          }}
                                        >
                                          {dup.selected ? '✓ 导入' : '跳过'}
                                        </button>
                                        <div className="flex-1 min-w-0">
                                          <div className={`font-medium ${dup.selected ? 'text-green-700' : 'text-amber-800'}`}>
                                            {dup.new.question?.substring(0, 60)}...
                                          </div>
                                          <div className="text-amber-600 mt-1">
                                            相似度: {(dup.similarity * 100).toFixed(1)}% — 点击展开对比
                                          </div>
                                        </div>
                                      </summary>
                                      {/* 详细对比 */}
                                      <div className="mt-3 pt-3 border-t border-amber-200 space-y-3">
                                        <div>
                                          <div className="font-medium text-blue-600 mb-1">📝 新题目：</div>
                                          <div className="bg-blue-50 p-2 rounded text-gray-700 whitespace-pre-wrap">
                                            {dup.new.question}
                                            {dup.new.choices && dup.new.choices.length > 0 && (
                                              <div className="mt-2 space-y-1">
                                                {dup.new.choices.map((c, ci) => (
                                                  <div key={ci} className={dup.new.answer?.includes(String.fromCharCode(65 + ci)) ? 'font-bold text-blue-600' : ''}>
                                                    {String.fromCharCode(65 + ci)}. {(c as any).text || c}
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                            {dup.new.answer && (
                                              <div className="mt-2 text-green-600 font-medium">
                                                答案: {dup.new.answer.join(', ')}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        <div>
                                          <div className="font-medium text-gray-600 mb-1">📋 已有题目：</div>
                                          <div className="bg-gray-50 p-2 rounded text-gray-700 whitespace-pre-wrap">
                                            {dup.original.question}
                                            {dup.original.choices && dup.original.choices.length > 0 && (
                                              <div className="mt-2 space-y-1">
                                                {dup.original.choices.map((c, ci) => (
                                                  <div key={ci} className={dup.original.answer?.includes(String.fromCharCode(65 + ci)) ? 'font-bold text-gray-600' : ''}>
                                                    {String.fromCharCode(65 + ci)}. {(c as any).text || c}
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                            {dup.original.answer && (
                                              <div className="mt-2 text-gray-500 font-medium">
                                                答案: {dup.original.answer.join(', ')}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </details>
                                  )}
                                </div>
                              ))}
                            </div>
                            {duplicateInfo.duplicates.some(d => d.selected) && (
                              <div className="px-3 py-2 border-t border-amber-200">
                                <button
                                  className="w-full px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm font-medium"
                                  onClick={handleImportSelectedDuplicates}
                                >
                                  导入选中的 {duplicateInfo.duplicates.filter(d => d.selected).length} 道重复题目
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 新题目预览 */}
                      {duplicateInfo && duplicateInfo.newQuestions.length > 0 && (
                        <div className="mb-4">
                          <details className="bg-green-50 border border-green-200 rounded-lg open:border-green-300" open>
                            <summary className="px-3 py-2 cursor-pointer text-sm font-medium text-green-700 hover:bg-green-100 rounded-t-lg">
                              ✅ 新增题目预览（{duplicateInfo.newQuestions.length}道）— 点击展开/收起
                            </summary>
                            <div className="max-h-80 overflow-y-auto space-y-2 p-3">
                              {duplicateInfo.newQuestions.map((q, i) => (
                                editingImportIndex === i ? (
                                  // 编辑模式
                                  <div key={i} className="p-3 bg-white border-2 border-blue-300 rounded-lg">
                                    <div className="text-xs text-blue-600 font-medium mb-2">编辑第 {i + 1} 题</div>
                                    <div className="space-y-2">
                                      <div>
                                        <label className="text-xs text-gray-600">题目内容</label>
                                        <textarea
                                          className="input w-full text-xs"
                                          rows={2}
                                          value={editingImportQuestion?.question || ''}
                                          onChange={e => setEditingImportQuestion(prev => prev ? { ...prev, question: e.target.value } : null)}
                                        />
                                      </div>
                                      <div className="flex gap-2">
                                        <div className="flex-1">
                                          <label className="text-xs text-gray-600">类型</label>
                                          <select
                                            className="input w-full text-xs"
                                            value={editingImportQuestion?.type || 'single'}
                                            onChange={e => setEditingImportQuestion(prev => prev ? { ...prev, type: e.target.value as 'single' | 'multiple' } : null)}
                                          >
                                            <option value="single">单选题</option>
                                            <option value="multiple">多选题</option>
                                          </select>
                                        </div>
                                        <div className="flex-1">
                                          <label className="text-xs text-gray-600">答案（用逗号分隔，如 A,B）</label>
                                          <input
                                            type="text"
                                            className="input w-full text-xs"
                                            value={editingImportQuestion?.answer?.join(',') || ''}
                                            onChange={e => setEditingImportQuestion(prev => prev ? {
                                              ...prev,
                                              answer: e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
                                            } : null)}
                                          />
                                        </div>
                                      </div>
                                      {/* 选项编辑 */}
                                      <div>
                                        <label className="text-xs text-gray-600">选项内容（可编辑）</label>
                                        <div className="space-y-1 mt-1">
                                          {editingImportQuestion?.choices?.map((choice, ci) => (
                                            <div key={ci} className="flex gap-1 items-center">
                                              <span className="text-xs font-medium text-gray-500 w-6">{choice.id}.</span>
                                              <input
                                                type="text"
                                                className="input flex-1 text-xs py-1"
                                                value={choice.text}
                                                onChange={e => {
                                                  const newChoices = [...(editingImportQuestion?.choices || [])];
                                                  newChoices[ci] = { ...newChoices[ci], text: e.target.value };
                                                  setEditingImportQuestion(prev => prev ? { ...prev, choices: newChoices } : null);
                                                }}
                                                placeholder={`选项${choice.id}`}
                                              />
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                      <div>
                                        <label className="text-xs text-gray-600">解析</label>
                                        <input
                                          type="text"
                                          className="input w-full text-xs"
                                          value={editingImportQuestion?.explanation || ''}
                                          onChange={e => setEditingImportQuestion(prev => prev ? { ...prev, explanation: e.target.value } : null)}
                                        />
                                      </div>
                                      <div className="flex gap-2">
                                        <button onClick={handleSaveEditImport} className="btn btn-primary text-xs py-1">保存</button>
                                        <button onClick={() => { setEditingImportIndex(null); setEditingImportQuestion(null); }} className="btn btn-secondary text-xs py-1">取消</button>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  // 显示模式
                                  <div key={i} className="p-3 bg-white border border-green-200 rounded text-xs">
                                    <div className="flex justify-between items-start">
                                      <div className="flex-1">
                                        {/* 题目内容 */}
                                        <div className="text-green-800 font-medium mb-1">
                                          {i + 1}. {q.question}
                                        </div>
                                        {/* 选项列表 */}
                                        {q.choices && q.choices.length >= 2 && (
                                          <div className="text-gray-600 mt-1 space-y-0.5">
                                            {q.choices.map((choice, ci) => (
                                              <div key={ci} className={q.answer?.includes(choice.id) ? 'text-green-600 font-medium' : ''}>
                                                {choice.id}. {choice.text}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {/* 答案 */}
                                        <div className="text-green-600 mt-1">
                                          [{q.type === 'single' ? '单选' : '多选'}] 答案: {q.answer?.join(', ')}
                                        </div>
                                        {/* 解析 */}
                                        {q.explanation && (
                                          <div className="text-gray-500 mt-1 text-xs">
                                            解析: {q.explanation.length > 50 ? q.explanation.substring(0, 50) + '...' : q.explanation}
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex gap-1 ml-2">
                                        <button 
                                          onClick={() => handleStartEditImport(i, q)}
                                          className="px-2 py-1 bg-blue-100 text-blue-600 rounded text-xs hover:bg-blue-200"
                                        >
                                          编辑
                                        </button>
                                        <button 
                                          onClick={() => handleDeleteImportQuestion(i)}
                                          className="px-2 py-1 bg-red-100 text-red-600 rounded text-xs hover:bg-red-200"
                                        >
                                          删除
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )
                              ))}
                            </div>
                          </details>
                        </div>
                      )}

                      {/* 选择目标题库 */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">导入到</label>
                        <select 
                          className="input w-full"
                          value={selectedBankForImport}
                          onChange={e => setSelectedBankForImport(e.target.value)}
                        >
                          <option value="">创建新题库</option>
                          {banks.map(bank => (
                            <option key={bank.id} value={bank.id}>
                              {bank.name}（当前{bank.questions.length}题）
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex gap-2">
                        <button onClick={handleCloseFileImport}
                          className="btn btn-secondary flex-1">取消</button>
                        <button 
                          onClick={handleConfirmImport}
                          disabled={!duplicateInfo?.newQuestions.length}
                          className="btn flex-1 py-2.5 text-white font-semibold disabled:opacity-50"
                          style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                          确认导入 {duplicateInfo?.newQuestions.length || 0} 题
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 编辑题库弹窗 */}
            {showEditBank && editingBank && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                style={{ background: 'rgba(0,0,0,0.5)' }}>
                <div className="card w-full max-w-md">
                  <h3 className="font-bold text-lg mb-4">编辑题库</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">题库名称</label>
                      <input className="input" placeholder="题库名称" value={newBankName}
                        onChange={e => setNewBankName(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">题库描述</label>
                      <textarea className="input" rows={3} placeholder="题库描述（可选）"
                        value={newBankDesc} onChange={e => setNewBankDesc(e.target.value)} />
                    </div>
                    <div className="text-sm text-gray-500">
                      共 {editingBank.questions.length} 题
                    </div>
                    <button onClick={() => { setShowEditBank(false); handleOpenQuestionEditor(editingBank); }}
                      className="btn btn-secondary w-full text-sm py-2">
                      + 添加新题目
                    </button>
                    {editingBank.questions.length > 0 && (
                      <div className="max-h-48 overflow-y-auto border rounded-lg">
                        {editingBank.questions.map((q, idx) => (
                          <div key={q.id || idx} className="flex items-center justify-between p-2 border-b last:border-b-0 hover:bg-gray-50">
                            <span className="text-sm truncate flex-1 mr-2">
                              {idx + 1}. {q.question.substring(0, 40)}{q.question.length > 40 ? '...' : ''}
                            </span>
                            <div className="flex gap-1">
                              <button onClick={() => { setShowEditBank(false); handleOpenQuestionEditor(editingBank, idx); }}
                                className="text-blue-500 hover:text-blue-700 text-xs px-2 py-1">编辑</button>
                              <button onClick={() => handleDeleteQuestion(editingBank, idx)}
                                className="text-red-400 hover:text-red-600 text-xs px-2 py-1">删除</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => { setShowEditBank(false); setEditingBank(null); setNewBankName(''); setNewBankDesc(''); }}
                      className="btn btn-secondary flex-1">关闭</button>
                    <button onClick={handleSaveEditBank} className="btn btn-primary flex-1">保存</button>
                  </div>
                </div>
              </div>
            )}

            {/* 题目编辑弹窗 */}
            {showQuestionEditor && editingBank && editingQuestion && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                style={{ background: 'rgba(0,0,0,0.5)' }}>
                <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                  <h3 className="font-bold text-lg mb-4">
                    {editingQuestionIndex >= 0 ? '编辑题目' : '添加题目'}
                  </h3>
                  <div className="space-y-4">
                    {/* 题目类型 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">题目类型</label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2">
                          <input type="radio" checked={editingQuestion.type === 'single'}
                            onChange={() => setEditingQuestion({ ...editingQuestion, type: 'single', answer: [] })}
                            className="w-4 h-4" />
                          单选题
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="radio" checked={editingQuestion.type === 'multiple'}
                            onChange={() => setEditingQuestion({ ...editingQuestion, type: 'multiple', answer: [] })}
                            className="w-4 h-4" />
                          多选题
                        </label>
                      </div>
                    </div>

                    {/* 题目内容 */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-sm font-medium text-gray-700">题目内容 *</label>
                        <button
                          type="button"
                          onClick={() => setShowMathKeyboard(true)}
                          className="text-xs px-3 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 border border-blue-200 font-medium"
                        >
                          📐 打开编辑器
                        </button>
                      </div>
                      <textarea
                        ref={questionTextareaRef}
                        className="input"
                        rows={2}
                        placeholder="直接输入或点击「打开编辑器」使用数学符号..."
                        value={editingQuestion.question}
                        onChange={e => setEditingQuestion({ ...editingQuestion, question: e.target.value })}
                        onFocus={() => { setMathKeyboardTarget('question'); }}
                      />
                      {/* 题目图片预览 */}
                      {editingQuestion.image && (
                        <div className="mt-2 relative inline-block">
                          <img src={editingQuestion.image} alt="题目图片" className="max-w-full max-h-32 rounded border" />
                          <button
                            onClick={() => setEditingQuestion({ ...editingQuestion, image: undefined })}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 选项 */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">选项 *</label>
                        <button
                          type="button"
                          onClick={() => setShowMathKeyboard(true)}
                          className="text-xs px-3 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 border border-blue-200 font-medium"
                        >
                          📐 打开编辑器
                        </button>
                      </div>
                      <div className="space-y-2">
                        {editingQuestion.choices.map((choice, idx) => (
                          <div key={idx}>
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded text-sm font-medium flex-shrink-0">
                                {choice.id}
                              </span>
                              <input className="input flex-1" placeholder={`选项 ${choice.id}`}
                                value={choice.text}
                                onChange={e => {
                                  const newChoices = [...editingQuestion.choices];
                                  newChoices[idx].text = e.target.value;
                                  setEditingQuestion({ ...editingQuestion, choices: newChoices });
                                }}
                                onFocus={() => { setMathKeyboardTarget('option'); setMathKeyboardOptionIndex(idx); }}
                              />
                              {/* 选项图片 */}
                              {choice.image && (
                                <div className="ml-2 mt-1 relative inline-block">
                                  <img src={choice.image} alt={`选项${choice.id}图片`} className="max-w-full max-h-24 rounded border" />
                                  <button
                                    onClick={() => {
                                      const newChoices = [...editingQuestion.choices];
                                      newChoices[idx] = { ...newChoices[idx], image: undefined };
                                      setEditingQuestion({ ...editingQuestion, choices: newChoices });
                                    }}
                                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
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

                    {/* 正确答案 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        正确答案 * ({editingQuestion.type === 'single' ? '单选' : '多选，可多选'})
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {editingQuestion.choices.filter(c => c.text.trim()).map(choice => (
                          <label key={choice.id} className="flex items-center gap-1 px-3 py-1 border rounded cursor-pointer hover:bg-gray-50"
                            style={{
                              background: editingQuestion.answer.includes(choice.id) ? '#dbeafe' : 'white',
                              borderColor: editingQuestion.answer.includes(choice.id) ? '#2563eb' : '#d1d5db'
                            }}>
                            <input type={editingQuestion.type === 'single' ? 'radio' : 'checkbox'}
                              checked={editingQuestion.answer.includes(choice.id)}
                              onChange={() => {
                                if (editingQuestion.type === 'single') {
                                  setEditingQuestion({ ...editingQuestion, answer: [choice.id] });
                                } else {
                                  const newAnswer = editingQuestion.answer.includes(choice.id)
                                    ? editingQuestion.answer.filter(a => a !== choice.id)
                                    : [...editingQuestion.answer, choice.id];
                                  setEditingQuestion({ ...editingQuestion, answer: newAnswer });
                                }
                              }}
                              className="w-4 h-4" />
                            {choice.id}
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* 分类 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">分类/知识点</label>
                      <input className="input" placeholder="例如：电路基础"
                        value={editingQuestion.category}
                        onChange={e => setEditingQuestion({ ...editingQuestion, category: e.target.value })} />
                    </div>

                    {/* 难度 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">难度</label>
                      <select className="input"
                        value={editingQuestion.difficulty}
                        onChange={e => setEditingQuestion({ ...editingQuestion, difficulty: e.target.value as 'easy' | 'medium' | 'hard' })}>
                        <option value="easy">简单</option>
                        <option value="medium">中等</option>
                        <option value="hard">困难</option>
                      </select>
                    </div>

                    {/* 解析 */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-sm font-medium text-gray-700">答案解析</label>
                        <button
                          type="button"
                          onClick={() => { setMathKeyboardTarget('explanation'); setShowMathKeyboard(!showMathKeyboard); }}
                          className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 border border-blue-200"
                        >
                          📐 数学键盘
                        </button>
                      </div>
                      <textarea className="input" rows={2}
                        placeholder="请输入答案解析"
                        value={editingQuestion.explanation}
                        onChange={e => setEditingQuestion({ ...editingQuestion, explanation: e.target.value })}
                        onFocus={() => { setMathKeyboardTarget('explanation'); }}
                      />
                    </div>
                  </div>

                  {/* 数学键盘 */}
                  {showMathKeyboard && mathKeyboardTarget !== 'import' && (
                    <MathKeyboard
                      question={{
                        question: editingQuestion.question,
                        image: editingQuestion.image,
                        choices: editingQuestion.choices
                      }}
                      onQuestionChange={(q) => setEditingQuestion({
                        ...editingQuestion,
                        question: q.question,
                        image: q.image,
                        choices: q.choices
                      })}
                      onClose={() => setShowMathKeyboard(false)}
                    />
                  )}

                  <div className="flex gap-2 mt-6">
                    <button onClick={() => { setShowQuestionEditor(false); setEditingQuestion(null); setEditingQuestionIndex(-1); setShowMathKeyboard(false); }}
                      className="btn btn-secondary flex-1">取消</button>
                    <button onClick={handleSaveQuestion}
                      className="btn btn-primary flex-1">保存题目</button>
                  </div>
                </div>
              </div>
            )}

            {/* 题库列表 */}
            <div className="space-y-3">
              {banks.map(bank => (
                <div key={bank.id} className="card">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-gray-800">{bank.name}</span>
                        {bank.id === 'default' && (
                          <span className="badge text-xs" style={{ background: '#dcfce7', color: '#166534' }}>默认</span>
                        )}
                        <span className="badge text-xs" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                          {bank.questions.filter(q => q.type === 'single').length}单选 / {bank.questions.filter(q => q.type === 'multiple').length}多选
                        </span>
                      </div>
                      <p className="text-gray-500 text-sm">{bank.description}</p>
                      <p className="text-gray-400 text-xs mt-1">
                        创建于 {new Date(bank.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button onClick={() => handleEditBank(bank)}
                        className="text-blue-400 hover:text-blue-600 text-sm px-3 py-1 rounded-lg hover:bg-blue-50 transition-all">
                        编辑
                      </button>
                      {bank.id !== 'default' && bank.id !== 'bank_electrical' && bank.id !== 'bank_metering' && (
                        <button onClick={() => handleDeleteBank(bank.id)}
                          className="text-red-400 hover:text-red-600 text-sm px-3 py-1 rounded-lg hover:bg-red-50 transition-all">
                          删除
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 题目格式说明 */}
            <div className="card mt-4" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
              <h4 className="font-semibold text-amber-800 mb-2">📋 题目JSON格式说明</h4>
              <pre className="text-xs text-amber-700 overflow-auto">{`[
  {
    "type": "single",          // single=单选, multiple=多选
    "question": "题目内容",
    "choices": [
      {"id": "A", "text": "选项A"},
      {"id": "B", "text": "选项B"},
      {"id": "C", "text": "选项C"},
      {"id": "D", "text": "选项D"}
    ],
    "answer": ["A"],           // 多选：["A","C"]
    "explanation": "解析内容",
    "knowledge": "知识点说明",
    "category": "分类",
    "difficulty": "easy",      // easy/medium/hard
    "tags": ["标签1", "标签2"]
  }
]`}</pre>
            </div>
          </div>
        )}

        {/* 学习统计 */}
        {activeTab === 'stats' && stats && (
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">学习统计</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
              {[
                { label: '总练习次数', value: stats.totalExams, unit: '次', color: '#2563eb' },
                { label: '总答题数', value: stats.totalQuestions, unit: '题', color: '#7c3aed' },
                { label: '答对数量', value: stats.correctCount, unit: '题', color: '#10b981' },
                { label: '答错数量', value: stats.totalQuestions - stats.correctCount, unit: '题', color: '#ef4444' },
                { label: '综合正确率', value: accuracy, unit: '%', color: '#f59e0b' },
                { label: '待复习错题', value: stats.wrongQuestions.length, unit: '题', color: '#ec4899' },
              ].map((item, i) => (
                <div key={i} className="card text-center py-4">
                  <div className="text-2xl font-bold mb-1" style={{ color: item.color }}>
                    {item.value}<span className="text-base">{item.unit}</span>
                  </div>
                  <div className="text-gray-500 text-xs">{item.label}</div>
                </div>
              ))}
            </div>

            {/* 分类统计 */}
            {Object.keys(stats.categoryStats).length > 0 && (
              <div className="card mb-4">
                <h3 className="font-bold text-gray-800 mb-4">各类别掌握情况</h3>
                <div className="space-y-3">
                  {Object.entries(stats.categoryStats).map(([cat, data]) => {
                    const rate = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
                    return (
                      <div key={cat}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-gray-700">{cat}</span>
                          <span className="text-gray-500">{data.correct}/{data.total} ({rate}%)</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full transition-all"
                            style={{
                              width: `${rate}%`,
                              background: rate >= 80 ? '#10b981' : rate >= 60 ? '#f59e0b' : '#ef4444',
                            }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {stats.totalQuestions === 0 && (
              <div className="card text-center py-12 text-gray-400">
                <div className="text-5xl mb-4">📈</div>
                <div className="text-lg font-medium mb-2">还没有练习记录</div>
                <div className="text-sm">开始做题后，统计数据将在这里显示</div>
              </div>
            )}
          </div>
        )}

        <div className="pb-8" />

        {/* 题库选择弹窗 - 放在所有 tab 之外 */}
        {showBankSelect && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div className="card w-full max-w-md">
              <h3 className="font-bold text-lg mb-4">
                选择{selectedMode === 'practice' ? '练题' : '背题'}题库
              </h3>
              <div className="space-y-2">
                {banks.map(bank => (
                  <div
                    key={bank.id}
                    onClick={() => handleConfirmBank(bank.id)}
                    className="p-3 border rounded-lg cursor-pointer hover:bg-blue-50 hover:border-blue-400 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-gray-800">{bank.name}</span>
                        <span className="ml-2 text-xs text-gray-500">
                          {bank.questions.length}题
                        </span>
                      </div>
                      <span className="text-blue-500">→</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{bank.description}</p>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowBankSelect(false)}
                className="btn btn-secondary w-full mt-4">
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
