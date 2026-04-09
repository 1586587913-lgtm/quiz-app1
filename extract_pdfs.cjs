const fs = require('fs');
const path = require('path');

const pdfDir = 'C:/Users/User/Desktop/二级计量工程师/2025考前预测卷';

async function extractTextFromPdf(pdfPath) {
  try {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const dataBuffer = fs.readFileSync(pdfPath);
    // Convert Buffer to Uint8Array
    const uint8Array = new Uint8Array(dataBuffer);
    const pdfDoc = await pdfjsLib.getDocument({ data: uint8Array }).promise;
    let fullText = '';

    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map(item => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }

    return fullText;
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
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const outputPath = path.join(pdfDir, 'extracted_text.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nExtracted text saved to: ${outputPath}`);
  console.log(`Processed ${files.length} files`);
}

processAllPdfs();
