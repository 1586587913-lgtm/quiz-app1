/**
 * JSONBin.io 云端同步模块
 * 使用 JSONBin 存储用户数据，支持跨设备同步
 * 
 * 同步策略：
 * - 每个用户有独立的 bin，bin 名称 = "quiz_user_{username}"
 * - 使用 X-Access-Key 访问（安全）
 */

const JSONBIN_API = 'https://api.jsonbin.io/v3';

// 用户数据接口
export interface JsonBinUserData {
  username: string;
  userId: string;
  banks: any[];
  stats: any;
  masteredQuestions: any[];
  wrongQuestions: any[];
  lastSync: number;
}

// 获取用户专属的 bin 名称
function getUserBinName(username: string): string {
  return `quiz_user_${username}`;
}

// 保存 JSONBin Access Key 到 localStorage
export function saveJsonBinKey(key: string): void {
  localStorage.setItem('jsonbin_key', key);
}

// 获取 JSONBin Access Key
export function getJsonBinKey(): string | null {
  return localStorage.getItem('jsonbin_key');
}

// 获取请求头
function getHeaders(): HeadersInit {
  const key = getJsonBinKey();
  if (!key) {
    throw new Error('未设置 JSONBin Key');
  }
  return {
    'Content-Type': 'application/json',
    'X-Access-Key': key,
  };
}

// 验证 JSONBin Key 是否有效
export async function validateJsonBinKey(key: string): Promise<{ valid: boolean; message?: string }> {
  try {
    // 用这个 Key 创建/获取 bin 来验证
    const response = await fetch(`${JSONBIN_API}/b`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Access-Key': key,
        'X-Bin-Name': 'key_validation_test_' + Date.now(),
      },
      body: JSON.stringify({ test: true }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { valid: false, message: 'Key 无效或已过期' };
      }
      return { valid: false, message: `请求失败: ${response.status}` };
    }

    const data = await response.json();
    // 删除测试 bin
    if (data.metadata?.id) {
      await fetch(`${JSONBIN_API}/b/${data.metadata.id}`, {
        method: 'DELETE',
        headers: { 'X-Access-Key': key },
      });
    }

    return { valid: true, message: 'Key 验证成功' };
  } catch (error) {
    console.error('验证 JSONBin Key 失败:', error);
    return { valid: false, message: '网络错误，请检查网络连接' };
  }
}

// 获取用户的 bin（通过用户名查找）
async function getUserBin(username: string): Promise<string | null> {
  const key = getJsonBinKey();
  if (!key) return null;

  try {
    const binName = getUserBinName(username);
    const response = await fetch(`${JSONBIN_API}/b/by-name/${binName}`, {
      headers: getHeaders(),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.metadata?.id) {
        return data.metadata.id as string;
      }
    }
    return null;
  } catch (error) {
    console.error('查找用户 bin 失败:', error);
    return null;
  }
}

// 创建用户的 bin
async function createUserBin(username: string): Promise<string | null> {
  const key = getJsonBinKey();
  if (!key) return null;

  try {
    const binName = getUserBinName(username);
    const response = await fetch(`${JSONBIN_API}/b`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Access-Key': key,
        'X-Bin-Name': binName,
      },
      body: JSON.stringify({
        username,
        userId: '',
        banks: [],
        stats: {},
        masteredQuestions: [],
        wrongQuestions: [],
        lastSync: Date.now(),
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.metadata?.id) {
        return data.metadata.id as string;
      }
    }
    return null;
  } catch (error) {
    console.error('创建用户 bin 失败:', error);
    return null;
  }
}

// 保存用户数据到 JSONBin
export async function saveUserData(username: string, userId: string, banks: any[], stats: any, masteredQuestions: any[], wrongQuestions: any[]): Promise<boolean> {
  const key = getJsonBinKey();
  if (!key) {
    console.error('未设置 JSONBin Key');
    return false;
  }

  try {
    // 先尝试获取现有 bin
    let binId = await getUserBin(username);

    // 如果没有，创建新 bin
    if (!binId) {
      binId = await createUserBin(username);
    }

    if (!binId) {
      console.error('无法获取/创建用户 bin');
      return false;
    }

    // 准备数据
    const data: JsonBinUserData = {
      username,
      userId,
      banks,
      stats,
      masteredQuestions,
      wrongQuestions,
      lastSync: Date.now(),
    };

    // 更新 bin 数据
    const response = await fetch(`${JSONBIN_API}/b/${binId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });

    if (response.ok) {
      console.log('数据已同步到云端');
      return true;
    } else {
      console.error('同步失败:', response.status);
      return false;
    }
  } catch (error) {
    console.error('保存到 JSONBin 失败:', error);
    return false;
  }
}

// 获取用户数据（从 JSONBin）
export async function getUserDataFromJsonBin(username: string): Promise<JsonBinUserData | null> {
  const key = getJsonBinKey();
  if (!key) return null;

  try {
    const binId = await getUserBin(username);

    if (!binId) {
      console.log('JSONBin 中没有找到用户数据');
      return null;
    }

    // 获取数据
    const response = await fetch(`${JSONBIN_API}/b/${binId}/latest`, {
      headers: getHeaders(),
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data.record) {
      return data.record as JsonBinUserData;
    }
    return null;
  } catch (error) {
    console.error('获取 JSONBin 数据失败:', error);
    return null;
  }
}

// 检查用户数据是否存在
export async function hasUserDataInCloud(username: string): Promise<boolean> {
  const binId = await getUserBin(username);
  return binId !== null;
}
