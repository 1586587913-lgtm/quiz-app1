// 测试 pdfjs-dist legacy build
import { readFileSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// 使用 legacy 构建（支持 Node.js）
const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

// 在 Node.js 环境中设置 workerSrc
const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${workerPath}`;

const filePath = 'C:/Users/User/Desktop/二级计量工程师/2025考前预测卷/2024年二级注册计量师《计量法律法规及综合知识》最后两套卷-A卷（答案及解析）.pdf';
const buf = readFileSync(filePath);
const data = new Uint8Array(buf);

console.log('PDF file size:', buf.length, 'bytes');

const loadingTask = pdfjsLib.getDocument({ data });
const pdf = await loadingTask.promise;

// v5.x: numPages 可能是对象，需要转成数字
const numPages = Number(pdf.numPages);
console.log('numPages:', numPages, '(type:', typeof pdf.numPages, ')');

let text = '';
for (let i = 1; i <= numPages; i++) {
  const page = await pdf.getPage(i);
  const content = await page.getTextContent();
  const pageText = content.items.map((item) => item.str).join(' ');
  text += pageText + '\n';
}

console.log('Extracted text length:', text.length);
console.log('First 800 chars:');
console.log(text.slice(0, 800));
