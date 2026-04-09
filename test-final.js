// 测试使用 Collection + bin 的方式
const API_KEY = '$2a$10$8cGYj4BIZxGZnHGNEPEn/eMdK48LEIe213mhYqBA96M/pJDRjZBpW';
const JSONBIN_API = 'https://api.jsonbin.io/v3';
const COLLECTION_NAME = 'quiz_sync';

async function test() {
  console.log('=== 测试 Collection 方案 ===\n');

  // 1. 创建或获取 collection
  console.log('1. 获取 collection 列表...');
  let response = await fetch(`${JSONBIN_API}/c`, {
    headers: { 'X-Master-Key': API_KEY }
  });
  
  let collections = [];
  if (response.ok) {
    collections = await response.json();
    console.log('   collections:', JSON.stringify(collections).substring(0, 200));
  }

  // 查找或创建 quiz_sync collection
  let collectionId = null;
  const existingCollection = collections.find(c => c.collectionMeta?.name === COLLECTION_NAME);
  
  if (existingCollection) {
    collectionId = existingCollection.record;
    console.log('\n2. 找到已存在的 collection:', collectionId);
  } else {
    console.log('\n2. 创建新 collection...');
    // 创建 collection
    response = await fetch(`${JSONBIN_API}/c`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': API_KEY,
        'X-Collection-Name': COLLECTION_NAME,
      },
      body: JSON.stringify({ name: COLLECTION_NAME })
    });
    
    if (response.ok) {
      const data = await response.json();
      collectionId = data.metadata.id;
      console.log('   创建成功! collection id:', collectionId);
    } else {
      console.log('   失败:', response.status, await response.text());
    }
  }

  // 3. 在 collection 中创建用户数据 bin
  if (collectionId) {
    const username = 'testuser_abc';
    const userData = {
      username,
      password: 'hashed_password',
      userId: 'u_123',
      banks: [{ id: 'b1', name: '测试题库' }],
      lastSync: Date.now()
    };

    console.log('\n3. 在 collection 中创建用户数据 bin...');
    response = await fetch(`${JSONBIN_API}/c/${collectionId}/b`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': API_KEY,
        'X-Bin-Name': `user_${username}`, // 给 bin 命名
      },
      body: JSON.stringify(userData),
    });
    
    let binId = null;
    if (response.ok) {
      const data = await response.json();
      binId = data.metadata.id;
      console.log('   创建成功! bin id:', binId);
    } else {
      console.log('   失败:', response.status, await response.text());
    }

    // 4. 从 collection 获取 bin
    if (binId) {
      console.log('\n4. 从 collection 读取 bin...');
      response = await fetch(`${JSONBIN_API}/c/${collectionId}/b/${binId}/latest`, {
        headers: { 'X-Master-Key': API_KEY }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('   读取成功! username:', data.record.username);
      } else {
        console.log('   失败:', response.status);
      }
    }
  }

  console.log('\n=== 测试完成 ===');
}

test().catch(console.error);
