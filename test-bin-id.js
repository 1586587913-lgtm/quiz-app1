// 测试用用户名生成 bin ID
const API_KEY = '$2a$10$8cGYj4BIZxGZnHGNEPEn/eMdK48LEIe213mhYqBA96M/pJDRjZBpW';
const JSONBIN_API = 'https://api.jsonbin.io/v3';

// 用用户名生成一个合法的 bin ID
function generateBinId(username) {
  // 简单的 hash，然后转成 base36，取前 12 位
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    const char = username.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'q' + Math.abs(hash).toString(36).substring(0, 11);
}

async function testBinId(username) {
  const binId = generateBinId(username);
  console.log('用户名:', username);
  console.log('生成的 bin ID:', binId);
  console.log('ID 长度:', binId.length);

  // 1. 先尝试读取这个 bin（应该 404）
  console.log('\n1. 测试读取（预期 404）...');
  const readResponse = await fetch(`${JSONBIN_API}/b/${binId}/latest`, {
    headers: { 'X-Master-Key': API_KEY }
  });
  console.log('   状态码:', readResponse.status);

  // 2. 创建 bin
  console.log('\n2. 测试创建 bin...');
  const createResponse = await fetch(`${JSONBIN_API}/b`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': API_KEY,
    },
    body: JSON.stringify({ username, test: true }),
  });
  
  if (createResponse.ok) {
    const result = await createResponse.json();
    console.log('   创建成功!');
    console.log('   实际 bin ID:', result.metadata.id);
  } else {
    console.log('   创建失败:', await createResponse.text());
  }

  // 3. 再读一次
  console.log('\n3. 测试读取刚才创建的 bin...');
  const read2 = await fetch(`${JSONBIN_API}/b/${binId}/latest`, {
    headers: { 'X-Master-Key': API_KEY }
  });
  console.log('   状态码:', read2.status);
  
  if (read2.ok) {
    const data = await read2.json();
    console.log('   数据:', JSON.stringify(data.record));
  }

  // 4. 更新
  console.log('\n4. 测试更新...');
  const updateResponse = await fetch(`${JSONBIN_API}/b/${binId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': API_KEY,
    },
    body: JSON.stringify({ username, updated: true }),
  });
  console.log('   状态码:', updateResponse.status);
}

testBinId('testuser123').catch(console.error);
