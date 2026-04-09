import { PDFParse } from 'pdf-parse';
import { readFileSync } from 'fs';

const buf = readFileSync('C:/Users/User/Desktop/二级计量工程师/2025考前预测卷/2024年二级注册计量师《计量法律法规及综合知识》最后两套卷-A卷（答案及解析）.pdf');
const data = new Uint8Array(buf);

const parser = new PDFParse({ data });
await parser.load();
console.log('Info:', parser.getInfo());
console.log('Text:', JSON.stringify(parser.getText()));
