import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

export interface PrivateDocumentStorage {
  readonly provider: 'local' | 's3';
  check(): Promise<void>;
  put(key: string, content: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Readable>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
}

export const isSafeObjectKey = (key: string): boolean =>
  /^[a-f0-9-]{36}\.(pdf|png|jpe?g)$/i.test(key);

export class LocalPrivateDocumentStorage implements PrivateDocumentStorage {
  readonly provider = 'local' as const;
  private readonly root: string;
  // Canonical form of root for comparing against realpath() results. They differ when the
  // root goes through a symlink or a Windows 8.3 short name (C:\Users\ABCDEF~1\...).
  private readonly realRoot: string;

  constructor(root = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads')) {
    this.root = path.resolve(root);
    fs.mkdirSync(this.root, { recursive: true, mode: 0o700 });
    try { fs.chmodSync(this.root, 0o700); } catch { /* Windows ACLs govern directory privacy there. */ }
    this.realRoot = fs.realpathSync.native(this.root);
  }

  private resolve(key: string): string {
    const resolved = path.isAbsolute(key) && process.env.NODE_ENV !== 'production'
      ? path.resolve(key) // Read-only compatibility for documents created before opaque storage keys.
      : isSafeObjectKey(key) ? path.resolve(this.root, key) : '';
    if (!resolved.startsWith(`${this.root}${path.sep}`)) throw new Error('Invalid private document key.');
    return resolved;
  }

  private async resolveExisting(key: string): Promise<string> {
    const resolved = await fs.promises.realpath(this.resolve(key));
    if (!resolved.startsWith(`${this.realRoot}${path.sep}`)) throw new Error('Invalid private document key.');
    const stat = await fs.promises.stat(resolved);
    if (!stat.isFile()) throw new Error('Private document object is not a file.');
    return resolved;
  }

  async check(): Promise<void> {
    await fs.promises.access(this.root, fs.constants.R_OK | fs.constants.W_OK);
  }

  async put(key: string, content: Buffer, _contentType?: string): Promise<void> {
    await fs.promises.writeFile(this.resolve(key), content, { flag: 'wx', mode: 0o600 });
  }

  async get(key: string): Promise<Readable> {
    return fs.createReadStream(await this.resolveExisting(key));
  }

  async exists(key: string): Promise<boolean> {
    try { await this.resolveExisting(key); return true; }
    catch (error: any) { if (error.code === 'ENOENT') return false; throw error; }
  }

  async delete(key: string): Promise<void> {
    try { await fs.promises.unlink(this.resolve(key)); }
    catch (error: any) { if (error.code !== 'ENOENT') throw error; }
  }
}

export interface S3StorageConfig {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  privateBucketConfirmed: boolean;
}

export function readS3StorageConfig(env: NodeJS.ProcessEnv = process.env): S3StorageConfig | null {
  const endpoint = env.OBJECT_STORAGE_ENDPOINT?.trim();
  const bucket = env.OBJECT_STORAGE_BUCKET?.trim();
  const region = env.OBJECT_STORAGE_REGION?.trim();
  const accessKeyId = env.OBJECT_STORAGE_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.OBJECT_STORAGE_SECRET_ACCESS_KEY;
  const privateBucketConfirmed = env.OBJECT_STORAGE_PRIVATE_BUCKET_CONFIRMED === 'true';
  const forcePathStyleValue = env.OBJECT_STORAGE_FORCE_PATH_STYLE;
  if (!endpoint || !bucket || !region || !accessKeyId || !secretAccessKey || !privateBucketConfirmed) return null;
  if (forcePathStyleValue && !['true', 'false'].includes(forcePathStyleValue)) return null;
  let parsed: URL;
  try { parsed = new URL(endpoint); } catch { return null; }
  if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) return null;
  if ((env.NODE_ENV === 'production' || env.VERCEL === '1') && parsed.protocol !== 'https:') return null;
  if (!/^[a-zA-Z0-9.-]{3,63}$/.test(bucket) || !/^[a-z0-9-]+$/.test(region)) return null;
  const endpointWithPath = `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}`;
  return { endpoint: endpointWithPath, bucket, region, accessKeyId, secretAccessKey, forcePathStyle: env.OBJECT_STORAGE_FORCE_PATH_STYLE !== 'false', privateBucketConfirmed };
}

function hmac(key: Buffer | string, value: string): Buffer {
  return crypto.createHmac('sha256', key).update(value, 'utf8').digest();
}

