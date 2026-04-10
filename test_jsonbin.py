#!/usr/bin/env python3
"""测试 JSONBin API"""
import requests
import json

ACCESS_KEY = "$2a$10$RVSQqvdx8S1r1SadSudgjeAuUCrnqN1ugUNRA6JMJ5TYB4VuYa1h2"
BIN_NAME = f"quiz_test_12345"

# 测试 1: 创建 bin
print("=== 测试 1: 创建 bin ===")
url = "https://api.jsonbin.io/v3/b"
headers = {
    "Content-Type": "application/json",
    "X-Access-Key": ACCESS_KEY,
    "X-Bin-Name": BIN_NAME,
}
data = {"test": True}

try:
    resp = requests.post(url, headers=headers, json=data)
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.text[:500]}")
    
    if resp.ok:
        result = resp.json()
        bin_id = result.get("metadata", {}).get("id")
        print(f"Bin ID: {bin_id}")
        
        # 测试 2: 读取 bin
        print("\n=== 测试 2: 读取 bin ===")
        resp2 = requests.get(f"{url}/{bin_id}/latest", headers={"X-Access-Key": ACCESS_KEY})
        print(f"Status: {resp2.status_code}")
        print(f"Response: {resp2.text[:300]}")
        
except Exception as e:
    print(f"ERROR: {e}")
