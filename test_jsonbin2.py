import urllib.request
import urllib.error
import json

JSONBIN_API = 'https://api.jsonbin.io/v3'
MASTER_KEY = '$2a$10$RVSQqvdx8S1r1SadSudgjeAuUCrnqN1ugUNRA6JMJ5TYB4VuYa1h2'

# 测试 1: 创建 bin
print("测试 1: 创建 bin...")
url = f"{JSONBIN_API}/b"
data = json.dumps({"test": "hello"}).encode()
req = urllib.request.Request(url, data=data, method='POST')
req.add_header('Content-Type', 'application/json')
req.add_header('X-Master-Key', MASTER_KEY)
req.add_header('X-Bin-Name', 'quiz_test_' + str(int(__import__('time').time())))

try:
    with urllib.request.urlopen(req, timeout=10) as response:
        result = json.loads(response.read())
        print("成功:", json.dumps(result, indent=2))
        if result.get('metadata', {}).get('id'):
            bin_id = result['metadata']['id']
            print(f"Bin ID: {bin_id}")
            
            # 测试 2: 读取 bin
            print("\n测试 2: 读取 bin...")
            req2 = urllib.request.Request(f"{JSONBIN_API}/b/{bin_id}/latest")
            req2.add_header('X-Master-Key', MASTER_KEY)
            with urllib.request.urlopen(req2, timeout=10) as resp2:
                result2 = json.loads(resp2.read())
                print("读取成功:", json.dumps(result2, indent=2)[:200])
                
            # 测试 3: 通过名称查找
            print("\n测试 3: 通过名称查找...")
            bin_name = result['metadata']['name']
            req3 = urllib.request.Request(f"{JSONBIN_API}/b/by-name/{bin_name}")
            req3.add_header('X-Master-Key', MASTER_KEY)
            try:
                with urllib.request.urlopen(req3, timeout=10) as resp3:
                    result3 = json.loads(resp3.read())
                    print("查找成功:", json.dumps(result3, indent=2)[:200])
            except urllib.error.HTTPError as e:
                print(f"查找失败: {e.code} - {e.read().decode()[:200]}")
except urllib.error.HTTPError as e:
    print(f"错误: {e.code} - {e.read().decode()[:500]}")
