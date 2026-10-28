import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { assertMatchingTestDatabaseUrls, assertRuntimeMatchesTestDatabase, parseLocalTestDatabaseUrl } from '../config/testDatabaseSafety.js';

const testUrl = 'postgresql://synthetic:synthetic@127.0.0.1:5432/bharatsatya_test_0123456789abcdef0123456789abcdef?schema=public';

describe('database safety guard', () => {
  it('accepts only matching dedicated local test database URLs', () => {
    expect(assertMatchingTestDatabaseUrls(testUrl, testUrl)).toEqual({ databaseName: 'bharatsatya_test_0123456789abcdef0123456789abcdef' });
    expect(assertRuntimeMatchesTestDatabase({
      TEST_DATABASE_URL: testUrl,
      TEST_DIRECT_URL: testUrl,
      DATABASE_URL: testUrl,
      DIRECT_URL: testUrl,
    })).toEqual({ databaseName: 'bharatsatya_test_0123456789abcdef0123456789abcdef' });
  });

  it('rejects production-like names, remote hosts, and mismatched direct targets', () => {
    expect(() => parseLocalTestDatabaseUrl('postgresql://u:p@localhost:5432/production', 'DATABASE_URL'))
      .toThrow(/local PostgreSQL database/);
    expect(() => parseLocalTestDatabaseUrl('postgresql://u:p@localhost:5432/bharatsatya_test_production', 'TEST_DATABASE_URL'))
      .toThrow(/32-character-guid/);
    expect(() => parseLocalTestDatabaseUrl('postgresql://u:p@localhost:5432/bharatsatya_test_existing', 'TEST_DATABASE_URL'))
      .toThrow(/32-character-guid/);
    expect(() => parseLocalTestDatabaseUrl('postgresql://u:p@db.example.test:5432/bharatsatya_test_remote', 'DATABASE_URL'))
      .toThrow(/local PostgreSQL database/);
    expect(() => parseLocalTestDatabaseUrl('postgresql://u:p@localhost:5432/bharatsatya_test_local?host=remote.example', 'DATABASE_URL'))
      .toThrow(/local PostgreSQL database/);
    expect(() => parseLocalTestDatabaseUrl('postgresql://u:p@localhost:5432/bharatsatya_test_local?HOST=remote.example', 'DATABASE_URL'))
      .toThrow(/local PostgreSQL database/);
    expect(() => assertMatchingTestDatabaseUrls(testUrl, 'postgresql://u:p@localhost:5432/bharatsatya_test_ffffffffffffffffffffffffffffffff'))
      .toThrow(/same local test database/);
  });

  it('rejects a runtime DATABASE_URL or DIRECT_URL that differs from the designated test target', () => {
    expect(() => assertRuntimeMatchesTestDatabase({
      TEST_DATABASE_URL: testUrl,
      TEST_DIRECT_URL: testUrl,
      DATABASE_URL: 'postgresql://u:p@localhost:5432/bharatsatya_test_ffffffffffffffffffffffffffffffff',
      DIRECT_URL: testUrl,
    })).toThrow(/must both match/);
  });

  it('does not include credentials or complete URLs in safety errors', () => {
    let message = '';
    try {
      parseLocalTestDatabaseUrl('postgresql://secret-user:secret-password@remote.example/db', 'TEST_DATABASE_URL');
    } catch (error) {
      message = error instanceof Error ? error.message : '';
    }
    expect(message).not.toContain('secret-user');
    expect(message).not.toContain('secret-password');
    expect(message).not.toContain('remote.example');
  });

  it('keeps the default test command database-independent and guards the acceptance command', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
    const acceptanceConfig = fs.readFileSync(path.join(process.cwd(), 'vitest.acceptance.config.ts'), 'utf8');
    const acceptanceSetup = fs.readFileSync(path.join(process.cwd(), 'src/tests/acceptance.setup.ts'), 'utf8');
    const acceptanceSuite = fs.readFileSync(path.join(process.cwd(), 'src/tests/acceptance.test.ts'), 'utf8');
    const seed = fs.readFileSync(path.join(process.cwd(), 'src/seed.ts'), 'utf8');
    expect(packageJson.scripts.test).toBe('npm run test:unit');
    expect(packageJson.scripts['test:unit']).toContain('--exclude src/tests/acceptance.test.ts');
    expect(packageJson.scripts['test:acceptance']).toContain('vitest.acceptance.config.ts');
    expect(acceptanceConfig).toContain('src/tests/acceptance.setup.ts');
    expect(acceptanceSetup).toContain('process.env.DATABASE_URL = process.env.TEST_DATABASE_URL');
    expect(acceptanceSetup).toContain('process.env.DIRECT_URL = process.env.TEST_DIRECT_URL');
    expect(acceptanceSuite).toContain('assertRuntimeMatchesTestDatabase()');
    expect(seed.indexOf('assertRuntimeMatchesTestDatabase();')).toBeLessThan(seed.indexOf('prisma.institution.count()'));
    expect(seed).toContain("process.env.ALLOW_SYNTHETIC_SEED !== 'true'");
    expect(seed).toContain('Refusing to seed a non-empty database');
  });
});
