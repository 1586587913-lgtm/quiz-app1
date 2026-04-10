/**
 * JSONBin.io 云端同步模块
 * 使用 JSONBin 存储用户数据，支持跨设备同步
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

// 固定的 bin 名称（用于跨设备访问）
const BIN_NAME = 'quiz_user_data';

// 保存 JSONBin Master Key 到 localStorage
export function saveJsonBinKey(key: string): void {
  localStorage.setItem('jsonbin_key', key);
}

// 获取 JSONBin Master Key
export function getJsonBinKey(): string | null {
  return localStorage.getItem('jsonbin_key');
}

// 保存 bin ID（使用固定 key，新设备也能访问）
export function saveBinId(binId: string): void {
  localStorage.setItem('quiz_jsonbin_id', binId);
}

// 获取 bin ID
export function getBinId(): string | null {
  return localStorage.getItem('quiz_jsonbin_id');
}

// 获取请求头（用于写入）
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

// 获取请求头（用于读取）
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
    const response = await fetch(`${JSONBIN_API}/b`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': key,
        'X-Bin-Name': 'key_validation_test',
      },
      body: JSON.stringify({ test: Date.now() }),
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

// 创建或获取 bin（使用固定名称）
async function getOrCreateBin(): Promise<string | null> {
  const key = getJsonBinKey();
  if (!key) return null;

  try {
    // 先尝试读取现有的 bin（通过名称）
    const response = await fetch(`${JSONBIN_API}/b/by-name/${BIN_NAME}`, {
      headers: getReadHeaders(),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.metadata?.id) {
        saveBinId(data.metadata.id);
        return data.metadata.id as string;
      }
    }

    // 不存在，创建新 bin
    const createResponse = await fetch(`${JSONBIN_API}/b`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': key,
        'X-Bin-Name': BIN_NAME,
        'X-Bin-Private': 'true',
      },
      body: JSON.stringify({}),
    });

    if (createResponse.ok) {
      const result = await createResponse.json();
      const binId = result.metadata?.id;
      if (binId) {
        saveBinId(binId);
        return binId;
      }
    }

    return null;
  } catch (error) {
    console.error('获取/创建 bin 失败:', error);
    return null;
  }
}

// 保存数据到 JSONBin
export async function saveToJsonBin(data: JsonBinUserData): Promise<boolean> {
  const key = getJsonBinKey();
  if (!key) {
    console.error('未设置 JSONBin Key');
    return false;
  }

  try {
    // 获取或创建 bin
    let binId = getBinId();
    if (!binId) {
      binId = await getOrCreateBin();
    }
    if (!binId) {
      console.error('无法获取 bin ID');
      return false;
    }

    // 更新 bin 数据
    const response = await fetch(`${JSONBIN_API}/b/${binId}`, {
      method: 'PUT',
      headers: getWriteHeaders(),
      body: JSON.stringify(data),
    });

    return response.ok;
  } catch (error) {
    console.error('保存到 JSONBin 失败:', error);
    return false;
  }
}

// 获取用户数据（从 JSONBin）
export async function getUserDataFromJsonBin(): Promise<JsonBinUserData | null> {
  const key = getJsonBinKey();
  if (!key) return null;

  try {
    // 先检查是否有缓存的 binId
    let binId = getBinId();

    // 如果没有 binId，尝试通过名称查找
    if (!binId) {
      const response = await fetch(`${JSONBIN_API}/b/by-name/${BIN_NAME}`, {
        headers: getReadHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
      if (data.metadata?.id) {
        binId = data.metadata.id as string;
        saveBinId(binId);
      }
      }
    }

    if (!binId) {
      console.log('JSONBin 中没有找到用户数据');
      return null;
    }

    // 获取数据
    const response = await fetch(`${JSONBIN_API}/b/${binId}/latest`, {
      headers: getReadHeaders(),
    });

    if (!response.ok) {
      if (response.status === 404) {
        // bin 不存在，清除缓存的 binId
        localStorage.removeItem('quiz_jsonbin_id');
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
