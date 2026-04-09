// 测试新的云端同步逻辑
const API_KEY = '$2a$10$8cGYj4BIZxGZnHGNEPEn/eMdK48LEIe213mhYqBA96M/pJDRjZBpW';
const JSONBIN_API = 'https://api.jsonbin.io/v3';

function generateBinId(username, password) {
  let hash = 0;
  const str = username + ':' + password;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'q' + Math.abs(hash).toString(36).substring(0, 11);
}

async function testNewSync() {
  const username = 'testuser456';
  const password = 'pass123';
  const binId = generateBinId(username, password);
  
  console.log('=== 测试新同步逻辑 ===');
  console.log('用户名:', username);
  console.log('密码:', password);
  console.log('生成 bin ID:', binId);
  console.log('');

  // 1. 测试创建
  console.log('1. 测试创建 bin (PUT)...');
  const testData = {
    username,
    password,
    userId: 'u_123',
    banks: [{ id: 'b1', name: '测试题库' }],
    stats: { totalExams: 1 },
    masteredQuestions: [],
    wrongQuestions: [],
    lastSync: Date.now()
  };

  let response = await fetch(`${JSONBIN_API}/b/${binId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': API_KEY,
    },
    body: JSON.stringify(testData),
  });
  
  console.log('   PUT 状态:', response.status);
  
  if (response.status === 404) {
    // 创建
    console.log('   bin 不存在，尝试创建...');
    response = await fetch(`${JSONBIN_API}/b`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': API_KEY,
      },
      body: JSON.stringify(testData),
    });
    console.log('   POST 状态:', response.status);
    
    if (response.ok) {
      const result = await response.json();
      console.log('   创建成功，bin ID:', result.metadata.id);
    }
  }

  // 2. 测试读取
  console.log('\n2. 测试读取...');
  response = await fetch(`${JSONBIN_API}/b/${binId}/latest`, {
    headers: { 'X-Master-Key': API_KEY }
  });
  console.log('   状态:', response.status);
  
  if (response.ok) {
    const data = await response.json();
    console.log('   数据:', JSON.stringify(data.record).substring(0, 80) + '...');
  } else {
    console.log('   错误:', await response.text());
  }

  console.log('\n=== 测试完成 ===');
}

testNewSync().catch(console.error);
