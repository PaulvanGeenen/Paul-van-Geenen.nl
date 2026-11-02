import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

async function extract() {
  const filePath = path.join(process.cwd(), '_private_manuscripts', '01 Koester het Leven .pdf');
  console.log('Reading PDF:', filePath);
  const dataBuffer = fs.readFileSync(filePath);
  
  console.log('Parsing PDF...');
  const parser = new PDFParse({ data: dataBuffer });
  await parser.load();
  
  const info = await parser.getInfo();
  console.log('Info:', info);
  
  const textResult = await parser.getText();
  const text = typeof textResult === 'string' ? textResult : (textResult.text || JSON.stringify(textResult));
  
  const outputPath = path.join(process.cwd(), '_private_manuscripts', '01_Koester_het_Leven_extracted.txt');
  fs.writeFileSync(outputPath, text, 'utf-8');
  console.log('Saved extracted text to:', outputPath, 'Length:', text.length, 'chars');
  
  console.log('--- PREVIEW ---');
  console.log(text.substring(0, 2000));
}

extract().catch(console.error);
