import { useState, useRef, useEffect } from 'react';
import { register, login, setCurrentUser, downloadExportData, importUserData, loginWithCloudSync, registerWithCloudSync } from '../utils/storage';
import { saveGithubToken, getGithubToken, validateGithubToken } from '../utils/gistSync';
import type { User } from '../types';

interface LoginPageProps {
  onLogin: (user: User) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', displayName: '', confirm: '' });
  const [githubToken, setGithubToken] = useState('');
  const [tokenError, setTokenError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 预设的 GitHub Token（用于云端同步）
  const DEFAULT_GITHUB_TOKEN = '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';
  
  // 初始化时检查已有的 GitHub Token，若无则使用默认值
  useEffect(() => {
    const savedToken = getGithubToken();
    if (savedToken) {
      setGithubToken(savedToken);
    } else {
      // 自动填充预设 Token 并保存
      setGithubToken(DEFAULT_GITHUB_TOKEN);
      saveGithubToken(DEFAULT_GITHUB_TOKEN);
    }
  }, []);

  // 验证 GitHub Token
  const handleVerifyToken = async () => {
    if (!githubToken.trim()) {
      setTokenError('请输入 GitHub Token');
      return;
    }
    
    setTokenError('');
    saveGithubToken(githubToken.trim());
    
    const result = await validateGithubToken();
    if (result.valid) {
      setTokenError('');
      alert(`✅ Token 验证成功！GitHub 用户名: ${result.username}`);
    } else {
      setTokenError('❌ Token 无效，请检查后重试');
      saveGithubToken(''); // 清除无效的 token
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      if (isRegister) {
        if (!form.username || !form.password || !form.displayName) {
          setError('请填写所有字段');
          setLoading(false);
          return;
        }
        if (form.password !== form.confirm) {
          setError('两次密码不一致');
          setLoading(false);
          return;
        }
        if (form.password.length < 4) {
          setError('密码至少4位');
          setLoading(false);
          return;
        }
        
        // 注册并同步到 GitHub Gist（自动使用预设 Token）
        const user = await registerWithCloudSync(form.username, form.password, form.displayName);
        if (!user) {
          setError('注册失败，请稍后重试');
          setLoading(false);
          return;
        }
        setCurrentUser(user);
        onLogin(user);
      } else {
        if (!form.username || !form.password) {
          setError('请输入用户名和密码');
          setLoading(false);
          return;
        }
        
        // 登录并从 GitHub Gist 同步数据（自动使用预设 Token）
        const user = await loginWithCloudSync(form.username, form.password);
        if (!user) {
          setError('用户名或密码错误');
          setLoading(false);
          return;
        }
        setCurrentUser(user);
        onLogin(user);
      }
    } catch (err) {
      setError('网络异常，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  // 快速体验（游客登录）
  const guestLogin = () => {
    const guestUser: User = {
      id: 'guest',
      username: 'guest',
      displayName: '体验用户',
      createdAt: Date.now(),
    };
    setCurrentUser(guestUser);
    onLogin(guestUser);
  };

  const handleExport = () => {
    downloadExportData();
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImportStatus('正在导入...');
    const result = await importUserData(file);
    setImportStatus(result.message);
    
    if (result.success) {
      alert(result.message + '\n请重新登录查看导入的数据。');
      setTimeout(() => window.location.reload(), 1000);
    }
    
    e.target.value = '';
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #3730a3 40%, #4c1d95 100%)' }}>
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="absolute rounded-full opacity-10"
            style={{
              width: `${120 + i * 60}px`,
              height: `${120 + i * 60}px`,
              background: 'white',
              top: `${10 + i * 12}%`,
              left: `${5 + i * 14}%`,
              animation: `pulse ${3 + i}s infinite alternate`,
            }} />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Logo & 标题 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-4"
            style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)' }}>
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
              <circle cx="22" cy="22" r="20" stroke="white" strokeWidth="2.5"/>
              <path d="M14 22L20 28L30 16" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">智能刷题系统</h1>
          <p className="text-blue-200 text-sm">专业题库 · 智能练习 · 高效备考</p>
        </div>

        {/* 表单卡片 */}
        <div className="card" style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)' }}>
          {/* Tab 切换 */}
          <div className="flex mb-6 rounded-lg overflow-hidden bg-gray-100 p-1">
            <button
              onClick={() => { setIsRegister(false); setError(''); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${!isRegister ? 'bg-white text-blue-600 shadow' : 'text-gray-500'}`}>
              登录
            </button>
            <button
              onClick={() => { setIsRegister(true); setError(''); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${isRegister ? 'bg-white text-blue-600 shadow' : 'text-gray-500'}`}>
              注册
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* GitHub Token 输入 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                GitHub Token
                <span className="text-xs text-gray-400 ml-1">(必填，用于云端同步)</span>
              </label>
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  type="password"
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  value={githubToken}
                  onChange={e => setGithubToken(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleVerifyToken}
                  className="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg whitespace-nowrap">
                  验证
                </button>
              </div>
              {tokenError && (
                <p className="text-xs text-red-500 mt-1">{tokenError}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                需要 GitHub 账号，在 
                <a 
                  href="https://github.com/settings/tokens" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                  onClick={e => e.stopPropagation()}
                >
                  这里
                </a>
                创建 Token，勾选 gist 权限
              </p>
            </div>

            {isRegister && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">昵称</label>
                <input
                  className="input"
                  placeholder="请输入显示昵称"
                  value={form.displayName}
                  onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
              <input
                className="input"
                placeholder="请输入用户名"
                value={form.username}
                autoComplete="username"
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
              <input
                className="input"
                type="password"
                placeholder="请输入密码"
                value={form.password}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              />
            </div>
            {isRegister && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">确认密码</label>
                <input
                  className="input"
                  type="password"
                  placeholder="请再次输入密码"
                  value={form.confirm}
                  autoComplete="new-password"
                  onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                />
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg text-sm text-red-600"
                style={{ background: '#fee2e2' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0-1A6 6 0 1 0 8 2a6 6 0 0 0 0 12zm-.5-4h1v1h-1v-1zm0-6h1v5h-1V4z"/>
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full py-3 text-base"
              style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)' }}>
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="animate-spin" width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <circle cx="9" cy="9" r="7" stroke="white" strokeWidth="2" strokeDasharray="30" strokeDashoffset="10"/>
                  </svg>
                  {isRegister ? '注册并同步...' : '登录并同步...'}
                </span>
              ) : (isRegister ? '注册并登录' : '登录')}
            </button>
          </form>

          <div className="mt-4 text-center">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <span className="relative bg-white px-3 text-xs text-gray-400">或</span>
            </div>
            <button
              onClick={guestLogin}
              className="mt-3 w-full btn btn-secondary py-2.5">
              快速体验（无需注册）
            </button>
          </div>

          {/* 数据备份（导出/导入） */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="text-xs text-gray-500 mb-2 text-center">数据备份</div>
            <div className="flex gap-2">
              <button
                onClick={handleExport}
                className="flex-1 btn btn-secondary py-2 text-xs">
                📤 备份
              </button>
              <button
                onClick={handleImportClick}
                className="flex-1 btn btn-secondary py-2 text-xs">
                📥 恢复
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="hidden"
            />
            {importStatus && (
              <div className="mt-2 text-xs text-center text-blue-600">{importStatus}</div>
            )}
            <div className="mt-2 text-xs text-gray-400 text-center">
              自动云端同步 · 备份可跨设备恢复
            </div>
          </div>

          {/* 数据异常修复按钮 */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={() => {
                if (confirm('此操作将清除所有用户数据和题库数据，确定要继续吗？')) {
                  localStorage.removeItem('quiz_users');
                  localStorage.removeItem('quiz_stats');
                  localStorage.removeItem('quiz_banks');
                  localStorage.removeItem('quiz_sessions');
                  localStorage.removeItem('quiz_mastered');
                  // 清除所有密码记录
                  Object.keys(localStorage).forEach(key => {
                    if (key.startsWith('pwd_')) localStorage.removeItem(key);
                  });
                  alert('数据已清除，请刷新页面重新注册');
                  window.location.reload();
                }
              }}
              className="w-full text-xs text-gray-400 hover:text-red-500 py-1">
              清除异常数据并重新开始
            </button>
          </div>
        </div>

        <p className="text-center text-blue-200 text-xs mt-4 opacity-70">
          云端同步 · 多设备通用 · 安全可靠
        </p>
      </div>
    </div>
  );
}
