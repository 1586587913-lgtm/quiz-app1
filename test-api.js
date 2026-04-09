// 检查 JSONBin bin ID 格式
const API_KEY = '$2a$10$8cGYj4BIZxGZnHGNEPEn/eMdK48LEIe213mhYqBA96M/pJDRjZBpW';
const JSONBIN_API = 'https://api.jsonbin.io/v3';

async function test() {
  // 测试已知的 bin ID 格式
  const knownBinIds = [
    '69d713baaaba882197db4b27', // 之前成功的
    '69d7140b36566621a8925659', // 之前成功的
  ];

  console.log('=== 测试已知的 bin ID ===');
  for (const binId of knownBinIds) {
    const response = await fetch(`${JSONBIN_API}/b/${binId}/latest`, {
      headers: { 'X-Master-Key': API_KEY }
    });
    console.log(`bin ID: ${binId} (长度: ${binId.length})`);
    console.log(`状态: ${response.status}`);
    if (response.ok) {
      const data = await response.json();
      console.log(`数据: ${JSON.stringify(data.record).substring(0, 60)}...`);
    }
    console.log('');
  }

  // 测试不同格式
  console.log('=== 测试不同格式 ===');
  const formats = [
    'qlpdspt',        // 7字符
    '123456789012',   // 12字符
    'abcdefghijk',    // 11字符
    '69d713b',        // 7字符十六进制
  ];

  for (const binId of formats) {
    const response = await fetch(`${JSONBIN_API}/b/${binId}/latest`, {
      headers: { 'X-Master-Key': API_KEY }
    });
    console.log(`"${binId}" (${binId.length}字符): ${response.status}`);
  }
}

test().catch(console.error);
