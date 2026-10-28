import dotenv from 'dotenv';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll } from 'vitest';
import { assertMatchingTestDatabaseUrls } from '../config/testDatabaseSafety.js';

dotenv.config();
assertMatchingTestDatabaseUrls(process.env.TEST_DATABASE_URL, process.env.TEST_DIRECT_URL);

// Force Prisma to use the explicitly designated test target, never the ordinary .env database.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL!;
process.env.DIRECT_URL = process.env.TEST_DIRECT_URL!;
process.env.NODE_ENV = 'test';
process.env.DOCUMENT_STORAGE_PROVIDER = 'local';
delete process.env.VERCEL;

// Acceptance uploads use an isolated temporary directory rather than the developer's uploads folder.
const acceptanceUploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bharatsatya-acceptance-'));
process.env.UPLOAD_DIR = acceptanceUploadDir;
afterAll(() => fs.rmSync(acceptanceUploadDir, { recursive: true, force: true }));
