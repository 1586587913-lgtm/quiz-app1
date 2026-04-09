// 详细测试 Collection 创建
const API_KEY = '$2a$10$8cGYj4BIZxGZnHGNEPEn/eMdK48LEIe213mhYqBA96M/pJDRjZBpW';
const JSONBIN_API = 'https://api.jsonbin.io/v3';

async function test() {
  console.log('=== 测试 Collection 创建 ===\n');

  // 创建 collection
  const response = await fetch(`${JSONBIN_API}/c`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': API_KEY,
      'X-Collection-Name': 'quiz_sync_2',
    },
    body: JSON.stringify({ name: 'quiz_sync_2' })
  });
  
  console.log('状态:', response.status);
  const text = await response.text();
  console.log('响应:', text);
  
  const data = JSON.parse(text);
  console.log('\n解析后:');
  console.log('metadata:', JSON.stringify(data.metadata));
  console.log('record:', JSON.stringify(data.record));

  console.log('\n=== 测试完成 ===');
}

test().catch(console.error);
