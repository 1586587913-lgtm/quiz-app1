// 测试 GitHub Gist 同步
const GIST_API = 'https://api.github.com/gists';
const token = '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';

async function test() {
  console.log('=== 测试 GitHub Gist 同步 ===\n');
  
  // 1. 创建测试数据
  console.log('1. 创建 Gist...');
  const testData = {
    username: 'test_user_001',
    password: 'test123',
    userId: 'u_test123',
    banks: [{ id: 'bank1', name: '测试题库', questions: [] }],
    stats: { totalExams: 5 },
    masteredQuestions: [],
    wrongQuestions: [],
    lastSync: Date.now()
  };
  
  const createResponse = await fetch(GIST_API, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      description: `quiz_sync_test_user_001_${Date.now()}`,
      public: false,
      files: { 'quiz_data.json': { content: JSON.stringify(testData, null, 2) } }
    })
  });
  
  if (!createResponse.ok) {
    console.log('❌ 创建失败:', createResponse.status);
    return;
  }
  
  const createResult = await createResponse.json();
  const gistId = createResult.id;
  console.log('✅ 创建成功, Gist ID:', gistId);
  
  // 2. 读取 Gist
  console.log('\n2. 读取 Gist...');
  const readResponse = await fetch(`${GIST_API}/${gistId}`, {
    headers: {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github+json'
    }
  });
  
  const readData = await readResponse.json();
  console.log('✅ 读取成功, 用户名:', readData.files['quiz_data.json'].content);
  
  // 3. 更新 Gist
  console.log('\n3. 更新 Gist...');
  testData.lastSync = Date.now();
  testData.stats.totalExams = 10;
  
  const updateResponse = await fetch(`${GIST_API}/${gistId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      files: { 'quiz_data.json': { content: JSON.stringify(testData, null, 2) } }
    })
  });
  
  if (updateResponse.ok) {
    console.log('✅ 更新成功');
  } else {
    console.log('❌ 更新失败:', updateResponse.status);
  }
  
  // 4. 删除测试 Gist
  console.log('\n4. 删除测试 Gist...');
  const deleteResponse = await fetch(`${GIST_API}/${gistId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github+json'
    }
  });
  
  if (deleteResponse.status === 204) {
    console.log('✅ 删除成功');
  } else {
    console.log('❌ 删除失败:', deleteResponse.status);
  }
  
  console.log('\n=== 所有测试通过！ ===');
}

test().catch(e => console.error('测试失败:', e));
