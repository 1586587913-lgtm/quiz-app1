const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

const pdfDir = 'C:/Users/User/Desktop/二级计量工程师/2025考前预测卷';

async function extractTextFromPdf(pdfPath) {
  try {
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } catch (error) {
    console.error(`Error reading ${pdfPath}:`, error.message);
    return '';
  }
}

async function processAllPdfs() {
  const files = fs.readdirSync(pdfDir).filter(f => f.endsWith('.pdf'));

  const results = {};
  for (const file of files) {
    const filePath = path.join(pdfDir, file);
    console.log(`Processing: ${file}`);
    const text = await extractTextFromPdf(filePath);
    results[file] = text;
    // Small delay to prevent overwhelming
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Save all extracted text
  const outputPath = path.join(pdfDir, 'extracted_text.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nExtracted text saved to: ${outputPath}`);
  console.log(`Processed ${files.length} files`);
}

processAllPdfs();
