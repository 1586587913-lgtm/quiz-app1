// JSONBin 云端同步模块
// 使用 bin ID 存储，bin ID = bin_id_{username} 存储在本地

const JSONBIN_API = 'https://api.jsonbin.io/v3';

// 用户提供的 API Key
const API_KEY = '$2a$10$8cGYj4BIZxGZnHGNEPEn/eMdK48LEIe213mhYqBA96M/pJDRjZBpW';

export interface CloudWrongQuestion {
  questionId: string;
  wrongCount: number;
  lastWrongAt: number;
  lastUserAnswer: string[];
}

export interface CloudUserData {
  username: string;
  password: string;
  userId: string;
  banks: any[];
  stats: any;
  masteredQuestions: any[];
  wrongQuestions: CloudWrongQuestion[];
  lastSync: number;
}

// 用用户名+密码生成固定的 bin ID（用于新设备首次登录）
function generateBinId(username: string, password: string): string {
  let hash = 0;
  const str = username + ':' + password;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'q' + Math.abs(hash).toString(36).substring(0, 11);
}

// 获取本地保存的 bin ID
function getLocalBinId(username: string): string | null {
  return localStorage.getItem(`bin_id_${username}`);
}

// 保存 bin ID 到本地
function saveLocalBinId(username: string, binId: string) {
  localStorage.setItem(`bin_id_${username}`, binId);
}

// 从云端获取用户数据（通过 bin ID）
async function fetchByBinId(binId: string): Promise<CloudUserData | null> {
  try {
    const response = await fetch(`${JSONBIN_API}/b/${binId}/latest`, {
      headers: {
        'X-Master-Key': API_KEY,
      },
    });

    if (!response.ok) {
      return null;
    }

    const result = await response.json();
    return result.record as CloudUserData;
  } catch (error) {
    console.error('获取云端数据失败:', error);
    return null;
  }
}

// 从云端获取用户数据
export async function fetchCloudData(username: string, password: string): Promise<CloudUserData | null> {
  // 1. 先尝试用本地保存的 bin ID
  const localBinId = getLocalBinId(username);
  if (localBinId) {
    console.log('使用本地 bin ID:', localBinId);
    const data = await fetchByBinId(localBinId);
    if (data) return data;
  }

  // 2. 本地没有 bin ID，用用户名+密码生成一个
  const generatedBinId = generateBinId(username, password);
  console.log('尝试生成的 bin ID:', generatedBinId);
  const data = await fetchByBinId(generatedBinId);
  
  if (data) {
    // 保存这个 bin ID
    saveLocalBinId(username, generatedBinId);
  }
  
  return data;
}

// 保存用户数据到云端
export async function saveCloudData(data: CloudUserData): Promise<boolean> {
  try {
    // 1. 先尝试用本地保存的 bin ID
    let binId = getLocalBinId(data.username) || generateBinId(data.username, data.password);

    data.lastSync = Date.now();

    // 3. 尝试 PUT 更新
    let response = await fetch(`${JSONBIN_API}/b/${binId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': API_KEY,
      },
      body: JSON.stringify(data),
    });

    if (response.status === 404) {
      // bin 不存在，创建新的
      console.log('创建新的云端数据...');
      response = await fetch(`${JSONBIN_API}/b`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': API_KEY,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        console.error('创建云端数据失败:', response.status);
        return false;
      }

      // 获取创建的 bin ID 并保存
      const result = await response.json();
      binId = result.metadata.id;
    } else if (!response.ok) {
      console.error('更新云端数据失败:', response.status);
      return false;
    }

    // 4. 保存 bin ID 到本地
    saveLocalBinId(data.username, binId);
    console.log('保存 bin ID 到本地:', binId);

    return true;
  } catch (error) {
    console.error('保存云端数据失败:', error);
    return false;
  }
}

// 检查云端是否有数据
export async function hasCloudData(username: string, password: string): Promise<boolean> {
  const data = await fetchCloudData(username, password);
  return data !== null;
}

// 云端同步状态
export interface SyncStatus {
  lastSync: number | null;
  isSyncing: boolean;
  error: string | null;
}

let syncStatus: SyncStatus = {
  lastSync: null,
  isSyncing: false,
  error: null,
};

export function getSyncStatus(): SyncStatus {
  return { ...syncStatus };
}

export function setSyncStatus(status: Partial<SyncStatus>) {
  syncStatus = { ...syncStatus, ...status };
}
