// 云端同步测试脚本
const API_KEY = '$2a$10$8cGYj4BIZxGZnHGNEPEn/eMdK48LEIe213mhYqBA96M/pJDRjZBpW';
const JSONBIN_API = 'https://api.jsonbin.io/v3';

async function testCloudSync() {
  const username = 'test_sync_user_' + Date.now();
  const testData = {
    username: username,
    password: 'test123',
    userId: 'test_user_123',
    banks: [
      { id: 'bank1', name: '测试题库', questions: [] }
    ],
    stats: { totalExams: 1 },
    masteredQuestions: [],
    wrongQuestions: [],
    lastSync: Date.now()
  };

  console.log('=== 测试 JSONBin 云端同步 ===\n');

  // 1. 测试创建数据
  console.log('1. 测试创建命名 bin...');
  let binId = null;
  const createResponse = await fetch(`${JSONBIN_API}/b`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': API_KEY,
      'X-Bin-Name': `quiz_user_${username}`,
    },
    body: JSON.stringify(testData),
  });

  if (createResponse.ok) {
    const createResult = await createResponse.json();
    binId = createResult.metadata.id;
    console.log('✅ 创建成功');
    console.log('   bin id:', binId);
  } else {
    const errorText = await createResponse.text();
    console.log('❌ 创建失败:', createResponse.status, errorText);
  }

  // 2. 测试读取数据
  console.log('\n2. 测试通过名称读取...');
  const readResponse = await fetch(`${JSONBIN_API}/b/by-name/quiz_user_${username}`, {
    headers: {
      'X-Master-Key': API_KEY,
    },
  });

  if (readResponse.ok) {
    const readResult = await readResponse.json();
    console.log('✅ 读取成功');
    console.log('   数据:', JSON.stringify(readResult.record).substring(0, 100) + '...');
    binId = readResult.metadata.id; // 更新 binId
  } else {
    console.log('❌ 读取失败:', readResponse.status);
  }

  // 3. 测试更新数据
  if (binId) {
    console.log('\n3. 测试更新数据...');
    testData.lastSync = Date.now();
    testData.stats.totalExams = 5;

    const updateResponse = await fetch(`${JSONBIN_API}/b/${binId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': API_KEY,
      },
      body: JSON.stringify(testData),
    });

    if (updateResponse.ok) {
      console.log('✅ 更新成功');
    } else {
      const errorText = await updateResponse.text();
      console.log('❌ 更新失败:', updateResponse.status, errorText);
    }
  }

  console.log('\n=== 测试完成 ===');
}

testCloudSync().catch(console.error);
