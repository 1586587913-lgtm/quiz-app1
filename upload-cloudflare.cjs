const https = require('https');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  accountId: 'd0f138ab9e8a3ec670d621fb3244cc46',
  apiToken: 'cfut_GnWooJGOqDRaGIseWqPm2d3iUv8C0QRsHK1Jjmmddcb3b67e',
  projectName: 'quiz-app'
};

function apiRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const body = data ? JSON.stringify(data) : '';
    const options = {
      hostname: 'api.cloudflare.com',
      port: 443,
      path: `/client/v4${path}`,
      method,
      headers: {
        'Authorization': `Bearer ${CONFIG.apiToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function createProject() {
  console.log('创建 Cloudflare Pages 项目...');
  const result = await apiRequest('POST', `/accounts/${CONFIG.accountId}/pages/projects`, {
    name: CONFIG.projectName,
    build_config: {
      build_command: '',
      destination_dir: '',
      root_distribution_folder: ''
    },
    source: {
      deployed: false,
      latest_commit: 'initial',
      quick_deploy: true
    }
  });

  if (result.success) {
    console.log('✅ 项目创建成功');
    return result.result;
  } else {
    console.log('项目可能已存在，尝试获取...');
    const list = await apiRequest('GET', `/accounts/${CONFIG.accountId}/pages/projects`);
    const existing = list.result?.find(p => p.name === CONFIG.projectName);
    if (existing) {
      console.log('✅ 找到已有项目');
      return existing;
    }
    console.error('❌ 创建失败:', result.errors);
    throw new Error('无法创建项目');
  }
}

async function uploadFiles(project) {
  const distDir = path.join(__dirname, 'dist');
  const files = [];

  function getFiles(dir, base = dir) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const full = path.join(dir, item);
      if (fs.statSync(full).isDirectory()) {
        getFiles(full, base);
      } else {
        files.push({
          path: path.relative(base, full).replace(/\\/g, '/'),
          fullPath: full
        });
      }
    }
  }

  getFiles(distDir);
  console.log(`\n找到 ${files.length} 个文件，准备上传...`);

  // 准备上传
  const payload = files.map(f => ({
    filePath: f.path,
    size: fs.statSync(f.fullPath).size
  }));

  const uploadReq = await apiRequest('POST', `/accounts/${CONFIG.accountId}/pages/files/upload`, {
    files: payload
  });

  if (!uploadReq.success) {
    console.error('准备上传失败:', uploadReq.errors);
    throw new Error('准备上传失败');
  }

  console.log('上传文件...');
  for (const file of files) {
    const uploadInfo = uploadReq.result.find(u => u.key === file.path);
    if (uploadInfo) {
      // 上传到预签名URL
      const content = fs.readFileSync(file.fullPath);
      await new Promise((resolve, reject) => {
        const url = new URL(uploadInfo.upload_url);
        const req = https.request({
          hostname: url.hostname,
          path: url.pathname,
          method: 'PUT',
          headers: {
            'Content-Length': content.length
          }
        }, (res) => {
          if (res.statusCode === 200) {
            console.log(`  ✅ ${file.path}`);
            resolve();
          } else {
            reject(new Error(`上传失败: ${res.statusCode}`));
          }
        });
        req.on('error', reject);
        req.write(content);
        req.end();
      });
    }
  }

  return uploadReq.result.deployments_url;
}

async function deploy(uploadResult) {
  console.log('\n触发部署...');
  const result = await apiRequest('POST', `/accounts/${CONFIG.accountId}/pages/projects/${CONFIG.projectName}/deployments`, {});

  if (result.success) {
    console.log('✅ 部署成功!');
    console.log(`\n访问地址: ${result.result.url}`);
    return result.result.url;
  } else {
    console.error('❌ 部署失败:', result.errors);
    throw new Error('部署失败');
  }
}

async function main() {
  try {
    const project = await createProject();
    await uploadFiles(project);
    const url = await deploy();
    console.log(`\n🎉 完成！访问地址: ${url}`);
  } catch (e) {
    console.error('错误:', e.message);
    process.exit(1);
  }
}

main();
