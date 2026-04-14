import { useState, useEffect } from 'react';
import type { User, AppPage } from './types';
import type { Question } from './types';
import { getCurrentUser, setCurrentUser, initDefaultBank } from './utils/storage';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import PracticeMode from './pages/PracticeMode';
import ReviewMode from './pages/ReviewMode';
import ResultPage from './pages/ResultPage';
import WrongListPage from './pages/WrongListPage';

export default function App() {
  const [currentUser, setUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState<AppPage>('login');
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [currentBankId, setCurrentBankId] = useState<string>('');
  const [wrongPracticeQuestions, setWrongPracticeQuestions] = useState<Question[] | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      initDefaultBank(user.username); // 初始化当前用户的题库
      setUser(user);
      setCurrentPage('home');
    }
    setInitialized(true);
  }, []);

  const handleLogin = (user: User) => {
    initDefaultBank(user.username); // 初始化新登录用户的题库
    setUser(user);
    setCurrentPage('home');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setUser(null);
    setCurrentPage('login');
  };

  const handleNavigate = (page: AppPage, bankId?: string) => {
    // 如果 bankId 是题库ID（不是 sessionId），保存并使用
    if (bankId && page !== 'result' && page !== 'wrong-practice') {
      setCurrentBankId(bankId);
    } else if (bankId) {
      setCurrentSessionId(bankId);
    }
    setCurrentPage(page);
    if (page !== 'wrong-practice') setWrongPracticeQuestions(null);
  };

  const handlePracticeWrong = (questions: Question[]) => {
    setWrongPracticeQuestions(questions);
    setCurrentPage('wrong-practice');
  };

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f0f4f8' }}>
        <div className="text-center">
          <div className="text-4xl mb-3">⚡</div>
          <div className="text-gray-600">正在加载...</div>
        </div>
      </div>
    );
  }

  if (currentPage === 'login' || !currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (currentPage === 'home') {
    return <HomePage user={currentUser} onNavigate={handleNavigate} onLogout={handleLogout} />;
  }

  if (currentPage === 'practice') {
    return (
      <PracticeMode
        user={currentUser}
        onNavigate={handleNavigate}
        modeLabel="练题模式"
        bankId={currentBankId}
      />
    );
  }

  if (currentPage === 'wrong-practice' && wrongPracticeQuestions) {
    return (
      <PracticeMode
        user={currentUser}
        onNavigate={handleNavigate}
        questionsOverride={wrongPracticeQuestions}
        modeLabel="错题专练"
      />
    );
  }

  if (currentPage === 'review') {
    return <ReviewMode user={currentUser} onNavigate={handleNavigate} bankId={currentBankId} />;
  }

  if (currentPage === 'result' && currentSessionId) {
    return (
      <ResultPage
        user={currentUser}
        sessionId={currentSessionId}
        onNavigate={handleNavigate}
        onPracticeWrong={handlePracticeWrong}
      />
    );
  }

  if (currentPage === 'wrong-list') {
    return (
      <WrongListPage
        user={currentUser}
        onNavigate={handleNavigate}
        onPracticeWrong={handlePracticeWrong}
      />
    );
  }

  // 默认回首页
  return <HomePage user={currentUser} onNavigate={handleNavigate} onLogout={handleLogout} />;
}

