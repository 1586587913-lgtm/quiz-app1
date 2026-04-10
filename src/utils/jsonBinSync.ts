/**
 * JSONBin.io 云端同步模块
 * 使用 JSONBin 存储用户数据，支持跨设备同步
 * 不需要 GitHub Token，避免被 GitHub 安全扫描拦截
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

// 保存 JSONBin Master Key 到 localStorage
export function saveJsonBinKey(key: string): void {
  localStorage.setItem('jsonbin_key', key);
}

// 获取 JSONBin Master Key
export function getJsonBinKey(): string | null {
  return localStorage.getItem('jsonbin_key');
}

// 获取用户专属的 bin 名称
function getBinName(username: string): string {
  return `quiz_user_${username}`;
}

// 获取请求头
function getHeaders(): HeadersInit {
  const key = getJsonBinKey();
  if (!key) {
    throw new Error('未设置 JSONBin Key');
  }
  return {
    'Content-Type': 'application/json',
    'X-Master-Key': key,
  };
}

// 获取请求头（包含 JSONBin 秘密 key，用于写入）
function getWriteHeaders(): HeadersInit {
  const key = getJsonBinKey();
  if (!key) {
    throw new Error('未设置 JSONBin Key');
  }
  return {
    'Content-Type': 'application/json',
    'X-Master-Key': key,
    'X-Bin-Private': 'true',
  };
}

// 保存 bin 时需要读取的 key（公开读取）
function getReadHeaders(): HeadersInit {
  const key = getJsonBinKey();
  if (!key) {
    throw new Error('未设置 JSONBin Key');
  }
  return {
    'X-Master-Key': key,
  };
}

// 验证 JSONBin Key 是否有效
export async function validateJsonBinKey(key: string): Promise<{ valid: boolean; message?: string }> {
  try {
    // 尝试创建一个测试 bin 来验证 key
    const response = await fetch(`${JSONBIN_API}/b`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': key,
        'X-Bin-Private': 'true',
      },
      body: JSON.stringify({ test: 'validate' }),
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
        headers: { 'X-Master-Key': key },
      });
    }

    return { valid: true, message: 'Key 验证成功' };
  } catch (error) {
    console.error('验证 JSONBin Key 失败:', error);
    return { valid: false, message: '网络错误，请检查网络连接' };
  }
}

// 保存数据到 JSONBin（创建新 bin）
export async function createJsonBin(username: string, data: JsonBinUserData): Promise<string | null> {
  try {
    const binName = getBinName(username);
    const response = await fetch(`${JSONBIN_API}/b`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': getJsonBinKey()!,
        'X-Bin-Name': binName,
        'X-Bin-Private': 'true',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    const binId = result.metadata?.id;
    
    if (binId) {
      localStorage.setItem(`jsonbin_id_${username}`, binId);
    }
    
    return binId || null;
  } catch (error) {
    console.error('创建 JSONBin 失败:', error);
    return null;
  }
}

// 更新 JSONBin 数据
export async function updateJsonBin(binId: string, data: JsonBinUserData): Promise<boolean> {
  try {
    const response = await fetch(`${JSONBIN_API}/b/${binId}`, {
      method: 'PUT',
      headers: getWriteHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error('更新 JSONBin 失败:', error);
    return false;
  }
}

// 获取 JSONBin 数据
export async function fetchJsonBin(binId: string): Promise<JsonBinUserData | null> {
  try {
    const response = await fetch(`${JSONBIN_API}/b/${binId}/latest`, {
      headers: getReadHeaders(),
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

// 通过 bin 名称查找 bin ID
export async function findJsonBinByName(binName: string): Promise<string | null> {
  try {
    // JSONBin 通过名称搜索 API
    const response = await fetch(`${JSONBIN_API}/v3/bins?name=${encodeURIComponent(binName)}`, {
      headers: getReadHeaders(),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.bins && data.bins.length > 0) {
        // 找到匹配的 bin
        const matching = data.bins.find((b: any) => b.name === binName);
        return matching ? matching.id : (data.bins[0]?.id || null);
      }
    }
    return null;
  } catch {
    return null;
  }
}

// 获取用户的 bin ID（优先从 localStorage，兜底搜索）
export async function getUserBinId(username: string): Promise<string | null> {
  // 先从 localStorage 获取
  const cachedId = localStorage.getItem(`jsonbin_id_${username}`);
  if (cachedId) {
    return cachedId;
  }

  // 兜底：按名称查找
  const binName = getBinName(username);
  const binId = await findJsonBinByName(binName);
  if (binId) {
    localStorage.setItem(`jsonbin_id_${username}`, binId);
    return binId;
  }

  return null;
}

// 保存用户数据到 JSONBin
export async function saveToJsonBin(username: string, data: JsonBinUserData): Promise<boolean> {
  const binId = await getUserBinId(username);
  
  if (binId) {
    // 更新现有 bin
    return await updateJsonBin(binId, data);
  } else {
    // 创建新 bin
    const newBinId = await createJsonBin(username, data);
    return newBinId !== null;
  }
}

// 获取用户数据（从 JSONBin）
export async function getUserDataFromJsonBin(username: string): Promise<JsonBinUserData | null> {
  const binId = await getUserBinId(username);
  if (!binId) {
    return null;
  }
  
  return await fetchJsonBin(binId);
}
