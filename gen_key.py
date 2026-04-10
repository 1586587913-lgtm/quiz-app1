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

private_key = ed25519.Ed25519PrivateKey.generate()
public_key = private_key.public_key()

private_pem = private_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.OpenSSH,
    encryption_algorithm=serialization.NoEncryption()
)

public_ssh = public_key.public_bytes(
    encoding=serialization.Encoding.OpenSSH,
    format=serialization.PublicFormat.OpenSSH
)

ssh_dir = os.path.join(os.environ['USERPROFILE'], '.ssh')
os.makedirs(ssh_dir, exist_ok=True)

private_path = os.path.join(ssh_dir, 'id_ed25519')
public_path = os.path.join(ssh_dir, 'id_ed25519.pub')

with open(private_path, 'wb') as f:
    f.write(private_pem)

with open(public_path, 'wb') as f:
    f.write(public_ssh)

print('SUCCESS')
print(public_ssh.decode())
