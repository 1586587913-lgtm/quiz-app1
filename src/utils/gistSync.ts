/**
 * GitHub Gist 云端同步模块
 * 
 * 使用 GitHub Gist 存储用户数据，支持跨设备同步
 * - 每个用户一个 Gist（通过描述中的用户名标识）
 * - 使用 GitHub Personal Access Token 认证
 * - 数据格式：JSON，存储在名为 "data.json" 的文件中
 */

const GITHUB_API = 'https://api.github.com';
const REQUEST_TIMEOUT = 10000; // 10秒超时
const GIST_FILE_NAME = 'data.json';
const GIST_DESCRIPTION_PREFIX = 'quiz_app_user_';

// 带超时的 fetch 封装
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout: number = REQUEST_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

// 获取 Token
function getToken(): string {
  return localStorage.getItem('github_token') || '';
}

// 设置 Token
export function setGithubToken(token: string): void {
  localStorage.setItem('github_token', token);
}

// 检查是否有 Token
export function hasGithubToken(): boolean {
  return !!getToken();
}

// 验证 Token 是否有效
export async function validateGithubToken(token: string): Promise<{ valid: boolean; message: string }> {
  try {
    const response = await fetchWithTimeout(`${GITHUB_API}/user`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    }, 8000);

    if (!response.ok) {
      if (response.status === 401) {
        return { valid: false, message: 'Token 无效或已过期' };
      }
      return { valid: false, message: `验证失败: ${response.status}` };
    }

    const userData = await response.json();
    return { 
      valid: true, 
      message: `Token 有效！GitHub 用户: ${userData.login}` 
    };
  } catch (e: any) {
    if (e.name === 'AbortError') {
      return { valid: false, message: '连接超时，请检查网络' };
    }
    return { valid: false, message: `连接失败: ${e.message}` };
  }
}

// 获取用户的 Gist ID（从 localStorage 缓存）
function getCachedGistId(username: string): string | null {
  return localStorage.getItem(`gist_id_${username}`) || null;
}

// 缓存 Gist ID
function cacheGistId(username: string, gistId: string): void {
  localStorage.setItem(`gist_id_${username}`, gistId);
}

// 搜索用户的 Gist（通过描述）
async function findUserGist(username: string, token: string): Promise<string | null> {
  try {
    // 列出所有认证用户的 gists，查找匹配的
    const response = await fetchWithTimeout(`${GITHUB_API}/gists?per_page=100`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      console.error('搜索 Gist 失败:', response.status);
      return null;
    }

    const gists = await response.json();
    
    // 查找描述包含 quiz_app_user_{username} 的 Gist
    const targetGist = gists.find((g: any) => 
      g.description === `${GIST_DESCRIPTION_PREFIX}${username}`
    );
    
    return targetGist?.id || null;
  } catch (e) {
    console.error('搜索 Gist 出错:', e);
    return null;
  }
}

/**
 * 同步用户数据到云端（改用username作为key，确保同一账号数据一致）
 */
export async function syncToGist(username: string): Promise<boolean> {
  const token = getToken();
  if (!token) {
    console.log('未配置 GitHub Token');
    return false;
  }

  try {
    // 收集本地数据（用username作为key）
    const bankKey = `quiz_banks_${username}`;
    const bankData = localStorage.getItem(bankKey);
    console.log('📦 原始数据检查:', {
      bankKey,
      bankDataLength: bankData?.length || 0,
    });
    
    const banks = JSON.parse(bankData || '[]');
    const allStats = JSON.parse(localStorage.getItem('quiz_stats') || '{}');
    // 统计数据的key也改为username
    const stats = allStats[username] || {};
    const masteredQuestions = JSON.parse(localStorage.getItem('masteredQuestions') || '[]');
    // 获取密码
    const password = localStorage.getItem(`pwd_${username}`) || '';

    const cloudData = {
      username,
      password, // 添加密码到云端
      banks,
      stats,
      masteredQuestions,
      wrongQuestions: stats.wrongQuestions || [],
      lastSync: Date.now(),
    };

    // 调试日志
    console.log('🔄 同步数据详情:', {
      username,
      banksCount: banks.length,
      banksDataLength: JSON.stringify(banks).length,
      statsKeys: Object.keys(stats),
      masteredCount: masteredQuestions.length,
      cloudDataSize: JSON.stringify(cloudData).length,
    });

    const jsonData = JSON.stringify(cloudData, null, 2);

    // 先尝试找已有的 Gist
    let gistId = getCachedGistId(username) || await findUserGist(username, token);

    if (gistId) {
      // 更新已有 Gist
      console.log('更新 Gist:', gistId);
      
      const response = await fetchWithTimeout(`${GITHUB_API}/gists/${gistId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          files: {
            [GIST_FILE_NAME]: {
              content: jsonData,
            },
          },
        }),
      });

      if (response.ok) {
        console.log('✅ Gist 更新成功');
        return true;
      } else {
        const errText = await response.text();
        console.error('更新 Gist 失败:', response.status, errText);
        // 如果 Gist 不存在了，清除缓存重新创建
        if (response.status === 404) {
          cacheGistId(username, '');
          gistId = null;
        } else {
          return false;
        }
      }
    }

    // 创建新 Gist
    console.log('创建新 Gist...');
    const createResponse = await fetchWithTimeout(`${GITHUB_API}/gists`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        description: `${GIST_DESCRIPTION_PREFIX}${username}`,
        public: false,
        files: {
          [GIST_FILE_NAME]: {
            content: jsonData,
          },
        },
      }),
    });

    if (!createResponse.ok) {
      const errText = await createResponse.text();
      console.error('创建 Gist 失败:', createResponse.status, errText);
      return false;
    }

    const newGist = await createResponse.json();
    cacheGistId(username, newGist.id);
    console.log('✅ Gist 创建成功:', newGist.id);
    return true;

  } catch (e: any) {
    console.error('同步到 Gist 出错:', e);
    return false;
  }
}

/**
 * 从云端获取用户数据
 */
export async function getGistData(username: string): Promise<any | null> {
  const token = getToken();
  if (!token) {
    console.log('未配置 GitHub Token');
    return null;
  }

  try {
    let gistId = getCachedGistId(username) || await findUserGist(username, token);
    
    if (!gistId) {
      console.log('云端未找到用户数据');
      return null;
    }

    const response = await fetchWithTimeout(`${GITHUB_API}/gists/${gistId}`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log('Gist 不存在');
        cacheGistId(username, '');
        return null;
      }
      console.error('获取 Gist 失败:', response.status);
      return null;
    }

    const gist = await response.json();
    console.log('📦 Gist 数据详情:', {
      gistId: gist.id,
      filesKeys: Object.keys(gist.files || {}),
      allFiles: Object.keys(gist.files || {}).map(k => ({
        filename: k,
        contentLength: gist.files[k]?.content?.length || 0,
        contentPreview: gist.files[k]?.content?.substring(0, 100) || 'empty'
      }))
    });
    
    const fileContent = gist.files?.[GIST_FILE_NAME]?.content;
    
    if (!fileContent) {
      console.log('Gist 中没有数据文件:', GIST_FILE_NAME);
      return null;
    }

    const data = JSON.parse(fileContent);
    console.log('✅ 从 Gist 获取数据成功, 题库数:', data.banks?.length || 0);
    return data;

  } catch (e: any) {
    console.error('获取 Gist 数据出错:', e);
    return null;
  }
}

// 导出私有函数供 storage.ts 使用
export { getCachedGistId, findUserGist, getToken };
