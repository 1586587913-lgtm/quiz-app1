// COS 上传脚本
const COS = require('cos-js-sdk-v5');
const fs = require('fs');
const path = require('path');

const cos = new COS({
  SecretId: 'AKIDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',  // 替换为你的 SecretId
  SecretKey: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'  // 替换为你的 SecretKey
});

const bucket = 'ziyouxue-1420167451';
const region = 'ap-nanjing';
const localDir = path.join(__dirname, 'dist');

function uploadDir(dirPath, cosPath = '/') {
  const files = fs.readdirSync(dirPath);
  
  files.forEach(file => {
    const localPath = path.join(dirPath, file);
    const stat = fs.statSync(localPath);
    
    if (stat.isDirectory()) {
      uploadDir(localPath, cosPath + file + '/');
    } else {
      const cosFilePath = cosPath + file;
      console.log(`Uploading: ${localPath} -> ${cosFilePath}`);
      
      cos.putObject({
        Bucket: bucket,
        Region: region,
        Key: cosFilePath,
        Body: fs.createReadStream(localPath),
        ContentLength: stat.size
      }, (err, data) => {
        if (err) {
          console.error(`Error uploading ${file}:`, err);
        } else {
          console.log(`Uploaded: ${file}`);
        }
      });
    }
  });
}

console.log('Starting upload to COS...');
uploadDir(localDir);
console.log('Upload started! Check COS console for status.');
