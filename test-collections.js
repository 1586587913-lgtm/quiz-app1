// 测试 Collections API
const API_KEY = '$2a$10$8cGYj4BIZxGZnHGNEPEn/eMdK48LEIe213mhYqBA96M/pJDRjZBpW';
const JSONBIN_API = 'https://api.jsonbin.io/v3';

async function testCollections() {
  console.log('=== 测试 Collections API ===\n');

  // 1. 列出所有 collections
  console.log('1. 列出所有 collections...');
  let response = await fetch(`${JSONBIN_API}/c`, {
    headers: { 'X-Master-Key': API_KEY }
  });
  
  if (response.ok) {
    const data = await response.json();
    console.log('   成功! collections:', JSON.stringify(data).substring(0, 200));
  } else {
    console.log('   失败:', response.status, await response.text());
  }

  // 2. 创建 collection
  console.log('\n2. 创建 quiz_sync collection...');
  response = await fetch(`${JSONBIN_API}/c`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': API_KEY,
    },
    body: JSON.stringify({ name: 'quiz_sync_collection' })
  });
  
  let collectionId = null;
  if (response.ok) {
    const data = await response.json();
    console.log('   成功! collection id:', data.metadata.id);
    collectionId = data.metadata.id;
  } else {
    console.log('   失败:', response.status, await response.text());
  }

  // 3. 在 collection 中创建 bin
  if (collectionId) {
    console.log('\n3. 在 collection 中创建 bin...');
    const binData = { username: 'test123', data: 'test' };
    response = await fetch(`${JSONBIN_API}/c/${collectionId}/b`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': API_KEY,
      },
      body: JSON.stringify(binData),
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('   成功! bin id:', data.metadata.id);
    } else {
      console.log('   失败:', response.status, await response.text());
    }
  }

  console.log('\n=== 测试完成 ===');
}

testCollections().catch(console.error);
