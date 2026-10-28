const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

const destination = path.join(root, 'dist', 'ocr');
fs.mkdirSync(destination, { recursive: true });
fs.copyFileSync(path.join(root, 'src', 'ocr', 'ocr_service.py'), path.join(destination, 'ocr_service.py'));

// tsc emits only compiled .ts files; the generated Prisma client (JavaScript plus its
// query engine) must sit beside dist/prisma.js for `npm start` to find it.
fs.cpSync(path.join(root, 'src', 'generated', 'prisma'), path.join(root, 'dist', 'generated', 'prisma'), { recursive: true });
