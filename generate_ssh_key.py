#!/usr/bin/env python3
"""生成 SSH Ed25519 密钥"""

import os
import sys

try:
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ed25519
except ImportError:
    print("正在安装 cryptography...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "cryptography", "-q"])
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ed25519

# 生成密钥
private_key = ed25519.Ed25519PrivateKey.generate()
public_key = private_key.public_key()

# 私钥
private_pem = private_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.OpenSSH,
    encryption_algorithm=serialization.NoEncryption()
)

# 公钥
public_ssh = public_key.public_bytes(
    encoding=serialization.Encoding.OpenSSH,
    format=serialization.PublicFormat.OpenSSH
)

ssh_dir = os.path.join(os.environ['USERPROFILE'], '.ssh')
os.makedirs(ssh_dir, exist_ok=True)

# 写入文件
private_path = os.path.join(ssh_dir, 'id_ed25519')
public_path = os.path.join(ssh_dir, 'id_ed25519.pub')

with open(private_path, 'wb') as f:
    f.write(private_pem)
os.chmod(private_path, 0o600)

with open(public_path, 'wb') as f:
    f.write(public_ssh)

print('='*60)
print('SSH 密钥生成成功！')
print('='*60)
print()
print('公钥内容（复制以下全部内容，包括 ssh-ed25519 AAAA...）：')
print()
print(public_ssh.decode())
print()
print('='*60)
