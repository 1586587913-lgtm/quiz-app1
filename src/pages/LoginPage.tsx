import { useState, useEffect } from 'react';
import { register, login, setCurrentUser, loginWithCloudSync, registerWithCloudSync, type LoginResult, syncToGist } from '../utils/storage';
import { 
  setGithubToken as saveGithubToken, 
  hasGithubToken,
  validateGithubToken
} from '../utils/gistSync';
import type { User, QuestionBank } from '../types';

interface LoginPageProps {
  onLogin: (user: User) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', displayName: '', confirm: '' });
  const [githubToken, setGithubToken] = useState('');
  const [tokenStatus, setTokenStatus] = useState<'none' | 'validating' | 'ok' | 'error'>('none');
  const [tokenMsg, setTokenMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // 数据冲突状态
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictData, setConflictData] = useState<LoginResult['conflict']>(undefined);
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  
  // 初始化时检查已有的 GitHub Token
  useEffect(() => {
    // 检查 localStorage 中是否有保存的 token
    const savedToken = localStorage.getItem('github_token');
    if (savedToken) {
      setGithubToken(savedToken);
      setTokenStatus('ok');
      setTokenMsg('✅ 已配置');
    }
  }, []);

  // 验证 GitHub Token
  const handleVerifyToken = async () => {
    if (!githubToken.trim()) {
      setTokenStatus('error');
      setTokenMsg('❌ 请输入 GitHub Token');
      return;
    }
    
    setTokenStatus('validating');
    setTokenMsg('⏳ 验证中...');
    
    const result = await validateGithubToken(githubToken.trim());
    
    if (result.valid) {
      saveGithubToken(githubToken.trim());
      setTokenStatus('ok');
      setTokenMsg(`✅ ${result.message}`);
    } else {
      setTokenStatus('error');
      setTokenMsg(`❌ ${result.message}`);
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
        
        const result = await loginWithCloudSync(form.username, form.password);
        if (!result.user) {
          setError('用户名或密码错误');
          setLoading(false);
          return;
        }
        
        // 检查是否有数据冲突
        if (result.conflict) {
          setConflictData(result.conflict);
          setPendingUser(result.user);
          setShowConflictModal(true);
          setLoading(false);
          return;
        }
        
        setCurrentUser(result.user);
        onLogin(result.user);
      }
    } catch (err) {
      setError('网络异常，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  // 处理数据冲突 - 使用本地数据
  const handleKeepLocalData = async () => {
    if (!pendingUser || !conflictData) return;
    
    // 保存本地数据到 localStorage（已经是本地数据，无需操作）
    // 直接同步到云端覆盖
    await syncToGist(pendingUser.username);
    
    setShowConflictModal(false);
    setConflictData(undefined);
    setPendingUser(null);
    setCurrentUser(pendingUser);
    onLogin(pendingUser);
  };

  // 处理数据冲突 - 使用云端数据
  const handleKeepCloudData = async () => {
    if (!pendingUser || !conflictData) return;
    
    // 用云端数据覆盖本地数据
    localStorage.setItem(`quiz_banks_${pendingUser.username}`, JSON.stringify(conflictData.cloudBanks));
    
    setShowConflictModal(false);
    setConflictData(undefined);
    setPendingUser(null);
    setCurrentUser(pendingUser);
    onLogin(pendingUser);
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

  // 计算本地和云端的题目总数
  const localTotal = conflictData?.localBanks.reduce((sum, b) => sum + (b.questions?.length || 0), 0) || 0;
  const cloudTotal = conflictData?.cloudBanks.reduce((sum, b) => sum + (b.questions?.length || 0), 0) || 0;

  return (
    <>
      {/* 数据冲突弹窗 */}
      {showConflictModal && conflictData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">
              ⚠️ 检测到数据冲突
            </h3>
            <p className="text-gray-600 text-sm mb-4 text-center">
              本地和云端都有题库数据，请选择保留哪个
            </p>
            
            <div className="space-y-3 mb-6">
              {/* 本地数据 */}
              <div 
                className="p-4 border-2 border-blue-200 rounded-xl hover:border-blue-400 cursor-pointer transition-all"
                onClick={handleKeepLocalData}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-blue-800">💻 保留本地数据</span>
                  <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">
                    {localTotal} 题
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {conflictData.localBanks.length} 个题库 · 来自当前设备
                </p>
              </div>
              
              {/* 云端数据 */}
              <div 
                className="p-4 border-2 border-green-200 rounded-xl hover:border-green-400 cursor-pointer transition-all"
                onClick={handleKeepCloudData}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-green-800">☁️ 保留云端数据</span>
                  <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded">
                    {cloudTotal} 题
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {conflictData.cloudBanks.length} 个题库 · 来自服务器
                </p>
              </div>
            </div>
            
            <p className="text-xs text-gray-400 text-center">
              选择后会自动同步到云端
            </p>
          </div>
        </div>
      )}

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
            {/* GitHub Token 输入（云端同步） */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                🔑 GitHub Token（用于云端同步）
                {tokenStatus === 'ok' && (
                  <span className="text-green-500 ml-2 text-xs">✅ 已配置</span>
                )}
                {tokenStatus === 'none' && (
                  <span className="text-orange-400 ml-2 text-xs">可选，配置后可跨设备同步</span>
                )}
              </label>
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  type="password"
                  placeholder="ghp_xxxxxxxxxxxx"
                  value={githubToken}
                  onChange={e => {
                    setGithubToken(e.target.value);
                    if (tokenStatus !== 'validating') setTokenStatus('none');
                  }}
                />
                <button
                  type="button"
                  onClick={handleVerifyToken}
                  disabled={tokenStatus === 'validating'}
                  className="px-3 py-2 text-xs bg-gray-800 hover:bg-gray-700 text-white rounded-lg whitespace-nowrap disabled:opacity-50">
                  {tokenStatus === 'validating' ? '验证中...' : '验证'}
                </button>
              </div>
              {tokenMsg && tokenStatus !== 'ok' && (
                <p className={`text-xs mt-1 ${tokenStatus === 'error' ? 'text-red-500' : 'text-blue-500'}`}>{tokenMsg}</p>
              )}
              {tokenStatus === 'ok' && (
                <p className="text-xs text-green-600 mt-1">{tokenMsg} 数据将自动同步到 GitHub Gist</p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                在 github.com/settings/tokens 创建，勾选 "gist" 权限
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
              ) : (hasGithubToken() ? (isRegister ? '注册并同步到云端' : '登录并同步数据') : (isRegister ? '注册并登录' : '登录'))}
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

          {/* GitHub Token 提示 */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="text-xs text-gray-400 text-center">
              {hasGithubToken() ? '✅ GitHub Gist 云端同步已启用' : '未配置 Token，数据仅保存在本地浏览器'}
            </div>
          </div>

          {/* 数据异常修复按钮 */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={() => {
                if (confirm('此操作将清除所有用户数据和题库数据，确定要继续吗？')) {
                  localStorage.removeItem('quiz_users');
                  localStorage.removeItem('quiz_stats');
                  // 清除所有用户专属题库
                  Object.keys(localStorage).forEach(key => {
                    if (key.startsWith('quiz_banks_')) localStorage.removeItem(key);
                    if (key.startsWith('pwd_')) localStorage.removeItem(key);
                  });
                  localStorage.removeItem('quiz_sessions');
                  localStorage.removeItem('quiz_mastered');
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
          {hasGithubToken() ? 'GitHub Gist 云端同步 · 多设备通用' : '数据本地存储 · 可选开启云端同步'}
        </p>
      </div>
    </div>
    </>
  );
}
