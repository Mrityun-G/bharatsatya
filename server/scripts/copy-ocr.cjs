const fs = require('node:fs');
const path = require('node:path');

const destination = path.join(__dirname, '..', 'dist', 'ocr');
fs.mkdirSync(destination, { recursive: true });
fs.copyFileSync(path.join(__dirname, '..', 'src', 'ocr', 'ocr_service.py'), path.join(destination, 'ocr_service.py'));
