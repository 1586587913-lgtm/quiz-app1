const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const config = {
  SecretId: 'AKIDiIciaEfssiSTP8f6KL9iEdpkUJxNdoqo',
  SecretKey: 'tZ0DCxS6lFUUL6qT6f3FPQF1hCXihUFm',
  Bucket: 'ziyouxue-1420167451',
  Region: 'ap-beijing',
  DistDir: path.join(__dirname, 'dist'),
};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.txt':  'text/plain; charset=utf-8',
};

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

function getAllFiles(dir, base) {
  base = base || dir;
  const results = [];
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const full = path.join(dir, item);
    if (fs.statSync(full).isDirectory()) {
      results.push(...getAllFiles(full, base));
    } else {
      results.push(full);
    }
  }
  return results;
}

function sign(method, pathname, headers, secretId, secretKey) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600;
  const keyTime = `${now};${exp}`;

  const signKey = crypto.createHmac('sha1', secretKey).update(keyTime).digest('hex');
  const httpStr = `${method.toLowerCase()}\n${pathname}\n\n${
    Object.keys(headers).sort().map(k => `${k.toLowerCase()}=${encodeURIComponent(headers[k])}`).join('&')
  }\n`;
  const strToSign = `sha1\n${keyTime}\n${crypto.createHash('sha1').update(httpStr).digest('hex')}\n`;
  const signature = crypto.createHmac('sha1', signKey).update(strToSign).digest('hex');

  const signedHeaders = Object.keys(headers).sort().map(k => k.toLowerCase()).join(';');
  return `q-sign-algorithm=sha1&q-ak=${secretId}&q-sign-time=${keyTime}&q-key-time=${keyTime}&q-header-list=${signedHeaders}&q-url-param-list=&q-signature=${signature}`;
}

function uploadFile(localPath, cosKey) {
  return new Promise((resolve, reject) => {
    const content = fs.readFileSync(localPath);
    const contentType = getContentType(localPath);
    const host = `${config.Bucket}.cos.${config.Region}.myqcloud.com`;
    const pathname = '/' + cosKey;

    const headers = {
      'Content-Type': contentType,
      'Content-Length': String(content.length),
      'Host': host,
    };

    const auth = sign('PUT', pathname, headers, config.SecretId, config.SecretKey);

    const options = {
      hostname: host,
      port: 443,
      path: pathname,
      method: 'PUT',
      headers: { ...headers, 'Authorization': auth },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`✅ ${cosKey} (${contentType})`);
          resolve();
        } else {
          console.error(`❌ ${cosKey} -> ${res.statusCode}: ${body}`);
          reject(new Error(`Upload failed: ${res.statusCode}`));
        }
      });
    });
    req.on('error', reject);
    req.write(content);
    req.end();
  });
}

async function main() {
  const files = getAllFiles(config.DistDir);
  console.log(`共 ${files.length} 个文件，开始上传...\n`);

  for (const file of files) {
    const cosKey = path.relative(config.DistDir, file).replace(/\\/g, '/');
    try {
      await uploadFile(file, cosKey);
    } catch (e) {
      console.error(`上传失败: ${cosKey}`, e.message);
    }
  }

  console.log('\n🎉 上传完成！');
  console.log(`\n访问地址：https://${config.Bucket}.cos-website.${config.Region}.myqcloud.com`);
}

main();