export class S3PrivateDocumentStorage implements PrivateDocumentStorage {
  readonly provider = 's3' as const;
  private readonly endpoint: URL;

  constructor(private readonly config: S3StorageConfig, private readonly fetcher: typeof fetch = fetch) {
    if (!config.privateBucketConfirmed) throw new Error('Private bucket access must be explicitly confirmed.');
    this.endpoint = new URL(config.endpoint);
  }

  private async signedRequest(method: string, key?: string, body?: Buffer, contentType?: string): Promise<Response> {
    if (key !== undefined && !isSafeObjectKey(key)) throw new Error('Invalid private document key.');
    const date = new Date();
    const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = crypto.createHash('sha256').update(body || Buffer.alloc(0)).digest('hex');
    const prefix = this.endpoint.pathname.replace(/\/$/, '');
    const bucketPath = `${prefix}/${encodeURIComponent(this.config.bucket)}`;
    const url = this.config.forcePathStyle
      ? new URL(`${bucketPath}${key === undefined ? '' : `/${key}`}`, this.endpoint.origin)
      : new URL(`${prefix}${key === undefined ? '' : `/${key}`}`, this.endpoint.origin);
    if (!this.config.forcePathStyle) url.host = `${this.config.bucket}.${url.host}`;
    const host = url.host;
    const headers: Record<string, string> = {
      host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    };
    if (contentType) headers['content-type'] = contentType;
    const signedHeaders = Object.keys(headers).sort().join(';');
    const canonicalHeaders = Object.keys(headers).sort().map((name) => `${name}:${headers[name].trim()}\n`).join('');
    const canonicalRequest = [method, url.pathname, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
    const scope = `${dateStamp}/${this.config.region}/s3/aws4_request`;
    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, crypto.createHash('sha256').update(canonicalRequest).digest('hex')].join('\n');
    const dateKey = hmac(`AWS4${this.config.secretAccessKey}`, dateStamp);
    const regionKey = hmac(dateKey, this.config.region);
    const serviceKey = hmac(regionKey, 's3');
    const signingKey = hmac(serviceKey, 'aws4_request');
    const signature = hmac(signingKey, stringToSign).toString('hex');
    headers.authorization = `AWS4-HMAC-SHA256 Credential=${this.config.accessKeyId}/${scope},SignedHeaders=${signedHeaders},Signature=${signature}`;
    const response = await this.fetcher(url, { method, headers, body: body as any, signal: AbortSignal.timeout(30_000) });
    return response;
  }

  async check(): Promise<void> {
    const response = await this.signedRequest('HEAD');
    if (!response.ok) throw new Error(`Private object storage preflight failed (HTTP ${response.status}).`);
  }

  async put(key: string, content: Buffer, contentType: string): Promise<void> {
    const response = await this.signedRequest('PUT', key, content, contentType);
    if (!response.ok) throw new Error(`Private object upload failed (HTTP ${response.status}).`);
  }

  async get(key: string): Promise<Readable> {
    const response = await this.signedRequest('GET', key);
    if (!response.ok || !response.body) throw new Error(`Private object download failed (HTTP ${response.status}).`);
    return Readable.fromWeb(response.body as import('stream/web').ReadableStream);
  }

  async exists(key: string): Promise<boolean> {
    const response = await this.signedRequest('HEAD', key);
    if (response.status === 404) return false;
    if (!response.ok) throw new Error(`Private object lookup failed (HTTP ${response.status}).`);
    return true;
  }

  async delete(key: string): Promise<void> {
    const response = await this.signedRequest('DELETE', key);
    if (!response.ok && response.status !== 404) throw new Error(`Private object deletion failed (HTTP ${response.status}).`);
  }
}

export function getDocumentStorage(env: NodeJS.ProcessEnv = process.env): PrivateDocumentStorage {
  const requested = env.DOCUMENT_STORAGE_PROVIDER || (env.NODE_ENV === 'production' ? 's3' : 'local');
  if (requested === 'local') {
    if (env.NODE_ENV === 'production' || env.VERCEL === '1') throw new Error('Local document storage is not allowed in production.');
    return new LocalPrivateDocumentStorage(env.UPLOAD_DIR);
  }
  if (requested === 's3') {
    const config = readS3StorageConfig(env);
    if (!config) throw new Error('Private S3-compatible storage is not fully configured.');
    return new S3PrivateDocumentStorage(config);
  }
  throw new Error('Unsupported document storage provider.');
}
