import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const migrationDir = path.join(process.cwd(), 'prisma', 'migrations');

describe('PostgreSQL migration artifacts', () => {
  it('declares PostgreSQL as the provider and the active schema uses the same provider', () => {
    const lock = fs.readFileSync(path.join(migrationDir, 'migration_lock.toml'), 'utf8');
    const schema = fs.readFileSync(path.join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8');
    expect(lock).toContain('provider = "postgresql"');
    expect(schema).toContain('provider = "postgresql"');
    expect(schema).toContain('ruleVersionId');
  });

  it('migrates findings to exact rule versions and installs append-only audit enforcement', () => {
    const migration = fs.readFileSync(path.join(migrationDir, '20261023_rule_snapshots_and_audit_guard', 'migration.sql'), 'utf8');
    expect(migration).toContain('ValidationFinding_ruleVersionId_fkey');
    expect(migration).toContain('ALTER COLUMN "ruleVersionId" SET NOT NULL');
    expect(migration).toContain('BEFORE UPDATE OR DELETE ON "AuditEvent"');
  });

  it('adds an acting-user reference to verification records without dropping historical requests', () => {
    const migration = fs.readFileSync(path.join(migrationDir, '20261024_verification_actor', 'migration.sql'), 'utf8');
    expect(migration).toContain('ADD COLUMN "requestedByUserId" TEXT');
    expect(migration).toContain('ON DELETE SET NULL');
    expect(migration).not.toMatch(/DROP TABLE|TRUNCATE|DELETE FROM/i);
  });

  it('adds a nullable unique Google subject for linking existing users without creating accounts', () => {
    const migration = fs.readFileSync(path.join(migrationDir, '20261024_google_identity', 'migration.sql'), 'utf8');
    const schema = fs.readFileSync(path.join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8');
    expect(migration).toContain('ADD COLUMN "googleSubject" TEXT');
    expect(migration).toContain('CREATE UNIQUE INDEX "User_googleSubject_key"');
    expect(migration).not.toMatch(/DROP TABLE|TRUNCATE|DELETE FROM|INSERT INTO "User"/i);
    expect(schema).toContain('googleSubject  String?        @unique');
  });
});
