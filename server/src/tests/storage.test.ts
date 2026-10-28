import { describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { LocalPrivateDocumentStorage, S3PrivateDocumentStorage, readS3StorageConfig, getDocumentStorage } from '../storage/provider.js';

const key = '3bd7d37a-2151-4518-b3bd-d165a2d32710.pdf';

describe('private document storage providers', () => {
  it('stores, streams, checks and deletes local private objects by opaque key', async () => {
    const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'bharatsatya-storage-'));
    try {
      const storage = new LocalPrivateDocumentStorage(root);
      await storage.put(key, Buffer.from('private'), 'application/pdf');
      expect(await storage.exists(key)).toBe(true);
      const chunks: Buffer[] = [];
      for await (const chunk of await storage.get(key)) chunks.push(Buffer.from(chunk));
      expect(Buffer.concat(chunks).toString()).toBe('private');
      await storage.delete(key);
      expect(await storage.exists(key)).toBe(false);
      await expect(storage.get('../secret.pdf')).rejects.toThrow(/Invalid private document key/);
    } finally {
      await fs.promises.rm(root, { recursive: true, force: true });
    }
  });

  it('validates complete S3-compatible production configuration without exposing credentials', () => {
    const config = readS3StorageConfig({
      NODE_ENV: 'production', OBJECT_STORAGE_ENDPOINT: 'https://objects.example.test',
      OBJECT_STORAGE_BUCKET: 'bharatsatya-private', OBJECT_STORAGE_REGION: 'auto',
      OBJECT_STORAGE_ACCESS_KEY_ID: 'test-access', OBJECT_STORAGE_SECRET_ACCESS_KEY: 'test-secret',
      OBJECT_STORAGE_PRIVATE_BUCKET_CONFIRMED: 'true',
    });
    expect(config).toMatchObject({ bucket: 'bharatsatya-private', region: 'auto' });
    expect(readS3StorageConfig({
      NODE_ENV: 'production', OBJECT_STORAGE_ENDPOINT: 'https://objects.example.test',
      OBJECT_STORAGE_BUCKET: 'bharatsatya-private', OBJECT_STORAGE_REGION: 'auto',
      OBJECT_STORAGE_ACCESS_KEY_ID: 'test-access', OBJECT_STORAGE_SECRET_ACCESS_KEY: 'test-secret',
    })).toBeNull();
    expect(readS3StorageConfig({ NODE_ENV: 'production', OBJECT_STORAGE_ENDPOINT: 'http://objects.example.test' })).toBeNull();
    expect(() => getDocumentStorage({ NODE_ENV: 'production', DOCUMENT_STORAGE_PROVIDER: 'local' })).toThrow(/not allowed/);
  });

  it('signs object operations and reports provider failures without returning URLs', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response('private data', { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }));
    const storage = new S3PrivateDocumentStorage({
      endpoint: 'https://objects.example.test', bucket: 'private-bucket', region: 'auto',
      accessKeyId: 'access-id', secretAccessKey: 'secret-value', forcePathStyle: true, privateBucketConfirmed: true,
    }, fetcher);
    await storage.check();
    await storage.put(key, Buffer.from('test'), 'application/pdf');
    expect(fetcher.mock.calls[1][0].toString()).toBe(`https://objects.example.test/private-bucket/${key}`);
    expect((fetcher.mock.calls[1][1]?.headers as Record<string, string>).authorization).toContain('Credential=access-id/');
    const body: Buffer[] = [];
    for await (const chunk of await storage.get(key)) body.push(Buffer.from(chunk));
    expect(Buffer.concat(body).toString()).toBe('private data');
    await storage.delete(key);
    await expect(storage.exists(key)).rejects.toThrow(/HTTP 503/);
  });
});
