// 测试 bin 名称功能
const API_KEY = '$2a$10$8cGYj4BIZxGZnHGNEPEn/eMdK48LEIe213mhYqBA96M/pJDRjZBpW';
const JSONBIN_API = 'https://api.jsonbin.io/v3';

async function test() {
  const username = 'user_test_xyz';
  
  console.log('=== 测试 bin 名称功能 ===\n');

  // 1. 创建带名称的 bin
  console.log('1. 创建带名称的 bin...');
  const userData = { username, data: 'test_data', password: 'pass123' };
  
  const createResponse = await fetch(`${JSONBIN_API}/b`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': API_KEY,
      'X-Bin-Name': username, // 设置 bin 名称
    },
    body: JSON.stringify(userData),
  });
  
  console.log('   状态:', createResponse.status);
  
  let binId = null;
  if (createResponse.ok) {
    const data = await createResponse.json();
    binId = data.metadata.id;
    console.log('   创建成功! bin id:', binId);
    console.log('   bin 名称:', data.metadata.name);
  } else {
    console.log('   失败:', await createResponse.text());
  }

  // 2. 尝试用名称读取 - 尝试不同的 API
  console.log('\n2. 尝试用名称读取 bin...');
  
  // 尝试 /b/n/{name}
  const methods = [
    `/b/name/${username}`,
    `/b/n/${username}`,
    `/b/by/name/${username}`,
  ];
  
  for (const path of methods) {
    const response = await fetch(`${JSONBIN_API}${path}`, {
      headers: { 'X-Master-Key': API_KEY }
    });
    console.log(`   ${path}: ${response.status}`);
  }

  // 3. 列出所有 bins（如果有这个 API）
  console.log('\n3. 尝试列出所有 bins...');
  const listResponse = await fetch(`${JSONBIN_API}/b`, {
    headers: { 'X-Master-Key': API_KEY }
  });
  console.log('   /b:', listResponse.status);
  
  console.log('\n=== 测试完成 ===');
}

test().catch(console.error);
