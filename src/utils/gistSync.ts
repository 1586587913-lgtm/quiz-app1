/**
 * GitHub Gist 云端同步模块
 * 使用 GitHub Gist 存储用户数据，支持跨设备同步
 */

const GIST_API = 'https://api.github.com/gists';

// 用户数据接口
export interface GistUserData {
  username: string;
  password: string;
  userId: string;
  banks: any[];
  stats: any;
  masteredQuestions: any[];
  wrongQuestions: any[];
  lastSync: number;
}

// 保存 GitHub Token 到 localStorage
export function saveGithubToken(token: string): void {
  localStorage.setItem('github_token', token);
}

// 获取 GitHub Token
export function getGithubToken(): string | null {
  return localStorage.getItem('github_token');
}

// 获取用户对应的 Gist ID
function getGistIdKey(username: string): string {
  return `gist_id_${username}`;
}

// 获取用户的 Gist ID
function getUserGistId(username: string): string | null {
  return localStorage.getItem(getGistIdKey(username));
}

// 保存用户的 Gist ID
function saveUserGistId(username: string, gistId: string): void {
  localStorage.setItem(getGistIdKey(username), gistId);
}

// 获取请求头
function getHeaders(): HeadersInit {
  const token = getGithubToken();
  if (!token) {
    throw new Error('未设置 GitHub Token');
  }
  return {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

// 获取 Gist 内容
export async function fetchGist(gistId: string): Promise<GistUserData | null> {
  try {
    const response = await fetch(`${GIST_API}/${gistId}`, {
      headers: getHeaders()
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const content = data.files['quiz_data.json']?.content;
    
    if (content) {
      return JSON.parse(content) as GistUserData;
    }
    return null;
  } catch (error) {
    console.error('获取 Gist 数据失败:', error);
    return null;
  }
}

// 列出用户的所有 Gist，查找对应的 Quiz App Gist
export async function findUserGist(username: string): Promise<string | null> {
  try {
    const response = await fetch(`${GIST_API}?per_page=100`, {
      headers: getHeaders()
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const gists = await response.json();
    
    // 查找描述包含用户名和 quiz_sync_ 的 Gist
    const targetGist = gists.find((gist: any) => 
      gist.description && 
      gist.description.includes('quiz_sync_') &&
      gist.description.includes(username)
    );

    return targetGist ? targetGist.id : null;
  } catch (error) {
    console.error('查找用户 Gist 失败:', error);
    return null;
  }
}

// 创建新的 Gist
export async function createGist(username: string, data: GistUserData): Promise<string | null> {
  try {
    const response = await fetch(GIST_API, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        description: `quiz_sync_${username}_${Date.now()}`,
        public: false,
        files: {
          'quiz_data.json': {
            content: JSON.stringify(data, null, 2)
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    const gistId = result.id;
    
    // 保存 Gist ID
    saveUserGistId(username, gistId);
    
    return gistId;
  } catch (error) {
    console.error('创建 Gist 失败:', error);
    return null;
  }
}

// 更新 Gist
export async function updateGist(gistId: string, data: GistUserData): Promise<boolean> {
  try {
    const response = await fetch(`${GIST_API}/${gistId}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({
        files: {
          'quiz_data.json': {
            content: JSON.stringify(data, null, 2)
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error('更新 Gist 失败:', error);
    return false;
  }
}

// 保存用户数据到 Gist
export async function saveToGist(username: string, data: GistUserData): Promise<boolean> {
  const gistId = getUserGistId(username);
  
  if (gistId) {
    // 更新现有 Gist
    return await updateGist(gistId, data);
  } else {
    // 创建新 Gist
    const newGistId = await createGist(username, data);
    return newGistId !== null;
  }
}

// 获取用户数据（从 Gist 或本地）
export async function getUserDataFromGist(username: string, password: string): Promise<GistUserData | null> {
  // 先尝试本地存储的 Gist ID
  let gistId = getUserGistId(username);
  
  // 如果没有，查找用户的 Gist
  if (!gistId) {
    console.log('本地未找到 Gist ID，搜索用户的 Gist...');
    gistId = await findUserGist(username);
    if (gistId) {
      saveUserGistId(username, gistId);
    }
  }
  
  if (!gistId) {
    return null;
  }
  
  const data = await fetchGist(gistId);
  
  // 验证密码
  if (data && data.password !== password) {
    console.log('Gist 密码验证失败');
    return null;
  }
  
  return data;
}

// 检查 GitHub Token 是否有效
export async function validateGithubToken(): Promise<{valid: boolean, username?: string}> {
  try {
    const token = getGithubToken();
    if (!token) {
      return { valid: false };
    }
    
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github+json'
      }
    });
    
    if (!response.ok) {
      return { valid: false };
    }
    
    const user = await response.json();
    return { valid: true, username: user.login };
  } catch (error) {
    console.error('验证 Token 失败:', error);
    return { valid: false };
  }
}

// 检查 Gist 是否存在
export async function checkGistExists(username: string): Promise<boolean> {
  const gistId = getUserGistId(username);
  if (!gistId) {
    return false;
  }
  
  try {
    const response = await fetch(`${GIST_API}/${gistId}`, {
      method: 'HEAD',
      headers: getHeaders()
    });
    return response.ok;
  } catch {
    return false;
  }
}
